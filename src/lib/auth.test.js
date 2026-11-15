import { describe, it, expect, vi, beforeEach } from 'vitest'

const sb = vi.hoisted(() => ({
  rpc: vi.fn(),
  auth: { signUp: vi.fn(), signInWithPassword: vi.fn(), signOut: vi.fn() },
  from: vi.fn(),
}))
vi.mock('./supabaseClient', () => ({ supabase: sb }))

import { claimLegacyAccount } from './auth'

function profileIs(username) {
  sb.from.mockReturnValue({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: username ? { username } : null }) }) }),
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  globalThis.window = { location: { origin: 'http://localhost:5173' } }
})

describe('claimLegacyAccount', () => {
  it('verifica la contraseña antigua ANTES de crear nada en Auth', async () => {
    sb.rpc.mockResolvedValue({ data: false, error: null })
    const r = await claimLegacyAccount('Iker', 'mala', 'a@b.com', 'nueva123')
    expect(r.error).toMatch(/incorrectos/)
    expect(sb.rpc).toHaveBeenCalledWith('legacy_claim_valid', expect.objectContaining({ p_username: 'Iker' }))
    expect(sb.auth.signUp).not.toHaveBeenCalled()
  })
  it('si la función no existe, muestra el error y no crea la cuenta', async () => {
    sb.rpc.mockResolvedValue({ data: null, error: { message: 'Could not find the function' } })
    const r = await claimLegacyAccount('Iker', 'x', 'a@b.com', 'nueva123')
    expect(r.error).toBeTruthy()
    expect(sb.auth.signUp).not.toHaveBeenCalled()
  })
  it('camino feliz: signUp con los datos de reclamación', async () => {
    sb.rpc.mockResolvedValue({ data: true, error: null })
    sb.auth.signUp.mockResolvedValue({ data: { session: {} }, error: null })
    const r = await claimLegacyAccount('Iker', 'vieja', 'a@b.com', 'nueva123')
    expect(r).toEqual({ data: { needsConfirmation: false } })
    const opts = sb.auth.signUp.mock.calls[0][0].options.data
    expect(opts.legacy_username).toBe('Iker')
    expect(opts.legacy_hash).toMatch(/^[0-9a-f]{64}$/)
  })
  it('email ya existente y la contraseña nueva abre la cuenta de ese mismo usuario: éxito idempotente', async () => {
    sb.rpc.mockResolvedValue({ data: true, error: null })
    sb.auth.signUp.mockResolvedValue({ data: {}, error: { message: 'User already registered' } })
    sb.auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    profileIs('iker')
    const r = await claimLegacyAccount('Iker', 'vieja', 'a@b.com', 'nueva123')
    expect(r.data).toBeTruthy()
    expect(sb.auth.signOut).not.toHaveBeenCalled()
  })
  it('email ya existente con otra contraseña: mensaje claro', async () => {
    sb.rpc.mockResolvedValue({ data: true, error: null })
    sb.auth.signUp.mockResolvedValue({ data: {}, error: { message: 'User already registered' } })
    sb.auth.signInWithPassword.mockResolvedValue({ data: {}, error: { message: 'Invalid login credentials' } })
    const r = await claimLegacyAccount('Iker', 'vieja', 'a@b.com', 'nueva123')
    expect(r.error).toMatch(/otra contraseña/)
    expect(r.error).toMatch(/olvidado/)
  })
  it('email ya existente que pertenece a otro perfil: cierra sesión y avisa', async () => {
    sb.rpc.mockResolvedValue({ data: true, error: null })
    sb.auth.signUp.mockResolvedValue({ data: {}, error: { message: 'User already registered' } })
    sb.auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'u2' } }, error: null })
    profileIs('otro')
    const r = await claimLegacyAccount('Iker', 'vieja', 'a@b.com', 'nueva123')
    expect(r.error).toMatch(/no es la de este usuario/)
    expect(sb.auth.signOut).toHaveBeenCalled()
  })
})
