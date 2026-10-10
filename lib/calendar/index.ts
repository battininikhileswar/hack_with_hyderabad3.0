import { CalendarProvider } from './types';
import { IcsCalendarProvider } from './ics-provider';

export * from './types';
export * from './ics-provider';

/**
 * Calendar provider registry/factory.
 * Allows switching between 'ics', 'microsoft', or 'google' seamlessly in future updates.
 */
export function getCalendarProvider(type: 'ics' | 'microsoft' | 'google' = 'ics'): CalendarProvider {
  switch (type) {
    case 'ics':
      return new IcsCalendarProvider();
    case 'microsoft':
      throw new Error('Microsoft Graph Calendar provider will be available in a future update (no OAuth now).');
    case 'google':
      throw new Error('Google Calendar provider will be available in a future update (no OAuth now).');
    default:
      throw new Error(`Unknown calendar provider type: ${type}`);
  }
}
