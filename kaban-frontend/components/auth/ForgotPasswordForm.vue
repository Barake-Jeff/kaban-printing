<template>
  <div :style="staff ? '--field-accent: #021745' : undefined">

    <!-- Sent -->
    <div v-if="sent" class="space-y-lg" role="status">
      <div class="bg-surface-container-low rounded-xl p-md space-y-sm text-center">
        <span class="material-symbols-outlined text-green-700 text-[40px]" aria-hidden="true">check_circle</span>
        <h2 :class="headingClass">Request sent</h2>
        <p :class="bodyClass">
          If that number is registered, our team will contact you to set a new password.
          You can also contact PrintEase support directly.
        </p>
      </div>

      <button type="button" :class="primaryBtnClass" @click="$emit('back')">
        Back to sign in
      </button>
    </div>

    <!-- Request form -->
    <form v-else class="space-y-lg" novalidate @submit.prevent="handleSubmit">
      <div class="bg-surface-container-low rounded-xl p-md space-y-md">

        <div class="space-y-xs">
          <h2 :class="headingClass">Forgot your password?</h2>
          <p :class="bodyClass">
            Enter the phone number on your account. Our team will contact you and set a new password.
          </p>
          <p v-if="staff" :class="bodyClass">
            Admin accounts can't be reset in the app — contact PrintEase support.
          </p>
        </div>

        <CommonTextField
          ref="phoneField"
          v-model="values.phone"
          label="Phone number"
          type="tel"
          placeholder="0712345678"
          autocomplete="username"
          inputmode="tel"
          enterkeyhint="send"
          autocapitalize="off"
          :label-class="labelClass"
          :error="errorFor('phone')"
          @blur="touch('phone')"
        />

        <CommonAlertBanner tone="error" :message="formError" />
      </div>

      <button
        type="submit"
        :disabled="submitting || disabled"
        :aria-busy="submitting"
        :class="primaryBtnClass"
      >
        <CommonSpinner v-if="submitting" size="sm" />
        {{ submitting ? 'Sending…' : 'Send request' }}
      </button>

      <button
        type="button"
        class="w-full text-center text-sm text-on-surface-variant hover:text-primary transition-colors"
        @click="$emit('back')"
      >
        ← Back to sign in
      </button>
    </form>

  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    /** 'staff' swaps in the navy accent and the sans styling used on /admin/login. */
    variant?: 'customer' | 'staff'
    /** Carries over a number already typed into the login form. */
    initialPhone?: string
    /** Set while offline, so we don't fire a request that can't leave the device. */
    disabled?: boolean
  }>(),
  { variant: 'customer', initialPhone: '', disabled: false },
)

defineEmits<{ back: [] }>()

const auth = useAuthStore()

const staff = computed(() => props.variant === 'staff')

const headingClass = computed(() =>
  staff.value ? 'font-bold text-primary' : 'font-headline-md text-headline-md text-primary',
)
const bodyClass = computed(() =>
  staff.value
    ? 'text-sm text-on-surface-variant'
    : 'font-body-sm text-body-sm text-on-surface-variant',
)
const labelClass = computed(() =>
  staff.value
    ? 'block text-sm font-semibold text-primary'
    : 'block font-label-bold text-label-bold text-primary font-normal',
)
const primaryBtnClass = computed(() => [
  'w-full h-12 bg-primary text-on-primary uppercase tracking-widest rounded-lg',
  'active:scale-[0.98] transition-all flex items-center justify-center gap-sm disabled:opacity-60',
  staff.value ? 'font-semibold' : 'font-label-bold text-label-bold',
])

const submitting = ref(false)
const sent       = ref(false)
const formError  = ref<string | null>(null)
const phoneField = ref<{ focus: () => void } | null>(null)

const { values, touch, errorFor, validateAll } = useFormValidation(
  { phone: props.initialPhone },
  { phone: [ruleRequired('phone number'), rulePhoneKe()] },
)

onMounted(() => {
  // Desktop only — on a phone this would pop the keyboard before the user has read anything.
  if (!window.matchMedia('(pointer: coarse)').matches) phoneField.value?.focus()
})

async function handleSubmit() {
  if (submitting.value || props.disabled) return

  formError.value = null
  if (!validateAll()) return

  submitting.value = true
  const result = await auth.requestPasswordReset(values.phone)
  submitting.value = false

  if (result.ok) {
    sent.value = true
    return
  }

  // The endpoint is throttled to 3 per 15 min; the raw envelope message is not user-facing.
  formError.value = result.status === 429
    ? 'Too many requests. Please wait a few minutes and try again.'
    : result.message
}
</script>
