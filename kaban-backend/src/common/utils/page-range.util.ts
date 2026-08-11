export interface ParsedPageRange {
  pages: number[];
  pageCount: number;
}

/**
 * Parses a customer-entered page spec like "1-5, 8, 10-12" against the source
 * document's actual page count. Throws a plain Error with a human-readable
 * message on any malformed or out-of-bounds token — callers wrap it as a
 * BadRequestException. Treating "no selection" (blank/empty spec) is the
 * caller's responsibility; this always expects a non-empty spec.
 */
export function parsePageRange(spec: string, totalPages: number): ParsedPageRange {
  const tokens = spec.split(',').map(t => t.trim()).filter(Boolean);
  if (tokens.length === 0) {
    throw new Error('Page selection cannot be empty');
  }

  const pages = new Set<number>();

  for (const token of tokens) {
    const rangeMatch = token.match(/^(\d+)-(\d+)$/);
    const singleMatch = token.match(/^(\d+)$/);

    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      if (start < 1 || end < 1 || end < start) {
        throw new Error(`Invalid page range "${token}"`);
      }
      if (end > totalPages) {
        throw new Error(`Page ${end} is beyond the document's ${totalPages} pages`);
      }
      for (let p = start; p <= end; p++) pages.add(p);
    } else if (singleMatch) {
      const page = Number(singleMatch[1]);
      if (page < 1) {
        throw new Error(`Invalid page "${token}"`);
      }
      if (page > totalPages) {
        throw new Error(`Page ${page} is beyond the document's ${totalPages} pages`);
      }
      pages.add(page);
    } else {
      throw new Error(`Invalid page selection "${token}" — use a format like "1-5, 8, 10-12"`);
    }
  }

  const sorted = [...pages].sort((a, b) => a - b);
  return { pages: sorted, pageCount: sorted.length };
}
