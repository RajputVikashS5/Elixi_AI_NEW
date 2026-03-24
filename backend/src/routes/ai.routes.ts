import { Router } from 'express';
import { chatWithAi } from '../controllers/ai.controller';

export const aiRoutes = Router();

aiRoutes.post('/chat', chatWithAi);
