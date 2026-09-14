import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, LoginPayload, SignupPayload } from '~/types'

/** Actions return this so callers don't have to sniff `error` after awaiting. */
export type AuthResult =
  | { ok: true }
  | { ok: false; message: string; errors: string[]; status?: number }

/** Auth calls are short and interactive — never let one hang a spinner forever. */
const AUTH_TIMEOUT = 15_000

export const useAuthStore = defineStore('auth', () => {
  const config = useRuntimeConfig()
  const base   = config.public.apiBase

  // Stored in a cookie so SSR middleware can read it on page reload
  const user = useCookie<User | null>('auth_user', {
    maxAge:   30 * 24 * 60 * 60,
    sameSite: 'lax',
    default:  () => null,
  })

  // Retained (and still populated) for pages/admin/login.vue, which reads them
  // directly. New callers should prefer the returned AuthResult.
  const loading = ref(false)
  const error   = ref<string | null>(null)

  const isLoggedIn = computed(() => !!user.value)
  const isAdmin    = computed(() =>
    user.value?.role === 'admin' || user.value?.role === 'clerk',
  )

  function persistSession(res: any) {
    const { accessToken, refreshToken, user: userData } = res.data
    localStorage.setItem('accessToken', accessToken)
    localStorage.setItem('refreshToken', refreshToken)
    user.value = userData
  }

  function fail(e: any): AuthResult {
    const parsed = parseAuthError(e)
    error.value  = parsed.message
    return { ok: false, ...parsed }
  }

  async function login({ phone, password }: LoginPayload): Promise<AuthResult> {
    loading.value = true
    error.value   = null

    try {
      let res: any
      const body = { phone: normalizeKePhone(phone), password }

      try {
        res = await $fetch<any>('/auth/login', {
          baseURL: base, method: 'POST', body, timeout: AUTH_TIMEOUT,
        })
      } catch (e: any) {
        // Backend returns 403 when an admin/clerk hits the customer endpoint
        if (e?.response?.status === 403 || e?.data?.statusCode === 403) {
          res = await $fetch<any>('/admin/auth/login', {
            baseURL: base, method: 'POST', body, timeout: AUTH_TIMEOUT,
          })
        } else {
          throw e
        }
      }

      persistSession(res)
      schedulePushPrompt()
      return { ok: true }
    } catch (e: any) {
      return fail(e)
    } finally {
      loading.value = false
    }
  }

  async function signup(payload: SignupPayload): Promise<AuthResult> {
    loading.value = true
    error.value   = null

    try {
      const res = await $fetch<any>('/auth/register', {
        baseURL: base,
        method:  'POST',
        timeout: AUTH_TIMEOUT,
        // Fields are listed explicitly on purpose: the backend runs
        // forbidNonWhitelisted, so spreading `payload` would send `confirm`
        // and get a 400. Do not "simplify" this to { ...payload }.
        body: {
          name:        payload.name,
          phone:       normalizeKePhone(payload.phone),
          houseNumber: payload.houseNumber,
          estate:      payload.estate,
          password:    payload.password,
        },
      })

      persistSession(res)
      schedulePushPrompt()
      return { ok: true }
    } catch (e: any) {
      return fail(e)
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    const refreshToken = localStorage.getItem('refreshToken')
    const accessToken  = localStorage.getItem('accessToken')

    if (refreshToken && accessToken) {
      try {
        await $fetch('/auth/logout', {
          baseURL: base,
          method:  'POST',
          body:    { refreshToken },
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: AUTH_TIMEOUT,
        })
      } catch {}
    }

    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    user.value  = null
    error.value = null
  }

  function schedulePushPrompt() {
    if (!import.meta.client) return
    setTimeout(async () => {
      if (typeof Notification === 'undefined' || Notification.permission !== 'default') return
      const { isSupported, requestAndSubscribe } = usePushNotifications()
      if (isSupported.value) await requestAndSubscribe()
    }, 2000)
  }

  async function adminLogin({ phone, password }: LoginPayload): Promise<AuthResult> {
    loading.value = true
    error.value   = null

    try {
      const res = await $fetch<any>('/admin/auth/login', {
        baseURL: base,
        method:  'POST',
        body:    { phone: normalizeKePhone(phone), password },
        timeout: AUTH_TIMEOUT,
      })

      persistSession(res)
      schedulePushPrompt()
      return { ok: true }
    } catch (e: any) {
      return fail(e)
    } finally {
      loading.value = false
    }
  }

  return { user, loading, error, isLoggedIn, isAdmin, login, adminLogin, signup, logout }
})
