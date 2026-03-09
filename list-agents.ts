import 'dotenv/config';
import { UiPath } from '@uipath/uipath-typescript/core';
import { ConversationalAgent } from '@uipath/uipath-typescript/conversational-agent';

async function listAgents() {
  const sdk = new UiPath({
    baseUrl: process.env.UIPATH_BASE_URL!,
    orgName: process.env.UIPATH_ORG_NAME!,
    tenantName: process.env.UIPATH_TENANT_NAME!,
    secret: process.env.UIPATH_SECRET!
  });

  const conversationalAgent = new ConversationalAgent(sdk);
  const agents = await conversationalAgent.getAll();

  console.log(`Found ${agents.length} agents:\n`);
  for (const agent of agents) {
    console.log(`Name: ${agent.name} | ID: ${agent.id}`);
  }
}

listAgents();
