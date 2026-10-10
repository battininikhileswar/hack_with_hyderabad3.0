export interface CalendarAttendee {
  email: string;
  name?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: string; // ISO 8601 string
  endTime: string;   // ISO 8601 string
  location?: string;
  attendees: CalendarAttendee[];
  status?: string;
  matchedContactId?: string;
  matchedContactName?: string;
  matchedContactRole?: string;
  matchedContactCompany?: string;
  matchedContactEmail?: string;
  matchedContactAvatarUrl?: string;
}

export interface CalendarImportResult {
  provider: string;
  totalEventsParsed: number;
  matchedEventsCount: number;
  unmatchedEventsCount: number;
  matchedContactIds: string[];
  events: CalendarEvent[];
}

/**
 * CalendarProvider interface allows seamless integration of different
 * calendar backends (ICS file import, Microsoft Graph API, Google Calendar API, etc.)
 * without altering business logic.
 */
export interface CalendarProvider {
  readonly name: string;
  /**
   * Parse or retrieve events from source (raw string/buffer or backend credentials)
   */
  getEvents(source?: string | Buffer): Promise<CalendarEvent[]>;
}
