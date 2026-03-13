import axios from 'axios';
import { logger } from '../utils/logger';

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8000';

interface ChatRequest {
  sessionId: string;
  message: string;
  emotionContext?: { state?: string; confidence?: number };
  personalityMode?: string;
  ollamaModel?: string;
}

interface ChatResponse {
  content: string;
  intent?: string;
  actions?: unknown[];
}

export const aiService = {
  async chat(request: ChatRequest): Promise<ChatResponse> {
    try {
      const res = await axios.post<ChatResponse>(`${AI_ENGINE_URL}/ai/chat`, request, {
        timeout: 60_000,
      });
      return res.data;
    } catch (err) {
      logger.error('AI Engine chat error:', err);
      throw new Error('AI Engine unavailable. Please ensure it is running on port 8000.');
    }
  },

  async classifyIntent(message: string): Promise<string> {
    try {
      const res = await axios.post<{ intent: string }>(`${AI_ENGINE_URL}/ai/intent`, { message }, {
        timeout: 10_000,
      });
      return res.data.intent;
    } catch {
      return 'chat.general';
    }
  },

  async detectEmotion(signals: object): Promise<{ state: string; confidence: number }> {
    try {
      const res = await axios.post<{ state: string; confidence: number }>(
        `${AI_ENGINE_URL}/ai/emotion`,
        signals,
        { timeout: 5_000 }
      );
      return res.data;
    } catch {
      return { state: 'neutral', confidence: 1.0 };
    }
  },

  async isHealthy(): Promise<boolean> {
    try {
      await axios.get(`${AI_ENGINE_URL}/health`, { timeout: 3_000 });
      return true;
    } catch {
      return false;
    }
  },
};
