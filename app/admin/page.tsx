'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/lib/auth/auth-context';
import { getDashboardKPIs, approveLeave, rejectLeave, subscribeToStore } from '@/lib/data/store';
import { formatDisplayDate, formatDateRange, calculateDaysCount } from '@/lib/utils/date-utils';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import {
  ShieldCheck,
  Users,
  Clock,
  CalendarCheck2,
  Flag,
  CheckCircle2,
  XCircle,
  ArrowRight,
  User,
  AlertTriangle,
  Megaphone,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const { user, isAdmin, isLoading } = useAuth();
  const router = useRouter();
  const { success, error: toastError } = useToast();

  const [kpiData, setKpiData] = useState<any>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const reloadData = () => {
    setKpiData(getDashboardKPIs('2026-10-01'));
  };

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) {
      router.push('/calendar');
    } else {
      reloadData();
    }
    const unsub = subscribeToStore(reloadData);
    return unsub;
  }, [user, isAdmin, isLoading, router]);

  if (isLoading || !user || !isAdmin || !kpiData) {
    return null;
  }

  const handleApprove = async (leaveId: string, empName: string, showOnCal: boolean = false) => {
    setProcessingId(leaveId);
    try {
      const res = await approveLeave(leaveId, user.id, showOnCal);
      if (res.success) {
        success(`Leave request for ${empName} approved.${showOnCal ? ' Marked visible on calendar.' : ' Kept private.'}`, 'Approved');
        reloadData();
      } else {
        toastError(res.message);
      }
    } catch {
      toastError('Failed to approve leave.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (leaveId: string, empName: string) => {
    const reason = prompt('Please specify a rejection reason (optional):', 'Operational commitments');
    if (reason === null) return;
    setProcessingId(leaveId);
    try {
      const res = await rejectLeave(leaveId, user.id, reason);
      if (res.success) {
        success(`Leave request for ${empName} rejected.`, 'Rejected');
        reloadData();
      } else {
        toastError(res.message);
      }
    } catch {
      toastError('Failed to reject leave.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <AppLayout showRightPanel={false}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Admin Control Dashboard
              </h1>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                Executive Access
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Welcome, {user.full_name}. Real-time staff availability, pending leave requests, and calendar mentions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/admin/leave-requests">
              <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                All Requests ({kpiData.pendingRequestsCount})
              </Button>
            </Link>
          </div>
        </div>

        {/* 4 Dashboard Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 bg-white border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Total Employees
              </span>
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-slate-900 mt-2">{kpiData.totalEmployees}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Active team members</p>
          </Card>

          <Card className="p-4 bg-white border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                On Leave Today
              </span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <CalendarCheck2 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-emerald-700 mt-2">{kpiData.onLeaveTodayCount}</p>
            <p className="text-[11px] text-emerald-600 mt-0.5">
              {kpiData.onLeaveTodayCount > 0 ? 'Visible on calendar' : 'Full team available'}
            </p>
          </Card>

          <Card className="p-4 bg-white border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                Pending Requests
              </span>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-amber-700 mt-2">{kpiData.pendingRequestsCount}</p>
            <p className="text-[11px] text-amber-600 mt-0.5">Hidden until approved</p>
          </Card>

          <Card className="p-4 bg-white border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">
                Govt Holidays
              </span>
              <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                <Flag className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-rose-700 mt-2">{kpiData.upcomingHolidaysCount}</p>
            <p className="text-[11px] text-rose-600 mt-0.5">Scheduled in 2026–2027</p>
          </Card>
        </div>

        {/* Pending Requests Section */}
        <Card className="border border-slate-200 overflow-hidden">
          <CardHeader
            title="Pending Leave Approvals"
            subtitle="Leaves remain hidden from shared calendar until approved and marked visible"
            action={
              <Link href="/admin/leave-requests" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                View All Requests →
              </Link>
            }
          />
          <div className="overflow-x-auto">
            {kpiData.pendingRequestsList.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                ✨ No pending leave requests. Everything is up to date!
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4 sm:px-6">Employee</th>
                    <th className="py-3 px-4 sm:px-6">Leave Type</th>
                    <th className="py-3 px-4 sm:px-6">Date Range</th>
                    <th className="py-3 px-4 sm:px-6">Reason (Admin View)</th>
                    <th className="py-3 px-4 sm:px-6 text-right">Approval Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {kpiData.pendingRequestsList.map((req: any) => {
                    return (
                      <tr key={req.id} className="hover:bg-amber-50/20 transition-colors">
                        <td className="py-3.5 px-4 sm:px-6 font-bold text-slate-900">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                              {req.user?.full_name[0]}
                            </div>
                            <div>
                              <p>{req.user?.full_name}</p>
                              <p className="text-[10px] text-slate-400 font-normal">{req.user?.department}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 font-semibold text-slate-800">
                          {req.leave_type}
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-slate-700">
                          <p className="font-semibold">{formatDateRange(req.start_date, req.end_date)}</p>
                          <span className="text-[10px] text-slate-400">
                            {calculateDaysCount(req.start_date, req.end_date)} days
                          </span>
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-slate-600 max-w-xs">
                          <p className="truncate" title={req.reason}>
                            {req.reason}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={processingId === req.id}
                              onClick={() => handleReject(req.id, req.user?.full_name)}
                            >
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={processingId === req.id}
                              onClick={() => handleApprove(req.id, req.user?.full_name, false)}
                              title="Approve but keep hidden"
                            >
                              Approve (Hidden)
                            </Button>
                            <Button
                              size="sm"
                              variant="success"
                              isLoading={processingId === req.id}
                              onClick={() => handleApprove(req.id, req.user?.full_name, true)}
                              title="Approve and show on shared calendar"
                            >
                              Approve + Show
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        {/* 2 Column Lower Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Today's Leave */}
          <Card className="border border-slate-200">
            <CardHeader
              title="Today's On-Leave Staff"
              subtitle="Visible on company calendar"
            />
            <CardContent>
              {kpiData.onLeaveTodayList.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs border border-dashed rounded-xl">
                  No employees are on visible leave today.
                </div>
              ) : (
                <div className="space-y-2">
                  {kpiData.onLeaveTodayList.map((l: any) => (
                    <div
                      key={l.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                          {l.user?.full_name[0]}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{l.user?.full_name}</p>
                          <p className="text-[10px] text-slate-500">{l.leave_type}</p>
                        </div>
                      </div>
                      <Badge variant="approved" size="sm">
                        On Leave Today
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Holidays & Mentions */}
          <Card className="border border-slate-200">
            <CardHeader
              title="Upcoming Holidays & Notices"
              subtitle="Soft Red Holidays and Indigo Mentions"
              action={
                <Link href="/admin/holidays" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                  Manage Holidays →
                </Link>
              }
            />
            <CardContent>
              <div className="space-y-2.5">
                {kpiData.upcomingMentionsList.map((m: any) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-indigo-50/50 border border-indigo-100 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                        <Megaphone className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{m.title}</p>
                        <p className="text-[11px] text-indigo-600">{formatDisplayDate(m.start_date)} • {m.event_type}</p>
                      </div>
                    </div>
                    <Badge variant="primary" size="sm">
                      Notice
                    </Badge>
                  </div>
                ))}

                {kpiData.upcomingHolidaysList.map((h: any) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-rose-50/50 border border-rose-100 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#FEE2E2] text-rose-700 border border-rose-200 flex items-center justify-center font-bold">
                        <Flag className="w-4 h-4 text-[#B91C1C]" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{h.name}</p>
                        <p className="text-[11px] text-slate-500">{formatDisplayDate(h.date)}</p>
                      </div>
                    </div>
                    <Badge variant="holiday" size="sm">
                      Soft Red Holiday
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
