import { UiPath } from '@uipath/uipath-typescript';
import { ConversationalAgent } from '@uipath/uipath-typescript/conversational-agent';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import './style.css';

// ─── Markdown config ───
marked.setOptions({ breaks: true, gfm: true });

const PURIFY_CONFIG = {
  ALLOWED_TAGS: ['p','br','strong','em','b','i','u','a','code','pre','blockquote',
    'ul','ol','li','h1','h2','h3','h4','h5','h6','table','thead','tbody',
    'tr','th','td','hr','span','div','img','sup','sub','del','s'],
  ALLOWED_ATTR: ['href','target','rel','src','alt','class','style'],
  ALLOW_DATA_ATTR: false,
  ADD_ATTR: ['target'],
};

function renderMarkdown(text: string): string {
  if (!text) return '';
  const html = marked.parse(text) as string;
  return DOMPurify.sanitize(html, PURIFY_CONFIG);
}

function escapeHtml(str: string): string {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Colors ───
const COLORS = ['#fa4616','#2563eb','#16a34a','#9333ea','#ea580c','#0891b2','#db2777','#475569','#92400e','#4f46e5'];
function agentColor(i: number): string { return COLORS[i % COLORS.length]!; }

// ─── State ───
let sdk: UiPath;
let conversationalAgent: ConversationalAgent;
let allAgents: any[] = [];
let currentAgent: any = null;
let currentAgentIndex = -1;
let conversationId: string | null = null;
let autoScroll = true;
let activeSession: any = null;

// ─── Render the app shell ───
document.getElementById('app')!.innerHTML = `
<div class="app">
  <aside class="sidebar">
    <div class="sidebar-header">
      <div class="sidebar-brand">
        <div class="sidebar-logo">U</div>
        <span class="sidebar-title">Agent Hub</span>
      </div>
      <input class="sidebar-search" type="text" id="search-input" placeholder="Search agents..." />
    </div>
    <div class="sidebar-label">Agents</div>
    <div class="agent-list" id="agent-list"></div>
    <div class="agent-count" id="agent-count"></div>
  </aside>
  <div class="main">
    <div class="empty-state" id="empty-state">
      <div class="empty-inner">
        <div class="empty-icon">&#9670;</div>
        <h2>Welcome to Agent Hub</h2>
        <p>Select an agent from the sidebar to start a conversation.</p>
      </div>
    </div>
    <div id="chat-view" style="display:none; flex-direction:column; height:100%;">
      <div class="chat-topbar">
        <div class="chat-topbar-dot" id="chat-topbar-dot"></div>
        <div class="chat-topbar-info">
          <div class="chat-topbar-name" id="chat-topbar-name"></div>
          <div class="chat-topbar-status" id="chat-topbar-status"><span class="status-dot"></span> Online</div>
        </div>
      </div>
      <div id="messages"></div>
      <div class="chat-input-area">
        <input type="text" id="message-input" placeholder="Type a message..." autocomplete="off" />
        <button class="send-btn" id="send-btn">Send</button>
      </div>
    </div>
  </div>
</div>
`;

const messagesEl = document.getElementById('messages')!;
const searchInput = document.getElementById('search-input') as HTMLInputElement;
const messageInput = document.getElementById('message-input') as HTMLInputElement;
const sendBtn = document.getElementById('send-btn') as HTMLButtonElement;

messagesEl.addEventListener('scroll', () => {
  autoScroll = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 40;
});

function scrollToBottom(smooth = true) {
  if (!autoScroll) return;
  messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
}

// ─── Initialize SDK ───
async function initSDK() {
  sdk = new UiPath();
  await sdk.initialize();
  conversationalAgent = new ConversationalAgent(sdk);
}

// ─── Load + Render Sidebar ───
async function loadAgents() {
  try {
    allAgents = await conversationalAgent.getAll();
    renderAgentList(allAgents);
  } catch (err) {
    document.getElementById('agent-list')!.innerHTML =
      '<div style="color:#f87171;padding:12px;font-size:12px;">Failed to load agents</div>';
  }
}

function renderAgentList(agents: any[]) {
  const list = document.getElementById('agent-list')!;
  if (agents.length === 0) {
    list.innerHTML = '<div style="color:var(--gray-500);padding:14px;font-size:12px;text-align:center;">No agents found</div>';
    document.getElementById('agent-count')!.textContent = '';
    return;
  }
  list.innerHTML = agents.map((agent: any) => {
    const idx = allAgents.indexOf(agent);
    const color = agentColor(idx);
    const initials = agent.name.split(/\s+/).map((w: string) => w[0]).join('').substring(0, 2).toUpperCase();
    const desc = agent.description || 'Ready to assist';
    const active = idx === currentAgentIndex ? ' active' : '';
    return `
      <div class="agent-item${active}" data-index="${idx}" title="${escapeHtml(agent.name)}">
        <div class="agent-dot" style="background:${color}">${initials}</div>
        <div class="agent-item-info">
          <div class="agent-item-name">${escapeHtml(agent.name)}</div>
          <div class="agent-item-desc">${escapeHtml(desc)}</div>
        </div>
      </div>`;
  }).join('');
  document.getElementById('agent-count')!.textContent = `${allAgents.length} agent${allAgents.length !== 1 ? 's' : ''} available`;

  // Attach click handlers
  list.querySelectorAll('.agent-item').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt((el as HTMLElement).dataset.index || '0');
      openAgent(idx);
    });
  });
}

function filterAgents() {
  const q = searchInput.value.toLowerCase().trim();
  if (!q) { renderAgentList(allAgents); return; }
  renderAgentList(allAgents.filter((a: any) =>
    a.name.toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q)
  ));
}

// ─── Open Agent ───
async function openAgent(index: number) {
  if (index === currentAgentIndex) return;

  // End previous session
  if (activeSession) {
    try { activeSession.end?.(); } catch (_) {}
    activeSession = null;
  }

  currentAgent = allAgents[index];
  currentAgentIndex = index;
  conversationId = null;

  const color = agentColor(index);
  const initials = currentAgent.name.split(/\s+/).map((w: string) => w[0]).join('').substring(0, 2).toUpperCase();

  renderAgentList(allAgents);

  // Show chat view
  document.getElementById('empty-state')!.style.display = 'none';
  document.getElementById('chat-view')!.style.display = 'flex';

  // Update topbar
  (document.getElementById('chat-topbar-dot') as HTMLElement).style.background = color;
  document.getElementById('chat-topbar-dot')!.textContent = initials;
  document.getElementById('chat-topbar-name')!.textContent = currentAgent.name;
  document.getElementById('chat-topbar-status')!.innerHTML = '<div class="mini-spinner" style="width:10px;height:10px;border-width:1.5px;"></div> Connecting...';
  messagesEl.innerHTML = '<div class="loading-center"><div class="mini-spinner"></div> Starting conversation...</div>';

  const openingIndex = currentAgentIndex;

  try {
    // Create conversation directly via SDK
    const conversation = await currentAgent.conversations.create({ label: 'Web Chat' });
    if (currentAgentIndex !== openingIndex) return;

    conversationId = conversation.id;
    document.getElementById('chat-topbar-status')!.innerHTML = '<span class="status-dot"></span> Online';

    // Get agent appearance for welcome message
    let appearance: any = {};
    try {
      const detail = await conversationalAgent.getById(currentAgent.id, currentAgent.folderId);
      appearance = (detail as any)?.appearance || {};
    } catch (_) {}

    const title = appearance.welcomeTitle || ('Chat with ' + currentAgent.name);
    const desc = appearance.welcomeDescription || currentAgent.description || 'Ask anything to get started.';
    const prompts = (appearance.startingPrompts || []).map((p: any) => p.prompt || p.text || p);

    let promptsHtml = '';
    if (prompts.length > 0) {
      promptsHtml = '<div class="prompt-chips">' +
        prompts.map((p: string) => `<button class="prompt-chip">${escapeHtml(p)}</button>`).join('') +
        '</div>';
    }

    messagesEl.innerHTML = `
      <div class="chat-welcome">
        <div class="cw-icon" style="background:${color}">${initials}</div>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(desc)}</p>
        ${promptsHtml}
      </div>`;

    // Attach prompt chip handlers
    messagesEl.querySelectorAll('.prompt-chip').forEach(el => {
      el.addEventListener('click', () => {
        messageInput.value = el.textContent || '';
        sendMessage();
      });
    });

    messageInput.focus();
  } catch (err) {
    if (currentAgentIndex !== openingIndex) return;
    messagesEl.innerHTML = '<div class="error-msg">Failed to start conversation.</div>';
    document.getElementById('chat-topbar-status')!.innerHTML = '<span style="color:#ef4444;">Disconnected</span>';
  }
}

// ─── Chat Helpers ───
function addMessage(text: string, role: string): HTMLElement {
  const welcome = messagesEl.querySelector('.chat-welcome');
  if (welcome) welcome.remove();

  const row = document.createElement('div');
  row.className = 'message-row ' + role;

  const avatar = document.createElement('div');
  avatar.className = 'avatar ' + (role === 'user' ? 'human' : 'bot');
  avatar.textContent = role === 'user' ? 'U' : 'A';

  const bubble = document.createElement('div');
  bubble.className = 'message ' + role;
  if (role === 'user') {
    bubble.textContent = text;
  } else {
    bubble.innerHTML = text ? renderMarkdown(text) : '';
  }

  row.appendChild(avatar);
  row.appendChild(bubble);
  messagesEl.appendChild(row);

  const timeEl = document.createElement('div');
  timeEl.className = 'msg-time' + (role === 'user' ? ' user' : '');
  timeEl.textContent = formatTime(new Date());
  messagesEl.appendChild(timeEl);

  autoScroll = true;
  scrollToBottom(false);
  return bubble;
}

function showTypingIndicator() {
  removeTypingIndicator();
  const el = document.createElement('div');
  el.className = 'typing-indicator';
  el.id = 'typing-dots';
  el.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
  messagesEl.appendChild(el);
  scrollToBottom();
}

function removeTypingIndicator() {
  document.getElementById('typing-dots')?.remove();
}

function showToolIndicator(name: string) {
  removeToolIndicator();
  const el = document.createElement('div');
  el.className = 'tool-indicator';
  el.id = 'tool-active';
  el.innerHTML = '<div class="tool-spinner"></div> Using <strong>' + escapeHtml(name) + '</strong>...';
  messagesEl.appendChild(el);
  scrollToBottom();
}

function removeToolIndicator() {
  document.getElementById('tool-active')?.remove();
}

// ─── Send Message via SDK (client-side, no server needed) ───
async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || !conversationId) return;

  messageInput.value = '';
  addMessage(text, 'user');
  sendBtn.disabled = true;
  messageInput.disabled = true;
  showTypingIndicator();

  const requestAgentIndex = currentAgentIndex;

  try {
    const conversation = await conversationalAgent.conversations.getById(conversationId);

    // Start or reuse session
    if (!activeSession || activeSession.ended) {
      activeSession = conversation.startSession();
      await new Promise<void>((resolve, reject) => {
        activeSession.onSessionStarted(() => resolve());
        activeSession.onErrorStart((err: any) => reject(err));
      });
    }

    const session = activeSession;
    const exchange = session.startExchange();

    let assistantEl: HTMLElement | null = null;
    let currentText = '';
    let citations: any[] = [];
    let firstChunk = true;

    await new Promise<void>((resolve, reject) => {
      exchange.onMessageStart((msg: any) => {
        if (msg.isAssistant) {
          msg.onContentPartStart((part: any) => {
            if (part.isMarkdown || part.isText || part.isHtml) {
              const format = part.isMarkdown ? 'markdown' : part.isHtml ? 'html' : 'text';
              part.onChunk((chunk: any) => {
                if (currentAgentIndex !== requestAgentIndex) return;
                if (chunk.data) {
                  if (firstChunk) {
                    removeTypingIndicator();
                    removeToolIndicator();
                    assistantEl = addMessage('', 'assistant');
                    firstChunk = false;
                  }
                  currentText += chunk.data;
                  if (assistantEl) {
                    assistantEl.innerHTML = renderMarkdown(currentText);
                    scrollToBottom();
                  }
                }
                if (chunk.citation) {
                  citations.push(chunk.citation);
                }
              });
              part.onCompleted?.((completed: any) => {
                if (completed.citations?.length > 0) {
                  citations = citations.concat(completed.citations);
                }
              });
            }
          });

          msg.onToolCallStart((toolCall: any) => {
            const toolName = toolCall.startEvent?.toolName ?? 'unknown';
            removeTypingIndicator();
            showToolIndicator(toolName);
            toolCall.onToolCallEnd(() => {
              removeToolIndicator();
              showTypingIndicator();
            });
          });

          msg.onInterruptStart(({ interruptId }: any) => {
            msg.sendInterruptEnd(interruptId, { approved: true });
          });
        }
      });

      exchange.onExchangeEnd(() => {
        removeTypingIndicator();
        removeToolIndicator();

        // Add citation bar
        if (assistantEl && citations.length > 0) {
          const bar = document.createElement('div');
          bar.className = 'citation-bar';
          const seen = new Set<string>();
          citations.forEach((c: any) => {
            (c.sources || []).forEach((s: any) => {
              const url = s.url || s.downloadUrl;
              const title = s.title || s.name || 'Source';
              if (url && !seen.has(url)) {
                seen.add(url);
                const a = document.createElement('a');
                a.className = 'citation-link';
                a.href = url;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                a.textContent = title;
                bar.appendChild(a);
              }
            });
          });
          if (bar.children.length > 0) assistantEl.appendChild(bar);
        }

        if (!currentText && firstChunk) {
          removeTypingIndicator();
          addMessage('No response from agent. Please try again.', 'assistant');
        }

        resolve();
      });

      exchange.onErrorStart((error: any) => {
        removeTypingIndicator();
        removeToolIndicator();
        if (!assistantEl) assistantEl = addMessage('', 'assistant');
        assistantEl!.innerHTML = '<span style="color:#c00">Error: ' + escapeHtml(error.message || 'Unknown error') + '</span>';
        resolve();
      });

      exchange.sendMessageWithContentPart({ data: text });
    });

  } catch (err: any) {
    if (currentAgentIndex === requestAgentIndex) {
      removeTypingIndicator();
      removeToolIndicator();
      addMessage('Failed to get response: ' + (err.message || 'Unknown error'), 'assistant');
    }
  }

  if (currentAgentIndex === requestAgentIndex) {
    sendBtn.disabled = false;
    messageInput.disabled = false;
    messageInput.focus();
  }
}

// ─── Event listeners ───
searchInput.addEventListener('input', filterAgents);
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// ─── Boot ───
(async () => {
  try {
    await initSDK();
    await loadAgents();
  } catch (err: any) {
    document.getElementById('app')!.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#666;">
        <div style="text-align:center;max-width:400px;">
          <h2 style="color:#c00;margin-bottom:8px;">SDK Initialization Failed</h2>
          <p>${escapeHtml(err.message || 'Could not connect to UiPath')}</p>
        </div>
      </div>`;
  }
})();
