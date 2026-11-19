/** What a message asks of its reader, as the priority inbox sorts it */
type AiPriorityKind = 'reply' | 'act' | 'fyi' | 'newsletter' | 'notification' | 'urgent'

/** The priority inbox's verdict on one message, kept on this computer */
interface AiPriorityResult {
  kind: AiPriorityKind
  /** One line on why, in the reader's language */
  reason: string
  /** The reader set it themselves: never asked again, and taught to the next prompts */
  corrected?: boolean
  at: number
}

/** A correction the reader made, shown to the model as an example of their taste */
interface AiPriorityCorrection {
  from: string
  subject: string
  kind: AiPriorityKind
  at: number
}

type AiScamVerdict = 'safe' | 'suspicious' | 'dangerous'

/** The scam check's verdict on one message */
interface AiScamResult {
  verdict: AiScamVerdict
  /** Up to three short reasons, in plain words */
  reasons: string[]
  /** The reader said it looks safe: no warning from then on */
  dismissed?: boolean
  at: number
}

/** A label the AI thinks fits a message */
interface AiLabelSuggestion {
  id: string
  confidence: number
}

/** A to-do found in a message, as the review dialog edits it */
interface AiFoundTask {
  text: string
  /** YYYY-MM-DD */
  due?: string
  /** Who it's for, when it isn't the reader */
  who?: string
  /** Which of the messages it came from (index into the list asked about) */
  source: number
}

/** A mailing list the newsletter advisor suggests leaving */
interface AiNewsletterAdvice {
  address: string
  reason: string
}
