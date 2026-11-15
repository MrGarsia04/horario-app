import { describe, it, expect, vi } from 'vitest'
import solicitar from '../recuperar/solicitar.js'
import confirmar from '../recuperar/confirmar.js'

function res() {
  const r = { headers: {}, setHeader: (k, v) => (r.headers[k] = v), status: (c) => ((r.code = c), r), json: (b) => ((r.body = b), r) }
  return r
}

describe('funciones /api/recuperar', () => {
  it('solo aceptan POST', async () => {
    for (const fn of [solicitar, confirmar]) {
      const r = res()
      await fn({ method: 'GET', headers: {} }, r)
      expect(r.code).toBe(405)
      expect(r.headers.Allow).toBe('POST')
    }
  })
  it('cuerpo no válido: 400', async () => {
    const r = res()
    await solicitar({ method: 'POST', headers: {}, body: 'no es json' }, r)
    expect(r.code).toBe(400)
  })
  it('sin variables de servidor devuelve 500 genérico sin detalles', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    vi.stubEnv('SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_URL', '')
    const r = res()
    await solicitar({ method: 'POST', headers: {}, body: { usuario: 'x' } }, r)
    expect(r.code).toBe(500)
    expect(JSON.stringify(r.body)).not.toMatch(/SERVICE_ROLE/)
    vi.unstubAllEnvs()
  })
})
