-- ==============================================================================
-- OfficeFlow - Canonical Production Migration: Two-Admin Parity, Auth UUID Sync,
-- Dynamic Multi-Admin Notifications, and RLS Security
-- Migration: 20261009_production_roles_notifications_and_parity.sql
-- ==============================================================================

-- 1. Ensure Table Structure & Constraints
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('employee', 'admin')),
  department TEXT NOT NULL DEFAULT 'Engineering',
  designation TEXT DEFAULT 'Software Engineer',
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auth_user_id UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

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

CREATE TABLE IF NOT EXISTS public.holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date DATE UNIQUE NOT NULL,
  description TEXT,
  holiday_type TEXT NOT NULL DEFAULT 'Government Holiday',
  is_mandatory BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'Announcement',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT chk_calendar_event_dates CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS public.meeting_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_type TEXT UNIQUE NOT NULL CHECK (meeting_type IN ('tactical', 'strategic')),
  title TEXT NOT NULL,
  frequency_days INTEGER NOT NULL,
  first_meeting_date DATE NOT NULL,
  meeting_time TEXT NOT NULL DEFAULT '10:00 AM',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_role_active ON public.profiles(role, is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_id ON public.profiles(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_leave_requests_user_id ON public.leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON public.leave_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_visibility ON public.leave_requests(show_on_calendar);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_user_id ON public.notifications(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_leave_request_id ON public.notifications(leave_request_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);

-- 3. Synchronize profiles with auth.users UUIDs & seed team records
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Sync any existing auth.users into profiles
  FOR r IN (
    SELECT au.id AS auth_id, au.email AS auth_email, au.raw_user_meta_data
    FROM auth.users au
  ) LOOP
    IF EXISTS (SELECT 1 FROM public.profiles WHERE email = r.auth_email AND id <> r.auth_id) THEN
      UPDATE public.leave_requests SET user_id = r.auth_id WHERE user_id IN (SELECT id FROM public.profiles WHERE email = r.auth_email);
      UPDATE public.leave_requests SET approved_by = r.auth_id WHERE approved_by IN (SELECT id FROM public.profiles WHERE email = r.auth_email);
      UPDATE public.notifications SET recipient_user_id = r.auth_id WHERE recipient_user_id IN (SELECT id FROM public.profiles WHERE email = r.auth_email);
      UPDATE public.calendar_events SET created_by = r.auth_id WHERE created_by IN (SELECT id FROM public.profiles WHERE email = r.auth_email);
      UPDATE public.holidays SET created_by = r.auth_id WHERE created_by IN (SELECT id FROM public.profiles WHERE email = r.auth_email);
      UPDATE public.meeting_schedules SET created_by = r.auth_id WHERE created_by IN (SELECT id FROM public.profiles WHERE email = r.auth_email);
      
      UPDATE public.profiles 
      SET id = r.auth_id, auth_user_id = r.auth_id, updated_at = timezone('utc'::text, now())
      WHERE email = r.auth_email;
    ELSIF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = r.auth_id OR email = r.auth_email) THEN
      INSERT INTO public.profiles (
        id, auth_user_id, full_name, email, role, department, designation, phone, is_active, created_at, updated_at
      ) VALUES (
        r.auth_id,
        r.auth_id,
        CASE 
          WHEN r.auth_email = 'dinesh@dwellvise.com' THEN 'Dinesh'
          WHEN r.auth_email = 'aswin@dwellvise.com' THEN 'Aswin'
          WHEN r.auth_email = 'pachamuthu@dwellvise.com' THEN 'Pachamuthu'
          WHEN r.auth_email = 'shalini@dwellvise.com' THEN 'Shalini'
          ELSE COALESCE(r.raw_user_meta_data->>'full_name', initcap(split_part(r.auth_email, '@', 1)))
        END,
        r.auth_email,
        CASE 
          WHEN r.auth_email IN ('dinesh@dwellvise.com', 'aswin@dwellvise.com') THEN 'admin'
          ELSE 'employee'
        END,
        CASE 
          WHEN r.auth_email = 'dinesh@dwellvise.com' THEN 'Management'
          ELSE 'Engineering'
        END,
        CASE 
          WHEN r.auth_email = 'dinesh@dwellvise.com' THEN 'Operations & Engineering Lead'
          WHEN r.auth_email = 'pachamuthu@dwellvise.com' THEN 'Senior Software Engineer'
          ELSE 'Software Engineer'
        END,
        CASE 
          WHEN r.auth_email = 'dinesh@dwellvise.com' THEN '+91 98400 11223'
          WHEN r.auth_email = 'aswin@dwellvise.com' THEN '+91 98400 33445'
          WHEN r.auth_email = 'pachamuthu@dwellvise.com' THEN '+91 98400 22334'
          WHEN r.auth_email = 'shalini@dwellvise.com' THEN '+91 98400 44556'
          ELSE ''
        END,
        true,
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
      );
    ELSE
      UPDATE public.profiles
      SET 
        auth_user_id = r.auth_id,
        role = CASE 
          WHEN r.auth_email IN ('dinesh@dwellvise.com', 'aswin@dwellvise.com') THEN 'admin'
          ELSE role
        END,
        is_active = true,
        updated_at = timezone('utc'::text, now())
      WHERE id = r.auth_id OR email = r.auth_email;
    END IF;
  END LOOP;
END $$;

-- 4. Seed Canonical Profiles if not already inserted
INSERT INTO public.profiles (id, full_name, email, role, department, designation, phone, is_active)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Pachamuthu', 'pachamuthu@dwellvise.com', 'employee', 'Engineering', 'Senior Software Engineer', '+91 98400 22334', true),
  ('00000000-0000-0000-0000-000000000002', 'Aswin', 'aswin@dwellvise.com', 'admin', 'Engineering', 'Software Engineer', '+91 98400 33445', true),
  ('00000000-0000-0000-0000-000000000003', 'Dinesh', 'dinesh@dwellvise.com', 'admin', 'Management', 'Operations & Engineering Lead', '+91 98400 11223', true),
  ('00000000-0000-0000-0000-000000000004', 'Shalini', 'shalini@dwellvise.com', 'employee', 'Engineering', 'Software Engineer', '+91 98400 44556', true)
ON CONFLICT (email) DO UPDATE SET 
  role = CASE 
    WHEN EXCLUDED.email IN ('dinesh@dwellvise.com', 'aswin@dwellvise.com') THEN 'admin'
    ELSE 'employee'
  END,
  full_name = EXCLUDED.full_name,
  department = EXCLUDED.department,
  designation = EXCLUDED.designation,
  phone = EXCLUDED.phone,
  is_active = true,
  updated_at = timezone('utc'::text, now());

-- Explicitly enforce the canonical two admin roles and employee roles
UPDATE public.profiles SET role = 'admin', is_active = true WHERE email IN ('dinesh@dwellvise.com', 'aswin@dwellvise.com');
UPDATE public.profiles SET role = 'employee', is_active = true WHERE email IN ('pachamuthu@dwellvise.com', 'shalini@dwellvise.com');

-- 5. Helper Function: is_admin()
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE (auth_user_id = auth.uid() OR id = auth.uid())
      AND role = 'admin'
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 6. Trigger on auth.users for Automatic Profile Creation & Role Assignment
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT := 'employee';
  v_full_name TEXT;
  v_dept TEXT := 'Engineering';
  v_desig TEXT := 'Software Engineer';
  v_phone TEXT := '';
BEGIN
  IF NEW.email IN ('dinesh@dwellvise.com', 'aswin@dwellvise.com') THEN
    v_role := 'admin';
  ELSIF (NEW.raw_user_meta_data->>'role') = 'admin' THEN
    v_role := 'admin';
  ELSE
    v_role := 'employee';
  END IF;

  IF NEW.email = 'shalini@dwellvise.com' THEN
    v_full_name := 'Shalini';
    v_desig := 'Software Engineer';
    v_phone := '+91 98400 44556';
  ELSIF NEW.email = 'aswin@dwellvise.com' THEN
    v_full_name := 'Aswin';
    v_desig := 'Software Engineer';
    v_phone := '+91 98400 33445';
  ELSIF NEW.email = 'dinesh@dwellvise.com' THEN
    v_full_name := 'Dinesh';
    v_dept := 'Management';
    v_desig := 'Operations & Engineering Lead';
    v_phone := '+91 98400 11223';
  ELSIF NEW.email = 'pachamuthu@dwellvise.com' THEN
    v_full_name := 'Pachamuthu';
    v_desig := 'Senior Software Engineer';
    v_phone := '+91 98400 22334';
  ELSE
    v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', initcap(split_part(NEW.email, '@', 1)));
  END IF;

  INSERT INTO public.profiles (
    id, auth_user_id, full_name, email, role, department, designation, phone, is_active, created_at, updated_at
  )
  VALUES (
    NEW.id,
    NEW.id,
    v_full_name,
    NEW.email,
    v_role,
    COALESCE(NEW.raw_user_meta_data->>'department', v_dept),
    COALESCE(NEW.raw_user_meta_data->>'designation', v_desig),
    COALESCE(NEW.raw_user_meta_data->>'phone', v_phone),
    true,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  )
  ON CONFLICT (id) DO UPDATE SET
    auth_user_id = EXCLUDED.id,
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = CASE 
      WHEN EXCLUDED.email IN ('dinesh@dwellvise.com', 'aswin@dwellvise.com') THEN 'admin' 
      ELSE EXCLUDED.role 
    END,
    is_active = true,
    updated_at = timezone('utc'::text, now());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 7. Atomic Leave Submission & Multi-Admin Notification RPC
CREATE OR REPLACE FUNCTION public.submit_leave_request(
  p_leave_type TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_user_name TEXT;
  v_leave_id UUID;
  v_admin RECORD;
  v_msg TEXT;
  v_start_fmt TEXT;
  v_end_fmt TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: User is not authenticated.');
  END IF;

  -- Ensure profile exists
  SELECT full_name INTO v_user_name FROM public.profiles WHERE id = v_user_id;
  IF v_user_name IS NULL THEN
    SELECT id, full_name INTO v_user_id, v_user_name FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1;
  END IF;

  IF v_user_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Employee profile not configured. Please contact administrator.');
  END IF;

  IF p_end_date < p_start_date THEN
    RETURN jsonb_build_object('success', false, 'message', 'End date cannot be earlier than start date.');
  END IF;

  -- Insert leave request
  INSERT INTO public.leave_requests (
    user_id,
    leave_type,
    start_date,
    end_date,
    reason,
    status,
    show_on_calendar
  ) VALUES (
    v_user_id,
    p_leave_type,
    p_start_date,
    p_end_date,
    p_reason,
    'pending',
    false
  ) RETURNING id INTO v_leave_id;

  v_start_fmt := to_char(p_start_date, 'DD Mon YYYY');
  v_end_fmt := to_char(p_end_date, 'DD Mon YYYY');
  v_msg := v_user_name || ' has applied for ' || p_leave_type || ' from ' || v_start_fmt || ' to ' || v_end_fmt || '.';

  -- Notify all active admins (Dinesh and Aswin)
  FOR v_admin IN (
    SELECT id FROM public.profiles WHERE role = 'admin' AND is_active = true AND id <> v_user_id
  ) LOOP
    -- Avoid duplicate notification for the same leave and recipient
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications 
      WHERE recipient_user_id = v_admin.id AND leave_request_id = v_leave_id AND type = 'leave_request'
    ) THEN
      INSERT INTO public.notifications (
        recipient_user_id,
        type,
        title,
        message,
        leave_request_id,
        is_read
      ) VALUES (
        v_admin.id,
        'leave_request',
        'New Leave Request',
        v_msg,
        v_leave_id,
        false
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Leave request submitted successfully.',
    'leave_id', v_leave_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Row Level Security Policies (Idempotent)

-- Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

CREATE POLICY "Public profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid() OR id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid() OR id = auth.uid());

CREATE POLICY "Admins can manage all profiles"
  ON public.profiles FOR ALL TO authenticated
  USING (public.is_admin());

-- Leave Requests
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Users can create their own leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Users can cancel their own pending leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Admins can update, approve/reject, and toggle show_on_calendar for all leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Admins can manage all leave requests" ON public.leave_requests;

CREATE POLICY "Users can view their own leave requests"
  ON public.leave_requests FOR SELECT TO authenticated
  USING (
    user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() OR id = auth.uid())
    OR public.is_admin()
  );

CREATE POLICY "Users can create their own leave requests"
  ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (
    user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() OR id = auth.uid())
    OR public.is_admin()
  );

CREATE POLICY "Users can cancel their own pending leave requests"
  ON public.leave_requests FOR UPDATE TO authenticated
  USING (
    user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() OR id = auth.uid())
    AND status = 'pending'
  );

CREATE POLICY "Admins can manage all leave requests"
  ON public.leave_requests FOR ALL TO authenticated
  USING (public.is_admin());

-- Notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;

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

-- Holidays
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Holidays are viewable by authenticated users" ON public.holidays;
DROP POLICY IF EXISTS "Admins can manage holidays" ON public.holidays;

CREATE POLICY "Holidays are viewable by authenticated users"
  ON public.holidays FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage holidays"
  ON public.holidays FOR ALL TO authenticated
  USING (public.is_admin());

-- Calendar Events
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Calendar events are viewable by authenticated users" ON public.calendar_events;
DROP POLICY IF EXISTS "Admins can manage calendar events" ON public.calendar_events;

CREATE POLICY "Calendar events are viewable by authenticated users"
  ON public.calendar_events FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage calendar events"
  ON public.calendar_events FOR ALL TO authenticated
  USING (public.is_admin());

-- Meeting Schedules
ALTER TABLE public.meeting_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Meeting schedules are viewable by authenticated users" ON public.meeting_schedules;
DROP POLICY IF EXISTS "Admins can manage meeting schedules" ON public.meeting_schedules;

CREATE POLICY "Meeting schedules are viewable by authenticated users"
  ON public.meeting_schedules FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage meeting schedules"
  ON public.meeting_schedules FOR ALL TO authenticated
  USING (public.is_admin());

-- 9. Privacy-Preserving Shared Calendar View
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
  -- Private leave reason is masked for other employees; visible ONLY to owner or active Admin
  CASE 
    WHEN auth.uid() IS NOT NULL AND (
      p.auth_user_id = auth.uid() OR 
      p.id = auth.uid() OR
      public.is_admin()
    ) THEN lr.reason
    ELSE NULL
  END AS reason
FROM public.leave_requests lr
JOIN public.profiles p ON lr.user_id = p.id
WHERE lr.status = 'approved' AND lr.show_on_calendar = true;
