const { loadAllExcelFiles } = require('./excel_parser');
const { fetchProjects: fetchSFProjects } = require('./salesforce');
const { computeAllRAG } = require('./rag_engine');

let cachedData = {
  projects: [],
  excelFiles: [],
  errors: [],
  sfStatus: { connected: false },
  lastRefreshed: null,
};

let refreshLock = false;
let lastRefreshTime = 0;
const REFRESH_COOLDOWN_MS = 60000; // 60 seconds

async function refreshAllData() {
  const now = Date.now();
  if (refreshLock) return cachedData;
  if (now - lastRefreshTime < REFRESH_COOLDOWN_MS) {
    return cachedData;
  }

  refreshLock = true;
  try {
    // Load Excel data
    const excelResult = loadAllExcelFiles();

    // Load Salesforce data
    const sfResult = await fetchSFProjects();

    // Merge projects — deduplicate by project_id, preferring SF
    const sfMap = new Map();
    for (const p of sfResult.projects) {
      sfMap.set(p.id, p);
    }

    const merged = [];
    const seenIds = new Set();

    // Add all SF projects first (authoritative)
    for (const p of sfResult.projects) {
      merged.push(p);
      seenIds.add(p.id);
    }

    // Add Excel projects, checking for duplicates
    for (const p of excelResult.projects) {
      if (seenIds.has(p.id)) {
        // Merge: SF is authoritative, but fill in missing fields from Excel
        const existing = merged.find(m => m.id === p.id);
        if (existing) {
          existing.source = 'merged';
          existing.source_file = p.source_file;
          for (const [key, val] of Object.entries(p)) {
            if (val != null && existing[key] == null) {
              existing[key] = val;
            }
          }
        }
      } else {
        merged.push(p);
        seenIds.add(p.id);
      }
    }

    // Compute RAG for all projects
    const projectsWithRAG = computeAllRAG(merged);

    cachedData = {
      projects: projectsWithRAG,
      excelFiles: excelResult.files,
      errors: [...excelResult.errors, ...(sfResult.error ? [`[Salesforce] ${sfResult.error}`] : [])],
      sfStatus: { connected: sfResult.connected, error: sfResult.error },
      lastRefreshed: new Date(),
    };

    lastRefreshTime = now;
    return cachedData;
  } finally {
    refreshLock = false;
  }
}

function getCachedData() {
  return cachedData;
}

module.exports = { refreshAllData, getCachedData };
