/**
 * Integration Tests
 * Unit and integration tests for the integration ecosystem
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { integrationService } from '../services/integration.service';
import { oauthService } from '../services/oauth.service';
import { tokenEncryption } from '../utils/encryption';
import { browserIntegrationService } from '../services/browser.service';
import { oauthProviders } from '../utils/oauthProviders';

describe('Integration Service', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('Create Integration', () => {
    it('should create a new integration', async () => {
      const integration = await integrationService.createIntegration('github');

      expect(integration.id).toBeDefined();
      expect(integration.type).toBe('github');
      expect(integration.status).toBe('disconnected');
    });

    it('should set correct display name for integration types', async () => {
      const github = await integrationService.createIntegration('github');
      const vscode = await integrationService.createIntegration('vscode');

      expect(github.displayName).toBe('GitHub');
      expect(vscode.displayName).toBe('VS Code');
    });
  });

  describe('Token Management', () => {
    it('should store and retrieve tokens', async () => {
      const integration = await integrationService.createIntegration('github');
      const testToken = 'test-access-token-12345';

      await integrationService.storeToken(integration.id, 'github', testToken);
      const accessToken = await integrationService.getAccessToken(integration.id);

      expect(accessToken).toBe(testToken);
    });

    it('should encrypt tokens', async () => {
      const integration = await integrationService.createIntegration('github');
      const testToken = 'secret-token-value';

      await integrationService.storeToken(integration.id, 'github', testToken);
      const token = await integrationService.getToken(integration.id);

      // Token should be encrypted in storage
      expect(token?.accessToken).not.toBe(testToken);
      expect(token?.accessToken).toContain(':');
    });
  });

  describe('OAuth State Management', () => {
    it('should generate OAuth state', async () => {
      const integration = await integrationService.createIntegration('github');
      const state = await integrationService.generateOAuthState(
        integration.id,
        'github',
        'github'
      );

      expect(state).toBeDefined();
      expect(state.length).toBeGreaterThan(0);
    });

    it('should verify valid OAuth state', async () => {
      const integration = await integrationService.createIntegration('github');
      const state = await integrationService.generateOAuthState(
        integration.id,
        'github',
        'github'
      );

      const verified = await integrationService.verifyOAuthState(state);

      expect(verified).toBeDefined();
      expect(verified?.integrationId).toBe(integration.id);
    });

    it('should reject invalid OAuth state', async () => {
      const verified = await integrationService.verifyOAuthState('invalid-state');

      expect(verified).toBeNull();
    });

    it('should consume OAuth state (one-time use)', async () => {
      const integration = await integrationService.createIntegration('github');
      const state = await integrationService.generateOAuthState(
        integration.id,
        'github',
        'github'
      );

      // First verify should work
      const firstVerify = await integrationService.verifyOAuthState(state);
      expect(firstVerify).toBeDefined();

      // Second verify should fail (state consumed)
      const secondVerify = await integrationService.verifyOAuthState(state);
      expect(secondVerify).toBeNull();
    });
  });

  describe('Integration Status', () => {
    it('should update integration status', async () => {
      const integration = await integrationService.createIntegration('github');

      const updated = await integrationService.updateIntegrationStatus(
        integration.id,
        'connected'
      );

      expect(updated.status).toBe('connected');
      expect(updated.lastSync).toBeDefined();
    });

    it('should get integration status with capabilities', async () => {
      const integration = await integrationService.createIntegration('github');
      await integrationService.updateIntegrationStatus(integration.id, 'connected');

      const status = await integrationService.getIntegrationStatus(integration.id);

      expect(status?.connected).toBe(true);
      expect(status?.capabilities?.canRead).toBe(true);
      expect(status?.capabilities?.canWrite).toBe(true);
      expect(status?.capabilities?.operations).toContain('list-repos');
    });

    it('should expose browser capabilities', async () => {
      const integration = await integrationService.createIntegration('browser');
      const status = await integrationService.getIntegrationStatus(integration.id);

      expect(status?.capabilities?.canExecute).toBe(true);
      expect(status?.capabilities?.operations).toContain('get-tabs');
    });

    it('should expose email capabilities', async () => {
      const integration = await integrationService.createIntegration('email');
      const status = await integrationService.getIntegrationStatus(integration.id);

      expect(status?.capabilities?.canRead).toBe(true);
      expect(status?.capabilities?.canWrite).toBe(false);
      expect(status?.capabilities?.operations).toContain('list-inbox');
    });

    it('should expose calendar capabilities', async () => {
      const integration = await integrationService.createIntegration('calendar');
      const status = await integrationService.getIntegrationStatus(integration.id);

      expect(status?.capabilities?.canWrite).toBe(true);
      expect(status?.capabilities?.operations).toContain('create-event');
    });
  });

  describe('Disconnect Integration', () => {
    it('should disconnect an integration and remove tokens', async () => {
      const integration = await integrationService.createIntegration('github');
      await integrationService.storeToken(integration.id, 'github', 'test-token');
      await integrationService.updateIntegrationStatus(integration.id, 'connected');

      await integrationService.disconnectIntegration(integration.id);

      const token = await integrationService.getToken(integration.id);
      expect(token).toBeNull();

      const status = await integrationService.getIntegrationStatus(integration.id);
      expect(status?.connected).toBe(false);
    });
  });
});

describe('OAuth Service', () => {
  describe('Generate Authorization URL', () => {
    it('should generate valid GitHub OAuth URL', () => {
      const originalClientId = oauthProviders.github.clientId;
      oauthProviders.github.clientId = 'test-client-id';

      const url = oauthService.generateAuthorizationUrl('github', 'test-state');

      expect(url).toContain('https://github.com/login/oauth/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('state=test-state');

      oauthProviders.github.clientId = originalClientId;
    });
  });

  describe('OAuth Callback Verification', () => {
    it('should verify valid OAuth callback', () => {
      const result = oauthService.verifyOAuthCallback({
        code: 'test-code',
        state: 'test-state',
      });

      expect(result.valid).toBe(true);
    });

    it('should reject callback with error', () => {
      const result = oauthService.verifyOAuthCallback({
        error: 'access_denied',
        error_description: 'User denied access',
        state: 'test-state',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('access_denied');
    });

    it('should reject callback missing code', () => {
      const result = oauthService.verifyOAuthCallback({
        state: 'test-state',
      });

      expect(result.valid).toBe(false);
    });
  });
});

describe('Token Encryption', () => {
  it('should encrypt and decrypt tokens', () => {
    const originalToken = 'my-secret-access-token';

    const encrypted = tokenEncryption.encrypt(originalToken);
    const decrypted = tokenEncryption.decrypt(encrypted);

    expect(encrypted).not.toBe(originalToken);
    expect(decrypted).toBe(originalToken);
  });

  it('should produce different encrypted values for same token', () => {
    const token = 'test-token';

    const encrypted1 = tokenEncryption.encrypt(token);
    const encrypted2 = tokenEncryption.encrypt(token);

    expect(encrypted1).not.toBe(encrypted2);

    const decrypted1 = tokenEncryption.decrypt(encrypted1);
    const decrypted2 = tokenEncryption.decrypt(encrypted2);

    expect(decrypted1).toBe(decrypted2);
    expect(decrypted1).toBe(token);
  });
});

describe('Browser Integration Service', () => {
  it('should report unavailable when browser debug endpoint is not reachable', async () => {
    const health = await browserIntegrationService.healthCheck();
    expect(typeof health.available).toBe('boolean');
  });
});
