import { beforeEach, describe, expect, it } from 'vitest'

import {
  dismissGovernNotice,
  getActiveGovernNotices,
  upsertGovernNotice,
} from '@/lib/governNotices'

describe('governNotices', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('upserts and lists active notices', () => {
    upsertGovernNotice({
      id: 'test:1',
      title: 'Hello',
      body: 'World',
      source: 'test',
    })
    const active = getActiveGovernNotices()
    expect(active).toHaveLength(1)
    expect(active[0]?.title).toBe('Hello')
  })

  it('dismisses by id', () => {
    upsertGovernNotice({ id: 'test:2', title: 'x', body: 'y', source: 'test' })
    dismissGovernNotice('test:2')
    expect(getActiveGovernNotices()).toHaveLength(0)
  })
})