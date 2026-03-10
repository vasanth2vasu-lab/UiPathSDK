import React, { useState, useEffect } from 'react';
import { fetchDepartments, fetchOwners } from '../hooks/useProjects';

export default function FilterBar({ filters, onFilterChange }) {
  const [departments, setDepartments] = useState([]);
  const [owners, setOwners] = useState([]);

  useEffect(() => {
    fetchDepartments().then(setDepartments).catch(() => {});
    fetchOwners().then(setOwners).catch(() => {});
  }, []);

  const update = (key, value) => {
    onFilterChange({ ...filters, [key]: value || '' });
  };

  const clearAll = () => {
    onFilterChange({ search: '', department: '', owner: '', priority: '', source: '', sort: '', order: '' });
  };

  const hasFilters = Object.values(filters).some(v => v);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 shadow-sm">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
          <input
            type="text"
            placeholder="Search projects..."
            value={filters.search || ''}
            onChange={e => update('search', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Department</label>
          <select
            value={filters.department || ''}
            onChange={e => update('department', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="">All</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Owner</label>
          <select
            value={filters.owner || ''}
            onChange={e => update('owner', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="">All</option>
            {owners.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
          <select
            value={filters.priority || ''}
            onChange={e => update('priority', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="">All</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Source</label>
          <select
            value={filters.source || ''}
            onChange={e => update('source', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="">All</option>
            <option value="excel">Excel</option>
            <option value="salesforce">Salesforce</option>
          </select>
        </div>
        {hasFilters && (
          <button onClick={clearAll} className="px-3 py-2 text-sm text-red-600 hover:text-red-800 font-medium">
            Clear All
          </button>
        )}
      </div>
    </div>
  );
}
