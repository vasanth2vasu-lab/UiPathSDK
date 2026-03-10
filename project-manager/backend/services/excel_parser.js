const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { mapColumns, mapRow } = require('../utils/column_mapper');
const { parseDate } = require('../utils/date_utils');

const DATA_DIR = path.join(__dirname, '../../data');

function parseExcelFile(filePath) {
  const projects = [];
  const fileName = path.basename(filePath);

  let workbook;
  try {
    workbook = XLSX.readFile(filePath);
  } catch (err) {
    console.warn(`Failed to read Excel file ${fileName}: ${err.message}`);
    return { projects: [], errors: [`Failed to read file: ${err.message}`] };
  }

  const errors = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

    if (rows.length === 0) {
      errors.push(`Sheet "${sheetName}" is empty`);
      continue;
    }

    const headers = Object.keys(rows[0]);
    const columnMapping = mapColumns(headers);

    const mappedFields = Object.values(columnMapping);
    if (!mappedFields.includes('project_name') && !mappedFields.includes('project_id')) {
      errors.push(`Sheet "${sheetName}": Could not detect project_name or project_id columns`);
      continue;
    }

    for (let i = 0; i < rows.length; i++) {
      const mapped = mapRow(rows[i], columnMapping);
      if (!mapped.project_name && !mapped.project_id) continue;

      const project = {
        id: String(mapped.project_id || `${fileName}-${sheetName}-${i}`),
        source: 'excel',
        source_file: `${fileName} > ${sheetName}`,
        project_name: mapped.project_name || mapped.project_id || 'Unnamed Project',
        owner: mapped.owner || 'Unassigned',
        status: mapped.status || '',
        start_date: parseDate(mapped.start_date),
        end_date: parseDate(mapped.end_date),
        budget: mapped.budget != null ? Number(mapped.budget) : null,
        spend_to_date: mapped.spend_to_date != null ? Number(mapped.spend_to_date) : null,
        completion_pct: mapped.completion_pct != null ? parseCompletionPct(mapped.completion_pct) : null,
        priority: normalizePriority(mapped.priority),
        department: mapped.department || null,
        comments: mapped.comments || null,
        last_updated: new Date(),
      };

      projects.push(project);
    }
  }

  return { projects, errors };
}

function parseCompletionPct(value) {
  if (value == null) return null;
  const num = typeof value === 'string' ? parseFloat(value.replace('%', '')) : Number(value);
  if (isNaN(num)) return null;
  // If value looks like a decimal (0.0-1.0), convert to percentage
  return num > 0 && num <= 1 ? num * 100 : num;
}

function normalizePriority(value) {
  if (!value) return null;
  const lower = String(value).toLowerCase().trim();
  if (['high', 'critical', 'urgent', '1', 'p1'].includes(lower)) return 'high';
  if (['medium', 'normal', 'moderate', '2', 'p2'].includes(lower)) return 'medium';
  if (['low', 'minor', '3', 'p3'].includes(lower)) return 'low';
  return lower;
}

function loadAllExcelFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    return { projects: [], files: [], errors: ['No data directory found; created empty directory'] };
  }

  const files = fs.readdirSync(DATA_DIR).filter(f => /\.xlsx?$/i.test(f));
  if (files.length === 0) {
    return { projects: [], files: [], errors: ['No Excel files found in /data directory'] };
  }

  let allProjects = [];
  const allErrors = [];
  const fileInfos = [];

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    const { projects, errors } = parseExcelFile(filePath);
    allProjects = allProjects.concat(projects);
    allErrors.push(...errors.map(e => `[${file}] ${e}`));
    fileInfos.push({ name: file, rowCount: projects.length, errors });
  }

  return { projects: allProjects, files: fileInfos, errors: allErrors };
}

module.exports = { loadAllExcelFiles, parseExcelFile };
