import { describe, expect, it } from 'vitest'
import { signInAdvice } from '../app/utils/sign-in-errors'
import { ILLUSTRATION_PARTS, ILLUSTRATIONS } from '../app/utils/illustrations'

describe('sign-in errors', () => {
  it('puts a rejected password on the password field', () => {
    const advice = signInAdvice('The password was rejected by imap.example.com. Check the email address and password.')
    expect(advice.field).toBe('password')
    expect(advice.detail).toContain('imap.example.com')
  })

  it('links to the app password page when the provider needs one', () => {
    const advice = signInAdvice('The password was rejected by imap.gmail.com. Gmail needs an app password: create one at https://myaccount.google.com/apppasswords')
    expect(advice.field).toBe('password')
    expect(advice.link?.to).toBe('https://myaccount.google.com/apppasswords')
  })

  it('sends server trouble to the server settings', () => {
    expect(signInAdvice('Couldn\'t find the server imap.exmaple.com. Check the server name.')).toMatchObject({ field: 'server', openSettings: true })
    expect(signInAdvice('Couldn\'t find the server imap.exmaple.com. Check the server name.').message).toContain('imap.exmaple.com')
    expect(signInAdvice('Couldn\'t reach mail.example.com on port 993.').message).toBe('mail.example.com on port 993 didn’t answer. Check the server and port, or try again in a moment.')
    expect(signInAdvice('Couldn\'t open a secure connection to mail.example.com on port 143. Try the other security option (SSL/TLS or STARTTLS).').field).toBe('server')
    expect(signInAdvice('mail.example.com on port 25 didn\'t answer like a mail server. Check the server and port.').field).toBe('server')
  })

  it('asks for settings when discovery found nothing', () => {
    const advice = signInAdvice('We couldn\'t find the mail servers for example.org. Open Advanced and enter them.')
    expect(advice).toMatchObject({ field: 'server', message: 'We couldn’t find settings for example.org. Enter them in server settings.' })
  })

  it('keeps address rules on the address field', () => {
    expect(signInAdvice('Only @acme.com addresses can sign in here.')).toMatchObject({ field: 'email', message: 'Use your @acme.com address. Others can’t sign in here.' })
  })

  it('says to wait after too many tries', () => {
    expect(signInAdvice('Too many attempts. Please wait a minute and try again.').field).toBe('form')
  })

  it('shows anything else as it is', () => {
    expect(signInAdvice('mail.example.com said: NO [ALERT] Mailbox locked')).toEqual({ field: 'form', message: 'mail.example.com said: NO [ALERT] Mailbox locked' })
  })
})

describe('illustrations', () => {
  it('draws every name, each with one accent and one motion at most', () => {
    for (const name of ILLUSTRATIONS) {
      const parts = ILLUSTRATION_PARTS[name]
      expect(parts.length, name).toBeGreaterThan(1)
      expect(parts.filter(part => part.motion).length, name).toBeLessThanOrEqual(1)
      expect(parts.flatMap(part => part.shapes).some(shape => shape.tone.startsWith('accent') || shape.tone === 'dot'), name).toBe(true)
    }
  })

  it('stays small', () => {
    expect(JSON.stringify(ILLUSTRATION_PARTS).length).toBeLessThan(12_000)
  })
})
