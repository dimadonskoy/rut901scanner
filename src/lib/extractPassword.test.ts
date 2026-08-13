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

  it('tolerates OCR noise characters before the PASSWORD label', () => {
    expect(extractPasswordField('| PASSWORD iQ+0?4Ua')).toBe('iQ+0?4Ua');
  });

  it('finds PASSWORD mid-line after another field', () => {
    expect(extractPasswordField('USERNAME admin PASSWORD iQ+0?4Ua')).toBe('iQ+0?4Ua');
  });

  it('still skips WIFI PASSWORD even with noise prefix', () => {
    expect(extractPasswordField('. WIFI PASSWORD Dv10CuPa')).toBeNull();
  });
});
