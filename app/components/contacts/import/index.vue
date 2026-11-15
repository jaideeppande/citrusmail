<script setup lang="ts">
const open = defineModel<boolean>('open', { required: true })

const {
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
} = useContactImport()

watch(open, value => value && reset(), { immediate: true })

// Each step’s heading takes focus as the step comes in, so a screen reader
// starts reading from the top of what changed
const heading = useTemplateRef<HTMLElement>('heading')
watch(step, async () => {
  await nextTick()
  heading.value?.focus()
})

const STEPS = ['Choose a file', 'Match columns', 'Review', 'Import'] as const
const stepIndex = computed(() => ({ pick: 0, map: 1, review: 2, running: 3, done: 3 })[step.value])
const steps = computed(() => STEPS.filter((_, index) => index !== 1 || !!sheet.value && !sheet.value.recognised))

const input = useTemplateRef('input')
const dragging = ref(false)

async function onFile(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (file) await read(file)
}

async function onDrop(event: DragEvent) {
  dragging.value = false
  const file = event.dataTransfer?.files[0]
  if (file) await read(file)
}

const fieldItems = CSV_FIELDS.map(field => ({ label: field.label, value: field.value }))

function setField(index: number, field: CsvField) {
  mapping.value = mapping.value.map((value, i) => i === index ? field : value)
}

const PREVIEW_FIELDS: { key: keyof ContactDraft, label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'emails', label: 'Email' },
  { key: 'phones', label: 'Phone' },
  { key: 'company', label: 'Company' }
]

function cell(contact: ContactDraft, key: keyof ContactDraft): string {
  const value = contact[key]
  return Array.isArray(value) ? value.join(', ') : value ?? ''
}

const running = computed(() => step.value === 'running')
const percent = computed(() => progress.value.total ? Math.round(progress.value.done / progress.value.total * 100) : 0)

function back() {
  step.value = sheet.value && !sheet.value.recognised && step.value === 'review' ? 'map' : 'pick'
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Import contacts"
    :description="fileName ? `From ${fileName}` : 'From a .vcf (vCard) or .csv file'"
    :dismissible="!running"
    :close="!running"
    :ui="{ content: 'sm:max-w-2xl', footer: 'justify-between gap-3' }"
  >
    <template #body>
      <ol
        class="mb-5 flex items-center gap-2 text-xs"
        aria-label="Steps"
      >
        <li
          v-for="(label, index) in steps"
          :key="label"
          class="flex items-center gap-2"
          :aria-current="STEPS.indexOf(label) === stepIndex ? 'step' : undefined"
        >
          <UIcon
            v-if="index"
            name="i-lucide-chevron-right"
            class="size-3 text-muted"
            aria-hidden="true"
          />
          <span :class="STEPS.indexOf(label) === stepIndex ? 'font-semibold text-highlighted' : STEPS.indexOf(label) < stepIndex ? 'text-toned' : 'text-muted'">
            {{ label }}<span
              v-if="STEPS.indexOf(label) < stepIndex"
              class="sr-only"
            > (done)</span>
          </span>
        </li>
      </ol>

      <!-- Choose a file -->
      <section
        v-if="step === 'pick'"
        class="flex flex-col gap-4"
      >
        <h2
          ref="heading"
          tabindex="-1"
          class="text-base font-semibold text-highlighted outline-none"
        >
          Choose a file
        </h2>
        <button
          type="button"
          class="lb-focus flex flex-col items-center gap-2 rounded-lg border border-dashed border-accented px-6 py-10 text-center transition-colors duration-(--lb-dur-1) hover:bg-elevated/50"
          :class="dragging && 'border-primary bg-primary/5'"
          aria-describedby="contact-import-formats"
          @click="input?.click()"
          @dragover.prevent="dragging = true"
          @dragleave="dragging = false"
          @drop.prevent="onDrop"
        >
          <UIcon
            name="i-lucide-file-up"
            class="size-6 text-muted"
          />
          <span class="text-sm font-medium text-highlighted">Choose a file or drop it here</span>
          <span
            id="contact-import-formats"
            class="text-xs text-muted"
          >vCard (.vcf) from Apple Contacts, Outlook and most phones; CSV from Google Contacts, Outlook or a spreadsheet</span>
        </button>
        <input
          ref="input"
          type="file"
          accept=".vcf,.vcard,.csv,.txt,text/vcard,text/csv"
          class="hidden"
          tabindex="-1"
          aria-hidden="true"
          @change="onFile"
        >
        <p
          v-if="readError"
          role="alert"
          class="flex items-start gap-2 text-sm text-error"
        >
          <UIcon
            name="i-lucide-circle-alert"
            class="mt-0.5 size-4 shrink-0"
          />
          {{ readError }}
        </p>
      </section>

      <!-- Match columns -->
      <section
        v-else-if="step === 'map' && sheet"
        class="flex flex-col gap-4"
      >
        <div>
          <h2
            ref="heading"
            tabindex="-1"
            class="text-base font-semibold text-highlighted outline-none"
          >
            Match columns
          </h2>
          <p class="text-sm text-muted">
            The columns weren’t recognised. Say what each one holds; the first rows are shown to help.
          </p>
        </div>
        <ul class="flex max-h-72 flex-col gap-1 overflow-y-auto">
          <li
            v-for="(header, index) in sheet.headers"
            :key="index"
            class="grid grid-cols-[1fr_12rem] items-center gap-3 py-1"
          >
            <div class="min-w-0">
              <label
                :for="`contact-import-col-${index}`"
                class="block truncate text-sm font-medium text-highlighted"
              >{{ header }}</label>
              <span class="block truncate text-xs text-muted">{{ sheet.rows.slice(0, 3).map(row => row[index]).filter(Boolean).join(' · ') || 'Empty' }}</span>
            </div>
            <USelect
              :id="`contact-import-col-${index}`"
              :model-value="mapping[index]"
              :items="fieldItems"
              size="sm"
              @update:model-value="setField(index, $event as CsvField)"
            />
          </li>
        </ul>

        <div>
          <h3 class="pb-1.5 text-xs font-semibold text-muted">
            Preview of the first {{ mappedPreview.length }} rows
          </h3>
          <div class="overflow-x-auto rounded-md ring ring-default">
            <table class="w-full text-start text-xs">
              <thead class="bg-elevated/60 text-muted">
                <tr>
                  <th
                    v-for="field in PREVIEW_FIELDS"
                    :key="field.key"
                    scope="col"
                    class="px-2.5 py-1.5 text-start font-medium"
                  >
                    {{ field.label }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr
                  v-for="(contact, index) in mappedPreview"
                  :key="index"
                >
                  <td
                    v-for="field in PREVIEW_FIELDS"
                    :key="field.key"
                    class="max-w-40 truncate px-2.5 py-1.5 text-highlighted"
                  >
                    {{ cell(contact, field.key) || '—' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <p
          v-if="!mappingReady"
          class="text-sm text-muted"
        >
          Match at least a name or an email column to go on.
        </p>
      </section>

      <!-- Review -->
      <section
        v-else-if="step === 'review'"
        class="flex flex-col gap-5"
      >
        <h2
          ref="heading"
          tabindex="-1"
          class="text-base font-semibold text-highlighted outline-none"
        >
          Review
        </h2>
        <dl class="grid grid-cols-3 gap-3">
          <div class="rounded-md bg-elevated/60 px-3 py-2.5">
            <dt class="text-xs text-muted">
              Will be added
            </dt>
            <dd class="text-xl font-semibold text-highlighted tabular-nums">
              {{ toAdd.length }}
            </dd>
          </div>
          <div class="rounded-md bg-elevated/60 px-3 py-2.5">
            <dt class="text-xs text-muted">
              Look like duplicates
            </dt>
            <dd class="text-xl font-semibold text-highlighted tabular-nums">
              {{ duplicateRows.length }}
            </dd>
          </div>
          <div class="rounded-md bg-elevated/60 px-3 py-2.5">
            <dt class="text-xs text-muted">
              Can’t be imported
            </dt>
            <dd class="text-xl font-semibold text-highlighted tabular-nums">
              {{ invalid.length }}
            </dd>
          </div>
        </dl>

        <UFormField
          v-if="duplicateRows.length"
          label="Duplicates"
          :description="`${duplicateRows.length === 1 ? '1 contact shares' : `${duplicateRows.length} contacts share`} an email address, a name or a phone number with someone already in your address book, or earlier in the file.`"
        >
          <URadioGroup
            v-model="duplicates"
            :items="[{ label: 'Skip duplicates', value: 'skip' }, { label: 'Import anyway', value: 'import', description: 'You can merge them later with Find duplicates.' }]"
            class="mt-1.5"
          />
        </UFormField>

        <UFormField
          v-if="books.length > 1"
          label="Address book"
        >
          <USelect
            v-model="bookId"
            :items="books.map(book => ({ label: book.name, value: book.id }))"
            class="w-64"
          />
        </UFormField>

        <details
          v-if="invalid.length"
          class="text-sm"
        >
          <summary class="lb-focus cursor-pointer rounded-sm text-toned">
            Why {{ invalid.length === 1 ? '1 contact' : `${invalid.length} contacts` }} can’t be imported
          </summary>
          <ul class="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto">
            <li
              v-for="(row, index) in invalid"
              :key="index"
              class="text-muted"
            >
              <span class="text-highlighted">{{ row.contact.name || row.contact.emails[0] || 'Unnamed' }}</span>: {{ row.problems.join('. ') }}
            </li>
          </ul>
        </details>

        <p
          v-if="!rows.length"
          class="text-sm text-muted"
        >
          Every row was empty.
        </p>
      </section>

      <!-- Importing -->
      <section
        v-else-if="step === 'running'"
        class="flex flex-col gap-3 py-4"
      >
        <h2
          ref="heading"
          tabindex="-1"
          class="text-base font-semibold text-highlighted outline-none"
        >
          Importing
        </h2>
        <UProgress
          :model-value="progress.done"
          :max="progress.total"
          size="sm"
          :aria-label="`Imported ${progress.done} of ${progress.total}`"
        />
        <p class="text-sm text-muted tabular-nums">
          {{ progress.done }} of {{ progress.total }} ({{ percent }}%)
        </p>
      </section>

      <!-- Done -->
      <section
        v-else-if="step === 'done' && summary"
        class="flex flex-col gap-4"
      >
        <h2
          ref="heading"
          tabindex="-1"
          class="text-base font-semibold text-highlighted outline-none"
        >
          {{ summary.cancelled ? 'Import stopped' : 'Import finished' }}
        </h2>
        <ul class="flex flex-col gap-1.5 text-sm">
          <li class="flex items-center gap-2">
            <UIcon
              name="i-lucide-check"
              class="size-4 text-success"
              aria-hidden="true"
            />
            <span><span class="font-semibold text-highlighted tabular-nums">{{ summary.added }}</span> added</span>
          </li>
          <li class="flex items-center gap-2">
            <UIcon
              name="i-lucide-skip-forward"
              class="size-4 text-muted"
              aria-hidden="true"
            />
            <span><span class="font-semibold text-highlighted tabular-nums">{{ summary.skipped }}</span> skipped{{ summary.cancelled ? ', including those not reached' : ' as duplicates' }}</span>
          </li>
          <li class="flex items-center gap-2">
            <UIcon
              name="i-lucide-circle-alert"
              class="size-4"
              :class="summary.failed.length ? 'text-error' : 'text-muted'"
              aria-hidden="true"
            />
            <span><span class="font-semibold text-highlighted tabular-nums">{{ summary.failed.length }}</span> failed</span>
          </li>
        </ul>
        <div v-if="summary.failed.length">
          <h3 class="pb-1.5 text-xs font-semibold text-muted">
            What failed and why
          </h3>
          <ul class="flex max-h-48 flex-col gap-1 overflow-y-auto text-sm">
            <li
              v-for="(failure, index) in summary.failed"
              :key="index"
              class="text-muted"
            >
              <span class="text-highlighted">{{ failure.name }}</span>: {{ failure.reason }}
            </li>
          </ul>
        </div>
      </section>
    </template>

    <template #footer>
      <div>
        <UButton
          v-if="step === 'map' || step === 'review'"
          label="Back"
          icon="i-lucide-arrow-left"
          color="neutral"
          variant="ghost"
          @click="back"
        />
      </div>
      <div class="flex items-center gap-2">
        <UButton
          v-if="step === 'running'"
          label="Stop"
          color="neutral"
          variant="outline"
          @click="cancel"
        />
        <template v-else-if="step === 'done'">
          <UButton
            label="Import another file"
            color="neutral"
            variant="ghost"
            @click="reset"
          />
          <UButton
            label="Done"
            @click="open = false"
          />
        </template>
        <template v-else>
          <UButton
            label="Cancel"
            color="neutral"
            variant="ghost"
            @click="open = false"
          />
          <UButton
            v-if="step === 'pick'"
            label="Choose file"
            icon="i-lucide-file-up"
            @click="input?.click()"
          />
          <UButton
            v-else-if="step === 'map'"
            label="Continue"
            :disabled="!mappingReady"
            @click="applyMapping"
          />
          <UButton
            v-else-if="step === 'review'"
            :label="toAdd.length === 1 ? 'Import 1 contact' : `Import ${toAdd.length} contacts`"
            :disabled="!toAdd.length || !bookId"
            @click="run"
          />
        </template>
      </div>
    </template>
  </UModal>
</template>
