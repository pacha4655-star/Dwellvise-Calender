'use client';

import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { OfficeCalendar } from '@/components/calendar/OfficeCalendar';

export default function CalendarPage() {
  const [globalSearch, setGlobalSearch] = useState('');

  return (
    <AppLayout
      showRightPanel={true}
      searchQuery={globalSearch}
      onSearchChange={setGlobalSearch}
    >
      <div className="w-full min-w-0 flex flex-col space-y-4">
        {/* Welcome Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 sm:pb-2 min-w-0">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 truncate">
              Office Calendar & Leave Roster
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Real-time shared schedule for 4 team members & official Tamil Nadu holidays.
            </p>
          </div>
        </div>

        {/* Office Calendar Component */}
        <OfficeCalendar
          initialYear={2026}
          initialMonth={9} // October 2026
          externalSearch={globalSearch}
        />
      </div>
    </AppLayout>
  );
}
