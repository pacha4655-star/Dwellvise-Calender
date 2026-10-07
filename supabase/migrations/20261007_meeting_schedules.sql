-- ==============================================================================
-- OfficeFlow - Admin Meeting Scheduling Migration (Tactical & Strategic)
-- Migration: 20261007_meeting_schedules.sql
-- ==============================================================================

-- 1. Create meeting_schedules table
CREATE TABLE IF NOT EXISTS public.meeting_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_type TEXT NOT NULL CHECK (meeting_type IN ('tactical', 'strategic')),
  title TEXT NOT NULL,
  frequency_days INT NOT NULL CHECK (frequency_days > 0),
  first_meeting_date DATE NOT NULL,
  meeting_time TEXT DEFAULT '10:00 AM - 11:00 AM',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_meeting_schedules_type UNIQUE (meeting_type)
);

-- 2. Insert or update default Tactical (14 days) and Strategic (45 days) schedules
INSERT INTO public.meeting_schedules (
  id,
  meeting_type,
  title,
  frequency_days,
  first_meeting_date,
  meeting_time,
  description,
  is_active
)
VALUES 
  (
    '00000000-0000-0000-0000-000000000010',
    'tactical',
    'Tactical Meeting',
    14,
    '2026-10-08',
    '10:00 AM - 11:00 AM',
    'Bi-weekly operational alignment and team priorities sync.',
    true
  ),
  (
    '00000000-0000-0000-0000-000000000011',
    'strategic',
    'Strategic Meeting',
    45,
    '2026-10-15',
    '02:00 PM - 03:30 PM',
    'Long-term project milestones, engineering roadmap and strategic review.',
    true
  )
ON CONFLICT (meeting_type) DO UPDATE SET
  frequency_days = EXCLUDED.frequency_days,
  updated_at = timezone('utc'::text, now());

-- 3. Row Level Security for Meeting Schedules
ALTER TABLE public.meeting_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Meeting schedules are readable by all authenticated users" ON public.meeting_schedules;
CREATE POLICY "Meeting schedules are readable by all authenticated users"
  ON public.meeting_schedules FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage meeting schedules" ON public.meeting_schedules;
CREATE POLICY "Admins can manage meeting schedules"
  ON public.meeting_schedules FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE (auth_user_id = auth.uid() OR id = auth.uid()) AND role = 'admin'));
