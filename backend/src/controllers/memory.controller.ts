import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { memoryService } from '../services/memory.service';
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
