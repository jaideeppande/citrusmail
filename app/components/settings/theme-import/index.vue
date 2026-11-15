<script setup lang="ts">
// Paste a theme as JSON, the same shape "Copy as JSON" gives. Every key is
// checked and every value has to be a plain CSS value, so a pasted theme
// can't carry anything else into the page; nothing is applied unless all of
// it passes
const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  import: [theme: import('~/utils/theme').ThemeOverride]
}>()

const text = ref('')
const errors = ref<string[]>([])
watch(open, (on) => {
  if (!on) return
  text.value = ''
  errors.value = []
})

function submit() {
  const result = parseThemeJson(text.value)
  errors.value = result.errors
  if (!result.theme) return announce(`The theme wasn’t imported. ${result.errors[0] ?? ''}`, true)
  emit('import', result.theme)
  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Import a theme"
    description="Paste the JSON of a theme: what “Copy as JSON” gives, or the theme object from app.config.ts."
  >
    <template #body>
      <form
        id="theme-import"
        class="flex flex-col gap-3"
        @submit.prevent="submit"
      >
        <UFormField
          label="Theme JSON"
          :error="errors.length ? true : undefined"
        >
          <UTextarea
            v-model="text"
            :rows="9"
            autofocus
            spellcheck="false"
            placeholder="{ &quot;primary&quot;: &quot;#2563EB&quot;, &quot;dark&quot;: { &quot;desk&quot;: &quot;#000&quot; } }"
            :aria-describedby="errors.length ? 'theme-import-errors' : undefined"
            :ui="{ base: 'font-mono text-xs' }"
          />
        </UFormField>
        <ul
          v-if="errors.length"
          id="theme-import-errors"
          class="flex flex-col gap-1 text-sm text-error"
        >
          <li
            v-for="error in errors.slice(0, 6)"
            :key="error"
            class="flex items-start gap-1.5"
          >
            <UIcon
              name="i-lucide-circle-alert"
              class="mt-0.5 size-4 shrink-0"
            />
            {{ error }}
          </li>
          <li v-if="errors.length > 6">
            And {{ errors.length - 6 }} more.
          </li>
        </ul>
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          label="Cancel"
          color="neutral"
          variant="ghost"
          @click="open = false"
        />
        <UButton
          type="submit"
          form="theme-import"
          label="Import"
          :disabled="!text.trim()"
        />
      </div>
    </template>
  </UModal>
</template>
