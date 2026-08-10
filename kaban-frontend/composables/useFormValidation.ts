import type { ValidationRule } from '~/utils/validation'

/**
 * Touched/blur validation state machine.
 *
 * Timing is the whole point: a field is never marked invalid while the user is
 * typing into it for the first time (that scolds people mid-thought), but once
 * they've left it — or once they've attempted a submit — errors update live so a
 * correction clears immediately.
 *
 * Domain-free: rules are injected from ~/utils/validation.
 */
export function useFormValidation<T extends Record<string, string>>(
  initial: T,
  rules: Partial<Record<keyof T, ValidationRule<T>[]>>,
) {
  const values = reactive({ ...initial }) as T
  const errors = reactive({}) as Record<keyof T, string | undefined>
  const touched = reactive({}) as Record<keyof T, boolean>
  /** Server-assigned errors, cleared for a field as soon as the user edits it. */
  const serverErrors = reactive({}) as Record<keyof T, string | undefined>

  const keys = Object.keys(initial) as (keyof T)[]

  function runRules(key: keyof T): string | undefined {
    for (const rule of rules[key] ?? []) {
      const msg = rule(values[key], values)
      if (msg) return msg
    }
    return undefined
  }

  /** Validates a single field and stores the result. Returns validity. */
  function validateField(key: keyof T): boolean {
    const msg = runRules(key)
    errors[key] = msg
    return !msg
  }

  /** Call on @blur. Marks the field touched and validates it. */
  function touch(key: keyof T) {
    touched[key] = true
    validateField(key)
  }

  /** Marks everything touched and validates. Call on submit. */
  function validateAll(): boolean {
    let ok = true
    for (const key of keys) {
      touched[key] = true
      if (!validateField(key)) ok = false
    }
    return ok
  }

  /** Merge backend field errors in (see mapServerErrors). */
  function setServerErrors(byField: Record<string, string>) {
    for (const [key, msg] of Object.entries(byField)) {
      if (!keys.includes(key as keyof T)) continue
      touched[key as keyof T] = true
      serverErrors[key as keyof T] = msg
    }
  }

  function clearServerErrors() {
    for (const key of keys) serverErrors[key] = undefined
  }

  function reset() {
    for (const key of keys) {
      values[key] = initial[key]
      errors[key] = undefined
      touched[key] = false
      serverErrors[key] = undefined
    }
  }

  /** Client error takes precedence; server error shows until the field is edited. */
  function errorFor(key: keyof T): string | undefined {
    return errors[key] ?? serverErrors[key]
  }

  function firstInvalidKey(): keyof T | undefined {
    return keys.find((key) => errorFor(key))
  }

  const isValid = computed(() => keys.every((key) => !runRules(key)))

  // Re-validate touched fields as values change. Deep so cross-field rules
  // (confirm-password) re-run when their partner field changes.
  watch(
    () => keys.map((key) => values[key]),
    (next, prev) => {
      for (const [i, key] of keys.entries()) {
        // A user editing a field means they're addressing whatever the server said.
        if (next[i] !== prev?.[i]) serverErrors[key] = undefined
        if (touched[key]) validateField(key)
      }
    },
  )

  return {
    values,
    errors,
    touched,
    isValid,
    touch,
    validateField,
    validateAll,
    setServerErrors,
    clearServerErrors,
    errorFor,
    firstInvalidKey,
    reset,
  }
}
