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

  deleteFact: async (id: string) => {
    await api.delete(`/api/memory/facts/${id}`);
  },

  getHabits: async (): Promise<HabitsResponse> => {
    const res = await api.get<HabitsResponse>('/api/memory/habits');
    return res.data;
  },
};
