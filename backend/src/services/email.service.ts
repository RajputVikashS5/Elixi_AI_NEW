import axios from 'axios';
import { logger } from '../utils/logger';

export interface EmailMessageSummary {
  id: string;
  from?: string;
  subject?: string;
  snippet?: string;
  date?: string;
}

function extractHeader(headers: Array<{ name: string; value: string }> | undefined, key: string): string | undefined {
  if (!headers) return undefined;
  const found = headers.find((h) => h.name.toLowerCase() === key.toLowerCase());
  return found?.value;
}

export class EmailIntegrationService {
  constructor(private readonly accessToken: string) {}

  private async tryGmailList(limit: number, query?: string): Promise<EmailMessageSummary[]> {
    const listResp = await axios.get('https://gmail.googleapis.com/gmail/v1/users/me/messages', {
      params: { maxResults: limit, q: query },
      headers: { Authorization: `Bearer ${this.accessToken}` },
      timeout: 10000,
    });

    const messages = Array.isArray(listResp.data?.messages) ? listResp.data.messages : [];
    const details = await Promise.all(
      messages.map(async (message: { id: string }) => {
        const detailResp = await axios.get(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`, {
          params: { format: 'metadata', metadataHeaders: ['From', 'Subject', 'Date'] },
          headers: { Authorization: `Bearer ${this.accessToken}` },
          timeout: 10000,
        });

        const payload = detailResp.data?.payload;
        const headers = Array.isArray(payload?.headers) ? payload.headers : [];
        return {
          id: String(detailResp.data?.id || message.id),
          from: extractHeader(headers, 'From'),
          subject: extractHeader(headers, 'Subject'),
          date: extractHeader(headers, 'Date'),
          snippet: detailResp.data?.snippet,
        } as EmailMessageSummary;
      })
    );

    return details;
  }

  private async tryGraphList(limit: number, query?: string): Promise<EmailMessageSummary[]> {
    const params: Record<string, string> = {
      '$top': String(limit),
      '$select': 'id,subject,from,receivedDateTime,bodyPreview',
      '$orderby': 'receivedDateTime DESC',
    };
    if (query && query.trim().length > 0) {
      params['$search'] = `"${query.replace(/"/g, '')}"`;
    }

    const resp = await axios.get('https://graph.microsoft.com/v1.0/me/messages', {
      params,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        ConsistencyLevel: query ? 'eventual' : undefined,
      },
      timeout: 10000,
    });

    const rows = Array.isArray(resp.data?.value) ? resp.data.value : [];
    return rows.map((row: any) => ({
      id: String(row.id),
      from: row.from?.emailAddress?.address,
      subject: row.subject,
      date: row.receivedDateTime,
      snippet: row.bodyPreview,
    }));
  }

  async listRecent(limit = 10): Promise<EmailMessageSummary[]> {
    try {
      return await this.tryGmailList(limit);
    } catch (gmailError) {
      logger.warn('Gmail list failed, attempting Graph API fallback');
      try {
        return await this.tryGraphList(limit);
      } catch (graphError) {
        const g1 = gmailError instanceof Error ? gmailError.message : 'unknown';
        const g2 = graphError instanceof Error ? graphError.message : 'unknown';
        throw new Error(`Email list failed (gmail: ${g1}; graph: ${g2})`);
      }
    }
  }

  async search(query: string, limit = 10): Promise<EmailMessageSummary[]> {
    if (!query.trim()) {
      throw new Error('query is required');
    }

    try {
      return await this.tryGmailList(limit, query);
    } catch {
      return await this.tryGraphList(limit, query);
    }
  }

  async unreadCount(): Promise<number> {
    try {
      const labelResp = await axios.get('https://gmail.googleapis.com/gmail/v1/users/me/labels/UNREAD', {
        headers: { Authorization: `Bearer ${this.accessToken}` },
        timeout: 10000,
      });
      return Number(labelResp.data?.messagesTotal || 0);
    } catch {
      const graphResp = await axios.get('https://graph.microsoft.com/v1.0/me/mailFolders/inbox', {
        params: { '$select': 'unreadItemCount' },
        headers: { Authorization: `Bearer ${this.accessToken}` },
        timeout: 10000,
      });
      return Number(graphResp.data?.unreadItemCount || 0);
    }
  }
}

export function createEmailService(accessToken: string): EmailIntegrationService {
  return new EmailIntegrationService(accessToken);
}
