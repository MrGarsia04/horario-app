// Cliente de la recuperación de contraseña (las funciones viven en /api, ver api/_lib/recuperar.js).
async function post(path, payload) {
  let res
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    return { error: 'No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.' }
  }
  let body = null
  try {
    body = await res.json()
  } catch {
    /* respuesta sin JSON (p. ej. la función no existe en este entorno) */
  }
  if (!res.ok || !body?.ok) {
    return { error: body?.message || 'No se pudo completar la operación. Inténtalo más tarde.' }
  }
  return { data: body.message }
}

export const requestRecoveryCode = (usuario) => post('/api/recuperar/solicitar', { usuario: usuario.trim() })

export function confirmRecovery(usuario, codigo, nueva) {
  return post('/api/recuperar/confirmar', { usuario: usuario.trim(), codigo: codigo.trim(), nueva })
}
