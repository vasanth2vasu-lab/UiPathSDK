const fs = require('fs');
const path = require('path');
const { daysRemaining, timelineElapsedPct } = require('../utils/date_utils');

let ragRules;
try {
  ragRules = JSON.parse(fs.readFileSync(path.join(__dirname, '../../config/rag_rules.json'), 'utf-8'));
} catch {
  ragRules = null;
}

function computeRAG(project) {
  const reasons = [];
  const now = new Date();

  const daysLeft = project.end_date ? daysRemaining(project.end_date) : null;
  const completion = project.completion_pct != null ? Number(project.completion_pct) : null;
  const budgetUtil = (project.budget && project.spend_to_date)
    ? (project.spend_to_date / project.budget) * 100
    : null;
  const statusLower = (project.status || '').toLowerCase();
  const priority = (project.priority || '').toLowerCase();
  const timelineElapsed = timelineElapsedPct(project.start_date, project.end_date);

  // Computed fields
  project.days_remaining = daysLeft;
  project.is_overdue = (daysLeft !== null && daysLeft < 0 && (completion === null || completion < 100));
  project.budget_utilization_pct = budgetUtil != null ? Math.round(budgetUtil * 10) / 10 : null;

  // --- RED checks ---
  if (project.is_overdue) {
    reasons.push('RED: Project is overdue');
  }
  if (completion !== null && completion < 25 && daysLeft !== null && daysLeft < 14) {
    reasons.push('RED: Less than 25% complete with fewer than 14 days remaining');
  }
  if (budgetUtil !== null && budgetUtil > 110) {
    reasons.push(`RED: Over budget at ${budgetUtil.toFixed(1)}% utilization`);
  }
  const redKeywords = ['blocked', 'on hold', 'cancelled', 'failed', 'escalated', 'critical'];
  for (const kw of redKeywords) {
    if (statusLower.includes(kw)) {
      reasons.push(`RED: Status contains "${kw}"`);
      break;
    }
  }
  if (daysLeft !== null && daysLeft < 0) {
    reasons.push('RED: Past due date');
  }
  if (priority === 'high' && completion !== null && completion < 30 && daysLeft !== null && daysLeft < 30) {
    reasons.push('RED: High priority project with low completion and tight deadline');
  }

  const isRed = reasons.some(r => r.startsWith('RED:'));
  if (isRed) {
    project.rag_status = 'red';
    project.rag_reasons = reasons.filter(r => r.startsWith('RED:'));
    return project;
  }

  // --- AMBER checks ---
  const amberReasons = [];
  if (daysLeft !== null && daysLeft >= 0 && daysLeft < 14 && completion !== null && completion < 75) {
    amberReasons.push('AMBER: Fewer than 14 days remaining with less than 75% completion');
  }
  if (budgetUtil !== null && budgetUtil >= 90 && budgetUtil <= 110) {
    amberReasons.push(`AMBER: Budget utilization at ${budgetUtil.toFixed(1)}% (90-110% range)`);
  }
  if (completion !== null && completion < 50 && timelineElapsed !== null && timelineElapsed > 50) {
    amberReasons.push('AMBER: Less than 50% complete but more than 50% of timeline elapsed');
  }
  const amberKeywords = ['at risk', 'delayed', 'in review', 'pending', 'stalled', 'slow'];
  for (const kw of amberKeywords) {
    if (statusLower.includes(kw)) {
      amberReasons.push(`AMBER: Status contains "${kw}"`);
      break;
    }
  }
  if (project.last_updated) {
    const daysSinceUpdate = Math.ceil((now.getTime() - new Date(project.last_updated).getTime()) / 86400000);
    if (daysSinceUpdate > 30) {
      amberReasons.push(`AMBER: No update in ${daysSinceUpdate} days`);
    }
  }

  if (amberReasons.length > 0) {
    project.rag_status = 'amber';
    project.rag_reasons = amberReasons;
    return project;
  }

  // --- GREEN checks ---
  const greenReasons = [];
  if (completion !== null && timelineElapsed !== null && completion >= (timelineElapsed - 10)) {
    greenReasons.push('GREEN: Progress is on track with timeline');
  }
  if (budgetUtil !== null && budgetUtil <= 90) {
    greenReasons.push('GREEN: Budget utilization within healthy range');
  }
  if (daysLeft !== null && daysLeft > 14) {
    greenReasons.push('GREEN: More than 14 days remaining');
  }
  const greenKeywords = ['on track', 'active', 'in progress', 'healthy', 'complete', 'done'];
  for (const kw of greenKeywords) {
    if (statusLower.includes(kw)) {
      greenReasons.push(`GREEN: Status indicates "${kw}"`);
      break;
    }
  }

  if (greenReasons.length > 0) {
    project.rag_status = 'green';
    project.rag_reasons = greenReasons;
    return project;
  }

  // --- UNKNOWN ---
  project.rag_status = 'unknown';
  project.rag_reasons = ['Insufficient data to determine RAG status'];
  return project;
}

function computeAllRAG(projects) {
  return projects.map(p => computeRAG({ ...p }));
}

module.exports = { computeRAG, computeAllRAG };
