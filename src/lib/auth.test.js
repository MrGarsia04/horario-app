import { describe, it, expect, vi, beforeEach } from 'vitest'

const sb = vi.hoisted(() => ({
  rpc: vi.fn(),
  auth: { signUp: vi.fn(), signInWithPassword: vi.fn(), signOut: vi.fn() },
  from: vi.fn(),
}))
vi.mock('./supabaseClient', () => ({ supabase: sb }))

import { signIn, signUp, saveContactEmail, INTERNAL_EMAIL_DOMAIN } from './auth'

// rpc simulado por nombre de función
function rpcs(map) {
  sb.rpc.mockImplementation(async (name) => ({ data: map[name] ?? null, error: null }))
}

beforeEach(() => vi.resetAllMocks())

describe('signIn', () => {
  it('cuenta ya migrada: busca el email interno por usuario y entra con la contraseña', async () => {
    rpcs({ login_alias: 'x@usuarios.horario-app.com' })
    sb.auth.signInWithPassword.mockResolvedValue({ error: null })
    expect(await signIn('Iker', 'secreta1')).toEqual({ data: true })
    expect(sb.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'x@usuarios.horario-app.com', password: 'secreta1' })
  })
  it('contraseña incorrecta: mensaje único', async () => {
    rpcs({ login_alias: 'x@usuarios.horario-app.com' })
    sb.auth.signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    expect((await signIn('Iker', 'mala')).error).toBe('Usuario o contraseña incorrectos.')
  })
  it('usuario inexistente: el mismo mensaje y no se crea nada', async () => {
    rpcs({ login_alias: null, legacy_claim_valid: false })
    expect((await signIn('nadie', 'x')).error).toBe('Usuario o contraseña incorrectos.')
    expect(sb.auth.signUp).not.toHaveBeenCalled()
  })
  it('cuenta antigua con contraseña correcta: migra en silencio con la misma contraseña', async () => {
    rpcs({ login_alias: null, legacy_claim_valid: true })
    sb.auth.signUp.mockResolvedValue({ data: { session: {} }, error: null })
    expect(await signIn('Iker', 'TempIker2026')).toEqual({ data: true })
    const arg = sb.auth.signUp.mock.calls[0][0]
    expect(arg.password).toBe('TempIker2026')
    expect(arg.email.endsWith('@' + INTERNAL_EMAIL_DOMAIN)).toBe(true)
    expect(arg.options.data.legacy_username).toBe('Iker')
    expect(arg.options.data.legacy_hash).toMatch(/^[0-9a-f]{64}$/)
  })
  it('cuenta antigua con contraseña corta: pide una nueva y luego migra', async () => {
    rpcs({ login_alias: null, legacy_claim_valid: true })
    expect(await signIn('Iker', 'abc')).toEqual({ needNewPassword: true })
    expect(sb.auth.signUp).not.toHaveBeenCalled()
    sb.auth.signUp.mockResolvedValue({ data: { session: {} }, error: null })
    expect(await signIn('Iker', 'abc', 'nueva1234')).toEqual({ data: true })
    expect(sb.auth.signUp.mock.calls[0][0].password).toBe('nueva1234')
  })
  it('cuenta antigua con contraseña incorrecta: no migra', async () => {
    rpcs({ login_alias: null, legacy_claim_valid: false })
    expect((await signIn('Iker', 'otra')).error).toBeTruthy()
    expect(sb.auth.signUp).not.toHaveBeenCalled()
  })
})

describe('signUp', () => {
  it('rechaza nombre en uso sin crear cuenta', async () => {
    rpcs({ username_available: false })
    expect((await signUp('Iker', 'secreta1')).error).toMatch(/ya está en uso/)
    expect(sb.auth.signUp).not.toHaveBeenCalled()
  })
  it('crea la cuenta con email interno y el nombre en los metadatos', async () => {
    rpcs({ username_available: true })
    sb.auth.signUp.mockResolvedValue({ data: { session: {} }, error: null })
    expect(await signUp('Ana', 'secreta1')).toEqual({ data: true })
    const arg = sb.auth.signUp.mock.calls[0][0]
    expect(arg.email.endsWith('@' + INTERNAL_EMAIL_DOMAIN)).toBe(true)
    expect(arg.options.data).toEqual({ username: 'Ana' })
  })
  it('contraseña demasiado corta', async () => {
    expect((await signUp('Ana', '123')).error).toMatch(/al menos 6/)
  })
  it('sin sesión (Confirm email activo) avisa en vez de fallar en silencio', async () => {
    rpcs({ username_available: true })
    sb.auth.signUp.mockResolvedValue({ data: { session: null }, error: null })
    expect((await signUp('Ana', 'secreta1')).error).toMatch(/Confirm email/)
  })
})

describe('saveContactEmail', () => {
  it('valida el formato antes de guardar', async () => {
    expect((await saveContactEmail('p1', 'no-es-email')).error).toMatch(/no parece válido/)
    expect(sb.from).not.toHaveBeenCalled()
  })
  it('guarda en profile_private y permite borrarlo', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    sb.from.mockReturnValue({ upsert })
    expect(await saveContactEmail('p1', ' a@b.com ')).toEqual({ data: 'a@b.com' })
    expect(sb.from).toHaveBeenCalledWith('profile_private')
    expect(upsert.mock.calls[0][0]).toMatchObject({ profile_id: 'p1', contact_email: 'a@b.com' })
    expect(await saveContactEmail('p1', '')).toEqual({ data: null })
  })
})
