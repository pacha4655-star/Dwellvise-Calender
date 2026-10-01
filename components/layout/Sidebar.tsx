'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarDays,
  PlusCircle,
  Clock,
  Users,
  Flag,
  User,
  ShieldCheck,
  ClipboardList,
  UserCheck,
  BarChart3,
  CalendarCheck2,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { getLeaves } from '@/lib/data/store';

interface SidebarProps {
  onApplyLeaveClick?: () => void;
  onCloseMobile?: () => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | undefined;
}

export const Sidebar: React.FC<SidebarProps> = ({ onApplyLeaveClick, onCloseMobile }) => {
  const pathname = usePathname();
  const { user, isAdmin } = useAuth();

  const allLeaves = getLeaves();
  const pendingCount = allLeaves.filter((l) => l.status === 'pending').length;

  const employeeLinks: NavItem[] = [
    { label: 'Calendar', href: '/calendar', icon: CalendarDays },
    { label: 'My Leaves', href: '/my-leaves', icon: Clock },
    { label: 'Team Leaves', href: '/team-leaves', icon: Users },
    { label: 'Govt Holidays', href: '/holidays', icon: Flag },
    { label: 'My Profile', href: '/profile', icon: User },
  ];

  const adminLinks: NavItem[] = [
    { label: 'Calendar View', href: '/calendar', icon: CalendarDays },
    { label: 'Admin Dashboard', href: '/admin', icon: ShieldCheck },
    {
      label: 'Leave Requests',
      href: '/admin/leave-requests',
      icon: ClipboardList,
      badge: pendingCount > 0 ? pendingCount : undefined,
    },
    { label: 'Employees', href: '/admin/employees', icon: UserCheck },
    { label: 'Manage Holidays', href: '/admin/holidays', icon: Flag },
    { label: 'Reports & Analytics', href: '/admin/reports', icon: BarChart3 },
  ];

  const links = isAdmin ? adminLinks : employeeLinks;

  return (
    <aside className="w-64 bg-white border-r border-slate-200/80 flex flex-col flex-shrink-0 h-[calc(100vh-61px)] sticky top-[61px] select-none">
      {/* Quick Action: Apply Leave button */}
      <div className="p-4 border-b border-slate-100">
        <button
          onClick={() => {
            onApplyLeaveClick?.();
            onCloseMobile?.();
          }}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 text-white font-semibold text-sm shadow-sm shadow-blue-500/20 hover:bg-blue-700 active:scale-[0.98] transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Apply For Leave</span>
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {isAdmin ? 'Admin Portal' : 'Workspace'}
        </div>

        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;

          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onCloseMobile}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 group ${
                isActive
                  ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-200/60'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 transition-colors ${
                    isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
                  }`}
                />
                <span>{link.label}</span>
              </div>

              {link.badge ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white animate-pulse">
                  {link.badge}
                </span>
              ) : isActive ? (
                <ChevronRight className="w-3.5 h-3.5 text-blue-500" />
              ) : null}
            </Link>
          );
        })}

        {/* Extra link for Admin to toggle user views */}
        {isAdmin && (
          <div className="pt-4 border-t border-slate-100 mt-4">
            <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Staff Navigation
            </div>
            <Link
              href="/team-leaves"
              onClick={onCloseMobile}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                pathname === '/team-leaves'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Users className="w-4 h-4 text-slate-400" />
              <span>Team Roster View</span>
            </Link>
            <Link
              href="/holidays"
              onClick={onCloseMobile}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                pathname === '/holidays'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Flag className="w-4 h-4 text-slate-400" />
              <span>Holiday Calendar (Staff)</span>
            </Link>
          </div>
        )}
      </nav>

      {/* Footer Info / Logged in employee */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white border border-slate-200/70 shadow-subtle">
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
            {user?.full_name ? user.full_name[0] : 'U'}
          </div>
          <div className="truncate flex-1">
            <p className="text-xs font-semibold text-slate-900 truncate">{user?.full_name}</p>
            <p className="text-[10px] text-slate-500 truncate">{user?.department}</p>
          </div>
        </div>
      </div>
    </aside>
  );
};
