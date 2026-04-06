import { Router, Request, Response } from 'express';
import { integrationService } from '../services/integration.service';
import { createEmailService } from '../services/email.service';
import { logger } from '../utils/logger';

const router = Router();

async function getEmailService(integrationId: string) {
  const integration = await integrationService.getIntegration(integrationId);
  if (!integration || integration.type !== 'email') {
    throw new Error('Email integration not found');
  }
  if (integration.status !== 'connected') {
    throw new Error('Email integration is not connected');
  }

  const token = await integrationService.getAccessToken(integrationId);
  if (!token) {
    throw new Error('Email integration token not found');
  }

  return createEmailService(token);
}

router.get('/:integrationId/inbox', async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit || 10);
    const email = await getEmailService(req.params.integrationId);
    const messages = await email.listRecent(limit);
    res.json({ messages });
  } catch (error) {
    logger.error('Failed to load inbox', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load inbox' });
  }
});

router.get('/:integrationId/search', async (req: Request, res: Response) => {
  try {
    const query = String(req.query.q || '');
    const limit = Number(req.query.limit || 10);
    const email = await getEmailService(req.params.integrationId);
    const messages = await email.search(query, limit);
    res.json({ messages });
  } catch (error) {
    logger.error('Failed to search inbox', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to search inbox' });
  }
});

router.get('/:integrationId/unread-count', async (req: Request, res: Response) => {
  try {
    const email = await getEmailService(req.params.integrationId);
    const unread = await email.unreadCount();
    res.json({ unread });
  } catch (error) {
    logger.error('Failed to get unread count', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get unread count' });
  }
});

export { router as emailIntegrationRouter };
