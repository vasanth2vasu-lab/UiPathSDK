const express = require('express');
const router = express.Router();
const { getCachedData, refreshAllData } = require('../services/data_merger');
const { getConnectionStatus } = require('../services/salesforce');

router.get('/', (req, res) => {
  const { projects, lastRefreshed, errors } = getCachedData();
  const total = projects.length;
  const red = projects.filter(p => p.rag_status === 'red').length;
  const amber = projects.filter(p => p.rag_status === 'amber').length;
  const green = projects.filter(p => p.rag_status === 'green').length;
  const unknown = projects.filter(p => p.rag_status === 'unknown').length;
  const overdue = projects.filter(p => p.is_overdue).length;
  const completionVals = projects.filter(p => p.completion_pct != null).map(p => p.completion_pct);
  const avgCompletion = completionVals.length > 0
    ? Math.round(completionVals.reduce((a, b) => a + b, 0) / completionVals.length)
    : 0;

  res.json({
    total,
    red,
    amber,
    green,
    unknown,
    overdue,
    avg_completion: avgCompletion,
    red_pct: total ? Math.round((red / total) * 100) : 0,
    amber_pct: total ? Math.round((amber / total) * 100) : 0,
    green_pct: total ? Math.round((green / total) * 100) : 0,
    last_refreshed: lastRefreshed,
    errors,
  });
});

router.get('/departments', (req, res) => {
  const { projects } = getCachedData();
  const depts = [...new Set(projects.map(p => p.department).filter(Boolean))].sort();
  res.json(depts);
});

router.get('/owners', (req, res) => {
  const { projects } = getCachedData();
  const owners = [...new Set(projects.map(p => p.owner).filter(Boolean))].sort();
  res.json(owners);
});

router.get('/settings', (req, res) => {
  const { excelFiles, sfStatus, errors, lastRefreshed } = getCachedData();
  res.json({
    salesforce: getConnectionStatus(),
    excelFiles,
    errors,
    lastRefreshed,
  });
});

module.exports = router;
