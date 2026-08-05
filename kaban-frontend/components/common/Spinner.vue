<template>
  <div
    role="status"
    :aria-label="label"
    class="rounded-full border-2 border-current border-t-transparent animate-spin motion-reduce:animate-none"
    :class="size === 'sm' ? 'w-4 h-4' : 'w-6 h-6'"
  ></div>
</template>

<script setup lang="ts">
/**
 * Inherits its colour from the parent via `border-current`, so it works on the
 * navy, orange and outlined buttons without a variant prop.
 */
withDefaults(
  defineProps<{
    size?: 'sm' | 'md'
    label?: string
  }>(),
  { size: 'sm', label: 'Loading' },
)
</script>
