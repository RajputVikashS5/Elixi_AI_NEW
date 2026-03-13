import { Router } from 'express';
import { Router as ExpRouter } from 'express';

export const voiceRoutes: ExpRouter = Router();

// Voice routes are primarily WebSocket-based (handled in voice engine on port 8001)
// This Router covers HTTP endpoints for voice session management

voiceRoutes.get('/status', (_req, res) => {
  res.json({ status: 'idle', wakWordActive: false });
});

voiceRoutes.post('/tts', (_req, res) => {
  // Proxy TTS requests to voice engine on port 8001
  res.json({ message: 'TTS handled by voice engine on port 8001' });
});
