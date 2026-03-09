import 'dotenv/config';
import { UiPath } from '@uipath/uipath-typescript/core';

async function getAllFolders() {
  const sdk = new UiPath({
    baseUrl: process.env.UIPATH_BASE_URL!,
    orgName: process.env.UIPATH_ORG_NAME!,
    tenantName: process.env.UIPATH_TENANT_NAME!,
    secret: process.env.UIPATH_SECRET!
  });

  const token = sdk.getToken();
  const url = `${process.env.UIPATH_BASE_URL}/${process.env.UIPATH_ORG_NAME}/${process.env.UIPATH_TENANT_NAME}/orchestrator_/odata/Folders`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch folders: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  console.log(`Found ${data.value.length} folders:\n`);
  for (const folder of data.value) {
    console.log(`ID: ${folder.Id} | Name: ${folder.DisplayName} | Path: ${folder.FullyQualifiedName}`);
  }

  return data.value;
}

getAllFolders();
