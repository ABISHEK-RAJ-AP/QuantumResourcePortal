import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { asList, qre } from '@/api/qre'
import { FormField, fieldErrorClass } from '@/components/forms/FormField'
import type { Crumb } from '@/components/layout/Breadcrumbs'
import { Card, Notice, Page } from '@/components/layout/Page'
import type { WorkflowStep } from '@/components/workflow/WorkflowSteps'
import { parseForm } from '@/lib/validation/parseForm'
import { assetImportSchema, assetRegisterSchema } from '@/lib/validation/schemas'
import { cn } from '@/lib/utils'
import { message } from '@/pages/workspace/screens'

type Row = Record<string, unknown>
type RegisterMode = 'single' | 'bulk'

const WORKFLOW: WorkflowStep[] = [
  { id: 'method', label: 'Method', detail: 'One catalogue record or validated CSV import.', roles: ['asset:write', 'asset:import'] },
  { id: 'details', label: 'Details', detail: 'Provider id and identity fields the ledger keys on.' },
  { id: 'review', label: 'Review', detail: 'Confirm payload before commit — imports roll back on any bad row.' },
  { id: 'complete', label: 'Complete', detail: 'Open the asset record or return to the catalogue.' },
]

const STEP_SLUGS = WORKFLOW.map((s) => s.id)

function stepIndexFromParam(raw: string | null): number {
  if (!raw) return 0
  const num = Number.parseInt(raw, 10)
  if (Number.isFinite(num) && num >= 0 && num < WORKFLOW.length) return num
  const byId = STEP_SLUGS.indexOf(raw)
  return byId >= 0 ? byId : 0
}

function stepSlug(index: number) {
  return STEP_SLUGS[Math.min(Math.max(index, 0), WORKFLOW.length - 1)] ?? 'method'
}

const fieldClass = 'field-input w-full'
const buttonClass = 'btn-primary'

export function AssetRegisterWorkflow() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const step = stepIndexFromParam(searchParams.get('step'))
  const modeParam = searchParams.get('mode')
  const mode: RegisterMode = modeParam === 'bulk' ? 'bulk' : 'single'

  const providersQuery = useQuery({
    queryKey: ['providers'],
    queryFn: () => qre<unknown>('/providers'),
  })
  const providers = useMemo(() => asList(providersQuery.data) as Row[], [providersQuery.data])

  const [form, setForm] = useState({
    provider_id: '',
    native_asset_id: '',
    asset_class: '',
    execution_class: 'simulated',
  })
  const [csv, setCsv] = useState('native_asset_id,asset_class,execution_class\n')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<Row | null>(null)

  const goStep = (next: number, patch?: Record<string, string>) => {
    const params = new URLSearchParams(searchParams)
    params.set('step', stepSlug(next))
    if (patch) {
      for (const [k, v] of Object.entries(patch)) {
        if (v) params.set(k, v)
        else params.delete(k)
      }
    }
    setSearchParams(params, { replace: next < step })
  }

  const setMode = (next: RegisterMode) => {
    goStep(1, { mode: next })
  }

  useEffect(() => {
    if (step === 1 && !searchParams.get('mode')) {
      const params = new URLSearchParams(searchParams)
      params.set('mode', 'single')
      setSearchParams(params, { replace: true })
    }
  }, [searchParams, setSearchParams, step])

  const saveSingle = useMutation({
    mutationFn: (payload: typeof form) =>
      qre<Row>('/inventory/assets', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (row) => {
      const id = String(row.asset_id || '')
      setCreatedId(id || 'created')
      goStep(3)
    },
  })

  const saveBulk = useMutation({
    mutationFn: () =>
      qre<Row>('/inventory/imports', {
        method: 'POST',
        body: JSON.stringify({ provider_id: form.provider_id, csv_text: csv }),
      }),
    onSuccess: (body) => {
      setImportResult(body)
      goStep(3)
    },
  })

  const stepCrumb = WORKFLOW[Math.min(step, WORKFLOW.length - 1)]?.label ?? 'Register'
  const crumbs = useMemo((): Crumb[] => {
    const base: Crumb[] = [
      { label: 'Resources', to: '/qrp/inventory' },
      { label: 'Inventory', to: '/qrp/inventory' },
      { label: 'Register asset', to: '/qrp/inventory/register' },
    ]
    if (step > 0 && step < WORKFLOW.length) {
      base.push({ label: stepCrumb })
    }
    return base
  }, [step, stepCrumb])

  const validateDetails = () => {
    setFieldErrors({})
    if (mode === 'single') {
      const parsed = parseForm(assetRegisterSchema, form)
      if (!parsed.ok) {
        setFieldErrors(parsed.fieldErrors)
        return false
      }
    } else {
      const parsed = parseForm(assetImportSchema, { provider_id: form.provider_id, csv })
      if (!parsed.ok) {
        setFieldErrors(parsed.fieldErrors)
        return false
      }
    }
    return true
  }

  const commit = () => {
    if (mode === 'single') saveSingle.mutate(form)
    else saveBulk.mutate()
  }

  const importErrors = Array.isArray(importResult?.errors) ? (importResult.errors as Row[]) : []
  const pending = saveSingle.isPending || saveBulk.isPending
  const apiError = saveSingle.error || saveBulk.error

  return (
    <Page
      crumbs={crumbs}
      title="Register asset"
      description={
        mode === 'bulk'
          ? 'Bulk CSV import with validate-then-commit semantics.'
          : 'One asset, one provider, one native id — then lifecycle under the asset record.'
      }
      steps={WORKFLOW}
      stepIndex={step}
      workflowGuide={step < 3}
      actions={
        step === 0 ? (
          <Link to="/qrp/inventory" className="fs-link text-sm">
            Catalogue
          </Link>
        ) : step < 3 ? (
          <button type="button" className="btn-ghost text-sm" onClick={() => goStep(Math.max(0, step - 1))}>
            Back
          </button>
        ) : (
          <Link to="/qrp/inventory" className="btn-primary text-sm">
            Back to catalogue
          </Link>
        )
      }
    >
      {step === 0 ? (
        <Card>
          <p className="text-sm text-muted-foreground">
            Pick how this registration enters the catalogue. You can switch method until you reach review.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              className="craft-card rounded-xl border border-border bg-card p-5 text-start transition hover:border-primary/40 hover:shadow-md"
              onClick={() => setMode('single')}
            >
              <p className="font-semibold text-foreground">Single asset</p>
              <p className="mt-1.5 text-sm text-muted-foreground">Provider id, native id, class, and execution mode.</p>
            </button>
            <button
              type="button"
              className="craft-card rounded-xl border border-border bg-card p-5 text-start transition hover:border-primary/40 hover:shadow-md"
              onClick={() => setMode('bulk')}
            >
              <p className="font-semibold text-foreground">Bulk CSV import</p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Header <span className="font-mono text-xs">native_asset_id, asset_class, execution_class</span> — bad rows block commit.
              </p>
            </button>
          </div>
        </Card>
      ) : null}

      {step === 1 ? (
        <Card>
          <form
            className="grid gap-3 sm:grid-cols-2"
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              if (validateDetails()) goStep(2)
            }}
          >
            <FormField className="sm:col-span-2" label="Provider id" htmlFor="reg-provider" error={fieldErrors.provider_id}>
              {providers.length > 0 ? (
                <select
                  id="reg-provider"
                  className={cn(fieldClass, fieldErrorClass(Boolean(fieldErrors.provider_id)))}
                  value={form.provider_id}
                  onChange={(e) => setForm({ ...form, provider_id: e.target.value })}
                >
                  <option value="">Select provider…</option>
                  {providers.map((p) => (
                    <option key={String(p.provider_id)} value={String(p.provider_id)}>
                      {String(p.provider_name || p.provider_id)}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="reg-provider"
                  className={cn(fieldClass, fieldErrorClass(Boolean(fieldErrors.provider_id)))}
                  value={form.provider_id}
                  onChange={(e) => setForm({ ...form, provider_id: e.target.value })}
                  placeholder="Provider uuid from catalogue"
                />
              )}
            </FormField>

            {mode === 'single' ? (
              <>
                <FormField label="Native asset id" htmlFor="reg-native" error={fieldErrors.native_asset_id}>
                  <input
                    id="reg-native"
                    className={cn(fieldClass, fieldErrorClass(Boolean(fieldErrors.native_asset_id)))}
                    value={form.native_asset_id}
                    onChange={(e) => setForm({ ...form, native_asset_id: e.target.value })}
                  />
                </FormField>
                <FormField label="Asset class" htmlFor="reg-class" error={fieldErrors.asset_class}>
                  <input
                    id="reg-class"
                    className={cn(fieldClass, fieldErrorClass(Boolean(fieldErrors.asset_class)))}
                    value={form.asset_class}
                    placeholder="QPU"
                    onChange={(e) => setForm({ ...form, asset_class: e.target.value })}
                  />
                </FormField>
                <FormField label="Execution" htmlFor="reg-exec">
                  <select
                    id="reg-exec"
                    className={fieldClass}
                    value={form.execution_class}
                    onChange={(e) => setForm({ ...form, execution_class: e.target.value })}
                  >
                    <option value="simulated">simulated</option>
                    <option value="hardware">hardware</option>
                  </select>
                </FormField>
              </>
            ) : (
              <FormField className="sm:col-span-2" label="CSV" htmlFor="reg-csv" error={fieldErrors.csv}>
                <textarea
                  id="reg-csv"
                  rows={8}
                  className={cn(fieldClass, 'font-mono text-xs', fieldErrorClass(Boolean(fieldErrors.csv)))}
                  value={csv}
                  onChange={(e) => setCsv(e.target.value)}
                />
              </FormField>
            )}

            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button type="button" className="btn-ghost" onClick={() => goStep(0)}>
                Change method
              </button>
              <button type="submit" className={buttonClass}>
                Continue to review
              </button>
            </div>
          </form>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Method</dt>
              <dd className="font-medium">{mode === 'bulk' ? 'Bulk CSV import' : 'Single asset'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Provider</dt>
              <dd className="font-mono text-foreground">{form.provider_id || '—'}</dd>
            </div>
            {mode === 'single' ? (
              <>
                <div>
                  <dt className="text-muted-foreground">Native asset id</dt>
                  <dd className="font-mono">{form.native_asset_id || '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Class / execution</dt>
                  <dd>
                    {form.asset_class || '—'} · {form.execution_class}
                  </dd>
                </div>
              </>
            ) : (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">CSV preview</dt>
                <dd className="mt-1 max-h-40 overflow-auto rounded-md border border-border bg-muted/20 p-2 font-mono text-xs">
                  {csv.trim() || '—'}
                </dd>
              </div>
            )}
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" onClick={() => goStep(1)}>
              Edit details
            </button>
            <button type="button" className={buttonClass} disabled={pending} onClick={commit}>
              {pending ? 'Committing…' : mode === 'bulk' ? 'Commit import' : 'Register asset'}
            </button>
          </div>
          {apiError ? <p className="mt-2 text-sm text-critical">{message(apiError)}</p> : null}
        </Card>
      ) : null}

      {step === 3 ? (
        <Card>
          {mode === 'single' ? (
            <>
              <Notice tone="warning">
                <p className="font-semibold text-foreground">Asset registered</p>
                <p className="mt-1">
                  Catalogue id <span className="font-mono">{createdId ?? '—'}</span>. Lifecycle moves start on the asset record.
                </p>
              </Notice>
              <div className="mt-4 flex flex-wrap gap-2">
                {createdId && createdId !== 'created' ? (
                  <Link className="btn-primary" to={`/qrp/inventory/${encodeURIComponent(createdId)}`}>
                    Open asset
                  </Link>
                ) : null}
                <Link className="btn-ghost" to="/qrp/inventory">
                  Catalogue
                </Link>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setCreatedId(null)
                    setForm({ provider_id: '', native_asset_id: '', asset_class: '', execution_class: 'simulated' })
                    navigate('/qrp/inventory/register?step=method&mode=single', { replace: true })
                  }}
                >
                  Register another
                </button>
              </div>
            </>
          ) : (
            <>
              <Notice tone={importResult?.committed ? 'warning' : 'critical'}>
                <p className="font-semibold text-foreground">
                  {importResult?.committed ? 'Import committed' : 'Import not committed'}
                </p>
                <p className="mt-1">
                  {importResult?.committed
                    ? `Created ${String(importResult.created ?? '—')} assets.`
                    : 'No rows were committed. Fix CSV issues and try again.'}
                </p>
              </Notice>
              {importErrors.length > 0 ? (
                <ul className="mt-3 text-sm text-critical">
                  {importErrors.map((err, i) => (
                    <li key={i}>
                      Row {String(err.row ?? '—')}: {String(err.detail)}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <Link className="btn-primary" to="/qrp/inventory">
                  Catalogue
                </Link>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setImportResult(null)
                    navigate('/qrp/inventory/register?step=method&mode=bulk', { replace: true })
                  }}
                >
                  Import again
                </button>
              </div>
            </>
          )}
        </Card>
      ) : null}
    </Page>
  )
}