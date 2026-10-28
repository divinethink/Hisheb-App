import { describe, expect, it } from 'vitest';
import { checkContractMeta, hasPdfMagic, MAX_CONTRACT_BYTES, safeContractName, CONTRACT_NAME_MAX } from './contractFile';

describe('checkContractMeta', () => {
  it('accepts a PDF up to 10 MB', () => {
    expect(checkContractMeta({ name: 'a.pdf', type: 'application/pdf', size: 1000 })).toBeNull();
    expect(checkContractMeta({ name: 'a.pdf', type: 'application/pdf', size: MAX_CONTRACT_BYTES })).toBeNull();
  });
  it('accepts empty type when name ends with .pdf (some phones)', () => {
    expect(checkContractMeta({ name: 'Scan.PDF', type: '', size: 10 })).toBeNull();
  });
  it('rejects non-PDF, oversize, empty', () => {
    expect(checkContractMeta({ name: 'a.jpg', type: 'image/jpeg', size: 10 })).toBe('not_pdf');
    expect(checkContractMeta({ name: 'a.pdf', type: 'application/pdf', size: MAX_CONTRACT_BYTES + 1 })).toBe('too_big');
    expect(checkContractMeta({ name: 'a.pdf', type: 'application/pdf', size: 0 })).toBe('empty');
  });
});

describe('hasPdfMagic', () => {
  it('detects %PDF-', () => {
    expect(hasPdfMagic(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]))).toBe(true);
    expect(hasPdfMagic(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]))).toBe(false);
    expect(hasPdfMagic(new Uint8Array([0x25, 0x50]))).toBe(false);
  });
});

describe('safeContractName', () => {
  it('cleans separators/control chars and falls back when empty', () => {
    expect(safeContractName('  a/b\\c\n.pdf ')).toBe('a b c .pdf');
    expect(safeContractName('   ')).toBe('contract.pdf');
  });
  it('limits length and keeps .pdf', () => {
    const n = safeContractName('x'.repeat(300) + '.pdf');
    expect(n.length).toBeLessThanOrEqual(CONTRACT_NAME_MAX);
    expect(n.endsWith('.pdf')).toBe(true);
  });
});
