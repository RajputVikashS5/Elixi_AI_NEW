import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { memoryService } from '../services/memory.service';
import { aiService } from '../services/ai.service';
import { sanitizeInput } from '../utils/sanitizer';

const factSchema = z.object({
  category: z.enum(['preference', 'fact', 'habit', 'task']),
  key: z.string().min(1).max(200),
  value: z.string().min(1).max(2000),
  confidence: z.number().min(0).max(1).default(1.0),
});

export async function getFacts(_req: Request, res: Response, next: NextFunction) {
  try {
    const facts = await memoryService.getFacts();
    return res.json({ facts });
  } catch (err) {
    next(err);
  }
}

export async function storeFact(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = factSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid fact data', details: parsed.error.issues });
    }
    const { category, key, value, confidence } = parsed.data;
    const fact = await memoryService.storeFact({
      category,
      key: sanitizeInput(key),
      value: sanitizeInput(value),
      confidence,
    });
    return res.json({ success: true, fact });
  } catch (err) {
    next(err);
  }
}

export async function searchMemory(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query.q as string;
    if (!q) {
      return res.status(400).json({ error: 'Search query q is required' });
    }
    const results = await memoryService.searchFacts(sanitizeInput(q));
    return res.json({ results });
  } catch (err) {
    next(err);
  }
}

export async function deleteFact(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await memoryService.deleteFact(id);
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function getHabits(_req: Request, res: Response, next: NextFunction) {
  try {
    const habits = await memoryService.getHabits();
    return res.json({ habits });
  } catch (err) {
    next(err);
  }
}

export async function semanticBrowse(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query.q as string | undefined;
    const confidenceThreshold = parseFloat((req.query.confidence_threshold as string) || '0');
    const sourceType = (req.query.source_type as string) || undefined;
    const limit = parseInt((req.query.limit as string) || '10', 10);
    const sessionId = (req.query.session_id as string) || undefined;

    if (!q) {
      return res.status(400).json({ error: 'Search query q is required' });
    }

    if (isNaN(confidenceThreshold) || confidenceThreshold < 0 || confidenceThreshold > 1) {
      return res.status(400).json({ error: 'confidence_threshold must be between 0 and 1' });
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({ error: 'limit must be between 1 and 100' });
    }

    const validSources = ['memory', 'message', 'habit', 'vector'];
    if (sourceType && !validSources.includes(sourceType)) {
      return res.status(400).json({
        error: `source_type must be one of: ${validSources.join(', ')}`,
      });
    }

    const results = await aiService.semanticBrowse(sanitizeInput(q), {
      confidenceThreshold,
      sourceType,
      limit,
      sessionId,
    });

    return res.json(results);
  } catch (err) {
    next(err);
  }
}

export async function getHabitSummary(_req: Request, res: Response, next: NextFunction) {
  try {
    const summary = await aiService.getHabitSummary();
    return res.json(summary);
  } catch (err) {
    next(err);
  }
}

export async function triggerHabitSummarization(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await aiService.triggerHabitSummarization();
    return res.json({ status: 'triggered', result });
  } catch (err) {
    next(err);
  }
}

export async function getHabitSuggestionDiagnostics(req: Request, res: Response, next: NextFunction) {
  try {
    const message = req.query.message as string | undefined;
    const intent = (req.query.intent as string) || '';
    const limit = parseInt((req.query.limit as string) || '20', 10);
    const includeIneligible = String(req.query.include_ineligible || 'false').toLowerCase() === 'true';
    const entitiesJson = req.query.entities_json as string | undefined;

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    if (isNaN(limit) || limit < 1 || limit > 200) {
      return res.status(400).json({ error: 'limit must be between 1 and 200' });
    }

    let entities: Record<string, unknown> | undefined;
    if (entitiesJson) {
      try {
        const parsed = JSON.parse(entitiesJson);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          entities = parsed as Record<string, unknown>;
        } else {
          return res.status(400).json({ error: 'entities_json must be a JSON object' });
        }
      } catch {
        return res.status(400).json({ error: 'entities_json must be valid JSON' });
      }
    }

    const diagnostics = await aiService.getHabitSuggestionDiagnostics({
      message: sanitizeInput(message),
      intent: sanitizeInput(intent),
      limit,
      includeIneligible,
      entities,
    });

    return res.json(diagnostics);
  } catch (err) {
    next(err);
  }
}
