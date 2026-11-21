import { describe, expect, it, vi } from 'vitest'

import { followPublicHashLink, parsePublicHashHref } from '@/components/marketing/hashNav'

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

describe('followPublicHashLink', () => {
  it('navigates with combined path+hash string from auth routes', () => {
    const navigate = vi.fn()
    const preventDefault = vi.fn()
    followPublicHashLink(navigate, '/login', '/#capabilities', {
      preventDefault,
    } as unknown as import('react').MouseEvent<HTMLAnchorElement>)
    expect(preventDefault).toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith({ pathname: '/', hash: 'capabilities' })
  })
})