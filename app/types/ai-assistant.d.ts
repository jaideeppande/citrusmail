/** What the assistant panel's questions are about */
type AssistantContext
  = | { kind: 'mail' }
    | {
      kind: 'thread'
      /** The open message's key, so the same conversation finds its chat again */
      key: string
      subject: string
      /** The conversation's messages, oldest first */
      messages: MessageSummary[]
    }

/** One line of the assistant's chat */
interface AssistantTurn {
  id: string
  role: 'user' | 'assistant'
  /** Asked a question, or asked to do something to mail */
  mode: 'ask' | 'do'
  text: string
  state: 'writing' | 'done' | 'error'
  /** Messages an answer found ("Your mail"), or a command's plan matched */
  found?: MessageSummary[]
  /** "From Ada, since March": how a question about your mail was read */
  interpreted?: string
}

/** A chat about one context, kept in memory until the app closes */
interface AssistantChat {
  key: string
  context: AssistantContext
  turns: AssistantTurn[]
  /** The conversation as the model reads it, built for the first question */
  prompt?: string
}
