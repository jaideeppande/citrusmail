<script setup lang="ts">
const { subscriptions, shown, query, status, refresh, busy, leave, block, picked, pick, pickAll, pickable, leaveMany, sweep } = useSubscriptions()

const open = computed(() => shown.value.filter(pickable))
useSeoMeta({ title: 'Subscriptions' })
</script>

<template>
  <PageSheet
    title="Subscriptions"
    description="Senders in your Inbox whose mail has an unsubscribe link, most frequent first. Most unsubscribe right here; a few only do it on their own website, which opens in a new tab."
  >
    <template #actions>
      <UTooltip text="Check again">
        <UButton
          icon="i-lucide-rotate-cw"
          color="neutral"
          variant="ghost"
          size="sm"
          aria-label="Check again"
          :loading="status === 'pending'"
          @click="refresh()"
        />
      </UTooltip>
    </template>

    <div class="flex flex-wrap items-center gap-2 mb-4 empty:hidden">
      <UInput
        v-if="subscriptions.length > 8"
        v-model="query"
        icon="i-lucide-search"
        placeholder="Find a sender"
        class="flex-1 max-w-sm"
      />
      <template v-if="open.length > 1">
        <UButton
          :label="picked.size === open.length ? 'Select none' : 'Select all'"
          color="neutral"
          variant="ghost"
          size="sm"
          class="ms-auto"
          :disabled="!!sweep"
          @click="pickAll"
        />
        <UButton
          :label="picked.size ? `Unsubscribe from ${picked.size}` : 'Unsubscribe from selected'"
          icon="i-lucide-mail-x"
          color="neutral"
          variant="soft"
          size="sm"
          :disabled="!picked.size || !!sweep"
          @click="leaveMany"
        />
      </template>
    </div>

    <Transition name="lb-collapse">
      <div v-if="sweep">
        <div class="pb-4">
          <p class="text-sm text-muted mb-1.5 tabular-nums">
            Unsubscribing: {{ sweep.done }} of {{ sweep.total }}
          </p>
          <UProgress
            :model-value="sweep.done"
            :max="sweep.total"
            size="sm"
          />
        </div>
      </div>
    </Transition>

    <div
      v-if="status === 'pending' && !subscriptions.length"
      class="flex flex-col gap-2"
    >
      <USkeleton
        v-for="n in 6"
        :key="n"
        class="h-14 rounded-lg"
      />
    </div>
    <UEmpty
      v-else-if="!subscriptions.length"
      icon="i-lucide-newspaper"
      title="No mailing lists found"
      description="None of the recent mail in your Inbox has an unsubscribe link."
      variant="naked"
    />
    <UEmpty
      v-else-if="!shown.length"
      icon="i-lucide-search-x"
      title="No matches"
      :description="`No mailing list matches “${query}”.`"
      variant="naked"
    />
    <ul
      v-else
      class="divide-y divide-default border-y border-default"
    >
      <SubscriptionRow
        v-for="item in shown"
        :key="item.address"
        :item="item"
        :busy="busy.has(item.address)"
        :picked="picked.has(item.address)"
        :pickable="open.length > 1 && pickable(item)"
        @pick="pick(item)"
        @unsubscribe="leave(item)"
        @block="block(item.address)"
      />
    </ul>
  </PageSheet>
</template>
