import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getCalendarProvider } from '@/lib/calendar';

const SAMPLE_ICS_PATH = path.join(process.cwd(), 'data', 'sample-calendar.ics');
const ACTIVE_ICS_PATH = path.join(process.cwd(), 'data', 'active-calendar.ics');

export async function GET() {
  try {
    const provider = getCalendarProvider('ics');
    
    // Check if active uploaded calendar exists, else use sample calendar
    const icsPath = fs.existsSync(ACTIVE_ICS_PATH) ? ACTIVE_ICS_PATH : SAMPLE_ICS_PATH;
    if (!fs.existsSync(icsPath)) {
      return NextResponse.json({ events: [], total: 0, matchedCount: 0 });
    }

    const icsContent = fs.readFileSync(icsPath, 'utf-8');
    const events = await provider.getEvents(icsContent);

    const matchedCount = events.filter((e) => !!e.matchedContactId).length;

    return NextResponse.json({
      success: true,
      provider: provider.name,
      events,
      total: events.length,
      matchedCount,
      unmatchedCount: events.length - matchedCount,
      calendarSource: path.basename(icsPath),
    });
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to fetch calendar events' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let icsContent = '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'No file provided in form-data' }, { status: 400 });
      }
      icsContent = await file.text();
    } else {
      const body = await req.json();
      icsContent = body.icsContent || '';
    }

    if (!icsContent.trim()) {
      return NextResponse.json({ error: 'iCalendar content is empty' }, { status: 400 });
    }

    const provider = getCalendarProvider('ics');
    const events = await provider.getEvents(icsContent);

    // Save as active calendar
    const dir = path.dirname(ACTIVE_ICS_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(ACTIVE_ICS_PATH, icsContent, 'utf-8');

    const matchedContacts = events
      .filter((e) => !!e.matchedContactId)
      .map((e) => ({
        eventId: e.id,
        contactId: e.matchedContactId,
        contactName: e.matchedContactName,
        email: e.matchedContactEmail,
      }));

    return NextResponse.json({
      success: true,
      provider: provider.name,
      events,
      totalEventsParsed: events.length,
      matchedCount: matchedContacts.length,
      unmatchedCount: events.length - matchedContacts.length,
      matchedContacts,
      message: `Successfully imported calendar: ${events.length} events parsed, ${matchedContacts.length} matched to existing contacts.`,
    });
  } catch (error) {
    console.error('Error processing calendar upload:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to process calendar upload' },
      { status: 500 }
    );
  }
}
