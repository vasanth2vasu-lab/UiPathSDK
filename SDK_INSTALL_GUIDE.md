# UiPath TypeScript SDK - Installation & Setup Guide

## Prerequisites

- **Node.js** 20.x or higher
- **npm** 8.x or higher (or yarn/pnpm)
- **TypeScript** 4.5+ (for TypeScript projects)

## Install the SDK

Choose your preferred package manager:

```bash
# npm
npm install @uipath/uipath-typescript

# yarn
yarn add @uipath/uipath-typescript

# pnpm
pnpm add @uipath/uipath-typescript
```

## Project Setup

### TypeScript Project

```bash
mkdir my-uipath-project && cd my-uipath-project
npm init -y
npm install typescript @types/node ts-node --save-dev
npx tsc --init
npm install @uipath/uipath-typescript
```

### JavaScript Project

```bash
mkdir my-uipath-project && cd my-uipath-project
npm init -y
npm install @uipath/uipath-typescript
```

## Authentication

The SDK supports two authentication methods.

### Option 1: Secret-based Authentication (PAT Token)

No `initialize()` call needed — the SDK is ready to use immediately.

1. Log in to [UiPath Cloud](https://cloud.uipath.com)
2. Go to **User Profile** > **Preferences** > **Personal Access Token**
3. Click **Create Token**, give it a name, expiration date, and relevant scopes
4. Create a `.env` file:

```env
UIPATH_BASE_URL=https://cloud.uipath.com
UIPATH_ORG_NAME=your-organization-name
UIPATH_TENANT_NAME=your-tenant-name
UIPATH_SECRET=your-pat-token
```

5. Use it in your code:

```typescript
import 'dotenv/config';
import { UiPath } from '@uipath/uipath-typescript/core';
import { Tasks } from '@uipath/uipath-typescript/tasks';

const sdk = new UiPath({
  baseUrl: process.env.UIPATH_BASE_URL!,
  orgName: process.env.UIPATH_ORG_NAME!,
  tenantName: process.env.UIPATH_TENANT_NAME!,
  secret: process.env.UIPATH_SECRET!
});

// Ready to use immediately
const tasks = new Tasks(sdk);
const allTasks = await tasks.getAll();
```

### Option 2: OAuth Authentication

Requires calling `initialize()` before using any SDK services.

1. In UiPath Cloud: **Admin** > **External Applications**
2. Click **Add Application** > **Non Confidential Application**
3. Configure: Name, Redirect URI (e.g., `http://localhost:3000`), and Scopes
4. Save and copy the **Client ID**

```typescript
import { UiPath } from '@uipath/uipath-typescript/core';

const sdk = new UiPath({
  baseUrl: 'https://cloud.uipath.com',
  orgName: 'your-organization',
  tenantName: 'your-tenant',
  clientId: 'your-client-id',
  redirectUri: 'http://localhost:3000',
  scope: 'OR.Tasks OR.DataService'
});

// MUST call initialize() for OAuth
await sdk.initialize();
```

## Import Patterns

### Tree-shakable Imports (Recommended)

Import only the services you need to keep your bundle small:

```typescript
import { UiPath } from '@uipath/uipath-typescript/core';
import { Assets } from '@uipath/uipath-typescript/assets';
import { Tasks } from '@uipath/uipath-typescript/tasks';
import { Buckets } from '@uipath/uipath-typescript/buckets';
import { Processes } from '@uipath/uipath-typescript/processes';
import { Queues } from '@uipath/uipath-typescript/queues';
import { Entities, ChoiceSets } from '@uipath/uipath-typescript/entities';
import { ConversationalAgent } from '@uipath/uipath-typescript/conversational-agent';
import { MaestroProcesses, ProcessInstances } from '@uipath/uipath-typescript/maestro-processes';
import { Cases, CaseInstances } from '@uipath/uipath-typescript/cases';
```

### Full Import

Includes all services but increases bundle size:

```typescript
import { UiPath } from '@uipath/uipath-typescript';

const sdk = new UiPath({ /* config */ });
const allTasks = await sdk.tasks.getAll();
```

## Quick Verification

Create `test-auth.ts` to verify your setup works:

```typescript
import 'dotenv/config';
import { UiPath } from '@uipath/uipath-typescript/core';
import { Assets } from '@uipath/uipath-typescript/assets';

async function testAuthentication() {
  const sdk = new UiPath({
    baseUrl: process.env.UIPATH_BASE_URL!,
    orgName: process.env.UIPATH_ORG_NAME!,
    tenantName: process.env.UIPATH_TENANT_NAME!,
    secret: process.env.UIPATH_SECRET!
  });

  try {
    const assets = new Assets(sdk);
    const allAssets = await assets.getAll();
    console.log('Authentication successful!');
    console.log(`Connected to ${process.env.UIPATH_ORG_NAME}/${process.env.UIPATH_TENANT_NAME}`);
    console.log(`Found ${allAssets.items.length} assets`);
  } catch (error) {
    console.error('Authentication failed:', error);
  }
}

testAuthentication();
```

Run it:

```bash
npx ts-node test-auth.ts
```

## Available Services

| Service | Import Path | Description |
|---------|-------------|-------------|
| Assets | `@uipath/uipath-typescript/assets` | Manage key-value configuration data and credentials |
| Tasks | `@uipath/uipath-typescript/tasks` | Manage Action Center tasks (create, assign, complete) |
| Processes | `@uipath/uipath-typescript/processes` | Manage and start automation processes |
| Queues | `@uipath/uipath-typescript/queues` | Manage work item queues |
| Buckets | `@uipath/uipath-typescript/buckets` | Manage cloud storage buckets and files |
| Entities | `@uipath/uipath-typescript/entities` | Manage Data Fabric entities and records |
| ChoiceSets | `@uipath/uipath-typescript/entities` | Manage Data Fabric choice sets |
| ConversationalAgent | `@uipath/uipath-typescript/conversational-agent` | Interact with AI-powered conversational agents |
| MaestroProcesses | `@uipath/uipath-typescript/maestro-processes` | Manage Maestro orchestration processes |
| ProcessInstances | `@uipath/uipath-typescript/maestro-processes` | Manage running Maestro process instances |
| Cases | `@uipath/uipath-typescript/cases` | Manage Maestro case management processes |
| CaseInstances | `@uipath/uipath-typescript/cases` | Manage running case instances |

## Retrieving Folders

The SDK does not include a dedicated Folders service. Use the Orchestrator REST API with the SDK's authentication token to retrieve all folders in your org:

```typescript
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

  const data = await response.json();

  for (const folder of data.value) {
    console.log(`ID: ${folder.Id} | Name: ${folder.DisplayName} | Path: ${folder.FullyQualifiedName}`);
  }

  return data.value;
}

getAllFolders();
```

Use the returned `Id` values as the `folderId` parameter required by services like Assets, Tasks, Processes, Queues, and Buckets.

## Pagination

All `getAll()` methods support optional pagination:

```typescript
// No pagination — returns all items
const all = await assets.getAll();

// Paginated — returns page with navigation cursors
const page1 = await assets.getAll({ pageSize: 10 });

// Navigate to next page
if (page1.hasNextPage) {
  const page2 = await assets.getAll({ cursor: page1.nextCursor });
}

// Jump to a specific page (where supported)
const page5 = await assets.getAll({ jumpToPage: 5, pageSize: 10 });
```

## Telemetry

The SDK collects basic usage data about method invocations to improve the developer experience. See the [UiPath privacy policy](https://www.uipath.com/legal/privacy-policy) for details.
