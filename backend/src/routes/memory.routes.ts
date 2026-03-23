import { Router } from 'express';
import {
  getFacts,
  storeFact,
  searchMemory,
  deleteFact,
  getHabits,
  semanticBrowse,
  getHabitSummary,
  triggerHabitSummarization,
  getHabitSuggestionDiagnostics,
} from '../controllers/memory.controller';

export const memoryRoutes = Router();

memoryRoutes.get('/facts', getFacts);
memoryRoutes.post('/facts', storeFact);
memoryRoutes.get('/search', searchMemory);
memoryRoutes.delete('/facts/:id', deleteFact);
memoryRoutes.get('/habits', getHabits);
memoryRoutes.get('/semantic-browse', semanticBrowse);
memoryRoutes.get('/habit-summary', getHabitSummary);
memoryRoutes.post('/habit-summary/trigger', triggerHabitSummarization);
memoryRoutes.get('/habit-suggestions/diagnostics', getHabitSuggestionDiagnostics);
