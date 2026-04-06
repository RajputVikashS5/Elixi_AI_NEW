import { Router, Request, Response } from 'express';
import { browserIntegrationService } from '../services/browser.service';
import { integrationService } from '../services/integration.service';
import { logger } from '../utils/logger';

const router = Router();

async function ensureConnectedBrowserIntegration(integrationId: string): Promise<void> {
  const integration = await integrationService.getIntegration(integrationId);
  if (!integration) {
    throw new Error('Integration not found');
  }
  if (integration.type !== 'browser') {
    throw new Error('Integration is not a browser integration');
  }
  if (integration.status !== 'connected') {
    throw new Error('Browser integration is not connected');
  }
}

router.get('/:integrationId/health', async (req: Request, res: Response) => {
  try {
    await ensureConnectedBrowserIntegration(req.params.integrationId);
    const health = await browserIntegrationService.healthCheck();
    res.json(health);
  } catch (error) {
    logger.error('Browser health check failed', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Browser health check failed' });
  }
});

router.get('/:integrationId/tabs', async (req: Request, res: Response) => {
  try {
    await ensureConnectedBrowserIntegration(req.params.integrationId);
    const tabs = await browserIntegrationService.listTabs();
    res.json({ tabs });
  } catch (error) {
    logger.error('Failed to list browser tabs', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list tabs' });
  }
});

router.post('/:integrationId/open', async (req: Request, res: Response) => {
  try {
    await ensureConnectedBrowserIntegration(req.params.integrationId);
    const { url } = req.body as { url?: string };
    if (!url) {
      return res.status(400).json({ error: 'url is required' });
    }
    await browserIntegrationService.openUrl(url);
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to open browser url', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to open url' });
  }
});

router.post('/:integrationId/activate/:tabId', async (req: Request, res: Response) => {
  try {
    await ensureConnectedBrowserIntegration(req.params.integrationId);
    await browserIntegrationService.activateTab(req.params.tabId);
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to activate browser tab', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to activate tab' });
  }
});

router.post('/:integrationId/close/:tabId', async (req: Request, res: Response) => {
  try {
    await ensureConnectedBrowserIntegration(req.params.integrationId);
    await browserIntegrationService.closeTab(req.params.tabId);
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to close browser tab', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to close tab' });
  }
});

router.post('/:integrationId/eval/:tabId', async (req: Request, res: Response) => {
  try {
    await ensureConnectedBrowserIntegration(req.params.integrationId);
    const { expression } = req.body as { expression?: string };
    if (!expression) {
      return res.status(400).json({ error: 'expression is required' });
    }

    const result = await browserIntegrationService.evaluate(req.params.tabId, expression);
    res.json({ result });
  } catch (error) {
    logger.error('Failed to evaluate browser expression', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to evaluate expression' });
  }
});

export { router as browserIntegrationRouter };
