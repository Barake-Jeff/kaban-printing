/**
 * Refresh tokens are single-use (the backend rotates them and treats a replayed one
 * as theft, revoking every session). So when several requests 401 at once — any page
 * that loads in parallel, right after the 1h access token expires — they must all
 * wait on ONE refresh call. Independent refreshes would replay the same token and
 * log the user out. Client-only: useApi is never used during SSR.
 */
let inflightRefresh: Promise<void> | null = null

async function refreshSession(baseURL: string): Promise<void> {
  const refreshToken = localStorage.getItem('refreshToken')
  if (!refreshToken) return

  try {
    const res = await $fetch<{ data: { accessToken: string; refreshToken: string } }>('/auth/refresh', {
      baseURL,
      method: 'POST',
      body: { refreshToken },
    })
    localStorage.setItem('accessToken', res.data.accessToken)
    localStorage.setItem('refreshToken', res.data.refreshToken)
  } catch {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
  }
}

export function useApi() {
  const config = useRuntimeConfig()

  return $fetch.create({
    baseURL: config.public.apiBase,
    onRequest({ options }) {
      const token = localStorage.getItem('accessToken')
      if (token) {
        options.headers.set('Authorization', `Bearer ${token}`)
      }
    },
    async onResponseError({ response }) {
      if (response.status === 401) {
        inflightRefresh ??= refreshSession(config.public.apiBase).finally(() => {
          inflightRefresh = null
        })
        await inflightRefresh
      }
    },
  })
}
