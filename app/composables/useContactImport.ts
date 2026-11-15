export type ImportStep = 'pick' | 'map' | 'review' | 'running' | 'done'

export interface ImportFailure {
  name: string
  reason: string
}

export interface ImportSummary {
  added: number
  skipped: number
  failed: ImportFailure[]
  /** It was stopped before the end */
  cancelled: boolean
}

// More than any address book is likely to hold, and few enough to keep the
// review step and the server comfortable
const MAX_CONTACTS = 5000
const MAX_BYTES = 10 * 1024 * 1024

/**
 * The import dialog, step by step: read a file, file its columns (CSV only,
 * when they were not recognised), look over what will be added, add it one
 * contact at a time through the same path as the editor, and say how it went
 */
export function useContactImport() {
  const { contacts, books, save } = useContacts()

  const step = ref<ImportStep>('pick')
  const fileName = ref('')
  const readError = ref('')
  const sheet = shallowRef<CsvSheet>()
  const mapping = ref<CsvField[]>([])
  const drafts = shallowRef<ContactDraft[]>([])
  const duplicates = ref<'skip' | 'import'>('skip')
  const bookId = ref('')
  const progress = ref({ done: 0, total: 0 })
  const summary = ref<ImportSummary>()
  let cancelled = false

  const rows = computed(() => prepareImport(drafts.value, contacts.value))
  const invalid = computed(() => rows.value.filter(row => row.problems.length))
  const duplicateRows = computed(() => rows.value.filter(row => !row.problems.length && row.duplicate))
  const toAdd = computed(() => rows.value.filter(row => !row.problems.length && (duplicates.value === 'import' || !row.duplicate)))

  function reset() {
    step.value = 'pick'
    fileName.value = ''
    readError.value = ''
    sheet.value = undefined
    mapping.value = []
    drafts.value = []
    duplicates.value = 'skip'
    bookId.value = books.value[0]?.id ?? ''
    progress.value = { done: 0, total: 0 }
    summary.value = undefined
    cancelled = false
  }

  async function read(file: File) {
    readError.value = ''
    fileName.value = file.name
    if (file.size > MAX_BYTES) {
      readError.value = 'That file is larger than 10 MB, which is more than an address book export should be.'
      announce(readError.value, true)
      return
    }

    let text: string
    try {
      text = await file.text()
    } catch {
      readError.value = 'That file couldn’t be read.'
      announce(readError.value, true)
      return
    }

    const vcard = /\.vcf$|\.vcard$/i.test(file.name) || /^\uFEFF?\s*BEGIN:VCARD/i.test(text)
    if (vcard) {
      const found = parseVCards(text)
      if (!found.length) {
        readError.value = 'No contacts were found in that file.'
        announce(readError.value, true)
        return
      }
      useDrafts(found)
      return
    }

    const parsed = readCsv(text)
    if (!parsed.rows.length) {
      readError.value = 'No contacts were found in that file. Choose a .vcf or .csv file.'
      announce(readError.value, true)
      return
    }
    sheet.value = parsed
    mapping.value = [...parsed.mapping]
    if (parsed.recognised) useDrafts(csvToContacts(parsed.rows, parsed.mapping))
    else step.value = 'map'
  }

  function useDrafts(found: ContactDraft[]) {
    if (found.length > MAX_CONTACTS) {
      readError.value = `That file holds ${found.length} contacts. Up to ${MAX_CONTACTS} can be imported at once.`
      announce(readError.value, true)
      step.value = 'pick'
      return
    }
    drafts.value = found
    bookId.value ||= books.value[0]?.id ?? ''
    step.value = 'review'
  }

  /** A CSV's columns as filed in the mapping step */
  const mappedPreview = computed(() => sheet.value ? csvToContacts(sheet.value.rows.slice(0, 5), mapping.value) : [])
  const mappingReady = computed(() => mapping.value.some(field => ['name', 'first', 'last', 'email'].includes(field)))

  function applyMapping() {
    if (sheet.value && mappingReady.value) useDrafts(csvToContacts(sheet.value.rows, mapping.value))
  }

  // One at a time: a CardDAV server asked for five hundred at once tends to
  // refuse some, and the progress bar would mean nothing
  async function run() {
    const queue = toAdd.value
    const failed: ImportFailure[] = invalid.value.map(row => ({ name: row.contact.name || row.contact.emails[0] || 'Unnamed', reason: row.problems.join('. ') }))
    const skipped = duplicates.value === 'skip' ? duplicateRows.value.length : 0
    cancelled = false
    progress.value = { done: 0, total: queue.length }
    step.value = 'running'
    announce(`Importing ${queue.length} contacts`)

    let added = 0
    for (const row of queue) {
      if (cancelled) break
      const saved = await saveOne({ ...row.contact, id: '', bookId: bookId.value })
      if (saved === true) added++
      else failed.push({ name: row.contact.name, reason: saved })
      progress.value = { done: progress.value.done + 1, total: queue.length }
    }

    if (added) tellWindows({ type: 'contacts:changed' })
    summary.value = {
      added,
      skipped: skipped + (cancelled ? queue.length - progress.value.done : 0),
      failed,
      cancelled
    }
    step.value = 'done'
    announce(`Import ${cancelled ? 'stopped' : 'finished'}: ${added} added, ${summary.value.skipped} skipped, ${failed.length} failed`)
  }

  async function saveOne(contact: Contact): Promise<true | string> {
    let reason = 'The address book refused it'
    const saved = await save(contact, {
      quiet: true,
      onError: (message) => {
        reason = message
      }
    })
    return saved ? true : reason
  }

  function cancel() {
    cancelled = true
    announce('Stopping the import after this contact')
  }

  return {
    step,
    fileName,
    readError,
    sheet,
    mapping,
    mappedPreview,
    mappingReady,
    rows,
    invalid,
    duplicateRows,
    toAdd,
    duplicates,
    bookId,
    books,
    progress,
    summary,
    reset,
    read,
    applyMapping,
    run,
    cancel
  }
}
