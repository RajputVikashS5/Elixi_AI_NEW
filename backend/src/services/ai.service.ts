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

interface SemanticBrowseResult {
  id: string;
  content: string;
  score: number;
  source: string;
  metadata: Record<string, unknown>;
}

interface SemanticBrowseResponse {
  query: string;
  confidence_threshold: number;
  source_type: string | null;
  results: SemanticBrowseResult[];
  total: number;
}

interface HabitSummary {
  status: string;
  summary?: {
    total_habits: number;
    trigger_groups: Record<string, number>;
    last_updated: string | null;
  };
  message?: string;
}

interface HabitSuggestionDiagnosticsResponse {
  message: string;
  intent: string;
  entities: Record<string, unknown>;
  limit: number;
  include_ineligible: boolean;
  results: Array<{
    id: string;
    description: string;
    trigger: string;
    trigger_value: string;
    trigger_group: string | null;
    occurrences: number;
    auto_suggest: boolean;
    score: number;
    components: {
      trigger_match: number;
      trigger_value_match: number;
      entity_match: number;
      description_overlap: number;
      frequency: number;
      recency: number;
      metadata: number;
      pattern_group: number;
    };
    metadata: Record<string, unknown>;
    eligible: boolean;
    passes_threshold: boolean;
  }>;
  total: number;
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

  async semanticBrowse(
    query: string,
    options?: {
      confidenceThreshold?: number;
      sourceType?: string;
      limit?: number;
      sessionId?: string;
    }
  ): Promise<SemanticBrowseResponse> {
    try {
      const params = new URLSearchParams({
        query,
        confidence_threshold: String(options?.confidenceThreshold ?? 0),
        limit: String(options?.limit ?? 10),
      });
      if (options?.sourceType) {
        params.append('source_type', options.sourceType);
      }
      if (options?.sessionId) {
        params.append('session_id', options.sessionId);
      }

      const res = await axios.get<SemanticBrowseResponse>(
        `${AI_ENGINE_URL}/memory/semantic-browse?${params.toString()}`,
        { timeout: 15_000 }
      );
      return res.data;
    } catch (err) {
      logger.error('AI Engine semantic browse error:', err);
      console.error(err);
      throw new Error('Semantic browse failed. AI Engine may be unavailable.');
    }
  },

  async getHabitSummary(): Promise<HabitSummary> {
    try {
      const res = await axios.get<HabitSummary>(
        `${AI_ENGINE_URL}/memory/habit-summary`,
        { timeout: 10_000 }
      );
      return res.data;
    } catch (err) {
      logger.error('AI Engine habit summary error:', err);
      throw new Error('Failed to retrieve habit summary.');
    }
  },

  async triggerHabitSummarization(): Promise<unknown> {
    try {
      const res = await axios.post<unknown>(
        `${AI_ENGINE_URL}/memory/habit-summary/trigger`,
        {},
        { timeout: 30_000 }
      );
      return res.data;
    } catch (err) {
      logger.error('AI Engine habit summarization trigger error:', err);
      throw new Error('Failed to trigger habit summarization.');
    }
  },

  async getHabitSuggestionDiagnostics(options: {
    message: string;
    intent?: string;
    limit?: number;
    includeIneligible?: boolean;
    entities?: Record<string, unknown>;
  }): Promise<HabitSuggestionDiagnosticsResponse> {
    try {
      const params = new URLSearchParams({
        message: options.message,
        intent: options.intent ?? '',
        limit: String(options.limit ?? 20),
        include_ineligible: String(Boolean(options.includeIneligible)),
      });
      if (options.entities && Object.keys(options.entities).length > 0) {
        params.append('entities_json', JSON.stringify(options.entities));
      }

      const res = await axios.get<HabitSuggestionDiagnosticsResponse>(
        `${AI_ENGINE_URL}/memory/habit-suggestions/diagnostics?${params.toString()}`,
        { timeout: 15_000 }
      );
      return res.data;
    } catch (err) {
      logger.error('AI Engine habit diagnostics error:', err);
      throw new Error('Failed to retrieve habit suggestion diagnostics.');
    }
  },
};
