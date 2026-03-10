require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const projectRoutes = require('./routes/projects');
const summaryRoutes = require('./routes/summary');
const { refreshAllData, getCachedData } = require('./services/data_merger');
const { getLoginUrl, authenticateBrowser, getConnectionStatus } = require('./services/salesforce');

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

// Salesforce browser login (for SSO orgs)
app.get('/api/sf/login', async (req, res) => {
  const loginUrl = getLoginUrl();
  if (!loginUrl) {
    return res.status(400).json({ error: 'SF_CLIENT_ID not set in .env. Create a Connected App in Salesforce and add the client ID.' });
  }
  // Start the browser OAuth callback listener
  authenticateBrowser(process.env.SF_LOGIN_URL || 'https://login.salesforce.com').then(async (result) => {
    if (result) {
      await refreshAllData();
      console.log('Salesforce connected via browser. Data refreshed.');
    }
  });
  res.json({ login_url: loginUrl, message: 'Open the login_url in your browser to authenticate via SSO.' });
});

app.get('/api/sf/status', (req, res) => {
  res.json(getConnectionStatus());
});

// Manual session token input (for SSO orgs without Connected App access)
app.get('/api/sf/token', async (req, res) => {
  const { session_id, instance_url } = req.query;
  if (!session_id || !instance_url) {
    return res.status(400).json({
      error: 'Missing parameters',
      usage: '/api/sf/token?session_id=YOUR_SESSION_ID&instance_url=https://your-instance.salesforce.com',
      instructions: 'To get your session ID: Open Salesforce → Developer Console (or press F12 → Console tab) → paste: document.cookie.match(/sid=([^;]+)/)?.[1]',
    });
  }
  const { setManualToken } = require('./services/salesforce');
  setManualToken(session_id, instance_url);
  await refreshAllData();
  const status = getConnectionStatus();
  res.json({ message: 'Token set successfully', ...status });
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
