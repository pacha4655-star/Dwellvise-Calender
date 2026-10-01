'use client';

import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/lib/auth/auth-context';
import { getHolidays, addHoliday, updateHoliday, deleteHoliday, subscribeToStore } from '@/lib/data/store';
import { GovernmentHoliday, HolidayType } from '@/types';
import { formatDisplayDate, parseDateKey } from '@/lib/utils/date-utils';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { Flag, Plus, Trash2, Edit, Calendar } from 'lucide-react';

export default function AdminHolidaysPage() {
  const { user, isAdmin } = useAuth();
  const { success, error: toastError } = useToast();

  const [holidays, setHolidays] = useState<GovernmentHoliday[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<GovernmentHoliday | null>(null);

  // Form State
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

  const handleAdd = async (e: React.FormEvent) => {
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
        success(`Holiday "${name}" registered on calendar.`, 'Holiday Added');
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

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHoliday) return;
    setIsSubmitting(true);
    try {
      const res = await updateHoliday(editingHoliday.id, {
        name: editingHoliday.name,
        date: editingHoliday.date,
        description: editingHoliday.description,
        holiday_type: editingHoliday.holiday_type,
      });

      if (res.success) {
        success('Holiday updated successfully.', 'Updated');
        setEditingHoliday(null);
        loadData();
      } else {
        toastError(res.message);
      }
    } catch {
      toastError('Failed to update holiday.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, holidayName: string) => {
    if (confirm(`Are you sure you want to delete "${holidayName}"?`)) {
      const res = await deleteHoliday(id);
      if (res.success) {
        success(res.message, 'Holiday Removed');
        loadData();
      } else {
        toastError(res.message);
      }
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
                Government Holiday Administration
              </h1>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800">
                Official Calendar Config
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Maintain and schedule Tamil Nadu and National public holidays stored in the database.
            </p>
          </div>

          <Button
            variant="primary"
            onClick={() => setIsAddModalOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
            className="shadow-sm self-start sm:self-auto"
          >
            Add New Holiday
          </Button>
        </div>

        {/* Mobile View: Cards */}
        <div className="block sm:hidden space-y-3">
          {holidays.map((h) => (
            <Card key={h.id} className="p-4 border border-slate-200 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">{h.name}</span>
                  <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded mt-1 inline-block">
                    {formatDisplayDate(h.date)}
                  </span>
                </div>
                <Badge variant="holiday" size="sm">
                  {h.holiday_type}
                </Badge>
              </div>

              {h.description && (
                <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed">
                  {h.description}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditingHoliday(h)}
                  leftIcon={<Edit className="w-3.5 h-3.5" />}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => handleDelete(h.id, h.name)}
                  leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {/* Desktop View: Table */}
        <Card className="hidden sm:block border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4 sm:px-6">Date</th>
                  <th className="py-3.5 px-4 sm:px-6">Holiday Name</th>
                  <th className="py-3.5 px-4 sm:px-6">Description</th>
                  <th className="py-3.5 px-4 sm:px-6">Type</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {holidays.map((h) => {
                  return (
                    <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-4 sm:px-6 font-bold text-slate-900 whitespace-nowrap">
                        {formatDisplayDate(h.date)}
                      </td>
                      <td className="py-4 px-4 sm:px-6 font-bold text-slate-900">
                        {h.name}
                      </td>
                      <td className="py-4 px-4 sm:px-6 text-slate-600 max-w-sm">
                        <p className="line-clamp-2">{h.description}</p>
                      </td>
                      <td className="py-4 px-4 sm:px-6">
                        <Badge variant="holiday" size="sm">
                          {h.holiday_type}
                        </Badge>
                      </td>
                      <td className="py-4 px-4 sm:px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setEditingHoliday(h)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(h.id, h.name)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Add Holiday Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Government Holiday"
        subtitle="Register official public holiday"
        maxWidth="md"
      >
        <form onSubmit={handleAdd} className="space-y-4">
          <Input
            label="Holiday Name"
            placeholder="e.g. Tamil New Year / Puthandu"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Date
            </label>
            <input
              type="date"
              min="2026-10-01"
              max="2027-12-31"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Classification
            </label>
            <select
              value={holidayType}
              onChange={(e) => setHolidayType(e.target.value as HolidayType)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none"
            >
              <option value="Government Holiday">Government Holiday</option>
              <option value="Public Holiday">Public Holiday</option>
              <option value="Restricted Holiday">Restricted Holiday</option>
              <option value="Regional Holiday">Regional Holiday</option>
            </select>
          </div>

          <Textarea
            label="Description"
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

      {/* Edit Holiday Modal */}
      {editingHoliday && (
        <Modal
          isOpen={Boolean(editingHoliday)}
          onClose={() => setEditingHoliday(null)}
          title={`Edit ${editingHoliday.name}`}
          subtitle="Update holiday details"
          maxWidth="md"
        >
          <form onSubmit={handleUpdate} className="space-y-4">
            <Input
              label="Holiday Name"
              value={editingHoliday.name}
              onChange={(e) => setEditingHoliday({ ...editingHoliday, name: e.target.value })}
              required
            />

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Date
              </label>
              <input
                type="date"
                min="2026-10-01"
                max="2027-12-31"
                value={editingHoliday.date}
                onChange={(e) => setEditingHoliday({ ...editingHoliday, date: e.target.value })}
                required
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Classification
              </label>
              <select
                value={editingHoliday.holiday_type}
                onChange={(e) =>
                  setEditingHoliday({ ...editingHoliday, holiday_type: e.target.value as HolidayType })
                }
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none"
              >
                <option value="Government Holiday">Government Holiday</option>
                <option value="Public Holiday">Public Holiday</option>
                <option value="Restricted Holiday">Restricted Holiday</option>
                <option value="Regional Holiday">Regional Holiday</option>
              </select>
            </div>

            <Textarea
              label="Description"
              value={editingHoliday.description}
              onChange={(e) =>
                setEditingHoliday({ ...editingHoliday, description: e.target.value })
              }
              rows={3}
            />

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <Button variant="outline" type="button" onClick={() => setEditingHoliday(null)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" isLoading={isSubmitting}>
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </AppLayout>
  );
}
