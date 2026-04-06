/**
 * Integration Service
 * Core service for managing integrations lifecycle
 */

import { v4 as uuid } from 'uuid';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import {
  Integration,
  IntegrationToken,
  IntegrationType,
  OAuthState,
  ConnectIntegrationRequest,
  IntegrationStatus,
} from '../utils/integrationTypes';
import { tokenEncryption } from '../utils/encryption';

// In-memory storage (TODO: replace with database)
const integrations = new Map<string, Integration>();
const tokens = new Map<string, IntegrationToken>();
const oauthStates = new Map<string, OAuthState>();

export class IntegrationService {
  /**
   * List all integrations for the user
   */
  async getIntegrations(): Promise<Integration[]> {
    return Array.from(integrations.values());
  }

  /**
   * Get a specific integration
   */
  async getIntegration(id: string): Promise<Integration | null> {
    return integrations.get(id) || null;
  }

  /**
   * Get integration status with capabilities
   */
  async getIntegrationStatus(id: string): Promise<IntegrationStatus | null> {
    const integration = integrations.get(id);
    if (!integration) return null;

    const token = Array.from(tokens.values()).find(t => t.integrationId === id);

    return {
      id: integration.id,
      type: integration.type,
      connected: integration.status === 'connected',
      lastSync: integration.lastSync,
      error: integration.error,
      capabilities: this.getCapabilitiesForType(integration.type),
    };
  }

  /**
   * Create an integration
   */
  async createIntegration(type: IntegrationType, config?: Record<string, any>): Promise<Integration> {
    const integration: Integration = {
      id: uuid(),
      type,
      displayName: this.getDisplayName(type),
      status: 'disconnected',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: config,
    };

    integrations.set(integration.id, integration);
    logger.info(`Integration created: ${integration.id} (${type})`);

    return integration;
  }

  /**
   * Update integration status
   */
  async updateIntegrationStatus(
    id: string,
    status: 'connected' | 'disconnected' | 'error',
    error?: string
  ): Promise<Integration> {
    const integration = integrations.get(id);
    if (!integration) {
      throw new Error(`Integration not found: ${id}`);
    }

    integration.status = status;
    integration.error = error;
    integration.updatedAt = new Date();

    if (status === 'connected') {
      integration.lastSync = new Date();
    }

    integrations.set(id, integration);
    logger.info(`Integration status updated: ${id} -> ${status}`);

    return integration;
  }

  /**
   * Store OAuth token
   */
  async storeToken(
    integrationId: string,
    type: IntegrationType,
    accessToken: string,
    refreshToken?: string,
    expiresIn?: number
  ): Promise<IntegrationToken> {
    const token: IntegrationToken = {
      id: uuid(),
      integrationId,
      type,
      accessToken: tokenEncryption.encrypt(accessToken),
      refreshToken: refreshToken ? tokenEncryption.encrypt(refreshToken) : undefined,
      expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined,
      scopes: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    tokens.set(token.id, token);
    logger.info(`Token stored for integration: ${integrationId}`);

    return token;
  }

  /**
   * Get token for an integration
   */
  async getToken(integrationId: string): Promise<IntegrationToken | null> {
    const token = Array.from(tokens.values()).find(t => t.integrationId === integrationId);
    if (!token) return null;

    // Check if token is expired
    if (token.expiresAt && token.expiresAt < new Date()) {
      logger.warn(`Token expired for integration: ${integrationId}`);
      return null;
    }

    return token;
  }

  /**
   * Get decrypted access token
   */
  async getAccessToken(integrationId: string): Promise<string | null> {
    const token = await this.getToken(integrationId);
    if (!token) return null;

    try {
      return tokenEncryption.decrypt(token.accessToken);
    } catch (error) {
      logger.error(`Failed to decrypt token for integration: ${integrationId}`, error);
      return null;
    }
  }

  /**
   * Generate OAuth state for authorization flow
   */
  async generateOAuthState(integrationId: string, type: IntegrationType, provider: string): Promise<string> {
    const state = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes

    oauthStates.set(state, {
      state,
      integrationId,
      type: type as IntegrationType,
      provider: provider as any,
      createdAt: now,
      expiresAt,
    });

    logger.info(`OAuth state generated: ${state} for integration: ${integrationId}`);
    return state;
  }

  /**
   * Verify and consume OAuth state
   */
  async verifyOAuthState(state: string): Promise<OAuthState | null> {
    const oauthState = oauthStates.get(state);
    
    if (!oauthState) {
      logger.warn(`OAuth state not found: ${state}`);
      return null;
    }

    if (oauthState.expiresAt < new Date()) {
      logger.warn(`OAuth state expired: ${state}`);
      oauthStates.delete(state);
      return null;
    }

    oauthStates.delete(state); // Consume the state
    return oauthState;
  }

  /**
   * Disconnect an integration
   */
  async disconnectIntegration(id: string): Promise<void> {
    const integration = integrations.get(id);
    if (!integration) {
      throw new Error(`Integration not found: ${id}`);
    }

    // Delete associated tokens
    const integrationTokens = Array.from(tokens.entries())
      .filter(([, token]) => token.integrationId === id)
      .map(([key]) => key);

    integrationTokens.forEach(key => tokens.delete(key));

    // Update integration status
    await this.updateIntegrationStatus(id, 'disconnected');

    logger.info(`Integration disconnected: ${id}`);
  }

  /**
   * Get capabilities for a specific integration type
   */
  private getCapabilitiesForType(type: IntegrationType) {
    const capabilities = {
      github: {
        canRead: true,
        canWrite: true,
        canExecute: true,
        operations: ['list-repos', 'create-issue', 'get-pr', 'merge-pr'],
      },
      vscode: {
        canRead: true,
        canWrite: true,
        canExecute: true,
        operations: ['read-file', 'write-file', 'open-file', 'execute-command'],
      },
      browser: {
        canRead: true,
        canWrite: false,
        canExecute: true,
        operations: ['take-screenshot', 'navigate', 'get-tabs', 'eval-script'],
      },
      email: {
        canRead: true,
        canWrite: false,
        canExecute: false,
        operations: ['list-inbox', 'search', 'get-message'],
      },
      calendar: {
        canRead: true,
        canWrite: true,
        canExecute: false,
        operations: ['list-events', 'create-event', 'update-event'],
      },
    };

    return capabilities[type] || { canRead: false, canWrite: false, canExecute: false, operations: [] };
  }

  /**
   * Get display name for integration type
   */
  private getDisplayName(type: IntegrationType): string {
    const names: Record<IntegrationType, string> = {
      github: 'GitHub',
      vscode: 'VS Code',
      browser: 'Browser',
      email: 'Email',
      calendar: 'Calendar',
    };
    return names[type] || type;
  }
}

export const integrationService = new IntegrationService();
