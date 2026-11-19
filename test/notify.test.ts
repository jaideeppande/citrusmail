import { describe, expect, it } from 'vitest'
import { dndActive, dndMorning, isVip, shouldNotify } from '../app/utils/notifications'

const open = { enabled: true, quiet: false, dnd: false, vips: [] as string[] }

describe('who may ring', () => {
  it('lets everything through when nothing is holding it back', () => {
    expect(shouldNotify('anyone@x.test', open)).toBe(true)
  })

  it('lets nothing through with notifications off, VIP or not', () => {
    expect(shouldNotify('boss@x.test', { ...open, enabled: false, vips: ['boss@x.test'] })).toBe(false)
  })

  it('holds mail back in quiet hours and in do not disturb', () => {
    expect(shouldNotify('anyone@x.test', { ...open, quiet: true })).toBe(false)
    expect(shouldNotify('anyone@x.test', { ...open, dnd: true })).toBe(false)
  })

  it('lets a VIP through both', () => {
    const vips = ['boss@x.test', '@family.test']
    expect(shouldNotify('Boss@X.test', { ...open, quiet: true, vips })).toBe(true)
    expect(shouldNotify('mum@family.test', { ...open, dnd: true, vips })).toBe(true)
    expect(shouldNotify('other@x.test', { ...open, quiet: true, dnd: true, vips })).toBe(false)
  })

  it('matches an address exactly and a domain with its subdomains', () => {
    expect(isVip('ann@x.test', ['ann@x.test'])).toBe(true)
    expect(isVip('joann@x.test', ['ann@x.test'])).toBe(false)
    expect(isVip('ann@x.test', ['@x.test'])).toBe(true)
    expect(isVip('ann@mail.x.test', ['x.test'])).toBe(true)
    expect(isVip('ann@notx.test', ['x.test'])).toBe(false)
    expect(isVip('ann@x.test', ['', '  '])).toBe(false)
  })

  it('knows when do not disturb is on', () => {
    expect(dndActive(0, 1000)).toBe(false)
    expect(dndActive(-1, 1000)).toBe(true)
    expect(dndActive(2000, 1000)).toBe(true)
    expect(dndActive(500, 1000)).toBe(false)
  })

  it('ends “until tomorrow morning” at 8:00, today in the small hours', () => {
    expect(new Date(dndMorning(new Date(2026, 10, 14, 22, 30)))).toEqual(new Date(2026, 10, 15, 8, 0))
    expect(new Date(dndMorning(new Date(2026, 10, 14, 2, 0)))).toEqual(new Date(2026, 10, 14, 8, 0))
  })
})
