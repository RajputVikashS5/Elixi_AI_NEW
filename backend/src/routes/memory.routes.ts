import { Router } from 'express';
import {
  getFacts,
  storeFact,
  searchMemory,
  deleteFact,
  getHabits,
} from '../controllers/memory.controller';

export const memoryRoutes = Router();

memoryRoutes.get('/facts', getFacts);
memoryRoutes.post('/facts', storeFact);
memoryRoutes.get('/search', searchMemory);
memoryRoutes.delete('/facts/:id', deleteFact);
memoryRoutes.get('/habits', getHabits);
