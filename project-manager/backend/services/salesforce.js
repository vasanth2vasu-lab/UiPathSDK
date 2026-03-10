const axios = require('axios');

let sfAuth = null; // { access_token, instance_url }

async function authenticate() {
  const loginUrl = process.env.SF_LOGIN_URL || 'https://login.salesforce.com';
  const username = process.env.SF_USERNAME;
  const password = (process.env.SF_PASSWORD || '') + (process.env.SF_SECURITY_TOKEN || '');

  if (!username || !password) {
    console.warn('Salesforce credentials not configured. Skipping SF integration.');
    return null;
  }

  const params = new URLSearchParams({
    grant_type: 'password',
    username,
    password,
  });

  // Include client_id and client_secret only if provided
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
    };
    console.log(`Salesforce authenticated. Instance: ${sfAuth.instance_url}`);
    return sfAuth;
  } catch (err) {
    const msg = err.response?.data?.error_description || err.message;
    console.error(`Salesforce authentication failed: ${msg}`);
    sfAuth = null;
    return null;
  }
}

async function query(soql) {
  if (!sfAuth) {
    const auth = await authenticate();
    if (!auth) return null;
  }

  const url = `${sfAuth.instance_url}/services/data/v58.0/query`;

  try {
    const response = await axios.get(url, {
      params: { q: soql },
      headers: { Authorization: `Bearer ${sfAuth.access_token}` },
    });
    return response.data;
  } catch (err) {
    if (err.response?.status === 401) {
      // Token expired — re-authenticate and retry once
      console.log('Salesforce token expired, re-authenticating...');
      const auth = await authenticate();
      if (!auth) return null;

      const retry = await axios.get(url, {
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
  if (!sfAuth && !process.env.SF_USERNAME) {
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
    configured: !!process.env.SF_USERNAME,
  };
}

module.exports = { authenticate, fetchProjects, getConnectionStatus, query };
