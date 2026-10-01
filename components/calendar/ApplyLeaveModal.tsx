'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/components/ui/Toast';
import { applyLeave } from '@/lib/data/store';
import { LeaveType } from '@/types';
import {
  calculateDaysCount,
  calculateWorkingDays,
  formatDisplayDate,
  isWithinAppRange,
} from '@/lib/utils/date-utils';
import { Calendar, User, Clock, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';

interface ApplyLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: string; // YYYY-MM-DD
  onSuccess?: () => void;
}

const LEAVE_TYPES: LeaveType[] = [
  'Casual Leave',
  'Sick Leave',
  'Personal Leave',
  'Emergency Leave',
  'Other',
];

export const ApplyLeaveModal: React.FC<ApplyLeaveModalProps> = ({
  isOpen,
  onClose,
  initialDate,
  onSuccess,
}) => {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();

  const [leaveType, setLeaveType] = useState<LeaveType>('Sick Leave');
  const [startDate, setStartDate] = useState<string>('2026-10-08');
  const [endDate, setEndDate] = useState<string>('2026-10-08');
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      if (initialDate && isWithinAppRange(initialDate)) {
        setStartDate(initialDate);
        setEndDate(initialDate);
      } else {
        setStartDate('2026-10-08');
        setEndDate('2026-10-08');
      }
    }
  }, [initialDate, isOpen]);

  const totalDays = calculateDaysCount(startDate, endDate);
  const workingDays = calculateWorkingDays(startDate, endDate);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!user) {
      setFormError('Please log in to apply for leave.');
      return;
    }

    if (!startDate || !endDate) {
      setFormError('Start date and End date are required.');
      return;
    }

    if (endDate < startDate) {
      setFormError('End date cannot be earlier than start date.');
      return;
    }

    if (!isWithinAppRange(startDate) || !isWithinAppRange(endDate)) {
      setFormError('Selected dates must be between October 2026 and December 2027.');
      return;
    }

    if (!reason.trim()) {
      setFormError('Please enter a brief reason for your leave.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await applyLeave({
        userId: user.id,
        leaveType,
        startDate,
        endDate,
        reason: reason.trim(),
      });

      if (result.success) {
        success(
          `${leaveType} request for ${formatDisplayDate(startDate)}${
            startDate !== endDate ? ` to ${formatDisplayDate(endDate)}` : ''
          } submitted successfully. Status: Pending.`,
          'Leave Submitted'
        );
        setReason('');
        onSuccess?.();
        onClose();
      } else {
        setFormError(result.message);
        toastError(result.message, 'Application Failed');
      }
    } catch (err) {
      setFormError('Failed to submit leave request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Apply for Leave"
      subtitle="Submit your time off request directly to management"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        {/* Employee Info Card */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-blue-50/60 border border-blue-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
              {user?.full_name ? user.full_name[0] : 'U'}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">{user?.full_name || 'Logged in Employee'}</p>
              <p className="text-[11px] text-slate-500">{user?.department} • {user?.role}</p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-blue-700 bg-white px-2.5 py-1 rounded-lg border border-blue-200 shadow-subtle">
            Active Employee
          </span>
        </div>

        {/* Leave Type Select */}
        <div className="w-full">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Leave Type
          </label>
          <select
            value={leaveType}
            onChange={(e) => setLeaveType(e.target.value as LeaveType)}
            className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-sm text-slate-900 rounded-xl px-3.5 py-2.5 outline-none transition-all"
          >
            {LEAVE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        {/* Date Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Start Date
            </label>
            <input
              type="date"
              min="2026-10-01"
              max="2027-12-31"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (endDate < e.target.value) {
                  setEndDate(e.target.value);
                }
              }}
              required
              className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-sm text-slate-900 rounded-xl px-3.5 py-2.5 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              End Date
            </label>
            <input
              type="date"
              min={startDate || '2026-10-01'}
              max="2027-12-31"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-sm text-slate-900 rounded-xl px-3.5 py-2.5 outline-none transition-all"
            />
          </div>
        </div>

        {/* Duration Summary */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <Clock className="w-4 h-4 text-blue-600" />
            <span className="font-medium">Total Duration:</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">
              {totalDays} {totalDays === 1 ? 'Calendar Day' : 'Calendar Days'}
            </span>
            <span className="text-slate-400">({workingDays} working {workingDays === 1 ? 'day' : 'days'})</span>
          </div>
        </div>

        {/* Reason Textarea */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Reason for Leave <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={3}
            placeholder="e.g. Not feeling well, family event, personal emergency..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-sm text-slate-900 rounded-xl px-3.5 py-2.5 outline-none transition-all placeholder:text-slate-400"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            🔒 Note: Your private reason is visible only to you and Management. Peer employees will only see leave dates and leave type.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            Submit Leave Request
          </Button>
        </div>
      </form>
    </Modal>
  );
};
