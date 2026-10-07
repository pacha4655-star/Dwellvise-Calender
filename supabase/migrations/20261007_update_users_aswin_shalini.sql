-- ==============================================================================
-- OfficeFlow - User Roles & Profile Migration: Aswin (Admin) & Shalini (Employee)
-- Migration: 20261007_update_users_aswin_shalini.sql
-- ==============================================================================

-- 1. Safely update Aswin's role to admin
UPDATE public.profiles
SET 
  role = 'admin',
  updated_at = timezone('utc'::text, now())
WHERE email = 'aswin@dwellvise.com';

-- 2. Safely insert or update Shalini's profile (linking to auth.users if exists)
DO $$
DECLARE
  v_auth_user_id UUID;
  v_existing_profile_id UUID;
BEGIN
  -- Check if profile already exists for Shalini
  SELECT id INTO v_existing_profile_id 
  FROM public.profiles 
  WHERE email = 'shalini@dwellvise.com' 
  LIMIT 1;
  
  -- Check if Supabase auth.users record exists for Shalini
  BEGIN
    SELECT id INTO v_auth_user_id 
    FROM auth.users 
    WHERE email = 'shalini@dwellvise.com' 
    LIMIT 1;
  EXCEPTION
    WHEN undefined_table THEN
      v_auth_user_id := NULL;
  END;

  IF v_existing_profile_id IS NULL THEN
    -- Insert new profile
    IF v_auth_user_id IS NOT NULL THEN
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
        v_auth_user_id,
        v_auth_user_id,
        'Shalini',
        'shalini@dwellvise.com',
        'employee',
        'Engineering',
        'Software Engineer',
        '+91 98400 44556',
        true,
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
      );
    ELSE
      INSERT INTO public.profiles (
        id,
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
        '00000000-0000-0000-0000-000000000004',
        'Shalini',
        'shalini@dwellvise.com',
        'employee',
        'Engineering',
        'Software Engineer',
        '+91 98400 44556',
        true,
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
      );
    END IF;
  ELSE
    -- Profile exists, ensure active and role is employee and auth_user_id is synced
    UPDATE public.profiles
    SET 
      full_name = 'Shalini',
      role = 'employee',
      is_active = true,
      auth_user_id = COALESCE(v_auth_user_id, auth_user_id),
      updated_at = timezone('utc'::text, now())
    WHERE id = v_existing_profile_id;
  END IF;
END $$;

-- 3. Ensure Notification Index and Deduplication Performance
CREATE INDEX IF NOT EXISTS idx_notifications_composite_dup_check 
  ON public.notifications (recipient_user_id, leave_request_id, type);
