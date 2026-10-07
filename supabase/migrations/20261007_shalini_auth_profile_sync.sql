-- ==============================================================================
-- OfficeFlow - Shalini & Auth User Profile Synchronization Migration
-- Migration: 20261007_shalini_auth_profile_sync.sql
-- ==============================================================================

-- 1. Ensure foreign key constraints support ON UPDATE CASCADE for smooth ID syncing
DO $$
BEGIN
  -- Leave Requests user_id foreign key
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'leave_requests_user_id_fkey' AND table_name = 'leave_requests'
  ) THEN
    ALTER TABLE public.leave_requests DROP CONSTRAINT leave_requests_user_id_fkey;
    ALTER TABLE public.leave_requests 
      ADD CONSTRAINT leave_requests_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) 
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- Notifications recipient_user_id foreign key
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'notifications_recipient_user_id_fkey' AND table_name = 'notifications'
  ) THEN
    ALTER TABLE public.notifications DROP CONSTRAINT notifications_recipient_user_id_fkey;
    ALTER TABLE public.notifications 
      ADD CONSTRAINT notifications_recipient_user_id_fkey 
      FOREIGN KEY (recipient_user_id) REFERENCES public.profiles(id) 
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- Leave Balances user_id foreign key
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'leave_balances_user_id_fkey' AND table_name = 'leave_balances'
  ) THEN
    ALTER TABLE public.leave_balances DROP CONSTRAINT leave_balances_user_id_fkey;
    ALTER TABLE public.leave_balances 
      ADD CONSTRAINT leave_balances_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) 
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 2. Synchronize Shalini, Pachamuthu, Aswin, and Dinesh profiles with auth.users if accounts exist
DO $$
DECLARE
  v_rec RECORD;
BEGIN
  FOR v_rec IN 
    SELECT u.id AS auth_id, u.email AS auth_email
    FROM auth.users u
    WHERE u.email IN (
      'pachamuthu@dwellvise.com',
      'aswin@dwellvise.com',
      'dinesh@dwellvise.com',
      'shalini@dwellvise.com'
    )
  LOOP
    -- Update existing profile to sync id and auth_user_id with auth.users.id
    UPDATE public.profiles
    SET 
      id = v_rec.auth_id,
      auth_user_id = v_rec.auth_id,
      is_active = true,
      updated_at = timezone('utc'::text, now())
    WHERE email = v_rec.auth_email;
  END LOOP;
END $$;

-- 3. Automatic Auth Trigger for New User Registrations
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT := 'employee';
  v_full_name TEXT;
  v_dept TEXT := 'Engineering';
  v_desig TEXT := 'Software Engineer';
BEGIN
  -- Determine role based on email or user metadata
  IF NEW.email IN ('dinesh@dwellvise.com', 'aswin@dwellvise.com') THEN
    v_role := 'admin';
  ELSIF (NEW.raw_user_meta_data->>'role') = 'admin' THEN
    v_role := 'admin';
  END IF;

  -- Determine full name
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
  ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    auth_user_id = EXCLUDED.auth_user_id,
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
