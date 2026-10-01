'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/components/ui/Toast';
import { addMention } from '@/lib/data/store';
import { ManualEventType } from '@/types';
import { formatDisplayDate, isWithinAppRange } from '@/lib/utils/date-utils';
import { Calendar, Tag, ShieldCheck, AlertCircle } from 'lucide-react';

interface AddMentionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: string;
  onSuccess?: () => void;
}

const EVENT_TYPES: ManualEventType[] = [
  'Office Meeting',
  'Company Event',
  'Team Outing',
  'Work From Home',
  'Announcement',
  'Other Note',
];

export const AddMentionModal: React.FC<AddMentionModalProps> = ({
  isOpen,
  onClose,
  initialDate,
  onSuccess,
}) => {
  const { user, isAdmin } = useAuth();
  const { success, error: toastError } = useToast();

  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('2026-10-06');
  const [endDate, setEndDate] = useState('2026-10-06');
  const [eventType, setEventType] = useState<ManualEventType>('Office Meeting');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (initialDate && isWithinAppRange(initialDate)) {
      setStartDate(initialDate);
      setEndDate(initialDate);
    }
  }, [initialDate, isOpen]);

  if (!isAdmin) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!title.trim() || !startDate) {
      setFormError('Title and start date are required.');
      return;
    }

    if (endDate < startDate) {
      setFormError('End date cannot be earlier than start date.');
      return;
    }

    if (!user) return;

    setIsSubmitting(true);
    try {
      const res = await addMention({
        title: title.trim(),
        start_date: startDate,
        end_date: endDate || startDate,
        event_type: eventType,
        description: description.trim(),
        created_by: user.id,
      });

      if (res.success) {
        success(`Calendar mention "${title}" posted to shared calendar.`, 'Event Created');
        setTitle('');
        setDescription('');
        onSuccess?.();
        onClose();
      } else {
        setFormError(res.message);
        toastError(res.message);
      }
    } catch {
      setFormError('Failed to save calendar mention.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Calendar Mention"
      subtitle="Create an official office event, meeting, or announcement"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        {/* Admin Badge */}
        <div className="flex items-center gap-2 p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-900 text-xs font-semibold">
          <ShieldCheck className="w-4 h-4 text-indigo-600 flex-shrink-0" />
          <span>Admin-Only Feature: Visible to all 4 employees on the calendar.</span>
        </div>

        <Input
          label="Event / Mention Title *"
          placeholder="e.g. Q3 Performance Review & All-Hands"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Category / Classification
          </label>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value as ManualEventType)}
            className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 text-sm text-slate-900 rounded-xl px-3.5 py-2.5 outline-none transition-all"
          >
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Start Date *
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
              className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 text-sm text-slate-900 rounded-xl px-3.5 py-2.5 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              End Date (Optional)
            </label>
            <input
              type="date"
              min={startDate || '2026-10-01'}
              max="2027-12-31"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 text-sm text-slate-900 rounded-xl px-3.5 py-2.5 outline-none transition-all"
            />
          </div>
        </div>

        <Textarea
          label="Description / Short Note"
          placeholder="Location, agenda, or relevant details for team members..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3 pt-3 border-t border-slate-100">
          <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button variant="primary" type="submit" isLoading={isSubmitting} className="w-full sm:w-auto">
            Publish Mention to Calendar
          </Button>
        </div>
      </form>
    </Modal>
  );
};
