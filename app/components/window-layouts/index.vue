<script setup lang="ts">
// The layout button at the top right: split this window into panes, open
// another window, or bring back a set of windows saved under a name
const { available, layout, setLayout } = usePanes()
const { kbds } = useShortcutKeys()
const toast = useToast()
const app = desktop()

const open = ref(false)
const workspaces = ref<DesktopWorkspace[]>([])
const name = ref('')
const saving = ref(false)

watch(open, async (now) => {
  if (now && app) workspaces.value = await app.listWorkspaces().catch(() => [])
})

async function save() {
  const label = name.value.trim()
  if (!label || !app) return
  saving.value = true
  workspaces.value = await app.saveWorkspace(label).catch(() => workspaces.value)
  saving.value = false
  name.value = ''
  toast.add({ title: `Saved “${label}”`, description: 'Every open window, where it sits and what it shows.', icon: 'i-lucide-layout-dashboard' })
}

async function restore(workspace: DesktopWorkspace) {
  open.value = false
  await app?.openWorkspace(workspace.id)
}

async function forget(workspace: DesktopWorkspace) {
  if (app) workspaces.value = await app.removeWorkspace(workspace.id).catch(() => workspaces.value)
}

function newWindow() {
  open.value = false
  if (app) app.openWindow('/mail/INBOX', { kind: 'main' })
  else window.open('/mail/INBOX', '_blank')
}
</script>

<template>
  <UPopover
    v-model:open="open"
    :content="{ align: 'end', sideOffset: 8 }"
    :ui="{ content: 'w-72 p-3 flex flex-col gap-3' }"
  >
    <UTooltip
      text="Layout and windows"
      :kbds="kbds('window.layout')"
    >
      <UButton
        data-tour="layout"
        icon="i-lucide-layout-grid"
        color="neutral"
        :variant="open || layout.panes > 1 ? 'soft' : 'ghost'"
        size="xs"
        aria-label="Layout and windows"
        class="text-dimmed hover:text-highlighted"
      />
    </UTooltip>

    <template #content>
      <section>
        <h3 class="text-xs font-medium text-muted mb-2">
          Layout
        </h3>
        <div class="grid grid-cols-5 gap-1.5">
          <UTooltip
            v-for="item in LAYOUTS"
            :key="item.id"
            :text="item.label"
          >
            <button
              type="button"
              :aria-label="item.label"
              :aria-pressed="layout.id === item.id"
              :disabled="!available && item.panes > 1"
              class="lb-layout-thumb lb-press lb-focus"
              :data-active="layout.id === item.id"
              @click="setLayout(item.id)"
            >
              <span
                v-for="(cell, index) in item.cells"
                :key="index"
                :style="{ gridColumn: `${cell[0] + 1} / span ${cell[2]}`, gridRow: `${cell[1] + 1} / span ${cell[3]}` }"
              />
            </button>
          </UTooltip>
        </div>
        <p
          v-if="!available"
          class="mt-2 text-xs text-dimmed"
        >
          Split layouts are part of the desktop app. Here, a page can still open in a window of its own.
        </p>
      </section>

      <USeparator />

      <section class="flex flex-col gap-1">
        <h3 class="text-xs font-medium text-muted mb-1">
          Windows
        </h3>
        <UButton
          label="New window"
          icon="i-lucide-app-window"
          color="neutral"
          variant="ghost"
          size="sm"
          class="justify-start"
          @click="newWindow"
        />
        <UButton
          label="Open this page in a new window"
          icon="i-lucide-picture-in-picture-2"
          color="neutral"
          variant="ghost"
          size="sm"
          class="justify-start"
          @click="open = false; openPopout(currentPath())"
        >
          <template #trailing>
            <span class="ms-auto flex items-center gap-0.5">
              <UKbd
                v-for="key in kbds('window.popout')"
                :key="key"
                :value="key"
                size="sm"
                variant="soft"
              />
            </span>
          </template>
        </UButton>
      </section>

      <template v-if="app">
        <USeparator />

        <section class="flex flex-col gap-1">
          <h3 class="text-xs font-medium text-muted mb-1">
            Workspaces
          </h3>
          <TransitionGroup
            name="lb-list"
            tag="ul"
            class="relative flex flex-col"
          >
            <li
              v-for="workspace in workspaces"
              :key="workspace.id"
              class="group flex items-center gap-1"
            >
              <UButton
                :label="workspace.name"
                icon="i-lucide-layout-dashboard"
                color="neutral"
                variant="ghost"
                size="sm"
                class="flex-1 min-w-0 justify-start"
                @click="restore(workspace)"
              >
                <template #trailing>
                  <span class="ms-auto text-xs text-dimmed tabular-nums">{{ workspace.windows }} {{ workspace.windows === 1 ? 'window' : 'windows' }}</span>
                </template>
              </UButton>
              <UButton
                icon="i-lucide-x"
                color="neutral"
                variant="ghost"
                size="xs"
                :aria-label="`Remove ${workspace.name}`"
                class="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity text-dimmed"
                @click="forget(workspace)"
              />
            </li>
          </TransitionGroup>
          <p
            v-if="!workspaces.length"
            class="text-xs text-dimmed"
          >
            Arrange your windows across your screens, then save them under a name to get them back in one click.
          </p>
          <form
            class="flex items-center gap-1.5 mt-1"
            @submit.prevent="save"
          >
            <UInput
              v-model="name"
              placeholder="Name these windows"
              size="sm"
              maxlength="40"
              aria-label="Workspace name"
              class="flex-1"
            />
            <UButton
              type="submit"
              label="Save"
              color="neutral"
              variant="soft"
              size="sm"
              :loading="saving"
              :disabled="!name.trim()"
            />
          </form>
        </section>
      </template>
    </template>
  </UPopover>
</template>
