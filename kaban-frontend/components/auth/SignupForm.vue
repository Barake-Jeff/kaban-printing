<template>
  <form class="space-y-lg" novalidate @submit.prevent="handleSignup">

    <div class="bg-surface-container-low rounded-xl p-md space-y-md">

      <CommonTextField
        ref="nameField"
        v-model="values.name"
        label="Full name"
        placeholder="Enter your legal name"
        autocomplete="name"
        autocapitalize="words"
        enterkeyhint="next"
        :maxlength="255"
        :error="errorFor('name')"
        @blur="touch('name')"
      />

      <CommonTextField
        v-model="values.phone"
        label="Phone number"
        type="tel"
        placeholder="0712345678"
        autocomplete="username"
        inputmode="tel"
        enterkeyhint="next"
        autocapitalize="off"
        trailing-icon="call"
        :error="errorFor('phone')"
        @blur="handlePhoneBlur"
      />

      <div class="grid grid-cols-2 gap-md items-start">
        <CommonTextField
          v-model="values.houseNumber"
          label="House number"
          placeholder="e.g. 14B"
          autocomplete="address-line2"
          autocapitalize="characters"
          enterkeyhint="next"
          :maxlength="20"
          :error="errorFor('houseNumber')"
          @blur="touch('houseNumber')"
        />
        <CommonTextField
          v-model="values.estate"
          label="Estate/Street"
          placeholder="Street Name"
          autocomplete="address-line1"
          enterkeyhint="next"
          :maxlength="255"
          :error="errorFor('estate')"
          @blur="touch('estate')"
        />
      </div>

      <p class="italic text-on-surface-variant font-body-sm text-body-sm font-normal">
        Your house number is how we identify your orders.
      </p>

      <CommonTextField
        v-model="values.password"
        label="Password"
        placeholder="Minimum 8 characters"
        autocomplete="new-password"
        enterkeyhint="next"
        revealable
        hint="At least 8 characters"
        :hint-satisfied="values.password.length >= 8"
        :error="errorFor('password')"
        @blur="touch('password')"
      />

      <CommonTextField
        v-model="values.confirm"
        label="Confirm password"
        placeholder="Repeat password"
        autocomplete="new-password"
        enterkeyhint="go"
        revealable
        :error="errorFor('confirm')"
        @blur="touch('confirm')"
      />

      <CommonAlertBanner tone="error" :messages="formErrors">
        <template v-if="showLoginNudge" #action>
          <button
            type="button"
            class="font-label-bold text-label-bold underline mt-xs"
            @click="$emit('switch-tab', { tab: 'login', phone: values.phone })"
          >
            Log in instead →
          </button>
        </template>
      </CommonAlertBanner>

    </div>

    <button
      type="submit"
      :disabled="submitting || disabled"
      :aria-busy="submitting"
      class="w-full h-12 bg-secondary-container text-on-primary font-label-bold text-label-bold uppercase tracking-widest rounded-lg active:scale-[0.98] transition-all flex items-center justify-center gap-sm disabled:opacity-60"
    >
      <CommonSpinner v-if="submitting" size="sm" />
      {{ submitting ? 'Creating account…' : 'Create account' }}
    </button>

  </form>
</template>

<script setup lang="ts">
import { toast } from 'vue-sonner'

const props = withDefaults(
  defineProps<{
    initialPhone?: string
    disabled?: boolean
  }>(),
  { initialPhone: '', disabled: false },
)

defineEmits<{
  'switch-tab': [{ tab: 'login'; phone: string }]
}>()

const auth   = useAuthStore()
const router = useRouter()

const submitting = ref(false)
const formErrors = ref<string[]>([])
const lastStatus = ref<number | undefined>()
const nameField  = ref<{ focus: () => void } | null>(null)

const FIELDS = ['name', 'phone', 'houseNumber', 'estate', 'password', 'confirm']

// Rules mirror CustomerRegisterDto exactly.
const { values, touch, errorFor, validateAll, setServerErrors, firstInvalidKey } =
  useFormValidation(
    {
      name: '', phone: props.initialPhone, houseNumber: '',
      estate: '', password: '', confirm: '',
    },
    {
      name:        [ruleRequired('full name'), ruleMaxLength(255, 'Name')],
      phone:       [ruleRequired('phone number'), rulePhoneKe()],
      houseNumber: [ruleRequired('house number'), ruleMaxLength(20, 'House number')],
      estate:      [ruleRequired('estate or street'), ruleMaxLength(255, 'Estate')],
      password:    [ruleRequired('password'), rulePasswordMin(), rulePasswordMax()],
      confirm:     [ruleMatches('password', 'Passwords do not match.')],
    },
  )

/** 409 = phone already registered; the account exists, so send them to login. */
const showLoginNudge = computed(() => lastStatus.value === 409)

onMounted(() => {
  if (!window.matchMedia('(pointer: coarse)').matches) nameField.value?.focus()
})

/**
 * Normalize on blur rather than on input: rewriting the value mid-typing jumps
 * the caret and fights Android autofill.
 */
function handlePhoneBlur() {
  if (values.phone) values.phone = normalizeKePhone(values.phone)
  touch('phone')
}

async function handleSignup() {
  if (submitting.value || props.disabled) return

  formErrors.value = []
  lastStatus.value = undefined

  if (!validateAll()) {
    await nextTick()
    if (firstInvalidKey() === 'name') nameField.value?.focus()
    return
  }

  submitting.value = true
  const result = await auth.signup({ ...values })
  submitting.value = false

  if (result.ok) {
    toast.success('Account created — welcome to PrintEase!', { position: 'top-center' })
    router.push({ name: 'app' })
    return
  }

  lastStatus.value = result.status

  const { byField, unmatched } = mapServerErrors(result.errors, FIELDS)
  setServerErrors(byField)
  formErrors.value = unmatched.length ? unmatched : Object.keys(byField).length ? [] : [result.message]
}
</script>
