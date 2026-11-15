import ContactEmailCard from './ContactEmailCard'

// Se muestra justo después de iniciar sesión si el perfil no tiene email de contacto.
export default function EmailPromptScreen({ onSkip }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <ContactEmailCard onSkip={onSkip} title="¿Quieres añadir tu correo?" />
      </div>
    </div>
  )
}
