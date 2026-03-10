import React, { useState } from 'react';
import RAGBadge from './RAGBadge';
import { formatDate, formatPct, daysLeftColor } from '../utils/formatters';

const COLUMNS = [
  { key: 'rag_status', label: 'RAG', sortable: true, width: 'w-16' },
  { key: 'project_name', label: 'Project Name', sortable: true },
  { key: 'owner', label: 'Owner', sortable: true },
  { key: 'department', label: 'Department', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'completion_pct', label: 'Progress', sortable: true, width: 'w-32' },
  { key: 'budget_utilization_pct', label: 'Budget Util%', sortable: true, width: 'w-28' },
  { key: 'end_date', label: 'End Date', sortable: true, width: 'w-28' },
  { key: 'days_remaining', label: 'Days Left', sortable: true, width: 'w-24' },
  { key: 'source', label: 'Source', sortable: true, width: 'w-24' },
];

function ProgressBar({ value }) {
  if (value == null) return <span className="text-gray-400 text-sm">—</span>;
  const pct = Math.min(100, Math.max(0, value));
  const color = pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-600 w-10 text-right">{Math.round(pct)}%</span>
    </div>
  );
}

export default function ProjectTable({ projects, onSelectProject, ragFilter, onRagFilter }) {
  const [sortKey, setSortKey] = useState('rag_status');
  const [sortDir, setSortDir] = useState('asc');

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sorted = [...projects].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    let aVal = a[sortKey], bVal = b[sortKey];
    if (sortKey === 'rag_status') {
      const order = { red: 0, amber: 1, unknown: 2, green: 3 };
      return ((order[aVal] ?? 4) - (order[bVal] ?? 4)) * dir;
    }
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    if (typeof aVal === 'number') return (aVal - bVal) * dir;
    if (sortKey.includes('date')) return (new Date(aVal) - new Date(bVal)) * dir;
    return String(aVal).localeCompare(String(bVal)) * dir;
  });

  const ragCounts = { all: projects.length, red: 0, amber: 0, green: 0 };
  projects.forEach(p => { if (ragCounts[p.rag_status] !== undefined) ragCounts[p.rag_status]++; });

  const filtered = ragFilter ? sorted.filter(p => p.rag_status === ragFilter) : sorted;

  return (
    <div>
      {/* RAG Filter Tabs */}
      <div className="flex gap-2 mb-4">
        {[
          { key: '', label: 'All Projects', count: ragCounts.all, cls: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
          { key: 'red', label: 'Red', count: ragCounts.red, cls: 'bg-red-50 text-red-700 hover:bg-red-100' },
          { key: 'amber', label: 'Amber', count: ragCounts.amber, cls: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
          { key: 'green', label: 'Green', count: ragCounts.green, cls: 'bg-green-50 text-green-700 hover:bg-green-100' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => onRagFilter(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              ragFilter === tab.key ? 'ring-2 ring-indigo-500 ' + tab.cls : tab.cls
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    onClick={() => col.sortable && handleSort(col.key)}
                    className={`px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider ${col.width || ''} ${col.sortable ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key && (
                        <span className="text-indigo-500">{sortDir === 'asc' ? '\u25B2' : '\u25BC'}</span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-4 py-12 text-center text-gray-400">
                    No projects found. Place Excel files in the /data directory or configure Salesforce.
                  </td>
                </tr>
              ) : filtered.map(project => (
                <tr
                  key={project.id}
                  onClick={() => onSelectProject(project)}
                  className="border-b border-gray-100 hover:bg-indigo-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3"><RAGBadge status={project.rag_status} /></td>
                  <td className="px-4 py-3 font-medium text-gray-900">{project.project_name}</td>
                  <td className="px-4 py-3 text-gray-600">{project.owner}</td>
                  <td className="px-4 py-3 text-gray-600">{project.department || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">
                      {project.status || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3"><ProgressBar value={project.completion_pct} /></td>
                  <td className="px-4 py-3 text-gray-600">{formatPct(project.budget_utilization_pct)}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(project.end_date)}</td>
                  <td className={`px-4 py-3 font-medium ${daysLeftColor(project.days_remaining)}`}>
                    {project.days_remaining != null ? project.days_remaining : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                      project.source === 'salesforce' ? 'bg-blue-100 text-blue-700' :
                      project.source === 'merged' ? 'bg-purple-100 text-purple-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {project.source}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
