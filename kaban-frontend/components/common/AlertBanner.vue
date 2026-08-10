<template>
  <div
    v-if="visible"
    :role="tone === 'error' ? 'alert' : 'status'"
    class="flex items-start gap-sm rounded-xl px-md py-sm"
    :class="tone === 'error'
      ? 'bg-error-container/60 text-error'
      : 'bg-green-50 text-green-700'"
  >
    <span class="material-symbols-outlined text-[20px] flex-shrink-0" aria-hidden="true">
      {{ tone === 'error' ? 'error' : 'check_circle' }}
    </span>

    <div class="flex-grow min-w-0">
      <!-- Multiple violations get a list; one gets a sentence -->
      <ul v-if="items.length > 1" class="font-body-sm text-body-sm list-disc pl-4 space-y-xs">
        <li v-for="item in items" :key="item">{{ item }}</li>
      </ul>
      <p v-else class="font-body-sm text-body-sm">{{ items[0] }}</p>

      <!-- Recovery action, e.g. "Log in instead →" on a duplicate-phone 409 -->
      <slot name="action" />
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    tone?: 'error' | 'success'
    /** Single message, or the full backend `errors` array. */
    message?: string | null
    messages?: string[]
  }>(),
  { tone: 'error', message: null, messages: () => [] },
)

const items = computed(() => {
  if (props.messages.length) return props.messages
  return props.message ? [props.message] : []
})

const visible = computed(() => items.value.length > 0)
</script>
