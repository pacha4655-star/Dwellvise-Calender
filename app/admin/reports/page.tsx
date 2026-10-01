'use client';

import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/lib/auth/auth-context';
import { getReportsData, subscribeToStore } from '@/lib/data/store';
import { ReportSummary } from '@/types';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  BarChart3,
  Download,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  FileSpreadsheet,
  TrendingUp,
} from 'lucide-react';

export default function AdminReportsPage() {
  const { user, isAdmin } = useAuth();
  const [report, setReport] = useState<ReportSummary | null>(null);

  const loadData = () => {
    setReport(getReportsData());
  };

  useEffect(() => {
    loadData();
    const unsub = subscribeToStore(loadData);
    return unsub;
  }, []);

  if (!report) return null;

  const handleExportCSV = () => {
    const headers = ['Employee Name', 'Department', 'Role', 'Total Requests', 'Approved', 'Pending', 'Rejected', 'Days Consumed'];
    const rows = report.employeeStats.map((stat) => [
      `"${stat.user.full_name}"`,
      `"${stat.user.department}"`,
      `"${stat.user.role}"`,
      stat.totalLeaves,
      stat.approved,
      stat.pending,
      stat.rejected,
      stat.daysTaken,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `officeflow_leave_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AppLayout showRightPanel={false}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Leave Analytics & Reports
              </h1>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                Audit Summary
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Comprehensive report on employee attendance, leave balances, and monthly trends across 2026–2027.
            </p>
          </div>

          <Button
            variant="outline"
            onClick={handleExportCSV}
            leftIcon={<Download className="w-4 h-4" />}
            className="shadow-sm self-start sm:self-auto"
          >
            Export CSV Report
          </Button>
        </div>

        {/* Aggregate KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 bg-white border border-slate-200">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Applications
            </span>
            <p className="text-2xl font-extrabold text-slate-900 mt-2">
              {report.totalLeaveRequests}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Submitted by 4 employees</p>
          </Card>

          <Card className="p-4 bg-white border border-slate-200">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
              Approved Leaves
            </span>
            <p className="text-2xl font-extrabold text-emerald-700 mt-2">
              {report.approvedCount}
            </p>
            <p className="text-[11px] text-emerald-600 mt-0.5">
              {report.totalLeaveRequests > 0
                ? `${Math.round((report.approvedCount / report.totalLeaveRequests) * 100)}% approval rate`
                : '100%'}
            </p>
          </Card>

          <Card className="p-4 bg-white border border-slate-200">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
              Pending Decisions
            </span>
            <p className="text-2xl font-extrabold text-amber-700 mt-2">
              {report.pendingCount}
            </p>
            <p className="text-[11px] text-amber-600 mt-0.5">Awaiting Manager review</p>
          </Card>

          <Card className="p-4 bg-white border border-slate-200">
            <span className="text-xs font-bold text-red-700 uppercase tracking-wider">
              Rejected Requests
            </span>
            <p className="text-2xl font-extrabold text-red-700 mt-2">
              {report.rejectedCount}
            </p>
            <p className="text-[11px] text-red-600 mt-0.5">Declined applications</p>
          </Card>
        </div>

        {/* Employee Breakdown Table */}
        <Card className="border border-slate-200 overflow-hidden">
          <CardHeader
            title="Leave Breakdown by Employee"
            subtitle="Individual attendance and time-off consumption"
          />
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4 sm:px-6">Employee</th>
                  <th className="py-3.5 px-4 sm:px-6">Department</th>
                  <th className="py-3.5 px-4 sm:px-6 text-center">Total Submitted</th>
                  <th className="py-3.5 px-4 sm:px-6 text-center text-emerald-700">Approved</th>
                  <th className="py-3.5 px-4 sm:px-6 text-center text-amber-700">Pending</th>
                  <th className="py-3.5 px-4 sm:px-6 text-center text-red-700">Rejected</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right font-bold text-slate-900">
                    Days Taken
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.employeeStats.map((stat) => (
                  <tr key={stat.user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-4 sm:px-6 font-bold text-slate-900">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                          {stat.user.full_name[0]}
                        </div>
                        <div>
                          <p>{stat.user.full_name}</p>
                          <p className="text-[10px] text-slate-400 capitalize">{stat.user.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 sm:px-6 text-slate-600">{stat.user.department}</td>
                    <td className="py-4 px-4 sm:px-6 text-center font-semibold">{stat.totalLeaves}</td>
                    <td className="py-4 px-4 sm:px-6 text-center font-bold text-emerald-600">
                      {stat.approved}
                    </td>
                    <td className="py-4 px-4 sm:px-6 text-center font-bold text-amber-600">
                      {stat.pending}
                    </td>
                    <td className="py-4 px-4 sm:px-6 text-center font-bold text-red-600">
                      {stat.rejected}
                    </td>
                    <td className="py-4 px-4 sm:px-6 text-right font-extrabold text-slate-900">
                      {stat.daysTaken} {stat.daysTaken === 1 ? 'day' : 'days'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Monthly Trend Summary Table */}
        <Card className="border border-slate-200 overflow-hidden">
          <CardHeader
            title="Monthly Leave & Holiday Distribution (Oct 2026 – Dec 2027)"
            subtitle="15-Month operational overview"
          />
          <div className="p-4 sm:p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
            {report.monthlyStats.map((m) => (
              <div
                key={m.monthKey}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5"
              >
                <p className="font-bold text-slate-800 text-xs">{m.monthName}</p>
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60">
                  <span className="text-slate-500">Approved Leaves:</span>
                  <span className="font-bold text-blue-700">{m.leaveCount}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Govt Holidays:</span>
                  <span className="font-bold text-rose-700">{m.holidayCount}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
