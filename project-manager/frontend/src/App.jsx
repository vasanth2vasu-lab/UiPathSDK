import React, { useState, useCallback } from 'react';
import SummaryBanner from './components/SummaryBanner';
import ProjectTable from './components/ProjectTable';
import ProjectDetailPanel from './components/ProjectDetailPanel';
import ChartsSection from './components/ChartsSection';
import FilterBar from './components/FilterBar';
import SettingsPanel from './components/SettingsPanel';
import { useProjects, useSummary, useSettings, refreshData } from './hooks/useProjects';

export default function App() {
  const [filters, setFilters] = useState({});
  const [ragFilter, setRagFilter] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { projects, loading, refetch: refetchProjects } = useProjects(filters);
  const { summary, refetch: refetchSummary } = useSummary();
  const { settings, refetch: refetchSettings } = useSettings();

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshData();
      await Promise.all([refetchProjects(), refetchSummary(), refetchSettings()]);
    } catch {
      // handled silently
    } finally {
      setRefreshing(false);
    }
  }, [refetchProjects, refetchSummary, refetchSettings]);

  const handleExport = useCallback(() => {
    if (!projects.length) return;
    const headers = ['RAG', 'Project Name', 'Owner', 'Department', 'Status', 'Completion %', 'Budget Util %', 'End Date', 'Days Left', 'Source'];
    const rows = projects.map(p => [
      p.rag_status, p.project_name, p.owner, p.department || '', p.status,
      p.completion_pct ?? '', p.budget_utilization_pct ?? '',
      p.end_date ? new Date(p.end_date).toLocaleDateString() : '', p.days_remaining ?? '', p.source,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `projects_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [projects]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Project Manager Dashboard</h1>
            <p className="text-sm text-gray-500">Unified project tracking with RAG status</p>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
            title="Settings"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        <SummaryBanner summary={summary} onRefresh={handleRefresh} refreshing={refreshing} />
        <FilterBar filters={filters} onFilterChange={setFilters} />

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
          </div>
        ) : (
          <>
            <ProjectTable
              projects={projects}
              onSelectProject={setSelectedProject}
              ragFilter={ragFilter}
              onRagFilter={setRagFilter}
            />
            <ChartsSection projects={projects} />
          </>
        )}
      </main>

      {selectedProject && (
        <ProjectDetailPanel project={selectedProject} onClose={() => setSelectedProject(null)} />
      )}

      {showSettings && (
        <SettingsPanel
          settings={settings}
          onClose={() => setShowSettings(false)}
          onRefresh={handleRefresh}
          onExport={handleExport}
          projects={projects}
        />
      )}
    </div>
  );
}
