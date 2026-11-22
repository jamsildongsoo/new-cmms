import {
  businessDate,
  isBusinessDate,
  monthAfter,
  monthValue,
} from './date.util';

describe('business calendar dates', () => {
  it('rejects calendar overflow and accepts actual leap days', () => {
    for (const value of [
      '20260229',
      '20260431',
      '20261301',
      '20260001',
      '20260100',
      '2026-01-01',
    ]) {
      expect(isBusinessDate(value)).toBe(false);
      expect(() => businessDate(value)).toThrow();
    }
    expect(businessDate('20240229')).toBe('20240229');
    expect(businessDate('00990228')).toBe('00990228');
  });
  it('distinguishes optional dates from required dates', () => {
    for (const value of [null, undefined, '']) {
      expect(businessDate(value, true)).toBeNull();
      expect(() => businessDate(value)).toThrow();
    }
    expect(() => businessDate('20260229', false, 'workDate')).toThrow(
      'workDate must be a valid date',
    );
  });
  it('moves months across year boundaries without applying a time zone', () => {
    expect(monthAfter('202612')).toBe('202701');
    expect(monthAfter('202601', -1)).toBe('202512');
    expect(() => monthValue('202613')).toThrow();
  });
});
