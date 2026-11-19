<script setup lang="ts">
import type { GuardIssue } from '~/utils/compose-guards'

// Asked once before a message goes out, with everything that looked off:
// a file that was promised but isn't there, no subject, a greeting to
// someone else (see utils/compose-guards)
defineProps<{
  issues: GuardIssue[]
}>()

const emit = defineEmits<{
  close: [confirmed: boolean]
}>()

const ICONS: Record<GuardIssue['kind'], string> = {
  attachment: 'i-lucide-paperclip',
  subject: 'i-lucide-heading',
  name: 'i-lucide-user-round-x'
}
</script>

<template>
  <UModal
    title="Before this goes"
    description="A quick look, in case one of these is a slip."
    :close="false"
    :ui="{ content: 'sm:max-w-md', body: 'py-4 sm:py-4', footer: 'justify-end gap-2' }"
    @update:open="(open: boolean) => !open && emit('close', false)"
  >
    <template #body>
      <ul class="flex flex-col gap-3">
        <li
          v-for="(issue, index) in issues"
          :key="issue.kind"
          class="lb-stagger flex items-start gap-3"
          :style="{ '--lb-i': index }"
        >
          <span class="grid size-8 shrink-0 place-items-center rounded-full bg-elevated">
            <UIcon
              :name="ICONS[issue.kind]"
              class="size-4 text-toned"
            />
          </span>
          <span class="min-w-0">
            <span class="block text-sm font-medium text-highlighted">{{ issue.title }}</span>
            <span class="block text-sm text-muted">{{ issue.detail }}</span>
          </span>
        </li>
      </ul>
    </template>
    <template #footer>
      <UButton
        label="Go back"
        color="neutral"
        variant="ghost"
        autofocus
        @click="emit('close', false)"
      />
      <UButton
        label="Send anyway"
        trailing-icon="i-lucide-send-horizontal"
        @click="emit('close', true)"
      />
    </template>
  </UModal>
</template>
