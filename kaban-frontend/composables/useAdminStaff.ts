import type { StaffMember } from '~/types'

export function useAdminStaff() {
  async function fetchStaff(): Promise<StaffMember[]> {
    const api = useApi()
    const res = await api<any>('/admin/staff')
    return res.data as StaffMember[]
  }

  async function createStaff(payload: { name: string; phone: string; role: 'clerk' | 'admin'; password: string }): Promise<StaffMember> {
    const api = useApi()
    const res = await api<any>('/admin/staff', { method: 'POST', body: payload })
    return res.data as StaffMember
  }

  async function deactivateStaff(id: string): Promise<void> {
    const api = useApi()
    await api(`/admin/staff/${id}/deactivate`, { method: 'PATCH' })
  }

  async function reactivateStaff(id: string): Promise<void> {
    const api = useApi()
    await api(`/admin/staff/${id}/reactivate`, { method: 'PATCH' })
  }

  return { fetchStaff, createStaff, deactivateStaff, reactivateStaff }
}
