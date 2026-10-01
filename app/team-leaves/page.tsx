'use client';

import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/lib/auth/auth-context';
import { getLeaves, getUsers, subscribeToStore } from '@/lib/data/store';
import { LeaveRequest, UserProfile } from '@/types';
import { formatDisplayDate, formatDateRange, calculateDaysCount } from '@/lib/utils/date-utils';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { EventDetailModal } from '@/components/calendar/EventDetailModal';
import { Users, Filter, Calendar, ShieldCheck, Lock, Eye } from 'lucide-react';

export default function TeamLeavesPage() {
  const { user, isAdmin } = useAuth();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-10');
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  const loadData = () => {
    setLeaves(getLeaves());
    setUsersList(getUsers());
  };

  useEffect(() => {
    loadData();
    const unsub = subscribeToStore(loadData);
    return unsub;
  }, []);

  // Filter leaves: ONLY approved leaves that are marked show_on_calendar = true
  const teamLeaves = leaves.filter((l) => {
    if (l.status !== 'approved' || !l.show_on_calendar) return false;
    if (selectedUser !== 'all' && l.user_id !== selectedUser) return false;
    if (selectedMonth !== 'all' && !l.start_date.startsWith(selectedMonth)) return false;
    return true;
  });

  const monthOptions = [
    { value: 'all', label: 'All Months (2026 - 2027)' },
    { value: '2026-10', label: 'October 2026' },
    { value: '2026-11', label: 'November 2026' },
    { value: '2026-12', label: 'December 2026' },
    { value: '2027-01', label: 'January 2027' },
    { value: '2027-02', label: 'February 2027' },
    { value: '2027-03', label: 'March 2027' },
    { value: '2027-04', label: 'April 2027' },
    { value: '2027-05', label: 'May 2027' },
    { value: '2027-06', label: 'June 2027' },
    { value: '2027-07', label: 'July 2027' },
    { value: '2027-08', label: 'August 2027' },
    { value: '2027-09', label: 'September 2027' },
    { value: '2027-10', label: 'October 2027' },
    { value: '2027-11', label: 'November 2027' },
    { value: '2027-12', label: 'December 2027' },
  ];

  return (
    <AppLayout showRightPanel={true}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Team Leave Schedule & Availability
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Shared company roster showing approved leaves published to the calendar by Management.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-subtle">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Employee:</span>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500"
              >
                <option value="all">All 4 Team Members</option>
                {usersList.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.department})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Month:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500"
              >
                {monthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Confidential reasons protected by Privacy Filter</span>
          </div>
        </div>

        {/* Leaves Cards / Grid */}
        <Card className="border border-slate-200 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="text-base font-bold text-slate-900">Approved Public Leaves</h3>
              <p className="text-xs text-slate-500">Visible on company schedule</p>
            </div>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200/60">
              {teamLeaves.length} {teamLeaves.length === 1 ? 'Record' : 'Records'}
            </span>
          </div>

          <div className="p-4 sm:p-6">
            {teamLeaves.length === 0 ? (
              <EmptyState
                title="No calendar leaves found"
                description="There are no approved leaves marked for shared calendar visibility matching your filter."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teamLeaves.map((leave) => {
                  const isOwn = leave.user_id === user?.id;
                  const days = calculateDaysCount(leave.start_date, leave.end_date);

                  return (
                    <div
                      key={leave.id}
                      onClick={() =>
                        setSelectedEvent({
                          id: `event-${leave.id}`,
                          type: 'leave',
                          title: `${leave.user?.full_name} - ${leave.leave_type}`,
                          startDate: leave.start_date,
                          endDate: leave.end_date,
                          leaveType: leave.leave_type,
                          status: leave.status,
                          showOnCalendar: leave.show_on_calendar,
                          userId: leave.user_id,
                          userName: leave.user?.full_name,
                          userDepartment: leave.user?.department,
                          reason: isOwn || isAdmin ? leave.reason : undefined,
                          isOwnLeave: isOwn,
                          rawLeave: leave,
                        })
                      }
                      className="p-4 rounded-xl border border-slate-200/90 bg-white hover:border-blue-300 hover:shadow-card transition-all cursor-pointer flex flex-col justify-between space-y-3 group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${
                              isOwn
                                ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/20'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {leave.user?.full_name ? leave.user.full_name[0] : 'U'}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                                {leave.user?.full_name}
                              </h4>
                              {isOwn && (
                                <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                                  You
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500">{leave.user?.department}</p>
                          </div>
                        </div>

                        <Badge variant="approved" size="sm">
                          Visible on Calendar
                        </Badge>
                      </div>

                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                        <div>
                          <span className="text-[10px] font-semibold uppercase text-slate-400 block">
                            Leave Type
                          </span>
                          <span className="font-semibold text-slate-800">{leave.leave_type}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-semibold uppercase text-slate-400 block">
                            Dates
                          </span>
                          <span className="font-semibold text-slate-800">
                            {formatDateRange(leave.start_date, leave.end_date)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>

      <EventDetailModal
        isOpen={Boolean(selectedEvent)}
        onClose={() => setSelectedEvent(null)}
        event={selectedEvent}
      />
    </AppLayout>
  );
}
