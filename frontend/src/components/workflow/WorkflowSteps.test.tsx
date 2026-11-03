import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { WorkflowSteps } from '@/components/workflow/WorkflowSteps'

describe('WorkflowSteps', () => {
  const steps = [
    { id: 'a', label: 'Submit' },
    { id: 'b', label: 'Review' },
    { id: 'c', label: 'Authorise' },
  ]

  it('marks earlier steps done and the current step by number', () => {
    render(<WorkflowSteps steps={steps} current={1} />)
    expect(screen.getByText('Submit')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.queryByText('1')).not.toBeInTheDocument()
  })
})