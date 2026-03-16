import { Router } from 'express';
import {
  getVoiceStatus,
  startVoiceSession,
  stopVoiceSession,
  setWakeWordState,
  synthesizeSpeech,
} from '../controllers/voice.controller';

export const voiceRoutes = Router();

voiceRoutes.get('/status', getVoiceStatus);
voiceRoutes.post('/start', startVoiceSession);
voiceRoutes.post('/stop', stopVoiceSession);
voiceRoutes.post('/wake-word', setWakeWordState);
voiceRoutes.post('/tts', synthesizeSpeech);
