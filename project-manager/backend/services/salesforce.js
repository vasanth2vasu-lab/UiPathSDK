const axios = require('axios');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

let sfAuth = null; // { access_token, instance_url, refresh_token }
const TOKEN_FILE = path.join(__dirname, '../../.sf_token.json');

// Load saved tokens from disk (persists across server restarts)
function loadSavedTokens() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
      if (data.access_token && data.instance_url) {
        sfAuth = data;
        console.log(`Loaded saved Salesforce tokens. Instance: ${sfAuth.instance_url}`);
        return true;
      }
    }
  } catch {
    // ignore
  }
  return false;
}

function saveTokens() {
  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(sfAuth, null, 2));
  } catch {
    // ignore
  }
}

// Main authenticate function — tries multiple methods
async function authenticate() {
  const loginUrl = process.env.SF_LOGIN_URL || 'https://login.salesforce.com';
  const username = process.env.SF_USERNAME;
  const password = (process.env.SF_PASSWORD || '') + (process.env.SF_SECURITY_TOKEN || '');

  // Check for saved tokens first
  if (loadSavedTokens()) {
    // Verify the token still works
    try {
      await axios.get(`${sfAuth.instance_url}/services/data/v58.0/`, {
        headers: { Authorization: `Bearer ${sfAuth.access_token}` },
      });
      console.log('Saved Salesforce token is still valid.');
      return sfAuth;
    } catch {
      console.log('Saved token expired. Re-authenticating...');
      sfAuth = null;
    }
  }

  // Try refresh token if available
  if (sfAuth?.refresh_token && process.env.SF_CLIENT_ID) {
    const refreshResult = await refreshAccessToken(loginUrl);
    if (refreshResult) return refreshResult;
  }

  // Attempt 1: OAuth Username-Password flow (if credentials provided)
  if (username && password) {
    const oauthResult = await authenticateOAuth(loginUrl, username, password);
    if (oauthResult) return oauthResult;

    // Attempt 2: SOAP login
    console.log('OAuth password flow failed. Trying SOAP login...');
    const soapResult = await authenticateSOAP(loginUrl, username, password);
    if (soapResult) return soapResult;
  }

  // Attempt 3: Browser-based OAuth (for SSO/Azure AD)
  if (process.env.SF_CLIENT_ID) {
    console.log('Password-based auth failed. Starting browser OAuth flow...');
    console.log('==> A browser window will open for you to log in via SSO <==');
    const browserResult = await authenticateBrowser(loginUrl);
    if (browserResult) return browserResult;
  }

  console.error('All Salesforce authentication methods failed.');
  if (!process.env.SF_CLIENT_ID) {
    console.error('Tip: For SSO orgs, set SF_CLIENT_ID and SF_CLIENT_SECRET in .env');
    console.error('Then visit http://localhost:3001/api/sf/login to authenticate via browser.');
  }
  return null;
}

async function authenticateOAuth(loginUrl, username, password) {
  const params = new URLSearchParams({
    grant_type: 'password',
    username,
    password,
  });

  if (process.env.SF_CLIENT_ID) {
    params.append('client_id', process.env.SF_CLIENT_ID);
    params.append('client_secret', process.env.SF_CLIENT_SECRET || '');
  }

  try {
    const response = await axios.post(`${loginUrl}/services/oauth2/token`, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    sfAuth = {
      access_token: response.data.access_token,
      instance_url: response.data.instance_url,
      refresh_token: response.data.refresh_token || null,
    };
    saveTokens();
    console.log(`Salesforce authenticated (OAuth). Instance: ${sfAuth.instance_url}`);
    return sfAuth;
  } catch (err) {
    const msg = err.response?.data?.error_description || err.response?.data?.error || err.message;
    console.warn(`Salesforce OAuth login failed: ${msg}`);
    return null;
  }
}

async function authenticateSOAP(loginUrl, username, password) {
  const soapBody = `<?xml version="1.0" encoding="utf-8" ?>
<env:Envelope xmlns:xsd="http://www.w3.org/2001/XMLSchema"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:env="http://schemas.xmlsoap.org/soap/envelope/">
  <env:Body>
    <n1:login xmlns:n1="urn:partner.soap.sforce.com">
      <n1:username>${username}</n1:username>
      <n1:password>${password}</n1:password>
    </n1:login>
  </env:Body>
</env:Envelope>`;

  try {
    const response = await axios.post(`${loginUrl}/services/Soap/u/58.0`, soapBody, {
      headers: {
        'Content-Type': 'text/xml',
        'SOAPAction': 'login',
      },
    });

    const body = response.data;
    const sessionMatch = body.match(/<sessionId>([^<]+)<\/sessionId>/);
    const serverMatch = body.match(/<serverUrl>([^<]+)<\/serverUrl>/);

    if (sessionMatch && serverMatch) {
      const serverUrl = serverMatch[1];
      const instanceUrl = serverUrl.match(/(https?:\/\/[^/]+)/)?.[1];

      sfAuth = {
        access_token: sessionMatch[1],
        instance_url: instanceUrl,
      };
      saveTokens();
      console.log(`Salesforce authenticated (SOAP). Instance: ${sfAuth.instance_url}`);
      return sfAuth;
    }

    console.warn('SOAP login response did not contain expected fields.');
    return null;
  } catch (err) {
    const msg = err.response?.data?.match?.(/<faultstring>([^<]+)<\/faultstring>/)?.[1] || err.message;
    console.warn(`Salesforce SOAP login failed: ${msg}`);
    sfAuth = null;
    return null;
  }
}

// Browser-based OAuth flow for SSO orgs
function authenticateBrowser(loginUrl) {
  return new Promise((resolve) => {
    const clientId = process.env.SF_CLIENT_ID;
    const callbackPort = 3456;
    const redirectUri = `http://localhost:${callbackPort}/callback`;

    // Start a temporary local server to receive the OAuth callback
    const server = http.createServer(async (req, res) => {
      const parsed = url.parse(req.url, true);

      if (parsed.pathname === '/callback' && parsed.query.code) {
        const code = parsed.query.code;

        try {
          // Exchange authorization code for tokens
          const params = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            client_id: clientId,
            client_secret: process.env.SF_CLIENT_SECRET || '',
            redirect_uri: redirectUri,
          });

          const response = await axios.post(`${loginUrl}/services/oauth2/token`, params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          });

          sfAuth = {
            access_token: response.data.access_token,
            instance_url: response.data.instance_url,
            refresh_token: response.data.refresh_token || null,
          };
          saveTokens();
          console.log(`Salesforce authenticated (Browser OAuth). Instance: ${sfAuth.instance_url}`);

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html><body><h2>Salesforce Connected!</h2><p>You can close this tab and return to the dashboard.</p><script>setTimeout(()=>window.close(),2000)</script></body></html>');

          server.close();
          resolve(sfAuth);
        } catch (err) {
          const msg = err.response?.data?.error_description || err.message;
          console.error(`Browser OAuth token exchange failed: ${msg}`);
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end(`<html><body><h2>Authentication Failed</h2><p>${msg}</p></body></html>`);
          server.close();
          resolve(null);
        }
      }
    });

    server.listen(callbackPort, () => {
      const authUrl = `${loginUrl}/services/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=api+refresh_token`;
      console.log(`\n========================================`);
      console.log(`Open this URL in your browser to connect Salesforce:`);
      console.log(`\n${authUrl}\n`);
      console.log(`========================================\n`);

      // Try to open browser automatically
      const open = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
      require('child_process').exec(`${open} "${authUrl}"`);
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      resolve(null);
    }, 300000);
  });
}

async function refreshAccessToken(loginUrl) {
  try {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: sfAuth.refresh_token,
      client_id: process.env.SF_CLIENT_ID,
      client_secret: process.env.SF_CLIENT_SECRET || '',
    });

    const response = await axios.post(`${loginUrl}/services/oauth2/token`, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    sfAuth.access_token = response.data.access_token;
    sfAuth.instance_url = response.data.instance_url;
    saveTokens();
    console.log('Salesforce token refreshed successfully.');
    return sfAuth;
  } catch (err) {
    console.warn(`Token refresh failed: ${err.response?.data?.error_description || err.message}`);
    return null;
  }
}

// Manual browser login route (call from Express app)
function getLoginUrl() {
  const loginUrl = process.env.SF_LOGIN_URL || 'https://login.salesforce.com';
  const clientId = process.env.SF_CLIENT_ID;
  if (!clientId) return null;
  const redirectUri = `http://localhost:3456/callback`;
  return `${loginUrl}/services/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=api+refresh_token`;
}

async function query(soql) {
  if (!sfAuth) {
    const auth = await authenticate();
    if (!auth) return null;
  }

  const queryUrl = `${sfAuth.instance_url}/services/data/v58.0/query`;

  try {
    const response = await axios.get(queryUrl, {
      params: { q: soql },
      headers: { Authorization: `Bearer ${sfAuth.access_token}` },
    });
    return response.data;
  } catch (err) {
    if (err.response?.status === 401) {
      console.log('Salesforce token expired, re-authenticating...');
      const auth = await authenticate();
      if (!auth) return null;

      const retry = await axios.get(queryUrl, {
        params: { q: soql },
        headers: { Authorization: `Bearer ${sfAuth.access_token}` },
      });
      return retry.data;
    }
    console.error(`Salesforce query failed: ${err.response?.data?.[0]?.message || err.message}`);
    return null;
  }
}

async function describeObject(objectName) {
  if (!sfAuth) {
    const auth = await authenticate();
    if (!auth) return null;
  }

  try {
    const response = await axios.get(
      `${sfAuth.instance_url}/services/data/v58.0/sobjects/${objectName}/describe`,
      { headers: { Authorization: `Bearer ${sfAuth.access_token}` } }
    );
    return response.data;
  } catch {
    return null;
  }
}

async function fetchProjects() {
  if (!sfAuth && !process.env.SF_USERNAME && !process.env.SF_CLIENT_ID) {
    return { projects: [], connected: false, error: 'Salesforce not configured' };
  }

  try {
    // Try custom Project__c object first
    const projectDesc = await describeObject('Project__c');
    let data;

    if (projectDesc) {
      data = await query(`
        SELECT Id, Name, Status__c, Start_Date__c, End_Date__c,
               Owner.Name, Budget__c, Actual_Cost__c,
               Completion__c, Priority__c, Department__c, Notes__c,
               LastModifiedDate
        FROM Project__c
        ORDER BY LastModifiedDate DESC
      `);
    }

    if (!data || !data.records) {
      // Fall back to Opportunity
      data = await query(`
        SELECT Id, Name, StageName, CloseDate, OwnerId, Owner.Name,
               Amount, Description, AccountId, Account.Name,
               CreatedDate, LastModifiedDate
        FROM Opportunity
        ORDER BY LastModifiedDate DESC
        LIMIT 200
      `);
    }

    if (!data || !data.records) {
      return { projects: [], connected: !!sfAuth, error: 'No project data returned' };
    }

    const projects = data.records.map(rec => mapSFRecord(rec, !!projectDesc));
    return { projects, connected: true, error: null };
  } catch (err) {
    return { projects: [], connected: false, error: err.message };
  }
}

function mapSFRecord(rec, isCustomObject) {
  if (isCustomObject) {
    return {
      id: rec.Id,
      source: 'salesforce',
      project_name: rec.Name || 'Unnamed',
      owner: rec.Owner?.Name || 'Unknown',
      status: rec.Status__c || '',
      start_date: rec.Start_Date__c ? new Date(rec.Start_Date__c) : null,
      end_date: rec.End_Date__c ? new Date(rec.End_Date__c) : null,
      budget: rec.Budget__c || null,
      spend_to_date: rec.Actual_Cost__c || null,
      completion_pct: rec.Completion__c || null,
      priority: rec.Priority__c || null,
      department: rec.Department__c || null,
      comments: rec.Notes__c || null,
      last_updated: rec.LastModifiedDate ? new Date(rec.LastModifiedDate) : new Date(),
    };
  }

  // Opportunity mapping
  return {
    id: rec.Id,
    source: 'salesforce',
    project_name: rec.Name || 'Unnamed',
    owner: rec.Owner?.Name || 'Unknown',
    status: rec.StageName || '',
    start_date: rec.CreatedDate ? new Date(rec.CreatedDate) : null,
    end_date: rec.CloseDate ? new Date(rec.CloseDate) : null,
    budget: rec.Amount || null,
    spend_to_date: null,
    completion_pct: null,
    priority: null,
    department: rec.Account?.Name || null,
    comments: rec.Description || null,
    last_updated: rec.LastModifiedDate ? new Date(rec.LastModifiedDate) : new Date(),
  };
}

function getConnectionStatus() {
  return {
    connected: !!sfAuth,
    instance_url: sfAuth?.instance_url || null,
    configured: !!(process.env.SF_USERNAME || process.env.SF_CLIENT_ID),
  };
}

module.exports = { authenticate, authenticateBrowser, fetchProjects, getConnectionStatus, getLoginUrl, query };
