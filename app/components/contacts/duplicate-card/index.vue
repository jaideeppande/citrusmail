<script setup lang="ts">
// One contact as the duplicates dialog shows it: every field it holds, small
// enough to stand next to its copies
const props = defineProps<{
  contact: Contact
  /** The contact the others are folded into */
  merged?: boolean
  /** A short word above the name: “Keeps”, “Removed”, “Becomes” */
  label: string
}>()

const subtitle = computed(() => [props.contact.title, props.contact.company].filter(Boolean).join(' at '))
const birthday = computed(() => formatBirthday(props.contact.birthday))
</script>

<template>
  <div
    class="min-w-0 rounded-md px-3 py-2.5 text-sm"
    :class="merged ? 'bg-primary/5 ring ring-primary/25' : 'bg-elevated/50 ring ring-default'"
  >
    <p
      class="text-[11px] font-medium tracking-wide uppercase"
      :class="merged ? 'text-primary' : 'text-muted'"
    >
      {{ label }}
    </p>
    <p class="truncate font-medium text-highlighted">
      {{ contact.name }}
    </p>
    <p
      v-if="subtitle"
      class="truncate text-xs text-muted"
    >
      {{ subtitle }}
    </p>

    <ul class="mt-1.5 flex flex-col gap-0.5 text-xs text-toned">
      <li
        v-for="email in contact.emails"
        :key="email"
        class="flex items-center gap-1.5 min-w-0"
      >
        <UIcon
          name="i-lucide-mail"
          class="size-3 shrink-0 text-muted"
          aria-hidden="true"
        />
        <span class="truncate">{{ email }}</span>
      </li>
      <li
        v-for="phone in contact.phones"
        :key="phone"
        class="flex items-center gap-1.5 min-w-0"
      >
        <UIcon
          name="i-lucide-phone"
          class="size-3 shrink-0 text-muted"
          aria-hidden="true"
        />
        <span class="truncate tabular-nums">{{ phone }}</span>
      </li>
      <li
        v-if="birthday"
        class="flex items-center gap-1.5 min-w-0"
      >
        <UIcon
          name="i-lucide-cake"
          class="size-3 shrink-0 text-muted"
          aria-hidden="true"
        />
        <span class="truncate">{{ birthday }}</span>
      </li>
      <li
        v-if="contact.note"
        class="flex items-start gap-1.5 min-w-0"
      >
        <UIcon
          name="i-lucide-sticky-note"
          class="mt-0.5 size-3 shrink-0 text-muted"
          aria-hidden="true"
        />
        <span class="line-clamp-2 break-words">{{ contact.note }}</span>
      </li>
      <li
        v-if="!contact.emails.length && !contact.phones.length && !birthday && !contact.note"
        class="text-muted"
      >
        Nothing but the name
      </li>
    </ul>
  </div>
</template>
