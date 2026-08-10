<template>
  <div class="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
    <div class="h-12 bg-gray-50 border-b border-gray-100 px-5 flex items-center gap-3">
      <div class="h-3 w-24 bg-gray-200 rounded" />
      <div class="h-3 w-16 bg-gray-200 rounded" />
    </div>
    <div class="divide-y divide-gray-50">
      <div
        v-for="i in rows"
        :key="i"
        class="px-5 py-3.5 flex items-center gap-4"
      >
        <div class="h-3 bg-gray-100 rounded flex-1" :style="`width:${30 + (i * 13) % 40}%`" />
        <div class="h-3 w-16 bg-gray-100 rounded" />
        <div class="h-5 w-20 bg-gray-100 rounded-full" />
        <div class="h-3 w-10 bg-gray-100 rounded" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { rows = 5 } = defineProps<{ rows?: number }>()
</script>
