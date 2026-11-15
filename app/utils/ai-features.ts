// Every AI feature, what it sends to your AI provider, and whether it runs
// without being asked. Settings → AI lists them with a switch each

export type AiFeatureId
  = | 'summary' | 'reply' | 'translate' | 'ask-mail' | 'tone'
    | 'priority' | 'briefing' | 'ask-thread' | 'tasks' | 'suggest-labels' | 'rules' | 'scam' | 'newsletters'
    | 'draft' | 'proofread' | 'subject' | 'follow-up' | 'meeting-reply' | 'autocomplete'
    | 'quick-event' | 'mail-event' | 'meeting-prep' | 'signature' | 'relationship'
    | 'commands'

export interface AiFeature {
  id: AiFeatureId
  label: string
  group: 'Reading' | 'Writing' | 'Calendar' | 'Contacts' | 'Everywhere'
  /** Runs on its own, on new mail or as you type: counts against the daily limit */
  background: boolean
  /** What goes to the provider, in plain words */
  sends: string
}

export const AI_FEATURES: AiFeature[] = [
  { id: 'priority', label: 'Priority inbox', group: 'Reading', background: true, sends: 'Sender, subject and the start of each new message in your Inbox' },
  { id: 'scam', label: 'Scam and phishing check', group: 'Reading', background: true, sends: 'Sender, subject, links and text of each new message in your Inbox' },
  { id: 'suggest-labels', label: 'Suggested labels', group: 'Reading', background: true, sends: 'Sender, subject and start of new messages, with your label names and a few examples of each' },
  { id: 'briefing', label: 'Daily briefing', group: 'Reading', background: true, sends: 'Senders, subjects and previews of mail since yesterday, and today’s event titles and times' },
  { id: 'newsletters', label: 'Newsletter advisor', group: 'Reading', background: true, sends: 'The names of lists you’re on and how often you open their mail' },
  { id: 'summary', label: 'Summaries', group: 'Reading', background: false, sends: 'The message you ask about' },
  { id: 'ask-thread', label: 'Ask this conversation', group: 'Reading', background: false, sends: 'The messages in the conversation and your question' },
  { id: 'ask-mail', label: 'Ask about your mail', group: 'Reading', background: false, sends: 'Your question, then sender, date, subject and preview of matching messages' },
  { id: 'tasks', label: 'Action items to tasks', group: 'Reading', background: false, sends: 'The message you ask about' },
  { id: 'translate', label: 'Translation', group: 'Reading', background: false, sends: 'The text you translate' },
  { id: 'rules', label: 'Rules in plain English', group: 'Reading', background: false, sends: 'What you type, and your folder names' },
  { id: 'reply', label: 'AI Reply', group: 'Writing', background: false, sends: 'The message you reply to, and your instructions' },
  { id: 'draft', label: 'Draft from a few words', group: 'Writing', background: false, sends: 'What you type, and who it goes to' },
  { id: 'proofread', label: 'Tone and proofreading', group: 'Writing', background: false, sends: 'What you’ve written' },
  { id: 'tone', label: 'Tone rewrite on replies', group: 'Writing', background: false, sends: 'Your reply and the message it answers' },
  { id: 'subject', label: 'Subject suggestions', group: 'Writing', background: false, sends: 'What you’ve written' },
  { id: 'follow-up', label: 'Follow-up writer', group: 'Writing', background: false, sends: 'Your unanswered message' },
  { id: 'meeting-reply', label: 'Meeting replies', group: 'Writing', background: false, sends: 'The message you reply to, and your free times (not your events)' },
  { id: 'autocomplete', label: 'Autocomplete as you type', group: 'Writing', background: true, sends: 'What you’ve written so far, each time you pause' },
  { id: 'quick-event', label: 'Events in plain English', group: 'Calendar', background: false, sends: 'What you type, today’s date and your calendar names' },
  { id: 'mail-event', label: 'Event from an email', group: 'Calendar', background: false, sends: 'The message you make an event from' },
  { id: 'meeting-prep', label: 'Meeting prep', group: 'Calendar', background: false, sends: 'The event, and recent mail with the people in it' },
  { id: 'signature', label: 'Details from signatures', group: 'Contacts', background: true, sends: 'The end of messages from people in your contacts' },
  { id: 'relationship', label: 'Relationship summary', group: 'Contacts', background: false, sends: 'Recent mail between you and that person' },
  { id: 'commands', label: 'Commands in plain English', group: 'Everywhere', background: false, sends: 'What you type, your folder and label names, and the messages it finds' }
]

export const aiFeature = (id: AiFeatureId) => AI_FEATURES.find(item => item.id === id)!
