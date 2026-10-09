'use client';

import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/lib/auth/auth-context';
import { getHolidays, addHoliday, deleteHoliday, subscribeToStore } from '@/lib/data/store';
import { GovernmentHoliday, HolidayType } from '@/types';
import { formatDisplayDate, parseDateKey } from '@/lib/utils/date-utils';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { EventDetailModal } from '@/components/calendar/EventDetailModal';
import { Flag, Calendar, Plus, ListFilter, Trash2, ShieldCheck, Sparkles } from 'lucide-react';

export default function HolidaysPage() {
  const { user, isAdmin } = useAuth();
  const { success, error: toastError } = useToast();

  const [holidays, setHolidays] = useState<GovernmentHoliday[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedHoliday, setSelectedHoliday] = useState<any>(null);

  // New holiday form
  const [name, setName] = useState('');
  const [date, setDate] = useState('2026-10-02');
  const [description, setDescription] = useState('');
  const [holidayType, setHolidayType] = useState<HolidayType>('Government Holiday');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = () => {
    setHolidays(getHolidays());
  };

  useEffect(() => {
    loadData();
    const unsub = subscribeToStore(loadData);
    return unsub;
  }, []);

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !date) return;
    setIsSubmitting(true);
    try {
      const res = await addHoliday({
        name: name.trim(),
        date,
        description: description.trim(),
        holiday_type: holidayType,
        is_mandatory: true,
      });

      if (res.success) {
        success(`Holiday "${name}" added successfully.`, 'Holiday Scheduled');
        setName('');
        setDescription('');
        setIsAddModalOpen(false);
        loadData();
      } else {
        toastError(res.message);
      }
    } catch {
      toastError('Failed to add holiday.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!isAdmin) return;
    if (confirm(`Are you sure you want to delete the holiday "${name}"?`)) {
      const res = await deleteHoliday(id);
      if (res.success) {
        success(res.message, 'Holiday Removed');
        loadData();
      } else {
        toastError(res.message);
      }
    }
  };

  const filteredHolidays = holidays.filter((h) => {
    if (selectedYear === 'all') return true;
    return h.date.startsWith(selectedYear);
  });

  return (
    <AppLayout showRightPanel={true}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Government & Public Holidays
              </h1>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                Official Calendar
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Tamil Nadu State & National Government Holidays for October 2026 – December 2027.
            </p>
          </div>

          {isAdmin && (
            <Button
              variant="primary"
              onClick={() => setIsAddModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
              className="shadow-sm self-start sm:self-auto"
            >
              Add Official Holiday
            </Button>
          )}
        </div>

        {/* Toolbar & Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-subtle">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-500">Filter Year:</span>
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
              {['all', '2026', '2027'].map((yr) => (
                <button
                  key={yr}
                  onClick={() => setSelectedYear(yr)}
                  className={`px-3 py-1 rounded-lg capitalize transition-all ${
                    selectedYear === yr
                      ? 'bg-white text-blue-700 shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {yr === 'all' ? 'All (2026-2027)' : yr}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                viewMode === 'list'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              List View
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                viewMode === 'grid'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Card View
            </button>
          </div>
        </div>

        {/* List View */}
        {viewMode === 'list' ? (
          <Card className="border border-slate-200 overflow-hidden">
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-4 sm:px-6">Date</th>
                    <th className="py-3.5 px-4 sm:px-6">Holiday Name</th>
                    <th className="py-3.5 px-4 sm:px-6">Description</th>
                    <th className="py-3.5 px-4 sm:px-6">Classification</th>
                    {isAdmin && <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHolidays.map((holiday) => {
                    const dateObj = parseDateKey(holiday.date);
                    const dayOfWeek = dateObj.toLocaleDateString('default', { weekday: 'short' });

                    return (
                      <tr
                        key={holiday.id}
                        className="hover:bg-rose-50/30 transition-colors cursor-pointer group"
                        onClick={() =>
                          setSelectedHoliday({
                            id: `event-${holiday.id}`,
                            type: 'holiday',
                            title: holiday.name,
                            startDate: holiday.date,
                            endDate: holiday.date,
                            isHoliday: true,
                            holidayType: holiday.holiday_type,
                            description: holiday.description,
                            rawHoliday: holiday,
                          })
                        }
                      >
                        <td className="py-4 px-4 sm:px-6 font-semibold text-slate-900 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center font-bold text-xs">
                              {dateObj.getDate()}
                            </span>
                            <div>
                              <p className="font-bold">{formatDisplayDate(holiday.date)}</p>
                              <p className="text-[10px] text-slate-400 font-normal">{dayOfWeek}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 sm:px-6 font-bold text-slate-900 group-hover:text-rose-700 transition-colors">
                          {holiday.name}
                        </td>
                        <td className="py-4 px-4 sm:px-6 text-slate-600 max-w-sm">
                          <p className="line-clamp-2">{holiday.description}</p>
                        </td>
                        <td className="py-4 px-4 sm:px-6">
                          <Badge variant="holiday" size="sm">
                            {holiday.holiday_type}
                          </Badge>
                        </td>
                        {isAdmin && (
                          <td className="py-4 px-4 sm:px-6 text-right" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleDelete(holiday.id, holiday.name)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Holiday"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile List View (< 640px) */}
            <div className="sm:hidden p-3 space-y-3">
              {filteredHolidays.map((holiday) => {
                const dateObj = parseDateKey(holiday.date);
                const dayOfWeek = dateObj.toLocaleDateString('default', { weekday: 'short' });

                return (
                  <div
                    key={holiday.id}
                    onClick={() =>
                      setSelectedHoliday({
                        id: `event-${holiday.id}`,
                        type: 'holiday',
                        title: holiday.name,
                        startDate: holiday.date,
                        endDate: holiday.date,
                        isHoliday: true,
                        holidayType: holiday.holiday_type,
                        description: holiday.description,
                        rawHoliday: holiday,
                      })
                    }
                    className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-rose-300 space-y-2.5 shadow-subtle cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {dateObj.getDate()}
                        </span>
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 leading-tight">{holiday.name}</h4>
                          <p className="text-[11px] text-slate-500 font-medium">
                            {formatDisplayDate(holiday.date)} ({dayOfWeek})
                          </p>
                        </div>
                      </div>
                      <Badge variant="holiday" size="sm">
                        {(holiday.holiday_type || 'Government Holiday').split(' ')[0]}
                      </Badge>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {holiday.description}
                    </p>

                    {isAdmin && (
                      <div className="flex justify-end pt-2 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleDelete(holiday.id, holiday.name)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 py-1 px-2 rounded-lg bg-red-50 hover:bg-red-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        ) : (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredHolidays.map((holiday) => {
              const dateObj = parseDateKey(holiday.date);
              const monthStr = dateObj.toLocaleString('default', { month: 'short' }).toUpperCase();
              const dayStr = dateObj.getDate();

              return (
                <div
                  key={holiday.id}
                  onClick={() =>
                    setSelectedHoliday({
                      id: `event-${holiday.id}`,
                      type: 'holiday',
                      title: holiday.name,
                      startDate: holiday.date,
                      endDate: holiday.date,
                      isHoliday: true,
                      holidayType: holiday.holiday_type,
                      description: holiday.description,
                      rawHoliday: holiday,
                    })
                  }
                  className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-rose-300 hover:shadow-card transition-all cursor-pointer flex flex-col justify-between space-y-3 group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 shadow-sm flex-shrink-0">
                        <span className="text-[10px] font-bold text-rose-500">{monthStr}</span>
                        <span className="text-base font-extrabold">{dayStr}</span>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 group-hover:text-rose-700 transition-colors">
                          {holiday.name}
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          {dateObj.toLocaleDateString('default', { weekday: 'long' })}, {holiday.date}
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {holiday.description}
                  </p>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <Badge variant="holiday" size="sm">
                      {holiday.holiday_type}
                    </Badge>
                    {isAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(holiday.id, holiday.name);
                        }}
                        className="text-[11px] font-semibold text-red-600 hover:text-red-700"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Holiday Modal (Admin) */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Government Holiday"
        subtitle="Register an official public holiday on the company calendar"
        maxWidth="md"
      >
        <form onSubmit={handleAddHoliday} className="space-y-4">
          <Input
            label="Holiday Name"
            placeholder="e.g. Tamil New Year / Puthandu"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Holiday Date
            </label>
            <input
              type="date"
              min="2026-10-01"
              max="2027-12-31"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-sm text-slate-900 rounded-xl px-3.5 py-2.5 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Classification
            </label>
            <select
              value={holidayType}
              onChange={(e) => setHolidayType(e.target.value as HolidayType)}
              className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 text-sm text-slate-900 rounded-xl px-3.5 py-2.5 outline-none"
            >
              <option value="Government Holiday">Government Holiday (Mandatory)</option>
              <option value="Public Holiday">Public Holiday</option>
              <option value="Restricted Holiday">Restricted Holiday (Optional)</option>
              <option value="Regional Holiday">Regional Tamil Nadu Holiday</option>
            </select>
          </div>

          <Textarea
            label="Description"
            placeholder="Official significance and celebration context..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              Add Holiday
            </Button>
          </div>
        </form>
      </Modal>

      {/* Holiday Detail Modal */}
      <EventDetailModal
        isOpen={Boolean(selectedHoliday)}
        onClose={() => setSelectedHoliday(null)}
        event={selectedHoliday}
      />
    </AppLayout>
  );
}
