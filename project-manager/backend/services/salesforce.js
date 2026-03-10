const axios = require('axios');

let sfAuth = null; // { access_token, instance_url }

// Try OAuth Username-Password flow first, fall back to SOAP login
async function authenticate() {
  const loginUrl = process.env.SF_LOGIN_URL || 'https://login.salesforce.com';
  const username = process.env.SF_USERNAME;
  const password = (process.env.SF_PASSWORD || '') + (process.env.SF_SECURITY_TOKEN || '');

  if (!username || !password) {
    console.warn('Salesforce credentials not configured. Skipping SF integration.');
    return null;
  }

  // Attempt 1: OAuth Username-Password flow
  const oauthResult = await authenticateOAuth(loginUrl, username, password);
  if (oauthResult) return oauthResult;

  // Attempt 2: SOAP login (works when OAuth password flow is disabled)
  console.log('OAuth password flow failed. Trying SOAP login...');
  const soapResult = await authenticateSOAP(loginUrl, username, password);
  if (soapResult) return soapResult;

  console.error('All Salesforce authentication methods failed.');
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
    };
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
    // Parse session ID and server URL from SOAP response
    const sessionMatch = body.match(/<sessionId>([^<]+)<\/sessionId>/);
    const serverMatch = body.match(/<serverUrl>([^<]+)<\/serverUrl>/);

    if (sessionMatch && serverMatch) {
      const serverUrl = serverMatch[1];
      // Extract instance URL from server URL (e.g., https://na1.salesforce.com)
      const instanceUrl = serverUrl.match(/(https?:\/\/[^/]+)/)?.[1];

      sfAuth = {
        access_token: sessionMatch[1],
        instance_url: instanceUrl,
      };
      console.log(`Salesforce authenticated (SOAP). Instance: ${sfAuth.instance_url}`);
      return sfAuth;
    }

    console.warn('SOAP login response did not contain expected fields.');
    return null;
  } catch (err) {
    const msg = err.response?.data?.match?.(/<faultstring>([^<]+)<\/faultstring>/)?.[1] || err.message;
    console.error(`Salesforce SOAP login failed: ${msg}`);
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
