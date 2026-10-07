'use client';

import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/lib/auth/auth-context';
import {
  getLeaves,
  approveLeave,
  rejectLeave,
  toggleLeaveCalendarVisibility,
  subscribeToStore,
} from '@/lib/data/store';
import { LeaveRequest } from '@/types';
import { formatDisplayDate, formatDateRange, calculateDaysCount } from '@/lib/utils/date-utils';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import {
  ClipboardList,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Eye,
  ShieldCheck,
  AlertCircle,
  FileText,
  User,
  EyeOff,
} from 'lucide-react';

export default function AdminLeaveRequestsPage() {
  const { user, isAdmin } = useAuth();
  const { success, error: toastError } = useToast();

  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [targetRejectId, setTargetRejectId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const loadData = () => {
    setLeaves(getLeaves());
  };

  useEffect(() => {
    loadData();
    const unsub = subscribeToStore(loadData);

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const targetId = params.get('id');
      if (targetId) {
        setHighlightedId(targetId);
        const allLeaves = getLeaves();
        const target = allLeaves.find((l) => l.id === targetId);
        if (target) {
          setStatusFilter('all');
          setSelectedLeave(target);
        }
      }
    }

    return unsub;
  }, []);

  const handleApprove = async (leaveId: string, empName: string, showOnCal: boolean = false) => {
    if (!user) return;
    setIsProcessing(true);
    try {
      const res = await approveLeave(leaveId, user.id, showOnCal);
      if (res.success) {
        success(`Leave for ${empName} approved.${showOnCal ? ' Marked visible on calendar.' : ' Kept hidden.'}`, 'Leave Approved');
        loadData();
        setSelectedLeave(null);
      } else {
        toastError(res.message);
      }
    } catch {
      toastError('Failed to approve leave request.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleVisibility = async (leaveId: string, newVisibility: boolean) => {
    setIsProcessing(true);
    try {
      const res = await toggleLeaveCalendarVisibility(leaveId, newVisibility);
      if (res.success) {
        success(res.message, 'Visibility Updated');
        loadData();
      } else {
        toastError(res.message);
      }
    } catch {
      toastError('Failed to update visibility.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenReject = (leaveId: string) => {
    setTargetRejectId(leaveId);
    setRejectReason('Operational commitments');
    setRejectModalOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!targetRejectId || !user) return;
    setIsProcessing(true);
    try {
      const res = await rejectLeave(targetRejectId, user.id, rejectReason);
      if (res.success) {
        success('Leave request rejected.', 'Leave Rejected');
        setRejectModalOpen(false);
        setTargetRejectId(null);
        setSelectedLeave(null);
        loadData();
      } else {
        toastError(res.message);
      }
    } catch {
      toastError('Failed to reject leave.');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredLeaves = leaves.filter((l) => {
    if (statusFilter === 'all') return true;
    return l.status === statusFilter;
  });

  return (
    <AppLayout showRightPanel={false}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Leave Request Management
              </h1>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                Admin Review Center
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Review employee applications, approve/reject requests, and control <strong>Show on Calendar (ON/OFF)</strong> visibility.
            </p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-subtle">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-500">Status View:</span>
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
              {[
                { key: 'pending', label: 'Pending Approvals' },
                { key: 'approved', label: 'Approved' },
                { key: 'rejected', label: 'Rejected' },
                { key: 'all', label: 'All History' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={`px-3 py-1 rounded-lg capitalize transition-all ${
                    statusFilter === tab.key
                      ? 'bg-white text-blue-700 shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <span className="text-xs font-bold text-slate-500">
            {filteredLeaves.length} {filteredLeaves.length === 1 ? 'Application' : 'Applications'}
          </span>
        </div>

        {/* Requests Table */}
        <Card className="border border-slate-200 overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            {filteredLeaves.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                No leave requests found for the selected status filter.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-3 sm:px-4">Employee</th>
                    <th className="py-3.5 px-3 sm:px-4">Leave Type</th>
                    <th className="py-3.5 px-3 sm:px-4">Dates & Duration</th>
                    <th className="py-3.5 px-3 sm:px-4">Applied / Updated</th>
                    <th className="py-3.5 px-3 sm:px-4">Reason (Admin View)</th>
                    <th className="py-3.5 px-3 sm:px-4">Status</th>
                    <th className="py-3.5 px-3 sm:px-4 text-center">Show on Calendar</th>
                    <th className="py-3.5 px-3 sm:px-4 text-right">Approval Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLeaves.map((leave) => {
                    const days = calculateDaysCount(leave.start_date, leave.end_date);
                    const isHighlighted = leave.id === highlightedId;
                    const createdFormatted = leave.created_at ? formatDisplayDate(leave.created_at.substring(0, 10)) : '—';
                    const updatedFormatted = leave.updated_at ? formatDisplayDate(leave.updated_at.substring(0, 10)) : createdFormatted;

                    return (
                      <tr
                        key={leave.id}
                        className={`transition-colors ${
                          isHighlighted
                            ? 'bg-blue-50/90 ring-2 ring-blue-500/30 font-medium'
                            : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td className="py-4 px-3 sm:px-4 font-bold text-slate-900">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                              {leave.user?.full_name ? leave.user.full_name[0] : 'U'}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{leave.user?.full_name}</p>
                              <p className="text-[10px] text-slate-400 font-normal">
                                {leave.user?.department} • {leave.user?.role}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-3 sm:px-4 font-semibold text-slate-800">
                          {leave.leave_type}
                        </td>

                        <td className="py-4 px-3 sm:px-4 text-slate-700">
                          <p className="font-semibold">{formatDateRange(leave.start_date, leave.end_date)}</p>
                          <span className="text-[10px] text-slate-500 font-medium">
                            {days} {days === 1 ? 'Day' : 'Days'}
                          </span>
                        </td>

                        <td className="py-4 px-3 sm:px-4 text-slate-600">
                          <p className="font-medium text-[11px] text-slate-700">Applied: {createdFormatted}</p>
                          {leave.updated_at && leave.updated_at !== leave.created_at && (
                            <p className="text-[10px] text-slate-400">Updated: {updatedFormatted}</p>
                          )}
                        </td>

                        <td className="py-4 px-3 sm:px-4 max-w-xs text-slate-700">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate font-medium max-w-[160px]" title={leave.reason}>
                              {leave.reason}
                            </p>
                            <button
                              onClick={() => setSelectedLeave(leave)}
                              className="text-blue-600 hover:text-blue-800 p-1 flex-shrink-0"
                              title="Inspect Full Reason"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>

                        <td className="py-4 px-3 sm:px-4">
                          <StatusBadge status={leave.status} />
                        </td>

                        {/* SHOW ON CALENDAR TOGGLE */}
                        <td className="py-4 px-3 sm:px-4 text-center">
                          {leave.status === 'approved' ? (
                            <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                              <button
                                type="button"
                                onClick={() => handleToggleVisibility(leave.id, false)}
                                disabled={isProcessing || !leave.show_on_calendar}
                                className={`px-2 py-0.5 text-[11px] font-bold rounded-lg transition-all ${
                                  !leave.show_on_calendar
                                    ? 'bg-slate-700 text-white shadow-sm'
                                    : 'text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                OFF
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleVisibility(leave.id, true)}
                                disabled={isProcessing || leave.show_on_calendar}
                                className={`px-2 py-0.5 text-[11px] font-bold rounded-lg transition-all ${
                                  leave.show_on_calendar
                                    ? 'bg-emerald-600 text-white shadow-sm'
                                    : 'text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                ON
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-semibold italic">
                              Off (Pending)
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-3 sm:px-4 text-right">
                          {leave.status === 'pending' ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => handleOpenReject(leave.id)}
                              >
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                isLoading={isProcessing}
                                onClick={() => handleApprove(leave.id, leave.user?.full_name || 'Employee', false)}
                                title="Approve but keep hidden from shared calendar"
                              >
                                Approve (Hidden)
                              </Button>
                              <Button
                                size="sm"
                                variant="success"
                                isLoading={isProcessing}
                                onClick={() => handleApprove(leave.id, leave.user?.full_name || 'Employee', true)}
                                title="Approve and mark visible on shared calendar"
                              >
                                Approve + Show
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 font-medium">
                              Processed ({leave.status})
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Mobile Card View (< 768px) */}
          <div className="md:hidden p-3 space-y-3">
            {filteredLeaves.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No leave requests found for the selected status filter.
              </div>
            ) : (
              filteredLeaves.map((leave) => {
                const days = calculateDaysCount(leave.start_date, leave.end_date);
                const isHighlighted = leave.id === highlightedId;
                const createdFormatted = leave.created_at ? formatDisplayDate(leave.created_at.substring(0, 10)) : '—';
                const updatedFormatted = leave.updated_at ? formatDisplayDate(leave.updated_at.substring(0, 10)) : createdFormatted;

                return (
                  <div
                    key={leave.id}
                    className={`p-3.5 rounded-xl border space-y-3 shadow-subtle transition-all ${
                      isHighlighted
                        ? 'bg-blue-50/90 border-blue-300 ring-2 ring-blue-500/20'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {leave.user?.full_name ? leave.user.full_name[0] : 'U'}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-slate-900">{leave.user?.full_name}</h4>
                          <p className="text-[11px] text-slate-400">{leave.user?.department} • {leave.leave_type}</p>
                        </div>
                      </div>
                      <StatusBadge status={leave.status} size="sm" />
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Dates:</span>
                        <span className="font-semibold text-slate-800">{formatDateRange(leave.start_date, leave.end_date)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Duration:</span>
                        <span className="font-semibold text-slate-800">{days} {days === 1 ? 'day' : 'days'}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Applied:</span>
                        <span className="text-slate-600">{createdFormatted}</span>
                      </div>
                      {leave.updated_at && leave.updated_at !== leave.created_at && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">Updated:</span>
                          <span className="text-slate-600">{updatedFormatted}</span>
                        </div>
                      )}
                      {leave.reason && (
                        <div className="pt-1 border-t border-slate-200/60 mt-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Reason:</span>
                          <p className="text-slate-700 mt-0.5">{leave.reason}</p>
                        </div>
                      )}
                    </div>

                    {/* Show on Calendar Toggle for Mobile */}
                    {leave.status === 'approved' && (
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                        <span className="text-xs font-semibold text-slate-600">Show on Calendar:</span>
                        <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                          <button
                            type="button"
                            onClick={() => handleToggleVisibility(leave.id, false)}
                            disabled={isProcessing || !leave.show_on_calendar}
                            className={`px-2.5 py-0.5 text-xs font-bold rounded-lg transition-all ${
                              !leave.show_on_calendar
                                ? 'bg-slate-700 text-white shadow-sm'
                                : 'text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            OFF
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleVisibility(leave.id, true)}
                            disabled={isProcessing || leave.show_on_calendar}
                            className={`px-2.5 py-0.5 text-xs font-bold rounded-lg transition-all ${
                              leave.show_on_calendar
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            ON
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Mobile Approval Action Buttons */}
                    {leave.status === 'pending' && (
                      <div className="flex flex-col xs:flex-row gap-1.5 pt-2 border-t border-slate-100">
                        <Button
                          size="sm"
                          variant="danger"
                          className="w-full text-xs"
                          onClick={() => handleOpenReject(leave.id)}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-xs"
                          isLoading={isProcessing}
                          onClick={() => handleApprove(leave.id, leave.user?.full_name || 'Employee', false)}
                        >
                          Approve (Hidden)
                        </Button>
                        <Button
                          size="sm"
                          variant="success"
                          className="w-full text-xs"
                          isLoading={isProcessing}
                          onClick={() => handleApprove(leave.id, leave.user?.full_name || 'Employee', true)}
                        >
                          Approve + Show
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {/* Reject Reason Modal */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject Leave Request"
        subtitle="Provide a reason for the employee"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Rejection Reason
            </label>
            <input
              type="text"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Critical release sprint..."
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-red-500 outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setRejectModalOpen(false)}>
              Back
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={isProcessing}
              onClick={handleConfirmReject}
            >
              Confirm Rejection
            </Button>
          </div>
        </div>
      </Modal>

      {/* Inspect Leave Details Modal */}
      {selectedLeave && (
        <Modal
          isOpen={Boolean(selectedLeave)}
          onClose={() => setSelectedLeave(null)}
          title="Leave Application Details"
          subtitle={`Submitted by ${selectedLeave.user?.full_name}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <p className="font-bold text-sm text-slate-900">{selectedLeave.user?.full_name}</p>
                <p className="text-slate-500">{selectedLeave.user?.email}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{selectedLeave.user?.department} • {selectedLeave.user?.designation}</p>
              </div>
              <StatusBadge status={selectedLeave.status} size="md" />
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-white border border-slate-200">
              <div>
                <span className="text-slate-400 font-medium">Leave Type:</span>
                <p className="font-bold text-slate-900 mt-0.5">{selectedLeave.leave_type}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Date Range:</span>
                <p className="font-bold text-slate-900 mt-0.5">
                  {formatDateRange(selectedLeave.start_date, selectedLeave.end_date)}
                </p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Leave Days:</span>
                <p className="font-bold text-slate-900 mt-0.5">
                  {calculateDaysCount(selectedLeave.start_date, selectedLeave.end_date)} {calculateDaysCount(selectedLeave.start_date, selectedLeave.end_date) === 1 ? 'Day' : 'Days'}
                </p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Show on Calendar:</span>
                <p className={`font-bold mt-0.5 ${selectedLeave.show_on_calendar ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {selectedLeave.show_on_calendar ? 'ON (Visible)' : 'OFF (Hidden)'}
                </p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Created Date:</span>
                <p className="font-bold text-slate-700 mt-0.5">
                  {selectedLeave.created_at ? formatDisplayDate(selectedLeave.created_at.substring(0, 10)) : '—'}
                </p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Updated Date:</span>
                <p className="font-bold text-slate-700 mt-0.5">
                  {selectedLeave.updated_at ? formatDisplayDate(selectedLeave.updated_at.substring(0, 10)) : (selectedLeave.created_at ? formatDisplayDate(selectedLeave.created_at.substring(0, 10)) : '—')}
                </p>
              </div>
            </div>

            <div>
              <span className="font-semibold text-slate-700 uppercase tracking-wider block mb-1">
                Private Leave Reason (Admin View):
              </span>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 leading-relaxed text-slate-800">
                {selectedLeave.reason}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              {selectedLeave.status === 'pending' && (
                <>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleOpenReject(selectedLeave.id)}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    isLoading={isProcessing}
                    onClick={() =>
                      handleApprove(selectedLeave.id, selectedLeave.user?.full_name || 'Employee', false)
                    }
                  >
                    Approve (Hidden)
                  </Button>
                  <Button
                    variant="success"
                    size="sm"
                    isLoading={isProcessing}
                    onClick={() =>
                      handleApprove(selectedLeave.id, selectedLeave.user?.full_name || 'Employee', true)
                    }
                  >
                    Approve + Show on Calendar
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" onClick={() => setSelectedLeave(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
