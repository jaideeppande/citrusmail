/** One message of the conversation open in the reader */
interface ThreadEntry {
  summary: MessageSummary
  /** You wrote it: it came from Sent, or from your own address */
  mine: boolean
}

/** How the reader sets a message (the "Aa" menu), kept on this computer */
interface ReaderType {
  width: 'narrow' | 'default' | 'wide'
  leading: 'tight' | 'default' | 'loose'
  face: 'sans' | 'serif'
  sepia: boolean
}

/** A file shown in the attachment gallery or in quick look */
interface AttachmentItem {
  message: MessageSummary
  file: Attachment
  url: string
}

/** What a calendar file attached to a message invites you to */
interface InviteDetails {
  title: string
  start: Date
  end: Date
  allDay: boolean
  location?: string
  organiser?: string
  description?: string
}

/** What "Add to calendar" starts its form from */
interface MailEventSeed {
  title: string
  description?: string
  start?: Date
  end?: Date
  allDay?: boolean
}
