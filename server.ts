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
    res.json(agents.map((a: any) => ({ id: a.id, name: a.name, folderId: a.folderId })));
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

// Send a message and get response
app.post('/api/chat', async (req, res) => {
  let responded = false;

  const sendResponse = (status: number, data: any) => {
    if (!responded) {
      responded = true;
      res.status(status).json(data);
    }
  };

  const timeout = setTimeout(() => {
    console.error('Chat request timed out after 90s');
    sendResponse(504, { error: 'Request timed out. The agent may be unavailable.' });
  }, 90000);

  try {
    const { conversationId } = req.body;
    const message = req.body.message;
    console.log(`\n--- Chat request ---`);
    console.log(`conversationId: ${conversationId}`);
    console.log(`message: "${message}"`);

    const conversation = await conversationalAgent.conversations.getById(conversationId);

    // Reuse existing session or create new one
    let session = activeSessions.get(conversationId);
    let needsSessionStart = false;

    if (!session || session.ended) {
      console.log('Creating new session...');
      session = conversation.startSession();
      activeSessions.set(conversationId, session);
      needsSessionStart = true;

      conversationalAgent.onConnectionStatusChanged((status: any, error: any) => {
        console.log(`Connection: ${status}`, error ? `- ${error.message}` : '');
      });
    } else {
      console.log('Reusing existing session');
    }

    let responseText = '';

    // Helper to register exchange handlers
    const handleExchange = (exchange: any) => {
      console.log(`Exchange started: ${exchange.exchangeId}`);

      exchange.onMessageCompleted((completed: any) => {
        console.log(`Message completed - role: ${completed.role}, parts: ${completed.contentParts?.length}`);
        if (completed.role === 'assistant' || completed.role === 'Assistant') {
          for (const part of completed.contentParts || []) {
            responseText += part.data ?? '';
          }
          console.log(`Response: ${responseText.substring(0, 200)}`);
          clearTimeout(timeout);
          sendResponse(200, { response: responseText });
        }
      });

      exchange.onMessageStart((msg: any) => {
        console.log(`Message - role: ${msg.role}, isAssistant: ${msg.isAssistant}`);
        if (msg.isAssistant) {
          msg.onContentPartStart((part: any) => {
            console.log(`Content part: mimeType=${part.mimeType}`);
            part.onChunk((chunk: any) => {
              process.stdout.write('.');
            });
          });

          msg.onToolCallStart((toolCall: any) => {
            console.log(`Tool call: ${toolCall.startEvent?.toolName}`);
            toolCall.onToolCallEnd((end: any) => {
              console.log(`Tool result: ${end.output?.substring(0, 100)}`);
            });
          });

          msg.onInterruptStart(({ interruptId, startEvent }: any) => {
            console.log(`Interrupt: ${startEvent.type}`);
            msg.sendInterruptEnd(interruptId, { approved: true });
          });
        }
      });

      exchange.onExchangeEnd(() => {
        console.log('\nExchange ended');
        if (!responded && responseText) {
          clearTimeout(timeout);
          sendResponse(200, { response: responseText });
        }
      });

      exchange.onErrorStart((error: any) => {
        console.error('Exchange error:', error);
        clearTimeout(timeout);
        sendResponse(500, { error: error.message || 'Exchange error' });
      });
    };

    // Listen for exchanges triggered by the server (response to our message)
    session.onExchangeStart(handleExchange);

    session.onErrorStart((error: any) => {
      console.error('Session error:', error);
      clearTimeout(timeout);
      activeSessions.delete(conversationId);
      sendResponse(500, { error: error.message || 'Session error' });
    });

    session.onSessionEnd(() => {
      console.log('Session ended');
      activeSessions.delete(conversationId);
    });

    const sendUserMessage = () => {
      console.log('Sending message to agent...');
      const exchange = session.startExchange();
      // Register handlers on the exchange we created too
      handleExchange(exchange);
      exchange.sendMessageWithContentPart({ data: message });
      console.log('Message sent, waiting for response...');
    };

    if (needsSessionStart) {
      session.onSessionStarted(() => {
        console.log('Session ready');
        sendUserMessage();
      });
    } else {
      sendUserMessage();
    }
  } catch (error: any) {
    console.error('Chat error:', error);
    clearTimeout(timeout);
    sendResponse(500, { error: error.message });
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
