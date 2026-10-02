-- ==============================================================================
-- OfficeFlow - Leave & Government Holiday Calendar Schema
-- Database: Supabase PostgreSQL (Updated with Privacy & Robust Auth/RLS)
-- ==============================================================================

-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table (Holds employee information & roles)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('employee', 'admin')),
  department TEXT NOT NULL DEFAULT 'General',
  designation TEXT DEFAULT 'Staff Member',
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Leave Requests Table (With explicit show_on_calendar control)
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('Casual Leave', 'Sick Leave', 'Personal Leave', 'Emergency Leave', 'Other')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  show_on_calendar BOOLEAN NOT NULL DEFAULT false, -- Only true when Admin explicitly marks it visible
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT chk_leave_dates CHECK (end_date >= start_date)
);

-- 3. Government Holidays Table
CREATE TABLE IF NOT EXISTS public.holidays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  date DATE NOT NULL UNIQUE,
  description TEXT,
  holiday_type TEXT NOT NULL DEFAULT 'Government Holiday' CHECK (holiday_type IN ('Government Holiday', 'Public Holiday', 'Restricted Holiday', 'Regional Holiday')),
  is_mandatory BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Manual Calendar Mentions Table (Admin-only events, meetings, outings, announcements)
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'Company Event' CHECK (event_type IN ('Company Event', 'Office Meeting', 'Team Outing', 'Work From Home', 'Announcement', 'Other Note')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT chk_mention_dates CHECK (end_date >= start_date)
);

-- 5. Leave Balances Table
CREATE TABLE IF NOT EXISTS public.leave_balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year INT NOT NULL,
  casual_leave_total INT NOT NULL DEFAULT 12,
  casual_leave_used NUMERIC(4, 1) NOT NULL DEFAULT 0,
  sick_leave_total INT NOT NULL DEFAULT 10,
  sick_leave_used NUMERIC(4, 1) NOT NULL DEFAULT 0,
  personal_leave_total INT NOT NULL DEFAULT 6,
  personal_leave_used NUMERIC(4, 1) NOT NULL DEFAULT 0,
  emergency_leave_total INT NOT NULL DEFAULT 4,
  emergency_leave_used NUMERIC(4, 1) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (user_id, year)
);

-- 6. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('leave_request', 'leave_approved', 'leave_rejected', 'info', 'success', 'warning', 'error')),
  reference_id UUID NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_id ON public.profiles(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_user_id ON public.leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON public.leave_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_visibility ON public.leave_requests(show_on_calendar);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON public.holidays(date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_dates ON public.calendar_events(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON public.notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at);

-- ==============================================================================
-- SHARED CALENDAR VIEW (ENFORCING APPROVED + SHOW_ON_CALENDAR = TRUE)
-- ==============================================================================
CREATE OR REPLACE VIEW public.shared_calendar_leaves AS
SELECT 
  lr.id,
  lr.user_id,
  p.full_name AS employee_name,
  p.department,
  lr.leave_type,
  lr.start_date,
  lr.end_date,
  lr.status,
  lr.show_on_calendar,
  lr.created_at,
  -- Private reason is revealed ONLY to the employee owner or Admins
  CASE 
    WHEN auth.uid() IS NOT NULL AND (
      p.auth_user_id = auth.uid() OR 
      p.id = auth.uid() OR
      EXISTS (SELECT 1 FROM public.profiles admin_p WHERE (admin_p.auth_user_id = auth.uid() OR admin_p.id = auth.uid()) AND admin_p.role = 'admin')
    ) THEN lr.reason
    ELSE NULL
  END AS reason
FROM public.leave_requests lr
JOIN public.profiles p ON lr.user_id = p.id
WHERE lr.status = 'approved' AND lr.show_on_calendar = true;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Public profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = auth_user_id OR auth.uid() = id)
  WITH CHECK (auth.uid() = auth_user_id OR auth.uid() = id);

CREATE POLICY "Admins can manage all profiles"
  ON public.profiles FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE (auth_user_id = auth.uid() OR id = auth.uid()) AND role = 'admin'));

-- Holidays Policies
CREATE POLICY "Holidays are readable by all authenticated users"
  ON public.holidays FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins can manage holidays"
  ON public.holidays FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE (auth_user_id = auth.uid() OR id = auth.uid()) AND role = 'admin'));

-- Manual Calendar Events Policies
CREATE POLICY "Calendar events are readable by all authenticated users"
  ON public.calendar_events FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins can insert, update, or delete calendar events"
  ON public.calendar_events FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE (auth_user_id = auth.uid() OR id = auth.uid()) AND role = 'admin'));

-- Leave Requests Policies
CREATE POLICY "Users can view their own leave requests"
  ON public.leave_requests FOR SELECT TO authenticated
  USING (
    user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() OR id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE (auth_user_id = auth.uid() OR id = auth.uid()) AND role = 'admin')
  );

CREATE POLICY "Users can create their own leave requests"
  ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() OR id = auth.uid()));

CREATE POLICY "Users can cancel their own pending leave requests"
  ON public.leave_requests FOR UPDATE TO authenticated
  USING (user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() OR id = auth.uid()) AND status = 'pending');

CREATE POLICY "Admins can update, approve/reject, and toggle show_on_calendar for all leave requests"
  ON public.leave_requests FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE (auth_user_id = auth.uid() OR id = auth.uid()) AND role = 'admin'));

-- Notifications Policies
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (recipient_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() OR id = auth.uid()));

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (recipient_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() OR id = auth.uid()));

CREATE POLICY "Authenticated users can create notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage all notifications"
  ON public.notifications FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE (auth_user_id = auth.uid() OR id = auth.uid()) AND role = 'admin'));
