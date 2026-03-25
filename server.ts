import { webcrypto } from 'node:crypto';
Object.defineProperty(globalThis, 'crypto', {
  value: webcrypto,
  writable: true,
  configurable: true,
});

import 'dotenv/config';
import https from 'node:https';
import http from 'node:http';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { UiPath } from '@uipath/uipath-typescript/core';
import { ConversationalAgent } from '@uipath/uipath-typescript/conversational-agent';

const app = express();

// ─── 1. Validate environment variables ───
const requiredEnv = ['UIPATH_BASE_URL', 'UIPATH_ORG_NAME', 'UIPATH_TENANT_NAME', 'UIPATH_SECRET'];
const missing = requiredEnv.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`\n Missing required environment variables in .env file:\n   ${missing.join(', ')}\n`);
  console.error('Create a .env file with:\n');
  console.error('   UIPATH_BASE_URL=https://cloud.uipath.com');
  console.error('   UIPATH_ORG_NAME=your-org-name');
  console.error('   UIPATH_TENANT_NAME=your-tenant-name');
  console.error('   UIPATH_SECRET=your-personal-access-token');
  console.error('   API_KEY=your-api-key');
  console.error('   ALLOWED_ORIGIN=https://yourdomain.com');
  console.error('   SSL_CERT_PATH=./certs/cert.pem');
  console.error('   SSL_KEY_PATH=./certs/key.pem\n');
  process.exit(1);
}

// ─── 2. Security headers via Helmet ───
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// ─── 3. Locked-down CORS ───
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://localhost';
app.use(cors({
  origin: allowedOrigin,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'x-api-key'],
  credentials: true,
}));

// ─── 4. Request body size limit ───
app.use(express.json({ limit: '100kb' }));

// ─── 5. Serve static files ───
app.use(express.static(path.join(__dirname, 'public')));

// ─── 6. Trust proxy if behind reverse proxy ───
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// ─── 7. Rate limiting ───
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many chat requests. Please slow down.' },
});

const conversationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many conversation requests. Please try again later.' },
});

// ─── 8. API key authentication middleware ───
const API_KEY = process.env.API_KEY || '';

function authenticateApiKey(req: express.Request, res: express.Response, next: express.NextFunction): void {
  // Skip auth for static files and the main page
  if (!req.path.startsWith('/api/')) {
    next();
    return;
  }

  // If no API_KEY is configured, skip auth (dev mode)
  if (!API_KEY) {
    next();
    return;
  }

  const providedKey = req.headers['x-api-key'] as string;
  if (!providedKey || providedKey !== API_KEY) {
    res.status(401).json({ error: 'Unauthorized. Provide a valid x-api-key header.' });
    return;
  }
  next();
}

app.use(authenticateApiKey);

// ─── 9. Input validation helpers ───
function isValidString(val: unknown, maxLen: number): val is string {
  return typeof val === 'string' && val.length > 0 && val.length <= maxLen;
}

function isValidId(val: unknown): val is string | number {
  if (typeof val === 'number' && Number.isFinite(val)) return true;
  if (typeof val === 'string' && val.length > 0 && val.length <= 200) return true;
  return false;
}

function sanitizeLogMessage(msg: string): string {
  // Remove newlines and control chars to prevent log injection
  return msg.replace(/[\r\n\t]/g, ' ').substring(0, 200);
}

// ─── 10. Initialize SDK ───
const sdk = new UiPath({
  baseUrl: process.env.UIPATH_BASE_URL!,
  orgName: process.env.UIPATH_ORG_NAME!,
  tenantName: process.env.UIPATH_TENANT_NAME!,
  secret: process.env.UIPATH_SECRET!
});

const conversationalAgent = new ConversationalAgent(sdk);

// ─── 11. Session management with TTL-based eviction ───
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_SESSIONS = 100;

interface SessionEntry {
  session: any;
  lastActivity: number;
}

const activeSessions = new Map<string, SessionEntry>();

function cleanupStaleSessions(): void {
  const now = Date.now();
  for (const [id, entry] of activeSessions) {
    if (now - entry.lastActivity > SESSION_TTL_MS) {
      console.log(`Evicting stale session: ${id}`);
      activeSessions.delete(id);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupStaleSessions, 5 * 60 * 1000);

// ─── 12. Agent routing configuration ───
// Maps sub-agent display names (as returned by master agent) to their UiPath agent IDs.
// Configure these with your actual agent IDs from `npx tsx list-agents.ts`.
interface AgentRouteConfig {
  masterAgentId: string;           // UiPath agent ID of the master/router agent
  routes: Record<string, string>;  // mapping: lowercase route name → sub-agent ID
  fallbackAgentId?: string;        // fallback agent ID if no route matches
}

// Load routing config from environment or use defaults.
// Set MASTER_AGENT_ID, AGENT_ROUTES (JSON), and FALLBACK_AGENT_ID in .env
const agentRouteConfig: AgentRouteConfig = {
  masterAgentId: process.env.MASTER_AGENT_ID || '',
  routes: process.env.AGENT_ROUTES ? JSON.parse(process.env.AGENT_ROUTES) : {},
  fallbackAgentId: process.env.FALLBACK_AGENT_ID || '',
};

/**
 * Sends a message to the master agent and collects the full response (non-streaming).
 * The master agent should be configured to respond with JSON: {"targetAgent": "agent-name"}
 */
async function getMasterAgentRouting(message: string): Promise<{ targetAgent: string; fullResponse: string }> {
  const agents = await conversationalAgent.getAll();
  const masterAgent = agents.find((a: any) => String(a.id) === agentRouteConfig.masterAgentId);
  if (!masterAgent) {
    throw new Error('Master agent not found. Set MASTER_AGENT_ID in .env');
  }

  const conversation = await masterAgent.conversations.create({ label: 'Routing' });
  const session = conversation.startSession();

  return new Promise((resolve, reject) => {
    const routingTimeout = setTimeout(() => {
      reject(new Error('Master agent routing timed out after 30s'));
    }, 30000);

    session.onSessionStarted(() => {
      const exchange = session.startExchange();
      let fullResponse = '';

      exchange.onMessageStart((msg: any) => {
        if (msg.isAssistant) {
          msg.onContentPartStart((part: any) => {
            if (part.isMarkdown || part.isText || part.isHtml) {
              part.onChunk((chunk: any) => {
                if (chunk.data) fullResponse += chunk.data;
              });
            }
          });
        }
      });

      exchange.onExchangeEnd(() => {
        clearTimeout(routingTimeout);
        session.end?.();

        // Try to parse JSON from the response
        let targetAgent = '';
        try {
          // Look for JSON anywhere in the response
          const jsonMatch = fullResponse.match(/\{[\s\S]*?"targetAgent"\s*:\s*"([^"]+)"[\s\S]*?\}/);
          if (jsonMatch) {
            targetAgent = jsonMatch[1].toLowerCase().trim();
          } else {
            // Try full JSON parse
            const parsed = JSON.parse(fullResponse.trim());
            targetAgent = (parsed.targetAgent || parsed.target_agent || parsed.agent || '').toLowerCase().trim();
          }
        } catch (_) {
          // If not JSON, use the raw text trimmed as the agent name
          targetAgent = fullResponse.trim().toLowerCase();
        }

        resolve({ targetAgent, fullResponse });
      });

      exchange.onErrorStart((error: any) => {
        clearTimeout(routingTimeout);
        reject(new Error(`Master agent error: ${error.message || error}`));
      });

      exchange.sendMessageWithContentPart({ data: message });
    });

    session.onErrorStart((error: any) => {
      clearTimeout(routingTimeout);
      reject(new Error(`Master agent session error: ${error.message || error}`));
    });
  });
}

// ─── API Routes ───

// Get routing config (for frontend)
app.get('/api/routing/config', apiLimiter, (_req, res) => {
  res.json({
    enabled: !!agentRouteConfig.masterAgentId,
    masterAgentId: agentRouteConfig.masterAgentId,
    routes: Object.keys(agentRouteConfig.routes),
    fallbackAgentId: agentRouteConfig.fallbackAgentId || null,
  });
});

// List all agents
app.get('/api/agents', apiLimiter, async (_req, res) => {
  try {
    const agents = await conversationalAgent.getAll();
    res.json(agents.map((a: any) => ({
      id: a.id,
      name: a.name,
      description: a.description || '',
      folderId: a.folderId
    })));
  } catch (error: any) {
    console.error('Error listing agents:', error.message);
    res.status(500).json({ error: 'Failed to retrieve agents.' });
  }
});

// Get single agent details
app.get('/api/agents/:agentId', apiLimiter, async (req, res) => {
  try {
    const agentId = req.params.agentId;
    if (!isValidId(agentId)) {
      res.status(400).json({ error: 'Invalid agent ID.' });
      return;
    }

    const agents = await conversationalAgent.getAll();
    const agent = agents.find((a: any) => String(a.id) === agentId);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found.' });
      return;
    }

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
    console.error('Error getting agent:', error.message);
    res.status(500).json({ error: 'Failed to retrieve agent details.' });
  }
});

// Create a conversation
app.post('/api/conversations', conversationLimiter, async (req, res) => {
  try {
    const { agentId, label } = req.body;

    if (!isValidId(agentId)) {
      res.status(400).json({ error: 'Invalid or missing agentId.' });
      return;
    }
    if (label !== undefined && !isValidString(label, 100)) {
      res.status(400).json({ error: 'Invalid label.' });
      return;
    }

    const agents = await conversationalAgent.getAll();
    const agent = agents.find((a: any) => a.id === agentId);

    if (!agent) {
      res.status(404).json({ error: 'Agent not found.' });
      return;
    }

    const conversation = await agent.conversations.create({ label: label || 'Web Chat' });
    res.json({ conversationId: conversation.id, label: conversation.label });
  } catch (error: any) {
    console.error('Error creating conversation:', error.message);
    res.status(500).json({ error: 'Failed to create conversation.' });
  }
});

// Streaming chat endpoint using Server-Sent Events
app.post('/api/chat', chatLimiter, async (req, res) => {
  // ── Validate input ──
  const { conversationId, message } = req.body;

  if (!isValidId(conversationId)) {
    res.status(400).json({ error: 'Invalid or missing conversationId.' });
    return;
  }
  if (!isValidString(message, 10000)) {
    res.status(400).json({ error: 'Message is required and must be under 10,000 characters.' });
    return;
  }

  // ── Enforce max sessions ──
  if (activeSessions.size >= MAX_SESSIONS && !activeSessions.has(String(conversationId))) {
    cleanupStaleSessions();
    if (activeSessions.size >= MAX_SESSIONS) {
      res.status(503).json({ error: 'Server is at capacity. Please try again later.' });
      return;
    }
  }

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
    const convId = String(conversationId);
    console.log(`\n--- Chat request (streaming) ---`);
    console.log(`message: "${sanitizeLogMessage(message)}"`);

    const conversation = await conversationalAgent.conversations.getById(convId);

    let entry = activeSessions.get(convId);
    let needsSessionStart = false;

    if (!entry || entry.session.ended) {
      const session = conversation.startSession();
      entry = { session, lastActivity: Date.now() };
      activeSessions.set(convId, entry);
      needsSessionStart = true;

      conversationalAgent.onConnectionStatusChanged((status: any, error: any) => {
        console.log(`Connection: ${status}`, error ? `- ${error.message}` : '');
      });

      session.onErrorStart((error: any) => {
        console.error('Session error:', error.message || error);
        activeSessions.delete(convId);
      });

      session.onSessionEnd(() => {
        activeSessions.delete(convId);
      });
    } else {
      entry.lastActivity = Date.now();
    }

    const session = entry.session;

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
        console.error('Exchange error:', error.message || error);
        clearTimeout(timeout);
        sendEvent('error', { message: 'An error occurred while processing your message.' });
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

    req.on('close', () => {
      clearTimeout(timeout);
      done = true;
    });
  } catch (error: any) {
    console.error('Chat error:', error.message || error);
    clearTimeout(timeout);
    sendEvent('error', { message: 'Failed to process chat request.' });
    finish();
  }
});

// ─── Routed chat: Master agent classifies intent → routes to sub-agent ───
app.post('/api/chat/routed', chatLimiter, async (req, res) => {
  const { message } = req.body;

  if (!isValidString(message, 10000)) {
    res.status(400).json({ error: 'Message is required and must be under 10,000 characters.' });
    return;
  }

  if (!agentRouteConfig.masterAgentId) {
    res.status(400).json({ error: 'Master agent not configured. Set MASTER_AGENT_ID in .env' });
    return;
  }

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
    console.error('Routed chat timed out after 120s');
    sendEvent('error', { message: 'Request timed out.' });
    finish();
  }, 120000);

  try {
    // Step 1: Ask master agent to classify the intent
    console.log(`\n--- Routed chat request ---`);
    console.log(`message: "${sanitizeLogMessage(message)}"`);
    sendEvent('routing', { status: 'classifying', message: 'Analyzing your query...' });

    const { targetAgent, fullResponse } = await getMasterAgentRouting(message);
    console.log(`Master agent routed to: "${targetAgent}" (raw: "${sanitizeLogMessage(fullResponse)}")`);

    // Step 2: Resolve the target sub-agent ID
    let targetAgentId = agentRouteConfig.routes[targetAgent];

    if (!targetAgentId) {
      // Try partial matching against route keys
      const routeKeys = Object.keys(agentRouteConfig.routes);
      const match = routeKeys.find(key =>
        targetAgent.includes(key) || key.includes(targetAgent)
      );
      if (match) targetAgentId = agentRouteConfig.routes[match];
    }

    if (!targetAgentId) {
      targetAgentId = agentRouteConfig.fallbackAgentId || '';
    }

    if (!targetAgentId) {
      clearTimeout(timeout);
      sendEvent('routing', { status: 'no_match', targetAgent, message: `No sub-agent found for "${targetAgent}". Configure AGENT_ROUTES in .env` });
      sendEvent('error', { message: `Could not route query. Master agent suggested "${targetAgent}" but no matching sub-agent is configured.` });
      finish();
      return;
    }

    sendEvent('routing', { status: 'routed', targetAgent, targetAgentId });

    // Step 3: Create conversation with the target sub-agent and forward the original message
    const agents = await conversationalAgent.getAll();
    const subAgent = agents.find((a: any) => String(a.id) === targetAgentId);

    if (!subAgent) {
      clearTimeout(timeout);
      sendEvent('error', { message: `Sub-agent ${targetAgentId} not found.` });
      finish();
      return;
    }

    const subConversation = await subAgent.conversations.create({ label: 'Routed Chat' });
    const subSession = subConversation.startSession();

    sendEvent('routing', { status: 'connected', agentName: subAgent.name, conversationId: subConversation.id });

    // Store the sub-agent session for follow-up messages
    const subConvId = String(subConversation.id);

    subSession.onSessionStarted(() => {
      console.log(`Sub-agent session ready (${subAgent.name})`);
      const exchange = subSession.startExchange();

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
        console.log('Routed exchange ended');
        clearTimeout(timeout);

        // Store session for follow-ups via regular /api/chat
        activeSessions.set(subConvId, { session: subSession, lastActivity: Date.now() });
        sendEvent('session', { conversationId: subConvId, agentName: subAgent.name });
        finish();
      });

      exchange.onErrorStart((error: any) => {
        console.error('Sub-agent exchange error:', error.message || error);
        clearTimeout(timeout);
        sendEvent('error', { message: 'Sub-agent encountered an error.' });
        finish();
      });

      // Forward the original user message to the sub-agent
      exchange.sendMessageWithContentPart({ data: message });
    });

    subSession.onErrorStart((error: any) => {
      console.error('Sub-agent session error:', error.message || error);
      clearTimeout(timeout);
      sendEvent('error', { message: 'Failed to connect to sub-agent.' });
      finish();
    });

    req.on('close', () => {
      clearTimeout(timeout);
      done = true;
    });
  } catch (error: any) {
    console.error('Routed chat error:', error.message || error);
    clearTimeout(timeout);
    sendEvent('error', { message: error.message || 'Failed to route chat request.' });
    finish();
  }
});

// Serve the frontend
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve the Google-like search interface
app.get('/search', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'search.html'));
});

// ─── 12. HTTPS Server ───
const PORT = parseInt(process.env.PORT || '3000', 10);
const HTTP_PORT = parseInt(process.env.HTTP_PORT || '3080', 10);
const SSL_CERT = process.env.SSL_CERT_PATH || './certs/cert.pem';
const SSL_KEY = process.env.SSL_KEY_PATH || './certs/key.pem';

let certExists = false;
try {
  fs.accessSync(SSL_CERT, fs.constants.R_OK);
  fs.accessSync(SSL_KEY, fs.constants.R_OK);
  certExists = true;
} catch (_) {
  certExists = false;
}

if (certExists) {
  // Start HTTPS server
  const httpsServer = https.createServer({
    cert: fs.readFileSync(SSL_CERT),
    key: fs.readFileSync(SSL_KEY),
  }, app);

  httpsServer.listen(PORT, '0.0.0.0', () => {
    console.log(`HTTPS server running at https://0.0.0.0:${PORT}`);
  });

  // HTTP redirect server
  const httpRedirect = express();
  httpRedirect.use((req, res) => {
    const host = req.headers.host?.replace(`:${HTTP_PORT}`, `:${PORT}`) || `localhost:${PORT}`;
    res.redirect(301, `https://${host}${req.url}`);
  });
  http.createServer(httpRedirect).listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`HTTP redirect server running at http://0.0.0.0:${HTTP_PORT} -> HTTPS`);
  });
} else {
  // Fallback to HTTP if no certs (dev mode)
  console.warn('WARNING: SSL certificates not found. Running in HTTP mode (insecure).');
  console.warn(`         Place cert.pem and key.pem in ./certs/ or set SSL_CERT_PATH and SSL_KEY_PATH.`);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`HTTP server running at http://0.0.0.0:${PORT} (insecure - no TLS)`);
  });
}
