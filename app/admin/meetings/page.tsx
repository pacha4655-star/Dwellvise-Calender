'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/lib/auth/auth-context';
import {
  getMeetingSchedules,
  updateMeetingSchedule,
  toggleMeetingScheduleActive,
  getAllCalculatedMeetingOccurrences,
  subscribeToStore,
} from '@/lib/data/store';
import { MeetingSchedule, MeetingType, CalculatedMeetingOccurrence } from '@/types';
import { formatDisplayDate } from '@/lib/utils/date-utils';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import {
  CalendarCheck2,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Edit2,
  PauseCircle,
  PlayCircle,
  ShieldCheck,
  Info,
  ChevronRight,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

export default function AdminMeetingsPage() {
  const { user, isAdmin, isLoading } = useAuth();
  const router = useRouter();
  const { success, error: toastError } = useToast();

  const [schedules, setSchedules] = useState<MeetingSchedule[]>([]);
  const [occurrences, setOccurrences] = useState<CalculatedMeetingOccurrence[]>([]);
  const [editingSchedule, setEditingSchedule] = useState<MeetingSchedule | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form edit state
  const [title, setTitle] = useState('');
  const [firstDate, setFirstDate] = useState('');
  const [time, setTime] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  const loadData = () => {
    const list = getMeetingSchedules();
    setSchedules(list);
    setOccurrences(getAllCalculatedMeetingOccurrences('2026-10-01', '2027-12-31'));
  };

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) {
      router.push('/calendar');
    } else {
      loadData();
    }
    const unsub = subscribeToStore(loadData);
    return unsub;
  }, [user, isAdmin, isLoading, router]);

  if (isLoading || !user || !isAdmin) {
    return null;
  }

  const tacticalSchedule = schedules.find((s) => s.meeting_type === 'tactical');
  const strategicSchedule = schedules.find((s) => s.meeting_type === 'strategic');

  const tacticalOccurrences = occurrences.filter((o) => o.meeting_type === 'tactical');
  const strategicOccurrences = occurrences.filter((o) => o.meeting_type === 'strategic');

  const handleOpenEdit = (schedule: MeetingSchedule) => {
    setEditingSchedule(schedule);
    setTitle(schedule.title);
    setFirstDate(schedule.first_meeting_date);
    setTime(schedule.meeting_time || '10:00 AM - 11:00 AM');
    setDescription(schedule.description || '');
    setIsActive(schedule.is_active);
    setIsEditModalOpen(true);
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchedule) return;

    if (!firstDate) {
      toastError('First meeting date is required.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await updateMeetingSchedule(editingSchedule.meeting_type, {
        title: title.trim() || (editingSchedule.meeting_type === 'tactical' ? 'Tactical Meeting' : 'Strategic Meeting'),
        first_meeting_date: firstDate,
        meeting_time: time.trim(),
        description: description.trim(),
        is_active: isActive,
      });

      if (res.success) {
        success(res.message, 'Schedule Saved');
        setIsEditModalOpen(false);
        loadData();
      } else {
        toastError(res.message);
      }
    } catch {
      toastError('Failed to update meeting schedule.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (type: MeetingType) => {
    try {
      const res = await toggleMeetingScheduleActive(type);
      if (res.success) {
        success(res.message, 'Status Updated');
        loadData();
      } else {
        toastError(res.message);
      }
    } catch {
      toastError('Failed to toggle schedule status.');
    }
  };

  return (
    <AppLayout showRightPanel={false}>
      <div className="space-y-6 max-w-7xl mx-auto px-1 sm:px-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/20">
                <CalendarCheck2 className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                Recurring Meeting Schedules
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                Admin Control
              </span>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              Manage Tactical (14-day) and Strategic (45-day) recurring cadence with automated Sunday and Approved Leave conflict avoidance.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Refresh Cadence
            </Button>
          </div>
        </div>

        {/* Conflict Rules Explanation Banner */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-blue-50/70 border border-blue-200/80 text-blue-950 flex items-start gap-3 text-xs leading-relaxed">
          <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block text-blue-900 mb-0.5">
              Automated Dynamic Scheduling & Conflict Avoidance Rules
            </span>
            <ul className="list-disc list-inside space-y-1 text-blue-800/90 text-[11px] sm:text-xs">
              <li>
                <strong>Sunday Shift:</strong> Meetings calculated on Sunday are automatically moved to the next available working day (Monday).
              </li>
              <li>
                <strong>Approved Leave Shift:</strong> If any employee has an <em>approved</em> leave request on the scheduled date, the meeting moves to the next working day.
              </li>
              <li>
                <strong>Actual-Date Forward Calculation:</strong> Subsequent recurring meeting dates are strictly calculated from the <em>actual resolved date</em> + frequency (14 or 45 days).
              </li>
            </ul>
          </div>
        </div>

        {/* Meeting Schedules Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Tactical Meeting Card */}
          {tacticalSchedule && (
            <Card className="border-sky-200/80 shadow-sm relative overflow-hidden">
              <div className="h-1.5 bg-sky-500 w-full" />
              <div className="p-4 sm:p-5 pb-3 border-b border-slate-100">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-sm">
                      🔵
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{tacticalSchedule.title}</h3>
                      <p className="text-xs text-slate-500">Every 14 Days Cadence</p>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      tacticalSchedule.is_active
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-slate-100 text-slate-600 border-slate-300'
                    }`}
                  >
                    {tacticalSchedule.is_active ? 'Active' : 'Paused'}
                  </span>
                </div>
              </div>
              <CardContent className="space-y-4 pt-1">
                <p className="text-xs text-slate-600 leading-relaxed min-h-[36px]">
                  {tacticalSchedule.description || 'Bi-weekly operational alignment and team priorities sync.'}
                </p>

                <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 font-medium block">First Meeting Date:</span>
                    <span className="font-bold text-slate-800 mt-0.5 block truncate">
                      {formatDisplayDate(tacticalSchedule.first_meeting_date)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium block">Meeting Time:</span>
                    <span className="font-bold text-slate-800 mt-0.5 block truncate">
                      {tacticalSchedule.meeting_time || '10:00 AM - 11:00 AM'}
                    </span>
                  </div>
                </div>

                {/* Next Upcoming Tactical Meeting Preview */}
                {tacticalOccurrences.length > 0 && (
                  <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-sky-900 uppercase tracking-wider">
                        Next Occurrence:
                      </span>
                      <span className="font-extrabold text-sky-950">
                        {formatDisplayDate(tacticalOccurrences[0].actual_date)}
                      </span>
                    </div>
                    {tacticalOccurrences[0].is_shifted && (
                      <p className="text-[11px] text-amber-800 font-medium mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-600 flex-shrink-0" />
                        <span>{tacticalOccurrences[0].shift_reason}</span>
                      </p>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleOpenEdit(tacticalSchedule)}
                    leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                  >
                    Edit Schedule
                  </Button>
                  <Button
                    variant={tacticalSchedule.is_active ? 'outline' : 'primary'}
                    size="sm"
                    onClick={() => handleToggleActive('tactical')}
                    leftIcon={
                      tacticalSchedule.is_active ? (
                        <PauseCircle className="w-3.5 h-3.5" />
                      ) : (
                        <PlayCircle className="w-3.5 h-3.5" />
                      )
                    }
                  >
                    {tacticalSchedule.is_active ? 'Pause' : 'Resume'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Strategic Meeting Card */}
          {strategicSchedule && (
            <Card className="border-purple-200/80 shadow-sm relative overflow-hidden">
              <div className="h-1.5 bg-purple-500 w-full" />
              <div className="p-4 sm:p-5 pb-3 border-b border-slate-100">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm">
                      🟣
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{strategicSchedule.title}</h3>
                      <p className="text-xs text-slate-500">Every 45 Days Cadence</p>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      strategicSchedule.is_active
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-slate-100 text-slate-600 border-slate-300'
                    }`}
                  >
                    {strategicSchedule.is_active ? 'Active' : 'Paused'}
                  </span>
                </div>
              </div>
              <CardContent className="space-y-4 pt-1">
                <p className="text-xs text-slate-600 leading-relaxed min-h-[36px]">
                  {strategicSchedule.description || 'Long-term project milestones, engineering roadmap and strategic review.'}
                </p>

                <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 font-medium block">First Meeting Date:</span>
                    <span className="font-bold text-slate-800 mt-0.5 block truncate">
                      {formatDisplayDate(strategicSchedule.first_meeting_date)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium block">Meeting Time:</span>
                    <span className="font-bold text-slate-800 mt-0.5 block truncate">
                      {strategicSchedule.meeting_time || '02:00 PM - 03:30 PM'}
                    </span>
                  </div>
                </div>

                {/* Next Upcoming Strategic Meeting Preview */}
                {strategicOccurrences.length > 0 && (
                  <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-purple-900 uppercase tracking-wider">
                        Next Occurrence:
                      </span>
                      <span className="font-extrabold text-purple-950">
                        {formatDisplayDate(strategicOccurrences[0].actual_date)}
                      </span>
                    </div>
                    {strategicOccurrences[0].is_shifted && (
                      <p className="text-[11px] text-amber-800 font-medium mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-600 flex-shrink-0" />
                        <span>{strategicOccurrences[0].shift_reason}</span>
                      </p>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleOpenEdit(strategicSchedule)}
                    leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                  >
                    Edit Schedule
                  </Button>
                  <Button
                    variant={strategicSchedule.is_active ? 'outline' : 'primary'}
                    size="sm"
                    onClick={() => handleToggleActive('strategic')}
                    leftIcon={
                      strategicSchedule.is_active ? (
                        <PauseCircle className="w-3.5 h-3.5" />
                      ) : (
                        <PlayCircle className="w-3.5 h-3.5" />
                      )
                    }
                  >
                    {strategicSchedule.is_active ? 'Pause' : 'Resume'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Upcoming Calculated Occurrences Timeline Table */}
        <Card className="border-slate-200 shadow-sm">
          <div className="p-4 sm:p-5 pb-3 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Upcoming Calculated Meeting Cadence Timeline
                </h3>
                <p className="text-xs text-slate-500">
                  Generated sequence of tactical and strategic meetings with Sunday & Approved Leave conflict auditing.
                </p>
              </div>
              <span className="text-xs text-slate-500 font-semibold bg-slate-100 px-2.5 py-1 rounded-lg self-start sm:self-auto">
                {occurrences.length} scheduled occurrences
              </span>
            </div>
          </div>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Cycle</th>
                    <th className="py-3 px-4">Meeting Type</th>
                    <th className="py-3 px-4">Calculated Date</th>
                    <th className="py-3 px-4">Actual Final Date</th>
                    <th className="py-3 px-4">Conflict Resolution & Shift Details</th>
                    <th className="py-3 px-4">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {occurrences.slice(0, 15).map((occ) => {
                    const isTactical = occ.meeting_type === 'tactical';
                    return (
                      <tr key={occ.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-slate-400">
                          #{occ.cycle_index + 1}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                              isTactical
                                ? 'bg-sky-50 text-sky-800 border-sky-200'
                                : 'bg-purple-50 text-purple-800 border-purple-200'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isTactical ? 'bg-sky-600' : 'bg-purple-600'}`} />
                            {occ.title}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-medium">
                          {formatDisplayDate(occ.calculated_date)}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900">
                            {formatDisplayDate(occ.actual_date)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {occ.is_shifted ? (
                            <div className="flex items-center gap-1.5 text-amber-900 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-lg">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                              <span className="text-[11px] font-medium leading-tight">
                                {occ.shift_reason}
                              </span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-700 text-[11px] font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              On Standard Schedule
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-medium">
                          {occ.meeting_time || '10:00 AM'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Edit Schedule Modal */}
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title={`Edit ${editingSchedule?.meeting_type === 'tactical' ? 'Tactical' : 'Strategic'} Meeting Schedule`}
          subtitle="Configure start date, recurring frequency, and meeting specifics"
          maxWidth="md"
        >
          {editingSchedule && (
            <form onSubmit={handleSaveSchedule} className="space-y-4">
              <Input
                label="Meeting Title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={editingSchedule.meeting_type === 'tactical' ? 'Tactical Meeting' : 'Strategic Meeting'}
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="First Meeting Date"
                  type="date"
                  value={firstDate}
                  onChange={(e) => setFirstDate(e.target.value)}
                  required
                />
                <Input
                  label="Meeting Time"
                  type="text"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  placeholder="10:00 AM - 11:00 AM"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Recurring Cadence Frequency
                </label>
                <div className="p-2.5 rounded-xl bg-slate-100 text-xs font-bold text-slate-700">
                  {editingSchedule.meeting_type === 'tactical' ? 'Every 14 Days (Bi-weekly)' : 'Every 45 Days'}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description / Agenda Note
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-slate-800"
                  placeholder="Provide meeting purpose and agenda details..."
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="schedule-active-toggle"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="schedule-active-toggle" className="text-xs font-semibold text-slate-800 cursor-pointer">
                  Active (Generate and display meetings on workspace calendar)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSaving}
                >
                  Save Schedule
                </Button>
              </div>
            </form>
          )}
        </Modal>
      </div>
    </AppLayout>
  );
}
