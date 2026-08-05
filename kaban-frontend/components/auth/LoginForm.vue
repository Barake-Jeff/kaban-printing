<template>
  <form class="space-y-lg" novalidate @submit.prevent="handleLogin">

    <div class="bg-surface-container-low rounded-xl p-md space-y-md">

      <CommonTextField
        ref="phoneField"
        v-model="values.phone"
        label="Phone number"
        type="tel"
        placeholder="0712345678"
        autocomplete="username"
        inputmode="tel"
        enterkeyhint="next"
        autocapitalize="off"
        :error="errorFor('phone')"
        @blur="touch('phone')"
      />

      <CommonTextField
        v-model="values.password"
        label="Password"
        placeholder="••••••••"
        autocomplete="current-password"
        enterkeyhint="go"
        revealable
        :error="errorFor('password')"
        @blur="touch('password')"
      />

      <div class="text-right">
        <a href="#" class="font-label-bold text-label-bold text-secondary">Forgot Password?</a>
      </div>

      <CommonAlertBanner tone="error" :messages="formErrors">
        <template v-if="showSignupNudge" #action>
          <button
            type="button"
            class="font-label-bold text-label-bold underline mt-xs"
            @click="$emit('switch-tab', { tab: 'signup', phone: values.phone })"
          >
            New here? Create an account →
          </button>
        </template>
      </CommonAlertBanner>

    </div>

    <button
      type="submit"
      :disabled="submitting || disabled"
      :aria-busy="submitting"
      class="w-full h-12 bg-primary text-on-primary font-label-bold text-label-bold uppercase tracking-widest rounded-lg active:scale-[0.98] transition-all flex items-center justify-center gap-sm disabled:opacity-60"
    >
      <CommonSpinner v-if="submitting" size="sm" />
      {{ submitting ? 'Logging in…' : 'Login' }}
    </button>

  </form>
</template>

<script setup lang="ts">
import { toast } from 'vue-sonner'

const props = withDefaults(
  defineProps<{
    /** Seeded when the user is handed over from the signup tab. */
    initialPhone?: string
    /** Set while offline, so we don't fire a request that can't leave the device. */
    disabled?: boolean
  }>(),
  { initialPhone: '', disabled: false },
)

defineEmits<{
  'switch-tab': [{ tab: 'signup'; phone: string }]
}>()

const auth   = useAuthStore()
const router = useRouter()

const submitting = ref(false)
const formErrors = ref<string[]>([])
const lastStatus = ref<number | undefined>()
const phoneField = ref<{ focus: () => void } | null>(null)

// Required-only. Deliberately NO Kenyan-format rule here: CustomerLoginDto has no
// @Matches, and a client-side gate could lock out legacy or staff accounts whose
// stored number predates the current format.
const { values, touch, errorFor, validateAll, setServerErrors, firstInvalidKey } =
  useFormValidation(
    { phone: props.initialPhone, password: '' },
    {
      phone:    [ruleRequired('phone number')],
      password: [ruleRequired('password')],
    },
  )

/** A 401 means the account may simply not exist yet — offer the way forward. */
const showSignupNudge = computed(() => lastStatus.value === 401)

onMounted(() => {
  // Autofocus on desktop only: on a phone it pops the keyboard on load, collapsing
  // the viewport and scrolling the tabs away before the user has oriented.
  if (!window.matchMedia('(pointer: coarse)').matches && !values.phone) {
    phoneField.value?.focus()
  }
})

async function handleLogin() {
  if (submitting.value || props.disabled) return

  formErrors.value = []
  lastStatus.value = undefined

  if (!validateAll()) return

  submitting.value = true
  const result = await auth.login({ phone: values.phone, password: values.password })
  submitting.value = false

  if (result.ok) {
    const firstName = auth.user?.name?.split(' ')[0]
    toast.success(firstName ? `Welcome back, ${firstName}` : 'Welcome back', {
      position: 'top-center',
    })

    const role = auth.user?.role
    if (role === 'admin') router.push({ name: 'admin' })
    else if (role === 'clerk') router.push({ name: 'admin-queue' })
    else router.push({ name: 'app' })
    return
  }

  lastStatus.value = result.status

  const { byField, unmatched } = mapServerErrors(result.errors, ['phone', 'password'])
  setServerErrors(byField)
  formErrors.value = unmatched.length ? unmatched : Object.keys(byField).length ? [] : [result.message]

  await nextTick()
  const invalid = firstInvalidKey()
  if (invalid === 'phone') phoneField.value?.focus()
}
</script>
