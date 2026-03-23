import { api } from './api';

export interface MemoryFact {
  id: string;
  category: string;
  key: string;
  value: string;
  confidence: number;
  createdAt: string;
}

export interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface SemanticResult {
  id: string;
  content: string;
  score: number;
  source: string;
  metadata: Record<string, unknown>;
}

export interface SemanticBrowseResponse {
  query: string;
  confidence_threshold: number;
  source_type: string | null;
  results: SemanticResult[];
  total: number;
}

export interface HabitItem {
  id?: string;
  description?: string;
  action?: {
    workflowId?: string;
  };
}

export interface HabitsResponse {
  habits: HabitItem[];
}

export const memoryService = {
  getFacts: async () => {
    const res = await api.get<{ facts: MemoryFact[] }>('/api/memory/facts');
    return res.data.facts;
  },

  storeFact: async (fact: Omit<MemoryFact, 'id' | 'createdAt'>) => {
    const res = await api.post('/api/memory/facts', fact);
    return res.data;
  },

  search: async (query: string): Promise<SearchResult[]> => {
    const res = await api.get<{ results: SearchResult[] }>(`/api/memory/search?q=${encodeURIComponent(query)}`);
    return res.data.results;
  },

  semanticBrowse: async (
    query: string,
    options?: {
      confidenceThreshold?: number;
      sourceType?: string;
      limit?: number;
      sessionId?: string;
    }
  ): Promise<SemanticBrowseResponse> => {
    const params = new URLSearchParams({
      q: query,
      confidence_threshold: String(options?.confidenceThreshold ?? 0),
      limit: String(options?.limit ?? 10),
    });
    if (options?.sourceType) {
      params.append('source_type', options.sourceType);
    }
    if (options?.sessionId) {
      params.append('session_id', options.sessionId);
    }
    const res = await api.get<SemanticBrowseResponse>(`/api/memory/semantic-browse?${params.toString()}`);
    return res.data;
  },

  deleteFact: async (id: string) => {
    await api.delete(`/api/memory/facts/${id}`);
  },

  getHabits: async (): Promise<HabitsResponse> => {
    const res = await api.get<HabitsResponse>('/api/memory/habits');
    return res.data;
  },
};
