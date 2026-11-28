import { describe, expect, it } from 'vitest';
import { applyKeypadKey, applyKeypadKeyToNumber, type KeypadKey } from './keypad';

const typeKeys = (keys: KeypadKey[]) => keys.reduce((text, key) => applyKeypadKey(text, key, false, { isDecimal: true }), '');

describe('applyKeypadKey', () => {
  it('appends digits and drops leading zeros', () => {
    expect(typeKeys(['0', '5'])).toBe('5');
    expect(typeKeys(['1', '2'])).toBe('12');
  });

  it('starts a weight with "0," and allows only one comma', () => {
    expect(typeKeys([',', '7', '5', ','])).toBe('0,75');
  });

  it('caps the decimals', () => {
    expect(typeKeys(['1', ',', '2', '5', '0', '9'])).toBe('1,250');
  });

  it('ignores the comma on whole-number fields', () => {
    expect(applyKeypadKey('12', ',', false)).toBe('12');
  });

  it('replaces the text on the first key after the field is picked', () => {
    expect(applyKeypadKey('1,5', '2', true, { isDecimal: true })).toBe('2');
    expect(applyKeypadKey('1,5', 'back', true, { isDecimal: true })).toBe('');
  });

  it('erases one character', () => {
    expect(applyKeypadKey('1,5', 'back', false)).toBe('1,');
    expect(applyKeypadKey('', 'back', false)).toBe('');
  });

  it('ignores digits past the limit', () => {
    expect(applyKeypadKey('99', '9', false, { maxDigits: 2 })).toBe('99');
  });
});

describe('applyKeypadKeyToNumber', () => {
  it('builds Rupiah with the 000 key', () => {
    let value = applyKeypadKeyToNumber(null, '2', false);
    value = applyKeypadKeyToNumber(value, '5', false);
    value = applyKeypadKeyToNumber(value, '000', false);
    expect(value).toBe(25_000);
  });

  it('erases to empty (null)', () => {
    expect(applyKeypadKeyToNumber(5, 'back', false)).toBeNull();
  });

  it('a fresh field starts over', () => {
    expect(applyKeypadKeyToNumber(50_000, '1', true)).toBe(1);
  });

  it('a lone 0 stays 0 so "Rp0" can still be typed', () => {
    expect(applyKeypadKeyToNumber(null, '0', false)).toBe(0);
    expect(applyKeypadKeyToNumber(0, '000', false)).toBe(0);
  });
});
