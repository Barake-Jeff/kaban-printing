import { defineStore } from 'pinia'
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import type { Job, AdminStats, Alert, Customer, StaffMember, SettingsState, ReportData } from '~/types'

export const useAdminStore = defineStore('admin', () => {
  // ── Core state ─────────────────────────────────────────────────────────────
  const jobs        = ref<Job[]>([])
  const stats       = ref<AdminStats>({ jobsToday: 0, pending: 0, completed: 0, revenueToday: 0 })
  const alerts      = ref<Alert[]>([])
  const customers   = ref<Customer[]>([])
  const loading     = ref(false)
  const selectedJob = ref<Job | null>(null)

  // ── New state ──────────────────────────────────────────────────────────────
  const staff      = ref<StaffMember[]>([])
  const settings   = ref<SettingsState | null>(null)
  const reportData = ref<ReportData | null>(null)
  const lastUpdated = ref<Date | null>(null)

  // ── Polling ────────────────────────────────────────────────────────────────
  let _pollTimer: ReturnType<typeof setInterval> | null = null

  function startPolling(intervalMs = 30_000) {
    stopPolling()
    _pollTimer = setInterval(async () => {
      await fetchQueue()
      await fetchStats()
      lastUpdated.value = new Date()
    }, intervalMs)
  }

  function stopPolling() {
    if (_pollTimer !== null) {
      clearInterval(_pollTimer)
      _pollTimer = null
    }
  }

  // ── Existing API-backed methods (already wired up) ─────────────────────────

  async function fetchQueue(status?: string) {
    loading.value = true
    try {
      const api = useApi()
      const params: Record<string, any> = { page: 1, size: 100 }
      if (status) params.status = status
      const res = await api<any>('/admin/jobs', { params })
      jobs.value = res.data?.jobs ?? []
      lastUpdated.value = new Date()
    } finally {
      loading.value = false
    }
  }

  async function fetchStats() {
    const api = useApi()
    const res = await api<any>('/admin/stats')
    stats.value = res.data
  }

  async function fetchCustomers() {
    const api = useApi()
    const res = await api<any>('/admin/customers')
    customers.value = res.data ?? []
  }

  async function updateJobStatus(jobId: string, status: Job['status']) {
    const api = useApi()
    const res = await api<any>(`/admin/jobs/${jobId}/status`, {
      method: 'PATCH',
      body:   { status },
    })
    const updated = res.data as Job
    const idx = jobs.value.findIndex(j => j.id === jobId)
    if (idx >= 0) jobs.value[idx] = updated
    if (selectedJob.value?.id === jobId) selectedJob.value = updated
    toast.success(`Status updated to ${status}`)
  }

  async function markAsPaid(jobId: string) {
    const api = useApi()
    await api(`/admin/jobs/${jobId}/payment`, { method: 'PATCH' })
    const job = jobs.value.find(j => j.id === jobId)
    if (job) { job.paymentStatus = 'paid'; (job as any).mpesaRef = null }
    if (selectedJob.value?.id === jobId) selectedJob.value!.paymentStatus = 'paid'
    alerts.value = alerts.value.filter(a => a.jobId !== jobId)
    toast.success('Marked as paid')
  }

  async function saveNotes(jobId: string, notes: string) {
    const api = useApi()
    await api(`/admin/jobs/${jobId}/notes`, { method: 'PATCH', body: { notes } })
    const job = jobs.value.find(j => j.id === jobId)
    if (job) job.adminNotes = notes
    toast.success('Notes saved')
  }

  async function cancelJob(jobId: string) {
    const api = useApi()
    await api(`/admin/jobs/${jobId}`, { method: 'DELETE' })
    jobs.value = jobs.value.filter(j => j.id !== jobId)
    if (selectedJob.value?.id === jobId) selectedJob.value = null
    toast.success('Job cancelled')
  }

  async function lookupCustomer(houseNumber: string): Promise<Customer | null> {
    try {
      const api = useApi()
      const res = await api<any>('/admin/customers/lookup', { params: { house: houseNumber } })
      return res.data as Customer
    } catch {
      return null
    }
  }

  // ── New composable-backed methods (dummy data, swappable later) ────────────

  async function fetchStaff() {
    const { fetchStaff: fetch } = useAdminStaff()
    staff.value = await fetch()
  }

  async function createStaff(payload: { name: string; phone: string; role: 'clerk' | 'admin'; password: string }) {
    const { createStaff: create } = useAdminStaff()
    const member = await create(payload)
    staff.value.push(member)
    toast.success(`${member.name} added as ${member.role}`)
  }

  async function deactivateStaff(id: string) {
    const { deactivateStaff: deactivate } = useAdminStaff()
    await deactivate(id)
    const m = staff.value.find(s => s.id === id)
    if (m) m.active = false
    toast.success('Staff member deactivated')
  }

  async function reactivateStaff(id: string) {
    const { reactivateStaff: reactivate } = useAdminStaff()
    await reactivate(id)
    const m = staff.value.find(s => s.id === id)
    if (m) m.active = true
    toast.success('Staff member reactivated')
  }

  async function fetchSettings() {
    const { fetchSettings: fetch } = useAdminSettings()
    settings.value = await fetch()
  }

  async function saveSettings(payload: Partial<SettingsState>) {
    const { saveSettings: save } = useAdminSettings()
    await save(payload)
    if (settings.value) Object.assign(settings.value, payload)
    toast.success('Settings saved')
  }

  async function fetchReportData() {
    const { fetchReportData: fetch } = useAdminReports()
    reportData.value = await fetch()
  }

  async function fetchJobFileUrl(jobId: string): Promise<string | null> {
    try {
      const api = useApi()
      const res = await api<any>(`/admin/jobs/${jobId}/file`)
      return res.data.url as string
    } catch {
      return null
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function selectJob(job: Job)   { selectedJob.value = job }
  function clearSelectedJob()    { selectedJob.value = null }

  return {
    // state
    jobs, stats, alerts, customers, loading, selectedJob,
    staff, settings, reportData, lastUpdated,
    // queue / stats / customers (real API)
    fetchQueue, fetchStats, fetchCustomers,
    updateJobStatus, markAsPaid, saveNotes, cancelJob,
    selectJob, clearSelectedJob, lookupCustomer, fetchJobFileUrl,
    // polling
    startPolling, stopPolling,
    // staff (composable-backed)
    fetchStaff, createStaff, deactivateStaff, reactivateStaff,
    // settings (composable-backed)
    fetchSettings, saveSettings,
    // reports (composable-backed)
    fetchReportData,
  }
})
