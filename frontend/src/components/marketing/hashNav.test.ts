import { describe, expect, it } from 'vitest'

import { parsePublicHashHref } from '@/components/marketing/hashNav'

describe('parsePublicHashHref', () => {
  it('parses root hash links', () => {
    expect(parsePublicHashHref('/#capabilities')).toEqual({ path: '/', hash: '#capabilities' })
  })

  it('parses path-only hash', () => {
    expect(parsePublicHashHref('/#faq')).toEqual({ path: '/', hash: '#faq' })
  })

  it('returns null without hash', () => {
    expect(parsePublicHashHref('/login')).toBeNull()
  })
})