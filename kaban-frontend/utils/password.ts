// No look-alikes (I/l/1, O/0) — admins read these out over the phone.
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz'
const DIGITS  = '23456789'

/** Unbiased random int in [0, max) — rejection sampling avoids modulo bias. */
function randomIndex(max: number): number {
  const buf   = new Uint32Array(1)
  const limit = Math.floor(0x100000000 / max) * max
  do { crypto.getRandomValues(buf) } while (buf[0] >= limit)
  return buf[0] % max
}

/**
 * Temporary password an admin can hand to a customer. Always satisfies the
 * backend policy (8–100 chars, at least one letter and one number).
 * Client-only: relies on the Web Crypto global, so call it from an event handler.
 */
export function generateTempPassword(length = 10): string {
  const alphabet = LETTERS + DIGITS
  const chars = [
    LETTERS[randomIndex(LETTERS.length)],
    DIGITS[randomIndex(DIGITS.length)],
  ]
  while (chars.length < length) chars.push(alphabet[randomIndex(alphabet.length)])

  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}
