import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Job, Pricing, SubmitJobPayload } from '~/types'

export const useJobsStore = defineStore('jobs', () => {
  const jobs      = ref<Job[]>([])
  const loading   = ref(false)
  const activeJob = ref<Job | null>(null)
  const error     = ref<string | null>(null)
  // Admin-configured, fetched once and reused — see GET /jobs/pricing.
  const pricing   = ref<Pricing | null>(null)

  const activeJobs = computed(() =>
    jobs.value.filter(j => ['pending', 'printing', 'ready'].includes(j.status))
  )

  const jobsThisMonth = computed(() => {
    const now = new Date()
    return jobs.value.filter(j => {
      const d = new Date(j.createdAt)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length
  })

  const totalSpent = computed(() =>
    jobs.value.reduce((sum, j) => sum + (j.paymentStatus === 'paid' ? (j.cost + j.deliveryFee) : 0), 0)
  )

  async function fetchMyJobs() {
    loading.value = true
    error.value   = null
    try {
      const api = useApi()
      const res = await api<any>('/jobs/my-jobs', { params: { page: 1, size: 50 } })
      jobs.value = res.data?.jobs ?? []
    } catch (e: any) {
      error.value = e?.data?.message ?? 'Failed to load jobs'
    } finally {
      loading.value = false
    }
  }

  /**
   * Always hits the network — Pinia state survives client-side navigation, and
   * an admin can change pricing mid-session, so a "fetch once" cache would keep
   * showing a stale value until a full page reload.
   */
  async function fetchPricing(): Promise<void> {
    const api = useApi()
    const res = await api<any>('/jobs/pricing')
    pricing.value = res.data
  }

  async function fetchPage(page: number, size = 10): Promise<Job[]> {
    const api = useApi()
    const res = await api<any>('/jobs/my-jobs', { params: { page, size } })
    return res.data?.jobs ?? []
  }

  /**
   * Fetches a single job by id — needed whenever a job detail page is opened
   * directly or reloaded, since Pinia state (jobs/activeJob) doesn't survive a
   * full page refresh and there's otherwise nothing in the store to show.
   * Returns null on a 404 (not found, or belongs to someone else) rather than
   * throwing, so callers can render a clean "not found" state.
   */
  async function fetchOne(id: string): Promise<Job | null> {
    try {
      const api = useApi()
      const res = await api<any>(`/jobs/${id}`)
      const job = res.data as Job

      const idx = jobs.value.findIndex(j => j.id === id)
      if (idx >= 0) jobs.value[idx] = job
      else jobs.value.unshift(job)
      activeJob.value = job

      return job
    } catch {
      return null
    }
  }

  async function submitJob(payload: SubmitJobPayload): Promise<Job> {
    loading.value = true
    error.value   = null
    try {
      const api = useApi()
      const body: Record<string, any> = {
        pages:        payload.pages,
        copies:       payload.copies,
        colorMode:    payload.colorMode,
        sides:        payload.sides,
        paperSize:    payload.paperSize ?? 'A4',
        deliveryType: payload.deliveryType,
        paymentMethod: payload.paymentMethod ?? 'mpesa',
      }
      if (payload.fileId) {
        body.fileId = payload.fileId
        if (payload.pageSelection?.trim()) body.pageSelection = payload.pageSelection.trim()
      } else if ((payload as any).instructions?.trim()) {
        body.instructions = (payload as any).instructions
      }
      if (payload.fileName) body.fileName = payload.fileName

      const res = await api<any>('/jobs', { method: 'POST', body })
      const job = res.data as Job
      jobs.value.unshift(job)
      activeJob.value = job
      return job
    } finally {
      loading.value = false
    }
  }

  async function initiateMpesa(jobId: string | undefined): Promise<{ success: boolean }> {
    if (!jobId) return { success: false }
    loading.value = true
    error.value   = null
    try {
      const auth = useAuthStore()
      const api  = useApi()

      await api('/payments/mpesa/initiate', {
        method: 'POST',
        body:   { jobId, phone: auth.user?.phone },
      })

      // Poll for payment confirmation (backend auto-confirms in ~5s for stub)
      const MAX_POLLS = 30
      for (let i = 0; i < MAX_POLLS; i++) {
        await delay(2000)
        const statusRes = await api<any>(`/payments/status/${jobId}`)
        const payStatus = statusRes.data?.paymentStatus

        if (payStatus === 'paid') {
          // Refresh the job
          const jobRes = await api<any>(`/jobs/${jobId}`)
          const updated = jobRes.data as Job
          const idx = jobs.value.findIndex(j => j.id === jobId)
          if (idx >= 0) jobs.value[idx] = updated
          if (activeJob.value?.id === jobId) activeJob.value = updated
          return { success: true }
        }
        if (payStatus === 'failed') return { success: false }
      }
      return { success: false }
    } catch (e: any) {
      error.value = e?.data?.message ?? 'Payment failed'
      return { success: false }
    } finally {
      loading.value = false
    }
  }

  function setActiveJob(job: Job) { activeJob.value = job }

  return {
    jobs, loading, activeJob, error, pricing,
    activeJobs, jobsThisMonth, totalSpent,
    fetchMyJobs, fetchPage, fetchOne, fetchPricing, submitJob, initiateMpesa, setActiveJob,
  }
})

function delay(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)) }
