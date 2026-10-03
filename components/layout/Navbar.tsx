'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  Search,
  Bell,
  User,
  LogOut,
  ChevronDown,
  ShieldCheck,
  CheckCircle2,
  CalendarCheck,
  Menu,
  X,
  Sparkles,
  CheckCheck,
  Clock,
  XCircle,
  FileText,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  subscribeToStore,
} from '@/lib/data/store';
import { AppNotification } from '@/types';
import { formatRelativeTime } from '@/lib/utils/date-utils';

interface NavbarProps {
  onMobileMenuToggle?: () => void;
  isMobileMenuOpen?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onMobileMenuToggle,
  isMobileMenuOpen = false,
  searchQuery = '',
  onSearchChange,
}) => {
  const { user, usersList, isAdmin, logout, switchUser } = useAuth();
  const router = useRouter();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isSwitchOpen, setIsSwitchOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const switchRef = useRef<HTMLDivElement>(null);

  const reloadNotifications = useCallback(() => {
    if (user) {
      setNotifications(getNotifications(user.id));
    } else {
      setNotifications([]);
    }
  }, [user]);

  useEffect(() => {
    reloadNotifications();
    const unsubscribe = subscribeToStore(reloadNotifications);
    return unsubscribe;
  }, [reloadNotifications]);

  const unreadCount = notifications.filter((n) => !n.is_read && !n.isRead).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
      if (switchRef.current && !switchRef.current.contains(event.target as Node)) {
        setIsSwitchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const handleNotificationClick = async (notif: AppNotification) => {
    if (!notif.is_read && !notif.isRead) {
      await markNotificationAsRead(notif.id);
      reloadNotifications();
    }
    setIsNotifOpen(false);

    const targetLeaveId = notif.leave_request_id || notif.reference_id;

    if (notif.type === 'leave_request') {
      if (isAdmin) {
        router.push(`/admin/leave-requests${targetLeaveId ? `?id=${targetLeaveId}` : ''}`);
      } else {
        router.push('/my-leaves');
      }
    } else if (notif.type === 'leave_approved' || notif.type === 'leave_rejected') {
      router.push('/my-leaves');
    } else if (notif.link) {
      router.push(notif.link);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (user) {
      await markAllNotificationsAsRead(user.id);
      reloadNotifications();
    }
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'leave_request':
        return <Clock className="w-4 h-4 text-blue-600" />;
      case 'leave_approved':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'leave_rejected':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Bell className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-2.5 sm:px-6 lg:px-8 py-2.5 sm:py-3 transition-all">
      <div className="flex items-center justify-between gap-2 sm:gap-4 min-w-0">
        {/* Left: Mobile Toggle + Logo */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={onMobileMenuToggle}
            className="lg:hidden p-1.5 sm:p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
            aria-label="Toggle Navigation"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <Link href="/calendar" className="flex items-center gap-2 group min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20 group-hover:bg-blue-700 transition-colors flex-shrink-0">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1 sm:gap-1.5">
                <span className="font-bold text-slate-900 tracking-tight text-sm sm:text-base">OfficeFlow</span>
                <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/60 flex-shrink-0">
                  {isAdmin ? 'Admin' : 'Staff'}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium hidden sm:block truncate">
                Leave & Holiday Calendar
              </p>
            </div>
          </Link>
        </div>

        {/* Center: Search Bar */}
        <div className="flex-1 max-w-md hidden md:block">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search employees, leaves, holidays..."
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl pl-9 pr-4 py-2 outline-none hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-slate-800 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Right: Quick Switcher + Notifications + Profile */}
        <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
          {/* Quick User Switcher for Interactive Evaluation */}
          <div className="relative" ref={switchRef}>
            <button
              onClick={() => setIsSwitchOpen(!isSwitchOpen)}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50/60 text-blue-900 hover:bg-blue-100/70 transition-colors text-xs font-semibold"
              title="Quick switch between team members for evaluation"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Switch User</span>
              <ChevronDown className="w-3 h-3 text-blue-600" />
            </button>

            {isSwitchOpen && (
              <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-1.5rem)] rounded-2xl bg-white border border-slate-200 shadow-elevation p-2 z-50 text-left">
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-800">Quick Test Switcher</p>
                  <p className="text-[11px] text-slate-500">Switch between team members instantly</p>
                </div>
                <div className="py-1 space-y-0.5">
                  {usersList.map((u) => {
                    const isCurrent = user?.id === u.id;
                    return (
                      <button
                        key={u.id}
                        onClick={() => {
                          switchUser(u.id);
                          setIsSwitchOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors ${
                          isCurrent
                            ? 'bg-blue-50 text-blue-900 font-semibold border border-blue-200/60'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                            {u.full_name[0]}
                          </div>
                          <div className="text-left truncate">
                            <p className="font-medium text-slate-900 truncate">{u.full_name}</p>
                            <p className="text-[10px] text-slate-400 capitalize">{u.role} • {u.department}</p>
                          </div>
                        </div>
                        {isCurrent && <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Notifications Bell & Dropdown */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className="relative p-2 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors flex items-center justify-center"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white shadow-sm animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {isNotifOpen && (
              <div className="absolute right-[-40px] sm:right-0 mt-2 w-[calc(100vw-1.5rem)] sm:w-80 md:w-96 max-w-sm rounded-2xl bg-white border border-slate-200 shadow-elevation p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-100 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Notifications
                    </span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 transition-colors"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Mark all as read</span>
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto space-y-2 pr-0.5">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center">
                      <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-slate-600">No notifications yet</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">You&apos;re all caught up!</p>
                    </div>
                  ) : (
                    notifications.map((n) => {
                      const isUnread = !n.is_read && !n.isRead;
                      return (
                        <div
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                            isUnread
                              ? 'bg-blue-50/70 border-blue-200 text-slate-900 shadow-xs'
                              : 'bg-white hover:bg-slate-50 border-slate-100 text-slate-700'
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <div className={`p-1.5 rounded-lg flex-shrink-0 ${
                              n.type === 'leave_approved'
                                ? 'bg-emerald-100 text-emerald-700'
                                : n.type === 'leave_rejected'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {getNotifIcon(n.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1 mb-0.5">
                                <span className={`truncate text-xs ${isUnread ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'}`}>
                                  {n.title}
                                </span>
                                <span className="text-[10px] text-slate-400 flex-shrink-0">
                                  {formatRelativeTime(n.created_at || n.createdAt)}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2">
                                {n.message}
                              </p>
                            </div>
                            {isUnread && (
                              <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0 mt-1.5" />
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-1.5 sm:gap-2 p-1 sm:p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-semibold text-xs shadow-sm flex-shrink-0">
                {user?.full_name ? user.full_name[0] : 'U'}
              </div>
              <div className="text-left hidden md:block">
                <p className="text-xs font-semibold text-slate-900 leading-tight">
                  {user?.full_name || 'Guest User'}
                </p>
                <p className="text-[11px] text-slate-500 capitalize">{user?.role || 'Employee'}</p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden md:block" />
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-1.5rem)] rounded-2xl bg-white border border-slate-200 shadow-elevation p-2 z-50">
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-900">{user?.full_name}</p>
                  <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                </div>
                <div className="py-1 space-y-0.5">
                  <Link
                    href="/profile"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-xl transition-colors"
                  >
                    <User className="w-4 h-4 text-slate-400" />
                    <span>My Profile & Balances</span>
                  </Link>
                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50 rounded-xl transition-colors"
                    >
                      <ShieldCheck className="w-4 h-4 text-blue-600" />
                      <span>Admin Control Center</span>
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors text-left"
                  >
                    <LogOut className="w-4 h-4 text-red-500" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
