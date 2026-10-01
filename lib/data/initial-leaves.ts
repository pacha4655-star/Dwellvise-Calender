import { LeaveRequest } from '@/types';

export const INITIAL_LEAVES: LeaveRequest[] = [
  {
    id: 'leave-2026-10-002',
    user_id: '00000000-0000-0000-0000-000000000003', // Arun
    leave_type: 'Personal Leave',
    start_date: '2026-10-12',
    end_date: '2026-10-12',
    reason: 'Apartment documentation and lease formalities',
    status: 'approved',
    show_on_calendar: true, // Marked ON by manager
    approved_by: '00000000-0000-0000-0000-000000000001',
    approved_at: '2026-10-01T11:00:00Z',
    created_at: '2026-09-29T14:20:00Z',
  },
  {
    id: 'leave-2026-10-003',
    user_id: '00000000-0000-0000-0000-000000000004', // Reshma
    leave_type: 'Casual Leave',
    start_date: '2026-10-26',
    end_date: '2026-10-27',
    reason: 'Attending Advanced Test Automation Summit in Bangalore',
    status: 'pending',
    show_on_calendar: false, // Pending leaves NEVER appear on shared calendar
    approved_by: null,
    approved_at: null,
    created_at: '2026-10-01T08:45:00Z',
  },
];
