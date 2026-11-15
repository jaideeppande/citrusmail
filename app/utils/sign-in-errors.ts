// What went wrong signing in, turned from the server's sentence into where it
// belongs on the form and what to do next. The server's own words stay with
// it as the detail, since they name the host and port that failed. The
// sentences matched here come from server/utils/mail-errors.ts,
// server/api/session.post.ts, server/utils/account.ts, rate-limit.ts and the
// Microsoft callback

/** The part of the form an error is about */
export type SignInErrorField = 'email' | 'password' | 'server' | 'form'

export interface SignInAdvice {
  field: SignInErrorField
  /** What to do next, in plain words */
  message: string
  /** The server's own explanation, when it adds something */
  detail?: string
  /** The server settings are where this gets fixed */
  openSettings?: boolean
  /** A page to go to for the fix (an app password) */
  link?: { label: string, to: string }
}

const APOSTROPHE = '[\'’]'

interface Rule {
  test: RegExp
  advise: (match: RegExpMatchArray) => Omit<SignInAdvice, 'detail'>
}

const RULES: Rule[] = [
  {
    // "The password was rejected by imap.gmail.com. Gmail needs an app password: create one at https://…"
    test: /needs an app password: create one at (\S+?)\.?$/,
    advise: match => ({
      field: 'password',
      message: 'This provider needs an app password, not your normal one. Create one, then paste it here.',
      link: { label: 'Create app password', to: match[1]! }
    })
  },
  {
    test: /^The password was rejected/,
    advise: () => ({ field: 'password', message: 'That password didn’t work. Check it, and the address above, and try again.' })
  },
  {
    test: /rejected the password/,
    advise: () => ({ field: 'password', message: 'The calendar or contacts server didn’t accept this password. Check it, or leave those addresses empty in server settings.', openSettings: true })
  },
  {
    test: /signs in with Microsoft|Microsoft no longer accepts passwords/,
    advise: () => ({ field: 'form', message: 'This address signs in with Microsoft, not with a password.' })
  },
  {
    test: /Microsoft sign-in was cancelled/,
    advise: () => ({ field: 'form', message: 'Microsoft sign-in was cancelled. Start again when you’re ready.' })
  },
  {
    test: /^Microsoft said:/,
    advise: () => ({ field: 'form', message: 'Microsoft didn’t sign you in. Try again, or ask whoever runs your mailbox.' })
  },
  {
    test: /Microsoft sign-in has expired/,
    advise: () => ({ field: 'form', message: 'Your Microsoft sign-in has expired. Sign in again to carry on.' })
  },
  {
    test: new RegExp(`We couldn${APOSTROPHE}t find the mail servers for (\\S+)\\.(?:\\s|$)`),
    advise: match => ({ field: 'server', message: `We couldn’t find settings for ${match[1]}. Enter them in server settings.`, openSettings: true })
  },
  {
    test: new RegExp(`Couldn${APOSTROPHE}t find the server (\\S+)\\.(?:\\s|$)`),
    advise: match => ({ field: 'server', message: `There’s no server called ${match[1]}. Check its name in server settings.`, openSettings: true })
  },
  {
    test: new RegExp(`Couldn${APOSTROPHE}t open a secure connection`),
    advise: () => ({ field: 'server', message: 'The secure connection failed. In server settings, try the other security option.', openSettings: true })
  },
  {
    test: new RegExp(`Couldn${APOSTROPHE}t reach (.+?)\\.?$`),
    advise: match => ({ field: 'server', message: `${match[1]} didn’t answer. Check the server and port, or try again in a moment.`, openSettings: true })
  },
  {
    test: /is on a private network/,
    advise: () => ({ field: 'server', message: 'That server is on a private network this app can’t connect to. Use its public address.', openSettings: true })
  },
  {
    test: new RegExp(`didn${APOSTROPHE}t answer like a mail server`),
    advise: () => ({ field: 'server', message: 'Something answered, but not a mail server. Check the server and port in server settings.', openSettings: true })
  },
  {
    test: /^Invalid host|Invalid input|Validation Error/i,
    advise: () => ({ field: 'server', message: 'One of the server settings isn’t valid. Check the server names and ports.', openSettings: true })
  },
  {
    test: /^Only (.+) addresses can sign in here/,
    advise: match => ({ field: 'email', message: `Use your ${match[1]} address. Others can’t sign in here.` })
  },
  {
    test: /^Too many attempts/,
    advise: () => ({ field: 'form', message: 'Too many tries in a row. Wait a minute, then try again.' })
  },
  {
    test: /mailboxes open at once/,
    advise: () => ({ field: 'form', message: 'You have as many mailboxes open as this app allows. Sign out of one, then add this one.' })
  }
]

/** No answer at all: the network or this app's own server */
export const UNREACHABLE_ADVICE: SignInAdvice = {
  field: 'form',
  message: 'Couldn’t connect. Check your internet connection and try again.'
}

/**
 * Where `message` (the server's error text) belongs and what to say. A
 * message no rule knows is shown as it is, on the form as a whole
 */
export function signInAdvice(message: string): SignInAdvice {
  const text = message.trim()
  for (const rule of RULES) {
    const match = text.match(rule.test)
    if (match) return { ...rule.advise(match), detail: text }
  }
  return { field: 'form', message: text }
}
