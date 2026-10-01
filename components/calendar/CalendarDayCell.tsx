'use client';

import React from 'react';
import { CalendarEvent } from '@/types';
import { Flag, Clock, CheckCircle2, User, Plus, Sparkles, Building, Megaphone } from 'lucide-react';

interface CalendarDayCellProps {
  dateKey: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSunday: boolean;
  isWeekend: boolean;
  isWithinBounds: boolean;
  events: CalendarEvent[];
  onDateClick: (dateKey: string) => void;
  onEventClick: (event: CalendarEvent) => void;
  isAdmin?: boolean;
}

export const CalendarDayCell: React.FC<CalendarDayCellProps> = ({
  dateKey,
  dayNumber,
  isCurrentMonth,
  isToday,
  isSunday,
  isWeekend,
  isWithinBounds,
  events,
  onDateClick,
  onEventClick,
  isAdmin,
}) => {
  const holidays = events.filter((e) => e.type === 'holiday');
  const mentions = events.filter((e) => e.type === 'mention');
  const leaves = events.filter((e) => e.type === 'leave');

  const hasHoliday = holidays.length > 0;
  // Sunday or Government Holiday uses the EXACT same single Soft Red color theme!
  const isSoftRedDay = isSunday || hasHoliday;

  return (
    <div
      onClick={() => {
        if (isWithinBounds) {
          onDateClick(dateKey);
        }
      }}
      className={`min-h-[58px] xs:min-h-[75px] sm:min-h-[105px] md:min-h-[125px] p-1 xs:p-1.5 sm:p-2 border-b border-r border-slate-100/90 flex flex-col justify-between transition-all group select-none relative ${
        !isCurrentMonth
          ? 'bg-slate-50/40 text-slate-400'
          : isSoftRedDay
          ? 'bg-rose-50/40 hover:bg-rose-50/70 text-rose-900' // Single unified Soft Red treatment for Sunday & Govt Holiday
          : isWeekend
          ? 'bg-slate-50/30 text-slate-700'
          : 'bg-white text-slate-800 hover:bg-blue-50/20'
      } ${!isWithinBounds ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {/* Top Bar: Date Number + Quick Action */}
      <div className="flex items-center justify-between mb-0.5 sm:mb-1">
        <span
          className={`text-[10px] sm:text-xs font-semibold w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center transition-all ${
            isToday
              ? 'bg-blue-600 text-white font-bold shadow-sm'
              : isSoftRedDay && isCurrentMonth
              ? 'text-rose-700 font-bold bg-rose-100/70' // Single unified Soft Red date number for Sunday & Holiday
              : !isCurrentMonth
              ? 'text-slate-400'
              : 'text-slate-800 group-hover:text-blue-600'
          }`}
        >
          {dayNumber}
        </span>

        {isWithinBounds && (
          <span
            className="hidden sm:inline-block opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-blue-600 hover:bg-blue-100/60"
            title={isAdmin ? 'Click to Apply Leave or Add Event Mention' : 'Click to Apply for Leave'}
          >
            <Plus className="w-3.5 h-3.5" />
          </span>
        )}
      </div>

      {/* Events Container (Ordered by Priority: 1. Holiday -> 2. Mention -> 3. Leave) */}
      <div className="flex-1 space-y-0.5 sm:space-y-1 overflow-hidden">
        {/* 1. Government Holidays (Unified Soft Red badge) */}
        {holidays.map((holiday) => (
          <div
            key={holiday.id}
            onClick={(e) => {
              e.stopPropagation();
              onEventClick(holiday);
            }}
            title={`${holiday.title} - Government Holiday`}
            className="flex items-center gap-0.5 sm:gap-1 px-1 sm:px-1.5 py-0.5 rounded sm:rounded-md bg-[#FEE2E2] border border-rose-200 text-[#B91C1C] text-[9px] xs:text-[10px] sm:text-[11px] font-semibold leading-tight truncate hover:bg-rose-200 transition-colors shadow-subtle cursor-pointer"
          >
            <Flag className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-[#B91C1C] flex-shrink-0" />
            <span className="truncate">{holiday.title}</span>
          </div>
        ))}

        {/* 2. Manual Admin Calendar Mentions (Indigo/Slate event) */}
        {mentions.map((mention) => (
          <div
            key={mention.id}
            onClick={(e) => {
              e.stopPropagation();
              onEventClick(mention);
            }}
            title={`${mention.title} (${mention.manualEventType})`}
            className="flex items-center gap-0.5 sm:gap-1 px-1 sm:px-1.5 py-0.5 rounded sm:rounded-md bg-indigo-50 border border-indigo-200 text-indigo-900 text-[9px] xs:text-[10px] sm:text-[11px] font-semibold leading-tight truncate hover:bg-indigo-100 transition-colors shadow-subtle cursor-pointer"
          >
            <Megaphone className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-indigo-600 flex-shrink-0" />
            <span className="truncate font-semibold">{mention.title}</span>
          </div>
        ))}

        {/* 3. Approved Leaves with show_on_calendar = true */}
        {leaves.map((leave) => {
          const isOwn = leave.isOwnLeave;
          const styleClasses = isOwn
            ? 'bg-purple-50 border-purple-200 text-purple-900'
            : 'bg-emerald-50 border-emerald-200 text-emerald-800';
          const indicatorDot = isOwn ? 'bg-purple-600' : 'bg-emerald-500';

          return (
            <div
              key={leave.id}
              onClick={(e) => {
                e.stopPropagation();
                onEventClick(leave);
              }}
              title={`${leave.userName} (${leave.leaveType}) - Approved & On Calendar`}
              className={`flex items-center justify-between gap-0.5 sm:gap-1 px-1 sm:px-1.5 py-0.5 rounded sm:rounded-md border text-[9px] xs:text-[10px] sm:text-[11px] font-medium leading-tight truncate transition-colors shadow-subtle cursor-pointer ${styleClasses}`}
            >
              <div className="flex items-center gap-1 min-w-0 truncate">
                <span className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full flex-shrink-0 ${indicatorDot}`} />
                <span className="truncate font-semibold">{leave.userName?.split(' ')[0]}</span>
                <span className="truncate text-[10px] opacity-85 hidden md:inline">
                  • {leave.leaveType?.replace(' Leave', '')}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
