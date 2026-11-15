<script setup lang="ts">
// Above a message the scam check doubts: how sure it is, why, in plain
// words, and the two ways out. The reasons are the AI's own text, shown as
// text only. "This looks safe" is remembered for this message
const props = defineProps<{
  message: MessageSummary
}>()

const scam = useAiScam()
const { folders } = useMail()

const warning = computed(() => scam.warning(props.message))
const look = computed(() => warning.value && scamLook(warning.value.verdict))
const inJunk = computed(() => folders.value.find(folder => folder.path === props.message.folder)?.role === 'junk')
const titleId = useId()
</script>

<template>
  <Transition name="lb-collapse">
    <div v-if="warning && look">
      <section
        class="flex items-start gap-3 rounded-lg px-4 py-3 ring"
        :class="look.color === 'error' ? 'bg-error/8 ring-error/25' : 'bg-warning/8 ring-warning/25'"
        :aria-labelledby="titleId"
      >
        <UIcon
          :name="look.icon"
          class="size-5 shrink-0 mt-0.5"
          :class="look.color === 'error' ? 'text-error' : 'text-warning'"
          aria-hidden="true"
        />
        <div class="flex-1 min-w-0">
          <h2
            :id="titleId"
            class="text-sm font-semibold text-highlighted"
          >
            {{ look.color === 'error' ? 'This looks like a scam' : 'Be careful with this message' }}
          </h2>
          <ul
            v-if="warning.reasons.length"
            class="mt-1 flex flex-col gap-0.5 text-sm text-toned list-disc ps-4"
          >
            <li
              v-for="(reason, index) in warning.reasons"
              :key="index"
            >
              {{ reason }}
            </li>
          </ul>
          <p class="mt-1.5 inline-flex items-center gap-1 text-xs text-muted">
            <UIcon
              name="i-lucide-sparkles"
              class="size-3 text-(--lb-ai)"
              aria-hidden="true"
            />Checked by AI. It can be wrong, so look at the sender and links before you trust or delete it.
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <UButton
            label="This looks safe"
            color="neutral"
            variant="ghost"
            size="xs"
            @click="scam.dismiss(message)"
          />
          <UButton
            v-if="!inJunk"
            label="Move to Junk"
            icon="i-lucide-shield-alert"
            :color="look.color"
            variant="soft"
            size="xs"
            @click="scam.junk(message)"
          />
        </div>
      </section>
    </div>
  </Transition>
</template>
