import type { SettingsState } from '~/types'

export function useAdminSettings() {
  async function fetchSettings(): Promise<SettingsState> {
    const api = useApi()
    const res = await api<any>('/admin/settings')
    return res.data as SettingsState
  }

  async function saveSettings(payload: Partial<SettingsState>): Promise<void> {
    const api = useApi()
    await api('/admin/settings', { method: 'PATCH', body: payload })
  }

  return { fetchSettings, saveSettings }
}
