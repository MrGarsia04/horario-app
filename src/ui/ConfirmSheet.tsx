import Sheet from './Sheet'
import Button from './Button'

interface Props {
  open: boolean
  title: string
  text: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}

/** Confirmación en hoja inferior (sustituye a window.confirm). */
export default function ConfirmSheet({ open, title, text, confirmLabel, danger = true, onConfirm, onClose }: Props) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex gap-2 pb-2">
          <Button variant="ghost" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button variant={danger ? 'danger' : 'primary'} className="flex-1" onClick={() => { onConfirm(); onClose() }}>{confirmLabel}</Button>
        </div>
      }
    >
      <p className="pb-4 text-sm text-board-cream/80">{text}</p>
    </Sheet>
  )
}
