import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUsersStore = defineStore('users', () => {
  const auth    = useAuthStore()
  const loading = ref(false)

  async function updateProfile(payload: Record<string, any>) {
    loading.value = true
    try {
      const api = useApi()
      const res = await api<any>('/users/me', { method: 'PATCH', body: payload })
      if (auth.user) auth.user = { ...auth.user, ...res.data }
    } finally {
      loading.value = false
    }
  }

  async function updateNotifPrefs({ notifSms, notifWhatsapp }: { notifSms: boolean; notifWhatsapp: boolean }) {
    loading.value = true
    try {
      const api = useApi()
      await api('/users/me/notifications', { method: 'PATCH', body: { notifSms, notifWhatsapp } })
      if (auth.user) auth.user = { ...auth.user, notifSms, notifWhatsapp }
    } finally {
      loading.value = false
    }
  }

  async function changePassword(payload: { currentPassword: string; newPassword: string }) {
    loading.value = true
    try {
      const api = useApi()
      await api('/users/me/change-password', { method: 'POST', body: payload })
      return { success: true }
    } finally {
      loading.value = false
    }
  }

  return { loading, updateProfile, updateNotifPrefs, changePassword }
})
