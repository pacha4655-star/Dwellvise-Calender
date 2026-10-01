import {
  UserProfile,
  LeaveRequest,
  GovernmentHoliday,
  ManualCalendarEvent,
  LeaveBalance,
  CalendarEvent,
  CalendarFilter,
  AppNotification,
  ReportSummary,
  LeaveType,
  ManualEventType,
} from '@/types';
import { INITIAL_USERS } from './initial-users';
import { INITIAL_HOLIDAYS } from './holidays-data';
import { INITIAL_LEAVES } from './initial-leaves';
import { INITIAL_MENTIONS } from './initial-mentions';
import { calculateDaysCount, calculateWorkingDays, formatDisplayDate } from '@/lib/utils/date-utils';
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';

const STORAGE_KEY_USERS = 'officeflow_users_v2';
const STORAGE_KEY_LEAVES = 'officeflow_leaves_v2';
const STORAGE_KEY_HOLIDAYS = 'officeflow_holidays_v2';
const STORAGE_KEY_MENTIONS = 'officeflow_mentions_v2';
const STORAGE_KEY_NOTIFICATIONS = 'officeflow_notifications_v2';

// In-Memory State
let memoryUsers: UserProfile[] = [...INITIAL_USERS];
let memoryLeaves: LeaveRequest[] = [...INITIAL_LEAVES];
let memoryHolidays: GovernmentHoliday[] = [...INITIAL_HOLIDAYS];
let memoryMentions: ManualCalendarEvent[] = [...INITIAL_MENTIONS];
let memoryNotifications: AppNotification[] = [
  {
    id: 'notif-1',
    userId: '00000000-0000-0000-0000-000000000001',
    title: 'New Leave Request',
    message: 'Reshma Banu submitted a Casual Leave request for Oct 26 - Oct 27.',
    type: 'info',
    isRead: false,
    createdAt: '2026-10-01T08:45:00Z',
    link: '/admin/leave-requests',
  },
];

type Listener = () => void;
const listeners: Set<Listener> = new Set();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

/**
 * Initialize data store from localStorage if running in browser
 */
export function initializeStore() {
  if (typeof window === 'undefined') return;

  try {
    const storedUsers = localStorage.getItem(STORAGE_KEY_USERS);
    if (storedUsers) {
      memoryUsers = JSON.parse(storedUsers);
    } else {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(INITIAL_USERS));
    }

    const storedLeaves = localStorage.getItem(STORAGE_KEY_LEAVES);
    if (storedLeaves) {
      memoryLeaves = JSON.parse(storedLeaves);
    } else {
      localStorage.setItem(STORAGE_KEY_LEAVES, JSON.stringify(INITIAL_LEAVES));
    }

    const storedHolidays = localStorage.getItem(STORAGE_KEY_HOLIDAYS);
    if (storedHolidays) {
      memoryHolidays = JSON.parse(storedHolidays);
    } else {
      localStorage.setItem(STORAGE_KEY_HOLIDAYS, JSON.stringify(INITIAL_HOLIDAYS));
    }

    const storedMentions = localStorage.getItem(STORAGE_KEY_MENTIONS);
    if (storedMentions) {
      memoryMentions = JSON.parse(storedMentions);
    } else {
      localStorage.setItem(STORAGE_KEY_MENTIONS, JSON.stringify(INITIAL_MENTIONS));
    }

    const storedNotifications = localStorage.getItem(STORAGE_KEY_NOTIFICATIONS);
    if (storedNotifications) {
      memoryNotifications = JSON.parse(storedNotifications);
    }
  } catch (err) {
    console.warn('Error reading from localStorage:', err);
  }
}

function persistStore() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(memoryUsers));
    localStorage.setItem(STORAGE_KEY_LEAVES, JSON.stringify(memoryLeaves));
    localStorage.setItem(STORAGE_KEY_HOLIDAYS, JSON.stringify(memoryHolidays));
    localStorage.setItem(STORAGE_KEY_MENTIONS, JSON.stringify(memoryMentions));
    localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(memoryNotifications));
  } catch (err) {
    console.warn('Error saving to localStorage:', err);
  }
  notifyListeners();
}

export function subscribeToStore(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ==============================================================================
// GETTERS
// ==============================================================================

export function getUsers(): UserProfile[] {
  return [...memoryUsers];
}

export function getUserById(id: string): UserProfile | undefined {
  return memoryUsers.find((u) => u.id === id);
}

export function getLeaves(): LeaveRequest[] {
  return memoryLeaves.map((leave) => ({
    ...leave,
    user: memoryUsers.find((u) => u.id === leave.user_id),
    approver: leave.approved_by ? memoryUsers.find((u) => u.id === leave.approved_by) : undefined,
  }));
}

export function getLeaveById(id: string): LeaveRequest | undefined {
  const leave = memoryLeaves.find((l) => l.id === id);
  if (!leave) return undefined;
  return {
    ...leave,
    user: memoryUsers.find((u) => u.id === leave.user_id),
    approver: leave.approved_by ? memoryUsers.find((u) => u.id === leave.approved_by) : undefined,
  };
}

export function getHolidays(): GovernmentHoliday[] {
  return [...memoryHolidays].sort((a, b) => a.date.localeCompare(b.date));
}

export function getMentions(): ManualCalendarEvent[] {
  return memoryMentions
    .map((m) => ({
      ...m,
      creator: memoryUsers.find((u) => u.id === m.created_by),
    }))
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
}

export function getNotifications(userId: string): AppNotification[] {
  return memoryNotifications
    .filter((n) => n.userId === userId || n.userId === 'all')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ==============================================================================
// CALENDAR EVENT GENERATION (PRIORITY & VISIBILITY ENFORCED)
// ==============================================================================

/**
 * Generate Unified Calendar Events following the exact priority rules:
 * 1. Sunday / Government Holiday -> Single Soft Red color
 * 2. Manual Admin Calendar Mentions -> Professional Indigo/Slate color
 * 3. Leaves marked `show_on_calendar = true` AND `status = 'approved'` -> Leave color
 * 4. Hidden leaves (show_on_calendar = false), Pending leaves, Rejected leaves -> NEVER shown on shared calendar
 */
export function getCalendarEvents(
  currentUserId: string,
  currentUserRole: 'employee' | 'admin',
  filter?: Partial<CalendarFilter>
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  // 1. Add Government Holidays
  if (filter?.showHolidays !== false) {
    memoryHolidays.forEach((holiday) => {
      if (filter?.searchQuery) {
        const query = filter.searchQuery.toLowerCase();
        if (
          !holiday.name.toLowerCase().includes(query) &&
          !holiday.description.toLowerCase().includes(query)
        ) {
          return;
        }
      }

      events.push({
        id: `event-${holiday.id}`,
        type: 'holiday',
        title: holiday.name,
        startDate: holiday.date,
        endDate: holiday.date,
        isHoliday: true,
        holidayType: holiday.holiday_type,
        description: holiday.description,
        rawHoliday: holiday,
      });
    });
  }

  // 2. Add Manual Admin Calendar Mentions
  if (filter?.showMentions !== false) {
    const allMentions = getMentions();
    allMentions.forEach((mention) => {
      if (filter?.searchQuery) {
        const query = filter.searchQuery.toLowerCase();
        const t = mention.title.toLowerCase();
        const d = (mention.description || '').toLowerCase();
        if (!t.includes(query) && !d.includes(query)) {
          return;
        }
      }

      events.push({
        id: `event-${mention.id}`,
        type: 'mention',
        title: mention.title,
        startDate: mention.start_date,
        endDate: mention.end_date,
        manualEventType: mention.event_type,
        description: mention.description,
        rawMention: mention,
      });
    });
  }

  // 3. Add Shared Leaves (STRICT VISIBILITY: status === 'approved' AND show_on_calendar === true)
  const allLeaves = getLeaves();

  allLeaves.forEach((leave) => {
    // CRITICAL REQUIREMENT:
    // Only approved leaves marked explicitly with show_on_calendar = true appear on the shared calendar.
    // Pending leaves, rejected leaves, and hidden leaves (show_on_calendar = false) DO NOT appear.
    if (leave.status !== 'approved' || !leave.show_on_calendar) {
      return;
    }

    const user = leave.user;
    const isOwn = leave.user_id === currentUserId;
    const isAdmin = currentUserRole === 'admin';

    // Filters
    if (filter?.selectedUser && filter.selectedUser !== 'all' && leave.user_id !== filter.selectedUser) {
      return;
    }
    if (filter?.selectedLeaveType && filter.selectedLeaveType !== 'all' && leave.leave_type !== filter.selectedLeaveType) {
      return;
    }
    if (filter?.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      const userName = user?.full_name?.toLowerCase() || '';
      const lType = leave.leave_type.toLowerCase();
      if (!userName.includes(query) && !lType.includes(query)) {
        return;
      }
    }

    events.push({
      id: `event-${leave.id}`,
      type: 'leave',
      title: `${user?.full_name || 'Employee'} - ${leave.leave_type}`,
      startDate: leave.start_date,
      endDate: leave.end_date,
      leaveType: leave.leave_type,
      status: leave.status,
      showOnCalendar: leave.show_on_calendar,
      userId: leave.user_id,
      userName: user?.full_name || 'Employee',
      userDepartment: user?.department,
      userRole: user?.role,
      // PRIVACY RULE: Show confidential reason only if own leave or admin
      reason: isOwn || isAdmin ? leave.reason : undefined,
      isOwnLeave: isOwn,
      rawLeave: leave,
    });
  });

  return events;
}

// ==============================================================================
// LEAVE ACTIONS (APPLY, APPROVE, REJECT, TOGGLE VISIBILITY, CANCEL)
// ==============================================================================

export interface ApplyLeavePayload {
  userId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
}

export async function applyLeave(payload: ApplyLeavePayload): Promise<{ success: boolean; message: string; leave?: LeaveRequest }> {
  const { userId, leaveType, startDate, endDate, reason } = payload;

  if (!userId || !leaveType || !startDate || !endDate || !reason.trim()) {
    return { success: false, message: 'Please fill in all required fields.' };
  }

  if (endDate < startDate) {
    return { success: false, message: 'End date cannot be earlier than start date.' };
  }

  const user = getUserById(userId);
  if (!user) {
    return { success: false, message: 'Employee profile not found.' };
  }

  // Check for duplicate / overlapping active requests
  const existingOverlap = memoryLeaves.find(
    (l) =>
      l.user_id === userId &&
      (l.status === 'pending' || l.status === 'approved') &&
      !(endDate < l.start_date || startDate > l.end_date)
  );

  if (existingOverlap) {
    return {
      success: false,
      message: `You already have a ${existingOverlap.status} leave request for ${existingOverlap.start_date} to ${existingOverlap.end_date}.`,
    };
  }

  const newLeave: LeaveRequest = {
    id: `leave-${Date.now()}`,
    user_id: userId,
    leave_type: leaveType,
    start_date: startDate,
    end_date: endDate,
    reason: reason.trim(),
    status: 'pending',
    show_on_calendar: false, // Default is OFF. Pending leaves never appear on calendar.
    approved_by: null,
    approved_at: null,
    created_at: new Date().toISOString(),
  };

  memoryLeaves = [newLeave, ...memoryLeaves];

  // Notify Admins
  const adminUsers = memoryUsers.filter((u) => u.role === 'admin');
  adminUsers.forEach((admin) => {
    const notif: AppNotification = {
      id: `notif-${Date.now()}-${admin.id}`,
      userId: admin.id,
      title: 'New Leave Request',
      message: `${user.full_name} applied for ${leaveType} (${formatDisplayDate(startDate)} → ${formatDisplayDate(endDate)}).`,
      type: 'info',
      isRead: false,
      createdAt: new Date().toISOString(),
      link: '/admin/leave-requests',
    };
    memoryNotifications = [notif, ...memoryNotifications];
  });

  if (isSupabaseConfigured() && supabase) {
    try {
      await supabase.from('leave_requests').insert({
        user_id: userId,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim(),
        status: 'pending',
        show_on_calendar: false,
      });
    } catch (err) {
      console.warn('Supabase leave insert sync:', err);
    }
  }

  persistStore();
  return {
    success: true,
    message: 'Leave request submitted successfully. Awaiting manager review.',
    leave: newLeave,
  };
}

export async function approveLeave(
  leaveId: string,
  adminUserId: string,
  showOnCalendar: boolean = false
): Promise<{ success: boolean; message: string }> {
  const leaveIndex = memoryLeaves.findIndex((l) => l.id === leaveId);
  if (leaveIndex === -1) {
    return { success: false, message: 'Leave request not found.' };
  }

  const leave = memoryLeaves[leaveIndex];
  const admin = getUserById(adminUserId);

  memoryLeaves[leaveIndex] = {
    ...leave,
    status: 'approved',
    show_on_calendar: showOnCalendar,
    approved_by: adminUserId,
    approved_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Notify Employee
  const empNotif: AppNotification = {
    id: `notif-${Date.now()}-${leave.user_id}`,
    userId: leave.user_id,
    title: 'Leave Approved! 🎉',
    message: `Your ${leave.leave_type} request for ${formatDisplayDate(leave.start_date)} was approved by ${admin?.full_name || 'Manager'}.${
      showOnCalendar ? ' Visible on shared calendar.' : ' Kept private from shared calendar.'
    }`,
    type: 'success',
    isRead: false,
    createdAt: new Date().toISOString(),
    link: '/my-leaves',
  };
  memoryNotifications = [empNotif, ...memoryNotifications];

  if (isSupabaseConfigured() && supabase) {
    try {
      await supabase
        .from('leave_requests')
        .update({
          status: 'approved',
          show_on_calendar: showOnCalendar,
          approved_by: adminUserId,
          approved_at: new Date().toISOString(),
        })
        .eq('id', leaveId);
    } catch (err) {
      console.warn('Supabase approve update sync:', err);
    }
  }

  persistStore();
  return {
    success: true,
    message: `Leave approved.${showOnCalendar ? ' Marked visible on calendar.' : ' Hidden from shared calendar.'}`,
  };
}

export async function toggleLeaveCalendarVisibility(
  leaveId: string,
  showOnCalendar: boolean
): Promise<{ success: boolean; message: string }> {
  const leaveIndex = memoryLeaves.findIndex((l) => l.id === leaveId);
  if (leaveIndex === -1) {
    return { success: false, message: 'Leave request not found.' };
  }

  const leave = memoryLeaves[leaveIndex];
  memoryLeaves[leaveIndex] = {
    ...leave,
    show_on_calendar: showOnCalendar,
    updated_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured() && supabase) {
    try {
      await supabase
        .from('leave_requests')
        .update({ show_on_calendar: showOnCalendar })
        .eq('id', leaveId);
    } catch (err) {
      console.warn('Supabase visibility sync:', err);
    }
  }

  persistStore();
  return {
    success: true,
    message: `Calendar visibility set to ${showOnCalendar ? 'ON (Visible)' : 'OFF (Hidden)'}.`,
  };
}

export async function rejectLeave(
  leaveId: string,
  adminUserId: string,
  rejectionReason?: string
): Promise<{ success: boolean; message: string }> {
  const leaveIndex = memoryLeaves.findIndex((l) => l.id === leaveId);
  if (leaveIndex === -1) {
    return { success: false, message: 'Leave request not found.' };
  }

  const leave = memoryLeaves[leaveIndex];
  const admin = getUserById(adminUserId);

  memoryLeaves[leaveIndex] = {
    ...leave,
    status: 'rejected',
    show_on_calendar: false, // Rejected leaves are never visible
    approved_by: adminUserId,
    rejection_reason: rejectionReason || 'Operational constraints',
    updated_at: new Date().toISOString(),
  };

  const empNotif: AppNotification = {
    id: `notif-${Date.now()}-${leave.user_id}`,
    userId: leave.user_id,
    title: 'Leave Request Rejected',
    message: `Your ${leave.leave_type} request for ${formatDisplayDate(leave.start_date)} was rejected by ${admin?.full_name || 'Manager'}. Reason: ${rejectionReason || 'Operational requirements'}.`,
    type: 'error',
    isRead: false,
    createdAt: new Date().toISOString(),
    link: '/my-leaves',
  };
  memoryNotifications = [empNotif, ...memoryNotifications];

  if (isSupabaseConfigured() && supabase) {
    try {
      await supabase
        .from('leave_requests')
        .update({
          status: 'rejected',
          show_on_calendar: false,
          approved_by: adminUserId,
          rejection_reason: rejectionReason,
        })
        .eq('id', leaveId);
    } catch (err) {
      console.warn('Supabase reject update sync:', err);
    }
  }

  persistStore();
  return { success: true, message: 'Leave request rejected.' };
}

export async function cancelLeave(leaveId: string, userId: string): Promise<{ success: boolean; message: string }> {
  const leaveIndex = memoryLeaves.findIndex((l) => l.id === leaveId);
  if (leaveIndex === -1) {
    return { success: false, message: 'Leave request not found.' };
  }

  const leave = memoryLeaves[leaveIndex];
  if (leave.user_id !== userId) {
    return { success: false, message: 'Unauthorized to cancel this leave.' };
  }

  if (leave.status !== 'pending') {
    return { success: false, message: 'Only pending leave requests can be cancelled.' };
  }

  memoryLeaves[leaveIndex] = {
    ...leave,
    status: 'cancelled',
    show_on_calendar: false,
    updated_at: new Date().toISOString(),
  };

  persistStore();
  return { success: true, message: 'Leave request cancelled successfully.' };
}

// ==============================================================================
// MANUAL CALENDAR MENTIONS (ADMIN ONLY)
// ==============================================================================

export async function addMention(
  mention: Omit<ManualCalendarEvent, 'id' | 'created_at'>
): Promise<{ success: boolean; message: string; mention?: ManualCalendarEvent }> {
  if (!mention.title || !mention.start_date) {
    return { success: false, message: 'Event title and start date are required.' };
  }

  const endDate = mention.end_date || mention.start_date;
  if (endDate < mention.start_date) {
    return { success: false, message: 'End date cannot be earlier than start date.' };
  }

  const newMention: ManualCalendarEvent = {
    ...mention,
    end_date: endDate,
    id: `mention-${Date.now()}`,
    created_at: new Date().toISOString(),
  };

  memoryMentions = [newMention, ...memoryMentions];

  if (isSupabaseConfigured() && supabase) {
    try {
      await supabase.from('calendar_events').insert(newMention);
    } catch (err) {
      console.warn('Supabase mention insert sync:', err);
    }
  }

  persistStore();
  return { success: true, message: 'Calendar event mention added successfully.', mention: newMention };
}

export async function updateMention(
  id: string,
  updated: Partial<ManualCalendarEvent>
): Promise<{ success: boolean; message: string }> {
  const index = memoryMentions.findIndex((m) => m.id === id);
  if (index === -1) {
    return { success: false, message: 'Calendar mention not found.' };
  }

  memoryMentions[index] = {
    ...memoryMentions[index],
    ...updated,
    updated_at: new Date().toISOString(),
  };

  persistStore();
  return { success: true, message: 'Calendar mention updated successfully.' };
}

export async function deleteMention(id: string): Promise<{ success: boolean; message: string }> {
  const index = memoryMentions.findIndex((m) => m.id === id);
  if (index === -1) {
    return { success: false, message: 'Calendar mention not found.' };
  }

  memoryMentions = memoryMentions.filter((m) => m.id !== id);
  persistStore();
  return { success: true, message: 'Calendar mention deleted successfully.' };
}

// ==============================================================================
// HOLIDAY MANAGEMENT (ADMIN)
// ==============================================================================

export async function addHoliday(holiday: Omit<GovernmentHoliday, 'id'>): Promise<{ success: boolean; message: string; holiday?: GovernmentHoliday }> {
  if (!holiday.name || !holiday.date) {
    return { success: false, message: 'Holiday name and date are required.' };
  }

  const existing = memoryHolidays.find((h) => h.date === holiday.date);
  if (existing) {
    return { success: false, message: `A holiday named "${existing.name}" is already scheduled for ${holiday.date}.` };
  }

  const newHoliday: GovernmentHoliday = {
    ...holiday,
    id: `hol-${Date.now()}`,
    created_at: new Date().toISOString(),
  };

  memoryHolidays = [...memoryHolidays, newHoliday].sort((a, b) => a.date.localeCompare(b.date));

  if (isSupabaseConfigured() && supabase) {
    try {
      await supabase.from('holidays').insert(newHoliday);
    } catch (err) {
      console.warn('Supabase holiday insert sync:', err);
    }
  }

  persistStore();
  return { success: true, message: 'Government holiday added successfully.', holiday: newHoliday };
}

export async function updateHoliday(
  id: string,
  updated: Partial<GovernmentHoliday>
): Promise<{ success: boolean; message: string }> {
  const index = memoryHolidays.findIndex((h) => h.id === id);
  if (index === -1) {
    return { success: false, message: 'Holiday not found.' };
  }

  memoryHolidays[index] = {
    ...memoryHolidays[index],
    ...updated,
    updated_at: new Date().toISOString(),
  };

  persistStore();
  return { success: true, message: 'Holiday updated successfully.' };
}

export async function deleteHoliday(id: string): Promise<{ success: boolean; message: string }> {
  const index = memoryHolidays.findIndex((h) => h.id === id);
  if (index === -1) {
    return { success: false, message: 'Holiday not found.' };
  }

  memoryHolidays = memoryHolidays.filter((h) => h.id !== id);
  persistStore();
  return { success: true, message: 'Holiday deleted successfully.' };
}

// ==============================================================================
// EMPLOYEE MANAGEMENT (ADMIN)
// ==============================================================================

export async function addEmployee(employee: Omit<UserProfile, 'id'>): Promise<{ success: boolean; message: string; user?: UserProfile }> {
  if (!employee.full_name || !employee.email) {
    return { success: false, message: 'Name and email are required.' };
  }

  const existing = memoryUsers.find((u) => u.email.toLowerCase() === employee.email.toLowerCase());
  if (existing) {
    return { success: false, message: 'An employee with this email already exists.' };
  }

  const newEmp: UserProfile = {
    ...employee,
    id: `user-${Date.now()}`,
    is_active: true,
    created_at: new Date().toISOString(),
  };

  memoryUsers = [...memoryUsers, newEmp];
  persistStore();
  return { success: true, message: 'Employee added successfully.', user: newEmp };
}

export async function updateEmployee(id: string, updated: Partial<UserProfile>): Promise<{ success: boolean; message: string }> {
  const index = memoryUsers.findIndex((u) => u.id === id);
  if (index === -1) {
    return { success: false, message: 'Employee not found.' };
  }

  memoryUsers[index] = {
    ...memoryUsers[index],
    ...updated,
    updated_at: new Date().toISOString(),
  };

  persistStore();
  return { success: true, message: 'Employee details updated successfully.' };
}

export async function toggleEmployeeStatus(id: string): Promise<{ success: boolean; message: string }> {
  const index = memoryUsers.findIndex((u) => u.id === id);
  if (index === -1) {
    return { success: false, message: 'Employee not found.' };
  }

  const current = memoryUsers[index];
  const newStatus = !current.is_active;
  memoryUsers[index] = {
    ...current,
    is_active: newStatus,
    updated_at: new Date().toISOString(),
  };

  persistStore();
  return {
    success: true,
    message: `Employee marked as ${newStatus ? 'active' : 'inactive'}.`,
  };
}

// ==============================================================================
// DASHBOARD & REPORTS METRICS
// ==============================================================================

export function getDashboardKPIs(todayDateStr: string = '2026-10-01') {
  const totalEmployees = memoryUsers.filter((u) => u.is_active).length;
  
  const onLeaveToday = memoryLeaves.filter(
    (l) => l.status === 'approved' && l.show_on_calendar && todayDateStr >= l.start_date && todayDateStr <= l.end_date
  );

  const pendingRequests = memoryLeaves.filter((l) => l.status === 'pending');
  const upcomingHolidays = memoryHolidays.filter((h) => h.date >= todayDateStr);
  const upcomingMentions = memoryMentions.filter((m) => m.start_date >= todayDateStr);

  return {
    totalEmployees,
    onLeaveTodayCount: onLeaveToday.length,
    onLeaveTodayList: onLeaveToday.map((l) => ({
      ...l,
      user: memoryUsers.find((u) => u.id === l.user_id),
    })),
    pendingRequestsCount: pendingRequests.length,
    pendingRequestsList: pendingRequests.map((l) => ({
      ...l,
      user: memoryUsers.find((u) => u.id === l.user_id),
    })),
    upcomingHolidaysCount: upcomingHolidays.length,
    upcomingHolidaysList: upcomingHolidays.slice(0, 5),
    upcomingMentionsCount: upcomingMentions.length,
    upcomingMentionsList: upcomingMentions.slice(0, 4),
  };
}

export function getReportsData(): ReportSummary {
  const allLeaves = getLeaves();
  const approved = allLeaves.filter((l) => l.status === 'approved');
  const pending = allLeaves.filter((l) => l.status === 'pending');
  const rejected = allLeaves.filter((l) => l.status === 'rejected');
  const cancelled = allLeaves.filter((l) => l.status === 'cancelled');
  const visible = allLeaves.filter((l) => l.status === 'approved' && l.show_on_calendar);

  const employeeStats = memoryUsers.map((user) => {
    const userLeaves = allLeaves.filter((l) => l.user_id === user.id);
    const userApproved = userLeaves.filter((l) => l.status === 'approved');
    const daysTaken = userApproved.reduce((sum, l) => sum + calculateDaysCount(l.start_date, l.end_date), 0);

    return {
      user,
      totalLeaves: userLeaves.length,
      approved: userApproved.length,
      pending: userLeaves.filter((l) => l.status === 'pending').length,
      rejected: userLeaves.filter((l) => l.status === 'rejected').length,
      daysTaken,
    };
  });

  const months: { [key: string]: { leaveCount: number; holidayCount: number; mentionCount: number; monthName: string } } = {};
  
  for (let i = 0; i < 15; i++) {
    const d = new Date(2026, 9 + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthName = d.toLocaleString('default', { month: 'short', year: 'numeric' });
    months[key] = { leaveCount: 0, holidayCount: 0, mentionCount: 0, monthName };
  }

  visible.forEach((l) => {
    const monthKey = l.start_date.substring(0, 7);
    if (months[monthKey]) {
      months[monthKey].leaveCount += 1;
    }
  });

  memoryHolidays.forEach((h) => {
    const monthKey = h.date.substring(0, 7);
    if (months[monthKey]) {
      months[monthKey].holidayCount += 1;
    }
  });

  memoryMentions.forEach((m) => {
    const monthKey = m.start_date.substring(0, 7);
    if (months[monthKey]) {
      months[monthKey].mentionCount += 1;
    }
  });

  const monthlyStats = Object.entries(months).map(([monthKey, val]) => ({
    monthKey,
    monthName: val.monthName,
    leaveCount: val.leaveCount,
    holidayCount: val.holidayCount,
    mentionCount: val.mentionCount,
  }));

  return {
    totalEmployees: memoryUsers.length,
    totalLeaveRequests: allLeaves.length,
    approvedCount: approved.length,
    pendingCount: pending.length,
    rejectedCount: rejected.length,
    cancelledCount: cancelled.length,
    calendarVisibleCount: visible.length,
    totalHolidays: memoryHolidays.length,
    totalMentions: memoryMentions.length,
    employeeStats,
    monthlyStats,
  };
}
