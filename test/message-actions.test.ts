import { describe, expect, it } from 'vitest'
import { detectActions, detectCode, detectDates, detectPhones, detectTracking } from '../app/utils/message-actions'

// A Saturday
const now = new Date(2026, 10, 14, 9, 0)

describe('verification codes', () => {
  it('reads the digits next to the word for them', () => {
    expect(detectCode('Your verification code is 482913. It expires in 10 minutes.')?.code).toBe('482913')
    expect(detectCode('OTP: 4821')?.code).toBe('4821')
    expect(detectCode('Use code 123-456 to sign in')?.code).toBe('123456')
    expect(detectCode('731204 is your Acme security code')?.code).toBe('731204')
  })

  it('leaves other numbers alone', () => {
    expect(detectCode('Invoice 482913 is due on Friday')).toBeUndefined()
    expect(detectCode('Your order 12345678 has shipped')).toBeUndefined()
    expect(detectCode('The code review is at 1500 Main Street')).toBeUndefined()
  })

  it('labels the chip with the code', () => {
    expect(detectCode('Your code: 9911')?.label).toBe('Copy code 9911')
  })
})

describe('tracking numbers', () => {
  it('knows a UPS number by its shape', () => {
    const [ups] = detectTracking('Your parcel 1Z999AA10123456784 is on its way')
    expect(ups).toMatchObject({ carrier: 'UPS', number: '1Z999AA10123456784', url: 'https://www.ups.com/track?tracknum=1Z999AA10123456784' })
    expect(detectTracking('tracking: 1Z 999 AA1 01 2345 6784')[0]?.number).toBe('1Z999AA10123456784')
  })

  it('knows USPS numbers, spaced or not', () => {
    expect(detectTracking('USPS 9400 1000 0000 0000 0000 00')[0]).toMatchObject({ carrier: 'USPS', number: '9400100000000000000000' })
    expect(detectTracking('Label EC123456789US')[0]?.carrier).toBe('USPS')
  })

  it('only takes plain digits for FedEx or DHL when the message names them', () => {
    expect(detectTracking('FedEx tracking number 7712 3456 7890')[0]).toMatchObject({ carrier: 'FedEx', number: '771234567890' })
    expect(detectTracking('Your DHL shipment 1234567890 is out for delivery')[0]?.carrier).toBe('DHL')
    expect(detectTracking('Reference 771234567890 and 1234567890')).toEqual([])
  })
})

describe('phone numbers', () => {
  it('finds international and grouped numbers', () => {
    expect(detectPhones('Call me on +44 20 7946 0958 tomorrow')[0]?.number).toBe('+44 20 7946 0958')
    expect(detectPhones('Office: (555) 123-4567')[0]?.number).toBe('(555) 123-4567')
    expect(detectPhones('Tel: 0612345678')[0]?.number).toBe('0612345678')
  })

  it('does not take dates, amounts or bare numbers for one', () => {
    expect(detectPhones('Due 2026-11-20, total 12345678')).toEqual([])
    expect(detectPhones('Order 20261120-4471')).toEqual([])
  })
})

describe('dates', () => {
  it('reads a day and month, with the year when it is said', () => {
    const [date] = detectDates('The review is on 20 November 2026.', now)
    expect(date?.start).toEqual(new Date(2026, 10, 20))
    expect(date?.allDay).toBe(true)
    expect(date?.end).toEqual(new Date(2026, 10, 21))
    expect(detectDates('Dinner on December 3rd', now)[0]?.start).toEqual(new Date(2026, 11, 3))
    expect(detectDates('Deadline 2026-12-01', now)[0]?.start).toEqual(new Date(2026, 11, 1))
  })

  it('takes a day already behind us for next year, and skips a past date with its year', () => {
    expect(detectDates('See you on March 5', now)[0]?.start).toEqual(new Date(2027, 2, 5))
    expect(detectDates('We met on 3 March 2024', now)).toEqual([])
  })

  it('reads the time next to the day', () => {
    const [meeting] = detectDates('Can we meet Friday at 3pm?', now)
    expect(meeting?.start).toEqual(new Date(2026, 10, 20, 15, 0))
    expect(meeting?.end).toEqual(new Date(2026, 10, 20, 16, 0))
    expect(meeting?.allDay).toBe(false)
    expect(detectDates('Call at 14:30 on 20 November', now)[0]?.start).toEqual(new Date(2026, 10, 20, 14, 30))
    const [range] = detectDates('Workshop tomorrow 10-11:30am', now)
    expect(range?.start).toEqual(new Date(2026, 10, 15, 10, 0))
    expect(range?.end).toEqual(new Date(2026, 10, 15, 11, 30))
  })

  it('reads relative days from today', () => {
    expect(detectDates('Lunch tomorrow?', now)[0]?.start).toEqual(new Date(2026, 10, 15))
    expect(detectDates('Next Saturday works', now)[0]?.start).toEqual(new Date(2026, 10, 21))
    expect(detectDates('Monday is fine', now)[0]?.start).toEqual(new Date(2026, 10, 16))
  })

  it('does not read the verb "may" as a month, or one date twice', () => {
    expect(detectDates('You may 5 times retry', now)).toEqual([])
    expect(detectDates('Friday 20 November at 15:00', now)).toHaveLength(1)
    expect(detectDates('Friday 20 November at 15:00', now)[0]?.start).toEqual(new Date(2026, 10, 20, 15, 0))
  })

  it('labels the chip with the day', () => {
    expect(detectDates('Can we meet Friday at 3pm?', now)[0]?.label).toBe('Add to calendar · Fri 20 Nov, 15:00')
  })
})

describe('the chips under a message', () => {
  it('puts a code first and never offers more than four', () => {
    const text = 'Your code is 554433. Parcel 1Z999AA10123456784 arrives Friday at 3pm or Monday, or 2 December, or 5 December. Call +1 415 555 0100.'
    const actions = detectActions(text, now)
    expect(actions).toHaveLength(4)
    expect(actions.map(action => action.kind)).toEqual(['code', 'tracking', 'date', 'date'])
  })

  it('does not offer a parcel number as a phone number', () => {
    const kinds = detectActions('USPS 9400 1000 0000 0000 0000 00', now).map(action => action.kind)
    expect(kinds).toEqual(['tracking'])
  })

  it('finds nothing in plain prose and never offers links', () => {
    expect(detectActions('Thanks for the update, talk soon. https://example.com/confirm?token=1', now)).toEqual([])
  })
})
