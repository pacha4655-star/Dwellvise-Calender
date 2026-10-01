'use client';

import React, { useState } from 'react';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { RightUpcomingPanel } from './RightUpcomingPanel';
import { ApplyLeaveModal } from '@/components/calendar/ApplyLeaveModal';
import { EventDetailModal } from '@/components/calendar/EventDetailModal';
import { CalendarEvent } from '@/types';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { Loader2, AlertCircle, RefreshCw, LogIn } from 'lucide-react';
import Link from 'next/link';

interface AppLayoutProps {
  children: React.ReactNode;
  showRightPanel?: boolean;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  showRightPanel = true,
  searchQuery = '',
  onSearchChange,
}) => {
  const router = useRouter();
  const { user, isLoading, authError, retryAuth } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [layoutTimeout, setLayoutTimeout] = useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setLayoutTimeout(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  const handleOpenEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsDetailModalOpen(true);
  };

  if (isLoading) {
    if (!layoutTimeout) {
      return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
          <div className="flex items-center gap-3 text-blue-600 font-semibold text-sm">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading OfficeFlow Workspace...</span>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="max-w-md w-full p-6 bg-white rounded-2xl border border-slate-200/80 shadow-elevation text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">
            Workspace session loading
          </h2>
          <p className="text-xs text-slate-500">
            {authError || 'Taking longer than usual to connect. You can re-authenticate or retry.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 pt-2 justify-center">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-xs shadow-sm hover:bg-blue-700 transition-all"
            >
              <LogIn className="w-4 h-4" />
              <span>Go to Login</span>
            </Link>
            <button
              type="button"
              onClick={() => {
                setLayoutTimeout(false);
                retryAuth();
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Connection</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      {/* Top Sticky Navbar */}
      <Navbar
        isMobileMenuOpen={isMobileMenuOpen}
        onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
      />

      {/* Main App Container */}
      <div className="flex-1 flex max-w-[1600px] w-full mx-auto">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block">
          <Sidebar onApplyLeaveClick={() => setIsApplyModalOpen(true)} />
        </div>

        {/* Mobile Sidebar Drawer */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 w-72 bg-white shadow-2xl z-50">
              <Sidebar
                onApplyLeaveClick={() => setIsApplyModalOpen(true)}
                onCloseMobile={() => setIsMobileMenuOpen(false)}
              />
            </div>
          </div>
        )}

        {/* Center Main Workspace */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>

        {/* Optional Right Upcoming Events Panel */}
        {showRightPanel && (
          <RightUpcomingPanel onEventClick={handleOpenEvent} referenceDateKey="2026-10-01" />
        )}
      </div>

      {/* Global Apply Leave Modal */}
      <ApplyLeaveModal
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
      />

      {/* Global Event Detail Modal */}
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
