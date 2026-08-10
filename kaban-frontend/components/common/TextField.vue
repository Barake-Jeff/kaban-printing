<template>
  <div class="flex flex-col">

    <label :for="inputId" :class="labelClass">{{ label }}</label>

    <div class="relative mt-xs">
      <!-- :value/@input rather than v-model: Vue does not support v-model with a
           dynamic :type binding, which we need for the reveal toggle. -->
      <input
        :id="inputId"
        ref="inputEl"
        class="input-field"
        :class="{ 'pr-12': revealable || trailingIcon }"
        :type="resolvedType"
        :value="modelValue"
        :placeholder="placeholder"
        :autocomplete="autocomplete"
        :inputmode="inputmode"
        :enterkeyhint="enterkeyhint"
        :maxlength="maxlength"
        :required="required"
        :disabled="disabled"
        :autocapitalize="autocapitalize"
        :autocorrect="plainText ? undefined : 'off'"
        :spellcheck="plainText ? undefined : false"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="describedBy"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        @blur="$emit('blur')"
      />

      <!-- Full-height 48px target: the old `right-3 top-3` toggle was ~24px -->
      <button
        v-if="revealable"
        type="button"
        tabindex="-1"
        :aria-label="show ? 'Hide password' : 'Show password'"
        :aria-pressed="show"
        class="absolute inset-y-0 right-0 w-12 flex items-center justify-center text-outline hover:text-primary transition-colors"
        @click="show = !show"
      >
        <span class="material-symbols-outlined" aria-hidden="true">
          {{ show ? 'visibility_off' : 'visibility' }}
        </span>
      </button>

      <span
        v-else-if="trailingIcon"
        class="absolute inset-y-0 right-0 w-12 flex items-center justify-center material-symbols-outlined text-outline pointer-events-none"
        aria-hidden="true"
      >{{ trailingIcon }}</span>
    </div>

    <!-- aria-live (not role="alert") so a live-validating field doesn't
         re-announce on every keystroke -->
    <p
      v-if="error"
      :id="`${inputId}-error`"
      class="font-body-sm text-body-sm text-error mt-xs"
      aria-live="polite"
    >{{ error }}</p>

    <p
      v-else-if="hint"
      :id="`${inputId}-hint`"
      class="font-body-sm text-body-sm mt-xs flex items-center gap-xs"
      :class="hintSatisfied ? 'text-green-700' : 'text-on-surface-variant'"
    >
      <span
        v-if="hintSatisfied"
        class="material-symbols-outlined text-[16px]"
        aria-hidden="true"
      >check_circle</span>
      {{ hint }}
    </p>

  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: string
    label: string
    type?: string
    placeholder?: string
    hint?: string
    /** Flips the hint to a satisfied (green, ticked) state. */
    hintSatisfied?: boolean
    error?: string
    autocomplete?: string
    inputmode?: 'text' | 'tel' | 'numeric' | 'email' | 'search' | 'url' | 'decimal' | 'none'
    enterkeyhint?: 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send'
    maxlength?: number
    required?: boolean
    disabled?: boolean
    revealable?: boolean
    trailingIcon?: string
    autocapitalize?: string
    labelClass?: string
  }>(),
  {
    type: 'text',
    labelClass: 'block font-label-bold text-label-bold text-primary font-normal',
  },
)

defineEmits<{ 'update:modelValue': [string]; blur: [] }>()

const inputId = useId()
const inputEl = ref<HTMLInputElement | null>(null)
const show    = ref(false)

const resolvedType = computed(() => {
  if (!props.revealable) return props.type
  return show.value ? 'text' : 'password'
})

/** Autocorrect/spellcheck only make sense on free text. */
const plainText = computed(() => props.type === 'text' && !props.revealable)

const describedBy = computed(() => {
  if (props.error) return `${inputId}-error`
  if (props.hint)  return `${inputId}-hint`
  return undefined
})

defineExpose({
  focus: () => inputEl.value?.focus(),
})
</script>

<style scoped>
/* Canonical input styling. Deliberately scoped to this component rather than
   promoted to a global .input-field: pages/admin/settings/index.vue declares its
   own denser .input-field with no height, and a global one would leak h-12 into
   it. The component is the API; the class name is an implementation detail. */
.input-field {
  @apply w-full h-12 px-md bg-surface-container-lowest text-on-surface
         border border-outline-variant rounded-xl
         placeholder-on-surface-variant/50
         outline-none transition-[border-color,box-shadow] duration-150;
  /* 16px is the iOS Safari zoom-on-focus threshold — never lower this. */
  font-size: 16px;
  line-height: 24px;
}

/* Overridable per-form: admin login sets --field-accent to its navy. */
.input-field:focus {
  border-color: var(--field-accent, #fd761a);
  box-shadow: 0 0 0 1px var(--field-accent, #fd761a);
}

.input-field[aria-invalid='true'] {
  border-color: #ba1a1a;
}
.input-field[aria-invalid='true']:focus {
  box-shadow: 0 0 0 1px #ba1a1a;
}

.input-field:disabled {
  @apply opacity-60 cursor-not-allowed;
}
</style>
