import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const TARGETS = {
  ui: 'http://127.0.0.1:5173',
  backendHealth: 'http://127.0.0.1:3001/health',
  aiHealth: 'http://127.0.0.1:8000/health',
  voiceHealth: 'http://127.0.0.1:8001/health',
  systemHealth: 'http://127.0.0.1:3001/api/system/health',
  voiceCapabilities: 'http://127.0.0.1:3001/api/voice/capabilities',
  aiChat: 'http://127.0.0.1:3001/ai/chat',
  chatMessage: 'http://127.0.0.1:3001/api/chat/message',
};

function now() {
  return new Date().toISOString();
}

function log(line) {
  console.log(`[${now()}] ${line}`);
}

async function withRetry(label, fn, { attempts = 10, delayMs = 1500 } = {}) {
  let lastErr;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      const value = await fn();
      return value;
    } catch (err) {
      lastErr = err;
      if (i < attempts) {
        log(`${label} retry ${i}/${attempts} failed: ${err.message}`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastErr;
}

async function checkGet(label, url) {
  const started = Date.now();
  const res = await fetch(url);
  const text = await res.text();
  const ms = Date.now() - started;
  return {
    label,
    ok: res.ok,
    status: res.status,
    ms,
    preview: text.slice(0, 180).replace(/\s+/g, ' '),
  };
}

async function checkPost(label, url, body) {
  const started = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const ms = Date.now() - started;
  return {
    label,
    ok: res.ok,
    status: res.status,
    ms,
    preview: text.slice(0, 220).replace(/\s+/g, ' '),
  };
}

function printResult(result) {
  const icon = result.ok ? 'PASS' : 'FAIL';
  log(`${icon} ${result.label} status=${result.status} duration=${result.ms}ms preview=${result.preview}`);
}

function parseEnvFile(filePath) {
  const parsed = {};
  if (!fs.existsSync(filePath)) {
    return parsed;
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith('#')) {
      continue;
    }
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) {
      continue;
    }
    const key = match[1];
    const value = (match[2] || '').replace(/^['"]|['"]$/g, '').trim();
    parsed[key] = value;
  }

  return parsed;
}

function resolveChatProvider() {
  const cwd = process.cwd();
  const backendEnv = parseEnvFile(path.join(cwd, 'backend', '.env'));
  const aiEnv = parseEnvFile(path.join(cwd, 'ai-engine', '.env'));

  const get = (name) => process.env[name] || backendEnv[name] || aiEnv[name] || '';
  const openrouterKey = get('OPENROUTER_API_KEY');
  const geminiKey = get('GEMINI_API_KEY');

  if (openrouterKey) {
    return {
      llmProvider: 'openrouter',
      onlineModel: get('OPENROUTER_MODEL') || 'meta-llama/llama-3-8b-instruct',
      mode: 'openrouter',
    };
  }

  if (geminiKey) {
    return {
      llmProvider: 'gemini',
      onlineModel: get('GEMINI_MODEL') || 'gemini-2.0-flash',
      mode: 'gemini',
    };
  }

  return {
    llmProvider: 'ollama',
    ollamaModel: 'llama3',
    mode: 'ollama',
  };
}

async function main() {
  log('Startup health check started');

  const results = [];

  const baseChecks = [
    ['UI (Vite)', TARGETS.ui],
    ['Backend Health', TARGETS.backendHealth],
    ['AI Engine Health', TARGETS.aiHealth],
    ['Voice Engine Health', TARGETS.voiceHealth],
    ['System Health API', TARGETS.systemHealth],
    ['Voice Capabilities API', TARGETS.voiceCapabilities],
  ];

  for (const [label, url] of baseChecks) {
    try {
      const result = await withRetry(label, () => checkGet(label, url));
      results.push(result);
      printResult(result);
    } catch (err) {
      const fail = {
        label,
        ok: false,
        status: 0,
        ms: 0,
        preview: err.message,
      };
      results.push(fail);
      printResult(fail);
    }
  }

  const sessionId = randomUUID();
  const providerSelection = resolveChatProvider();
  log(`Startup chat provider selection: ${providerSelection.mode}`);

  try {
    const aiResult = await checkPost('AI Chat API (/ai/chat)', TARGETS.aiChat, {
      message: 'Reply with STARTUP_CHECK_OK only.',
      personalityMode: 'professional',
      emotionContext: { state: 'neutral', confidence: 1 },
      llmProvider: providerSelection.llmProvider,
      ...(providerSelection.onlineModel ? { onlineModel: providerSelection.onlineModel } : {}),
      ...(providerSelection.ollamaModel ? { ollamaModel: providerSelection.ollamaModel } : {}),
      stream: false,
    });
    results.push(aiResult);
    printResult(aiResult);
  } catch (err) {
    const fail = { label: 'AI Chat API (/ai/chat)', ok: false, status: 0, ms: 0, preview: err.message };
    results.push(fail);
    printResult(fail);
  }

  try {
    const chatResult = await checkPost('Chat API (/api/chat/message)', TARGETS.chatMessage, {
      sessionId,
      message: 'Say hello in one short sentence.',
      personalityMode: 'professional',
      llmProvider: providerSelection.llmProvider,
      ...(providerSelection.onlineModel ? { onlineModel: providerSelection.onlineModel } : {}),
      ...(providerSelection.ollamaModel ? { ollamaModel: providerSelection.ollamaModel } : {}),
    });
    results.push(chatResult);
    printResult(chatResult);
  } catch (err) {
    const fail = { label: 'Chat API (/api/chat/message)', ok: false, status: 0, ms: 0, preview: err.message };
    results.push(fail);
    printResult(fail);
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  log(`Summary: passed=${passed} failed=${failed} total=${results.length}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  log(`FAIL startup health check crashed: ${err.message}`);
  process.exitCode = 1;
});
