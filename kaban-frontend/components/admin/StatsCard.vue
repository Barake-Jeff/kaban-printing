<template>
  <div class="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-2">
    <div class="flex items-center justify-between">
      <span class="text-xs font-semibold uppercase tracking-widest text-gray-400">{{ label }}</span>
      <span
        class="material-symbols-outlined text-gray-300"
        style="font-size:20px;"
      >{{ icon }}</span>
    </div>
    <div class="flex items-end gap-2">
      <span class="text-3xl font-bold text-gray-900 leading-none">{{ displayValue }}</span>
      <span v-if="unit" class="text-sm text-gray-400 mb-0.5">{{ unit }}</span>
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  label: string
  value: number | string
  icon?: string
  unit?: string
  prefix?: string
}>()

const displayValue = computed(() => {
  if (props.prefix) return `${props.prefix}${props.value}`
  return props.value
})
</script>
