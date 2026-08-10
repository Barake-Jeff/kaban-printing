export default defineNuxtRouteMiddleware(() => {
  const auth = useAuthStore()
  if (!auth.isLoggedIn) return navigateTo('/auth')
  const role = auth.user?.role
  if (role === 'admin') return navigateTo('/admin')
  if (role === 'clerk') return navigateTo('/admin/queue')
  return navigateTo('/app')
})
