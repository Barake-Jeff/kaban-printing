/**
 * Client-side mirror of kaban-backend/src/common/utils/page-range.util.ts.
 * MUST stay in sync with that file's parsing rules — used only for live inline
 * feedback before submit; the backend is the actual source of truth.
 *
 * NOTE: exports in utils/ are globally auto-imported by Nuxt.
 */

export interface PageRangeResult {
  pageCount: number
  error: string | null
}

export function parsePageRangeClient(spec: string, totalPages: number): PageRangeResult {
  const tokens = spec.split(',').map(t => t.trim()).filter(Boolean)
  if (tokens.length === 0) {
    return { pageCount: 0, error: 'Page selection cannot be empty' }
  }

  const pages = new Set<number>()

  for (const token of tokens) {
    const rangeMatch = token.match(/^(\d+)-(\d+)$/)
    const singleMatch = token.match(/^(\d+)$/)

    if (rangeMatch) {
      const start = Number(rangeMatch[1])
      const end = Number(rangeMatch[2])
      if (start < 1 || end < 1 || end < start) {
        return { pageCount: 0, error: `Invalid page range "${token}"` }
      }
      if (end > totalPages) {
        return { pageCount: 0, error: `Page ${end} is beyond the document's ${totalPages} pages` }
      }
      for (let p = start; p <= end; p++) pages.add(p)
    } else if (singleMatch) {
      const page = Number(singleMatch[1])
      if (page < 1) {
        return { pageCount: 0, error: `Invalid page "${token}"` }
      }
      if (page > totalPages) {
        return { pageCount: 0, error: `Page ${page} is beyond the document's ${totalPages} pages` }
      }
      pages.add(page)
    } else {
      return { pageCount: 0, error: `Invalid page selection "${token}" — use a format like "1-5, 8, 10-12"` }
    }
  }

  return { pageCount: pages.size, error: null }
}
