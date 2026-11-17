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

export const assetRegisterSchema = z.object({
  provider_id: nonEmpty('Provider id'),
  native_asset_id: nonEmpty('Native asset id'),
  asset_class: nonEmpty('Asset class').max(64, 'Asset class is too long'),
  execution_class: z.enum(['simulated', 'hardware']),
})

export const assetImportSchema = z.object({
  provider_id: nonEmpty('Provider id'),
  csv: z
    .string()
    .trim()
    .min(24, 'CSV must include a header row and at least one data row')
    .refine((s) => s.includes('native_asset_id'), 'CSV must include a native_asset_id column header'),
})

export const poolCreateSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80, 'Name is too long'),
})

export const projectMemberSchema = z.object({
  username: z.string().trim().min(2, 'Username must be at least 2 characters').max(64, 'Username is too long'),
  role: z.enum(['editor', 'viewer']),
})

export const workloadSubmitSchema = z.object({
  purpose: z.string().trim().min(4, 'Purpose must be at least 4 characters').max(500, 'Purpose is too long'),
  resource_hint: z.string().trim().max(200, 'Resource hint is too long').optional(),
  notes: z.string().trim().max(2000, 'Notes are too long').optional(),
})

export const roleCreateSchema = z.object({
  code: z.string().regex(/^[A-Z][A-Z0-9_]{2,31}$/, 'Code must be UPPER_SNAKE, 3–32 characters'),
  name: z.string().trim().min(2, 'Display name is required').max(120, 'Name is too long'),
  description: z.string().trim().max(500, 'Description is too long').optional(),
  permission_codes: z.array(z.string()).min(1, 'Select at least one permission'),
})

export const roleEditSchema = roleCreateSchema.omit({ code: true })

export const evidenceLabelSchema = z.object({
  label: z.string().trim().max(120, 'Label is too long').optional(),
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