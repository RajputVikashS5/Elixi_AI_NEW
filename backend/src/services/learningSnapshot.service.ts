import cron from 'node-cron';
import { memoryService } from './memory.service';
import { logger } from '../utils/logger';

async function captureLearningSnapshot(reason: 'startup' | 'scheduled') {
  try {
    const insights = await memoryService.getLearningInsights({ limit: 20, minOccurrences: 2 });
    const snapshot = await memoryService.saveLearningSnapshot(insights);
    logger.info(`[Learning Snapshot] Captured (${reason}) id=${snapshot.id}`);
  } catch (err) {
    logger.error('[Learning Snapshot] Capture failed', err);
  }
}

export function startLearningSnapshotScheduler(): void {
  // Daily snapshot at 00:15 local time.
  cron.schedule('15 0 * * *', () => {
    void captureLearningSnapshot('scheduled');
  });

  // Capture once on startup to keep dashboard trends immediately available.
  void captureLearningSnapshot('startup');
}
