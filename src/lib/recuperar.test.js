import { describe, it, expect, vi, beforeEach } from 'vitest'
import { requestRecoveryCode, confirmRecovery } from './recuperar'

const reply = (status, body) => ({ ok: status < 400, status, json: async () => body })
beforeEach(() => vi.stubGlobal('fetch', vi.fn()))

describe('recuperar (cliente)', () => {
  it('solicitar envía solo el usuario y devuelve el mensaje genérico', async () => {
    fetch.mockResolvedValue(reply(200, { ok: true, message: 'ok genérico' }))
    expect(await requestRecoveryCode(' Iker ')).toEqual({ data: 'ok genérico' })
    expect(fetch.mock.calls[0][0]).toBe('/api/recuperar/solicitar')
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ usuario: 'Iker' })
  })
  it('confirmar manda usuario, código y contraseña nueva', async () => {
    fetch.mockResolvedValue(reply(200, { ok: true, message: 'hecho' }))
    await confirmRecovery('Iker', ' 123456 ', 'nueva123')
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ usuario: 'Iker', codigo: '123456', nueva: 'nueva123' })
  })
  it('error del servidor: muestra su mensaje', async () => {
    fetch.mockResolvedValue(reply(400, { ok: false, message: 'Código incorrecto' }))
    expect(await confirmRecovery('Iker', '000000', 'nueva123')).toEqual({ error: 'Código incorrecto' })
  })
  it('sin red o sin JSON: mensajes claros', async () => {
    fetch.mockRejectedValue(new Error('offline'))
    expect((await requestRecoveryCode('Iker')).error).toMatch(/conectar/)
    fetch.mockResolvedValue({ ok: false, status: 404, json: async () => { throw new Error('no json') } })
    expect((await requestRecoveryCode('Iker')).error).toMatch(/más tarde/)
  })
})
