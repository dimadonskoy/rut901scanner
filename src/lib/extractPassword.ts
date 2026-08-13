/**
 * Extracts the value of the label's `PASSWORD` field from a block of text
 * (OCR output or decoded barcode text). Explicitly excludes any line
 * containing `WIFI PASSWORD` so the two fields are never confused.
 */
export function extractPasswordField(text: string): string | null {
  if (!text) return null;

  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    if (/WIFI\s*PASSWORD/i.test(line)) continue;

    const match = line.match(/\bPASSWORD\b\s*:?\s*(\S+)/i);
    if (match) {
      return match[1];
    }
  }

  return null;
}
