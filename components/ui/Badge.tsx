import React from 'react';
import { LeaveStatus, LeaveType, HolidayType } from '@/types';

interface BadgeProps {
  children?: React.ReactNode;
  variant?: 'default' | 'primary' | 'holiday' | 'my-leave' | 'team-leave' | 'pending' | 'approved' | 'rejected' | 'cancelled' | 'neutral' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 font-medium rounded-md',
    md: 'text-xs px-2.5 py-1 font-medium rounded-lg',
    lg: 'text-sm px-3 py-1.5 font-semibold rounded-lg',
  }[size];

  const variantClasses = {
    default: 'bg-slate-100 text-slate-700 border border-slate-200',
    primary: 'bg-blue-50 text-blue-700 border border-blue-200',
    holiday: 'bg-rose-50 text-rose-800 border border-rose-200 font-medium',
    'my-leave': 'bg-purple-50 text-purple-800 border border-purple-200 font-medium',
    'team-leave': 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium',
    pending: 'bg-amber-50 text-amber-800 border border-amber-200 font-medium',
    approved: 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium',
    rejected: 'bg-red-50 text-red-800 border border-red-200 line-through opacity-80',
    cancelled: 'bg-slate-100 text-slate-500 border border-slate-200',
    neutral: 'bg-slate-50 text-slate-600 border border-slate-200',
    outline: 'border border-slate-300 text-slate-700 bg-transparent',
  }[variant];

  return (
    <span className={`inline-flex items-center gap-1.5 justify-center ${sizeClasses} ${variantClasses} ${className}`}>
      {children}
    </span>
  );
};

export const StatusBadge: React.FC<{ status: LeaveStatus; size?: 'sm' | 'md' }> = ({ status, size = 'sm' }) => {
  const config = {
    pending: { label: 'Pending Approval', variant: 'pending' as const },
    approved: { label: 'Approved', variant: 'approved' as const },
    rejected: { label: 'Rejected', variant: 'rejected' as const },
    cancelled: { label: 'Cancelled', variant: 'cancelled' as const },
  }[status] || { label: status, variant: 'neutral' as const };

  return (
    <Badge variant={config.variant} size={size}>
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          status === 'approved'
            ? 'bg-emerald-500'
            : status === 'pending'
            ? 'bg-amber-500 animate-pulse'
            : status === 'rejected'
            ? 'bg-red-500'
            : 'bg-slate-400'
        }`}
      />
      {config.label}
    </Badge>
  );
};
