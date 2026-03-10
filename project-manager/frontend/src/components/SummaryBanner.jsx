import React from 'react';
import { timeAgo } from '../utils/formatters';

function KpiCard({ label, value, subtitle, colorClass }) {
  return (
    <div className={`rounded-lg p-4 ${colorClass} shadow-sm`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium">{label}</div>
      {subtitle && <div className="text-xs opacity-75 mt-1">{subtitle}</div>}
    </div>
  );
}

export default function SummaryBanner({ summary, onRefresh, refreshing }) {
  if (!summary) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="rounded-lg p-4 bg-gray-100 animate-pulse h-20" />
        ))}
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <KpiCard label="Total Projects" value={summary.total} colorClass="bg-white border border-gray-200 text-gray-800" />
        <KpiCard label="Red" value={summary.red} subtitle={`${summary.red_pct}%`} colorClass="bg-red-50 border border-red-200 text-red-800" />
        <KpiCard label="Amber" value={summary.amber} subtitle={`${summary.amber_pct}%`} colorClass="bg-amber-50 border border-amber-200 text-amber-800" />
        <KpiCard label="Green" value={summary.green} subtitle={`${summary.green_pct}%`} colorClass="bg-green-50 border border-green-200 text-green-800" />
        <KpiCard label="Overdue" value={summary.overdue} colorClass="bg-red-50 border border-red-200 text-red-800" />
        <KpiCard label="Avg Completion" value={`${summary.avg_completion}%`} colorClass="bg-blue-50 border border-blue-200 text-blue-800" />
        <div className="rounded-lg p-4 bg-white border border-gray-200 shadow-sm flex flex-col justify-between">
          <div className="text-xs text-gray-500">Last refreshed</div>
          <div className="text-sm font-medium text-gray-700">{timeAgo(summary.last_refreshed)}</div>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="mt-1 text-xs bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>
    </div>
  );
}
