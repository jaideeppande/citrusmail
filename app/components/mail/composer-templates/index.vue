<script setup lang="ts">
// Templates in the composer's toolbar: find one and it goes in where the
// cursor is; save the message on screen as a new one; rename or delete
const { templates, insert, saveCurrent, rename, remove, addStarters } = useTemplates()
const { draft } = useComposer()
const { templates: open } = useComposerTools()

const search = ref('')
const view = ref<'list' | 'save' | 'manage'>('list')
const name = ref('')
const renaming = ref<string>()
const renamed = ref('')

watch(open, (value) => {
  if (!value) return
  search.value = ''
  view.value = 'list'
  renaming.value = undefined
})

const plain = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()

const shown = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return templates.value
  return templates.value.filter(item => `${item.name} ${item.subject ?? ''} ${plain(item.html)}`.toLowerCase().includes(term))
})

const hasWords = computed(() => !!plain(draft.value.html))
const startersLeft = computed(() => STARTER_TEMPLATES.some(starter => !templates.value.some(item => item.name.toLowerCase() === starter.name.toLowerCase())))

function pick(template: ComposeTemplate) {
  open.value = false
  // After the list has closed and handed the cursor back to the editor
  nextTick(() => insert(template))
}

function startSave() {
  name.value = draft.value.subject.trim()
  view.value = 'save'
}

function save() {
  if (saveCurrent(name.value)) view.value = 'list'
}

function startRename(template: ComposeTemplate) {
  renaming.value = template.id
  renamed.value = template.name
}

function finishRename() {
  if (renaming.value) rename(renaming.value, renamed.value)
  renaming.value = undefined
}

// Enter on the search field takes the first match
function pickFirst() {
  const first = shown.value[0]
  if (first) pick(first)
}
</script>

<template>
  <UPopover
    v-model:open="open"
    :content="{ side: 'top', align: 'start' }"
    :ui="{ content: 'w-80 p-0' }"
  >
    <UTooltip text="Templates">
      <UButton
        icon="i-lucide-file-text"
        color="neutral"
        variant="ghost"
        aria-label="Templates"
      />
    </UTooltip>

    <template #content>
      <form
        v-if="view === 'save'"
        class="lb-in flex flex-col gap-3 p-3"
        @submit.prevent="save"
      >
        <p class="text-sm font-medium text-highlighted">
          Save this message as a template
        </p>
        <UInput
          v-model="name"
          autofocus
          placeholder="Name, e.g. Thank you"
          aria-label="Template name"
          maxlength="80"
        />
        <p class="text-xs text-muted">
          Your words{{ draft.subject.trim() ? ' and the subject' : '' }} are kept. The signature and quoted message are not.
        </p>
        <div class="flex justify-end gap-2">
          <UButton
            label="Back"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="view = 'list'"
          />
          <UButton
            type="submit"
            label="Save template"
            size="sm"
            :disabled="!name.trim()"
          />
        </div>
      </form>

      <div
        v-else
        class="flex flex-col"
      >
        <div class="flex items-center gap-1 border-b border-default ps-3 pe-1.5">
          <UIcon
            name="i-lucide-search"
            class="size-4 shrink-0 text-dimmed"
          />
          <UInput
            v-model="search"
            autofocus
            variant="none"
            placeholder="Find a template"
            aria-label="Find a template"
            class="flex-1"
            :ui="{ base: 'px-1.5 h-10 text-sm' }"
            @keydown.enter.prevent="pickFirst"
          />
          <UTooltip
            v-if="templates.length"
            :text="view === 'manage' ? 'Done' : 'Rename or delete'"
          >
            <UButton
              :icon="view === 'manage' ? 'i-lucide-check' : 'i-lucide-settings-2'"
              color="neutral"
              :variant="view === 'manage' ? 'soft' : 'ghost'"
              size="xs"
              :aria-label="view === 'manage' ? 'Done' : 'Rename or delete'"
              @click="view = view === 'manage' ? 'list' : 'manage'"
            />
          </UTooltip>
        </div>

        <ul
          v-if="shown.length"
          class="max-h-64 overflow-y-auto p-1"
        >
          <li
            v-for="(template, index) in shown"
            :key="template.id"
            class="lb-stagger"
            :style="{ '--lb-i': index }"
          >
            <form
              v-if="renaming === template.id"
              class="flex items-center gap-1 px-1 py-1"
              @submit.prevent="finishRename"
            >
              <UInput
                v-model="renamed"
                autofocus
                size="sm"
                aria-label="Template name"
                maxlength="80"
                class="flex-1"
                @keydown.esc.stop.prevent="renaming = undefined"
              />
              <UButton
                type="submit"
                icon="i-lucide-check"
                color="neutral"
                variant="ghost"
                size="xs"
                aria-label="Save name"
              />
            </form>
            <div
              v-else
              class="group flex items-center gap-1 rounded-md hover:bg-elevated"
            >
              <button
                type="button"
                class="lb-focus flex min-w-0 flex-1 flex-col rounded-md px-2 py-1.5 text-start"
                @click="view === 'manage' ? startRename(template) : pick(template)"
              >
                <span class="truncate text-sm font-medium text-highlighted">{{ template.name }}</span>
                <span class="truncate text-xs text-muted">{{ plain(template.html) }}</span>
              </button>
              <template v-if="view === 'manage'">
                <UButton
                  icon="i-lucide-pencil"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  :aria-label="`Rename ${template.name}`"
                  @click="startRename(template)"
                />
                <UButton
                  icon="i-lucide-trash-2"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  :aria-label="`Delete ${template.name}`"
                  class="me-1"
                  @click="remove(template.id)"
                />
              </template>
            </div>
          </li>
        </ul>
        <p
          v-else
          class="px-4 py-6 text-center text-sm text-muted"
        >
          {{ templates.length ? 'No template matches.' : 'No templates yet. Save a message you write often and it’s one click away.' }}
        </p>

        <div class="flex flex-col border-t border-default p-1">
          <UTooltip
            text="Write something first"
            :disabled="hasWords"
          >
            <!-- A disabled button gets no hover, so the tooltip sits on this wrapper -->
            <span class="flex">
              <UButton
                label="Save current message as template…"
                icon="i-lucide-plus"
                color="neutral"
                variant="ghost"
                size="sm"
                block
                class="justify-start"
                :disabled="!hasWords"
                @click="startSave"
              />
            </span>
          </UTooltip>
          <UButton
            v-if="startersLeft"
            label="Add starter templates"
            icon="i-lucide-sparkle"
            color="neutral"
            variant="ghost"
            size="sm"
            block
            class="justify-start"
            @click="addStarters"
          />
        </div>
      </div>
    </template>
  </UPopover>
</template>
