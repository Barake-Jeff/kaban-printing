<template>
  <div class="bg-white rounded-2xl border border-gray-100 overflow-hidden">
    <table class="w-full text-sm">
      <thead>
        <tr class="bg-gray-50 border-b border-gray-100 text-left">
          <th v-if="selectable" class="pl-4 pr-2 py-3 w-8">
            <input
              type="checkbox"
              :checked="allSelected"
              @change="$emit('select-all', !allSelected)"
              class="rounded accent-primary"
            />
          </th>
          <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">File / Job</th>
          <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400 hidden md:table-cell">Customer</th>
          <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400 hidden lg:table-cell">Pages</th>
          <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Status</th>
          <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400 hidden sm:table-cell">Payment</th>
          <th v-if="showWait" class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400 hidden md:table-cell">Waiting</th>
          <th class="px-4 py-3 w-10" />
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-50">
        <tr
          v-for="(job, i) in jobs"
          :key="job.id"
          @click="$emit('row-click', job)"
          :class="[
            'cursor-pointer transition-colors hover:bg-gray-50',
            selectedIds?.has(job.id) ? 'bg-blue-50/50' : '',
            focusedIndex === i ? 'ring-2 ring-inset ring-primary/30' : '',
          ]"
        >
          <td v-if="selectable" class="pl-4 pr-2 py-3" @click.stop>
            <input
              type="checkbox"
              :checked="selectedIds?.has(job.id)"
              @change="$emit('toggle-select', job.id)"
              class="rounded accent-primary"
            />
          </td>
          <td class="px-4 py-3">
            <p class="font-medium text-gray-900 truncate max-w-[180px]">{{ job.fileName ?? 'Walk-in' }}</p>
            <p class="text-xs text-gray-400 font-mono">{{ job.id.slice(0, 8) }}…</p>
          </td>
          <td class="px-4 py-3 hidden md:table-cell">
            <p class="text-gray-700">{{ job.customerName ?? '—' }}</p>
            <p class="text-xs text-gray-400">{{ job.houseNumber ? `House ${job.houseNumber}` : '' }}</p>
          </td>
          <td class="px-4 py-3 text-gray-600 hidden lg:table-cell">{{ job.pages }}p × {{ job.copies }}</td>
          <td class="px-4 py-3">
            <span :class="['px-2.5 py-1 rounded-full text-xs font-semibold', statusBadgeCls(job.status)]">
              {{ statusLabel(job.status) }}
            </span>
          </td>
          <td class="px-4 py-3 hidden sm:table-cell">
            <span :class="['px-2.5 py-1 rounded-full text-xs font-semibold', paymentBadgeCls(job.paymentStatus)]">
              {{ paymentLabel(job.paymentStatus) }}
            </span>
          </td>
          <td v-if="showWait" class="px-4 py-3 hidden md:table-cell">
            <span :class="['text-xs font-semibold', waitColor(job)]">{{ waitTime(job) }}</span>
          </td>
          <td class="px-4 py-3" @click.stop>
            <button
              v-if="nextStatus(job)"
              @click="$emit('quick-advance', job)"
              class="p-1 text-gray-400 hover:text-primary transition-colors"
              :title="`Advance to ${nextStatus(job)}`"
            >
              <span class="material-symbols-outlined" style="font-size:18px;">chevron_right</span>
            </button>
          </td>
        </tr>
        <tr v-if="jobs.length === 0">
          <td :colspan="colCount" class="px-5 py-10 text-center text-sm text-gray-400">
            <slot name="empty">No jobs found.</slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import type { Job } from '~/types'

const props = defineProps<{
  jobs: Job[]
  selectable?: boolean
  selectedIds?: Set<string>
  focusedIndex?: number
  showWait?: boolean
}>()

defineEmits<{
  'row-click': [job: Job]
  'toggle-select': [id: string]
  'select-all': [value: boolean]
  'quick-advance': [job: Job]
}>()

const colCount = computed(() => {
  let n = 5
  if (props.selectable) n++
  if (props.showWait) n++
  return n
})

const allSelected = computed(() =>
  props.jobs.length > 0 && props.jobs.every(j => props.selectedIds?.has(j.id))
)

const statusOrder: Job['status'][] = ['pending', 'printing', 'ready', 'delivered']

function nextStatus(job: Job): Job['status'] | null {
  const idx = statusOrder.indexOf(job.status)
  return idx >= 0 && idx < statusOrder.length - 1 ? statusOrder[idx + 1] : null
}

function statusLabel(s: string) {
  return { pending: 'Pending', printing: 'Printing', ready: 'Ready', delivered: 'Delivered' }[s] ?? s
}

function paymentLabel(s: string) {
  return { paid: 'Paid', unpaid: 'Unpaid', pay_on_pickup: 'On pickup' }[s] ?? s
}

function statusBadgeCls(s: string) {
  return {
    pending:   'bg-amber-100 text-amber-700',
    printing:  'bg-blue-100 text-blue-700',
    ready:     'bg-green-100 text-green-700',
    delivered: 'bg-gray-100 text-gray-600',
  }[s] ?? 'bg-gray-100 text-gray-600'
}

function paymentBadgeCls(s: string) {
  return {
    paid:           'bg-green-100 text-green-700',
    unpaid:         'bg-red-100 text-red-700',
    pay_on_pickup:  'bg-amber-100 text-amber-700',
  }[s] ?? 'bg-gray-100 text-gray-600'
}

function waitTime(job: Job): string {
  const mins = Math.floor((Date.now() - new Date(job.createdAt).getTime()) / 60000)
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function waitColor(job: Job): string {
  const mins = Math.floor((Date.now() - new Date(job.createdAt).getTime()) / 60000)
  if (mins >= 60) return 'text-red-600'
  if (mins >= 30) return 'text-amber-600'
  return 'text-gray-500'
}
</script>
