/**
 * Date Utilities for OfficeFlow Calendar
 * Strict string-based and local-calendar math to prevent timezone drift.
 */

export const APP_MIN_DATE = '2026-10-01';
export const APP_MAX_DATE = '2027-12-31';

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const MONTH_SHORT_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const FULL_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Format a Date object to YYYY-MM-DD string using local calendar
 */
export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse YYYY-MM-DD to safe local Date (noon to avoid DST/midnight shift)
 */
export function parseDateKey(dateStr: string): Date {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return new Date();
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return new Date(year, month, day, 12, 0, 0);
}

/**
 * Format date string into human readable format like "08 Oct 2026"
 */
export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = parseDateKey(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = MONTH_SHORT_NAMES[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Format date range e.g. "15 Oct 2026 → 17 Oct 2026" or "08 Oct 2026 (Single Day)"
 */
export function formatDateRange(startDate: string, endDate: string): string {
  if (!startDate) return '';
  if (!endDate || startDate === endDate) {
    return formatDisplayDate(startDate);
  }
  return `${formatDisplayDate(startDate)} → ${formatDisplayDate(endDate)}`;
}

/**
 * Calculate total inclusive days between start and end date
 */
export function calculateDaysCount(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  const start = parseDateKey(startDate).getTime();
  const end = parseDateKey(endDate).getTime();
  if (end < start) return 0;
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
}

/**
 * Calculate working days (excluding Saturdays and Sundays)
 */
export function calculateWorkingDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  let current = parseDateKey(startDate);
  const end = parseDateKey(endDate);
  if (end < current) return 0;

  let count = 0;
  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1, 12, 0, 0);
  }
  return count;
}

export function isDateInRange(dateStr: string, startDate: string, endDate: string): boolean {
  return dateStr >= startDate && dateStr <= endDate;
}

export function isWithinAppRange(dateStr: string): boolean {
  return dateStr >= APP_MIN_DATE && dateStr <= APP_MAX_DATE;
}

export function canNavigatePrev(year: number, month: number): boolean {
  if (year < 2026) return false;
  if (year === 2026 && month <= 9) return false;
  return true;
}

export function canNavigateNext(year: number, month: number): boolean {
  if (year > 2027) return false;
  if (year === 2027 && month >= 11) return false;
  return true;
}

export interface CalendarGridDay {
  dateKey: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSunday: boolean;
  isWeekend: boolean;
  isWithinBounds: boolean;
}

export function generateMonthGrid(year: number, month: number, todayKey: string = '2026-10-01'): CalendarGridDay[] {
  const firstDayOfMonth = new Date(year, month, 1, 12, 0, 0);
  const lastDayOfMonth = new Date(year, month + 1, 0, 12, 0, 0);

  const startDayOfWeek = firstDayOfMonth.getDay();
  const totalDaysInMonth = lastDayOfMonth.getDate();

  const grid: CalendarGridDay[] = [];

  // Previous month padding
  const prevMonthLastDay = new Date(year, month, 0, 12, 0, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const day = prevMonthLastDay - i;
    const prevDate = new Date(year, month - 1, day, 12, 0, 0);
    const key = formatDateKey(prevDate);
    const dayOfWeek = prevDate.getDay();
    grid.push({
      dateKey: key,
      dayNumber: day,
      isCurrentMonth: false,
      isToday: key === todayKey,
      isSunday: dayOfWeek === 0,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      isWithinBounds: isWithinAppRange(key),
    });
  }

  // Current month days
  for (let day = 1; day <= totalDaysInMonth; day++) {
    const currentDate = new Date(year, month, day, 12, 0, 0);
    const key = formatDateKey(currentDate);
    const dayOfWeek = currentDate.getDay();
    grid.push({
      dateKey: key,
      dayNumber: day,
      isCurrentMonth: true,
      isToday: key === todayKey,
      isSunday: dayOfWeek === 0,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      isWithinBounds: isWithinAppRange(key),
    });
  }

  // Next month padding
  const remainingCells = (7 - (grid.length % 7)) % 7;
  for (let day = 1; day <= remainingCells; day++) {
    const nextDate = new Date(year, month + 1, day, 12, 0, 0);
    const key = formatDateKey(nextDate);
    const dayOfWeek = nextDate.getDay();
    grid.push({
      dateKey: key,
      dayNumber: day,
      isCurrentMonth: false,
      isToday: key === todayKey,
      isSunday: dayOfWeek === 0,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      isWithinBounds: isWithinAppRange(key),
    });
  }

  return grid;
}
