const DAY_MS = 86_400_000;

/** Local calendar date as YYYY-MM-DD. */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** Parses YYYY-MM-DD as local midnight (avoids the UTC shift of `new Date('2026-11-04')`). */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** Whole days from `fromISO` to `toISO`; negative when `toISO` is earlier. */
export function daysBetween(fromISO: string, toISO: string): number {
  const from = parseISODate(fromISO).getTime();
  const to = parseISODate(toISO).getTime();
  return Math.round((to - from) / DAY_MS);
}

export function shiftISODate(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const monthDayYear = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const timeOfDay = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** "Nov 4", or "Nov 4, 2027" when the year differs from today's. */
export function formatShortDate(iso: string, today = todayISO()): string {
  const d = parseISODate(iso);
  const sameYear = d.getFullYear() === parseISODate(today).getFullYear();
  return (sameYear ? monthDay : monthDayYear).format(d);
}

export function formatLongDate(iso: string): string {
  return monthDayYear.format(parseISODate(iso));
}

export type DeadlineTone = 'neutral' | 'soon' | 'overdue';

export interface DeadlineInfo {
  /** Short label for a card pill. */
  label: string;
  /** Longer wording for the task view. */
  detail: string;
  tone: DeadlineTone;
}

export function describeDeadline(deadline: string | null, today = todayISO()): DeadlineInfo {
  if (!deadline) return { label: 'No deadline', detail: 'No deadline set', tone: 'neutral' };
  const diff = daysBetween(today, deadline);
  const short = formatShortDate(deadline, today);
  const long = formatLongDate(deadline);
  if (diff < 0) {
    const n = -diff;
    return { label: `Overdue · ${short}`, detail: `${long} · ${n} ${n === 1 ? 'day' : 'days'} overdue`, tone: 'overdue' };
  }
  if (diff === 0) return { label: 'Today', detail: `${long} · due today`, tone: 'soon' };
  if (diff === 1) return { label: 'Tomorrow', detail: `${long} · due tomorrow`, tone: 'soon' };
  return { label: short, detail: `${long} · in ${diff} days`, tone: 'neutral' };
}

export interface InWorkInfo {
  days: number;
  /** "6d in work" for cards. */
  short: string;
  /** "6 days in work" for the task view. */
  long: string;
}

export function describeInWork(startedAt: string, today = todayISO()): InWorkInfo {
  const days = Math.max(0, daysBetween(startedAt, today));
  if (days === 0) return { days, short: 'Started today', long: 'Started today' };
  const unit = days === 1 ? 'day' : 'days';
  return { days, short: `${days}d in work`, long: `${days} ${unit} in work` };
}

/** "Today, 09:05", "Yesterday, 16:40", "Oct 24, 10:12". */
export function formatDateTime(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const time = timeOfDay.format(d);
  const dayDiff = daysBetween(toISODate(d), toISODate(now));
  if (dayDiff === 0) return `Today, ${time}`;
  if (dayDiff === 1) return `Yesterday, ${time}`;
  const sameYear = d.getFullYear() === now.getFullYear();
  return `${(sameYear ? monthDay : monthDayYear).format(d)}, ${time}`;
}
