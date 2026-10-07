-- ==============================================================================
-- OfficeFlow - Production Repair: Canonical auth.users.id = public.profiles.id
-- Migration: 20261007_repair_profiles_and_leave_flow.sql
-- ==============================================================================

-- 1. Ensure public.profiles table has auth_user_id and proper constraints
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auth_user_id UUID;
CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_id ON public.profiles(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role_active ON public.profiles(role, is_active);

-- 2. Synchronize existing profiles to use auth.users.id as primary key & auth_user_id
DO $$
DECLARE
  r RECORD;
BEGIN
  -- For every user in auth.users, sync their ID into public.profiles
  FOR r IN (
    SELECT au.id AS auth_id, au.email AS auth_email, au.raw_user_meta_data
    FROM auth.users au
  ) LOOP
    -- Check if a profile exists by email with a different ID
    IF EXISTS (SELECT 1 FROM public.profiles WHERE email = r.auth_email AND id <> r.auth_id) THEN
      -- Temporarily disable FK checks or cascade update related tables
      UPDATE public.leave_requests SET user_id = r.auth_id WHERE user_id IN (SELECT id FROM public.profiles WHERE email = r.auth_email);
      UPDATE public.leave_requests SET approved_by = r.auth_id WHERE approved_by IN (SELECT id FROM public.profiles WHERE email = r.auth_email);
      UPDATE public.leave_balances SET user_id = r.auth_id WHERE user_id IN (SELECT id FROM public.profiles WHERE email = r.auth_email);
      UPDATE public.notifications SET recipient_user_id = r.auth_id WHERE recipient_user_id IN (SELECT id FROM public.profiles WHERE email = r.auth_email);
      UPDATE public.calendar_events SET created_by = r.auth_id WHERE created_by IN (SELECT id FROM public.profiles WHERE email = r.auth_email);
      UPDATE public.holidays SET created_by = r.auth_id WHERE created_by IN (SELECT id FROM public.profiles WHERE email = r.auth_email);
      UPDATE public.meeting_schedules SET created_by = r.auth_id WHERE created_by IN (SELECT id FROM public.profiles WHERE email = r.auth_email);
      
      -- Update profile primary key to match auth.users.id
      UPDATE public.profiles 
      SET id = r.auth_id, auth_user_id = r.auth_id, updated_at = NOW() 
      WHERE email = r.auth_email;
    ELSIF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = r.auth_id OR email = r.auth_email) THEN
      -- Profile missing, create it
      INSERT INTO public.profiles (
        id,
        auth_user_id,
        full_name,
        email,
        role,
        department,
        designation,
        phone,
        is_active,
        created_at,
        updated_at
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
        NOW(),
        NOW()
      );
    ELSE
      -- Profile exists with matching id, ensure auth_user_id and role are correct
      UPDATE public.profiles
      SET 
        auth_user_id = r.auth_id,
        role = CASE 
          WHEN r.auth_email IN ('dinesh@dwellvise.com', 'aswin@dwellvise.com') THEN 'admin'
          ELSE role
        END,
        is_active = true,
        updated_at = NOW()
      WHERE id = r.auth_id OR email = r.auth_email;
    END IF;
  END LOOP;
END $$;

-- 3. Explicitly enforce roles for standard team members
UPDATE public.profiles SET role = 'admin', is_active = true WHERE email IN ('dinesh@dwellvise.com', 'aswin@dwellvise.com');
UPDATE public.profiles SET role = 'employee', is_active = true WHERE email IN ('pachamuthu@dwellvise.com', 'shalini@dwellvise.com');

-- 4. Automatic trigger on auth.users for new accounts
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT := 'employee';
  v_full_name TEXT;
  v_dept TEXT := 'Engineering';
  v_desig TEXT := 'Software Engineer';
BEGIN
  -- Strict role assignment: Dinesh & Aswin are admin; all other registrations default to employee
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
  ELSIF NEW.email = 'aswin@dwellvise.com' THEN
    v_full_name := 'Aswin';
    v_desig := 'Software Engineer';
  ELSIF NEW.email = 'dinesh@dwellvise.com' THEN
    v_full_name := 'Dinesh';
    v_dept := 'Management';
    v_desig := 'Operations & Engineering Lead';
  ELSIF NEW.email = 'pachamuthu@dwellvise.com' THEN
    v_full_name := 'Pachamuthu';
    v_desig := 'Senior Software Engineer';
  ELSE
    v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', initcap(split_part(NEW.email, '@', 1)));
  END IF;

  INSERT INTO public.profiles (
    id,
    auth_user_id,
    full_name,
    email,
    role,
    department,
    designation,
    phone,
    is_active,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.id,
    v_full_name,
    NEW.email,
    v_role,
    COALESCE(NEW.raw_user_meta_data->>'department', v_dept),
    COALESCE(NEW.raw_user_meta_data->>'designation', v_desig),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    true,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  )
  ON CONFLICT (id) DO UPDATE SET
    auth_user_id = EXCLUDED.id,
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = CASE 
      WHEN public.profiles.role = 'admin' OR EXCLUDED.email IN ('dinesh@dwellvise.com', 'aswin@dwellvise.com') THEN 'admin' 
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

-- 5. Atomic Leave Submission & Admin Notification RPC
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
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: User is not authenticated.');
  END IF;

  -- Ensure profile exists
  SELECT full_name INTO v_user_name FROM public.profiles WHERE id = v_user_id;
  IF v_user_name IS NULL THEN
    -- Fallback lookup by auth_user_id
    SELECT id, full_name INTO v_user_id, v_user_name FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1;
  END IF;

  IF v_user_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Employee profile not configured. Please contact administrator.');
  END IF;

  -- Validate dates
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

  -- Construct message without leaking private reason
  v_msg := v_user_name || ' has applied for ' || p_leave_type || ' from ' || to_char(p_start_date, 'DD Mon YYYY') || ' to ' || to_char(p_end_date, 'DD Mon YYYY') || '.';

  -- Notify all active admins
  FOR v_admin IN (
    SELECT id FROM public.profiles WHERE role = 'admin' AND is_active = true AND id <> v_user_id
  ) LOOP
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
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Leave request submitted successfully.',
    'leave_id', v_leave_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
