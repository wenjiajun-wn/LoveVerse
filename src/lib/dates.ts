const DAY = 86400000;
export function dateValue(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('请输入有效日期');
  const stamp = Date.parse(value + 'T00:00:00Z');
  if (!Number.isFinite(stamp) || new Date(stamp).toISOString().slice(0, 10) !== value)
    throw new Error('请输入有效日期');
  return stamp;
}
export function todayInShanghai(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
export function daysBetween(start: string, end: string): number {
  return Math.round((dateValue(end) - dateValue(start)) / DAY);
}
export function nextAnniversary(date: string, today: string): string {
  dateValue(date);
  dateValue(today);
  let year = Number(today.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8));
  const candidate = (y: number) =>
    new Date(Date.UTC(y, month - 1, Math.min(day, new Date(Date.UTC(y, month, 0)).getUTCDate())))
      .toISOString()
      .slice(0, 10);
  if (candidate(year) < today) year++;
  return candidate(year);
}
