const express = require('express');
const router = express.Router();
const { getCachedData, refreshAllData } = require('../services/data_merger');

router.get('/', (req, res) => {
  const { projects } = getCachedData();
  let filtered = [...projects];

  // Apply filters
  const { rag, department, owner, source, priority, search, sort, order } = req.query;

  if (rag) {
    filtered = filtered.filter(p => p.rag_status === rag.toLowerCase());
  }
  if (department) {
    filtered = filtered.filter(p => p.department && p.department.toLowerCase() === department.toLowerCase());
  }
  if (owner) {
    filtered = filtered.filter(p => p.owner && p.owner.toLowerCase().includes(owner.toLowerCase()));
  }
  if (source) {
    filtered = filtered.filter(p => p.source === source.toLowerCase() || (source === 'merged' && p.source === 'merged'));
  }
  if (priority) {
    filtered = filtered.filter(p => p.priority === priority.toLowerCase());
  }
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(p =>
      (p.project_name || '').toLowerCase().includes(q) ||
      (p.owner || '').toLowerCase().includes(q) ||
      (p.department || '').toLowerCase().includes(q) ||
      (p.comments || '').toLowerCase().includes(q)
    );
  }

  // Sort
  if (sort) {
    const dir = order === 'desc' ? -1 : 1;
    filtered.sort((a, b) => {
      const aVal = a[sort];
      const bVal = b[sort];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (sort === 'rag_status') {
        const ragOrder = { red: 0, amber: 1, green: 2, unknown: 3 };
        return (ragOrder[aVal] - ragOrder[bVal]) * dir;
      }
      if (aVal instanceof Date || (typeof aVal === 'string' && !isNaN(Date.parse(aVal)))) {
        return (new Date(aVal).getTime() - new Date(bVal).getTime()) * dir;
      }
      if (typeof aVal === 'number') return (aVal - bVal) * dir;
      return String(aVal).localeCompare(String(bVal)) * dir;
    });
  }

  res.json({ count: filtered.length, projects: filtered });
});

router.get('/source/excel', (req, res) => {
  const { projects } = getCachedData();
  const filtered = projects.filter(p => p.source === 'excel');
  res.json({ count: filtered.length, projects: filtered });
});

router.get('/source/salesforce', (req, res) => {
  const { projects } = getCachedData();
  const filtered = projects.filter(p => p.source === 'salesforce' || p.source === 'merged');
  res.json({ count: filtered.length, projects: filtered });
});

router.get('/rag/:status', (req, res) => {
  const { projects } = getCachedData();
  const filtered = projects.filter(p => p.rag_status === req.params.status.toLowerCase());
  res.json({ count: filtered.length, projects: filtered });
});

router.get('/:id', (req, res) => {
  const { projects } = getCachedData();
  const project = projects.find(p => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(project);
});

module.exports = router;
