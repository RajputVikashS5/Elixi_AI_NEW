import { Router } from 'express';
import { chatWithAi, getActiveProviderDebug, getProviderStatus } from '../controllers/ai.controller';

export const aiRoutes = Router();

aiRoutes.post('/chat', chatWithAi);
aiRoutes.get('/providers/status', getProviderStatus);
aiRoutes.get('/providers/active', getActiveProviderDebug);
