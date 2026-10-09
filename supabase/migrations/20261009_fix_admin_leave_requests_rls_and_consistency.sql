-- ==============================================================================
-- OfficeFlow - Production Fix: Admin Leave Requests Cross-Device Consistency & RLS
-- Migration: 20261009_fix_admin_leave_requests_rls_and_consistency.sql
-- ==============================================================================

-- 1. Ensure public.profiles columns and indices
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auth_user_id UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_profiles_role_active ON public.profiles(role, is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_id ON public.profiles(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 2. Update profiles for admins and employees unconditionally
UPDATE public.profiles 
SET role = 'admin', is_active = true 
WHERE email IN ('dinesh@dwellvise.com', 'aswin@dwellvise.com');

UPDATE public.profiles 
SET role = 'employee', is_active = true 
WHERE email IN ('pachamuthu@dwellvise.com', 'shalini@dwellvise.com');

-- 3. Auto-sync auth.users UUIDs to profiles
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT id AS auth_id, email AS auth_email
    FROM auth.users
  ) LOOP
    UPDATE public.profiles
    SET 
      auth_user_id = r.auth_id,
      role = CASE 
        WHEN r.auth_email IN ('dinesh@dwellvise.com', 'aswin@dwellvise.com') THEN 'admin'
        ELSE role
      END,
      is_active = true,
      updated_at = timezone('utc'::text, now())
    WHERE email = r.auth_email OR id = r.auth_id;
  END LOOP;
END $$;

-- 4. Robust is_admin() function with email and JWT fallback
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE (
      p.auth_user_id = auth.uid() 
      OR p.id = auth.uid()
      OR p.email = auth.jwt()->>'email'
      OR p.email = (SELECT au.email FROM auth.users au WHERE au.id = auth.uid())
      OR (auth.jwt()->>'email' IN ('dinesh@dwellvise.com', 'aswin@dwellvise.com'))
    )
    AND (p.role = 'admin' OR auth.jwt()->>'email' IN ('dinesh@dwellvise.com', 'aswin@dwellvise.com'))
    AND p.is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 5. Row Level Security Policies for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

CREATE POLICY "Public profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (
    auth_user_id = auth.uid() 
    OR id = auth.uid() 
    OR email = auth.jwt()->>'email'
    OR email = (SELECT au.email FROM auth.users au WHERE au.id = auth.uid())
  )
  WITH CHECK (
    auth_user_id = auth.uid() 
    OR id = auth.uid() 
    OR email = auth.jwt()->>'email'
    OR email = (SELECT au.email FROM auth.users au WHERE au.id = auth.uid())
  );

CREATE POLICY "Admins can manage all profiles"
  ON public.profiles FOR ALL TO authenticated
  USING (public.is_admin());

-- 6. Row Level Security Policies for leave_requests
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Users can create their own leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Users can cancel their own pending leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Admins can update, approve/reject, and toggle show_on_calendar for all leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Admins can manage all leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Allow authenticated users to view leave requests" ON public.leave_requests;

CREATE POLICY "Users can view their own leave requests"
  ON public.leave_requests FOR SELECT TO authenticated
  USING (
    user_id IN (
      SELECT id FROM public.profiles 
      WHERE auth_user_id = auth.uid() 
         OR id = auth.uid() 
         OR email = auth.jwt()->>'email'
         OR email = (SELECT au.email FROM auth.users au WHERE au.id = auth.uid())
    )
    OR public.is_admin()
    OR show_on_calendar = true
  );

CREATE POLICY "Users can create their own leave requests"
  ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (
    user_id IN (
      SELECT id FROM public.profiles 
      WHERE auth_user_id = auth.uid() 
         OR id = auth.uid() 
         OR email = auth.jwt()->>'email'
         OR email = (SELECT au.email FROM auth.users au WHERE au.id = auth.uid())
    )
    OR public.is_admin()
  );

CREATE POLICY "Admins can manage all leave requests"
  ON public.leave_requests FOR ALL TO authenticated
  USING (public.is_admin());

-- 7. Row Level Security Policies for notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;

CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (
    recipient_user_id IN (
      SELECT id FROM public.profiles 
      WHERE auth_user_id = auth.uid() 
         OR id = auth.uid() 
         OR email = auth.jwt()->>'email'
         OR email = (SELECT au.email FROM auth.users au WHERE au.id = auth.uid())
    )
    OR public.is_admin()
  );

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (
    recipient_user_id IN (
      SELECT id FROM public.profiles 
      WHERE auth_user_id = auth.uid() 
         OR id = auth.uid() 
         OR email = auth.jwt()->>'email'
         OR email = (SELECT au.email FROM auth.users au WHERE au.id = auth.uid())
    )
  );

CREATE POLICY "Authenticated users can create notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);
