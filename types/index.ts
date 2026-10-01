export type Role = 'employee' | 'admin';

export type LeaveType =
  | 'Casual Leave'
  | 'Sick Leave'
  | 'Personal Leave'
  | 'Emergency Leave'
  | 'Other';

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type HolidayType =
  | 'Government Holiday'
  | 'Public Holiday'
  | 'Restricted Holiday'
  | 'Regional Holiday';

export type ManualEventType =
  | 'Company Event'
  | 'Office Meeting'
  | 'Team Outing'
  | 'Work From Home'
  | 'Announcement'
  | 'Other Note';

export interface UserProfile {
  id: string;
  auth_user_id?: string;
  full_name: string;
  email: string;
  role: Role;
  department: string;
  designation: string;
  phone?: string;
  avatar_url?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type: LeaveType;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  reason: string;
  status: LeaveStatus;
  show_on_calendar: boolean; // Controls whether this leave appears on shared calendar
  approved_by?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at?: string;
  // Hydrated relation fields
  user?: UserProfile;
  approver?: UserProfile;
}

export interface GovernmentHoliday {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  description: string;
  holiday_type: HolidayType;
  is_mandatory: boolean;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ManualCalendarEvent {
  id: string;
  title: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  description?: string;
  event_type: ManualEventType;
  created_by: string;
  created_at: string;
  updated_at?: string;
  creator?: UserProfile;
}

export interface LeaveBalance {
  id?: string;
  user_id: string;
  year: number;
  casual_leave_total: number;
  casual_leave_used: number;
  sick_leave_total: number;
  sick_leave_used: number;
  personal_leave_total: number;
  personal_leave_used: number;
  emergency_leave_total: number;
  emergency_leave_used: number;
}

export type CalendarEventType = 'holiday' | 'leave' | 'mention';

export interface CalendarEvent {
  id: string;
  type: CalendarEventType;
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  leaveType?: LeaveType;
  status?: LeaveStatus;
  showOnCalendar?: boolean;
  userId?: string;
  userName?: string;
  userDepartment?: string;
  userRole?: Role;
  reason?: string;
  isHoliday?: boolean;
  holidayType?: HolidayType;
  description?: string;
  isOwnLeave?: boolean;
  manualEventType?: ManualEventType;
  rawLeave?: LeaveRequest;
  rawHoliday?: GovernmentHoliday;
  rawMention?: ManualCalendarEvent;
}

export interface CalendarFilter {
  searchQuery: string;
  selectedUser: string; // 'all' | user_id
  selectedLeaveType: string; // 'all' | LeaveType
  selectedStatus: string; // 'all' | LeaveStatus
  showHolidays: boolean;
  showMentions: boolean;
}

export type NotificationType =
  | 'leave_request'
  | 'leave_approved'
  | 'leave_rejected'
  | 'info'
  | 'success'
  | 'warning'
  | 'error';

export interface AppNotification {
  id: string;
  recipient_id: string;
  sender_id?: string | null;
  title: string;
  message: string;
  type: NotificationType;
  reference_id?: string | null;
  is_read: boolean;
  created_at: string;
  // Compatibility fields
  userId?: string;
  isRead?: boolean;
  createdAt?: string;
  link?: string;
}

export interface ReportSummary {
  totalEmployees: number;
  totalLeaveRequests: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  cancelledCount: number;
  calendarVisibleCount: number;
  totalHolidays: number;
  totalMentions: number;
  employeeStats: {
    user: UserProfile;
    totalLeaves: number;
    approved: number;
    pending: number;
    rejected: number;
    daysTaken: number;
  }[];
  monthlyStats: {
    monthName: string;
    monthKey: string;
    leaveCount: number;
    holidayCount: number;
    mentionCount: number;
  }[];
}
