import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { qre } from '@/api/qre'
import { FormField, fieldErrorClass } from '@/components/forms/FormField'
import { Modal } from '@/components/ui/Modal'
import { WorkflowSteps } from '@/components/workflow/WorkflowSteps'
import { formatApiError } from '@/lib/apiMessage'
import { GOVERNANCE_LIFECYCLE } from '@/lib/workflow/governance'
import { parseForm } from '@/lib/validation/parseForm'
import { workloadSubmitSchema } from '@/lib/validation/schemas'
import { cn } from '@/lib/utils'

const WIZARD_STEPS = GOVERNANCE_LIFECYCLE.slice(0, 3)

type Row = Record<string, unknown>

/** Package workload and open review — Cert Studio–style steps inside modal. */
export function WorkloadSubmitWizard({
  open,
  onClose,
  projectId,
}: {
  open: boolean
  onClose: () => void
  projectId: string
}) {
  const client = useQueryClient()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [purpose, setPurpose] = useState('')
  const [resourceHint, setResourceHint] = useState('')
  const [notes, setNotes] = useState('')
  const [fields, setFields] = useState<Record<string, string>>({})

  const submit = useMutation({
    mutationFn: async () => {
      const metadata: Record<string, string> = { purpose: purpose.trim() }
      if (notes.trim()) metadata.notes = notes.trim()
      if (resourceHint.trim()) metadata.resource_hint = resourceHint.trim()
      const created = await qre<Row>('/workload-submissions', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, metadata }),
      })
      return qre<Row>(`/workload-submissions/${encodeURIComponent(String(created.submission_id))}/submit-for-review`, {
        method: 'POST',
      })
    },
    onSuccess: (row) => {
      setPurpose('')
      setResourceHint('')
      setNotes('')
      setStep(0)
      onClose()
      void client.invalidateQueries({ queryKey: ['project-approvals', projectId] })
      void client.invalidateQueries({ queryKey: ['project-activity', projectId] })
      void client.invalidateQueries({ queryKey: ['project', projectId] })
      if (row.workload_id) navigate(`/qrp/approvals/${String(row.workload_id)}`)
    },
  })

  const reset = () => {
    setStep(0)
    setFields({})
    onClose()
  }

  const validatePackage = () => {
    const parsed = parseForm(workloadSubmitSchema, {
      purpose,
      resource_hint: resourceHint.trim() || undefined,
      notes: notes.trim() || undefined,
    })
    if (!parsed.ok) {
      setFields(parsed.fieldErrors)
      return false
    }
    setFields({})
    return true
  }

  return (
    <Modal open={open} title="Submit for review" onClose={reset} className="max-w-xl">
      <WorkflowSteps steps={WIZARD_STEPS} current={step} label="Governance path" />
      <p className="mt-2 text-xs text-muted-foreground">
        Project <span className="font-mono text-foreground">{projectId}</span> is pre-scoped. After submit, reviewers see policy stages on the request record.
      </p>

      {step === 0 ? (
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (validatePackage()) setStep(1)
          }}
        >
          <FormField label="Purpose" htmlFor="wl-wizard-purpose" error={fields.purpose}>
            <input
              id="wl-wizard-purpose"
              className={cn('field-input w-full', fieldErrorClass(Boolean(fields.purpose)))}
              value={purpose}
              placeholder="Scientific / technical purpose for reviewers"
              onChange={(e) => setPurpose(e.target.value)}
              autoFocus
            />
          </FormField>
          <FormField label="Resource hint" htmlFor="wl-wizard-hint" error={fields.resource_hint} hint="Optional — not a booking">
            <input
              id="wl-wizard-hint"
              className={cn('field-input w-full', fieldErrorClass(Boolean(fields.resource_hint)))}
              value={resourceHint}
              placeholder="e.g. simulator class or catalogue ref"
              onChange={(e) => setResourceHint(e.target.value)}
            />
          </FormField>
          <FormField label="Notes for reviewers" htmlFor="wl-wizard-notes" error={fields.notes} hint="Optional">
            <textarea
              id="wl-wizard-notes"
              className={cn('field-input w-full min-h-[72px]', fieldErrorClass(Boolean(fields.notes)))}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={reset}>
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
            <strong>Review</strong> — quota and policy stages run before approve; you can track status under Requests or Approvals.
          </p>
          <p>
            <strong>Authorise</strong> — approvers record rationale; the audit trail is append-only.
          </p>
          <div className="flex justify-between gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setStep(0)}>
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
          {submit.error ? <p className="text-sm text-critical">{formatApiError(submit.error)}</p> : null}
          <dl className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm">
            <div className="flex justify-between gap-3 py-1">
              <dt className="text-muted-foreground">Purpose</dt>
              <dd className="max-w-[60%] text-end font-medium text-foreground">{purpose.trim()}</dd>
            </div>
            {resourceHint.trim() ? (
              <div className="flex justify-between gap-3 py-1">
                <dt className="text-muted-foreground">Resource hint</dt>
                <dd className="max-w-[60%] text-end text-foreground">{resourceHint.trim()}</dd>
              </div>
            ) : null}
            {notes.trim() ? (
              <div className="py-1">
                <dt className="text-muted-foreground">Notes</dt>
                <dd className="mt-1 whitespace-pre-wrap text-foreground">{notes.trim()}</dd>
              </div>
            ) : null}
          </dl>
          <div className="flex justify-between gap-2">
            <button type="button" className="btn-secondary" onClick={() => setStep(1)}>
              Back
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={submit.isPending}
              onClick={() => {
                if (validatePackage()) submit.mutate()
              }}
            >
              {submit.isPending ? 'Submitting…' : 'Submit for review'}
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}