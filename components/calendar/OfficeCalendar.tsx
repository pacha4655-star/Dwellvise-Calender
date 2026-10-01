'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  generateMonthGrid,
  WEEKDAYS,
  FULL_WEEKDAYS,
  formatDateKey,
  isDateInRange,
  formatDisplayDate,
  MONTH_NAMES,
} from '@/lib/utils/date-utils';
import { useAuth } from '@/lib/auth/auth-context';
import { getCalendarEvents, subscribeToStore, getUsers } from '@/lib/data/store';
import { CalendarEvent, CalendarFilter, UserProfile } from '@/types';
import { CalendarHeader } from './CalendarHeader';
import { CalendarDayCell } from './CalendarDayCell';
import { CalendarLegend } from './CalendarLegend';
import { ApplyLeaveModal } from './ApplyLeaveModal';
import { AddMentionModal } from './AddMentionModal';
import { EventDetailModal } from './EventDetailModal';
import { Plus, Megaphone } from 'lucide-react';

interface OfficeCalendarProps {
  initialYear?: number;
  initialMonth?: number; // 0-indexed (9 = October)
  externalSearch?: string;
  onApplyLeaveClickRef?: (fn: () => void) => void;
}

export const OfficeCalendar: React.FC<OfficeCalendarProps> = ({
  initialYear = 2026,
  initialMonth = 9, // October
  externalSearch = '',
  onApplyLeaveClickRef,
}) => {
  const { user, isAdmin } = useAuth();
  const [usersList, setUsersList] = useState<UserProfile[]>([]);

  // Navigation State
  const [currentYear, setCurrentYear] = useState(initialYear);
  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [currentView, setCurrentView] = useState<'month' | 'week' | 'day'>('month');

  // Selected date / modal state
  const [selectedDateKey, setSelectedDateKey] = useState<string>('2026-10-08');
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isAddMentionOpen, setIsAddMentionOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Filters State
  const [filter, setFilter] = useState<CalendarFilter>({
    searchQuery: externalSearch,
    selectedUser: 'all',
    selectedLeaveType: 'all',
    selectedStatus: 'all',
    showHolidays: true,
    showMentions: true,
  });

  useEffect(() => {
    setFilter((prev) => ({ ...prev, searchQuery: externalSearch }));
  }, [externalSearch]);

  useEffect(() => {
    if (onApplyLeaveClickRef) {
      onApplyLeaveClickRef(() => {
        setSelectedDateKey(formatDateKey(new Date(currentYear, currentMonth, 1)));
        setIsApplyModalOpen(true);
      });
    }
  }, [onApplyLeaveClickRef, currentYear, currentMonth]);

  const [storeVersion, setStoreVersion] = useState(0);

  useEffect(() => {
    setUsersList(getUsers());
    const unsubscribe = subscribeToStore(() => {
      setUsersList(getUsers());
      setStoreVersion((v) => v + 1);
    });
    return unsubscribe;
  }, []);

  // Retrieve calendar events with user visibility & privacy rules applied
  const events = useMemo(() => {
    if (!user) return [];
    // storeVersion forces re-evaluation when store updates
    void storeVersion;
    return getCalendarEvents(user.id, user.role, filter);
  }, [user, filter, storeVersion]);

  // Generate grid for month view
  const monthGrid = useMemo(() => {
    return generateMonthGrid(currentYear, currentMonth, '2026-10-01');
  }, [currentYear, currentMonth]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentYear((y) => y - 1);
      setCurrentMonth(11);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentYear((y) => y + 1);
      setCurrentMonth(0);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleToday = () => {
    setCurrentYear(2026);
    setCurrentMonth(9); // Oct 2026
  };

  const handleDateClick = (dateKey: string) => {
    setSelectedDateKey(dateKey);
    setIsApplyModalOpen(true);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsDetailModalOpen(true);
  };

  const handleFilterChange = (updated: Partial<CalendarFilter>) => {
    setFilter((prev) => ({ ...prev, ...updated }));
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Calendar Header with Navigation and Filter Controls */}
      <CalendarHeader
        currentYear={currentYear}
        currentMonth={currentMonth}
        currentView={currentView}
        onViewChange={setCurrentView}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onToday={handleToday}
        onApplyLeaveClick={() => {
          setSelectedDateKey('2026-10-08');
          setIsApplyModalOpen(true);
        }}
        onAddMentionClick={() => {
          setSelectedDateKey(formatDateKey(new Date(currentYear, currentMonth, 1)));
          setIsAddMentionOpen(true);
        }}
        isAdmin={isAdmin}
        filter={filter}
        onFilterChange={handleFilterChange}
        usersList={usersList}
      />

      {/* Main Calendar View Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-subtle overflow-hidden flex flex-col flex-1">
        {currentView === 'month' && (
          <div className="flex flex-col flex-1">
            {/* Weekday Header Row (Sunday highlighted in Soft Red) */}
            <div className="grid grid-cols-7 border-b border-slate-200/90 bg-slate-50/80 text-center text-xs font-bold text-slate-600 py-2.5">
              {WEEKDAYS.map((day, idx) => (
                <div
                  key={day}
                  className={
                    idx === 0
                      ? 'text-[#B91C1C] bg-rose-50/60 py-0.5 rounded' // Single Soft Red highlight for Sunday
                      : idx === 6
                      ? 'text-slate-500'
                      : 'text-slate-700'
                  }
                >
                  <span className="hidden sm:inline">{FULL_WEEKDAYS[idx]}</span>
                  <span className="sm:hidden">{day}</span>
                </div>
              ))}
            </div>

            {/* Month Day Grid */}
            <div className="grid grid-cols-7 flex-1 auto-rows-fr bg-slate-100/40">
              {monthGrid.map((day) => {
                const dayEvents = events.filter((e) =>
                  isDateInRange(day.dateKey, e.startDate, e.endDate)
                );

                return (
                  <CalendarDayCell
                    key={day.dateKey}
                    dateKey={day.dateKey}
                    dayNumber={day.dayNumber}
                    isCurrentMonth={day.isCurrentMonth}
                    isToday={day.isToday}
                    isSunday={day.isSunday}
                    isWeekend={day.isWeekend}
                    isWithinBounds={day.isWithinBounds}
                    events={dayEvents}
                    onDateClick={handleDateClick}
                    onEventClick={handleEventClick}
                    isAdmin={isAdmin}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Week View */}
        {currentView === 'week' && (
          <div className="p-4 sm:p-6 space-y-3">
            <h4 className="text-sm font-bold text-slate-800">
              Week Schedule ({MONTH_NAMES[currentMonth]} {currentYear})
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
              {monthGrid.slice(0, 7).map((day, idx) => {
                const dayEvents = events.filter((e) =>
                  isDateInRange(day.dateKey, e.startDate, e.endDate)
                );
                return (
                  <div
                    key={day.dateKey}
                    className={`p-3 rounded-xl border space-y-2 ${
                      day.isSunday ? 'bg-rose-50/50 border-rose-200' : 'bg-slate-50/60 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-1 border-b border-slate-200/80">
                      <span
                        className={`text-xs font-bold ${
                          day.isSunday ? 'text-rose-700' : 'text-slate-700'
                        }`}
                      >
                        {WEEKDAYS[idx]}
                      </span>
                      <span className="text-xs font-bold text-blue-600">{day.dayNumber}</span>
                    </div>
                    <div className="space-y-1 min-h-[100px]">
                      {dayEvents.length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic">No events</p>
                      ) : (
                        dayEvents.map((e) => (
                          <div
                            key={e.id}
                            onClick={() => handleEventClick(e)}
                            className="p-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold shadow-subtle cursor-pointer hover:border-blue-300"
                          >
                            <p className="text-[11px] text-slate-800 truncate">{e.title}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Day View */}
        {currentView === 'day' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold text-slate-900">
                Agenda for {formatDisplayDate(selectedDateKey)}
              </h4>
              <button
                onClick={() => setIsApplyModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 shadow-sm"
              >
                + Apply for this date
              </button>
            </div>

            <div className="space-y-2">
              {events.filter((e) => isDateInRange(selectedDateKey, e.startDate, e.endDate)).length ===
              0 ? (
                <div className="p-8 text-center text-slate-400 border border-dashed rounded-xl">
                  No public events or approved calendar leaves scheduled for {formatDisplayDate(selectedDateKey)}
                </div>
              ) : (
                events
                  .filter((e) => isDateInRange(selectedDateKey, e.startDate, e.endDate))
                  .map((e) => (
                    <div
                      key={e.id}
                      onClick={() => handleEventClick(e)}
                      className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-300 shadow-subtle flex items-center justify-between cursor-pointer transition-all"
                    >
                      <div>
                        <h5 className="text-sm font-bold text-slate-900">{e.title}</h5>
                        <p className="text-xs text-slate-500">
                          {e.type === 'holiday'
                            ? `Government Holiday • ${e.description}`
                            : e.type === 'mention'
                            ? `Office Notice • ${e.description}`
                            : `${e.userName} • ${e.leaveType}`}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-blue-600">View Details →</span>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Calendar Legend Bar */}
      <CalendarLegend />

      {/* Apply Leave Modal */}
      <ApplyLeaveModal
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
        initialDate={selectedDateKey}
      />

      {/* Add Mention Modal (Admin Only) */}
      <AddMentionModal
        isOpen={isAddMentionOpen}
        onClose={() => setIsAddMentionOpen(false)}
        initialDate={selectedDateKey}
      />

      {/* Event Detail Modal with Privacy Enforcement */}
      <EventDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedEvent(null);
        }}
        event={selectedEvent}
      />
    </div>
  );
};
