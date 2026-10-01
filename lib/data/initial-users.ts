import { UserProfile } from '@/types';

export const INITIAL_USERS: UserProfile[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    full_name: 'Pachamuthu',
    email: 'pachamuthu@dwellvise.com',
    role: 'employee',
    department: 'Engineering',
    designation: 'Senior Software Engineer',
    phone: '+91 98400 22334',
    is_active: true,
    created_at: '2026-09-01T09:00:00Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    full_name: 'Aswin',
    email: 'aswin@dwellvise.com',
    role: 'employee',
    department: 'Engineering',
    designation: 'Software Engineer',
    phone: '+91 98400 33445',
    is_active: true,
    created_at: '2026-09-01T09:00:00Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    full_name: 'Dinesh',
    email: 'dinesh@dwellvise.com',
    role: 'admin',
    department: 'Management',
    designation: 'Operations & Engineering Lead',
    phone: '+91 98400 11223',
    is_active: true,
    created_at: '2026-09-01T09:00:00Z',
  },
];
