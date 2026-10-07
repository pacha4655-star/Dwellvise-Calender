-- ==============================================================================
-- OfficeFlow - Complete Admin Tracking & Notification System Migration
-- Migration: 20261007_admin_tracking_notifications_fix.sql
-- ==============================================================================

-- 1. Ensure Profiles Table & Update Dinesh / Aswin / Shalini / Pachamuthu
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('employee', 'admin')),
  department TEXT NOT NULL DEFAULT 'Engineering',
  designation TEXT DEFAULT 'Staff Member',
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Ensure Dinesh and Aswin are active admins; Shalini and Pachamuthu are active employees
INSERT INTO public.profiles (id, full_name, email, role, department, designation, phone, is_active)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Pachamuthu', 'pachamuthu@dwellvise.com', 'employee', 'Engineering', 'Senior Software Engineer', '+91 98400 22334', true),
  ('00000000-0000-0000-0000-000000000002', 'Aswin', 'aswin@dwellvise.com', 'admin', 'Engineering', 'Software Engineer', '+91 98400 33445', true),
  ('00000000-0000-0000-0000-000000000003', 'Dinesh', 'dinesh@dwellvise.com', 'admin', 'Management', 'Operations & Engineering Lead', '+91 98400 11223', true),
  ('00000000-0000-0000-0000-000000000004', 'Shalini', 'shalini@dwellvise.com', 'employee', 'Engineering', 'Software Engineer', '+91 98400 44556', true)
ON CONFLICT (email) DO UPDATE SET 
  role = EXCLUDED.role,
  full_name = EXCLUDED.full_name,
  department = EXCLUDED.department,
  designation = EXCLUDED.designation,
  is_active = EXCLUDED.is_active,
  updated_at = timezone('utc'::text, now());

-- 2. Ensure Leave Requests Table & Structure
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('Casual Leave', 'Sick Leave', 'Personal Leave', 'Emergency Leave', 'Other')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  show_on_calendar BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT chk_leave_dates CHECK (end_date >= start_date)
);

-- 3. Ensure Notifications Table & Foreign Keys
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('leave_request', 'leave_approved', 'leave_rejected', 'info', 'success', 'warning', 'error')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  leave_request_id UUID REFERENCES public.leave_requests(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Create Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_role_active ON public.profiles(role, is_active);
CREATE INDEX IF NOT EXISTS idx_leave_requests_user_id ON public.leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_visibility ON public.leave_requests(show_on_calendar);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_user_id ON public.notifications(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_leave_request_id ON public.notifications(leave_request_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);

-- 5. Row Level Security (RLS) - Leave Requests
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Users can create their own leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Users can cancel their own pending leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Admins can update, approve/reject, and toggle show_on_calendar for all leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Admins can manage all leave requests" ON public.leave_requests;

-- Admins see ALL leave requests; Employees see only their own leave requests
CREATE POLICY "Users can view their own leave requests"
  ON public.leave_requests FOR SELECT TO authenticated
  USING (
    user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() OR id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE (auth_user_id = auth.uid() OR id = auth.uid()) AND role = 'admin' AND is_active = true
    )
  );

CREATE POLICY "Users can create their own leave requests"
  ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (
    user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() OR id = auth.uid())
  );

CREATE POLICY "Users can cancel their own pending leave requests"
  ON public.leave_requests FOR UPDATE TO authenticated
  USING (
    user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() OR id = auth.uid())
    AND status = 'pending'
  );

CREATE POLICY "Admins can update, approve/reject, and toggle show_on_calendar for all leave requests"
  ON public.leave_requests FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE (auth_user_id = auth.uid() OR id = auth.uid()) AND role = 'admin' AND is_active = true
    )
  );

-- 6. Row Level Security (RLS) - Notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can manage all notifications" ON public.notifications;

-- Per-User notification isolation: Each user only selects and updates their own notification row
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (
    recipient_user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() OR id = auth.uid())
  );

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (
    recipient_user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() OR id = auth.uid())
  )
  WITH CHECK (
    recipient_user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() OR id = auth.uid())
  );

CREATE POLICY "Authenticated users can create notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- 7. Shared Calendar Leaves View (Approved & Show on Calendar = true, Private Reason masked for normal staff)
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
      EXISTS (SELECT 1 FROM public.profiles admin_p WHERE (admin_p.auth_user_id = auth.uid() OR admin_p.id = auth.uid()) AND admin_p.role = 'admin' AND admin_p.is_active = true)
    ) THEN lr.reason
    ELSE NULL
  END AS reason
FROM public.leave_requests lr
JOIN public.profiles p ON lr.user_id = p.id
WHERE lr.status = 'approved' AND lr.show_on_calendar = true;
