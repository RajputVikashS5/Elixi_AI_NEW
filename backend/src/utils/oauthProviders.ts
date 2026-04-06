/**
 * OAuth Configuration for supported providers
 * Includes scopes and required configuration
 */

import { IntegrationConfig, OAuthProvider } from './integrationTypes';

export const oauthProviders: Record<OAuthProvider, IntegrationConfig> = {
  github: {
    clientId: process.env.GITHUB_OAUTH_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET || '',
    redirectUri: `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/integrations/oauth/callback`,
    scopes: ['repo', 'read:user', 'user:email'],
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    revokeUrl: 'https://api.github.com/applications/{clientId}/grants',
  },
  google: {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
    redirectUri: `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/integrations/oauth/callback`,
    scopes: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/gmail.readonly',
    ],
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
  },
  microsoft: {
    clientId: process.env.MICROSOFT_OAUTH_CLIENT_ID || '',
    clientSecret: process.env.MICROSOFT_OAUTH_CLIENT_SECRET || '',
    redirectUri: `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/integrations/oauth/callback`,
    scopes: [
      'offline_access',
      'https://graph.microsoft.com/Calendars.Read',
      'https://graph.microsoft.com/Mail.Read',
    ],
    authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  },
};

export interface IntegrationProviderConfig {
  type: string;
  displayName: string;
  description: string;
  icon: string;
  oauthProvider?: OAuthProvider;
  requiresManualAuth?: boolean;
  autoSync?: boolean;
  syncInterval?: number; // milliseconds
}

export const integrationProviders: Record<string, IntegrationProviderConfig> = {
  github: {
    type: 'github',
    displayName: 'GitHub',
    description: 'Connect to GitHub repositories',
    icon: 'github',
    oauthProvider: 'github',
    autoSync: true,
    syncInterval: 300000, // 5 minutes
  },
  vscode: {
    type: 'vscode',
    displayName: 'VS Code',
    description: 'Connect to your VS Code workspace',
    icon: 'code',
    requiresManualAuth: false,
    autoSync: false,
  },
  browser: {
    type: 'browser',
    displayName: 'Browser',
    description: 'Control and interact with your browser',
    icon: 'globe',
    requiresManualAuth: false,
    autoSync: false,
  },
  email: {
    type: 'email',
    displayName: 'Email',
    description: 'Connect your email account',
    icon: 'mail',
    oauthProvider: 'google',
    autoSync: true,
    syncInterval: 600000, // 10 minutes
  },
  calendar: {
    type: 'calendar',
    displayName: 'Calendar',
    description: 'Connect your calendar',
    icon: 'calendar',
    oauthProvider: 'google',
    autoSync: true,
    syncInterval: 300000, // 5 minutes
  },
};
