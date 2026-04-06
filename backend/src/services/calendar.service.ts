import axios from 'axios';

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
}

export interface CreateCalendarEventInput {
  title: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
}

export class CalendarIntegrationService {
  constructor(private readonly accessToken: string) {}

  private async tryGoogleList(timeMin: string, timeMax: string, limit: number): Promise<CalendarEvent[]> {
    const response = await axios.get('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      params: {
        timeMin,
        timeMax,
        maxResults: limit,
        singleEvents: true,
        orderBy: 'startTime',
      },
      headers: { Authorization: `Bearer ${this.accessToken}` },
      timeout: 10000,
    });

    const items = Array.isArray(response.data?.items) ? response.data.items : [];
    return items.map((item: any) => ({
      id: String(item.id),
      title: String(item.summary || 'Untitled event'),
      start: String(item.start?.dateTime || item.start?.date || ''),
      end: String(item.end?.dateTime || item.end?.date || ''),
      location: item.location,
      description: item.description,
    }));
  }

  private async tryGraphList(timeMin: string, timeMax: string, limit: number): Promise<CalendarEvent[]> {
    const response = await axios.get('https://graph.microsoft.com/v1.0/me/calendarview', {
      params: {
        startDateTime: timeMin,
        endDateTime: timeMax,
        '$top': String(limit),
      },
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Prefer: 'outlook.timezone="UTC"',
      },
      timeout: 10000,
    });

    const items = Array.isArray(response.data?.value) ? response.data.value : [];
    return items.map((item: any) => ({
      id: String(item.id),
      title: String(item.subject || 'Untitled event'),
      start: String(item.start?.dateTime || ''),
      end: String(item.end?.dateTime || ''),
      location: item.location?.displayName,
      description: item.bodyPreview,
    }));
  }

  async listUpcoming(days = 7, limit = 20): Promise<CalendarEvent[]> {
    const now = new Date();
    const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const timeMin = now.toISOString();
    const timeMax = end.toISOString();

    try {
      return await this.tryGoogleList(timeMin, timeMax, limit);
    } catch {
      return await this.tryGraphList(timeMin, timeMax, limit);
    }
  }

  async createEvent(input: CreateCalendarEventInput): Promise<CalendarEvent> {
    try {
      const googleResp = await axios.post(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          summary: input.title,
          description: input.description,
          location: input.location,
          start: { dateTime: input.start },
          end: { dateTime: input.end },
        },
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
          timeout: 10000,
        }
      );

      const item = googleResp.data;
      return {
        id: String(item.id),
        title: String(item.summary || input.title),
        start: String(item.start?.dateTime || input.start),
        end: String(item.end?.dateTime || input.end),
        description: item.description,
        location: item.location,
      };
    } catch {
      const graphResp = await axios.post(
        'https://graph.microsoft.com/v1.0/me/events',
        {
          subject: input.title,
          body: {
            contentType: 'Text',
            content: input.description || '',
          },
          start: { dateTime: input.start, timeZone: 'UTC' },
          end: { dateTime: input.end, timeZone: 'UTC' },
          location: { displayName: input.location || '' },
        },
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
          timeout: 10000,
        }
      );

      const item = graphResp.data;
      return {
        id: String(item.id),
        title: String(item.subject || input.title),
        start: String(item.start?.dateTime || input.start),
        end: String(item.end?.dateTime || input.end),
        description: item.bodyPreview || input.description,
        location: item.location?.displayName || input.location,
      };
    }
  }

  async availability(fromIso: string, toIso: string): Promise<{ busy: boolean; conflicts: CalendarEvent[] }> {
    const events = await this.listUpcoming(30, 200);
    const start = new Date(fromIso).getTime();
    const end = new Date(toIso).getTime();

    const conflicts = events.filter((event) => {
      const eventStart = new Date(event.start).getTime();
      const eventEnd = new Date(event.end).getTime();
      return eventStart < end && eventEnd > start;
    });

    return {
      busy: conflicts.length > 0,
      conflicts,
    };
  }
}

export function createCalendarService(accessToken: string): CalendarIntegrationService {
  return new CalendarIntegrationService(accessToken);
}
