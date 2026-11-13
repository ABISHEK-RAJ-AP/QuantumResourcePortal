import { Modal } from '@/components/ui/Modal'

/** Confirmation before critical actions — no bounce, enter from 0.95. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  body: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={busy ? () => undefined : onCancel}
      className="popover-scale-in"
      footer={
        <>
          <button type="button" className="btn-ghost" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? 'btn-primary bg-critical hover:brightness-95' : 'btn-primary'}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
    </Modal>
  )
}
