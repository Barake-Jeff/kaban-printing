import { MAX_PAGE, MAX_PAGE_SIZE } from '../constants/limits';

export interface Pagination {
  page: number;
  size: number;
  offset: number;
}

/**
 * Turns raw `?page=&size=` query strings into safe numbers. Anything that isn't a
 * usable integer (NaN, negative, zero, fractional, absent) falls back to a sane value
 * and `size` is capped at MAX_PAGE_SIZE, so a client can't request an unbounded page
 * or produce a negative OFFSET.
 */
export function parsePagination(
  page: unknown,
  size: unknown,
  { defaultSize }: { defaultSize: number },
): Pagination {
  const p = Math.floor(Number(page));
  const s = Math.floor(Number(size));

  // Upper bound keeps OFFSET a plain integer (Number(1e300) would render as 1e+300 in SQL).
  const safePage = Number.isFinite(p) && p >= 1 ? Math.min(p, MAX_PAGE) : 1;
  const safeSize = Number.isFinite(s) && s >= 1 ? Math.min(s, MAX_PAGE_SIZE) : defaultSize;

  return { page: safePage, size: safeSize, offset: (safePage - 1) * safeSize };
}
