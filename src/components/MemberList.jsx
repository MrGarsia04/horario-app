// members: [{ name, schedule }]. selected: nombre actualmente elegido o null (= vista de grupo).
// En móvil las pastillas se desplazan en horizontal en lugar de ocupar varias filas.
export default function MemberList({ members, selected, onSelect }) {
  return (
    <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Ver horario de">
      <Pill active={selected === null} onClick={() => onSelect(null)}>
        Todos
      </Pill>
      {members.map((m) => (
        <Pill key={m.name} active={selected === m.name} onClick={() => onSelect(m.name)}>
          {m.name}
        </Pill>
      ))}
    </div>
  )
}

function Pill({ active, onClick, children }) {
  return (
    <button onClick={onClick} aria-pressed={active} className={active ? 'chip-on' : 'chip-off'}>
      {children}
    </button>
  )
}
