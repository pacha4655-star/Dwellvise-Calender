'use client';

import React from 'react';
import { Flag, Calendar, Sparkles, User, Clock, ChevronRight } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { getHolidays, getLeaves } from '@/lib/data/store';
import { formatDisplayDate, parseDateKey } from '@/lib/utils/date-utils';
import { CalendarEvent } from '@/types';

interface RightUpcomingPanelProps {
  onEventClick?: (event: CalendarEvent) => void;
  referenceDateKey?: string;
}

export const RightUpcomingPanel: React.FC<RightUpcomingPanelProps> = ({
  onEventClick,
  referenceDateKey = '2026-10-01',
}) => {
  const { user, isAdmin } = useAuth();
  const holidays = getHolidays();
  const leaves = getLeaves();

  // Upcoming Holidays (next 4 after reference date)
  const upcomingHolidays = holidays
    .filter((h) => h.date >= referenceDateKey)
    .slice(0, 4);

  // Upcoming Approved / Pending Leaves (next 4)
  const upcomingLeaves = leaves
    .filter((l) => (l.status === 'approved' || l.status === 'pending') && l.start_date >= referenceDateKey)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 5);

  return (
    <aside className="w-80 bg-slate-50/50 border-l border-slate-200/80 p-4 space-y-5 overflow-y-auto hidden xl:block h-[calc(100vh-61px)] sticky top-[61px]">
      {/* Upcoming Holidays Section */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-subtle">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
              <Flag className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Upcoming Holidays
            </h4>
          </div>
          <span className="text-[10px] font-semibold text-slate-400">Tamil Nadu / National</span>
        </div>

        <div className="space-y-2.5">
          {upcomingHolidays.length === 0 ? (
            <p className="text-xs text-slate-400 py-2 text-center">No upcoming holidays scheduled</p>
          ) : (
            upcomingHolidays.map((holiday) => {
              const dateObj = parseDateKey(holiday.date);
              const monthStr = dateObj.toLocaleString('default', { month: 'short' }).toUpperCase();
              const dayStr = dateObj.getDate();

              return (
                <div
                  key={holiday.id}
                  onClick={() =>
                    onEventClick?.({
                      id: `event-${holiday.id}`,
                      type: 'holiday',
                      title: holiday.name,
                      startDate: holiday.date,
                      endDate: holiday.date,
                      isHoliday: true,
                      description: holiday.description,
                      holidayType: holiday.holiday_type,
                      rawHoliday: holiday,
                    })
                  }
                  className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 hover:bg-rose-50/60 border border-slate-100 hover:border-rose-200/80 cursor-pointer transition-all group"
                >
                  {/* Date Badge */}
                  <div className="flex flex-col items-center justify-center w-10 h-11 rounded-lg bg-white border border-rose-100 text-rose-700 shadow-sm flex-shrink-0">
                    <span className="text-[9px] font-bold tracking-wider leading-none text-rose-500">{monthStr}</span>
                    <span className="text-sm font-extrabold leading-tight">{dayStr}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 group-hover:text-rose-900 truncate">
                      {holiday.name}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">{holiday.description}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Upcoming Team Leaves */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-subtle">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <Calendar className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Team Schedule
            </h4>
          </div>
          <span className="text-[10px] font-semibold text-slate-400">Next leaves</span>
        </div>

        <div className="space-y-2.5">
          {upcomingLeaves.length === 0 ? (
            <p className="text-xs text-slate-400 py-3 text-center">No scheduled leaves in this period</p>
          ) : (
            upcomingLeaves.map((leave) => {
              const isOwn = leave.user_id === user?.id;
              const dateObj = parseDateKey(leave.start_date);
              const monthStr = dateObj.toLocaleString('default', { month: 'short' }).toUpperCase();
              const dayStr = dateObj.getDate();

              return (
                <div
                  key={leave.id}
                  onClick={() =>
                    onEventClick?.({
                      id: `event-${leave.id}`,
                      type: 'leave',
                      title: `${leave.user?.full_name || 'Staff'} - ${leave.leave_type}`,
                      startDate: leave.start_date,
                      endDate: leave.end_date,
                      leaveType: leave.leave_type,
                      status: leave.status,
                      userId: leave.user_id,
                      userName: leave.user?.full_name || 'Staff Member',
                      userDepartment: leave.user?.department,
                      reason: isOwn || isAdmin ? leave.reason : undefined,
                      isOwnLeave: isOwn,
                      rawLeave: leave,
                    })
                  }
                  className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50/60 border border-slate-100 hover:border-blue-200 cursor-pointer transition-all group"
                >
                  <div
                    className={`flex flex-col items-center justify-center w-10 h-11 rounded-lg border shadow-sm flex-shrink-0 ${
                      isOwn
                        ? 'bg-purple-50 border-purple-200 text-purple-700'
                        : leave.status === 'pending'
                        ? 'bg-amber-50 border-amber-200 text-amber-700'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    }`}
                  >
                    <span className="text-[9px] font-bold tracking-wider leading-none">{monthStr}</span>
                    <span className="text-sm font-extrabold leading-tight">{dayStr}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-900 group-hover:text-blue-900 truncate">
                        {leave.user?.full_name} {isOwn && <span className="text-purple-600">(You)</span>}
                      </p>
                      {leave.status === 'pending' && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                          Pending
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">
                      {leave.leave_type} • {formatDisplayDate(leave.start_date)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
};
