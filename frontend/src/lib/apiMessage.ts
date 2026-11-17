import { ApiError } from '@/api/client'

export type ApiMessageInfo = {
  message: string
  correlationId: string | null
  status: number | null
  forbidden: boolean
  notFound: boolean
}

export function apiMessage(error: unknown): ApiMessageInfo {
  if (error instanceof ApiError) {
    return {
      message: error.detail || error.title,
      correlationId: error.correlationId,
      status: error.status,
      forbidden: error.status === 403,
      notFound: error.status === 404,
    }
  }
  if (error instanceof Error) {
    return {
      message: error.message,
      correlationId: null,
      status: null,
      forbidden: false,
      notFound: false,
    }
  }
  return {
    message: 'Request failed',
    correlationId: null,
    status: null,
    forbidden: false,
    notFound: false,
  }
}

/** One-line operator string; appends correlation id when the API returned one. */
export function formatApiError(error: unknown): string {
  const { message, correlationId } = apiMessage(error)
  if (correlationId) return `${message} (ref ${correlationId})`
  return message
}