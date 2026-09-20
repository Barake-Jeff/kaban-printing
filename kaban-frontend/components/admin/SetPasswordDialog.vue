<template>
  <Transition name="overlay">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="onBackdrop"
    >
      <div
        class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
      >

        <!-- Step 1: choose a password -->
        <form v-if="!done" class="space-y-4" novalidate @submit.prevent="submit">
          <div>
            <h3 :id="titleId" class="font-bold text-gray-900">Set new password</h3>
            <p class="text-sm text-gray-500 mt-1">for {{ target?.name }} · {{ target?.phone }}</p>
          </div>

          <div>
            <label :for="inputId" class="block text-xs font-semibold text-gray-500 mb-1.5">New password</label>
            <div class="flex gap-2">
              <!-- Plain text on purpose: the admin has to read this out to the user. -->
              <input
                :id="inputId"
                ref="inputEl"
                v-model="password"
                type="text"
                class="input-field flex-1 font-mono"
                autocomplete="off"
                autocapitalize="off"
                spellcheck="false"
                :aria-invalid="fieldError ? 'true' : undefined"
              />
              <button type="button" class="ghost-btn flex-shrink-0" @click="generate">Generate</button>
            </div>
            <p v-if="fieldError" class="text-xs text-red-600 mt-1.5" aria-live="polite">{{ fieldError }}</p>
            <p v-else class="text-xs text-gray-400 mt-1.5">
              8+ characters with at least one letter and one number.
            </p>
          </div>

          <CommonAlertBanner tone="error" :message="serverError" />

          <div class="flex gap-3 pt-1">
            <button type="button" class="flex-1 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-xl transition-colors" @click="close">
              Cancel
            </button>
            <button type="submit" :disabled="saving" class="flex-1 primary-btn disabled:opacity-50">
              {{ saving ? 'Saving…' : 'Set password' }}
            </button>
          </div>
        </form>

        <!-- Step 2: hand it over. Shown once — the backend only stores a hash. -->
        <div v-else class="space-y-4">
          <div class="flex items-start gap-3">
            <span class="material-symbols-outlined text-green-600 mt-0.5" style="font-size:22px;">check_circle</span>
            <div>
              <h3 :id="titleId" class="font-bold text-gray-900">Password updated</h3>
              <p class="text-sm text-gray-500 mt-1">
                Share it with {{ target?.name }} directly. They've been signed out on all devices
                and can change it under Profile after signing in.
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
            <code class="flex-1 font-mono text-sm text-gray-900 break-all select-all">{{ password }}</code>
            <button type="button" class="ghost-btn flex-shrink-0" @click="copy">Copy</button>
          </div>

          <p class="text-xs text-gray-400">This won't be shown again once you close this window.</p>

          <button type="button" class="w-full primary-btn" @click="close">Done</button>
        </div>

      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { toast } from 'vue-sonner'

export interface PasswordTarget {
  id: string
  name: string
  phone: string
}

const props = defineProps<{
  modelValue: boolean
  target: PasswordTarget | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  /** Fired as soon as the backend accepts the change, before the dialog closes. */
  saved: [userId: string]
}>()

const { setUserPassword } = usePasswordResets()

const titleId = useId()
const inputId = useId()
const inputEl = ref<HTMLInputElement | null>(null)

const password    = ref('')
const done        = ref(false)
const saving      = ref(false)
const fieldError  = ref<string | null>(null)
const serverError = ref<string | null>(null)

// Fresh state every time the dialog opens, so a previous password never lingers.
watch(() => props.modelValue, async (open) => {
  if (!open) return
  password.value    = ''
  done.value        = false
  saving.value      = false
  fieldError.value  = null
  serverError.value = null
  await nextTick()
  inputEl.value?.focus()
})

function validate(value: string): string | null {
  return rulePasswordMin()(value, {}) ?? rulePasswordMax()(value, {}) ?? rulePasswordStrength()(value, {})
    ?? (value ? null : 'Enter a password or click Generate.')
}

function generate() {
  password.value   = generateTempPassword()
  fieldError.value = null
}

async function submit() {
  if (saving.value || !props.target) return

  serverError.value = null
  fieldError.value  = validate(password.value)
  if (fieldError.value) return

  saving.value = true
  try {
    await setUserPassword(props.target.id, password.value)
    done.value = true
    emit('saved', props.target.id)
  } catch (e: any) {
    serverError.value = parseAuthError(e).message
  } finally {
    saving.value = false
  }
}

async function copy() {
  try {
    await navigator.clipboard.writeText(password.value)
    toast.success('Password copied')
  } catch {
    toast.error('Couldn\'t copy — select the password and copy it manually')
  }
}

function close() {
  emit('update:modelValue', false)
}

/** The password is only ever visible on the done step, so a stray click must not dismiss it. */
function onBackdrop() {
  if (!done.value) close()
}
</script>

<style scoped>
.overlay-enter-active, .overlay-leave-active { transition: opacity 0.18s ease; }
.overlay-enter-from, .overlay-leave-to { opacity: 0; }

.input-field {
  @apply w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors;
}
.input-field[aria-invalid='true'] { @apply border-red-400; }

.primary-btn {
  @apply px-4 py-2 text-sm font-semibold rounded-xl bg-primary text-on-primary hover:opacity-90 active:scale-[0.98] transition-all;
}
.ghost-btn {
  @apply px-3 py-2 text-xs font-semibold rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors;
}
</style>
