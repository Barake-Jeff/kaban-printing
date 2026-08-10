export function useApi() {
  const config = useRuntimeConfig()

  return $fetch.create({
    baseURL: config.public.apiBase,
    onRequest({ options }) {
      const token = localStorage.getItem('accessToken')
      if (token) {
        options.headers = {
          ...(options.headers as Record<string, string>),
          Authorization: `Bearer ${token}`,
        }
      }
    },
    async onResponseError({ response }) {
      if (response.status === 401) {
        const refreshToken = localStorage.getItem('refreshToken')
        if (refreshToken) {
          try {
            const res = await $fetch<{ data: { accessToken: string } }>('/auth/refresh', {
              baseURL: config.public.apiBase,
              method: 'POST',
              body: { refreshToken },
            })
            localStorage.setItem('accessToken', res.data.accessToken)
          } catch {
            localStorage.removeItem('accessToken')
            localStorage.removeItem('refreshToken')
            localStorage.removeItem('user')
          }
        }
      }
    },
  })
}
