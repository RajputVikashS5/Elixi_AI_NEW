/**
 * OAuth Service
 * Handles OAuth authentication flows for integrations
 */

import axios from 'axios';
import { logger } from '../utils/logger';
import { oauthProviders } from '../utils/oauthProviders';
import { OAuthProvider, OAuthCallbackParams } from '../utils/integrationTypes';

export interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
  scope?: string;
}

export class OAuthService {
  /**
   * Generate OAuth authorization URL
   */
  generateAuthorizationUrl(provider: OAuthProvider, state: string, customScopes?: string[]): string {
    const config = oauthProviders[provider];
    if (!config || !config.clientId) {
      throw new Error(`OAuth provider not configured: ${provider}`);
    }

    const scopes = customScopes || config.scopes;
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      state,
    });

    return `${config.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(provider: OAuthProvider, code: string): Promise<OAuthTokenResponse> {
    const config = oauthProviders[provider];
    if (!config || !config.clientId) {
      throw new Error(`OAuth provider not configured: ${provider}`);
    }

    try {
      const response = await axios.post(
        config.tokenUrl,
        {
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: config.redirectUri,
        },
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      logger.info(`OAuth token exchanged for provider: ${provider}`);

      return {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
        expires_in: response.data.expires_in,
        token_type: response.data.token_type || 'Bearer',
        scope: response.data.scope,
      };
    } catch (error) {
      logger.error(`Failed to exchange OAuth code for provider: ${provider}`, error);
      throw new Error(`OAuth token exchange failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Refresh an access token
   */
  async refreshAccessToken(provider: OAuthProvider, refreshToken: string): Promise<OAuthTokenResponse> {
    const config = oauthProviders[provider];
    if (!config || !config.clientId) {
      throw new Error(`OAuth provider not configured: ${provider}`);
    }

    try {
      const response = await axios.post(
        config.tokenUrl,
        {
          client_id: config.clientId,
          client_secret: config.clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        },
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      logger.info(`OAuth token refreshed for provider: ${provider}`);

      return {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token || refreshToken,
        expires_in: response.data.expires_in,
        token_type: response.data.token_type || 'Bearer',
      };
    } catch (error) {
      logger.error(`Failed to refresh OAuth token for provider: ${provider}`, error);
      throw new Error(`OAuth token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Revoke an access token
   */
  async revokeToken(provider: OAuthProvider, token: string): Promise<boolean> {
    const config = oauthProviders[provider];
    if (!config || !config.revokeUrl) {
      logger.warn(`No revoke URL configured for provider: ${provider}, skipping revocation`);
      return true;
    }

    try {
      await axios.post(config.revokeUrl, {
        token,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      });

      logger.info(`OAuth token revoked for provider: ${provider}`);
      return true;
    } catch (error) {
      logger.warn(`Failed to revoke OAuth token for provider: ${provider}`, error);
      // Don't throw - revocation failures shouldn't break the disconnect flow
      return false;
    }
  }

  /**
   * Verify OAuth callback parameters
   */
  verifyOAuthCallback(params: OAuthCallbackParams): { valid: boolean; error?: string } {
    if (params.error) {
      return {
        valid: false,
        error: `OAuth error: ${params.error} - ${params.error_description || 'Unknown error'}`,
      };
    }

    if (!params.code || !params.state) {
      return {
        valid: false,
        error: 'Missing code or state in OAuth callback',
      };
    }

    return { valid: true };
  }
}

export const oauthService = new OAuthService();
