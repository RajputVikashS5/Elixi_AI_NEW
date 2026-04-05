import axios from 'axios';
import WebSocket from 'ws';
import { logger } from '../utils/logger';

const VOICE_ENGINE_URL = process.env.VOICE_ENGINE_URL || 'http://127.0.0.1:8001';
const VOICE_ENGINE_WS_URL = process.env.VOICE_ENGINE_WS_URL
  || VOICE_ENGINE_URL.replace(/^http/i, 'ws');

interface VoiceSessionState {
  active: boolean;
  sessionId?: string;
  wakeWordActive: boolean;
  status: 'idle' | 'listening' | 'processing' | 'speaking' | 'wake-word';
}

const state: VoiceSessionState = {
  active: false,
  wakeWordActive: false,
  status: 'idle',
};

interface VoiceStreamMessage {
  type?: string;
  sessionId?: string;
  text?: string;
  final?: boolean;
  status?: VoiceSessionState['status'];
  error?: string;
}

interface VoiceStreamHandlers {
  onTranscript: (payload: { text: string; final: boolean }) => void;
  onStatus: (payload: { status: VoiceSessionState['status'] }) => void;
  onError: (payload: { message: string }) => void;
}

interface VoiceAudioFrame {
  audioBase64: string;
  format: 'pcm_s16le' | 'wav';
  sampleRate: number;
  channels: number;
}

const streamConnections = new Map<string, WebSocket>();

function parseStreamPayload(data: WebSocket.RawData): VoiceStreamMessage | null {
  try {
    const text = typeof data === 'string' ? data : data.toString();
    return JSON.parse(text) as VoiceStreamMessage;
  } catch {
    return null;
  }
}

export const voiceService = {
  async getStatus() {
    let engineHealthy = false;
    let engineState: Record<string, unknown> = {};

    try {
      await axios.get(`${VOICE_ENGINE_URL}/health`, { timeout: 3000 });
      const statusRes = await axios.get(`${VOICE_ENGINE_URL}/voice/status`, { timeout: 3000 });
      engineState = statusRes.data;
      engineHealthy = true;
    } catch {
      engineHealthy = false;
    }

    if (typeof engineState.wakeWordActive === 'boolean') {
      state.wakeWordActive = Boolean(engineState.wakeWordActive);
      if (!state.active) {
        state.status = state.wakeWordActive ? 'wake-word' : 'idle';
      }
    }

    return {
      ...state,
      engineHealthy,
      engineState,
    };
  },

  async startSession(sessionId: string) {
    state.active = true;
    state.sessionId = sessionId;
    state.status = state.wakeWordActive ? 'wake-word' : 'listening';
    return { ...state };
  },

  async stopSession() {
    state.active = false;
    state.status = state.wakeWordActive ? 'wake-word' : 'idle';
    return { ...state };
  },

  async startStreamConnection(clientId: string, sessionId: string, handlers: VoiceStreamHandlers) {
    const existing = streamConnections.get(clientId);
    if (existing) {
      try {
        existing.send(JSON.stringify({ type: 'stop' }));
      } catch {
        // Ignore send failures while replacing stream.
      }

      try {
        existing.close();
      } catch {
        // Ignore close failures.
      }

      streamConnections.delete(clientId);
    }

    const streamUrl = `${VOICE_ENGINE_WS_URL}/voice/stream?sessionId=${encodeURIComponent(sessionId)}`;
    const ws = new WebSocket(streamUrl);
    streamConnections.set(clientId, ws);

    ws.on('open', () => {
      handlers.onStatus({ status: state.wakeWordActive ? 'wake-word' : 'listening' });
    });

    ws.on('message', (rawData) => {
      const payload = parseStreamPayload(rawData);
      if (!payload) return;

      if (payload.type === 'transcript') {
        handlers.onTranscript({
          text: payload.text || '',
          final: payload.final ?? true,
        });
      }

      if (payload.type === 'status' && payload.status) {
        handlers.onStatus({ status: payload.status });
      }

      if (payload.type === 'error' && payload.error) {
        handlers.onError({ message: payload.error });
      }
    });

    ws.on('error', (err) => {
      logger.error('Voice stream bridge error:', err);
      handlers.onError({ message: 'voice stream error' });
    });

    ws.on('close', () => {
      streamConnections.delete(clientId);
      handlers.onStatus({ status: state.wakeWordActive ? 'wake-word' : 'idle' });
    });
  },

  stopStreamConnection(clientId: string) {
    const ws = streamConnections.get(clientId);
    if (!ws) return;

    try {
      ws.send(JSON.stringify({ type: 'stop' }));
    } catch {
      // Ignore send failures while closing.
    }

    try {
      ws.close();
    } catch {
      // Ignore close failures.
    }

    streamConnections.delete(clientId);
  },

  sendAudioFrame(clientId: string, frame: VoiceAudioFrame) {
    const ws = streamConnections.get(clientId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      ws.send(JSON.stringify({
        type: 'audio',
        audioBase64: frame.audioBase64,
        format: frame.format,
        sampleRate: frame.sampleRate,
        channels: frame.channels,
      }));
      return true;
    } catch (error) {
      logger.warn('Failed to forward voice audio frame:', error);
      return false;
    }
  },

  async setWakeWord(active: boolean) {
    state.wakeWordActive = active;
    try {
      await axios.post(`${VOICE_ENGINE_URL}/voice/wake-word`, { active }, { timeout: 5000 });
    } catch (error) {
      logger.warn('Voice wake-word sync failed:', error);
    }
    if (!state.active) {
      state.status = active ? 'wake-word' : 'idle';
    } else if (active) {
      state.status = 'wake-word';
    } else if (state.status === 'wake-word') {
      state.status = 'listening';
    }
    return { ...state };
  },

  async synthesize(text: string) {
    const payload = { text };
    try {
      const res = await axios.post(`${VOICE_ENGINE_URL}/voice/tts`, payload, { timeout: 30000 });
      return res.data;
    } catch (error) {
      logger.warn('Voice TTS request failed on first attempt; retrying once', {
        voiceEngineUrl: VOICE_ENGINE_URL,
        error: error instanceof Error ? error.message : String(error),
      });
      const retryRes = await axios.post(`${VOICE_ENGINE_URL}/voice/tts`, payload, { timeout: 60000 });
      return retryRes.data;
    }
  },

  async getVoiceSettings() {
    const res = await axios.get(`${VOICE_ENGINE_URL}/voice/settings`, { timeout: 5000 });
    return res.data;
  },

  async updateVoiceSettings(settings: { rate?: number; volume?: number; voice_id?: string | null }) {
    const res = await axios.post(`${VOICE_ENGINE_URL}/voice/settings`, settings, { timeout: 5000 });
    return res.data;
  },

  async listVoices() {
    const res = await axios.get(`${VOICE_ENGINE_URL}/voice/voices`, { timeout: 10000 });
    return res.data;
  },

  async getCapabilities() {
    try {
      const res = await axios.get(`${VOICE_ENGINE_URL}/voice/capabilities`, { timeout: 5000 });
      return res.data;
    } catch (error) {
      logger.warn('Voice capabilities unavailable; returning degraded capability set', {
        voiceEngineUrl: VOICE_ENGINE_URL,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        status: 'degraded',
        available: false,
        stt: {
          whisper: false,
          whisperModel: null,
          vosk: false,
          windowsFallback: true,
        },
        tts: {
          pyttsx3: false,
          windowsFallback: true,
        },
        vad: {
          webrtcvad: false,
          rmsFallback: true,
        },
      };
    }
  },
};
