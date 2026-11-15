import type { ReactNode } from 'react'

export function Card({ children, className = '', ...rest }: { children: ReactNode; className?: string } & Record<string, unknown>) {
  return <div className={`card ${className}`} {...rest}>{children}</div>
}

export function Chip({ active, onClick, children, ...rest }: { active?: boolean; onClick?: () => void; children: ReactNode } & Record<string, unknown>) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={active ? 'chip-on' : 'chip-off'} {...rest}>
      {children}
    </button>
  )
}

/** Pestañas tipo «segmentado»: pocas opciones, siempre visibles. */
export function Tabs<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: { id: T; label: string; tour?: string }[]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex rounded-xl border border-board-line bg-board-panel p-1">
      {items.map((it) => (
        <button
          key={it.id}
          role="tab"
          data-tour={it.tour}
          aria-selected={value === it.id}
          onClick={() => onChange(it.id)}
          className={`min-h-[40px] flex-1 rounded-lg px-3 text-sm font-medium transition ${value === it.id ? 'bg-board-amber text-board-onaccent' : 'text-board-cream/70 hover:text-board-cream'}`}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className="relative h-7 w-12 shrink-0 rounded-full border border-board-line transition" style={{ backgroundColor: checked ? 'rgb(var(--board-amber))' : 'rgb(var(--board-panel))' }}>
      <span className="absolute top-0.5 h-5 w-5 rounded-full bg-board-cream transition-all" style={{ left: checked ? 24 : 3 }} />
    </button>
  )
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-board-line px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      {text && <p className="mx-auto mt-1 max-w-xs text-sm text-board-cream/60">{text}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

/** Desplegable simple (acordeón) para opciones avanzadas. */
export function Disclosure({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-xl border border-board-line">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between px-4 text-sm font-medium">
        {title}
        <span className="text-board-cream/50 transition group-open:rotate-180" aria-hidden="true">⌄</span>
      </summary>
      <div className="space-y-3 border-t border-board-line px-4 py-3">{children}</div>
    </details>
  )
}
