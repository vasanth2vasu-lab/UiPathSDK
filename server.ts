import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { UiPath } from '@uipath/uipath-typescript/core';
import { ConversationalAgent } from '@uipath/uipath-typescript/conversational-agent';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Validate environment variables
const requiredEnv = ['UIPATH_BASE_URL', 'UIPATH_ORG_NAME', 'UIPATH_TENANT_NAME', 'UIPATH_SECRET'];
const missing = requiredEnv.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`\n❌ Missing required environment variables in .env file:\n   ${missing.join(', ')}\n`);
  console.error('Create a .env file with:\n');
  console.error('   UIPATH_BASE_URL=https://cloud.uipath.com');
  console.error('   UIPATH_ORG_NAME=your-org-name');
  console.error('   UIPATH_TENANT_NAME=your-tenant-name');
  console.error('   UIPATH_SECRET=your-personal-access-token\n');
  process.exit(1);
}

// Initialize SDK
const sdk = new UiPath({
  baseUrl: process.env.UIPATH_BASE_URL!,
  orgName: process.env.UIPATH_ORG_NAME!,
  tenantName: process.env.UIPATH_TENANT_NAME!,
  secret: process.env.UIPATH_SECRET!
});

const conversationalAgent = new ConversationalAgent(sdk);

// Store active conversations
const activeConversations = new Map<string, any>();

// List all agents
app.get('/api/agents', async (_req, res) => {
  try {
    const agents = await conversationalAgent.getAll();
    res.json(agents.map((a: any) => ({
      id: a.id,
      name: a.name,
      description: a.description || '',
      folderId: a.folderId
    })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single agent details (with appearance)
app.get('/api/agents/:agentId', async (req, res) => {
  try {
    const agents = await conversationalAgent.getAll();
    const agent = agents.find((a: any) => String(a.id) === req.params.agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    // Try to get appearance details
    let appearance: any = {};
    try {
      const detail = await conversationalAgent.getById(agent.id);
      appearance = detail?.appearance || {};
    } catch (_) {}

    res.json({
      id: agent.id,
      name: agent.name,
      description: agent.description || '',
      folderId: agent.folderId,
      welcomeTitle: appearance.welcomeTitle || '',
      welcomeDescription: appearance.welcomeDescription || '',
      startingPrompts: (appearance.startingPrompts || []).map((p: any) => p.prompt || p.text || p)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create a conversation with an agent
app.post('/api/conversations', async (req, res) => {
  try {
    const { agentId, folderId, label } = req.body;
    const agents = await conversationalAgent.getAll();
    const agent = agents.find((a: any) => a.id === agentId);

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const conversation = await agent.conversations.create({ label: label || 'Web Chat' });
    res.json({ conversationId: conversation.id, label: conversation.label });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Store active sessions keyed by conversationId
const activeSessions = new Map<string, any>();

// Streaming chat endpoint using Server-Sent Events
app.post('/api/chat', async (req, res) => {
  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  let done = false;
  const finish = () => {
    if (!done) {
      done = true;
      sendEvent('done', {});
      res.end();
    }
  };

  const timeout = setTimeout(() => {
    console.error('Chat request timed out after 90s');
    sendEvent('error', { message: 'Request timed out.' });
    finish();
  }, 90000);

  try {
    const { conversationId } = req.body;
    const message = req.body.message;
    console.log(`\n--- Chat request (streaming) ---`);
    console.log(`message: "${message}"`);

    const conversation = await conversationalAgent.conversations.getById(conversationId);

    let session = activeSessions.get(conversationId);
    let needsSessionStart = false;

    if (!session || session.ended) {
      session = conversation.startSession();
      activeSessions.set(conversationId, session);
      needsSessionStart = true;

      conversationalAgent.onConnectionStatusChanged((status: any, error: any) => {
        console.log(`Connection: ${status}`, error ? `- ${error.message}` : '');
      });

      session.onErrorStart((error: any) => {
        console.error('Session error:', error);
        activeSessions.delete(conversationId);
      });

      session.onSessionEnd(() => {
        activeSessions.delete(conversationId);
      });
    }

    // Register handlers directly on the exchange - NOT on session.onExchangeStart
    // This avoids stale handler accumulation across HTTP requests
    const handleExchange = (exchange: any) => {
      exchange.onMessageStart((msg: any) => {
        if (msg.isAssistant) {
          msg.onContentPartStart((part: any) => {
            if (part.isMarkdown || part.isText || part.isHtml) {
              const format = part.isMarkdown ? 'markdown' : part.isHtml ? 'html' : 'text';
              part.onChunk((chunk: any) => {
                if (chunk.data) {
                  sendEvent('chunk', { text: chunk.data, format });
                }
                if (chunk.citation) {
                  sendEvent('citation', {
                    offset: chunk.citation.offset,
                    length: chunk.citation.length,
                    sources: chunk.citation.sources
                  });
                }
              });
              part.onCompleted?.((completed: any) => {
                if (completed.citations && completed.citations.length > 0) {
                  sendEvent('citations', {
                    citations: completed.citations.map((c: any) => ({
                      offset: c.offset,
                      length: c.length,
                      sources: c.sources?.map((s: any) => ({
                        url: s.url,
                        downloadUrl: s.downloadUrl,
                        title: s.title || s.name
                      })) || []
                    }))
                  });
                }
              });
            }
          });

          msg.onToolCallStart((toolCall: any) => {
            const toolName = toolCall.startEvent?.toolName ?? 'unknown';
            sendEvent('tool', { name: toolName, status: 'started' });
            toolCall.onToolCallEnd((_end: any) => {
              sendEvent('tool', { name: toolName, status: 'completed' });
            });
          });

          msg.onInterruptStart(({ interruptId }: any) => {
            msg.sendInterruptEnd(interruptId, { approved: true });
          });
        }
      });

      exchange.onExchangeEnd(() => {
        console.log('Exchange ended');
        clearTimeout(timeout);
        finish();
      });

      exchange.onErrorStart((error: any) => {
        console.error('Exchange error:', error);
        clearTimeout(timeout);
        sendEvent('error', { message: error.message || 'Exchange error' });
        finish();
      });
    };

    const sendUserMessage = () => {
      const exchange = session.startExchange();
      handleExchange(exchange);
      exchange.sendMessageWithContentPart({ data: message });
    };

    if (needsSessionStart) {
      session.onSessionStarted(() => {
        console.log('Session ready');
        sendUserMessage();
      });
    } else {
      sendUserMessage();
    }

    // Clean up on client disconnect
    req.on('close', () => {
      clearTimeout(timeout);
      done = true;
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    clearTimeout(timeout);
    sendEvent('error', { message: error.message });
    finish();
  }
});

// Serve the frontend
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
