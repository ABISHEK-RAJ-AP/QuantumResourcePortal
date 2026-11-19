import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { qre } from '@/api/qre'
import { FormField, fieldErrorClass } from '@/components/forms/FormField'
import { Modal } from '@/components/ui/Modal'
import { WorkflowSteps } from '@/components/workflow/WorkflowSteps'
import { GOVERNANCE_LIFECYCLE } from '@/lib/workflow/governance'
import { formatApiError } from '@/lib/apiMessage'
import { parseForm } from '@/lib/validation/parseForm'
import { projectCreateSchema } from '@/lib/validation/schemas'
import { cn } from '@/lib/utils'

const WIZARD_STEPS = GOVERNANCE_LIFECYCLE.slice(0, 3)

/** Cert Studio–style create flow: numbered trail inside the dialog, not on every list page. */
export function ProjectCreateWizard({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const client = useQueryClient()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [fields, setFields] = useState<Record<string, string>>({})

  const create = useMutation({
    mutationFn: () =>
      qre<Record<string, unknown>>('/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          project_type: 'quantum_circuit',
        }),
      }),
    onSuccess: (row) => {
      setName('')
      setDescription('')
      setStep(0)
      onClose()
      void client.invalidateQueries({ queryKey: ['projects'] })
      if (row.project_id) navigate(`/qrp/projects/${String(row.project_id)}`)
    },
  })

  const reset = () => {
    setStep(0)
    setFields({})
    onClose()
  }

  const validateDetails = () => {
    const parsed = parseForm(projectCreateSchema, {
      name,
      description: description.trim() || undefined,
    })
    if (!parsed.ok) {
      setFields(parsed.fieldErrors)
      return false
    }
    setFields({})
    return true
  }

  return (
    <Modal open={open} title="New project" onClose={reset} className="max-w-xl">
      <WorkflowSteps steps={WIZARD_STEPS} current={step} label="Governance path (preview)" />
      <p className="mt-2 text-xs text-muted-foreground">
        After create, packages move through review and authorise on the Approvals hub — full trail on each request.
      </p>

      {step === 0 ? (
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (validateDetails()) setStep(1)
          }}
        >
          <FormField label="Project name" htmlFor="wizard-project-name" error={fields.name}>
            <input
              id="wizard-project-name"
              className={cn('field-input w-full', fieldErrorClass(Boolean(fields.name)))}
              value={name}
              placeholder="e.g. QEC benchmark lane"
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </FormField>
          <FormField label="Description" htmlFor="wizard-project-desc" error={fields.description} hint="Optional">
            <input
              id="wizard-project-desc"
              className={cn('field-input w-full', fieldErrorClass(Boolean(fields.description)))}
              value={description}
              placeholder="Short purpose for reviewers"
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={reset}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Next — review path
            </button>
          </div>
        </form>
      ) : null}

      {step === 1 ? (
        <div className="mt-4 space-y-3 text-sm text-muted-foreground">
          <p className="text-foreground">
            <strong>Review</strong> — technical and policy stages run on submitted workloads; quota gates apply before
            approve.
          </p>
          <p>
            <strong>Authorise</strong> — approvers record rationale; audit trail is append-only.
          </p>
          <div className="flex justify-between gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setStep(0)}>
              Back
            </button>
            <button type="button" className="btn-primary" onClick={() => setStep(2)}>
              Next — confirm
            </button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="mt-4 space-y-3">
          {create.error ? (
            <p className="text-sm text-critical">{formatApiError(create.error)}</p>
          ) : null}
          <dl className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm">
            <div className="flex justify-between gap-3 py-1">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium text-foreground">{name.trim()}</dd>
            </div>
            {description.trim() ? (
              <div className="flex justify-between gap-3 py-1">
                <dt className="text-muted-foreground">Description</dt>
                <dd className="text-end text-foreground">{description.trim()}</dd>
              </div>
            ) : null}
          </dl>
          <div className="flex justify-between gap-2">
            <button type="button" className="btn-ghost" onClick={() => setStep(1)}>
              Back
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={create.isPending}
              onClick={() => {
                if (validateDetails()) create.mutate()
              }}
            >
              {create.isPending ? 'Creating…' : 'Create project'}
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}