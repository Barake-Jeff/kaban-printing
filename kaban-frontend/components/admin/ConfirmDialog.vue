<template>
  <Transition name="overlay">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="$emit('update:modelValue', false)"
    >
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div class="flex items-start gap-3 mb-4">
          <span class="material-symbols-outlined text-red-500 mt-0.5" style="font-size:22px;">warning</span>
          <div>
            <h3 class="font-bold text-gray-900">{{ title }}</h3>
            <p v-if="description" class="text-sm text-gray-500 mt-1">{{ description }}</p>
          </div>
        </div>

        <div class="flex gap-3 justify-end">
          <button
            @click="$emit('update:modelValue', false)"
            class="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >Cancel</button>
          <button
            @click="() => { $emit('confirm'); $emit('update:modelValue', false) }"
            :class="[
              'px-4 py-2 text-sm font-semibold rounded-xl transition-all active:scale-[0.98]',
              danger ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-primary text-on-primary hover:opacity-90',
            ]"
          >{{ confirmLabel ?? 'Confirm' }}</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: boolean
  title: string
  description?: string
  confirmLabel?: string
  danger?: boolean
}>()

defineEmits<{
  'update:modelValue': [value: boolean]
  'confirm': []
}>()
</script>

<style scoped>
.overlay-enter-active, .overlay-leave-active { transition: opacity 0.18s ease; }
.overlay-enter-from, .overlay-leave-to { opacity: 0; }
</style>
