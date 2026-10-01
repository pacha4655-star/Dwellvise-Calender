'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { CalendarEvent, LeaveRequest, GovernmentHoliday, ManualCalendarEvent } from '@/types';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/components/ui/Toast';
import {
  approveLeave,
  rejectLeave,
  cancelLeave,
  toggleLeaveCalendarVisibility,
  deleteMention,
} from '@/lib/data/store';
import { formatDateRange, formatDisplayDate, calculateDaysCount } from '@/lib/utils/date-utils';
import {
  Calendar,
  User,
  Clock,
  Flag,
  FileText,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Building,
  Megaphone,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react';

interface EventDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: CalendarEvent | null;
  onActionComplete?: () => void;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  isOpen,
  onClose,
  event,
  onActionComplete,
}) => {
  const { user, isAdmin } = useAuth();
  const { success, error: toastError } = useToast();

  const [isProcessing, setIsProcessing] = useState(false);
  const [rejectPromptOpen, setRejectPromptOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  if (!event) return null;

  const isHoliday = event.type === 'holiday';
  const isMention = event.type === 'mention';
  const isOwn = event.userId === user?.id;
  const leave = event.rawLeave;
  const mention = event.rawMention;

  // Toggle Visibility Handler for Admin
  const handleToggleVisibility = async (newVisibility: boolean) => {
    if (!leave || !isAdmin) return;
    setIsProcessing(true);
    try {
      const res = await toggleLeaveCalendarVisibility(leave.id, newVisibility);
      if (res.success) {
        success(res.message, 'Visibility Updated');
        onActionComplete?.();
        onClose();
      } else {
        toastError(res.message);
      }
    } catch {
      toastError('Failed to update calendar visibility.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApprove = async (showOnCal: boolean = false) => {
    if (!leave || !user) return;
    setIsProcessing(true);
    try {
      const res = await approveLeave(leave.id, user.id, showOnCal);
      if (res.success) {
        success(`Leave for ${event.userName} approved.`, 'Leave Approved');
        onActionComplete?.();
        onClose();
      } else {
        toastError(res.message);
      }
    } catch {
      toastError('Failed to approve leave request.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!leave || !user) return;
    setIsProcessing(true);
    try {
      const res = await rejectLeave(leave.id, user.id, rejectReason);
      if (res.success) {
        success(`Leave request rejected.`, 'Leave Rejected');
        onActionComplete?.();
        onClose();
      } else {
        toastError(res.message);
      }
    } catch {
      toastError('Failed to reject leave request.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteMention = async () => {
    if (!mention || !isAdmin) return;
    if (confirm(`Are you sure you want to delete the mention "${mention.title}"?`)) {
      setIsProcessing(true);
      try {
        const res = await deleteMention(mention.id);
        if (res.success) {
          success(res.message, 'Mention Removed');
          onActionComplete?.();
          onClose();
        } else {
          toastError(res.message);
        }
      } catch {
        toastError('Failed to delete mention.');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isHoliday
          ? 'Government Holiday'
          : isMention
          ? 'Office Event / Mention'
          : 'Leave Event Details'
      }
      subtitle={
        isHoliday
          ? 'Official public holiday (Soft Red Color)'
          : isMention
          ? 'Official company calendar notice'
          : 'Employee time off schedule'
      }
      maxWidth="md"
    >
      {/* 1. GOVERNMENT HOLIDAY */}
      {isHoliday && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-[#FEE2E2] border border-rose-200">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-sm">
              <Flag className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900">{event.title}</h4>
              <p className="text-xs text-rose-800 font-medium">
                {event.holidayType || 'Government Holiday'} • Unified Soft Red Theme
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
            <div>
              <span className="text-slate-400 font-medium">Holiday Date:</span>
              <p className="font-semibold text-slate-900 mt-0.5">{formatDisplayDate(event.startDate)}</p>
            </div>
            <div>
              <span className="text-slate-400 font-medium">Office Status:</span>
              <p className="font-semibold text-emerald-700 mt-0.5">Office Closed (Public Holiday)</p>
            </div>
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
              Description & Significance
            </span>
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 leading-relaxed">
              {event.description || 'Official government public holiday observed in Tamil Nadu.'}
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}

      {/* 2. MANUAL CALENDAR MENTION */}
      {isMention && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-indigo-50 border border-indigo-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                <Megaphone className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">{event.title}</h4>
                <p className="text-xs text-indigo-700 font-semibold">{event.manualEventType || 'Company Event'}</p>
              </div>
            </div>
            <Badge variant="primary" size="sm">
              Admin Mention
            </Badge>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
            <span className="text-slate-400 font-medium">Scheduled Date Range:</span>
            <p className="font-bold text-slate-900 mt-0.5">
              {formatDateRange(event.startDate, event.endDate)}
            </p>
          </div>

          {event.description && (
            <div>
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
                Event Details & Note
              </span>
              <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 leading-relaxed">
                {event.description}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            {isAdmin ? (
              <Button
                variant="danger"
                size="sm"
                isLoading={isProcessing}
                onClick={handleDeleteMention}
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              >
                Delete Mention
              </Button>
            ) : <div />}
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}

      {/* 3. LEAVE REQUEST */}
      {!isHoliday && !isMention && (
        <div className="space-y-4">
          {/* Header Card */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                  isOwn ? 'bg-purple-600 text-white' : 'bg-blue-600 text-white'
                }`}
              >
                {event.userName ? event.userName[0] : 'U'}
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  {event.userName} {isOwn && <span className="text-purple-600 text-xs font-normal">(You)</span>}
                </h4>
                <p className="text-[11px] text-slate-500">{event.userDepartment || 'Engineering'}</p>
              </div>
            </div>
            {event.status && <StatusBadge status={event.status} size="md" />}
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 text-xs">
            <div>
              <span className="text-slate-400 font-medium">Leave Type:</span>
              <p className="font-semibold text-slate-900 mt-0.5">{event.leaveType}</p>
            </div>
            <div>
              <span className="text-slate-400 font-medium">Duration:</span>
              <p className="font-semibold text-slate-900 mt-0.5">
                {calculateDaysCount(event.startDate, event.endDate)}{' '}
                {calculateDaysCount(event.startDate, event.endDate) === 1 ? 'Day' : 'Days'}
              </p>
            </div>
            <div className="col-span-2 pt-2 border-t border-slate-200/60">
              <span className="text-slate-400 font-medium">Date Range:</span>
              <p className="font-semibold text-slate-900 mt-0.5">
                {formatDateRange(event.startDate, event.endDate)}
              </p>
            </div>
          </div>

          {/* ADMIN VISIBILITY TOGGLE SWITCH */}
          {isAdmin && leave && (
            <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-700" />
                  <span className="font-bold text-xs text-blue-900">Shared Calendar Visibility</span>
                </div>
                <p className="text-[11px] text-blue-700 mt-0.5">
                  {leave.show_on_calendar
                    ? 'Currently VISIBLE on shared company calendar'
                    : 'Currently HIDDEN from shared company calendar'}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleToggleVisibility(false)}
                  disabled={isProcessing || !leave.show_on_calendar}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    !leave.show_on_calendar
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  OFF
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleVisibility(true)}
                  disabled={isProcessing || leave.show_on_calendar}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    leave.show_on_calendar
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  ON
                </button>
              </div>
            </div>
          )}

          {/* PRIVACY ENFORCEMENT SECTION */}
          {isOwn || isAdmin ? (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Leave Reason {isAdmin && !isOwn && <span className="text-blue-600 font-normal">(Admin View)</span>}
                </span>
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-slate-400" />
                  Confidential
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 leading-relaxed">
                {event.reason || leave?.reason || 'No specific reason provided.'}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 text-xs">
              <Lock className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span>Leave reason is private and visible only to the employee and Admin.</span>
            </div>
          )}

          {/* Admin Pending Decision Flow */}
          {isAdmin && leave?.status === 'pending' && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span>Decision & Visibility Selection</span>
              </div>

              {rejectPromptOpen ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Reason for rejection..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-red-200 bg-white"
                  />
                  <div className="flex flex-col-reverse sm:flex-row items-center gap-2 justify-end">
                    <Button size="sm" variant="outline" onClick={() => setRejectPromptOpen(false)} className="w-full sm:w-auto">
                      Back
                    </Button>
                    <Button size="sm" variant="danger" isLoading={isProcessing} onClick={handleReject} className="w-full sm:w-auto">
                      Confirm Reject
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-end gap-2">
                  <Button size="sm" variant="danger" onClick={() => setRejectPromptOpen(true)} className="w-full sm:w-auto">
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    isLoading={isProcessing}
                    onClick={() => handleApprove(false)}
                    title="Approve leave but keep it hidden from shared calendar"
                    className="w-full sm:w-auto"
                  >
                    Approve (Keep Private)
                  </Button>
                  <Button
                    size="sm"
                    variant="success"
                    isLoading={isProcessing}
                    onClick={() => handleApprove(true)}
                    title="Approve leave and display on shared calendar"
                    className="w-full sm:w-auto"
                  >
                    Approve + Show on Calendar
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
