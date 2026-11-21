import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router'

import { asList, qre } from '@/api/qre'
import { ReservationCalendar } from '@/components/data/ReservationCalendar'
import { Card, Page, PanelHeader, RelatedNav } from '@/components/layout/Page'
import { FormField, fieldErrorClass } from '@/components/forms/FormField'
import { cn } from '@/lib/utils'
import { scopedReservationsPath } from '@/lib/projectScope'
import { parseForm } from '@/lib/validation/parseForm'
import { reservationHoldSchema } from '@/lib/validation/schemas'
import { buttonClass, fieldClass } from '@/pages/workspace/shared/form-classes'
import { defaultLocalWindow } from '@/pages/workspace/scheduling/scheduling-utils'
import { message, QueryBody } from '@/pages/workspace/shared/helpers'
import { opsPageGuidance } from '@/lib/opsPageGuidance'

type Row = Record<string, unknown>

export function SchedulingPage() {
  const client = useQueryClient()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const query = useQuery({
    queryKey: ['reservations'],
    queryFn: () => qre<unknown>('/reservations'),
  })
  const assets = useQuery({
    queryKey: ['assets-scheduling'],
    queryFn: async () => asList(await qre<unknown>('/inventory/assets')),
    retry: false,
  })
  const projects = useQuery({
    queryKey: ['projects-scheduling'],
    queryFn: async () => asList(await qre<unknown>('/projects')),
    retry: false,
  })
  const [form, setForm] = useState({ resource_ref: '', project_id: '', purpose: '', ...defaultLocalWindow() })
  const [formError, setFormError] = useState('')
  const [formFields, setFormFields] = useState<Record<string, string>>({})
  const prefillFromDay = (dateStr: string) => {
    const start = `${dateStr}T10:00`
    const end = `${dateStr}T12:00`
    setForm((prev) => ({ ...prev, window_start: start, window_end: end }))
  }
  useEffect(() => {
    const pid = searchParams.get('project_id')?.trim()
    const date = searchParams.get('date')?.trim()
    if (pid) setForm((prev) => ({ ...prev, project_id: pid }))
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) prefillFromDay(date)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prefill only when URL query changes
  }, [searchParams])
  const create = useMutation({
    mutationFn: (payload: {
      resource_ref: string
      project_id?: string
      window_start: string
      window_end: string
      purpose: string
    }) =>
      qre<Row>('/reservations', {
        method: 'POST',
        body: JSON.stringify({
          resource_ref: payload.resource_ref,
          project_id: payload.project_id?.trim() || null,
          window_start: new Date(payload.window_start).toISOString(),
          window_end: new Date(payload.window_end).toISOString(),
          purpose: payload.purpose,
        }),
      }),
    onSuccess: () => {
      setFormError('')
      const pid = form.project_id || searchParams.get('project_id') || ''
      setForm({ resource_ref: '', project_id: '', purpose: '', ...defaultLocalWindow() })
      void client.invalidateQueries({ queryKey: ['reservations'] })
      navigate(scopedReservationsPath(pid))
    },
  })
  const holds = asList(query.data)
  return (
    <Page
      crumbs={[
        { label: 'Governance', to: '/qrp/approvals' },
        { label: 'Holds', to: '/qrp/reservations' },
        { label: 'Request window' },
      ]}
      title="Request reservation window"
      {...opsPageGuidance.scheduling}
    >
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <PanelHeader title="New hold" />
          <form
            className="grid gap-3 sm:grid-cols-2"
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              setFormError('')
              setFormFields({})
              const parsed = parseForm(reservationHoldSchema, form)
              if (!parsed.ok) {
                setFormFields(parsed.fieldErrors)
                if (parsed.formError) setFormError(parsed.formError)
                return
              }
              create.mutate(parsed.data, {
                onError: (err) => setFormError(message(err)),
              })
            }}
          >
            <FormField className="sm:col-span-2" label="Resource" htmlFor="hold-resource" error={formFields.resource_ref}>
              <input
                id="hold-resource"
                list="sched-assets"
                className={cn(fieldClass, fieldErrorClass(Boolean(formFields.resource_ref)))}
                value={form.resource_ref}
                placeholder="Asset or backend ref"
                onChange={(e) => setForm({ ...form, resource_ref: e.target.value })}
              />
              <datalist id="sched-assets">
                {assets.data?.map((a) => (
                  <option key={String(a.asset_id)} value={String(a.native_asset_id || a.asset_id)}>
                    {String(a.execution_class || '')} · {String(a.provider_id || '')}
                  </option>
                ))}
              </datalist>
            </FormField>
            <FormField className="sm:col-span-2" label="Project" htmlFor="hold-project" hint="Optional · scopes hold to an approved project">
              <select
                id="hold-project"
                className={fieldClass}
                value={form.project_id}
                onChange={(e) => setForm({ ...form, project_id: e.target.value })}
              >
                <option value="">No project</option>
                {projects.data?.map((p) => (
                  <option key={String(p.project_id)} value={String(p.project_id)}>
                    {String(p.name || p.project_id)}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Window start (local)" htmlFor="hold-start" error={formFields.window_start}>
              <input
                id="hold-start"
                type="datetime-local"
                className={cn(fieldClass, fieldErrorClass(Boolean(formFields.window_start)))}
                value={form.window_start}
                onChange={(e) => setForm({ ...form, window_start: e.target.value })}
              />
            </FormField>
            <FormField label="Window end (local)" htmlFor="hold-end" error={formFields.window_end}>
              <input
                id="hold-end"
                type="datetime-local"
                className={cn(fieldClass, fieldErrorClass(Boolean(formFields.window_end)))}
                value={form.window_end}
                onChange={(e) => setForm({ ...form, window_end: e.target.value })}
              />
            </FormField>
            <FormField className="sm:col-span-2" label="Purpose" htmlFor="hold-purpose" error={formFields.purpose}>
              <input
                id="hold-purpose"
                className={cn(fieldClass, fieldErrorClass(Boolean(formFields.purpose)))}
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              />
            </FormField>
            <div className="sm:col-span-2">
              <button type="submit" className={buttonClass} disabled={create.isPending}>
                {create.isPending ? 'Submitting…' : 'Request window'}
              </button>
              {(formError || create.error) && (
                <p className="mt-2 text-sm text-critical">{formError || message(create.error)}</p>
              )}
            </div>
          </form>
        </Card>
        <Card>
          <PanelHeader
            title="Existing holds (calendar)"
            action={<span className="text-xs text-muted-foreground tabular-nums">{holds.length} rows</span>}
          />
          <QueryBody query={query}>
            <ReservationCalendar rows={holds} title="Hold calendar" onDaySelect={(dateStr) => prefillFromDay(dateStr)} />
          </QueryBody>
        </Card>
      </div>
      <RelatedNav
        items={[
          { to: '/qrp/reservations', label: 'Reservation calendar' },
          { to: '/qrp/projects', label: 'Projects' },
          { to: '/qrp/organization', label: 'Organization' },
        ]}
      />
    </Page>
  )
}
