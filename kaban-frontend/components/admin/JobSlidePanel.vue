<template>
  <!-- Overlay -->
  <Transition name="overlay">
    <div
      v-if="job"
      class="fixed inset-0 z-40 bg-black/30"
      @click="$emit('close')"
    />
  </Transition>

  <!-- Slide panel -->
  <Transition name="slide" appear>
    <div
      v-if="job"
      class="fixed top-0 right-0 h-full z-50 w-full max-w-md bg-white shadow-2xl flex flex-col overflow-y-auto"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
        <div>
          <p class="text-xs text-gray-400 font-mono">{{ job.id.slice(0, 8) }}…</p>
          <h2 class="font-bold text-gray-900 mt-0.5">{{ job.fileName ?? 'Walk-in job' }}</h2>
          <div v-if="job.fileName" class="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
            <button
              @click="downloadFile('original')"
              :disabled="downloading"
              class="flex items-center gap-1 text-xs text-primary hover:text-primary/70 font-medium transition-colors disabled:opacity-50"
            >
              <span class="material-symbols-outlined" style="font-size:16px;">download</span>
              {{ downloading ? 'Getting link…' : isWordJob ? `Download original (.${job.fileType})` : 'Download file' }}
            </button>
            <!-- Word jobs: the PDF is what the customer previewed and was quoted from -->
            <button
              v-if="isWordJob"
              @click="downloadFile('pdf')"
              :disabled="downloading"
              class="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 font-medium transition-colors disabled:opacity-50"
            >
              <span class="material-symbols-outlined" style="font-size:16px;">picture_as_pdf</span>
              Download PDF preview
            </button>
          </div>
        </div>
        <button @click="$emit('close')" class="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <span class="material-symbols-outlined text-gray-500">close</span>
        </button>
      </div>

      <!-- Body -->
      <div class="flex-1 px-5 py-4 space-y-5">

        <!-- Cancelled: the job stays on record, read-only -->
        <div v-if="isCancelled" class="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          <p class="font-semibold">Cancelled{{ cancelledOn ? ` on ${cancelledOn}` : '' }}</p>
          <p v-if="job.paymentStatus === 'paid'" class="mt-1 text-xs">
            This job was paid. Refund the customer manually.
          </p>
        </div>

        <!-- Customer -->
        <section>
          <p class="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Customer</p>
          <div class="bg-gray-50 rounded-xl p-3 space-y-1">
            <p class="font-semibold text-gray-900">{{ job.customerName ?? 'Unknown' }}</p>
            <p class="text-sm text-gray-500">{{ job.houseNumber ? `House ${job.houseNumber}` : '' }}  {{ job.phone ?? '' }}</p>
          </div>
        </section>

        <!-- Job Details -->
        <section>
          <p class="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Job details</p>
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div class="bg-gray-50 rounded-xl p-3">
              <p class="text-xs text-gray-400">Pages</p>
              <p class="font-semibold text-gray-900">
                {{ job.pageSelection ? `${job.pages} of ${job.totalPages}` : job.pages }}
              </p>
            </div>
            <div class="bg-gray-50 rounded-xl p-3">
              <p class="text-xs text-gray-400">Copies</p>
              <p class="font-semibold text-gray-900">{{ job.copies }}</p>
            </div>
            <div class="bg-gray-50 rounded-xl p-3">
              <p class="text-xs text-gray-400">Colour</p>
              <p class="font-semibold text-gray-900 capitalize">{{ job.colorMode === 'bw' ? 'B&W' : 'Colour' }}</p>
            </div>
            <div class="bg-gray-50 rounded-xl p-3">
              <p class="text-xs text-gray-400">Sides</p>
              <p class="font-semibold text-gray-900 capitalize">{{ job.sides }}</p>
            </div>
          </div>
          <div
            v-if="job.pageSelection"
            class="mt-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800"
          >
            <span class="font-semibold">Print only pages:</span> {{ job.pageSelection }}
            <p v-if="isWordJob" class="mt-1 text-xs text-amber-700">
              These pages were chosen from the PDF preview. Word's page breaks may differ, so use the PDF preview to match them.
            </p>
          </div>
        </section>

        <!-- Payment -->
        <section>
          <p class="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Payment</p>
          <div class="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">Total</p>
              <p class="font-bold text-gray-900 text-lg">KES {{ (job.cost ?? 0) + (job.deliveryFee ?? 0) }}</p>
            </div>
            <span :class="['px-3 py-1 rounded-full text-xs font-semibold', paymentBadgeCls]">
              {{ job.paymentStatus === 'paid' ? 'Paid' : job.paymentStatus === 'pay_on_pickup' ? 'Pay on pickup' : 'Unpaid' }}
            </span>
          </div>
          <button
            v-if="job.paymentStatus !== 'paid' && !isCancelled"
            @click="$emit('mark-paid', job.id)"
            class="mt-2 w-full py-2 text-sm font-semibold text-green-700 bg-green-50 hover:bg-green-100 rounded-xl transition-colors"
          >Mark as paid</button>
        </section>

        <!-- Status (a cancelled job can't be moved through the workflow any more) -->
        <section v-if="!isCancelled">
          <p class="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Status</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="s in statusOptions"
              :key="s"
              @click="onStatusClick(s)"
              :class="[
                'px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border',
                job.status === s
                  ? statusActiveCls(s)
                  : 'border-gray-200 text-gray-500 hover:bg-gray-50',
              ]"
            >{{ statusLabel(s) }}</button>
          </div>
        </section>

        <!-- Notes -->
        <section>
          <p class="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Admin notes</p>
          <textarea
            :value="job.adminNotes ?? ''"
            @blur="(e) => $emit('save-notes', job!.id, (e.target as HTMLTextAreaElement).value)"
            placeholder="Add notes about this job…"
            rows="3"
            class="w-full text-sm border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </section>
      </div>

      <!-- Footer -->
      <div v-if="canCancel" class="sticky bottom-0 bg-white border-t border-gray-100 px-5 pt-4 pb-6 flex items-center gap-3">
        <button
          v-if="nextStatus"
          @click="$emit('update-status', job.id, nextStatus)"
          class="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.98]"
          style="background-color: #021745;"
        >Advance → {{ statusLabel(nextStatus) }}</button>
        <button
          @click="cancelConfirmOpen = true"
          class="px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 rounded-xl transition-colors font-medium"
        >Cancel job</button>
      </div>
    </div>
  </Transition>

  <AdminConfirmDialog
    v-model="cancelConfirmOpen"
    title="Cancel this job?"
    :description="job?.paymentStatus === 'paid'
      ? 'The job stays on record, marked Cancelled. It was already paid, so remember to refund the customer.'
      : 'The job stays on record, marked Cancelled. This can\'t be undone.'"
    confirm-label="Cancel job"
    cancel-label="Keep job"
    :danger="true"
    @confirm="job && $emit('cancel', job.id)"
  />

  <AdminConfirmDialog
    v-model="revertConfirmOpen"
    title="Revert job status?"
    :description="revertTarget ? `This will move the job back to '${statusLabel(revertTarget)}'. Make sure this isn't accidental.` : ''"
    confirm-label="Revert"
    :danger="true"
    @confirm="confirmRevert"
  />
</template>

<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { Job } from '~/types'

const props = defineProps<{ job: Job | null }>()

const admin = useAdminStore()
const downloading = ref(false)

// Word jobs keep two files: the customer's original (what staff print) and the converted PDF
// (what the customer previewed and was quoted from).
const isWordJob = computed(() => ['doc', 'docx'].includes(props.job?.fileType ?? ''))

async function downloadFile(kind: 'original' | 'pdf' = 'original') {
  if (!props.job?.id) return
  downloading.value = true
  const files = await admin.fetchJobFiles(props.job.id)
  downloading.value = false
  const url = kind === 'pdf' ? files?.pdfUrl : files?.url
  if (url) window.open(url, '_blank')
  else toast.error('Could not get download link')
}
const emit = defineEmits<{
  'close': []
  'update-status': [jobId: string, status: Job['status']]
  'mark-paid': [jobId: string]
  'save-notes': [jobId: string, notes: string]
  'cancel': [jobId: string]
}>()

const statusOptions: Job['status'][] = ['pending', 'printing', 'ready', 'delivered']

const statusOrder: Job['status'][] = ['pending', 'printing', 'ready', 'delivered']

const nextStatus = computed<Job['status'] | null>(() => {
  if (!props.job) return null
  const idx = statusOrder.indexOf(props.job.status)
  return idx >= 0 && idx < statusOrder.length - 1 ? statusOrder[idx + 1] : null
})

const revertConfirmOpen = ref(false)
const revertTarget = ref<Job['status'] | null>(null)

// Only pending, printing and ready jobs can be cancelled (the server enforces the same rule).
const cancelConfirmOpen = ref(false)
const isCancelled = computed(() => props.job?.status === 'cancelled')
const canCancel = computed(() => !!props.job && ['pending', 'printing', 'ready'].includes(props.job.status))
const cancelledOn = computed(() =>
  props.job?.cancelledAt
    ? new Date(props.job.cancelledAt).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })
    : '',
)

function onStatusClick(s: Job['status']) {
  if (!props.job || s === props.job.status) return
  const isRevert = statusOrder.indexOf(s) < statusOrder.indexOf(props.job.status)
  if (isRevert) {
    revertTarget.value = s
    revertConfirmOpen.value = true
  } else {
    emit('update-status', props.job.id, s)
  }
}

function confirmRevert() {
  if (props.job && revertTarget.value) emit('update-status', props.job.id, revertTarget.value)
  revertTarget.value = null
}

function statusLabel(s: Job['status']) {
  return { pending: 'Pending', printing: 'Printing', ready: 'Ready', delivered: 'Delivered', cancelled: 'Cancelled' }[s]
}

function statusActiveCls(s: Job['status']) {
  return {
    pending:   'border-amber-400 bg-amber-50 text-amber-700',
    printing:  'border-blue-400 bg-blue-50 text-blue-700',
    ready:     'border-green-400 bg-green-50 text-green-700',
    delivered: 'border-gray-400 bg-gray-100 text-gray-700',
    cancelled: 'border-red-300 bg-red-50 text-red-600',
  }[s]
}

const paymentBadgeCls = computed(() => {
  if (!props.job) return ''
  return {
    paid:           'bg-green-100 text-green-700',
    unpaid:         'bg-red-100 text-red-700',
    pay_on_pickup:  'bg-amber-100 text-amber-700',
  }[props.job.paymentStatus] ?? 'bg-gray-100 text-gray-600'
})
</script>

<style scoped>
.overlay-enter-active, .overlay-leave-active { transition: opacity 0.2s ease; }
.overlay-enter-from, .overlay-leave-to { opacity: 0; }
.slide-enter-active, .slide-leave-active { transition: transform 0.28s cubic-bezier(0.4,0,0.2,1); }
.slide-enter-from, .slide-leave-to { transform: translateX(100%); }
</style>
