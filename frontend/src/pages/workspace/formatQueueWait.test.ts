import { describe, expect, it } from 'vitest'

import { formatQueueWait } from '@/pages/workspace/continue'

describe('formatQueueWait', () => {
  it('labels missing wait as Unavailable, never zero', () => {
    expect(formatQueueWait({})).toBe('Unavailable')
    expect(formatQueueWait({ estimated_wait_time: null })).toBe('Unavailable')
    expect(formatQueueWait({ estimated_wait_time: '' })).toBe('Unavailable')
  })

  it('formats finite seconds with est. suffix', () => {
    expect(formatQueueWait({ estimated_wait_time: 45 })).toBe('45 s (est.)')
    expect(formatQueueWait({ estimated_wait_time: 120 })).toBe('2 min (est.)')
  })
})
