'use client';

import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Filter,
  Users,
  Plus,
  RotateCcw,
  Megaphone,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { UserProfile, CalendarFilter } from '@/types';
import { MONTH_NAMES, canNavigatePrev, canNavigateNext } from '@/lib/utils/date-utils';

interface CalendarHeaderProps {
  currentYear: number;
  currentMonth: number; // 0 - 11
  currentView: 'month' | 'week' | 'day';
  onViewChange: (view: 'month' | 'week' | 'day') => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onApplyLeaveClick: () => void;
  onAddMentionClick?: () => void;
  isAdmin?: boolean;
  filter: CalendarFilter;
  onFilterChange: (updated: Partial<CalendarFilter>) => void;
  usersList: UserProfile[];
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  currentYear,
  currentMonth,
  currentView,
  onViewChange,
  onPrevMonth,
  onNextMonth,
  onToday,
  onApplyLeaveClick,
  onAddMentionClick,
  isAdmin = false,
  filter,
  onFilterChange,
  usersList,
}) => {
  const isPrevDisabled = !canNavigatePrev(currentYear, currentMonth);
  const isNextDisabled = !canNavigateNext(currentYear, currentMonth);

  return (
    <div className="w-full min-w-0 space-y-3 pb-3 border-b border-slate-200/80">
      {/* Top Row: Month Navigation, Today, Views, Apply & Mention Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 min-w-0">
        {/* Navigation & Month Heading */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="flex items-center bg-white rounded-xl border border-slate-200 p-0.5 sm:p-1 shadow-subtle flex-shrink-0">
            <button
              onClick={onPrevMonth}
              disabled={isPrevDisabled}
              aria-label="Previous month"
              className="p-1 sm:p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={onToday}
              className="px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-semibold text-slate-700 hover:text-blue-600 transition-colors"
            >
              Oct 2026
            </button>
            <button
              onClick={onNextMonth}
              disabled={isNextDisabled}
              aria-label="Next month"
              className="p-1 sm:p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="min-w-0">
            <h2 className="text-base sm:text-lg md:text-xl font-bold text-slate-900 tracking-tight truncate">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </h2>
            <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate">
              Oct 2026 – Dec 2027
            </p>
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 justify-between sm:justify-end">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 sm:p-1 rounded-xl border border-slate-200/70 text-xs font-semibold text-slate-600">
            {(['month', 'week', 'day'] as const).map((view) => (
              <button
                key={view}
                onClick={() => onViewChange(view)}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg capitalize transition-all text-xs ${
                  currentView === view
                    ? 'bg-white text-blue-700 shadow-sm font-bold'
                    : 'hover:text-slate-900'
                }`}
              >
                {view}
              </button>
            ))}
          </div>

          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              onClick={onAddMentionClick}
              leftIcon={<Megaphone className="w-3.5 h-3.5 text-indigo-600" />}
              className="border-indigo-200 hover:bg-indigo-50 text-indigo-900 text-xs py-1.5 px-2.5 sm:px-3"
            >
              <span className="hidden xs:inline">Add </span>Mention
            </Button>
          )}

          <Button
            size="sm"
            variant="primary"
            onClick={onApplyLeaveClick}
            leftIcon={<Plus className="w-4 h-4" />}
            className="shadow-sm text-xs py-1.5 px-2.5 sm:px-3"
          >
            Apply Leave
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-1 text-xs">
        <div className="flex items-center gap-1 text-slate-500 font-semibold uppercase text-[10px] tracking-wider mr-0.5">
          <Filter className="w-3 h-3 text-slate-400" />
          <span className="hidden xs:inline">Filters:</span>
        </div>

        {/* Employee Filter */}
        <select
          value={filter.selectedUser}
          onChange={(e) => onFilterChange({ selectedUser: e.target.value })}
          className="bg-white border border-slate-200 text-slate-700 rounded-lg px-2 py-1 text-xs outline-none focus:border-blue-500 hover:border-slate-300 max-w-[140px] sm:max-w-none truncate"
        >
          <option value="all">All Employees</option>
          {usersList.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name} ({u.role})
            </option>
          ))}
        </select>

        {/* Leave Type Filter */}
        <select
          value={filter.selectedLeaveType}
          onChange={(e) => onFilterChange({ selectedLeaveType: e.target.value })}
          className="bg-white border border-slate-200 text-slate-700 rounded-lg px-2 py-1 text-xs outline-none focus:border-blue-500 hover:border-slate-300 max-w-[130px] sm:max-w-none truncate"
        >
          <option value="all">All Leaves</option>
          <option value="Casual Leave">Casual Leave</option>
          <option value="Sick Leave">Sick Leave</option>
          <option value="Personal Leave">Personal Leave</option>
          <option value="Emergency Leave">Emergency Leave</option>
        </select>

        {/* Holiday Toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer select-none bg-white border border-slate-200 rounded-lg px-2 py-1 hover:border-slate-300 text-slate-700 text-xs">
          <input
            type="checkbox"
            checked={filter.showHolidays}
            onChange={(e) => onFilterChange({ showHolidays: e.target.checked })}
            className="rounded text-rose-600 focus:ring-rose-500 w-3.5 h-3.5"
          />
          <span>Holidays</span>
        </label>

        {/* Mentions Toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer select-none bg-white border border-slate-200 rounded-lg px-2 py-1 hover:border-slate-300 text-slate-700 text-xs">
          <input
            type="checkbox"
            checked={filter.showMentions}
            onChange={(e) => onFilterChange({ showMentions: e.target.checked })}
            className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
          />
          <span>Notices</span>
        </label>

        {/* Meetings Toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer select-none bg-white border border-slate-200 rounded-lg px-2 py-1 hover:border-slate-300 text-slate-700 text-xs">
          <input
            type="checkbox"
            checked={filter.showMeetings !== false}
            onChange={(e) => onFilterChange({ showMeetings: e.target.checked })}
            className="rounded text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
          />
          <span>Meetings (14d/45d)</span>
        </label>

        {/* Reset Filter Button */}
        {(filter.selectedUser !== 'all' ||
          filter.selectedLeaveType !== 'all' ||
          filter.selectedStatus !== 'all' ||
          !filter.showHolidays ||
          !filter.showMentions ||
          filter.showMeetings === false ||
          filter.searchQuery !== '') && (
          <button
            onClick={() =>
              onFilterChange({
                selectedUser: 'all',
                selectedLeaveType: 'all',
                selectedStatus: 'all',
                showHolidays: true,
                showMentions: true,
                showMeetings: true,
                searchQuery: '',
              })
            }
            className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 px-2 py-1 rounded bg-blue-50"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        )}
      </div>
    </div>
  );
};
