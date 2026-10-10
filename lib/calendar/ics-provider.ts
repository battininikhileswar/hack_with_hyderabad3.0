import { CalendarAttendee, CalendarEvent, CalendarProvider } from './types';
import { getContacts } from '@/lib/store';

/**
 * Converts RFC 5545 iCalendar date-time string to ISO-8601 string.
 * Examples:
 *   "20261010T100000Z" -> "2026-10-10T10:00:00.000Z"
 *   "20261010T100000"  -> "2026-10-10T10:00:00.000Z"
 *   "20261010"         -> "2026-10-10T00:00:00.000Z"
 */
function parseIcsDateTime(raw: string): string {
  if (!raw) return new Date().toISOString();
  // Strip property parameters if present (e.g. TZID=America/New_York:20261010T100000)
  const val = raw.includes(':') ? raw.split(':').pop()! : raw;
  const clean = val.trim();

  // Pattern YYYYMMDDTHHMMSSZ or YYYYMMDDTHHMMSS
  const dtMatch = clean.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
  if (dtMatch) {
    const [, y, m, d, hh, mm, ss] = dtMatch;
    return new Date(Date.UTC(+y, +m - 1, +d, +hh, +mm, +ss)).toISOString();
  }

  // Pattern YYYYMMDD (all day)
  const dMatch = clean.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dMatch) {
    const [, y, m, d] = dMatch;
    return new Date(Date.UTC(+y, +m - 1, +d, 0, 0, 0)).toISOString();
  }

  // Fallback to JS Date parse
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return new Date().toISOString();
}

/**
 * Unfolds folded lines in an iCalendar file (lines beginning with space or tab).
 */
function unfoldIcsLines(raw: string): string {
  return raw.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
}

/**
 * Parses attendee line in format:
 * ATTENDEE;CN=Elena Rostova:mailto:elena.rostova@finscale.io
 * or
 * ATTENDEE:mailto:elena.rostova@finscale.io
 */
function parseAttendeeLine(line: string): CalendarAttendee | null {
  const mailtoIdx = line.toLowerCase().indexOf('mailto:');
  if (mailtoIdx === -1) return null;

  const email = line.slice(mailtoIdx + 7).trim().replace(/>$/, '');
  let name: string | undefined;

  const cnMatch = line.match(/CN=([^;:]+)/i);
  if (cnMatch) {
    name = cnMatch[1].replace(/^["']|["']$/g, '').trim();
  }

  return { email, name };
}

export class IcsCalendarProvider implements CalendarProvider {
  readonly name = 'ics';

  async getEvents(source?: string | Buffer): Promise<CalendarEvent[]> {
    if (!source) {
      return [];
    }

    const icsText = typeof source === 'string' ? source : source.toString('utf-8');
    const unfolded = unfoldIcsLines(icsText);
    const lines = unfolded.split(/\r?\n/);

    const events: CalendarEvent[] = [];
    const contacts = getContacts();

    let inEvent = false;
    let currentEvent: Partial<CalendarEvent> = {};
    let attendees: CalendarAttendee[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      if (line === 'BEGIN:VEVENT') {
        inEvent = true;
        currentEvent = {
          id: `event-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        };
        attendees = [];
        continue;
      }

      if (line === 'END:VEVENT') {
        if (inEvent) {
          currentEvent.attendees = attendees;
          if (!currentEvent.title) {
            currentEvent.title = 'Untitled Meeting';
          }
          if (!currentEvent.startTime) {
            currentEvent.startTime = new Date().toISOString();
          }
          if (!currentEvent.endTime) {
            // Default 1 hour later
            const end = new Date(new Date(currentEvent.startTime).getTime() + 60 * 60 * 1000);
            currentEvent.endTime = end.toISOString();
          }

          // Match attendees to contacts
          for (const attendee of attendees) {
            const matched = contacts.find((c) => {
              const emailMatch =
                c.email &&
                attendee.email &&
                c.email.trim().toLowerCase() === attendee.email.trim().toLowerCase();
              const nameMatch =
                attendee.name &&
                c.name &&
                c.name.trim().toLowerCase() === attendee.name.trim().toLowerCase();
              return emailMatch || nameMatch;
            });

            if (matched) {
              currentEvent.matchedContactId = matched.id;
              currentEvent.matchedContactName = matched.name;
              currentEvent.matchedContactRole = matched.role;
              currentEvent.matchedContactCompany = matched.company;
              currentEvent.matchedContactEmail = matched.email;
              currentEvent.matchedContactAvatarUrl = matched.avatarUrl;
              break;
            }
          }

          events.push(currentEvent as CalendarEvent);
        }
        inEvent = false;
        currentEvent = {};
        attendees = [];
        continue;
      }

      if (!inEvent) continue;

      // Parse event properties
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;

      const propHeader = line.slice(0, colonIdx);
      const propVal = line.slice(colonIdx + 1).trim();
      const propKey = propHeader.split(';')[0].toUpperCase();

      switch (propKey) {
        case 'UID':
          currentEvent.id = propVal;
          break;
        case 'SUMMARY':
          currentEvent.title = propVal.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, ' ');
          break;
        case 'DESCRIPTION':
          currentEvent.description = propVal.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, '\n');
          break;
        case 'LOCATION':
          currentEvent.location = propVal.replace(/\\,/g, ',').replace(/\\;/g, ';');
          break;
        case 'DTSTART':
          currentEvent.startTime = parseIcsDateTime(line);
          break;
        case 'DTEND':
          currentEvent.endTime = parseIcsDateTime(line);
          break;
        case 'STATUS':
          currentEvent.status = propVal;
          break;
        case 'ATTENDEE': {
          const attendee = parseAttendeeLine(line);
          if (attendee) {
            attendees.push(attendee);
          }
          break;
        }
      }
    }

    // Sort chronologically by start time
    return events.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }
}
