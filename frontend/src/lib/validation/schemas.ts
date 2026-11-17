import { z } from 'zod'

const nonEmpty = (label: string) => z.string().trim().min(1, `${label} is required`)

export const loginSchema = z.object({
  username: nonEmpty('Username'),
  password: z.string().min(1, 'Password is required'),
})

export const passwordResetSchema = z
  .object({
    token: nonEmpty('Reset token'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm: z.string().min(1, 'Confirm your password'),
  })
  .refine((v) => v.password === v.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  })

export const projectCreateSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120, 'Name is too long'),
  description: z.string().trim().max(500, 'Description is too long').optional(),
})

export const reservationHoldSchema = z
  .object({
    resource_ref: nonEmpty('Resource'),
    project_id: z.string().trim().optional(),
    window_start: nonEmpty('Window start'),
    window_end: nonEmpty('Window end'),
    purpose: z.string().trim().min(3, 'Purpose must be at least 3 characters').max(240, 'Purpose is too long'),
  })
  .superRefine((v, ctx) => {
    const startMs = new Date(v.window_start).getTime()
    const endMs = new Date(v.window_end).getTime()
    if (!Number.isFinite(startMs)) {
      ctx.addIssue({ code: 'custom', message: 'Invalid start time', path: ['window_start'] })
    }
    if (!Number.isFinite(endMs)) {
      ctx.addIssue({ code: 'custom', message: 'Invalid end time', path: ['window_end'] })
    }
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs <= startMs) {
      ctx.addIssue({ code: 'custom', message: 'End must be after start', path: ['window_end'] })
    }
  })

export const approvalDecisionSchema = z.object({
  decision: z.enum(['approve', 'reject', 'changes_requested', 'withdraw']),
  comment: z.string().trim(),
  requireRationale: z.boolean().optional(),
})
  .superRefine((v, ctx) => {
    const needsNote = v.requireRationale || v.decision === 'reject' || v.decision === 'changes_requested'
    if (needsNote && v.comment.length < 8) {
      ctx.addIssue({
        code: 'custom',
        message: 'Add a short rationale (at least 8 characters) for the audit trail',
        path: ['comment'],
      })
    }
  })

export const membershipGrantSchema = z
  .object({
    principal_id: nonEmpty('User'),
    role_code: nonEmpty('Role'),
    scope_type: z.string(),
    scope_id: z.string().trim().optional(),
  })
  .superRefine((v, ctx) => {
    const needsScope = v.scope_type === 'PROJECT' || v.scope_type === 'PROVIDER'
    if (needsScope && !v.scope_id?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: v.scope_type === 'PROJECT' ? 'Project id is required for this role' : 'Provider id is required',
        path: ['scope_id'],
      })
    }
  })