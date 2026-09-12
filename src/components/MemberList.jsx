// members: [{ name, schedule }]. selected: nombre actualmente elegido o null (= vista de grupo)
export default function MemberList({ members, selected, onSelect }) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <Pill active={selected === null} onClick={() => onSelect(null)}>
        Mapa del grupo
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
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium transition ${
        active
          ? 'bg-board-amber text-board-bg'
          : 'bg-board-panel text-board-cream/70 hover:text-board-cream'
      }`}
    >
      {children}
    </button>
  )
}