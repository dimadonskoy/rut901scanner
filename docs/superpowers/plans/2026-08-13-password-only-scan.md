# PASSWORD-only Field Scanning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the RUT901 scanner capture only the label's `PASSWORD` field value (never `WIFI PASSWORD`, never the SERIAL barcode number), by adding a shared text parser and an OCR capture path, and fixing the loose regex that currently causes false positives.

**Architecture:** A new pure-function parser (`extractPasswordField`) is the single source of truth for "what counts as the PASSWORD value" from any block of text. The existing live barcode/QR decoder (ZXing) is rewired to use it instead of its old loose fallback regex. A new "Capture PASSWORD" button adds an OCR path (via `tesseract.js`) that grabs one video frame, recognizes text, and runs it through the same parser.

**Tech Stack:** React 19 + TypeScript, Vite, `@zxing/library` (existing), `tesseract.js` (new), Vitest (new, for unit tests).

## Global Constraints

- `extractPasswordField` must never match a line containing `WIFI PASSWORD` (case-insensitive) — spec requirement.
- `extractPasswordField` must only match lines starting with `PASSWORD` as a whole word (case-insensitive) — spec requirement.
- No loose "any 8-16 char alphanumeric string" fallback anywhere in the scanning path — this was the root cause of the original bug (scanning the SERIAL barcode was mistaken for the password).
- Both the barcode-decoded path and the OCR-captured path must route through the same `extractPasswordField` function — no duplicate parsing logic.

---

## File Structure

- **Create** `src/lib/extractPassword.ts` — the shared parser, `extractPasswordField(text: string): string | null`.
- **Create** `src/lib/extractPassword.test.ts` — Vitest unit tests for the parser.
- **Modify** `src/components/CameraScanner.tsx` — replace the loose regex in `parseAndReport` with `extractPasswordField`; add the "Capture PASSWORD" OCR button, capture logic, and error state.
- **Modify** `package.json` — add `tesseract.js` dependency, add `vitest` devDependency, add `"test": "vitest run"` script.

---

### Task 1: Shared `extractPasswordField` parser (TDD)

**Files:**
- Create: `src/lib/extractPassword.ts`
- Test: `src/lib/extractPassword.test.ts`
- Modify: `package.json` (add `vitest` devDependency + `test` script)

**Interfaces:**
- Produces: `extractPasswordField(text: string): string | null` — used by Task 2 (barcode path) and Task 3 (OCR path).

- [ ] **Step 1: Install Vitest**

Run: `npm install --save-dev vitest`
Expected: command exits 0, `vitest` added to `package.json` devDependencies.

- [ ] **Step 2: Add the `test` script**

Edit `package.json`, in the `"scripts"` block, add a `test` entry alongside the existing ones:

```json
"scripts": {
  "dev": "vite --host",
  "build": "tsc -b && vite build",
  "lint": "oxlint",
  "test": "vitest run",
  "preview": "vite preview"
},
```

- [ ] **Step 3: Write the failing tests**

Create `src/lib/extractPassword.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { extractPasswordField } from './extractPassword';

describe('extractPasswordField', () => {
  it('extracts the PASSWORD value from a full label text block, not WIFI PASSWORD', () => {
    const labelText = [
      'SERIAL          6008869606',
      'IMEI            867934081310858',
      'LAN MAC         209727B007CB',
      'WIFI SSID       RUT901_07CD',
      'WIFI PASSWORD   Dv10CuPa',
      'USERNAME        admin',
      'PASSWORD        iQ+0?4Ua',
    ].join('\n');

    expect(extractPasswordField(labelText)).toBe('iQ+0?4Ua');
  });

  it('returns null when only WIFI PASSWORD is present', () => {
    const text = 'WIFI SSID       RUT901_07CD\nWIFI PASSWORD   Dv10CuPa';
    expect(extractPasswordField(text)).toBeNull();
  });

  it('returns null when no PASSWORD-like line exists', () => {
    const text = 'SERIAL          6008869606\nIMEI            867934081310858';
    expect(extractPasswordField(text)).toBeNull();
  });

  it('handles a colon separator with no space, lowercase label', () => {
    expect(extractPasswordField('password:iQ+0?4Ua')).toBe('iQ+0?4Ua');
  });

  it('handles a tab between label and value', () => {
    expect(extractPasswordField('PASSWORD\tiQ+0?4Ua')).toBe('iQ+0?4Ua');
  });

  it('returns null when the PASSWORD label has no trailing value', () => {
    expect(extractPasswordField('PASSWORD   ')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(extractPasswordField('')).toBeNull();
  });
});
```

- [ ] **Step 4: Run the tests and confirm they fail**

Run: `npx vitest run src/lib/extractPassword.test.ts`
Expected: FAIL — `Cannot find module './extractPassword'` (the module doesn't exist yet).

- [ ] **Step 5: Implement `extractPasswordField`**

Create `src/lib/extractPassword.ts`:

```ts
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

    const match = line.match(/^\s*PASSWORD\b\s*:?\s*(\S+)/i);
    if (match) {
      return match[1];
    }
  }

  return null;
}
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `npx vitest run src/lib/extractPassword.test.ts`
Expected: PASS — all 7 tests green.

- [ ] **Step 7: Commit**

```bash
git add src/lib/extractPassword.ts src/lib/extractPassword.test.ts package.json package-lock.json
git commit -m "feat: add extractPasswordField parser for label PASSWORD field"
```

---

### Task 2: Fix the barcode path to use `extractPasswordField`

**Files:**
- Modify: `src/components/CameraScanner.tsx:65-87` (the `parseAndReport` callback)

**Interfaces:**
- Consumes: `extractPasswordField(text: string): string | null` from Task 1.

- [ ] **Step 1: Replace the loose regex logic in `parseAndReport`**

In `src/components/CameraScanner.tsx`, add the import near the top with the other imports:

```ts
import { extractPasswordField } from '../lib/extractPassword';
```

Replace the existing `parseAndReport` callback (currently lines 65-87):

```ts
  // Extract Teltonika Password from scanned content (1D Barcode, QR code, or Label text)
  const parseAndReport = React.useCallback((rawText: string) => {
    if (!rawText || rawText.trim().length === 0) return;

    // Teltonika Label Parsing Patterns
    // Example RUT901 labels often have:
    // WPA Key / Password: 8-12 alphanumeric characters
    // Or string format PASS: <password>
    let extracted = rawText.trim();

    const passMatch = rawText.match(/(?:PASS|PASSWORD|WPA|KEY|PW)[\s:]*([A-Za-z0-9!@#$%^&*]{8,20})/i);
    if (passMatch && passMatch[1]) {
      extracted = passMatch[1];
    } else {
      // If it's a raw barcode value printed under PASS label
      const cleanMatch = rawText.match(/\b([A-Za-z0-9]{8,16})\b/);
      if (cleanMatch) {
        extracted = cleanMatch[1];
      }
    }

    onScanResult(extracted, rawText);
  }, [onScanResult]);
```

with:

```ts
  // Extract the PASSWORD field value from decoded barcode/QR text.
  const parseAndReport = React.useCallback((rawText: string) => {
    if (!rawText || rawText.trim().length === 0) return;

    const extracted = extractPasswordField(rawText);
    if (extracted) {
      onScanResult(extracted, rawText);
    }
  }, [onScanResult]);
```

This removes the old fallback that accepted any 8-16 char alphanumeric string as "the password" — which was why scanning the SERIAL barcode (e.g. `6008869606`) was previously misreported as the password. Decoded barcode text with no `PASSWORD` line now correctly produces no result.

- [ ] **Step 2: Typecheck and lint**

Run: `npm run build`
Expected: exits 0, no TypeScript errors.

Run: `npm run lint`
Expected: exits 0, no lint errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/CameraScanner.tsx
git commit -m "fix: only accept explicit PASSWORD field from decoded barcode text"
```

---

### Task 3: OCR "Capture PASSWORD" button

**Files:**
- Modify: `src/components/CameraScanner.tsx` (imports, state, capture handler, JSX)
- Modify: `package.json` (add `tesseract.js` dependency)

**Interfaces:**
- Consumes: `extractPasswordField(text: string): string | null` from Task 1.
- Consumes: `videoRef` (existing `useRef<HTMLVideoElement | null>`) already defined in this file.

- [ ] **Step 1: Install `tesseract.js`**

Run: `npm install tesseract.js`
Expected: exits 0, `tesseract.js` added to `package.json` dependencies.

- [ ] **Step 2: Add the OCR import, canvas ref, and capture state**

In `src/components/CameraScanner.tsx`, update the imports at the top of the file:

```ts
import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, Result } from '@zxing/library';
import { recognize } from 'tesseract.js';
import { Camera, RefreshCw, Zap, AlertCircle, Scan } from 'lucide-react';
import { extractPasswordField } from '../lib/extractPassword';
```

Inside the `CameraScanner` component, alongside the existing `useState`/`useRef` declarations (after `const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);`), add:

```ts
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [capturing, setCapturing] = useState<boolean>(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
```

- [ ] **Step 3: Add the capture-and-recognize handler**

Add this function inside the component, after `parseAndReport` (from Task 2) and before the "Start continuous video decoding" `useEffect`:

```ts
  // Capture the current video frame and run OCR to read the printed PASSWORD field.
  const captureAndRecognizePassword = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setCapturing(true);
    setOcrError(null);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const { data } = await recognize(canvas, 'eng');
      const password = extractPasswordField(data.text);

      if (password) {
        onScanResult(password, data.text);
      } else {
        setOcrError('PASSWORD field not detected — align label and try again.');
      }
    } catch (err) {
      console.error('OCR capture error:', err);
      setOcrError('Could not read label text. Please try again.');
    } finally {
      setCapturing(false);
    }
  };
```

- [ ] **Step 4: Add the hidden capture canvas and the "Capture PASSWORD" button to the JSX**

In the "Video Stream Container" section, add the hidden canvas right after the `<video>` element (currently around line 187):

```tsx
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
        />
        <canvas ref={canvasRef} className="hidden" />
```

In the header controls row (the `<div className="flex items-center gap-2">` block that currently holds the switch-camera and torch buttons, around lines 154-177), add the new button before the existing torch button:

```tsx
          <button
            onClick={captureAndRecognizePassword}
            disabled={capturing}
            className={`px-3 py-2.5 rounded-xl transition-all min-h-[44px] flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer ${
              capturing
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-lg shadow-blue-900/30'
            }`}
            title="Capture PASSWORD field"
            aria-label="Capture PASSWORD field"
          >
            <Camera className={`w-4 h-4 ${capturing ? 'animate-spin' : ''}`} />
            {capturing ? 'Reading...' : 'Capture PASSWORD'}
          </button>
```

- [ ] **Step 5: Show the OCR error banner**

In the "Video Stream Container", next to the existing camera-permission error alert (around lines 210-215), add a second alert block for `ocrError` right after it:

```tsx
        {ocrError && (
          <div className="absolute inset-x-4 bottom-4 p-3 bg-red-950/90 border border-red-700/80 rounded-xl text-red-200 text-xs flex items-center gap-2.5 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{ocrError}</span>
          </div>
        )}
```

- [ ] **Step 6: Typecheck and lint**

Run: `npm run build`
Expected: exits 0, no TypeScript errors.

Run: `npm run lint`
Expected: exits 0, no lint errors.

- [ ] **Step 7: Manual verification (requires a browser with camera access — not automatable in this environment)**

Run: `npm run dev`, open the printed URL on a phone or webcam-equipped laptop over HTTPS/localhost.
Expected:
- Point the camera at the RUT901 label, tap "Capture PASSWORD".
- Button shows "Reading..." with a spinning camera icon while OCR runs.
- Result screen shows `iQ+0?4Ua` (not `Dv10CuPa`, not `6008869606`).
- If the label isn't in frame, the red "PASSWORD field not detected" banner appears and the button re-enables for retry.

- [ ] **Step 8: Commit**

```bash
git add src/components/CameraScanner.tsx package.json package-lock.json
git commit -m "feat: add OCR capture button to read the PASSWORD field from label text"
```
