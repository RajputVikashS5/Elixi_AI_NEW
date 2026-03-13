import { api } from './api';

interface ChatHistoryResponse {
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
}

export const chatService = {
  getHistory: async (sessionId: string) => {
    const res = await api.get<ChatHistoryResponse>(`/api/chat/history?sessionId=${sessionId}`);
    return res.data;
  },

  clearHistory: async (sessionId: string) => {
    await api.delete(`/api/chat/history?sessionId=${sessionId}`);
  },
};
