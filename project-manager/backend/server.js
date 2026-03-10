require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const projectRoutes = require('./routes/projects');
const summaryRoutes = require('./routes/summary');
const { refreshAllData, getCachedData } = require('./services/data_merger');

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// CORS
app.use(cors({
  origin: [FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3000'],
  methods: ['GET'],
}));

app.use(express.json());

// Serve static frontend build if available
const frontendBuild = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendBuild));

// Health check
app.get('/api/health', (req, res) => {
  const { lastRefreshed } = getCachedData();
  res.json({ status: 'ok', lastRefreshed, uptime: process.uptime() });
});

// API routes
app.use('/api/projects', projectRoutes);
app.use('/api/summary', summaryRoutes);
app.use('/api/departments', (req, res) => {
  const { projects } = getCachedData();
  const depts = [...new Set(projects.map(p => p.department).filter(Boolean))].sort();
  res.json(depts);
});
app.use('/api/owners', (req, res) => {
  const { projects } = getCachedData();
  const owners = [...new Set(projects.map(p => p.owner).filter(Boolean))].sort();
  res.json(owners);
});

// Refresh endpoint with rate limiting
let lastRefreshRequest = 0;
app.get('/api/refresh', async (req, res) => {
  const now = Date.now();
  if (now - lastRefreshRequest < 60000) {
    return res.status(429).json({ error: 'Refresh rate limited. Please wait 60 seconds between refreshes.' });
  }
  lastRefreshRequest = now;
  const data = await refreshAllData();
  res.json({ message: 'Data refreshed', projectCount: data.projects.length, lastRefreshed: data.lastRefreshed });
});

// SPA fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  res.sendFile(path.join(frontendBuild, 'index.html'));
});

// Initialize data on startup
async function start() {
  console.log('Loading project data...');
  await refreshAllData();
  const { projects, errors } = getCachedData();
  console.log(`Loaded ${projects.length} projects. ${errors.length > 0 ? `Warnings: ${errors.length}` : ''}`);

  app.listen(PORT, () => {
    console.log(`Project Manager API running on http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
