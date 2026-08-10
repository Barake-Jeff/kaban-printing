/**
 * Folds any accepted Kenyan mobile format into the canonical stored form: 0XXXXXXXXX.
 *
 * Accepts separators (spaces, hyphens, parentheses) and the +254 / 254 country
 * prefixes, because those are the forms users actually type. Non-string input is
 * passed through untouched so class-validator still reports a proper type error.
 *
 * Used both as a DTO @Transform (so it runs BEFORE @Matches in the ValidationPipe)
 * and by AuthService when looking accounts up, so the two can never drift.
 */
export function normalizeKenyanPhone<T>(value: T): T | string {
  if (typeof value !== 'string') return value;

  return value
    .replace(/[\s\-()]/g, '')
    .replace(/^\+254/, '0')
    .replace(/^254/, '0');
}
