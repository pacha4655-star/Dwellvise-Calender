-- ==============================================================================
-- OfficeFlow - Seed Data (Updated with Mentions & show_on_calendar)
-- ==============================================================================

-- 1. Insert Initial Profiles
INSERT INTO public.profiles (id, full_name, email, role, department, designation, phone)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Dinesh Kumar', 'dinesh@officeflow.local', 'admin', 'Management', 'Operations Manager', '+91 98400 11223'),
  ('00000000-0000-0000-0000-000000000002', 'Pachamuthu S', 'pachamuthu@officeflow.local', 'employee', 'Engineering', 'Senior Full Stack Developer', '+91 98400 22334'),
  ('00000000-0000-0000-0000-000000000003', 'Arun Vijay', 'arun@officeflow.local', 'employee', 'Design & Product', 'UI/UX Designer', '+91 98400 33445'),
  ('00000000-0000-0000-0000-000000000004', 'Reshma Banu', 'reshma@officeflow.local', 'employee', 'Quality Assurance', 'QA Automation Engineer', '+91 98400 44556')
ON CONFLICT (email) DO UPDATE SET 
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  department = EXCLUDED.department,
  designation = EXCLUDED.designation;

-- 2. Insert Government & Public Holidays (Tamil Nadu & National Holidays: Oct 2026 - Dec 2027)
INSERT INTO public.holidays (name, date, description, holiday_type, is_mandatory)
VALUES
  -- 2026 (Oct - Dec)
  ('Gandhi Jayanti', '2026-10-02', 'National Holiday honoring Mahatma Gandhi birthday', 'Government Holiday', true),
  ('Ayudha Pooja', '2026-10-19', 'Tamil Nadu Festival honoring tools, crafts, and work instruments', 'Government Holiday', true),
  ('Vijaya Dasami', '2026-10-20', 'Celebration of triumph of good over evil', 'Government Holiday', true),
  ('Deepavali', '2026-11-08', 'Festival of Lights', 'Government Holiday', true),
  ('Christmas Day', '2026-12-25', 'Celebration of the Nativity of Jesus Christ', 'Government Holiday', true),

  -- 2027
  ('New Year Day', '2027-01-01', 'First day of the Gregorian calendar year', 'Government Holiday', true),
  ('Pongal / Makar Sankranti', '2027-01-14', 'Tamil Harvest Festival celebrating Sun God', 'Government Holiday', true),
  ('Thiruvalluvar Day', '2027-01-15', 'Tribute to classical Tamil poet & philosopher Thiruvalluvar', 'Government Holiday', true),
  ('Uzhavar Thirunal', '2027-01-16', 'Farmers Day in Tamil Nadu celebrating agriculture', 'Government Holiday', true),
  ('Republic Day', '2027-01-26', 'National Holiday marking Constitution of India adoption', 'Government Holiday', true),
  ('Maha Shivaratri', '2027-03-06', 'Hindu festival dedicated to Lord Shiva', 'Government Holiday', false),
  ('Telugu New Year (Ugadi)', '2027-03-23', 'Traditional New Year festival in South India', 'Government Holiday', false),
  ('Good Friday', '2027-03-26', 'Christian holy day commemorating the Crucifixion', 'Government Holiday', true),
  ('Eid-ul-Fitr (Ramzan)', '2027-04-09', 'Islamic festival marking the end of Ramadan', 'Government Holiday', true),
  ('Tamil New Year / Dr. Ambedkar Jayanti', '2027-04-14', 'Puthandu & birth anniversary of Dr. B.R. Ambedkar', 'Government Holiday', true),
  ('May Day (Labour Day)', '2027-05-01', 'International Workers Day celebration', 'Government Holiday', true),
  ('Bakrid / Eid al-Adha', '2027-06-16', 'Feast of the Sacrifice', 'Government Holiday', true),
  ('Muharram', '2027-07-16', 'Islamic New Year observance', 'Government Holiday', true),
  ('Independence Day', '2027-08-15', 'National Holiday celebrating Indian Independence 1947', 'Government Holiday', true),
  ('Milad-un-Nabi (Prophet Birthday)', '2027-09-15', 'Celebration of Prophet Muhammad birthday', 'Government Holiday', true),
  ('Gandhi Jayanti', '2027-10-02', 'National Holiday commemorating Mahatma Gandhi', 'Government Holiday', true),
  ('Ayudha Pooja', '2027-10-09', 'Auspicious Tamil festival honoring tools of trade', 'Government Holiday', true),
  ('Vijaya Dasami', '2027-10-10', 'Dussehra festival conclusion', 'Government Holiday', true),
  ('Deepavali', '2027-10-29', 'Grand Festival of Lights celebration', 'Government Holiday', true),
  ('Christmas Day', '2027-12-25', 'Worldwide Christmas celebration', 'Government Holiday', true)
ON CONFLICT (date) DO UPDATE SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  holiday_type = EXCLUDED.holiday_type;

-- 3. Insert Manual Calendar Mentions (Admin Events)
INSERT INTO public.calendar_events (id, title, description, start_date, end_date, event_type, created_by)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'Quarterly All-Hands Meeting', 'Q3 Performance Review & Product Roadmap Presentation in Conference Room A', '2026-10-06', '2026-10-06', 'Office Meeting', '00000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', 'Annual Team Outing — Mahabalipuram', 'Full day team bonding, beach resort lunch, and team building activities', '2026-10-23', '2026-10-23', 'Team Outing', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- 4. Insert Leave Requests with show_on_calendar values
INSERT INTO public.leave_requests (id, user_id, leave_type, start_date, end_date, reason, status, show_on_calendar, approved_by, approved_at)
VALUES
  -- Arun: Approved and explicitly marked show_on_calendar = true
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'Personal Leave', '2026-10-12', '2026-10-12', 'Apartment documentation and lease formalities', 'approved', true, '00000000-0000-0000-0000-000000000001', '2026-10-01 11:00:00+00'),
  -- Reshma: Pending leave (show_on_calendar = false by default)
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004', 'Casual Leave', '2026-10-26', '2026-10-27', 'Attending Advanced Test Automation Summit in Bangalore', 'pending', false, NULL, NULL)
ON CONFLICT (id) DO NOTHING;
