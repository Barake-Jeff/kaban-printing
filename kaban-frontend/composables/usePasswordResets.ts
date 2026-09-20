import type { PasswordResetRequest } from '~/types'

export function usePasswordResets() {
  /** Shared so the sidebar badge and the requests page never disagree. */
  const pendingCount = useState<number>('passwordRequestCount', () => 0)

  async function fetchRequests(): Promise<PasswordResetRequest[]> {
    const api = useApi()
    const res = await api<any>('/admin/password-reset-requests')
    const list = res.data as PasswordResetRequest[]
    pendingCount.value = list.length
    return list
  }

  /** For the sidebar badge: a failed poll must never surface as an error. */
  async function refreshPendingCount(): Promise<void> {
    try { await fetchRequests() } catch { /* badge simply stays stale */ }
  }

  async function dismissRequest(id: string): Promise<void> {
    const api = useApi()
    await api(`/admin/password-reset-requests/${id}/dismiss`, { method: 'PATCH' })
    pendingCount.value = Math.max(0, pendingCount.value - 1)
  }

  /** Backend also revokes the user's sessions and resolves any pending request. */
  async function setUserPassword(userId: string, newPassword: string): Promise<void> {
    const api = useApi()
    await api(`/admin/users/${userId}/password`, { method: 'PATCH', body: { newPassword } })
    void refreshPendingCount()
  }

  return { pendingCount, fetchRequests, refreshPendingCount, dismissRequest, setUserPassword }
}
