import { Router } from 'express';
import { sendMessage, getHistory, clearHistory } from '../controllers/chat.controller';

export const chatRoutes = Router();

chatRoutes.post('/message', sendMessage);
chatRoutes.get('/history', getHistory);
chatRoutes.delete('/history', clearHistory);
