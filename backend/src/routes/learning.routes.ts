import { Router } from 'express';
import { getLearningInsights, getLearningSnapshots } from '../controllers/learning.controller';

export const learningRoutes = Router();

learningRoutes.get('/insights', getLearningInsights);
learningRoutes.get('/snapshots', getLearningSnapshots);
