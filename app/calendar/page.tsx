'use client';

import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { OfficeCalendar } from '@/components/calendar/OfficeCalendar';
import { useAuth } from '@/lib/auth/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function CalendarPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [globalSearch, setGlobalSearch] = useState('');

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return null;
  }

  return (
    <AppLayout
      showRightPanel={true}
      searchQuery={globalSearch}
      onSearchChange={setGlobalSearch}
    >
      <div className="h-full flex flex-col space-y-4">
        {/* Welcome Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
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
