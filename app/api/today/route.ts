import { NextResponse } from 'next/server';
import { getCalendarProvider } from '@/lib/calendar';
import { getOrGenerateTodayBriefing, getAllCachedBriefings } from '@/lib/today-cache';
import fs from 'fs';
import path from 'path';

const SAMPLE_ICS_PATH = path.join(process.cwd(), 'data', 'sample-calendar.ics');
const ACTIVE_ICS_PATH = path.join(process.cwd(), 'data', 'active-calendar.ics');

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    const provider = getCalendarProvider('ics');
    const icsPath = fs.existsSync(ACTIVE_ICS_PATH) ? ACTIVE_ICS_PATH : SAMPLE_ICS_PATH;

    let events = [];
    if (fs.existsSync(icsPath)) {
      const icsContent = fs.readFileSync(icsPath, 'utf-8');
      events = await provider.getEvents(icsContent);
    }

    const cachedAll = getAllCachedBriefings();

    // Enrich each meeting event with today's briefing card data
    const enrichedMeetings = await Promise.all(
      events.map(async (event) => {
        let briefing = null;
        if (event.matchedContactId) {
          if (!forceRefresh && cachedAll[event.matchedContactId]) {
            briefing = cachedAll[event.matchedContactId];
          } else {
            try {
              briefing = await getOrGenerateTodayBriefing(event.matchedContactId, forceRefresh);
            } catch (err) {
              console.warn(`Error generating briefing for ${event.matchedContactId}:`, err);
            }
          }
        }

        return {
          ...event,
          briefingReady: !!briefing,
          briefing: briefing || {
            relationshipStatus: 'neutral',
            topRisk: 'No briefing generated yet.',
            executiveSummary: 'Upcoming meeting with attendees.',
          },
        };
      })
    );

    return NextResponse.json({
      success: true,
      meetings: enrichedMeetings,
      totalMeetings: enrichedMeetings.length,
      briefingsReadyCount: enrichedMeetings.filter((m) => m.briefingReady).length,
      calendarSource: path.basename(icsPath),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching today dashboard data:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to fetch today dashboard data' },
      { status: 500 }
    );
  }
}
