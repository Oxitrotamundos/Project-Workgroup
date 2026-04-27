import { describe, it, expect } from 'vitest';
import { toGanttId } from '../ganttDataProvider';

describe('toGanttId', () => {
  it('converts numeric strings to numbers (matches what the lib does internally)', () => {
    expect(toGanttId('123')).toBe(123);
    expect(toGanttId('1')).toBe(1);
    expect(toGanttId('0')).toBe(0);
  });

  it('keeps numbers as numbers', () => {
    expect(toGanttId(42)).toBe(42);
  });

  it('returns undefined for null, undefined, and empty string', () => {
    expect(toGanttId(null)).toBeUndefined();
    expect(toGanttId(undefined)).toBeUndefined();
    expect(toGanttId('')).toBeUndefined();
  });

  it('preserves non-numeric strings as-is (e.g. temp:// ids)', () => {
    expect(toGanttId('temp://abc')).toBe('temp://abc');
    expect(toGanttId('uuid-xxx')).toBe('uuid-xxx');
  });

  it('handles bigints by converting to number when safe', () => {
    expect(toGanttId(123n)).toBe(123);
  });

  it('falls back to string when numeric value exceeds Number.MAX_SAFE_INTEGER', () => {
    const huge = '9007199254740993'; // > 2^53
    expect(toGanttId(huge)).toBe(huge);
  });
});
