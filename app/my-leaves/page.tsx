'use client';

import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/lib/auth/auth-context';
import { getLeaves, cancelLeave, subscribeToStore } from '@/lib/data/store';
import { LeaveRequest } from '@/types';
import { formatDisplayDate, formatDateRange, calculateDaysCount } from '@/lib/utils/date-utils';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
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
  Lock,
  Filter,
} from 'lucide-react';

export default function MyLeavesPage() {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();

  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const reloadLeaves = React.useCallback(() => {
    if (!user) return;
    const all = getLeaves();
    const myOwn = all.filter((l) => l.user_id === user.id);
    setLeaves(myOwn);
  }, [user]);

  useEffect(() => {
    reloadLeaves();
    const unsub = subscribeToStore(reloadLeaves);
    return unsub;
  }, [reloadLeaves]);

  const handleCancel = async (leaveId: string) => {
    if (!user) return;
    if (confirm('Are you sure you want to cancel this pending leave request?')) {
      setCancellingId(leaveId);
      try {
        const res = await cancelLeave(leaveId, user.id);
        if (res.success) {
          success(res.message, 'Leave Cancelled');
          reloadLeaves();
        } else {
          toastError(res.message);
        }
      } catch {
        toastError('Failed to cancel leave.');
      } finally {
        setCancellingId(null);
      }
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
              View your time-off history, pending approval status, and submit new leave requests.
            </p>
          </div>

          <Button
            variant="primary"
            onClick={() => setIsApplyModalOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
            className="shadow-sm self-start sm:self-auto"
          >
            Apply For Leave
          </Button>
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
            <p className="text-[11px] text-emerald-600 mt-0.5">Confirmed on calendar</p>
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
            <p className="text-[11px] text-amber-600 mt-0.5">Awaiting manager review</p>
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
              <p className="text-xs text-slate-500">Full audit record of your submitted requests</p>
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

          <div className="overflow-x-auto">
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
                          {leave.status === 'pending' ? (
                            <button
                              onClick={() => handleCancel(leave.id)}
                              disabled={cancellingId === leave.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Cancel</span>
                            </button>
                          ) : (
                            <span className="text-slate-400 font-medium text-[11px]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>

      <ApplyLeaveModal
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
        onSuccess={reloadLeaves}
      />
    </AppLayout>
  );
}
