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

// Send a message and get response
app.post('/api/chat', async (req, res) => {
  let responded = false;

  const sendResponse = (status: number, data: any) => {
    if (!responded) {
      responded = true;
      res.status(status).json(data);
    }
  };

  // Timeout after 60 seconds
  const timeout = setTimeout(() => {
    console.error('Chat request timed out after 60s');
    sendResponse(504, { error: 'Request timed out. The agent may be unavailable.' });
  }, 60000);

  try {
    const { conversationId } = req.body;
    const message = req.body.message;
    console.log(`Chat request: conversationId=${conversationId}, message="${message}"`);

    const conversation = await conversationalAgent.conversations.getById(conversationId);
    const session = conversation.startSession();

    let responseText = '';

    // Monitor connection status
    conversationalAgent.onConnectionStatusChanged((status: any, error: any) => {
      console.log(`Connection status: ${status}`, error ? error.message : '');
    });

    session.onExchangeStart((exchange: any) => {
      console.log('Exchange started');
      exchange.onMessageStart((msg: any) => {
        console.log(`Message started - isAssistant: ${msg.isAssistant}`);
        if (msg.isAssistant) {
          msg.onContentPartStart((part: any) => {
            if (part.isMarkdown || part.isText) {
              part.onChunk((chunk: any) => {
                responseText += chunk.data ?? '';
              });
            }
          });

          msg.onCompleted(() => {
            console.log('Assistant message completed');
            clearTimeout(timeout);
            conversation.endSession();
            sendResponse(200, { response: responseText });
          });
        }
      });

      exchange.onErrorStart((error: any) => {
        console.error('Exchange error:', error);
        clearTimeout(timeout);
        conversation.endSession();
        sendResponse(500, { error: error.message || 'Exchange error' });
      });
    });

    session.onErrorStart((error: any) => {
      console.error('Session error:', error);
      clearTimeout(timeout);
      conversation.endSession();
      sendResponse(500, { error: error.message || 'Session error' });
    });

    session.onSessionStarted(() => {
      console.log('Session started, sending message...');
      const exchange = session.startExchange();
      exchange.sendMessageWithContentPart({ data: message });
    });

    session.onSessionEnd(() => {
      console.log('Session ended');
    });
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
