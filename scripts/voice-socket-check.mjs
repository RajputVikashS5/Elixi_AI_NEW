import { io } from 'socket.io-client';
import process from 'node:process';
import { randomUUID } from 'node:crypto';

const backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:3001';
const voiceEngineUrl = process.env.VOICE_ENGINE_URL || 'http://127.0.0.1:8001';
const sessionId = randomUUID();
const expectedTranscript = `phase12-voice-${Date.now()}`;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)),
  ]);
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${url} failed: ${res.status} ${text}`);
  }

  return res.json();
}

async function run() {
  const socket = io(backendUrl, {
    transports: ['websocket'],
    reconnection: false,
    timeout: 8000,
  });

  let listeningSeen = false;

  try {
    await withTimeout(
      new Promise((resolve, reject) => {
        socket.once('connect', resolve);
        socket.once('connect_error', reject);
      }),
      10_000,
      'socket connect',
    );

    const transcriptPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Did not receive voice:transcript event from backend')); 
      }, 12_000);

      socket.on('voice:status', ({ status }) => {
        if (status === 'listening') {
          listeningSeen = true;
        }
      });

      socket.on('voice:transcript', ({ text, final }) => {
        if (text === expectedTranscript && final === true) {
          clearTimeout(timeout);
          resolve({ text, final });
        }
      });
    });

    socket.emit('voice:start', { sessionId });

    await delay(800);

    await postJson(`${voiceEngineUrl}/voice/transcript`, {
      sessionId,
      text: expectedTranscript,
      final: true,
    });

    const transcript = await withTimeout(transcriptPromise, 15_000, 'voice transcript forwarding');

    socket.emit('voice:stop', {});

    if (!listeningSeen) {
      throw new Error('voice:start did not produce a listening status update');
    }

    process.stdout.write(`voice-bridge-ok transcript=${transcript.text}\n`);
  } finally {
    socket.disconnect();
  }
}

run().catch((err) => {
  process.stderr.write(`voice-bridge-failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
