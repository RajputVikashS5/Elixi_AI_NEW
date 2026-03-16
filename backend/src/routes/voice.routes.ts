import { Router } from 'express';
import {
  getVoiceStatus,
  startVoiceSession,
  stopVoiceSession,
  setWakeWordState,
  synthesizeSpeech,
  getVoiceSettings,
  updateVoiceSettings,
  listVoices,
  getVoiceCapabilities,
} from '../controllers/voice.controller';

export const voiceRoutes = Router();

voiceRoutes.get('/status', getVoiceStatus);
voiceRoutes.post('/start', startVoiceSession);
voiceRoutes.post('/stop', stopVoiceSession);
voiceRoutes.post('/wake-word', setWakeWordState);
voiceRoutes.post('/tts', synthesizeSpeech);
voiceRoutes.get('/settings', getVoiceSettings);
voiceRoutes.post('/settings', updateVoiceSettings);
voiceRoutes.get('/voices', listVoices);
voiceRoutes.get('/capabilities', getVoiceCapabilities);
