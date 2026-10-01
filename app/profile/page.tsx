'use client';

import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { User, Mail, Phone, Building, Briefcase, Calendar, ShieldCheck, HeartPulse, Sparkles } from 'lucide-react';
import { getLeaves } from '@/lib/data/store';
import { calculateDaysCount } from '@/lib/utils/date-utils';

export default function ProfilePage() {
  const { user, isAdmin } = useAuth();
  const allLeaves = getLeaves();
  const myLeaves = user ? allLeaves.filter((l) => l.user_id === user.id && l.status === 'approved') : [];

  const casualUsed = myLeaves
    .filter((l) => l.leave_type === 'Casual Leave')
    .reduce((sum, l) => sum + calculateDaysCount(l.start_date, l.end_date), 0);

  const sickUsed = myLeaves
    .filter((l) => l.leave_type === 'Sick Leave')
    .reduce((sum, l) => sum + calculateDaysCount(l.start_date, l.end_date), 0);

  const personalUsed = myLeaves
    .filter((l) => l.leave_type === 'Personal Leave')
    .reduce((sum, l) => sum + calculateDaysCount(l.start_date, l.end_date), 0);

  const emergencyUsed = myLeaves
    .filter((l) => l.leave_type === 'Emergency Leave')
    .reduce((sum, l) => sum + calculateDaysCount(l.start_date, l.end_date), 0);

  const leaveQuotas = [
    {
      title: 'Casual Leave (CL)',
      total: 12,
      used: casualUsed,
      color: 'blue',
      bg: 'bg-blue-50 border-blue-200 text-blue-900',
      bar: 'bg-blue-600',
    },
    {
      title: 'Sick Leave (SL)',
      total: 10,
      used: sickUsed,
      color: 'emerald',
      bg: 'bg-emerald-50 border-emerald-200 text-emerald-900',
      bar: 'bg-emerald-600',
    },
    {
      title: 'Personal Leave (PL)',
      total: 6,
      used: personalUsed,
      color: 'purple',
      bg: 'bg-purple-50 border-purple-200 text-purple-900',
      bar: 'bg-purple-600',
    },
    {
      title: 'Emergency Leave (EL)',
      total: 4,
      used: emergencyUsed,
      color: 'amber',
      bg: 'bg-amber-50 border-amber-200 text-amber-900',
      bar: 'bg-amber-600',
    },
  ];

  return (
    <AppLayout showRightPanel={false}>
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Employee Profile & Annual Leave Quotas
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Manage your personal workplace information and track your remaining leave balance for 2026–2027.
          </p>
        </div>

        {/* Profile Card */}
        <Card className="border border-slate-200 overflow-hidden">
          <div className="p-6 bg-gradient-to-r from-blue-900 to-indigo-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-center font-bold text-2xl shadow-lg">
                {user?.full_name ? user.full_name[0] : 'U'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold">{user?.full_name}</h2>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-white/20 text-white">
                    {user?.role}
                  </span>
                </div>
                <p className="text-xs text-blue-200 font-medium mt-0.5">{user?.designation}</p>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-xs text-blue-200">Department</span>
              <p className="font-bold text-sm text-white">{user?.department}</p>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <Mail className="w-4 h-4 text-blue-600" />
              <div>
                <span className="text-[10px] uppercase text-slate-400 font-bold block">Email</span>
                <span className="font-semibold text-slate-800">{user?.email}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <Phone className="w-4 h-4 text-emerald-600" />
              <div>
                <span className="text-[10px] uppercase text-slate-400 font-bold block">Mobile</span>
                <span className="font-semibold text-slate-800">{user?.phone || '+91 98400 00000'}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <Building className="w-4 h-4 text-purple-600" />
              <div>
                <span className="text-[10px] uppercase text-slate-400 font-bold block">Office Location</span>
                <span className="font-semibold text-slate-800">Chennai HQ, Tamil Nadu</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Leave Quota Cards */}
        <div>
          <h3 className="text-base font-bold text-slate-900 mb-3">
            Annual Leave Entitlements & Consumption (2026–2027)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {leaveQuotas.map((quota) => {
              const remaining = Math.max(0, quota.total - quota.used);
              const percentUsed = Math.min(100, Math.round((quota.used / quota.total) * 100));

              return (
                <Card key={quota.title} className="p-5 border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700">{quota.title}</span>
                    <span className="text-xs font-extrabold text-slate-900">
                      {remaining} Left
                    </span>
                  </div>

                  <div className="flex items-baseline gap-1 my-2">
                    <span className="text-2xl font-extrabold text-slate-900">{quota.used}</span>
                    <span className="text-xs text-slate-400">/ {quota.total} days consumed</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-3">
                    <div
                      className={`h-full ${quota.bar} rounded-full transition-all duration-500`}
                      style={{ width: `${percentUsed}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400 font-semibold">
                    <span>Used: {percentUsed}%</span>
                    <span>Total: {quota.total}d</span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
