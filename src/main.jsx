import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './theme-rosa.css' // debe ir después de index.css (ver notas de especificidad en el archivo)
import './lib/theme' // aplica el tema guardado nada más arrancar

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
