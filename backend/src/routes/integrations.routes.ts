/**
 * Integration Routes
 * HTTP endpoints for managing integrations
 */

import { Router, Request, Response } from 'express';
import { integrationService } from '../services/integration.service';
import { oauthService, OAuthTokenResponse } from '../services/oauth.service';
import { logger } from '../utils/logger';
import {
  IntegrationType,
  OAuthProvider,
  OAuthCallbackParams,
} from '../utils/integrationTypes';
import { integrationProviders } from '../utils/oauthProviders';

const router = Router();

/**
 * GET /api/integrations
 * List all integrations
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const integrations = await integrationService.getIntegrations();
    res.json({ integrations });
  } catch (error) {
    logger.error('Failed to list integrations', error);
    res.status(500).json({ error: 'Failed to list integrations' });
  }
});

/**
 * GET /api/integrations/available
 * List available integration types
 */
router.get('/available', async (req: Request, res: Response) => {
  try {
    const available = Object.values(integrationProviders);
    res.json({ providers: available });
  } catch (error) {
    logger.error('Failed to list available integrations', error);
    res.status(500).json({ error: 'Failed to list available integrations' });
  }
});

/**
 * GET /api/integrations/:id
 * Get specific integration
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const integration = await integrationService.getIntegration(req.params.id);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }
    res.json({ integration });
  } catch (error) {
    logger.error('Failed to get integration', error);
    res.status(500).json({ error: 'Failed to get integration' });
  }
});

/**
 * GET /api/integrations/:id/status
 * Get integration status
 */
router.get('/:id/status', async (req: Request, res: Response) => {
  try {
    const status = await integrationService.getIntegrationStatus(req.params.id);
    if (!status) {
      return res.status(404).json({ error: 'Integration not found' });
    }
    res.json({ status });
  } catch (error) {
    logger.error('Failed to get integration status', error);
    res.status(500).json({ error: 'Failed to get integration status' });
  }
});

/**
 * POST /api/integrations/connect/:type
 * Start integration connection (OAuth or manual auth)
 */
router.post('/connect/:type', async (req: Request, res: Response) => {
  try {
    const type = req.params.type as IntegrationType;
    const provider = integrationProviders[type];

    if (!provider) {
      return res.status(400).json({ error: `Unknown integration type: ${type}` });
    }

    // Create integration record
    const integration = await integrationService.createIntegration(type);

    // If OAuth, generate authorization URL
    if (provider.oauthProvider) {
      const oauthProvider = provider.oauthProvider as OAuthProvider;
      const state = await integrationService.generateOAuthState(
        integration.id,
        type,
        oauthProvider
      );

      const authUrl = oauthService.generateAuthorizationUrl(oauthProvider, state);

      return res.json({
        integration,
        authUrl,
        type: 'oauth',
      });
    }

    if (!provider.requiresManualAuth) {
      await integrationService.updateIntegrationStatus(integration.id, 'connected');
      return res.json({
        integration: {
          ...integration,
          status: 'connected',
          lastSync: new Date(),
        },
        type: 'instant',
        message: `${provider.displayName} connected`,
      });
    }

    // Manual auth (e.g., IMAP credentials)
    res.json({
      integration,
      type: 'manual',
      fields: getManualAuthFields(type),
    });
  } catch (error) {
    logger.error('Failed to start integration connection', error);
    res.status(500).json({ error: 'Failed to start integration connection' });
  }
});

async function completeOAuth(params: OAuthCallbackParams) {
  const verification = oauthService.verifyOAuthCallback(params);
  if (!verification.valid) {
    throw new Error(verification.error || 'Invalid OAuth callback');
  }

  const oauthState = await integrationService.verifyOAuthState(params.state!);
  if (!oauthState) {
    throw new Error('Invalid or expired state');
  }

  const tokenResponse = await oauthService.exchangeCodeForToken(
    oauthState.provider as OAuthProvider,
    params.code!
  );

  await integrationService.storeToken(
    oauthState.integrationId,
    oauthState.type,
    tokenResponse.access_token,
    tokenResponse.refresh_token,
    tokenResponse.expires_in
  );

  await integrationService.updateIntegrationStatus(
    oauthState.integrationId,
    'connected'
  );

  return oauthState.integrationId;
}

/**
 * POST /api/integrations/callback
 * API OAuth callback handler (JSON body)
 */
router.post('/callback', async (req: Request, res: Response) => {
  try {
    const params: OAuthCallbackParams = {
      code: req.body.code,
      state: req.body.state,
      error: req.body.error,
      error_description: req.body.error_description,
    };
    const integrationId = await completeOAuth(params);

    res.json({
      success: true,
      integrationId,
      message: 'Integration connected successfully',
    });
  } catch (error) {
    logger.error('OAuth callback failed', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'OAuth callback failed' });
  }
});

/**
 * GET /api/integrations/oauth/callback
 * Browser OAuth callback endpoint for provider redirects
 */
router.get('/oauth/callback', async (req: Request, res: Response) => {
  try {
    const params: OAuthCallbackParams = {
      code: typeof req.query.code === 'string' ? req.query.code : undefined,
      state: typeof req.query.state === 'string' ? req.query.state : '',
      error: typeof req.query.error === 'string' ? req.query.error : undefined,
      error_description: typeof req.query.error_description === 'string' ? req.query.error_description : undefined,
    };

    await completeOAuth(params);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html>
<html><body style="font-family:Segoe UI,Arial,sans-serif;padding:16px;">
<h3>Integration connected</h3>
<p>You can close this window and return to ELIXI.</p>
<script>
  try {
    if (window.opener) {
      window.opener.postMessage({ type: 'elixi-oauth-complete' }, '*');
    }
    setTimeout(function(){ window.close(); }, 800);
  } catch (e) {}
</script>
</body></html>`);
  } catch (error) {
    logger.error('OAuth browser callback failed', error);
    res.status(400).setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html><html><body style="font-family:Segoe UI,Arial,sans-serif;padding:16px;">
<h3>Integration connection failed</h3>
<p>${error instanceof Error ? error.message : 'OAuth callback failed'}</p>
</body></html>`);
  }
});

/**
 * POST /api/integrations/:id/disconnect
 * Disconnect an integration
 */
router.post('/:id/disconnect', async (req: Request, res: Response) => {
  try {
    const integration = await integrationService.getIntegration(req.params.id);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    // Get token for revocation if applicable
    const token = await integrationService.getToken(req.params.id);
    if (token) {
      const provider = integrationProviders[integration.type];
      if (provider.oauthProvider) {
        const accessToken = await integrationService.getAccessToken(req.params.id);
        if (accessToken) {
          await oauthService.revokeToken(provider.oauthProvider as OAuthProvider, accessToken);
        }
      }
    }

    // Disconnect
    await integrationService.disconnectIntegration(req.params.id);

    res.json({
      success: true,
      message: 'Integration disconnected successfully',
    });
  } catch (error) {
    logger.error('Failed to disconnect integration', error);
    res.status(500).json({ error: 'Failed to disconnect integration' });
  }
});

/**
 * POST /api/integrations/:id/manual-auth
 * Complete manual authentication (for IMAP, CalDAV, etc.)
 */
router.post('/:id/manual-auth', async (req: Request, res: Response) => {
  try {
    const { username, password, server, port } = req.body;

    if (!username || !password || !server) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const integration = await integrationService.getIntegration(req.params.id);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    // Store credentials (in real implementation, encrypt these)
    await integrationService.storeToken(
      req.params.id,
      integration.type,
      JSON.stringify({ username, password, server, port })
    );

    // Update status
    await integrationService.updateIntegrationStatus(req.params.id, 'connected');

    res.json({
      success: true,
      message: 'Manual authentication completed',
    });
  } catch (error) {
    logger.error('Failed to complete manual authentication', error);
    res.status(500).json({ error: 'Failed to complete manual authentication' });
  }
});

/**
 * POST /api/integrations/:id/sync
 * Manually trigger sync for an integration
 */
router.post('/:id/sync', async (req: Request, res: Response) => {
  try {
    const integration = await integrationService.getIntegration(req.params.id);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    if (integration.status !== 'connected') {
      return res.status(400).json({ error: 'Integration is not connected' });
    }

    // TODO: Trigger sync for specific integration type
    logger.info(`Sync triggered for integration: ${req.params.id}`);

    res.json({
      success: true,
      message: 'Sync triggered',
    });
  } catch (error) {
    logger.error('Failed to sync integration', error);
    res.status(500).json({ error: 'Failed to sync integration' });
  }
});

/**
 * Helper function to get manual auth fields for different integration types
 */
function getManualAuthFields(type: IntegrationType): any[] {
  const fields: Record<IntegrationType, any[]> = {
    email: [
      { name: 'email', label: 'Email Address', type: 'email', required: true },
      { name: 'password', label: 'Password', type: 'password', required: true },
      { name: 'imapServer', label: 'IMAP Server', type: 'text', required: true },
      { name: 'imapPort', label: 'IMAP Port', type: 'number', defaultValue: 993, required: true },
    ],
    calendar: [
      { name: 'server', label: 'CalDAV Server URL', type: 'url', required: true },
      { name: 'username', label: 'Username', type: 'text', required: true },
      { name: 'password', label: 'Password', type: 'password', required: true },
    ],
    github: [],
    vscode: [],
    browser: [],
  };

  return fields[type] || [];
}

export { router as integrationsRouter };
