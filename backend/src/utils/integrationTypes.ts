/**
 * Integration Types and Interfaces
 * Defines all integration-related TypeScript types
 */

export type IntegrationType = 
  | 'github' 
  | 'vscode' 
  | 'browser' 
  | 'email' 
  | 'calendar';

export type OAuthProvider = 
  | 'github' 
  | 'google' 
  | 'microsoft';

export interface Integration {
  id: string;
  type: IntegrationType;
  displayName: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSync?: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
  error?: string;
}

export interface IntegrationToken {
  id: string;
  integrationId: string;
  type: IntegrationType;
  provider?: OAuthProvider;
  accessToken: string; // Encrypted
  refreshToken?: string; // Encrypted
  expiresAt?: Date;
  scopes: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface OAuthState {
  state: string;
  integrationId: string;
  type: IntegrationType;
  provider: OAuthProvider;
  createdAt: Date;
  expiresAt: Date;
}

export interface IntegrationConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  authorizationUrl: string;
  tokenUrl: string;
  revokeUrl?: string;
}

export interface ConnectIntegrationRequest {
  type: IntegrationType;
  config?: Record<string, any>; // For non-OAuth integrations
}

export interface IntegrationCapabilities {
  canRead: boolean;
  canWrite: boolean;
  canExecute: boolean;
  operations: string[];
}

export interface IntegrationStatus {
  id: string;
  type: IntegrationType;
  connected: boolean;
  lastSync?: Date;
  nextSync?: Date;
  error?: string;
  capabilities?: IntegrationCapabilities;
}

export interface OAuthCallbackParams {
  code?: string;
  state: string;
  error?: string;
  error_description?: string;
}

export interface RateLimitInfo {
  remaining: number;
  total: number;
  resetAt: Date;
  limited: boolean;
}
