import { Router, Request, Response } from 'express';
import { integrationService } from '../services/integration.service';
import { createCalendarService } from '../services/calendar.service';
import { logger } from '../utils/logger';

const router = Router();

async function getCalendarService(integrationId: string) {
  const integration = await integrationService.getIntegration(integrationId);
  if (!integration || integration.type !== 'calendar') {
    throw new Error('Calendar integration not found');
  }
  if (integration.status !== 'connected') {
    throw new Error('Calendar integration is not connected');
  }

  const token = await integrationService.getAccessToken(integrationId);
  if (!token) {
    throw new Error('Calendar integration token not found');
  }

  return createCalendarService(token);
}

router.get('/:integrationId/events', async (req: Request, res: Response) => {
  try {
    const days = Number(req.query.days || 7);
    const limit = Number(req.query.limit || 20);
    const calendar = await getCalendarService(req.params.integrationId);
    const events = await calendar.listUpcoming(days, limit);
    res.json({ events });
  } catch (error) {
    logger.error('Failed to list calendar events', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list events' });
  }
});

router.post('/:integrationId/events', async (req: Request, res: Response) => {
  try {
    const { title, start, end, description, location } = req.body as {
      title?: string;
      start?: string;
      end?: string;
      description?: string;
      location?: string;
    };

    if (!title || !start || !end) {
      return res.status(400).json({ error: 'title, start, and end are required' });
    }

    const calendar = await getCalendarService(req.params.integrationId);
    const event = await calendar.createEvent({ title, start, end, description, location });
    res.json({ event });
  } catch (error) {
    logger.error('Failed to create calendar event', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create event' });
  }
});

router.get('/:integrationId/availability', async (req: Request, res: Response) => {
  try {
    const from = String(req.query.from || '');
    const to = String(req.query.to || '');
    if (!from || !to) {
      return res.status(400).json({ error: 'from and to query params are required' });
    }

    const calendar = await getCalendarService(req.params.integrationId);
    const availability = await calendar.availability(from, to);
    res.json(availability);
  } catch (error) {
    logger.error('Failed to check availability', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to check availability' });
  }
});

export { router as calendarIntegrationRouter };
