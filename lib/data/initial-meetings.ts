import { MeetingSchedule } from '@/types';

export const INITIAL_MEETING_SCHEDULES: MeetingSchedule[] = [
  {
    id: '00000000-0000-0000-0000-000000000010',
    meeting_type: 'tactical',
    title: 'Tactical Meeting',
    frequency_days: 14,
    first_meeting_date: '2026-10-08',
    meeting_time: '10:00 AM - 11:00 AM',
    description: 'Bi-weekly operational alignment and team priorities sync.',
    is_active: true,
    created_at: '2026-10-01T09:00:00Z',
    updated_at: '2026-10-01T09:00:00Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000011',
    meeting_type: 'strategic',
    title: 'Strategic Meeting',
    frequency_days: 45,
    first_meeting_date: '2026-10-15',
    meeting_time: '02:00 PM - 03:30 PM',
    description: 'Long-term project milestones, engineering roadmap and strategic review.',
    is_active: true,
    created_at: '2026-10-01T09:00:00Z',
    updated_at: '2026-10-01T09:00:00Z',
  },
];
