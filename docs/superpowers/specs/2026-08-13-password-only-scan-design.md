# PASSWORD-only field scanning

## Problem

The RUT901 label has multiple fields (SERIAL barcode, IMEI, LAN MAC, WIFI SSID,
WIFI PASSWORD, USERNAME, PASSWORD). The app should capture only the value of
the `PASSWORD` field — not `WIFI PASSWORD`, not the SERIAL barcode value, not
anything else on the label.

Today the app only does live 1D/2D barcode decoding (ZXing). Scanning the
SERIAL barcode on the label decodes to a plain number (e.g. `6008869606`).
That decoded text is run through a loose fallback regex in
`CameraScanner.tsx`'s `parseAndReport`:

```
const cleanMatch = rawText.match(/\b([A-Za-z0-9]{8,16})\b/);
```

This accepts *any* 8–16 char alphanumeric string as "the password" — so
scanning the SERIAL barcode incorrectly reports the serial number as the
password. There is also no barcode encoding the actual PASSWORD field on this
label; it is plain printed text, so barcode scanning alone can never read it.

## Design

### Shared parser: `src/lib/extractPassword.ts`

```ts
export function extractPasswordField(text: string): string | null
```

- Splits `text` into lines.
- Skips any line matching `/WIFI\s*PASSWORD/i`.
- Matches a line starting with `/^\s*PASSWORD\b/i` (word-boundary,
  case-insensitive, so `PASSWORD` doesn't accidentally match as a substring
  of another word).
- From a matching line, extracts the trailing value token (last
  whitespace-separated run of non-space characters) as the password value.
- Returns `null` if no matching line is found.

This is the single source of truth for "what counts as the PASSWORD value."
Both the OCR path and the barcode path route through it — no more loose
fallback regex.

### OCR capture path

- Add `tesseract.js` as a dependency.
- Add a "Capture PASSWORD" button in `CameraScanner.tsx`'s control row
  (alongside the existing torch / switch-camera buttons).
- On tap:
  1. Draw the current `<video>` frame to an offscreen `<canvas>`.
  2. Run `tesseract.js` recognition on the canvas image data.
  3. Feed the resulting text into `extractPasswordField`.
  4. If a match is found, call `onScanResult(match)`.
  5. If no match is found, show an inline error: "PASSWORD field not
     detected — align label and try again." Button re-enables for retry.
- Button shows a spinner/disabled state while OCR is running (typically
  ~1–3s on-device).

### Barcode path (kept, fixed)

- Live ZXing barcode/QR decoding keeps running exactly as today.
- The decoded text now also routes through `extractPasswordField` instead of
  the old loose regex.
- Net effect: scanning the SERIAL barcode now correctly yields no match
  (since its decoded text has no `PASSWORD` line), instead of the previous
  false positive. If a future label ever encodes an actual `PASSWORD: ...`
  string in a barcode/QR, it will still be picked up correctly.
- Whichever path (barcode decode or OCR capture) produces a non-null match
  first wins and calls `onScanResult`.

### Error handling

- No PASSWORD line found in OCR text → inline retry prompt (see above).
- OCR engine/model load failure (e.g. first-time WASM asset fetch fails
  offline) → reuse the existing red error banner style already used for
  camera permission errors.

### Testing

Unit tests for `extractPasswordField` covering:
- The real label text block → must return `iQ+0?4Ua`, not `Dv10CuPa`.
- Text containing only `WIFI PASSWORD` (no plain `PASSWORD` line) → `null`.
- Text with no PASSWORD-like line at all → `null`.
- Extra whitespace / casing variants (`password:`, `PASSWORD  `, tabs).

## Out of scope

- Crop-box / region-of-interest alignment UI (rejected in favor of full-frame
  OCR + regex disambiguation).
- Removing barcode decoding (kept as a secondary path).
