<script setup lang="ts">
// At the top of Drafts: what's waiting to go out, to change, edit or cancel
const { scheduled, cancel, reschedule } = useScheduled()
const { reopen } = useComposer()
const toast = useToast()
const open = useLocalStorage('citrusmail-scheduled-open', true)

const picking = ref<ScheduledMessage>()
const pickerOpen = computed({
  get: () => !!picking.value,
  set: (value) => {
    if (!value) picking.value = undefined
  }
})

async function edit(item: ScheduledMessage) {
  const message = await cancel(item)
  if (message) reopen(message)
}

async function drop(item: ScheduledMessage) {
  if (!(await cancel(item))) return
  toast.add({ title: 'Won’t be sent', description: item.subject || '(No subject)', icon: 'i-lucide-x' })
  announce(`Won’t be sent: ${item.subject || 'no subject'}`)
}

async function moveTo(date: Date) {
  if (picking.value) await moveItem(picking.value, date)
}

async function moveItem(item: ScheduledMessage, date: Date) {
  if (await reschedule(item, date)) announce(`Rescheduled for ${scheduleLabel(date.toISOString())}`)
}
</script>

<template>
  <section
    v-if="scheduled.length"
    class="shrink-0 border-b border-default bg-elevated/40"
  >
    <UButton
      :label="`Scheduled (${scheduled.length})`"
      icon="i-lucide-clock-arrow-up"
      :trailing-icon="open ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
      color="neutral"
      variant="ghost"
      size="sm"
      block
      class="justify-start rounded-none px-4 h-9 text-muted font-semibold"
      :ui="{ trailingIcon: 'ms-auto' }"
      :aria-expanded="open"
      aria-controls="lb-scheduled-list"
      @click="open = !open"
    />
    <div
      id="lb-scheduled-list"
      class="lb-expand"
      :data-open="open || undefined"
      :inert="!open"
    >
      <div>
        <MailScheduledTimeline
          :items="scheduled"
          @edit="edit"
          @reschedule="item => (picking = item)"
          @reschedule-to="moveItem"
          @cancel="drop"
        />
        <ul
          class="max-h-64 overflow-y-auto"
          aria-label="Scheduled messages"
        >
          <MailScheduledItem
            v-for="item in scheduled"
            :key="item.id"
            :item="item"
            @edit="edit(item)"
            @reschedule="picking = item"
            @reschedule-to="date => moveItem(item, date)"
            @cancel="drop(item)"
          />
        </ul>
      </div>
    </div>

    <MailSendLaterModal
      v-model:open="pickerOpen"
      :initial="picking ? new Date(picking.sendAt) : undefined"
      action="Reschedule"
      @pick="moveTo"
    />
  </section>
</template>
