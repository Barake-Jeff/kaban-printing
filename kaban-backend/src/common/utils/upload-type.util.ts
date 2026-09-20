export type UploadKind = 'pdf' | 'word' | 'image';

export interface DetectedUpload {
  kind: UploadKind;
  /** Canonical MIME type for this kind of file, whatever the browser declared. */
  mime: string;
  /** Safe, canonical extension, whatever the customer's filename says. */
  ext: string;
}

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ZIP_LOCAL_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
// OLE2 "Compound File": the container behind Word 97-2003, Excel 97-2003, PowerPoint 97-2003, MSI...
const CFB_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
// Directory entries in a compound file are stored as UTF-16LE. Every Word binary file has a
// stream named WordDocument; Excel has "Workbook" and PowerPoint has "PowerPoint Document".
const WORD_STREAM_NAME = Buffer.from('WordDocument', 'utf16le');
const DOCX_MAIN_PART = Buffer.from('word/document.xml');

/**
 * Works out what an uploaded file actually is from its bytes, ignoring the MIME type the browser
 * declared and the filename. Everything downstream (which pipeline to run, how pages are counted
 * and billed, the stored name and extension) must key off this, never off what the client claims.
 * Returns null for anything that isn't a PDF, Word document (.doc/.docx), PNG or JPEG.
 */
export function detectUploadType(buffer: Buffer): DetectedUpload | null {
  if (buffer.length < PNG_SIGNATURE.length) return null;

  if (buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    return { kind: 'image', mime: 'image/png', ext: 'png' };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { kind: 'image', mime: 'image/jpeg', ext: 'jpg' };
  }

  // .docx is a zip; require the Word main part so .xlsx / .pptx / arbitrary zips are refused.
  if (buffer.subarray(0, ZIP_LOCAL_HEADER.length).equals(ZIP_LOCAL_HEADER)) {
    return buffer.includes(DOCX_MAIN_PART) ? { kind: 'word', mime: DOCX_MIME, ext: 'docx' } : null;
  }

  // .doc is a compound file; require the Word stream so spreadsheets, slides and installers are refused.
  if (buffer.subarray(0, CFB_SIGNATURE.length).equals(CFB_SIGNATURE)) {
    return buffer.includes(WORD_STREAM_NAME) ? { kind: 'word', mime: 'application/msword', ext: 'doc' } : null;
  }

  // The PDF spec lets the header sit anywhere in the first 1024 bytes.
  if (buffer.subarray(0, 1024).includes('%PDF-')) {
    return { kind: 'pdf', mime: 'application/pdf', ext: 'pdf' };
  }

  return null;
}
