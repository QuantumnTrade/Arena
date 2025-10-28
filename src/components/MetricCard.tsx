import React from 'react';

interface MetricCardProps {
  label: string;
  value?: number | string;
}

export default function MetricCard({ label, value }: MetricCardProps) {
  return (
    <div className="rounded-lg bg-black/90 border border-slate-800 p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-sm font-semibold text-slate-100 mt-1">
        {value !== undefined ? value : '-'}
      </div>
    </div>
  );
}
