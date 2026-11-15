<script setup lang="ts">
// To, with Cc and Bcc unfolding below it when asked for (or when a draft has them)
const { open, draft, version } = useComposer()
const { account } = useShell()
const tally = useAccountPref<RecipientTally>('recipients', () => ({}))

const showCc = ref(false)
const showBcc = ref(false)
watch([open, version], ([value]) => {
  if (!value) return
  showCc.value = !!draft.value.cc.length
  showBcc.value = !!draft.value.bcc.length
}, { immediate: true })

// People who usually get the same messages as the ones already entered.
// Nothing shows until there is history to go by
const companions = computed(() => {
  if (!draft.value.to.length) return []
  const entered = [...draft.value.to, ...draft.value.cc, ...draft.value.bcc]
  return alsoInclude(tally.value, entered, account.value ? [account.value.email] : [])
})

function include(address: Address) {
  draft.value.to = [...draft.value.to, address]
  announce(`${personName(address)} added`)
}
</script>

<template>
  <MailComposerRecipientField
    v-model="draft.to"
    label="To"
    :autofocus="!draft.to.length"
  >
    <div class="flex items-center">
      <UButton
        v-if="!showCc"
        label="Cc"
        color="neutral"
        variant="link"
        size="sm"
        aria-label="Add Cc recipients"
        @click="showCc = true"
      />
      <UButton
        v-if="!showBcc"
        label="Bcc"
        color="neutral"
        variant="link"
        size="sm"
        aria-label="Add Bcc recipients"
        @click="showBcc = true"
      />
    </div>
  </MailComposerRecipientField>
  <MailComposerZones />
  <Transition name="lb-collapse">
    <div
      v-if="companions.length"
      class="border-b border-default"
    >
      <div class="flex flex-wrap items-center gap-1.5 px-5 py-1 ps-22">
        <span
          id="lb-also-include"
          class="text-xs text-muted"
        >Also include:</span>
        <TransitionGroup
          name="lb-pop"
          tag="div"
          role="group"
          aria-labelledby="lb-also-include"
          class="contents"
        >
          <UButton
            v-for="person in companions"
            :key="person.address"
            :label="personName(person)"
            :title="person.address"
            :aria-label="`Add ${personName(person)} (${person.address})`"
            icon="i-lucide-plus"
            color="neutral"
            variant="outline"
            size="xs"
            class="lb-press rounded-full"
            @click="include(person)"
          />
        </TransitionGroup>
      </div>
    </div>
  </Transition>
  <Transition name="lb-row">
    <MailComposerRecipientField
      v-if="showCc"
      v-model="draft.cc"
      label="Cc"
      :autofocus="!draft.cc.length"
    />
  </Transition>
  <Transition name="lb-row">
    <MailComposerRecipientField
      v-if="showBcc"
      v-model="draft.bcc"
      label="Bcc"
      :autofocus="!draft.bcc.length"
    />
  </Transition>
</template>
