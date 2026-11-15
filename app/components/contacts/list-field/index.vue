<script setup lang="ts">
// Several addresses or numbers, one input each. Every input is labelled on
// its own (“Email 2”) and shows its own error underneath
const props = defineProps<{
  label: string
  type: 'email' | 'tel'
  addLabel: string
  /** Problems by position, as the editor found them on saving */
  errors?: (string | undefined)[]
  /** Prefix for the inputs’ ids, so the editor can move focus to one */
  idPrefix: string
}>()

const emit = defineEmits<{
  edit: [index: number]
}>()

const model = defineModel<string[]>({ required: true })

function update(index: number, value: string) {
  model.value = model.value.map((item, i) => i === index ? value : item)
  emit('edit', index)
}

async function add() {
  model.value = [...model.value, '']
  await nextTick()
  document.getElementById(`${props.idPrefix}-${model.value.length - 1}`)?.focus()
}

async function removeAt(index: number) {
  model.value = model.value.filter((_, i) => i !== index)
  announce(`${props.label} removed`)
  await nextTick()
  // Focus stays in the list rather than falling to the top of the dialog
  document.getElementById(`${props.idPrefix}-${Math.min(index, model.value.length - 1)}`)?.focus()
}

const labelOf = (index: number) => model.value.length > 1 ? `${props.label} ${index + 1}` : props.label
</script>

<template>
  <fieldset class="flex flex-col gap-1.5">
    <legend class="mb-1.5 text-sm font-medium text-default">
      {{ label }}
    </legend>
    <UFormField
      v-for="(value, index) in model"
      :key="index"
      :name="`${idPrefix}-${index}`"
      :error="errors?.[index]"
      :ui="{ label: 'sr-only' }"
      :label="labelOf(index)"
    >
      <UInput
        :id="`${idPrefix}-${index}`"
        :model-value="value"
        :type="type"
        :autocomplete="type === 'email' ? 'email' : 'tel'"
        class="w-full"
        :ui="{ trailing: 'pe-1' }"
        @update:model-value="update(index, String($event))"
      >
        <template #trailing>
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="link"
            size="xs"
            :aria-label="`Remove ${labelOf(index).toLowerCase()}`"
            @click="removeAt(index)"
          />
        </template>
      </UInput>
    </UFormField>
    <UButton
      icon="i-lucide-plus"
      :label="addLabel"
      color="neutral"
      variant="ghost"
      size="xs"
      class="self-start"
      @click="add"
    />
  </fieldset>
</template>
