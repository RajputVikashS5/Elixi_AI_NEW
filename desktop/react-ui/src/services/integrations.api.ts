/**
 * Frontend Integration API Service
 * Handles API calls to backend integration endpoints
 */

import axios from 'axios';
import { Integration, IntegrationType, IntegrationStatus } from '../types/integration.types';

const API_BASE = 'http://localhost:3001/api/integrations';

export class IntegrationAPI {
  /**
   * Get all integrations
   */
  static async getIntegrations(): Promise<Integration[]> {
    const response = await axios.get(`${API_BASE}`);
    return response.data.integrations;
  }

  /**
   * Get specific integration
   */
  static async getIntegration(id: string): Promise<Integration> {
    const response = await axios.get(`${API_BASE}/${id}`);
    return response.data.integration;
  }

  /**
   * Get integration status
   */
  static async getIntegrationStatus(id: string): Promise<IntegrationStatus> {
    const response = await axios.get(`${API_BASE}/${id}/status`);
    return response.data.status;
  }

  /**
   * Get available integration providers
   */
  static async getAvailableProviders() {
    const response = await axios.get(`${API_BASE}/available`);
    return response.data.providers;
  }

  /**
   * Start connecting an integration
   */
  static async startConnect(type: IntegrationType) {
    const response = await axios.post(`${API_BASE}/connect/${type}`);
    return response.data;
  }

  /**
   * Complete OAuth callback
   */
  static async completeOAuthCallback(code: string, state: string) {
    const response = await axios.post(`${API_BASE}/callback`, { code, state });
    return response.data;
  }

  /**
   * Disconnect an integration
   */
  static async disconnect(id: string): Promise<void> {
    await axios.post(`${API_BASE}/${id}/disconnect`);
  }

  /**
   * Manually authenticate (for IMAP, CalDAV, etc.)
   */
  static async manualAuth(id: string, credentials: Record<string, any>) {
    const response = await axios.post(`${API_BASE}/${id}/manual-auth`, credentials);
    return response.data;
  }

  /**
   * Trigger manual sync
   */
  static async sync(id: string) {
    const response = await axios.post(`${API_BASE}/${id}/sync`);
    return response.data;
  }

  // GitHub-specific endpoints
  static async getGitHubRepos(integrationId: string) {
    const response = await axios.get(
      `${API_BASE}/github/${integrationId}/repos`
    );
    return response.data.repositories;
  }

  static async getGitHubUser(integrationId: string) {
    const response = await axios.get(
      `${API_BASE}/github/${integrationId}/user`
    );
    return response.data.user;
  }

  static async createGitHubIssue(integrationId: string, owner: string, repo: string, title: string, body?: string) {
    const response = await axios.post(
      `${API_BASE}/github/${integrationId}/repos/${owner}/${repo}/issues`,
      { title, body }
    );
    return response.data.issue;
  }

  // Browser endpoints
  static async getBrowserHealth(integrationId: string) {
    const response = await axios.get(`${API_BASE}/browser/${integrationId}/health`);
    return response.data;
  }

  static async getBrowserTabs(integrationId: string) {
    const response = await axios.get(`${API_BASE}/browser/${integrationId}/tabs`);
    return response.data.tabs;
  }

  static async openBrowserUrl(integrationId: string, url: string) {
    const response = await axios.post(`${API_BASE}/browser/${integrationId}/open`, { url });
    return response.data;
  }

  static async activateBrowserTab(integrationId: string, tabId: string) {
    const response = await axios.post(`${API_BASE}/browser/${integrationId}/activate/${tabId}`);
    return response.data;
  }

  static async closeBrowserTab(integrationId: string, tabId: string) {
    const response = await axios.post(`${API_BASE}/browser/${integrationId}/close/${tabId}`);
    return response.data;
  }

  static async evaluateBrowserExpression(integrationId: string, tabId: string, expression: string) {
    const response = await axios.post(`${API_BASE}/browser/${integrationId}/eval/${tabId}`, { expression });
    return response.data.result;
  }

  // Email endpoints
  static async getEmailInbox(integrationId: string, limit = 10) {
    const response = await axios.get(`${API_BASE}/email/${integrationId}/inbox`, {
      params: { limit },
    });
    return response.data.messages;
  }

  static async searchEmail(integrationId: string, q: string, limit = 10) {
    const response = await axios.get(`${API_BASE}/email/${integrationId}/search`, {
      params: { q, limit },
    });
    return response.data.messages;
  }

  static async getEmailUnreadCount(integrationId: string) {
    const response = await axios.get(`${API_BASE}/email/${integrationId}/unread-count`);
    return response.data.unread;
  }

  // Calendar endpoints
  static async getCalendarEvents(integrationId: string, days = 7, limit = 20) {
    const response = await axios.get(`${API_BASE}/calendar/${integrationId}/events`, {
      params: { days, limit },
    });
    return response.data.events;
  }

  static async createCalendarEvent(
    integrationId: string,
    payload: { title: string; start: string; end: string; description?: string; location?: string }
  ) {
    const response = await axios.post(`${API_BASE}/calendar/${integrationId}/events`, payload);
    return response.data.event;
  }

  static async getCalendarAvailability(integrationId: string, from: string, to: string) {
    const response = await axios.get(`${API_BASE}/calendar/${integrationId}/availability`, {
      params: { from, to },
    });
    return response.data;
  }
}

export default IntegrationAPI;
