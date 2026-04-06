import { api } from './api';

export interface LearningPattern {
  intent: string;
  occurrences: number;
  lastSeen: string;
}

export interface PredictiveSuggestion {
  id: string;
  title: string;
  description: string;
  confidence: number;
  source: 'habit' | 'intent_pattern';
  action: {
    type: string;
    value: string;
  };
}

export interface VocabularyTerm {
  term: string;
  count: number;
}

export interface LearningInsights {
  generatedAt: string;
  summary: {
    totalUserMessages: number;
    totalAssistantMessages: number;
    detectedPatterns: number;
    avgUserMessageChars: number;
    vocabularyDiversity: number;
    verbosityRecommendation: 'concise' | 'balanced' | 'detailed';
  };
  patterns: LearningPattern[];
  predictiveSuggestions: PredictiveSuggestion[];
  vocabularyAdaptation: {
    topTerms: VocabularyTerm[];
  };
  verbosityAdaptation: {
    level: 'concise' | 'balanced' | 'detailed';
    targetResponseWords: number;
    reason: string;
  };
}

export interface LearningSnapshotRecord {
  id: string;
  createdAt: string;
  payload: LearningInsights;
}

export interface LearningSnapshotsResponse {
  snapshots: LearningSnapshotRecord[];
}

export const learningService = {
  getInsights: async (options?: { limit?: number; minOccurrences?: number }): Promise<LearningInsights> => {
    const params = new URLSearchParams();
    if (options?.limit) {
      params.set('limit', String(options.limit));
    }
    if (options?.minOccurrences) {
      params.set('min_occurrences', String(options.minOccurrences));
    }

    const query = params.toString();
    const url = query ? `/api/learning/insights?${query}` : '/api/learning/insights';
    const res = await api.get<LearningInsights>(url);
    return res.data;
  },

  getSnapshots: async (limit = 20): Promise<LearningSnapshotRecord[]> => {
    const safeLimit = Math.max(1, Math.min(limit, 200));
    const res = await api.get<LearningSnapshotsResponse>(`/api/learning/snapshots?limit=${safeLimit}`);
    return res.data.snapshots;
  },
};
