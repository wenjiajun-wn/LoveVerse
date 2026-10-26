import { describe, expect, it } from 'vitest';
import { dateValue, daysBetween, nextAnniversary, todayInShanghai } from '../../src/lib/dates';
describe('上海日期与纪念日', () => {
  it('按日历天计算，跨年不丢失一天', () => {
    expect(daysBetween('2024-12-31', '2025-01-01')).toBe(1);
    expect(daysBetween('2024-05-20', '2024-05-20')).toBe(0);
  });
  it('上海午夜日期不依赖浏览器时区', () => {
    expect(todayInShanghai(new Date('2026-10-25T16:01:00Z'))).toBe('2026-10-26');
  });
  it('纪念日当天不跳到下一年', () => {
    expect(nextAnniversary('2024-05-20', '2026-05-20')).toBe('2026-05-20');
  });
  it('已经过去的周年滚动到下一年', () => {
    expect(nextAnniversary('2024-05-20', '2026-10-26')).toBe('2027-05-20');
  });
  it('闰日周年平年使用二月最后一天', () => {
    expect(nextAnniversary('2024-02-29', '2025-01-01')).toBe('2025-02-28');
    expect(nextAnniversary('2024-02-29', '2028-01-01')).toBe('2028-02-29');
  });
  it('拒绝不存在或格式错误的日期', () => {
    expect(() => dateValue('2025-02-29')).toThrow();
    expect(() => dateValue('invalid')).toThrow();
  });
});
