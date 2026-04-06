/**
 * TypeScript types for integrations
 */

export type IntegrationType = 'github' | 'vscode' | 'browser' | 'email' | 'calendar';
export type OAuthProvider = 'github' | 'google' | 'microsoft';

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

export interface IntegrationStatus {
  id: string;
  type: IntegrationType;
  connected: boolean;
  lastSync?: Date;
  nextSync?: Date;
  error?: string;
  capabilities?: IntegrationCapabilities;
}

export interface IntegrationCapabilities {
  canRead: boolean;
  canWrite: boolean;
  canExecute: boolean;
  operations: string[];
}

export interface IntegrationProvider {
  type: string;
  displayName: string;
  description: string;
  icon: string;
  oauthProvider?: OAuthProvider;
  requiresManualAuth?: boolean;
  autoSync?: boolean;
  syncInterval?: number;
}
