'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/lib/auth/auth-context';
import {
  getLeaves,
  cancelLeave,
  deleteLeave,
  getUserById,
  subscribeToStore,
  syncDatabaseWithSupabase,
} from '@/lib/data/store';
import { LeaveRequest } from '@/types';
import { formatDisplayDate, formatDateRange, calculateDaysCount } from '@/lib/utils/date-utils';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { ApplyLeaveModal } from '@/components/calendar/ApplyLeaveModal';
import { useToast } from '@/components/ui/Toast';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Plus,
  Calendar,
  Trash2,
  Ban,
  Filter,
  RefreshCw,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

export default function MyLeavesPage() {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();

  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Cancellation Modal State
  const [cancelModalLeave, setCancelModalLeave] = useState<LeaveRequest | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Deletion Modal State
  const [deleteModalLeave, setDeleteModalLeave] = useState<LeaveRequest | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const reloadLeaves = useCallback(() => {
    if (!user) return;
    const all = getLeaves();
    const userEmail = (user.email || '').toLowerCase().trim();
    const myOwn = all.filter((l) => {
      if (l.user_id === user.id) return true;
      if (user.auth_user_id && l.user_id === user.auth_user_id) return true;
      if (user.id && l.user?.auth_user_id === user.id) return true;
      if (userEmail && l.user?.email && (l.user.email || '').toLowerCase().trim() === userEmail) return true;
      const leaveUser = l.user || getUserById(l.user_id);
      if (leaveUser && userEmail && leaveUser.email && leaveUser.email.toLowerCase().trim() === userEmail) return true;
      return false;
    });
    setLeaves(myOwn);
  }, [user]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncDatabaseWithSupabase();
      reloadLeaves();
      success('Leave history synchronized with cloud database.', 'Synced');
    } catch {
      toastError('Failed to refresh data from cloud.');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    reloadLeaves();
    setIsSyncing(true);
    syncDatabaseWithSupabase()
      .then(() => reloadLeaves())
      .finally(() => setIsSyncing(false));

    const unsub = subscribeToStore(reloadLeaves);
    return unsub;
  }, [reloadLeaves]);

  // Execute Cancel Request
  const handleConfirmCancel = async () => {
    if (!user || !cancelModalLeave) return;
    setIsCancelling(true);
    try {
      const res = await cancelLeave(cancelModalLeave.id, user.id);
      if (res.success) {
        success(res.message, 'Leave Request Cancelled');
        setCancelModalLeave(null);
        reloadLeaves();
      } else {
        toastError(res.message);
      }
    } catch {
      toastError('Failed to cancel leave request.');
    } finally {
      setIsCancelling(false);
    }
  };

  // Execute Delete Request
  const handleConfirmDelete = async () => {
    if (!user || !deleteModalLeave) return;
    setIsDeleting(true);
    try {
      const res = await deleteLeave(deleteModalLeave.id, user.id);
      if (res.success) {
        success(res.message, 'Leave Record Deleted');
        setDeleteModalLeave(null);
        reloadLeaves();
      } else {
        toastError(res.message);
      }
    } catch {
      toastError('Failed to delete leave record.');
    } finally {
      setIsDeleting(false);
    }
  };

  const totalRequests = leaves.length;
  const approvedLeaves = leaves.filter((l) => l.status === 'approved');
  const pendingLeaves = leaves.filter((l) => l.status === 'pending');
  const rejectedLeaves = leaves.filter((l) => l.status === 'rejected');

  const filteredLeaves = leaves.filter((l) => {
    if (filterStatus === 'all') return true;
    return l.status === filterStatus;
  });

  return (
    <AppLayout showRightPanel={false}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              My Leaves & Applications
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              View your time-off history, manage pending applications, and submit new leave requests.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={isSyncing}
              leftIcon={
                isSyncing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )
              }
              className="text-xs font-semibold"
            >
              {isSyncing ? 'Syncing...' : 'Sync Cloud'}
            </Button>

            <Button
              variant="primary"
              onClick={() => setIsApplyModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
              className="shadow-sm"
            >
              Apply For Leave
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 bg-white border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Total Requests
              </span>
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-slate-900 mt-2">{totalRequests}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">All time applications</p>
          </Card>

          <Card className="p-4 bg-white border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                Approved
              </span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-emerald-700 mt-2">{approvedLeaves.length}</p>
            <p className="text-[11px] text-emerald-600 mt-0.5">Confirmed time off</p>
          </Card>

          <Card className="p-4 bg-white border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                Pending
              </span>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-amber-700 mt-2">{pendingLeaves.length}</p>
            <p className="text-[11px] text-amber-600 mt-0.5">Awaiting management review</p>
          </Card>

          <Card className="p-4 bg-white border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-red-700 uppercase tracking-wider">
                Rejected
              </span>
              <div className="p-2 rounded-xl bg-red-50 text-red-600">
                <XCircle className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-red-700 mt-2">{rejectedLeaves.length}</p>
            <p className="text-[11px] text-red-600 mt-0.5">Not approved</p>
          </Card>
        </div>

        {/* Leave Requests Table */}
        <Card className="overflow-hidden border border-slate-200">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <h3 className="text-base font-bold text-slate-900">Leave History & Records</h3>
              <p className="text-xs text-slate-500">Manage your submitted leave requests and track status</p>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-white border border-slate-200 text-xs rounded-xl px-3 py-1.5 font-medium text-slate-700 outline-none focus:border-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto">
            {filteredLeaves.length === 0 ? (
              <EmptyState
                title="No leave requests found"
                description="You have not submitted any leave requests matching the selected filter."
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsApplyModalOpen(true)}
                  >
                    Apply for Time Off
                  </Button>
                }
              />
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-4 sm:px-6">Leave Type</th>
                    <th className="py-3.5 px-4 sm:px-6">Dates & Duration</th>
                    <th className="py-3.5 px-4 sm:px-6">Reason (Private)</th>
                    <th className="py-3.5 px-4 sm:px-6">Status</th>
                    <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLeaves.map((leave) => {
                    const days = calculateDaysCount(leave.start_date, leave.end_date);
                    return (
                      <tr key={leave.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-4 px-4 sm:px-6 font-semibold text-slate-900">
                          {leave.leave_type}
                        </td>
                        <td className="py-4 px-4 sm:px-6 text-slate-700">
                          <p className="font-semibold">{formatDateRange(leave.start_date, leave.end_date)}</p>
                          <span className="text-[11px] text-slate-400 font-normal">
                            {days} {days === 1 ? 'day' : 'days'}
                          </span>
                        </td>
                        <td className="py-4 px-4 sm:px-6 max-w-xs text-slate-600">
                          <p className="truncate" title={leave.reason}>
                            {leave.reason}
                          </p>
                        </td>
                        <td className="py-4 px-4 sm:px-6">
                          <StatusBadge status={leave.status} />
                        </td>
                        <td className="py-4 px-4 sm:px-6 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {leave.status === 'pending' && (
                              <button
                                onClick={() => setCancelModalLeave(leave)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
                                title="Cancel pending application"
                              >
                                <Ban className="w-3.5 h-3.5" />
                                <span>Cancel</span>
                              </button>
                            )}

                            {(leave.status === 'cancelled' || leave.status === 'rejected' || leave.status === 'pending') && (
                              <button
                                onClick={() => setDeleteModalLeave(leave)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                                title="Delete leave record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </button>
                            )}

                            {leave.status === 'approved' && (
                              <span className="text-slate-400 font-medium text-[11px]">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Mobile Card View (< 640px) */}
          <div className="sm:hidden p-3 space-y-3">
            {filteredLeaves.length === 0 ? (
              <EmptyState
                title="No leave requests found"
                description="You have not submitted any leave requests matching the selected filter."
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsApplyModalOpen(true)}
                  >
                    Apply for Time Off
                  </Button>
                }
              />
            ) : (
              filteredLeaves.map((leave) => {
                const days = calculateDaysCount(leave.start_date, leave.end_date);
                return (
                  <div
                    key={leave.id}
                    className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2.5 shadow-subtle"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">{leave.leave_type}</h4>
                        <p className="text-xs text-slate-600 font-medium mt-0.5">
                          {formatDateRange(leave.start_date, leave.end_date)}
                        </p>
                      </div>
                      <StatusBadge status={leave.status} size="sm" />
                    </div>

                    {leave.reason && (
                      <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg line-clamp-2">
                        {leave.reason}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                      <span className="text-slate-500 font-medium">
                        Duration: <strong className="text-slate-900">{days} {days === 1 ? 'day' : 'days'}</strong>
                      </span>

                      <div className="flex items-center gap-1.5">
                        {leave.status === 'pending' && (
                          <button
                            onClick={() => setCancelModalLeave(leave)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>Cancel</span>
                          </button>
                        )}

                        {(leave.status === 'cancelled' || leave.status === 'rejected' || leave.status === 'pending') && (
                          <button
                            onClick={() => setDeleteModalLeave(leave)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {/* Apply Leave Modal */}
      <ApplyLeaveModal
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
        onSuccess={reloadLeaves}
      />

      {/* Cancel Confirmation Modal */}
      {cancelModalLeave && (
        <Modal
          isOpen={true}
          onClose={() => setCancelModalLeave(null)}
          title="Cancel Leave Request"
          subtitle="Are you sure you want to cancel this pending application?"
          maxWidth="sm"
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Confirm Cancellation</p>
                <p className="mt-0.5 text-amber-800">
                  This will change the status of your <strong>{cancelModalLeave.leave_type}</strong> for{' '}
                  <strong>{formatDateRange(cancelModalLeave.start_date, cancelModalLeave.end_date)}</strong> to cancelled and remove it from the management approval queue.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCancelModalLeave(null)}
                disabled={isCancelling}
              >
                Keep Request
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmCancel}
                disabled={isCancelling}
                leftIcon={isCancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
              >
                {isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalLeave && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteModalLeave(null)}
          title="Delete Leave Record"
          subtitle="Permanently remove this leave record from your history"
          maxWidth="sm"
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Permanent Deletion</p>
                <p className="mt-0.5 text-red-800">
                  Are you sure you want to permanently delete this <strong>{deleteModalLeave.leave_type}</strong> record ({formatDateRange(deleteModalLeave.start_date, deleteModalLeave.end_date)})? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteModalLeave(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                leftIcon={isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
