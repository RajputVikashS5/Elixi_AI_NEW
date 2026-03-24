import axios from 'axios';
import { logger } from '../utils/logger';

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8000';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OLLAMA_API_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const PROVIDER_TIMEOUT_MS = 10_000;
const PROVIDER_RETRIES = 1;
const GEMINI_MODEL_CANDIDATES = [
  process.env.GEMINI_MODEL,
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
].filter((model): model is string => Boolean(model && model.trim()));

type ChatProvider = 'gemini' | 'openrouter' | 'ollama';

interface ProviderSelection {
  preferred: ChatProvider;
  isComplex: boolean;
}

interface ChatRequest {
  sessionId: string;
  message: string;
  emotionContext?: { state?: string; confidence?: number };
  personalityMode?: string;
  llmProvider?: 'ollama' | 'openrouter' | 'gemini' | 'online';
  ollamaModel?: string;
  onlineModel?: string;
}

interface ChatResponse {
  content: string;
  intent?: string;
  actions?: unknown[];
}

export interface AiChatRequest {
  message: string;
  personalityMode?: 'professional' | 'casual' | 'friendly' | 'calm' | 'concise' | 'creative' | 'focus' | 'silent';
  llmProvider?: 'ollama' | 'openrouter' | 'gemini' | 'online';
  onlineModel?: string;
  ollamaModel?: string;
  emotionContext?: { state?: string; confidence?: number };
  stream?: boolean;
}

export interface AiChatResult {
  success: true;
  provider: ChatProvider;
  reply: string;
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

function normalizeErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const data = err.response?.data;
    const details = typeof data === 'string' ? data : JSON.stringify(data || {});
    return `status=${status ?? 'n/a'} code=${err.code ?? 'n/a'} details=${details}`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

function isRetryableError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) {
    return false;
  }

  const status = err.response?.status;
  if (status === 408 || status === 429) {
    return true;
  }
  if (typeof status === 'number' && status >= 500) {
    return true;
  }
  return ['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET'].includes(err.code || '');
}

async function executeWithRetry<T>(
  provider: ChatProvider,
  operation: () => Promise<T>,
  retries = PROVIDER_RETRIES
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      const canRetry = attempt < retries && isRetryableError(err);

      logger.warn(`AI provider failed`, {
        provider,
        attempt: attempt + 1,
        retries: retries + 1,
        retrying: canRetry,
        error: normalizeErrorMessage(err),
      });

      if (!canRetry) {
        throw err;
      }
    }
  }

  throw lastError;
}

function isComplexPrompt(message: string): ProviderSelection {
  const trimmed = message.trim();
  const words = trimmed.split(/\s+/).filter(Boolean).length;
  const chars = trimmed.length;
  const lines = trimmed.split(/\n+/).length;
  const complexityKeywords = /(analy[sz]e|architecture|trade[ -]?off|compare|step[- ]by[- ]step|implementation|optimi[sz]e|design|security|refactor)/i;
  const isComplex = chars > 700 || words > 120 || lines > 8 || complexityKeywords.test(trimmed);

  return {
    preferred: isComplex ? 'openrouter' : 'gemini',
    isComplex,
  };
}

function buildSystemPrompt(request: AiChatRequest): string {
  const personality = request.personalityMode || 'professional';
  const emotion = request.emotionContext?.state || 'neutral';

  return [
    `You are an AI assistant in ${personality} mode.`,
    `User emotion context: ${emotion}.`,
    'Respond clearly, safely, and concisely.',
  ].join(' ');
}

function isGeminiModelNotFoundError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) {
    return false;
  }

  const status = err.response?.status;
  const rawData = err.response?.data;
  const dataText = typeof rawData === 'string' ? rawData : JSON.stringify(rawData || {});

  return status === 404 || /not found|unsupported|unknown model|models\//i.test(dataText);
}

async function callGeminiModel(apiKey: string, model: string, request: AiChatRequest): Promise<string> {
  const prompt = buildSystemPrompt(request);

  const response = await axios.post(
    `${GEMINI_API_URL}/models/${model}:generateContent?key=${apiKey}`,
    {
      contents: [
        {
          role: 'user',
          parts: [{ text: `${prompt}\n\nUser: ${request.message}` }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    },
    {
      timeout: PROVIDER_TIMEOUT_MS,
    }
  );

  const reply = response.data?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text || '')
    .join('')
    .trim();

  if (!reply) {
    throw new Error('Gemini returned empty response');
  }

  return reply;
}

async function callGemini(request: AiChatRequest): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY');
  }

  const requestedModel = request.onlineModel?.trim();
  const modelCandidates = requestedModel && /^gemini-/i.test(requestedModel)
    ? [requestedModel, ...GEMINI_MODEL_CANDIDATES.filter((m) => m !== requestedModel)]
    : GEMINI_MODEL_CANDIDATES;

  let lastError: unknown;
  for (const model of modelCandidates) {
    try {
      const reply = await callGeminiModel(apiKey, model, request);
      logger.info('Gemini model selected', { model });
      return reply;
    } catch (err) {
      lastError = err;
      if (!isGeminiModelNotFoundError(err)) {
        throw err;
      }

      logger.warn('Gemini model unavailable, trying next candidate', {
        model,
        error: normalizeErrorMessage(err),
      });
    }
  }

  throw lastError instanceof Error ? lastError : new Error('All Gemini model candidates failed');
}

async function callOpenRouter(request: AiChatRequest, isComplex: boolean): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENROUTER_API_KEY');
  }

  const model = request.onlineModel || (isComplex ? 'mistralai/mixtral-8x7b-instruct' : 'meta-llama/llama-3-8b-instruct');

  const response = await axios.post(
    OPENROUTER_API_URL,
    {
      model,
      messages: [
        { role: 'system', content: buildSystemPrompt(request) },
        { role: 'user', content: request.message },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    },
    {
      timeout: PROVIDER_TIMEOUT_MS,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost',
        'X-Title': process.env.OPENROUTER_APP_NAME || 'Elixi Backend',
      },
    }
  );

  const reply = response.data?.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    throw new Error('OpenRouter returned empty response');
  }

  return reply;
}

async function callOllama(request: AiChatRequest, isComplex: boolean): Promise<string> {
  const model = request.ollamaModel || process.env.OLLAMA_MODEL || (isComplex ? 'mistral' : 'llama3');
  const prompt = `${buildSystemPrompt(request)}\n\nUser: ${request.message}`;

  const response = await axios.post(
    `${OLLAMA_API_URL}/api/generate`,
    {
      model,
      prompt,
      stream: false,
    },
    {
      timeout: PROVIDER_TIMEOUT_MS,
    }
  );

  const reply = response.data?.response?.trim();
  if (!reply) {
    throw new Error('Ollama returned empty response');
  }

  return reply;
}

export const aiService = {
  async chatWithFallback(request: AiChatRequest): Promise<AiChatResult> {
    if (!request.message?.trim()) {
      throw new Error('Message is required');
    }

    const routing = isComplexPrompt(request.message);
    const requestedProvider = request.llmProvider === 'online' ? 'openrouter' : request.llmProvider;
    const baseChain: ChatProvider[] = routing.preferred === 'openrouter'
      ? ['openrouter', 'gemini', 'ollama']
      : ['gemini', 'openrouter', 'ollama'];
    const providerChain: ChatProvider[] = requestedProvider && ['gemini', 'openrouter', 'ollama'].includes(requestedProvider)
      ? [requestedProvider as ChatProvider, ...baseChain.filter((provider) => provider !== requestedProvider)]
      : baseChain;
    const failures: string[] = [];

    for (const provider of providerChain) {
      try {
        const reply = await executeWithRetry(provider, async () => {
          if (provider === 'gemini') {
            return callGemini(request);
          }
          if (provider === 'openrouter') {
            return callOpenRouter(request, routing.isComplex);
          }
          return callOllama(request, routing.isComplex);
        });

        logger.info('AI provider selected', {
          provider,
          complex: routing.isComplex,
          messageLength: request.message.length,
        });

        return {
          success: true,
          provider,
          reply,
        };
      } catch (err) {
        const reason = normalizeErrorMessage(err);
        failures.push(`${provider}: ${reason}`);
        logger.error('AI provider failed and fallback will continue', {
          provider,
          reason,
        });
      }
    }

    logger.error('All AI providers failed', { failures });
    throw new Error('All providers failed. Please try again later.');
  },

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
