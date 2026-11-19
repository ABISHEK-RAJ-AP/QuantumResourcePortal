import { describe, expect, it } from 'vitest'

import { safeReturnPath } from '@/lib/safeReturnPath'

describe('safeReturnPath', () => {
  it('allows in-app paths', () => {
    expect(safeReturnPath('/qrp/approvals')).toBe('/qrp/approvals')
    expect(safeReturnPath('/qrp?filter=mine')).toBe('/qrp?filter=mine')
  })

  it('blocks protocol-relative and external', () => {
    expect(safeReturnPath('//evil.com')).toBe('/qrp')
    expect(safeReturnPath('https://evil.com')).toBe('/qrp')
    expect(safeReturnPath('/\\evil')).toBe('/qrp')
    expect(safeReturnPath('/javascript:alert(1)')).toBe('/qrp')
  })

  it('falls back when empty', () => {
    expect(safeReturnPath('')).toBe('/qrp')
    expect(safeReturnPath(undefined)).toBe('/qrp')
  })
})