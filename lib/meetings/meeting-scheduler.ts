import { MeetingSchedule, CalculatedMeetingOccurrence, LeaveRequest, MeetingType } from '@/types';
import { formatDisplayDate } from '@/lib/utils/date-utils';

/**
 * Helper to add days to a YYYY-MM-DD date string safely without timezone drift
 */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const d = new Date(year, month - 1, day, 12, 0, 0);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Checks if a given YYYY-MM-DD date is Sunday
 */
export function isSundayDate(dateKey: string): boolean {
  const [year, month, day] = dateKey.split('-').map(Number);
  const d = new Date(year, month - 1, day, 12, 0, 0);
  return d.getDay() === 0;
}

/**
 * Finds any approved employee leave requests covering the given dateKey
 */
export function getApprovedLeavesForDate(dateKey: string, leaves: LeaveRequest[]): LeaveRequest[] {
  return leaves.filter((l) => {
    if (l.status !== 'approved') return false;
    return l.start_date <= dateKey && l.end_date >= dateKey;
  });
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  isSunday: boolean;
  conflictingLeaves: LeaveRequest[];
  conflictingEmployeeNames: string[];
  conflictReason?: string;
}

/**
 * Evaluates whether a date has a Sunday or Approved Leave conflict
 */
export function checkDateConflict(dateKey: string, leaves: LeaveRequest[]): ConflictCheckResult {
  const isSunday = isSundayDate(dateKey);
  const conflictingLeaves = getApprovedLeavesForDate(dateKey, leaves);
  const conflictingEmployeeNames = Array.from(
    new Set(conflictingLeaves.map((l) => l.user?.full_name || 'Employee'))
  );

  const hasConflict = isSunday || conflictingLeaves.length > 0;

  let conflictReason: string | undefined;
  if (isSunday && conflictingLeaves.length > 0) {
    conflictReason = `Sunday and approved leave for ${conflictingEmployeeNames.join(', ')}`;
  } else if (isSunday) {
    conflictReason = 'Sunday';
  } else if (conflictingLeaves.length > 0) {
    conflictReason = `approved leave (${conflictingEmployeeNames.join(', ')})`;
  }

  return {
    hasConflict,
    isSunday,
    conflictingLeaves,
    conflictingEmployeeNames,
    conflictReason,
  };
}

/**
 * Resolves a scheduled candidate date forward until a non-conflicting working day is found.
 * Safeguarded against infinite loops with maxShiftDays (default: 60 days).
 */
export function resolveValidMeetingDate(
  initialCandidateDate: string,
  leaves: LeaveRequest[],
  maxShiftDays: number = 60
): {
  actualDate: string;
  isShifted: boolean;
  shiftDays: number;
  initialConflictReason?: string;
  shiftReason?: string;
  conflictDetails?: CalculatedMeetingOccurrence['conflict_details'];
} {
  let candidate = initialCandidateDate;
  let shiftDays = 0;
  let initialConflict: ConflictCheckResult | null = null;
  const encounteredReasons: string[] = [];
  const encounteredEmployees: Set<string> = new Set();

  while (shiftDays < maxShiftDays) {
    const check = checkDateConflict(candidate, leaves);
    if (!check.hasConflict) {
      break;
    }

    if (!initialConflict) {
      initialConflict = check;
    }

    if (check.isSunday) encounteredReasons.push('Sunday');
    if (check.conflictingLeaves.length > 0) {
      encounteredReasons.push('approved leave');
      check.conflictingEmployeeNames.forEach((name) => encounteredEmployees.add(name));
    }

    // Move to the next day
    candidate = addDaysToDateKey(candidate, 1);
    shiftDays += 1;
  }

  const isShifted = shiftDays > 0;
  let shiftReason: string | undefined;

  if (isShifted && initialConflict) {
    const empList = Array.from(encounteredEmployees);
    const empText = empList.length > 0 ? ` (${empList.join(', ')})` : '';
    const mainCause = encounteredReasons.includes('Sunday') && empList.length > 0
      ? `Sunday and approved leave${empText}`
      : encounteredReasons.includes('Sunday')
      ? 'Sunday'
      : `approved leave${empText}`;

    shiftReason = `Moved from ${formatDisplayDate(initialCandidateDate)} → ${formatDisplayDate(candidate)} because of ${mainCause}.`;
  }

  return {
    actualDate: candidate,
    isShifted,
    shiftDays,
    initialConflictReason: initialConflict?.conflictReason,
    shiftReason,
    conflictDetails: isShifted
      ? {
          type: encounteredReasons.includes('Sunday') && encounteredEmployees.size > 0
            ? 'multiple'
            : encounteredReasons.includes('Sunday')
            ? 'sunday'
            : 'leave',
          description: shiftReason || '',
          conflictingEmployeeNames: Array.from(encounteredEmployees),
        }
      : undefined,
  };
}

/**
 * Calculates recurring occurrences for a single meeting schedule across a target date range.
 * 
 * CRITICAL RULE:
 * Subsequent meeting calculated_date is ALWAYS calculated as:
 * next_date = previous_actual_meeting_date + frequency_days
 * 
 * Never calculate from unshifted original dates.
 */
export function calculateScheduleOccurrences(
  schedule: MeetingSchedule,
  leaves: LeaveRequest[],
  rangeStart: string = '2026-10-01',
  rangeEnd: string = '2027-12-31',
  maxOccurrences: number = 100
): CalculatedMeetingOccurrence[] {
  if (!schedule.is_active || !schedule.first_meeting_date) {
    return [];
  }

  const occurrences: CalculatedMeetingOccurrence[] = [];
  let previousActualDate: string | null = null;
  let cycleIndex = 0;

  while (cycleIndex < maxOccurrences) {
    let calculatedDate: string;

    if (cycleIndex === 0) {
      // First meeting instance begins on first_meeting_date
      calculatedDate = schedule.first_meeting_date;
    } else {
      // Subsequent instances strictly calculate from previous ACTUAL meeting date
      calculatedDate = addDaysToDateKey(previousActualDate!, schedule.frequency_days);
    }

    // Resolve date with Sunday and approved leave conflict rules
    const resolved = resolveValidMeetingDate(calculatedDate, leaves);
    const actualDate = resolved.actualDate;

    // Record occurrence if within the upper bound
    if (actualDate > rangeEnd) {
      break;
    }

    if (actualDate >= rangeStart) {
      occurrences.push({
        id: `meeting-${schedule.meeting_type}-${cycleIndex}-${actualDate}`,
        schedule_id: schedule.id,
        meeting_type: schedule.meeting_type,
        title: schedule.title || (schedule.meeting_type === 'tactical' ? 'Tactical Meeting' : 'Strategic Meeting'),
        meeting_time: schedule.meeting_time,
        description: schedule.description,
        cycle_index: cycleIndex,
        calculated_date: calculatedDate,
        actual_date: actualDate,
        is_shifted: resolved.isShifted,
        shift_reason: resolved.shiftReason,
        conflict_details: resolved.conflictDetails,
      });
    }

    // CRITICAL: Next cycle MUST use this actual meeting date!
    previousActualDate = actualDate;
    cycleIndex += 1;
  }

  return occurrences;
}

/**
 * Calculates next upcoming meeting occurrence for a given schedule relative to referenceDate
 */
export function getNextUpcomingMeeting(
  schedule: MeetingSchedule,
  leaves: LeaveRequest[],
  referenceDate: string = '2026-10-01'
): CalculatedMeetingOccurrence | null {
  const occurrences = calculateScheduleOccurrences(schedule, leaves, referenceDate, '2027-12-31', 50);
  const next = occurrences.find((o) => o.actual_date >= referenceDate);
  return next || occurrences[0] || null;
}
