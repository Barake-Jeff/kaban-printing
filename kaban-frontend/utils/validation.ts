/**
 * Form validation rules and API error parsing.
 *
 * Rules here MUST mirror the backend DTOs exactly, so the client never accepts
 * something the server will reject (or vice versa):
 *   kaban-backend/src/modules/auth/dto/customer-register.dto.ts
 *   kaban-backend/src/modules/users/dto/change-password.dto.ts
 *
 * NOTE: exports in utils/ are globally auto-imported by Nuxt, hence the prefixed
 * names. Also, tailwind.config.ts does not scan utils/ — never put Tailwind class
 * strings in this file, they would be purged.
 */

/** A rule returns an error message, or null when the value is acceptable. */
export type ValidationRule<T = Record<string, string>> = (
  value: string,
  all: T,
) => string | null

/** Canonical stored form. Strict subset of the server's /^(\+254|0)[17]\d{8}$/. */
const KE_PHONE_CANONICAL = /^0[17]\d{8}$/

/**
 * Folds any accepted Kenyan format into 0XXXXXXXXX.
 * Mirrors normalizeKenyanPhone() in kaban-backend/src/common/utils/phone.util.ts.
 */
export function normalizeKePhone(raw: string): string {
  if (typeof raw !== 'string') return raw

  const stripped = raw.replace(/[\s\-()]/g, '')

  if (stripped.startsWith('+254')) return '0' + stripped.slice(4)
  if (stripped.startsWith('254'))  return '0' + stripped.slice(3)
  // Bare "712345678" — user dropped the leading zero
  if (/^[17]\d{8}$/.test(stripped)) return '0' + stripped

  return stripped
}

export function isValidKePhone(value: string): boolean {
  return KE_PHONE_CANONICAL.test(normalizeKePhone(value ?? ''))
}

// ── Rule factories ──────────────────────────────────────────────────────────

export function ruleRequired(label: string): ValidationRule {
  return (v) => (v && v.trim() ? null : `Enter your ${label}.`)
}

export function ruleMaxLength(max: number, label: string): ValidationRule {
  return (v) => (!v || v.length <= max ? null : `${label} must be ${max} characters or fewer.`)
}

/** Signup only — CustomerLoginDto has no format rule, see rationale in LoginForm. */
export function rulePhoneKe(): ValidationRule {
  return (v) =>
    !v || isValidKePhone(v)
      ? null
      : 'Enter a valid Safaricom or Airtel number, e.g. 0712345678.'
}

/** Mirrors @MinLength(8) on the register and change-password DTOs. */
export function rulePasswordMin(): ValidationRule {
  return (v) => (!v || v.length >= 8 ? null : 'Password must be at least 8 characters.')
}

/** Mirrors @MaxLength(100). */
export function rulePasswordMax(): ValidationRule {
  return (v) => (!v || v.length <= 100 ? null : 'Password must be 100 characters or fewer.')
}

export function ruleMatches(otherKey: string, message: string): ValidationRule {
  return (v, all) => (v === all[otherKey] ? null : message)
}

// ── API error handling ──────────────────────────────────────────────────────

export interface ParsedAuthError {
  message: string
  /** Full validation list from the backend; [message] when there is only one. */
  errors: string[]
  status?: number
}

/**
 * Normalizes an ofetch rejection into something displayable.
 *
 * The backend envelope (kaban-backend/src/common/filters/http-exception.filter.ts)
 * is { statusCode, message, errors? } where `message` is only the FIRST violation
 * and `errors` holds all of them — so we surface the array.
 */
export function parseAuthError(e: any): ParsedAuthError {
  const status: number | undefined = e?.response?.status ?? e?.data?.statusCode

  // No response at all — DNS failure, airplane mode, dead server, timeout.
  if (!status && !e?.data) {
    return {
      message: "Can't reach PrintEase. Check your connection and try again.",
      errors: [],
    }
  }

  const errors: string[] = Array.isArray(e?.data?.errors) ? e.data.errors : []
  const message: string =
    e?.data?.message ?? e?.message ?? 'Something went wrong. Please try again.'

  return { message, errors: errors.length ? errors : [message], status }
}

/**
 * Routes backend validation strings to the field they belong to.
 *
 * class-validator's default messages lead with the property name
 * ("password must be longer than or equal to 8 characters"), and our one custom
 * message is special-cased. Anything unmatched is returned for the form banner
 * so no error is ever silently swallowed.
 */
export function mapServerErrors(
  errors: string[],
  fieldNames: string[],
): { byField: Record<string, string>; unmatched: string[] } {
  const byField: Record<string, string> = {}
  const unmatched: string[] = []

  for (const err of errors) {
    if (/^phone must be a valid kenyan number/i.test(err)) {
      byField.phone ??= err
      continue
    }

    const field = fieldNames.find((name) => err.startsWith(name + ' '))
    if (field) byField[field] ??= err
    else unmatched.push(err)
  }

  return { byField, unmatched }
}
