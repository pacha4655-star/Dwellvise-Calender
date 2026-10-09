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
  MeetingSchedule,
  CalculatedMeetingOccurrence,
  MeetingType,
} from '@/types';
import { INITIAL_USERS } from './initial-users';
import { INITIAL_HOLIDAYS } from './holidays-data';
import { INITIAL_LEAVES } from './initial-leaves';
import { INITIAL_MENTIONS } from './initial-mentions';
import { INITIAL_MEETING_SCHEDULES } from './initial-meetings';
import { calculateDaysCount, calculateWorkingDays, formatDisplayDate } from '@/lib/utils/date-utils';
import { calculateScheduleOccurrences, getNextUpcomingMeeting } from '@/lib/meetings/meeting-scheduler';
import { isSupabaseConfigured, getSupabaseClient } from '@/lib/supabase/client';

const STORAGE_KEY_USERS = 'officeflow_dwellvise_users_v4';
const STORAGE_KEY_LEAVES = 'officeflow_dwellvise_leaves_v4';
const STORAGE_KEY_HOLIDAYS = 'officeflow_dwellvise_holidays_v4';
const STORAGE_KEY_MENTIONS = 'officeflow_dwellvise_mentions_v4';
const STORAGE_KEY_NOTIFICATIONS = 'officeflow_dwellvise_notifications_v4';
const STORAGE_KEY_MEETINGS = 'officeflow_dwellvise_meetings_v4';

// Legacy keys for automatic migration
const LEGACY_STORAGE_KEYS = [
  'officeflow_dwellvise_users_v3',
  'officeflow_dwellvise_leaves_v3',
  'officeflow_dwellvise_holidays_v3',
  'officeflow_dwellvise_mentions_v3',
  'officeflow_dwellvise_notifications_v3',
  'officeflow_dwellvise_meetings_v3',
  'officeflow_users',
  'officeflow_leaves',
  'officeflow_holidays',
  'officeflow_mentions',
];

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

function normalizeUserRecord(u: any): UserProfile {
  const emailLower = (u?.email || '').toLowerCase().trim();
  let role = ((u?.role || 'employee').toLowerCase() === 'admin' ? 'admin' : 'employee') as any;
  if (emailLower === 'aswin@dwellvise.com' || emailLower === 'dinesh@dwellvise.com') {
    role = 'admin';
  } else if (emailLower === 'pachamuthu@dwellvise.com' || emailLower === 'shalini@dwellvise.com') {
    role = 'employee';
  }

  return {
    id: String(u?.id || generateUUID()),
    auth_user_id: u?.auth_user_id ? String(u.auth_user_id) : undefined,
    email: String(u?.email || ''),
    full_name: String(u?.full_name || u?.name || 'Team Member'),
    role,
    department: String(u?.department || 'Engineering'),
    designation: String(u?.designation || (role === 'admin' ? 'Co-founder & Director' : 'Software Engineer')),
    phone: u?.phone ? String(u.phone) : undefined,
    avatar_url: u?.avatar_url ? String(u.avatar_url) : undefined,
    is_active: u?.is_active ?? true,
    created_at: String(u?.created_at || '2026-10-01T00:00:00Z'),
    updated_at: u?.updated_at ? String(u.updated_at) : undefined,
  };
}

function normalizeLeaveRecord(l: any): LeaveRequest {
  return {
    id: String(l?.id || generateUUID()),
    user_id: String(l?.user_id || l?.userId || ''),
    leave_type: (l?.leave_type || l?.leaveType || 'Casual Leave') as LeaveType,
    start_date: String(l?.start_date || l?.startDate || '2026-10-01'),
    end_date: String(l?.end_date || l?.endDate || l?.start_date || l?.startDate || '2026-10-01'),
    reason: String(l?.reason || ''),
    status: (String(l?.status || 'pending').toLowerCase() as any),
    show_on_calendar: Boolean(l?.show_on_calendar ?? l?.showOnCalendar ?? true),
    approved_by: l?.approved_by || l?.approvedBy || null,
    approved_at: l?.approved_at || l?.approvedAt || l?.approval_date || null,
    rejection_reason: l?.rejection_reason || l?.rejectionReason || null,
    created_at: String(l?.created_at || l?.createdAt || new Date().toISOString()),
    updated_at: l?.updated_at ? String(l.updated_at) : undefined,
  };
}

function normalizeHolidayRecord(h: any): GovernmentHoliday {
  const validHolidayTypes = ['Government Holiday', 'Public Holiday', 'Restricted Holiday', 'Regional Holiday'];
  const holidayType = validHolidayTypes.includes(h?.holiday_type || h?.holidayType)
    ? (h?.holiday_type || h?.holidayType)
    : 'Government Holiday';

  return {
    id: String(h?.id || generateUUID()),
    name: String(h?.name || 'Holiday'),
    date: String(h?.date || '2026-01-01'),
    description: String(h?.description || ''),
    holiday_type: holidayType,
    is_mandatory: h?.is_mandatory !== undefined ? Boolean(h.is_mandatory) : h?.is_restricted !== undefined ? !Boolean(h.is_restricted) : true,
    created_by: h?.created_by ? String(h.created_by) : undefined,
    created_at: h?.created_at ? String(h.created_at) : undefined,
    updated_at: h?.updated_at ? String(h.updated_at) : undefined,
  };
}

function normalizeMentionRecord(m: any): ManualCalendarEvent {
  return {
    id: String(m?.id || generateUUID()),
    title: String(m?.title || 'Notice'),
    start_date: String(m?.start_date || m?.startDate || '2026-10-01'),
    end_date: String(m?.end_date || m?.endDate || m?.start_date || m?.startDate || '2026-10-01'),
    event_type: (m?.event_type || m?.eventType || 'notice') as ManualEventType,
    description: String(m?.description || ''),
    created_by: String(m?.created_by || m?.createdBy || ''),
    created_at: String(m?.created_at || m?.createdAt || new Date().toISOString()),
  };
}

function normalizeNotificationRecord(n: any): AppNotification {
  return {
    id: String(n?.id || generateUUID()),
    recipient_user_id: String(n?.recipient_user_id || n?.recipient_id || n?.userId || ''),
    recipient_id: String(n?.recipient_user_id || n?.recipient_id || n?.userId || ''),
    sender_id: n?.sender_id ? String(n.sender_id) : null,
    title: String(n?.title || 'Notification'),
    message: String(n?.message || ''),
    type: String(n?.type || 'system') as any,
    leave_request_id: n?.leave_request_id || n?.reference_id || null,
    reference_id: n?.leave_request_id || n?.reference_id || null,
    is_read: Boolean(n?.is_read ?? n?.isRead ?? false),
    isRead: Boolean(n?.is_read ?? n?.isRead ?? false),
    created_at: String(n?.created_at || n?.createdAt || new Date().toISOString()),
    createdAt: String(n?.created_at || n?.createdAt || new Date().toISOString()),
    link: n?.link ? String(n.link) : undefined,
  };
}

// In-Memory State
let memoryUsers: UserProfile[] = INITIAL_USERS.map(normalizeUserRecord);
let memoryLeaves: LeaveRequest[] = INITIAL_LEAVES.map(normalizeLeaveRecord);
let memoryHolidays: GovernmentHoliday[] = INITIAL_HOLIDAYS.map(normalizeHolidayRecord);
let memoryMentions: ManualCalendarEvent[] = INITIAL_MENTIONS.map(normalizeMentionRecord);
let memoryNotifications: AppNotification[] = [];
let memoryMeetingSchedules: MeetingSchedule[] = [...INITIAL_MEETING_SCHEDULES];

type Listener = () => void;
const listeners: Set<Listener> = new Set();

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.warn('Listener execution error:', err);
    }
  });
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

async function safeFetchMeetingSchedules(): Promise<MeetingSchedule[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const res = await client.from('meeting_schedules').select('*');
    return (res.data as MeetingSchedule[]) || null;
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
    const [profilesData, leavesData, holidaysData, mentionsData, notifsData, meetingsData] = await Promise.all([
      withTimeout(safeFetchProfiles(), 4000, null),
      withTimeout(safeFetchLeaves(), 4000, null),
      withTimeout(safeFetchHolidays(), 4000, null),
      withTimeout(safeFetchMentions(), 4000, null),
      withTimeout(safeFetchNotifications(), 4000, null),
      withTimeout(safeFetchMeetingSchedules(), 4000, null),
    ]);

    let hasUpdates = false;

    if (profilesData && profilesData.length > 0) {
      // Merge profiles ensuring initial structure is preserved
      const merged = [...memoryUsers];
      profilesData.forEach((dbUser) => {
        if (!dbUser) return;
        const emailLower = (dbUser.email || '').toLowerCase().trim();
        if (emailLower === 'aswin@dwellvise.com' || emailLower === 'dinesh@dwellvise.com') {
          dbUser.role = 'admin';
        } else if (emailLower === 'pachamuthu@dwellvise.com' || emailLower === 'shalini@dwellvise.com') {
          dbUser.role = 'employee';
        }
        const idx = merged.findIndex((u) => 
          u.id === dbUser.id || 
          (dbUser.auth_user_id && (u.auth_user_id === dbUser.auth_user_id || u.id === dbUser.auth_user_id)) ||
          (u.email && dbUser.email && (u.email || '').toLowerCase().trim() === emailLower)
        );
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

    if (meetingsData && meetingsData.length > 0) {
      const merged = [...memoryMeetingSchedules];
      meetingsData.forEach((dbM) => {
        const idx = merged.findIndex((m) => m.meeting_type === dbM.meeting_type || m.id === dbM.id);
        if (idx !== -1) {
          merged[idx] = { ...merged[idx], ...dbM };
        } else {
          merged.push(dbM);
        }
      });
      memoryMeetingSchedules = merged;
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

let isStoreInitialized = false;

/**
 * Initialize data store from localStorage if running in browser
 */
export function initializeStore() {
  if (typeof window === 'undefined') return;
  if (isStoreInitialized) return;
  isStoreInitialized = true;

  try {
    // 1. Users
    let rawUsers = localStorage.getItem(STORAGE_KEY_USERS);
    if (!rawUsers) {
      // Check legacy key
      rawUsers = localStorage.getItem('officeflow_dwellvise_users_v3');
    }
    if (rawUsers) {
      try {
        const parsed = JSON.parse(rawUsers);
        if (Array.isArray(parsed)) {
          const normalized = parsed.map(normalizeUserRecord);
          // Ensure seed users exist and have updated roles
          INITIAL_USERS.forEach((initUser) => {
            const initEmailLower = (initUser.email || '').toLowerCase().trim();
            const existingIdx = normalized.findIndex(
              (u) =>
                u.id === initUser.id ||
                (u.email && (u.email || '').toLowerCase().trim() === initEmailLower)
            );
            if (existingIdx !== -1) {
              normalized[existingIdx] = {
                ...normalized[existingIdx],
                full_name: initUser.full_name,
                role: initUser.role,
                department: normalized[existingIdx].department || initUser.department,
                designation: normalized[existingIdx].designation || initUser.designation,
                is_active: normalized[existingIdx].is_active ?? true,
              };
            } else {
              normalized.push(normalizeUserRecord(initUser));
            }
          });
          memoryUsers = normalized;
        } else {
          memoryUsers = INITIAL_USERS.map(normalizeUserRecord);
        }
      } catch {
        memoryUsers = INITIAL_USERS.map(normalizeUserRecord);
      }
    } else {
      memoryUsers = INITIAL_USERS.map(normalizeUserRecord);
    }
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(memoryUsers));

    // 2. Leaves
    let rawLeaves = localStorage.getItem(STORAGE_KEY_LEAVES);
    if (!rawLeaves) {
      rawLeaves = localStorage.getItem('officeflow_dwellvise_leaves_v3');
    }
    if (rawLeaves) {
      try {
        const parsedLeaves = JSON.parse(rawLeaves);
        if (Array.isArray(parsedLeaves)) {
          memoryLeaves = parsedLeaves.map(normalizeLeaveRecord);
        } else {
          memoryLeaves = INITIAL_LEAVES.map(normalizeLeaveRecord);
        }
      } catch {
        memoryLeaves = INITIAL_LEAVES.map(normalizeLeaveRecord);
      }
    } else {
      memoryLeaves = INITIAL_LEAVES.map(normalizeLeaveRecord);
    }
    localStorage.setItem(STORAGE_KEY_LEAVES, JSON.stringify(memoryLeaves));

    // 3. Holidays
    let rawHolidays = localStorage.getItem(STORAGE_KEY_HOLIDAYS);
    if (!rawHolidays) {
      rawHolidays = localStorage.getItem('officeflow_dwellvise_holidays_v3');
    }
    if (rawHolidays) {
      try {
        const parsedHolidays = JSON.parse(rawHolidays);
        if (Array.isArray(parsedHolidays)) {
          memoryHolidays = parsedHolidays.map(normalizeHolidayRecord);
        } else {
          memoryHolidays = INITIAL_HOLIDAYS.map(normalizeHolidayRecord);
        }
      } catch {
        memoryHolidays = INITIAL_HOLIDAYS.map(normalizeHolidayRecord);
      }
    } else {
      memoryHolidays = INITIAL_HOLIDAYS.map(normalizeHolidayRecord);
    }
    localStorage.setItem(STORAGE_KEY_HOLIDAYS, JSON.stringify(memoryHolidays));

    // 4. Mentions
    let rawMentions = localStorage.getItem(STORAGE_KEY_MENTIONS);
    if (!rawMentions) {
      rawMentions = localStorage.getItem('officeflow_dwellvise_mentions_v3');
    }
    if (rawMentions) {
      try {
        const parsedMentions = JSON.parse(rawMentions);
        if (Array.isArray(parsedMentions)) {
          memoryMentions = parsedMentions.map(normalizeMentionRecord);
        } else {
          memoryMentions = INITIAL_MENTIONS.map(normalizeMentionRecord);
        }
      } catch {
        memoryMentions = INITIAL_MENTIONS.map(normalizeMentionRecord);
      }
    } else {
      memoryMentions = INITIAL_MENTIONS.map(normalizeMentionRecord);
    }
    localStorage.setItem(STORAGE_KEY_MENTIONS, JSON.stringify(memoryMentions));

    // 5. Notifications
    let rawNotifs = localStorage.getItem(STORAGE_KEY_NOTIFICATIONS);
    if (!rawNotifs) {
      rawNotifs = localStorage.getItem('officeflow_dwellvise_notifications_v3');
    }
    if (rawNotifs) {
      try {
        const parsedNotifs = JSON.parse(rawNotifs);
        if (Array.isArray(parsedNotifs)) {
          memoryNotifications = parsedNotifs.map(normalizeNotificationRecord);
        } else {
          memoryNotifications = [];
        }
      } catch {
        memoryNotifications = [];
      }
    } else {
      memoryNotifications = [];
    }
    localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(memoryNotifications));

    // 6. Meetings
    let rawMeetings = localStorage.getItem(STORAGE_KEY_MEETINGS);
    if (!rawMeetings) {
      rawMeetings = localStorage.getItem('officeflow_dwellvise_meetings_v3');
    }
    if (rawMeetings) {
      try {
        const parsedMeetings = JSON.parse(rawMeetings);
        if (Array.isArray(parsedMeetings)) {
          const mergedMeetings = [...parsedMeetings];
          INITIAL_MEETING_SCHEDULES.forEach((initM) => {
            const exists = mergedMeetings.some((m) => m.meeting_type === initM.meeting_type);
            if (!exists) mergedMeetings.push(initM);
          });
          memoryMeetingSchedules = mergedMeetings;
        } else {
          memoryMeetingSchedules = [...INITIAL_MEETING_SCHEDULES];
        }
      } catch {
        memoryMeetingSchedules = [...INITIAL_MEETING_SCHEDULES];
      }
    } else {
      memoryMeetingSchedules = [...INITIAL_MEETING_SCHEDULES];
    }
    localStorage.setItem(STORAGE_KEY_MEETINGS, JSON.stringify(memoryMeetingSchedules));

    // Clean up old legacy keys to free storage and avoid conflicts
    LEGACY_STORAGE_KEYS.forEach((oldKey) => {
      try {
        localStorage.removeItem(oldKey);
      } catch {}
    });
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
    localStorage.setItem(STORAGE_KEY_MEETINGS, JSON.stringify(memoryMeetingSchedules));
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
  return memoryUsers.map((u) => {
    const emailLower = (u?.email || '').toLowerCase().trim();
    if (emailLower === 'aswin@dwellvise.com' || emailLower === 'dinesh@dwellvise.com') {
      return { ...u, role: 'admin' as const };
    } else if (emailLower === 'pachamuthu@dwellvise.com' || emailLower === 'shalini@dwellvise.com') {
      return { ...u, role: 'employee' as const };
    }
    return u;
  });
}

export function upsertUserInMemory(profile: UserProfile): void {
  if (!profile) return;
  const normalized = normalizeUserRecord(profile);
  const emailLower = (normalized.email || '').toLowerCase().trim();
  const idx = memoryUsers.findIndex(
    (u) =>
      u.id === normalized.id ||
      (normalized.auth_user_id && (u.auth_user_id === normalized.auth_user_id || u.id === normalized.auth_user_id)) ||
      (normalized.email && u.email && (u.email || '').toLowerCase().trim() === emailLower)
  );
  if (idx !== -1) {
    memoryUsers[idx] = { ...memoryUsers[idx], ...normalized };
  } else {
    memoryUsers.push(normalized);
  }
  persistStore();
}

export function getUserById(id: string): UserProfile | undefined {
  if (!id) return undefined;
  const targetIdLower = id.toLowerCase().trim();
  const found = memoryUsers.find(
    (u) =>
      u.id === id ||
      u.auth_user_id === id ||
      (u.email && (u.email || '').toLowerCase().trim() === targetIdLower)
  );
  if (!found) return undefined;
  const emailLower = (found.email || '').toLowerCase().trim();
  if (emailLower === 'aswin@dwellvise.com' || emailLower === 'dinesh@dwellvise.com') {
    return { ...found, role: 'admin' as const };
  } else if (emailLower === 'pachamuthu@dwellvise.com' || emailLower === 'shalini@dwellvise.com') {
    return { ...found, role: 'employee' as const };
  }
  return found;
}

export function getLeaves(): LeaveRequest[] {
  return memoryLeaves.map((leave) => ({
    ...leave,
    user: memoryUsers.find((u) => u.id === leave.user_id || (u.auth_user_id && u.auth_user_id === leave.user_id)),
    approver: leave.approved_by ? memoryUsers.find((u) => u.id === leave.approved_by || (u.auth_user_id && u.auth_user_id === leave.approved_by)) : undefined,
  }));
}

export function getLeaveById(id: string): LeaveRequest | undefined {
  const leave = memoryLeaves.find((l) => l.id === id);
  if (!leave) return undefined;
  return {
    ...leave,
    user: memoryUsers.find((u) => u.id === leave.user_id || (u.auth_user_id && u.auth_user_id === leave.user_id)),
    approver: leave.approved_by ? memoryUsers.find((u) => u.id === leave.approved_by || (u.auth_user_id && u.auth_user_id === leave.approved_by)) : undefined,
  };
}

export function getHolidays(): GovernmentHoliday[] {
  return [...memoryHolidays].sort((a, b) => (a?.date || '').localeCompare(b?.date || ''));
}

export function getMentions(): ManualCalendarEvent[] {
  return memoryMentions
    .map((m) => ({
      ...m,
      creator: memoryUsers.find((u) => u.id === m.created_by),
    }))
    .sort((a, b) => (a?.start_date || '').localeCompare(b?.start_date || ''));
}

export function getNotifications(recipientId: string): AppNotification[] {
  if (!recipientId) return [];
  return memoryNotifications
    .filter((n) => n.recipient_user_id === recipientId || n.recipient_id === recipientId || n.userId === recipientId)
    .sort((a, b) => new Date(b?.created_at || b?.createdAt || 0).getTime() - new Date(a?.created_at || a?.createdAt || 0).getTime());
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
      const hName = holiday?.name || '';
      const hDesc = holiday?.description || '';
      if (filter?.searchQuery) {
        const query = (filter.searchQuery || '').toLowerCase().trim();
        if (
          !hName.toLowerCase().includes(query) &&
          !hDesc.toLowerCase().includes(query)
        ) {
          return;
        }
      }

      events.push({
        id: `event-${holiday.id}`,
        type: 'holiday',
        title: hName,
        startDate: holiday.date || '2026-01-01',
        endDate: holiday.date || '2026-01-01',
        isHoliday: true,
        holidayType: holiday.holiday_type || 'Public Holiday',
        description: hDesc,
        rawHoliday: holiday,
      });
    });
  }

  // 2. Add Manual Admin Calendar Mentions
  if (filter?.showMentions !== false) {
    const allMentions = getMentions();
    allMentions.forEach((mention) => {
      const mTitle = mention?.title || '';
      const mDesc = mention?.description || '';
      if (filter?.searchQuery) {
        const query = (filter.searchQuery || '').toLowerCase().trim();
        const t = mTitle.toLowerCase();
        const d = mDesc.toLowerCase();
        if (!t.includes(query) && !d.includes(query)) {
          return;
        }
      }

      events.push({
        id: `event-${mention.id}`,
        type: 'mention',
        title: mTitle,
        startDate: mention.start_date || '2026-10-01',
        endDate: mention.end_date || mention.start_date || '2026-10-01',
        manualEventType: mention.event_type || 'notice',
        description: mDesc,
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
    if ((leave.status || '').toLowerCase() !== 'approved' || !leave.show_on_calendar) {
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
      const query = (filter.searchQuery || '').toLowerCase().trim();
      const userName = (user?.full_name || '').toLowerCase();
      const lType = (leave.leave_type || '').toLowerCase();
      if (!userName.includes(query) && !lType.includes(query)) {
        return;
      }
    }

    events.push({
      id: `event-${leave.id}`,
      type: 'leave',
      title: `${user?.full_name || 'Employee'} - ${leave.leave_type || 'Leave'}`,
      startDate: leave.start_date || '2026-10-01',
      endDate: leave.end_date || leave.start_date || '2026-10-01',
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

  // 4. Add Calculated Tactical & Strategic Meetings
  if (filter?.showMeetings !== false) {
    const meetingOccurrences = getAllCalculatedMeetingOccurrences();
    meetingOccurrences.forEach((occurrence) => {
      if (filter?.searchQuery) {
        const query = filter.searchQuery.toLowerCase();
        const t = occurrence.title.toLowerCase();
        const d = (occurrence.description || '').toLowerCase();
        const typeStr = occurrence.meeting_type.toLowerCase();
        if (!t.includes(query) && !d.includes(query) && !typeStr.includes(query)) {
          return;
        }
      }

      events.push({
        id: `event-${occurrence.id}`,
        type: 'meeting',
        title: occurrence.title,
        startDate: occurrence.actual_date,
        endDate: occurrence.actual_date,
        meetingType: occurrence.meeting_type,
        meetingTime: occurrence.meeting_time,
        isShiftedMeeting: occurrence.is_shifted,
        meetingShiftReason: occurrence.shift_reason,
        description: occurrence.description,
        rawMeeting: occurrence,
      });
    });
  }

  return events;
}

// ==============================================================================
// MEETING SCHEDULES (TACTICAL & STRATEGIC RECURRING MANAGEMENT)
// ==============================================================================

export function getMeetingSchedules(): MeetingSchedule[] {
  return [...memoryMeetingSchedules];
}

export function getMeetingScheduleByType(type: MeetingType): MeetingSchedule | undefined {
  return memoryMeetingSchedules.find((m) => m.meeting_type === type);
}

export function getAllCalculatedMeetingOccurrences(
  rangeStart: string = '2026-10-01',
  rangeEnd: string = '2027-12-31'
): CalculatedMeetingOccurrence[] {
  const leaves = getLeaves();
  const occurrences: CalculatedMeetingOccurrence[] = [];

  memoryMeetingSchedules.forEach((schedule) => {
    if (schedule.is_active) {
      const scheduleOccurrences = calculateScheduleOccurrences(schedule, leaves, rangeStart, rangeEnd, 100);
      occurrences.push(...scheduleOccurrences);
    }
  });

  return occurrences.sort((a, b) => a.actual_date.localeCompare(b.actual_date));
}

export function getUpcomingMeetingOccurrences(referenceDate: string = '2026-10-01') {
  const leaves = getLeaves();
  const tacticalSchedule = memoryMeetingSchedules.find((m) => m.meeting_type === 'tactical');
  const strategicSchedule = memoryMeetingSchedules.find((m) => m.meeting_type === 'strategic');

  const tacticalNext = tacticalSchedule && tacticalSchedule.is_active
    ? getNextUpcomingMeeting(tacticalSchedule, leaves, referenceDate)
    : null;

  const strategicNext = strategicSchedule && strategicSchedule.is_active
    ? getNextUpcomingMeeting(strategicSchedule, leaves, referenceDate)
    : null;

  const allUpcoming = getAllCalculatedMeetingOccurrences(referenceDate, '2027-12-31');

  return {
    tactical: tacticalNext,
    strategic: strategicNext,
    list: allUpcoming.slice(0, 8),
  };
}

export async function updateMeetingSchedule(
  type: MeetingType,
  updates: Partial<MeetingSchedule>
): Promise<{ success: boolean; message: string; schedule?: MeetingSchedule }> {
  const idx = memoryMeetingSchedules.findIndex((m) => m.meeting_type === type);
  if (idx === -1) {
    return { success: false, message: `Meeting schedule ${type} not found.` };
  }

  const nowIso = new Date().toISOString();
  const updatedSchedule: MeetingSchedule = {
    ...memoryMeetingSchedules[idx],
    ...updates,
    updated_at: nowIso,
  };

  memoryMeetingSchedules[idx] = updatedSchedule;
  persistStore();

  const client = getSupabaseClient();
  if (isSupabaseConfigured() && client) {
    try {
      const { error } = await client
        .from('meeting_schedules')
        .upsert(
          {
            id: updatedSchedule.id,
            meeting_type: updatedSchedule.meeting_type,
            title: updatedSchedule.title,
            frequency_days: updatedSchedule.frequency_days,
            first_meeting_date: updatedSchedule.first_meeting_date,
            meeting_time: updatedSchedule.meeting_time,
            description: updatedSchedule.description,
            is_active: updatedSchedule.is_active,
            updated_at: nowIso,
          },
          { onConflict: 'meeting_type' }
        );

      if (error) {
        console.warn('Supabase meeting_schedules upsert error:', error.message);
      }
    } catch (err) {
      console.warn('Supabase meeting_schedules sync failed:', err);
    }
  }

  return {
    success: true,
    message: `${updatedSchedule.title} schedule updated successfully.`,
    schedule: updatedSchedule,
  };
}

export async function toggleMeetingScheduleActive(
  type: MeetingType
): Promise<{ success: boolean; message: string; schedule?: MeetingSchedule }> {
  const schedule = getMeetingScheduleByType(type);
  if (!schedule) {
    return { success: false, message: 'Meeting schedule not found.' };
  }
  const newActive = !schedule.is_active;
  return updateMeetingSchedule(type, { is_active: newActive });
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

  const client = getSupabaseClient();
  let authUser: { id: string; email?: string } | null = null;
  if (isSupabaseConfigured() && client) {
    try {
      const { data: authData } = await client.auth.getUser();
      if (authData?.user) {
        authUser = authData.user;
      }
    } catch {
      // Ignore auth get error
    }
  }

  // 1. Resolve Profile: Check memory by userId, authUser.id, or email
  let user: UserProfile | undefined = getUserById(userId);
  if (!user && authUser) {
    user = getUserById(authUser.id);
    if (!user && authUser.email) {
      const authEmailLower = authUser.email.toLowerCase().trim();
      user = memoryUsers.find((u) => u.email && (u.email || '').toLowerCase().trim() === authEmailLower);
    }
  }

  // 2. If not found in memory, query Supabase public.profiles directly
  if (!user && isSupabaseConfigured() && client) {
    try {
      const targetId = authUser?.id || userId;
      const { data: dbProfile } = await client
        .from('profiles')
        .select('*')
        .eq('id', targetId)
        .maybeSingle();

      if (dbProfile) {
        user = dbProfile as UserProfile;
        upsertUserInMemory(user);
      } else if (authUser?.email) {
        const { data: dbProfileByEmail } = await client
          .from('profiles')
          .select('*')
          .eq('email', authUser.email.toLowerCase().trim())
          .maybeSingle();

        if (dbProfileByEmail) {
          user = dbProfileByEmail as UserProfile;
          upsertUserInMemory(user);
        }
      }
    } catch (err) {
      console.warn('Supabase profile query during leave apply exception:', err);
    }
  }

  // 3. Fallback match in INITIAL_USERS
  if (!user) {
    user = INITIAL_USERS.find(
      (u) =>
        u.id === userId ||
        (authUser && (u.id === authUser.id || (authUser.email && (u.email || '').toLowerCase().trim() === (authUser.email || '').toLowerCase().trim())))
    );
    if (user) {
      upsertUserInMemory(user);
    }
  }

  if (!user) {
    return {
      success: false,
      message: 'Employee profile not configured. Please contact an administrator.',
    };
  }

  const effectiveUserId = user.id;

  // Check for duplicate / overlapping active requests
  const existingOverlap = memoryLeaves.find(
    (l) =>
      (l.user_id === effectiveUserId || l.user_id === userId) &&
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
    user_id: effectiveUserId,
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

  // 2. Insert into Supabase FIRST so foreign key constraints in notifications are satisfied
  if (isSupabaseConfigured() && client) {
    try {
      const { error: insertLeaveErr } = await client.from('leave_requests').insert({
        id: newLeave.id,
        user_id: effectiveUserId,
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
    if (admin.id === effectiveUserId || admin.id === user.id) continue;

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

  const emailLower = (employee.email || '').toLowerCase().trim();
  const existing = memoryUsers.find((u) => (u.email || '').toLowerCase().trim() === emailLower);
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
  const upcomingMeetings = getUpcomingMeetingOccurrences(todayDateStr);

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
    upcomingMeetings,
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
