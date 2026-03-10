import React from 'react';
import RAGBadge from './RAGBadge';
import { formatDate, formatCurrency, formatPct, ragColor } from '../utils/formatters';

export default function ProjectDetailPanel({ project, onClose }) {
  if (!project) return null;

  const colors = ragColor(project.rag_status);

  // Timeline visualization
  const timelineWidth = (() => {
    if (!project.start_date || !project.end_date) return null;
    const start = new Date(project.start_date).getTime();
    const end = new Date(project.end_date).getTime();
    const now = Date.now();
    if (end <= start) return 100;
    return Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));
  })();

  // Budget bar
  const budgetPct = project.budget && project.spend_to_date
    ? Math.min(150, (project.spend_to_date / project.budget) * 100)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white shadow-xl overflow-y-auto">
        <div className={`p-6 ${colors.light} border-b ${colors.border}`}>
          <div className="flex items-start justify-between">
            <div>
              <RAGBadge status={project.rag_status} size="lg" />
              <h2 className="text-xl font-bold text-gray-900 mt-2">{project.project_name}</h2>
              <p className="text-sm text-gray-500 mt-1">ID: {project.id}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* RAG Reasons */}
          <div className={`rounded-lg p-4 ${colors.light} border ${colors.border}`}>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">RAG Status Reasons</h3>
            {project.rag_reasons?.length > 0 ? (
              <ul className="space-y-1">
                {project.rag_reasons.map((r, i) => (
                  <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                    <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${colors.bg}`} />
                    {r.replace(/^(RED|AMBER|GREEN): /, '')}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No specific reasons recorded.</p>
            )}
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <Detail label="Owner" value={project.owner} />
            <Detail label="Department" value={project.department} />
            <Detail label="Status" value={project.status} />
            <Detail label="Priority" value={project.priority} />
            <Detail label="Start Date" value={formatDate(project.start_date)} />
            <Detail label="End Date" value={formatDate(project.end_date)} />
            <Detail label="Days Remaining" value={project.days_remaining} />
            <Detail label="Completion" value={formatPct(project.completion_pct)} />
            <Detail label="Budget" value={formatCurrency(project.budget)} />
            <Detail label="Spend to Date" value={formatCurrency(project.spend_to_date)} />
            <Detail label="Budget Utilization" value={formatPct(project.budget_utilization_pct)} />
            <Detail label="Source" value={project.source_file || project.source} />
          </div>

          {/* Budget Bar */}
          {budgetPct != null && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Budget vs Spend</h3>
              <div className="bg-gray-200 rounded-full h-4 overflow-hidden">
                <div
                  className={`h-full rounded-full ${budgetPct > 100 ? 'bg-red-500' : budgetPct > 90 ? 'bg-amber-500' : 'bg-green-500'}`}
                  style={{ width: `${Math.min(100, budgetPct)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{formatCurrency(project.spend_to_date)} spent</span>
                <span>{formatCurrency(project.budget)} budget</span>
              </div>
            </div>
          )}

          {/* Timeline Bar */}
          {timelineWidth != null && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Timeline Progress</h3>
              <div className="bg-gray-200 rounded-full h-4 overflow-hidden relative">
                <div
                  className={`h-full rounded-full ${timelineWidth > 100 ? 'bg-red-500' : 'bg-blue-500'}`}
                  style={{ width: `${Math.min(100, timelineWidth)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{formatDate(project.start_date)}</span>
                <span>Today</span>
                <span>{formatDate(project.end_date)}</span>
              </div>
            </div>
          )}

          {/* Comments */}
          {project.comments && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Comments / Notes</h3>
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{project.comments}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm font-medium text-gray-800">{value || '—'}</div>
    </div>
  );
}
