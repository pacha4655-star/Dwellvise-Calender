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
import { isSupabaseConfigured, getSupabaseClient } from '@/lib/supabase/client';

const STORAGE_KEY_USERS = 'officeflow_dwellvise_users_v3';
const STORAGE_KEY_LEAVES = 'officeflow_dwellvise_leaves_v3';
const STORAGE_KEY_HOLIDAYS = 'officeflow_dwellvise_holidays_v3';
const STORAGE_KEY_MENTIONS = 'officeflow_dwellvise_mentions_v3';
const STORAGE_KEY_NOTIFICATIONS = 'officeflow_dwellvise_notifications_v3';

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// In-Memory State
let memoryUsers: UserProfile[] = [...INITIAL_USERS];
let memoryLeaves: LeaveRequest[] = [...INITIAL_LEAVES];
let memoryHolidays: GovernmentHoliday[] = [...INITIAL_HOLIDAYS];
let memoryMentions: ManualCalendarEvent[] = [...INITIAL_MENTIONS];
let memoryNotifications: AppNotification[] = [];

type Listener = () => void;
const listeners: Set<Listener> = new Set();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

let isSyncing = false;
let syncError: string | null = null;

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> => {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), timeoutMs);
  });
  return Promise.race([
    promise.then((res) => {
      clearTimeout(timer);
      return res;
    }),
    timeoutPromise,
  ]);
};

async function safeFetchProfiles(): Promise<UserProfile[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const res = await client.from('profiles').select('*');
    return (res.data as UserProfile[]) || null;
  } catch {
    return null;
  }
}

async function safeFetchLeaves(): Promise<LeaveRequest[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const res = await client.from('leave_requests').select('*').order('created_at', { ascending: false });
    return (res.data as LeaveRequest[]) || null;
  } catch {
    return null;
  }
}

async function safeFetchHolidays(): Promise<GovernmentHoliday[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const res = await client.from('holidays').select('*');
    return (res.data as GovernmentHoliday[]) || null;
  } catch {
    return null;
  }
}

async function safeFetchMentions(): Promise<ManualCalendarEvent[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const res = await client.from('calendar_events').select('*');
    return (res.data as ManualCalendarEvent[]) || null;
  } catch {
    return null;
  }
}

async function safeFetchNotifications(): Promise<AppNotification[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const res = await client
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });
    if (res.data) {
      return (res.data as any[]).map((n) => ({
        id: n.id,
        recipient_user_id: n.recipient_user_id || n.recipient_id,
        recipient_id: n.recipient_user_id || n.recipient_id,
        sender_id: n.sender_id || null,
        title: n.title,
        message: n.message,
        type: n.type,
        leave_request_id: n.leave_request_id || n.reference_id || null,
        reference_id: n.leave_request_id || n.reference_id || null,
        is_read: n.is_read ?? false,
        created_at: n.created_at,
        isRead: n.is_read ?? false,
        createdAt: n.created_at,
      }));
    }
    return null;
  } catch {
    return null;
  }
}

export async function syncDatabaseWithSupabase(): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured() || isSyncing) {
    return { success: false, error: 'Supabase not configured or already syncing' };
  }

  isSyncing = true;
  syncError = null;

  try {
    const [profilesData, leavesData, holidaysData, mentionsData, notifsData] = await Promise.all([
      withTimeout(safeFetchProfiles(), 4000, null),
      withTimeout(safeFetchLeaves(), 4000, null),
      withTimeout(safeFetchHolidays(), 4000, null),
      withTimeout(safeFetchMentions(), 4000, null),
      withTimeout(safeFetchNotifications(), 4000, null),
    ]);

    let hasUpdates = false;

    if (profilesData && profilesData.length > 0) {
      // Merge profiles ensuring initial structure is preserved
      const merged = [...memoryUsers];
      profilesData.forEach((dbUser) => {
        const idx = merged.findIndex((u) => u.id === dbUser.id || u.email.toLowerCase() === dbUser.email.toLowerCase());
        if (idx !== -1) {
          merged[idx] = { ...merged[idx], ...dbUser };
        } else {
          merged.push(dbUser);
        }
      });
      memoryUsers = merged;
      hasUpdates = true;
    }

    if (leavesData) {
      // Merge leaves: update existing and add newly fetched
      const fetchedIds = new Set(leavesData.map((l) => l.id));
      const remainingMemory = memoryLeaves.filter((l) => !fetchedIds.has(l.id));
      memoryLeaves = [...leavesData, ...remainingMemory];
      hasUpdates = true;
    }

    if (holidaysData && holidaysData.length > 0) {
      memoryHolidays = holidaysData;
      hasUpdates = true;
    }

    if (mentionsData && mentionsData.length > 0) {
      memoryMentions = mentionsData;
      hasUpdates = true;
    }

    if (notifsData) {
      // Merge notifications: keep memory notifications for other users (for local multi-user testing)
      const fetchedIds = new Set(notifsData.map((n) => n.id));
      const remainingMemory = memoryNotifications.filter((n) => !fetchedIds.has(n.id));
      memoryNotifications = [...notifsData, ...remainingMemory];
      hasUpdates = true;
    }

    if (hasUpdates) {
      persistStore();
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to sync with Supabase';
    syncError = msg;
    console.warn('Supabase synchronization warning:', msg);
    return { success: false, error: msg };
  } finally {
    isSyncing = false;
  }
}

let realtimeSubscribed = false;
let pollingInterval: ReturnType<typeof setInterval> | null = null;

export function initRealtimeNotifications() {
  if (typeof window === 'undefined') return;

  const client = getSupabaseClient();
  if (isSupabaseConfigured() && client && !realtimeSubscribed) {
    try {
      realtimeSubscribed = true;

      // 1. Subscribe to notifications table
      client
        .channel('public:notifications')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notifications' },
          () => {
            safeFetchNotifications().then((data) => {
              if (data) {
                const fetchedIds = new Set(data.map((n) => n.id));
                const remainingMemory = memoryNotifications.filter((n) => !fetchedIds.has(n.id));
                memoryNotifications = [...data, ...remainingMemory];
                persistStore();
              }
            }).catch(() => {});
          }
        )
        .subscribe();

      // 2. Subscribe to leave_requests table for real-time admin sync (Dinesh <-> Aswin)
      client
        .channel('public:leave_requests')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'leave_requests' },
          () => {
            safeFetchLeaves().then((data) => {
              if (data) {
                const fetchedIds = new Set(data.map((l) => l.id));
                const remainingMemory = memoryLeaves.filter((l) => !fetchedIds.has(l.id));
                memoryLeaves = [...data, ...remainingMemory];
                persistStore();
              }
            }).catch(() => {});
          }
        )
        .subscribe();

      // 3. Subscribe to calendar_events table
      client
        .channel('public:calendar_events')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'calendar_events' },
          () => {
            safeFetchMentions().then((data) => {
              if (data && data.length > 0) {
                memoryMentions = data;
                persistStore();
              }
            }).catch(() => {});
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('Realtime subscription warning:', err);
    }
  }

  // Safe fallback periodic polling (every 15 seconds)
  if (!pollingInterval && isSupabaseConfigured()) {
    pollingInterval = setInterval(() => {
      Promise.all([safeFetchNotifications(), safeFetchLeaves()])
        .then(([notifs, leaves]) => {
          let hasChange = false;
          if (notifs) {
            const fetchedIds = new Set(notifs.map((n) => n.id));
            const remainingMemory = memoryNotifications.filter((n) => !fetchedIds.has(n.id));
            const mergedNotifs = [...notifs, ...remainingMemory];
            if (JSON.stringify(mergedNotifs) !== JSON.stringify(memoryNotifications)) {
              memoryNotifications = mergedNotifs;
              hasChange = true;
            }
          }
          if (leaves) {
            const fetchedIds = new Set(leaves.map((l) => l.id));
            const remainingMemory = memoryLeaves.filter((l) => !fetchedIds.has(l.id));
            const mergedLeaves = [...leaves, ...remainingMemory];
            if (JSON.stringify(mergedLeaves) !== JSON.stringify(memoryLeaves)) {
              memoryLeaves = mergedLeaves;
              hasChange = true;
            }
          }
          if (hasChange) {
            persistStore();
          }
        })
        .catch(() => {});
    }, 15000);
  }
}

/**
 * Initialize data store from localStorage if running in browser
 */
export function initializeStore() {
  if (typeof window === 'undefined') return;

  try {
    const storedUsers = localStorage.getItem(STORAGE_KEY_USERS);
    if (storedUsers) {
      const parsed = JSON.parse(storedUsers) as UserProfile[];
      // Merge initial users: update roles (e.g. Aswin -> admin) and add missing users (e.g. Shalini)
      const merged = [...parsed];
      INITIAL_USERS.forEach((initUser) => {
        const existingIdx = merged.findIndex(
          (u) => u.email.toLowerCase() === initUser.email.toLowerCase() || u.id === initUser.id
        );
        if (existingIdx !== -1) {
          merged[existingIdx] = {
            ...merged[existingIdx],
            full_name: initUser.full_name,
            role: initUser.role,
            department: merged[existingIdx].department || initUser.department,
            designation: merged[existingIdx].designation || initUser.designation,
            is_active: merged[existingIdx].is_active ?? true,
          };
        } else {
          merged.push(initUser);
        }
      });
      memoryUsers = merged;
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(memoryUsers));
    } else {
      memoryUsers = [...INITIAL_USERS];
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

  // Trigger background sync and realtime if Supabase is active
  if (isSupabaseConfigured()) {
    syncDatabaseWithSupabase().catch(() => {});
    initRealtimeNotifications();
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

export function getSyncStatus() {
  return { isSyncing, syncError };
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

export function getNotifications(recipientId: string): AppNotification[] {
  if (!recipientId) return [];
  return memoryNotifications
    .filter((n) => n.recipient_user_id === recipientId || n.recipient_id === recipientId || n.userId === recipientId)
    .sort((a, b) => new Date(b.created_at || b.createdAt || 0).getTime() - new Date(a.created_at || a.createdAt || 0).getTime());
}

export async function markNotificationAsRead(id: string): Promise<{ success: boolean; message: string }> {
  const index = memoryNotifications.findIndex((n) => n.id === id);
  if (index !== -1) {
    memoryNotifications[index] = {
      ...memoryNotifications[index],
      is_read: true,
      isRead: true,
    };
    persistStore();
  }

  const client = getSupabaseClient();
  if (isSupabaseConfigured() && client) {
    try {
      await client.from('notifications').update({ is_read: true }).eq('id', id);
    } catch (err) {
      console.warn('Supabase mark notification read sync:', err);
    }
  }

  return { success: true, message: 'Notification marked as read.' };
}

export async function markAllNotificationsAsRead(recipientId: string): Promise<{ success: boolean; message: string }> {
  if (!recipientId) return { success: false, message: 'Invalid recipient ID.' };

  memoryNotifications = memoryNotifications.map((n) => {
    if (n.recipient_user_id === recipientId || n.recipient_id === recipientId || n.userId === recipientId) {
      return { ...n, is_read: true, isRead: true };
    }
    return n;
  });
  persistStore();

  const client = getSupabaseClient();
  if (isSupabaseConfigured() && client) {
    try {
      await client
        .from('notifications')
        .update({ is_read: true })
        .or(`recipient_user_id.eq.${recipientId},recipient_id.eq.${recipientId}`);
    } catch (err) {
      console.warn('Supabase mark all notifications read sync:', err);
    }
  }

  return { success: true, message: 'All notifications marked as read.' };
}

export async function createNotification(payload: {
  recipient_user_id?: string;
  recipient_id?: string;
  sender_id?: string | null;
  title: string;
  message: string;
  type: any;
  leave_request_id?: string | null;
  reference_id?: string | null;
}): Promise<AppNotification> {
  const targetRecipient = payload.recipient_user_id || payload.recipient_id || '';
  const targetLeaveId = payload.leave_request_id || payload.reference_id || null;

  if (!targetRecipient) {
    throw new Error('Recipient user ID is required to create a notification.');
  }

  // Duplicate check: Prevent creating duplicate notifications for the same leave, recipient, and type
  if (targetLeaveId && targetRecipient) {
    const existingMemory = memoryNotifications.find(
      (n) =>
        (n.recipient_user_id === targetRecipient || n.recipient_id === targetRecipient || n.userId === targetRecipient) &&
        (n.leave_request_id === targetLeaveId || n.reference_id === targetLeaveId) &&
        n.type === payload.type
    );
    if (existingMemory) {
      return existingMemory;
    }
  }

  const notifId = generateUUID();
  const nowIso = new Date().toISOString();

  const newNotif: AppNotification = {
    id: notifId,
    recipient_user_id: targetRecipient,
    recipient_id: targetRecipient,
    sender_id: payload.sender_id || null,
    title: payload.title,
    message: payload.message,
    type: payload.type,
    leave_request_id: targetLeaveId,
    reference_id: targetLeaveId,
    is_read: false,
    created_at: nowIso,
    // Aliases
    userId: targetRecipient,
    isRead: false,
    createdAt: nowIso,
  };

  memoryNotifications = [newNotif, ...memoryNotifications];
  persistStore();

  const client = getSupabaseClient();
  if (isSupabaseConfigured() && client) {
    try {
      if (targetLeaveId && targetRecipient) {
        const { data: existingDb } = await client
          .from('notifications')
          .select('id')
          .eq('recipient_user_id', targetRecipient)
          .eq('leave_request_id', targetLeaveId)
          .eq('type', payload.type)
          .maybeSingle();

        if (existingDb) {
          return newNotif;
        }
      }

      const { error: notifInsertErr } = await client.from('notifications').insert({
        id: notifId,
        recipient_user_id: targetRecipient,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        leave_request_id: targetLeaveId,
        is_read: false,
      });

      if (notifInsertErr) {
        console.error('[Supabase notifications insert error]:', notifInsertErr);
      }
    } catch (err) {
      console.error('[Supabase notification insert sync exception]:', err);
    }
  }

  return newNotif;
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

  const leaveId = generateUUID();
  const nowIso = new Date().toISOString();

  const newLeave: LeaveRequest = {
    id: leaveId,
    user_id: userId,
    leave_type: leaveType,
    start_date: startDate,
    end_date: endDate,
    reason: reason.trim(),
    status: 'pending',
    show_on_calendar: false, // Default is OFF. Pending leaves never appear on calendar.
    approved_by: null,
    approved_at: null,
    created_at: nowIso,
    updated_at: nowIso,
  };

  // 1. Insert into memory leaves
  memoryLeaves = [newLeave, ...memoryLeaves];
  persistStore();

  const client = getSupabaseClient();

  // 2. Insert into Supabase FIRST so foreign key constraints in notifications are satisfied
  if (isSupabaseConfigured() && client) {
    try {
      const { error: insertLeaveErr } = await client.from('leave_requests').insert({
        id: newLeave.id,
        user_id: userId,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim(),
        status: 'pending',
        show_on_calendar: false,
      });
      if (insertLeaveErr) {
        console.error('[Supabase leave_requests insert error]:', insertLeaveErr);
      }
    } catch (err) {
      console.error('[Supabase leave insert sync exception]:', err);
    }
  }

  // 3. Format date range string for notifications (e.g. "from 08 Oct 2026 to 09 Oct 2026")
  const startFormatted = formatDisplayDate(startDate);
  const endFormatted = formatDisplayDate(endDate);
  const dateRangeStr = `from ${startFormatted} to ${endFormatted}`;

  // 4. Dynamic admin notification query: Notify ALL active admins in public.profiles (role = 'admin' AND is_active = true)
  let activeAdmins: UserProfile[] = [];
  if (isSupabaseConfigured() && client) {
    try {
      const { data: adminProfiles, error: adminErr } = await client
        .from('profiles')
        .select('*')
        .eq('role', 'admin')
        .eq('is_active', true);
      if (adminErr) {
        console.error('[Fetch active admins error]:', adminErr);
      }
      if (adminProfiles && adminProfiles.length > 0) {
        activeAdmins = adminProfiles as UserProfile[];
      }
    } catch (err) {
      console.warn('Supabase active admin query error:', err);
    }
  }
  if (activeAdmins.length === 0) {
    activeAdmins = memoryUsers.filter((u) => u.role === 'admin' && (u.is_active ?? true));
  }

  // Create separate notification row for EACH active admin (Dinesh, Aswin, etc.)
  for (const admin of activeAdmins) {
    // Do not send "New Leave Request" notification to the submitter even if the submitter is an admin
    if (admin.id === user.id) continue;

    try {
      await createNotification({
        recipient_user_id: admin.id,
        recipient_id: admin.id,
        sender_id: user.id,
        title: 'New Leave Request',
        message: `${user.full_name} has applied for ${leaveType} ${dateRangeStr}.`,
        type: 'leave_request',
        leave_request_id: newLeave.id,
        reference_id: newLeave.id,
      });
    } catch (err) {
      console.error(`[Admin notification error for ${admin.full_name}]:`, err);
    }
  }

  persistStore();
  return {
    success: true,
    message: 'Leave request submitted successfully.',
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

  // Prevent duplicate or invalid status transitions
  if (leave.status === 'approved') {
    return { success: true, message: 'Leave request is already approved.' };
  }
  if (leave.status === 'rejected' || leave.status === 'cancelled') {
    return { success: false, message: `Cannot approve a leave that is already ${leave.status}.` };
  }

  const nowIso = new Date().toISOString();
  memoryLeaves[leaveIndex] = {
    ...leave,
    status: 'approved',
    show_on_calendar: showOnCalendar,
    approved_by: adminUserId,
    approved_at: nowIso,
    updated_at: nowIso,
  };

  // Format date range for notification (e.g. "from 08 Oct 2026 to 09 Oct 2026")
  const startFormatted = formatDisplayDate(leave.start_date);
  const endFormatted = formatDisplayDate(leave.end_date);
  const dateRangeStr = `from ${startFormatted} to ${endFormatted}`;

  // Notify Employee ONLY about approval (without exposing private notes)
  createNotification({
    recipient_user_id: leave.user_id,
    recipient_id: leave.user_id,
    sender_id: adminUserId,
    title: 'Leave Approved',
    message: `Your ${leave.leave_type} ${dateRangeStr} has been approved.`,
    type: 'leave_approved',
    leave_request_id: leave.id,
    reference_id: leave.id,
  }).catch((err) => console.error('[Employee approve notification error]:', err));

  const client = getSupabaseClient();
  if (isSupabaseConfigured() && client) {
    try {
      // Conditional update: only update if status is still pending (concurrent admin safety)
      const { error: updateErr } = await client
        .from('leave_requests')
        .update({
          status: 'approved',
          show_on_calendar: showOnCalendar,
          approved_by: adminUserId,
          approved_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', leaveId)
        .eq('status', 'pending');

      if (updateErr) {
        console.error('[Supabase approve update error]:', updateErr);
      }
    } catch (err) {
      console.error('[Supabase approve update sync exception]:', err);
    }
  }

  persistStore();
  return {
    success: true,
    message: `Leave approved.${showOnCalendar ? ' Marked visible on calendar.' : ' Kept hidden from shared calendar.'}`,
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
  const nowIso = new Date().toISOString();
  memoryLeaves[leaveIndex] = {
    ...leave,
    show_on_calendar: showOnCalendar,
    updated_at: nowIso,
  };

  const client = getSupabaseClient();
  if (isSupabaseConfigured() && client) {
    try {
      const { error: visErr } = await client
        .from('leave_requests')
        .update({ show_on_calendar: showOnCalendar, updated_at: nowIso })
        .eq('id', leaveId);
      if (visErr) {
        console.error('[Supabase visibility update error]:', visErr);
      }
    } catch (err) {
      console.error('[Supabase visibility sync exception]:', err);
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

  // Prevent duplicate or invalid status transitions
  if (leave.status === 'rejected') {
    return { success: true, message: 'Leave request is already rejected.' };
  }
  if (leave.status === 'approved' || leave.status === 'cancelled') {
    return { success: false, message: `Cannot reject a leave that is already ${leave.status}.` };
  }

  const nowIso = new Date().toISOString();
  memoryLeaves[leaveIndex] = {
    ...leave,
    status: 'rejected',
    show_on_calendar: false, // Rejected leaves are never visible on calendar
    approved_by: adminUserId,
    rejection_reason: rejectionReason || 'Operational constraints',
    updated_at: nowIso,
  };

  // Format date range for notification (e.g. "from 08 Oct 2026 to 09 Oct 2026")
  const startFormatted = formatDisplayDate(leave.start_date);
  const endFormatted = formatDisplayDate(leave.end_date);
  const dateRangeStr = `from ${startFormatted} to ${endFormatted}`;

  // Notify Employee ONLY about rejection
  createNotification({
    recipient_user_id: leave.user_id,
    recipient_id: leave.user_id,
    sender_id: adminUserId,
    title: 'Leave Rejected',
    message: `Your ${leave.leave_type} ${dateRangeStr} has been rejected.`,
    type: 'leave_rejected',
    leave_request_id: leave.id,
    reference_id: leave.id,
  }).catch((err) => console.error('[Employee reject notification error]:', err));

  const client = getSupabaseClient();
  if (isSupabaseConfigured() && client) {
    try {
      // Conditional update: only update if status is still pending (concurrent admin safety)
      const { error: updateErr } = await client
        .from('leave_requests')
        .update({
          status: 'rejected',
          show_on_calendar: false,
          approved_by: adminUserId,
          rejection_reason: rejectionReason || 'Operational constraints',
          updated_at: nowIso,
        })
        .eq('id', leaveId)
        .eq('status', 'pending');

      if (updateErr) {
        console.error('[Supabase reject update error]:', updateErr);
      }
    } catch (err) {
      console.error('[Supabase reject update sync exception]:', err);
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

  const nowIso = new Date().toISOString();
  memoryLeaves[leaveIndex] = {
    ...leave,
    status: 'cancelled',
    show_on_calendar: false,
    updated_at: nowIso,
  };

  const client = getSupabaseClient();
  if (isSupabaseConfigured() && client) {
    try {
      const { error: cancelErr } = await client
        .from('leave_requests')
        .update({ status: 'cancelled', show_on_calendar: false, updated_at: nowIso })
        .eq('id', leaveId)
        .eq('status', 'pending');
      if (cancelErr) {
        console.error('[Supabase cancel update error]:', cancelErr);
      }
    } catch (err) {
      console.error('[Supabase cancel update sync exception]:', err);
    }
  }

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

  const mentionId = generateUUID();
  const nowIso = new Date().toISOString();

  const newMention: ManualCalendarEvent = {
    ...mention,
    end_date: endDate,
    id: mentionId,
    created_at: nowIso,
    updated_at: nowIso,
  };

  memoryMentions = [newMention, ...memoryMentions];

  const client = getSupabaseClient();
  if (isSupabaseConfigured() && client) {
    try {
      const { error: mentionInsertErr } = await client.from('calendar_events').insert(newMention);
      if (mentionInsertErr) {
        console.error('[Supabase mention insert error]:', mentionInsertErr);
      }
    } catch (err) {
      console.error('[Supabase mention insert sync exception]:', err);
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

  const nowIso = new Date().toISOString();
  memoryMentions[index] = {
    ...memoryMentions[index],
    ...updated,
    updated_at: nowIso,
  };

  const client = getSupabaseClient();
  if (isSupabaseConfigured() && client) {
    try {
      const { error: mentionUpdateErr } = await client
        .from('calendar_events')
        .update({ ...updated, updated_at: nowIso })
        .eq('id', id);
      if (mentionUpdateErr) {
        console.error('[Supabase mention update error]:', mentionUpdateErr);
      }
    } catch (err) {
      console.error('[Supabase mention update sync exception]:', err);
    }
  }

  persistStore();
  return { success: true, message: 'Calendar mention updated successfully.' };
}

export async function deleteMention(id: string): Promise<{ success: boolean; message: string }> {
  const index = memoryMentions.findIndex((m) => m.id === id);
  if (index === -1) {
    return { success: false, message: 'Calendar mention not found.' };
  }

  memoryMentions = memoryMentions.filter((m) => m.id !== id);

  const client = getSupabaseClient();
  if (isSupabaseConfigured() && client) {
    try {
      const { error: mentionDeleteErr } = await client.from('calendar_events').delete().eq('id', id);
      if (mentionDeleteErr) {
        console.error('[Supabase mention delete error]:', mentionDeleteErr);
      }
    } catch (err) {
      console.error('[Supabase mention delete sync exception]:', err);
    }
  }

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

  const holidayId = generateUUID();
  const nowIso = new Date().toISOString();

  const newHoliday: GovernmentHoliday = {
    ...holiday,
    id: holidayId,
    created_at: nowIso,
    updated_at: nowIso,
  };

  memoryHolidays = [...memoryHolidays, newHoliday].sort((a, b) => a.date.localeCompare(b.date));

  const client = getSupabaseClient();
  if (isSupabaseConfigured() && client) {
    try {
      const { error: holidayInsertErr } = await client.from('holidays').insert(newHoliday);
      if (holidayInsertErr) {
        console.error('[Supabase holiday insert error]:', holidayInsertErr);
      }
    } catch (err) {
      console.error('[Supabase holiday insert sync exception]:', err);
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

  const nowIso = new Date().toISOString();
  memoryHolidays[index] = {
    ...memoryHolidays[index],
    ...updated,
    updated_at: nowIso,
  };

  const client = getSupabaseClient();
  if (isSupabaseConfigured() && client) {
    try {
      const { error: holidayUpdateErr } = await client
        .from('holidays')
        .update({ ...updated, updated_at: nowIso })
        .eq('id', id);
      if (holidayUpdateErr) {
        console.error('[Supabase holiday update error]:', holidayUpdateErr);
      }
    } catch (err) {
      console.error('[Supabase holiday update sync exception]:', err);
    }
  }

  persistStore();
  return { success: true, message: 'Holiday updated successfully.' };
}

export async function deleteHoliday(id: string): Promise<{ success: boolean; message: string }> {
  const index = memoryHolidays.findIndex((h) => h.id === id);
  if (index === -1) {
    return { success: false, message: 'Holiday not found.' };
  }

  memoryHolidays = memoryHolidays.filter((h) => h.id !== id);

  const client = getSupabaseClient();
  if (isSupabaseConfigured() && client) {
    try {
      const { error: holidayDeleteErr } = await client.from('holidays').delete().eq('id', id);
      if (holidayDeleteErr) {
        console.error('[Supabase holiday delete error]:', holidayDeleteErr);
      }
    } catch (err) {
      console.error('[Supabase holiday delete sync exception]:', err);
    }
  }

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

  const empId = generateUUID();
  const nowIso = new Date().toISOString();

  const newEmp: UserProfile = {
    ...employee,
    id: empId,
    is_active: true,
    created_at: nowIso,
    updated_at: nowIso,
  };

  memoryUsers = [...memoryUsers, newEmp];

  const client = getSupabaseClient();
  if (isSupabaseConfigured() && client) {
    try {
      const { error: profileInsertErr } = await client.from('profiles').insert(newEmp);
      if (profileInsertErr) {
        console.error('[Supabase profile insert error]:', profileInsertErr);
      }
    } catch (err) {
      console.error('[Supabase profile insert sync exception]:', err);
    }
  }

  persistStore();
  return { success: true, message: 'Employee added successfully.', user: newEmp };
}

export async function updateEmployee(id: string, updated: Partial<UserProfile>): Promise<{ success: boolean; message: string }> {
  const index = memoryUsers.findIndex((u) => u.id === id);
  if (index === -1) {
    return { success: false, message: 'Employee not found.' };
  }

  const nowIso = new Date().toISOString();
  memoryUsers[index] = {
    ...memoryUsers[index],
    ...updated,
    updated_at: nowIso,
  };

  const client = getSupabaseClient();
  if (isSupabaseConfigured() && client) {
    try {
      const { error: profileUpdateErr } = await client
        .from('profiles')
        .update({ ...updated, updated_at: nowIso })
        .eq('id', id);
      if (profileUpdateErr) {
        console.error('[Supabase profile update error]:', profileUpdateErr);
      }
    } catch (err) {
      console.error('[Supabase profile update sync exception]:', err);
    }
  }

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
  const nowIso = new Date().toISOString();
  memoryUsers[index] = {
    ...current,
    is_active: newStatus,
    updated_at: nowIso,
  };

  const client = getSupabaseClient();
  if (isSupabaseConfigured() && client) {
    try {
      const { error: statusUpdateErr } = await client
        .from('profiles')
        .update({ is_active: newStatus, updated_at: nowIso })
        .eq('id', id);
      if (statusUpdateErr) {
        console.error('[Supabase profile status update error]:', statusUpdateErr);
      }
    } catch (err) {
      console.error('[Supabase profile status sync exception]:', err);
    }
  }

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
