/** Lightweight toast bus — TeleScope notify* API without react-toastify. */

export type ToastTone = 'success' | 'error' | 'info' | 'warn'

export type ToastItem = {
  id: string
  message: string
  tone: ToastTone
  createdAt: number
}

export const TOAST_EVENT = 'qrp:toast'
export const TOAST_DISMISS_EVENT = 'qrp:toast-dismiss'

type ToastDetail = { id?: string; message: string; tone: ToastTone }

function emit(detail: ToastDetail) {
  const id = detail.id || `${detail.tone}:${detail.message.slice(0, 48)}`
  window.dispatchEvent(
    new CustomEvent<ToastItem>(TOAST_EVENT, {
      detail: { id, message: detail.message, tone: detail.tone, createdAt: Date.now() },
    }),
  )
}

export function notifySuccess(message: string, opts?: { toastId?: string }) {
  emit({ message, tone: 'success', id: opts?.toastId })
}

export function notifyError(message: string, opts?: { toastId?: string }) {
  emit({ message, tone: 'error', id: opts?.toastId || `err:${message.slice(0, 40)}` })
}

export function notifyInfo(message: string, opts?: { toastId?: string }) {
  emit({ message, tone: 'info', id: opts?.toastId })
}

export function notifyWarn(message: string, opts?: { toastId?: string }) {
  emit({ message, tone: 'warn', id: opts?.toastId || `warn:${message.slice(0, 40)}` })
}

export function dismissToast(id: string) {
  window.dispatchEvent(new CustomEvent(TOAST_DISMISS_EVENT, { detail: { id } }))
}
