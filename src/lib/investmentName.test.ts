import { describe, expect, it } from 'vitest';
import {
  baseInvestmentName,
  companyNameTaken,
  composeInvestmentName,
  hasTrailingRoundTag,
  lastRoundForCompany,
  mediumSuggestions,
  parseRoundInput,
  stripRoundTag,
} from './investmentName';

describe('composeInvestmentName / baseInvestmentName', () => {
  it('adds [n] only when round exists', () => {
    expect(composeInvestmentName(' Apon Bazaar ', 9)).toBe('Apon Bazaar [9]');
    expect(composeInvestmentName('Apon Bazaar', null)).toBe('Apon Bazaar');
  });
  it('strips only the exact suffix; legacy names untouched', () => {
    expect(baseInvestmentName('Apon Bazaar [9]', 9)).toBe('Apon Bazaar');
    expect(baseInvestmentName('Apon Bazaar [9]', null)).toBe('Apon Bazaar [9]');
    expect(baseInvestmentName('Apon Bazaar [9]', 7)).toBe('Apon Bazaar [9]');
    expect(baseInvestmentName('Apon Bazaar', undefined)).toBe('Apon Bazaar');
  });
});

describe('round input', () => {
  it('parses blank / digits / invalid', () => {
    expect(parseRoundInput('')).toBeNull();
    expect(parseRoundInput(' 9 ')).toBe(9);
    expect(parseRoundInput('0')).toBe('invalid');
    expect(parseRoundInput('-1')).toBe('invalid');
    expect(parseRoundInput('1.5')).toBe('invalid');
    expect(parseRoundInput('abc')).toBe('invalid');
    expect(parseRoundInput('1000')).toBe('invalid');
  });
  it('detects a hand-typed trailing [n]', () => {
    expect(hasTrailingRoundTag('Apon Bazaar [9]')).toBe(true);
    expect(hasTrailingRoundTag('Apon Bazaar')).toBe(false);
    expect(hasTrailingRoundTag('[9] Apon')).toBe(false);
  });
});

describe('lastRoundForCompany', () => {
  const inv = [
    { companyId: 'a', round: 7, date: '2026-03-12' },
    { companyId: 'a', round: 8, date: '2026-07-01' },
    { companyId: 'a', round: null, date: '2026-09-01' },
    { companyId: 'b', round: 3, date: '2026-10-01' },
  ];
  it('picks the latest by date among entries with a round, ignores other companies', () => {
    expect(lastRoundForCompany(inv, 'a')).toBe(8);
    expect(lastRoundForCompany(inv, 'b')).toBe(3);
    expect(lastRoundForCompany(inv, 'zzz')).toBeNull();
  });
  it('can exclude the entry being edited', () => {
    expect(lastRoundForCompany(inv, 'a', inv[1])).toBe(7);
  });
});

describe('mediumSuggestions', () => {
  const used = ['biniyog.io', 'Bank', 'biniyog.io', 'bKash', '', '  '];
  it('company medium first, then most used; never invents', () => {
    expect(mediumSuggestions(used, 'bKash', '')).toEqual(['bKash', 'biniyog.io', 'Bank']);
    expect(mediumSuggestions(used, '', '')).toEqual(['biniyog.io', 'Bank', 'bKash']);
    expect(mediumSuggestions([], '', '')).toEqual([]);
  });
  it('filters by typed text and drops an exact match', () => {
    expect(mediumSuggestions(used, '', 'bin')).toEqual(['biniyog.io']);
    expect(mediumSuggestions(used, '', 'biniyog.io')).toEqual([]);
  });
});

describe('companyNameTaken', () => {
  const cs = [{ id: '1', name: 'Apon Bazaar' }];
  it('case-insensitive, excludes self', () => {
    expect(companyNameTaken(cs, ' apon bazaar ')).toBe(true);
    expect(companyNameTaken(cs, 'apon bazaar', '1')).toBe(false);
    expect(companyNameTaken(cs, 'Synod Electric')).toBe(false);
  });
});

describe('stripRoundTag', () => {
  it('শুধু ব্যাজের জন্য শেষের [n] বাদ; আর কিছু অক্ষত', () => {
    expect(stripRoundTag('Apon Bazaar [9]')).toBe('Apon Bazaar');
    expect(stripRoundTag('Apon Bazaar')).toBe('Apon Bazaar');
    expect(stripRoundTag('[9]')).toBe('[9]');
  });
});
