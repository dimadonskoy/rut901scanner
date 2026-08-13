/**
 * Extracts the value of the label's `PASSWORD` field from a block of text
 * (OCR output or decoded barcode text). Explicitly excludes any line
 * containing `WIFI PASSWORD` so the two fields are never confused.
 */

// Common OCR digit/symbol-for-letter confusions, applied only when detecting
// the field label — never to the extracted password value itself.
const OCR_CONFUSION: Record<string, string> = {
  '0': 'O',
  '1': 'I',
  '5': 'S',
  '8': 'B',
  '$': 'S',
  '@': 'A',
  '|': 'I',
};

function normalizeLabelText(line: string): string {
  return line.toUpperCase().replace(/[0158$@|]/g, (c) => OCR_CONFUSION[c] ?? c);
}

export function extractPasswordField(text: string): string | null {
  if (!text) return null;

  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    // Char-for-char normalization keeps indices aligned with the original line.
    const normalized = normalizeLabelText(line);

    if (/WIFI\s*PASSWORD/.test(normalized)) continue;

    const match = normalized.match(/\bPASSWORD\b\s*:?\s*/);
    if (match && match.index !== undefined) {
      const valueStart = match.index + match[0].length;
      const value = line.slice(valueStart).trim().split(/\s+/)[0];
      if (value) return value;
    }
  }

  return null;
}
