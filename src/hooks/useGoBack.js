import { useLocation, useNavigate } from 'react-router-dom'

// Vuelve atrás en el historial; si se entró directamente por URL (sin historial
// propio), va a la lista de grupos en lugar de salir de la app.
export function useGoBack(fallback = '/grupos') {
  const navigate = useNavigate()
  const location = useLocation()
  return () => (location.key !== 'default' ? navigate(-1) : navigate(fallback, { replace: true }))
}
