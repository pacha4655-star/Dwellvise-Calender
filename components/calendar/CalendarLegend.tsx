import React from 'react';

export const CalendarLegend: React.FC = () => {
  const items = [
    {
      label: 'Sunday & Govt Holiday (One Color)',
      color: 'bg-rose-100 border-rose-300 text-rose-800',
      dot: 'bg-rose-500',
    },
    {
      label: 'Office Event / Mention',
      color: 'bg-indigo-100 border-indigo-300 text-indigo-800',
      dot: 'bg-indigo-600',
    },
    {
      label: 'My Leave',
      color: 'bg-purple-100 border-purple-300 text-purple-800',
      dot: 'bg-purple-600',
    },
    {
      label: 'Team Leave (Admin Visible)',
      color: 'bg-emerald-100 border-emerald-300 text-emerald-800',
      dot: 'bg-emerald-600',
    },
  ];

  return (
    <div className="w-full min-w-0 flex flex-wrap items-center gap-1.5 sm:gap-3 py-2 px-2.5 sm:px-3 bg-white rounded-xl border border-slate-200/80 text-[10px] sm:text-[11px] font-medium text-slate-700 shadow-subtle">
      <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px] sm:text-[10px] mr-0.5 sm:mr-1">
        Priority Legend:
      </span>
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1 sm:gap-1.5">
          <span className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full flex-shrink-0 ${item.dot}`} />
          <span className="leading-tight">{item.label}</span>
        </div>
      ))}
    </div>
  );
};
