-- ==============================================================================
-- OfficeFlow - In-App Notifications Schema & RLS Policies
-- Migration: 20261003_notifications.sql
-- ==============================================================================

-- 1. Create Notifications Table (if not exists)
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

-- Backward compatibility: add columns if table previously had recipient_id or reference_id
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'recipient_user_id'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN recipient_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'leave_request_id'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN leave_request_id UUID REFERENCES public.leave_requests(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2. Indexes for High Performance Queries
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_user_id ON public.notifications(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_leave_request_id ON public.notifications(leave_request_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to prevent conflicts on migration
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can manage all notifications" ON public.notifications;

-- Strict RLS Policies:
-- Users can SELECT only their own notifications
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (
    recipient_user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() OR id = auth.uid())
  );

-- Users can UPDATE only their own notifications (e.g. mark as read)
CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (
    recipient_user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() OR id = auth.uid())
  )
  WITH CHECK (
    recipient_user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() OR id = auth.uid())
  );

-- Authenticated users can INSERT notifications (e.g., when submitting leave requests or approving/rejecting)
CREATE POLICY "Authenticated users can create notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Admins can manage all notifications if required
CREATE POLICY "Admins can manage all notifications"
  ON public.notifications FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE (auth_user_id = auth.uid() OR id = auth.uid()) AND role = 'admin'
    )
  );
