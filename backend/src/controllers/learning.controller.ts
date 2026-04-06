import { Request, Response, NextFunction } from 'express';
import { memoryService } from '../services/memory.service';

export async function getLearningInsights(req: Request, res: Response, next: NextFunction) {
  try {
    const limitRaw = req.query.limit as string | undefined;
    const minOccurrencesRaw = req.query.min_occurrences as string | undefined;

    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
    const minOccurrences = minOccurrencesRaw ? Number.parseInt(minOccurrencesRaw, 10) : undefined;

    if (limitRaw && (Number.isNaN(limit as number) || (limit as number) < 1 || (limit as number) > 25)) {
      return res.status(400).json({ error: 'limit must be between 1 and 25' });
    }

    if (
      minOccurrencesRaw
      && (Number.isNaN(minOccurrences as number) || (minOccurrences as number) < 2 || (minOccurrences as number) > 20)
    ) {
      return res.status(400).json({ error: 'min_occurrences must be between 2 and 20' });
    }

    const insights = await memoryService.getLearningInsights({
      limit,
      minOccurrences,
    });

    return res.json(insights);
  } catch (err) {
    next(err);
  }
}

export async function getLearningSnapshots(req: Request, res: Response, next: NextFunction) {
  try {
    const limitRaw = req.query.limit as string | undefined;
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 20;

    if (limitRaw && (Number.isNaN(limit) || limit < 1 || limit > 200)) {
      return res.status(400).json({ error: 'limit must be between 1 and 200' });
    }

    const snapshots = await memoryService.getLearningSnapshots(limit);
    return res.json({ snapshots });
  } catch (err) {
    next(err);
  }
}
