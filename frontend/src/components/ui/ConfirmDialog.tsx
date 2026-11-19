import { useCallback, useState, type ReactNode } from 'react'

import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'

export type ConfirmDialogOptions = {
  title: string
  body: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Destructive / irreversible actions — primary button uses critical styling. */
  danger?: boolean
  onConfirm: () => void
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  busy = false,
  onConfirm,
  onClose,
}: ConfirmDialogOptions & {
  open: boolean
  busy?: boolean
  onClose: () => void
}) {
  const safeClose = busy ? () => undefined : onClose
  return (
    <Modal open={open} title={title} onClose={safeClose}>
      <div className="space-y-4">
        <div className="text-sm leading-relaxed text-muted-foreground">{body}</div>
        <p className="text-xs text-muted-foreground">This cannot be undone from the console.</p>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-ghost" disabled={busy} onClick={safeClose}>
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            className={cn(danger ? 'rounded-xl bg-critical px-4 py-2 text-sm font-semibold text-white disabled:opacity-50' : 'btn-primary')}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/** ponytail: one dialog host per page — avoids window.confirm for keyboard/a11y. */
export function useConfirmDialog() {
  const [opts, setOpts] = useState<ConfirmDialogOptions | null>(null)
  const openConfirm = useCallback((next: ConfirmDialogOptions) => setOpts(next), [])
  const close = useCallback(() => setOpts(null), [])

  const handleConfirm = useCallback(() => {
    if (!opts) return
    opts.onConfirm()
    close()
  }, [close, opts])

  const host = (
    <ConfirmDialog
      open={opts != null}
      title={opts?.title ?? ''}
      body={opts?.body ?? ''}
      confirmLabel={opts?.confirmLabel}
      cancelLabel={opts?.cancelLabel}
      danger={opts?.danger}
      onConfirm={handleConfirm}
      onClose={close}
    />
  )

  return { openConfirm, confirmDialog: host }
}