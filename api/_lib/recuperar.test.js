import { describe, it, expect, beforeEach, vi } from 'vitest'
import { solicitar, confirmar, hashCode, GENERIC_REQUEST_MESSAGE, MAX_ATTEMPTS } from './recuperar.js'

const SECRET = 'secreto-de-prueba'

function memoryStore({ profiles = [], emails = {} } = {}) {
  const s = {
    profiles,
    emails,
    codes: new Map(),
    requests: [],
    authPasswords: {},
    legacyHashes: {},
    revoked: [],
    findProfileByUsername: async (n) => profiles.find((p) => p.username.toLowerCase() === n.toLowerCase()) ?? null,
    getContactEmail: async (id) => emails[id] ?? null,
    countRequests: async ({ profileId, ipHash, since }) =>
      s.requests.filter((r) => r.at >= since && (!profileId || r.profileId === profileId) && (!ipHash || r.ipHash === ipHash)).length,
    logRequest: async (r) => void s.requests.push(r),
    saveCode: async (id, code_hash, expires_at) => void s.codes.set(id, { code_hash, expires_at, attempts: 0 }),
    getCode: async (id) => s.codes.get(id) ?? null,
    bumpAttempts: async (id) => {
      const c = s.codes.get(id)
      if (!c) return 0
      c.attempts += 1
      return c.attempts
    },
    deleteCode: async (id) => void s.codes.delete(id),
    setAuthPassword: async (authId, pw) => void (s.authPasswords[authId] = pw),
    revokeSessions: async (authId) => void s.revoked.push(authId),
    setLegacyPassword: async (id, h) => void (s.legacyHashes[id] = h),
  }
  return s
}

let clock, mails, deps, store
const IKER = { id: 'p1', username: 'Iker', auth_id: 'a1' }
const VIEJO = { id: 'p2', username: 'Viejo', auth_id: null }

function setup(extra) {
  store = memoryStore({ profiles: [IKER, VIEJO], emails: { p1: 'iker@mail.com', p2: 'viejo@mail.com' }, ...extra })
  mails = []
  clock = new Date('2026-11-15T10:00:00Z')
  deps = {
    store,
    mail: vi.fn(async (m) => void mails.push(m)),
    now: () => clock,
    rnd: () => 123456,
    secret: SECRET,
  }
}
beforeEach(() => setup())

describe('solicitar', () => {
  it('envía un código al correo guardado y solo guarda su hash', async () => {
    const r = await solicitar({ usuario: 'iker', ip: '1.1.1.1' }, deps)
    expect(r).toEqual({ status: 200, body: { ok: true, message: GENERIC_REQUEST_MESSAGE } })
    expect(mails).toHaveLength(1)
    expect(mails[0]).toMatchObject({ to: 'iker@mail.com', code: '123456' })
    const saved = store.codes.get('p1')
    expect(saved.code_hash).toBe(hashCode(SECRET, 'p1', '123456'))
    expect(JSON.stringify(saved)).not.toContain('123456')
    expect(saved.expires_at.getTime() - clock.getTime()).toBe(15 * 60 * 1000)
  })
  it('rellena con ceros a la izquierda', async () => {
    deps.rnd = () => 42
    await solicitar({ usuario: 'iker', ip: 'x' }, deps)
    expect(mails[0].code).toBe('000042')
  })
  it('responde igual si el usuario no existe o no tiene correo (y no envía nada)', async () => {
    const a = await solicitar({ usuario: 'nadie', ip: 'x' }, deps)
    store.emails = {}
    delete store.emails.p1
    const b = await solicitar({ usuario: 'Iker', ip: 'y' }, { ...deps, store: Object.assign(store, { getContactEmail: async () => null }) })
    expect(a).toEqual(b)
    expect(mails).toHaveLength(0)
  })
  it('pedir otro código invalida el anterior', async () => {
    await solicitar({ usuario: 'iker', ip: 'x' }, deps)
    deps.rnd = () => 999999
    await solicitar({ usuario: 'iker', ip: 'x' }, deps)
    const r = await confirmar({ usuario: 'iker', codigo: '123456', nueva: 'nueva123' }, deps)
    expect(r.status).toBe(400)
  })
  it('máximo 3 solicitudes por hora y usuario; luego responde igual pero no envía', async () => {
    for (let i = 0; i < 5; i++) await solicitar({ usuario: 'iker', ip: 'ip' + i }, deps)
    expect(mails).toHaveLength(3)
    clock = new Date(clock.getTime() + 61 * 60 * 1000)
    await solicitar({ usuario: 'iker', ip: 'ip9' }, deps)
    expect(mails).toHaveLength(4)
  })
  it('límite por IP, incluso para usuarios inexistentes', async () => {
    for (let i = 0; i < 12; i++) await solicitar({ usuario: 'u' + i, ip: '9.9.9.9' }, deps)
    await solicitar({ usuario: 'iker', ip: '9.9.9.9' }, deps)
    expect(mails).toHaveLength(0)
    await solicitar({ usuario: 'iker', ip: '8.8.8.8' }, deps)
    expect(mails).toHaveLength(1)
  })
  it('un fallo del SMTP no cambia la respuesta ni la revela', async () => {
    deps.mail = vi.fn().mockRejectedValue(new Error('SMTP caído'))
    const r = await solicitar({ usuario: 'iker', ip: 'x' }, deps)
    expect(r.status).toBe(200)
  })
  it('usuario vacío: 400', async () => {
    expect((await solicitar({ usuario: '  ', ip: 'x' }, deps)).status).toBe(400)
  })
})

describe('confirmar', () => {
  beforeEach(async () => {
    await solicitar({ usuario: 'iker', ip: 'x' }, deps)
  })
  it('código correcto: cambia la contraseña, cierra sesiones y no se puede reutilizar', async () => {
    const r = await confirmar({ usuario: 'IKER', codigo: '123456', nueva: 'nueva123' }, deps)
    expect(r.status).toBe(200)
    expect(store.authPasswords.a1).toBe('nueva123')
    expect(store.revoked).toEqual(['a1'])
    const again = await confirmar({ usuario: 'iker', codigo: '123456', nueva: 'otra12345' }, deps)
    expect(again.status).toBe(400)
    expect(store.authPasswords.a1).toBe('nueva123')
  })
  it('código incorrecto: mensaje genérico y no cambia nada', async () => {
    const r = await confirmar({ usuario: 'iker', codigo: '000000', nueva: 'nueva123' }, deps)
    expect(r.status).toBe(400)
    expect(store.authPasswords.a1).toBeUndefined()
  })
  it('tras 5 fallos el código se invalida aunque luego se acierte', async () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) await confirmar({ usuario: 'iker', codigo: '111111', nueva: 'nueva123' }, deps)
    const r = await confirmar({ usuario: 'iker', codigo: '123456', nueva: 'nueva123' }, deps)
    expect(r.status).toBe(400)
    expect(store.authPasswords.a1).toBeUndefined()
  })
  it('el quinto intento puede ser el bueno', async () => {
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) await confirmar({ usuario: 'iker', codigo: '111111', nueva: 'nueva123' }, deps)
    expect((await confirmar({ usuario: 'iker', codigo: '123456', nueva: 'nueva123' }, deps)).status).toBe(200)
  })
  it('código caducado', async () => {
    clock = new Date(clock.getTime() + 16 * 60 * 1000)
    expect((await confirmar({ usuario: 'iker', codigo: '123456', nueva: 'nueva123' }, deps)).status).toBe(400)
    expect(store.codes.has('p1')).toBe(false)
  })
  it('contraseña nueva demasiado corta: no gasta el código', async () => {
    const r = await confirmar({ usuario: 'iker', codigo: '123456', nueva: 'abc' }, deps)
    expect(r.status).toBe(400)
    expect(r.body.message).toMatch(/al menos 6/)
    expect(store.codes.has('p1')).toBe(true)
  })
  it('formato de código raro o usuario inexistente: mismo mensaje genérico', async () => {
    const a = await confirmar({ usuario: 'iker', codigo: 'abc', nueva: 'nueva123' }, deps)
    const b = await confirmar({ usuario: 'nadie', codigo: '123456', nueva: 'nueva123' }, deps)
    expect(a.body.message).toBe(b.body.message)
  })
  it('no sirve el código de otro usuario', async () => {
    deps.rnd = () => 555555
    await solicitar({ usuario: 'viejo', ip: 'z' }, deps)
    const r = await confirmar({ usuario: 'iker', codigo: '555555', nueva: 'nueva123' }, deps)
    expect(r.status).toBe(400)
  })
  it('cuenta antigua sin migrar: deja la contraseña nueva como hash antiguo', async () => {
    deps.rnd = () => 777777
    await solicitar({ usuario: 'viejo', ip: 'z' }, deps)
    const r = await confirmar({ usuario: 'viejo', codigo: '777777', nueva: 'nueva123' }, deps)
    expect(r.status).toBe(200)
    expect(store.legacyHashes.p2).toMatch(/^[0-9a-f]{64}$/)
    expect(store.authPasswords).toEqual({})
  })
})
