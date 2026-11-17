import { z } from 'zod'

export type FieldErrors = Record<string, string>

export type ParseFormResult<T> =
  | { ok: true; data: T }
  | { ok: false; fieldErrors: FieldErrors; formError?: string }

/** Run a Zod schema and return field-level errors for inline forms. */
export function parseForm<T>(schema: z.ZodType<T>, input: unknown): ParseFormResult<T> {
  const result = schema.safeParse(input)
  if (result.success) return { ok: true, data: result.data }
  const fieldErrors: FieldErrors = {}
  for (const issue of result.error.issues) {
    const key = issue.path.length ? String(issue.path[0]) : '_form'
    if (!fieldErrors[key]) fieldErrors[key] = issue.message
  }
  const formError = fieldErrors._form
  delete fieldErrors._form
  return { ok: false, fieldErrors, formError }
}