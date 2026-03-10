const COLUMN_MAP = {
  project_id: ['id', 'project id', 'proj id', 'reference', 'ref', 'project_id'],
  project_name: ['name', 'project name', 'proj name', 'title', 'project_name'],
  owner: ['owner', 'pm', 'project manager', 'lead', 'responsible', 'assigned to'],
  status: ['status', 'state', 'phase', 'stage'],
  start_date: ['start', 'start date', 'begin date', 'kick-off', 'start_date', 'kickoff'],
  end_date: ['end', 'end date', 'due date', 'deadline', 'target date', 'end_date', 'due'],
  budget: ['budget', 'cost', 'estimated cost', 'total budget'],
  spend_to_date: ['spend', 'actual cost', 'actuals', 'cost to date', 'spend_to_date', 'spent'],
  completion_pct: ['% complete', 'progress', 'completion', 'done %', 'completion_pct', 'complete %', 'pct complete', 'percent complete'],
  priority: ['priority', 'urgency', 'tier'],
  department: ['dept', 'department', 'bu', 'business unit', 'team'],
  comments: ['notes', 'comments', 'remarks', 'description'],
};

function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9%]/g, ' ').trim().replace(/\s+/g, ' ');
}

function mapColumns(headers) {
  const mapping = {};
  for (const header of headers) {
    const norm = normalize(header);
    for (const [canonical, variants] of Object.entries(COLUMN_MAP)) {
      if (variants.includes(norm)) {
        mapping[header] = canonical;
        break;
      }
    }
  }
  return mapping;
}

function mapRow(row, columnMapping) {
  const mapped = {};
  for (const [originalCol, canonicalCol] of Object.entries(columnMapping)) {
    if (row[originalCol] !== undefined && row[originalCol] !== null && row[originalCol] !== '') {
      mapped[canonicalCol] = row[originalCol];
    }
  }
  return mapped;
}

module.exports = { mapColumns, mapRow, COLUMN_MAP };
