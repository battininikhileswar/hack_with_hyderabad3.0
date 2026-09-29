import { NextResponse } from 'next/server';
import { getMeetingsByContact, addMeetingNote, getContactById } from '@/lib/store';
import { retain } from '@/lib/hindsight';
import { MeetingNote } from '@/types';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const contactId = searchParams.get('contactId');

    if (!contactId) {
      return NextResponse.json({ error: 'contactId parameter is required' }, { status: 400 });
    }

    const meetings = getMeetingsByContact(contactId);
    return NextResponse.json({ meetings, notes: meetings });
  } catch (error) {
    console.error('Error in GET /api/notes:', error);
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { contactId, date, summary, promisesMade, openQuestions, sentiment, rawNotes, actionItems } = body;

    if (!contactId || !date || !summary) {
      return NextResponse.json({ error: 'contactId, date, and summary are required' }, { status: 400 });
    }

    const contact = getContactById(contactId);
    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    const noteId = `note-${contactId}-${Date.now()}`;
    const newNote: MeetingNote = {
      id: noteId,
      contactId,
      date,
      summary,
      promisesMade: Array.isArray(promisesMade) ? promisesMade : [promisesMade].filter(Boolean),
      openQuestions: Array.isArray(openQuestions) ? openQuestions : [openQuestions].filter(Boolean),
      sentiment: sentiment || 'neutral',
      rawNotes: rawNotes || '',
      actionItems: Array.isArray(actionItems) ? actionItems : (actionItems ? [actionItems] : []),
      createdAt: new Date().toISOString(),
    };

    // Save to local store
    addMeetingNote(newNote);

    // Retain to Hindsight memory bank
    const promisesStr = Array.isArray(newNote.promisesMade) ? newNote.promisesMade.join('; ') : newNote.promisesMade;
    const questionsStr = Array.isArray(newNote.openQuestions) ? newNote.openQuestions.join('; ') : newNote.openQuestions;

    const memoryContent = [
      `Meeting with ${contact.name} (${contact.role} at ${contact.company}) on ${newNote.date}.`,
      `Summary: ${newNote.summary}`,
      `Promises Made: ${promisesStr}`,
      `Open Questions / Unresolved: ${questionsStr}`,
      `Meeting Sentiment: ${newNote.sentiment}.`,
      `Detailed Context: ${newNote.rawNotes || ''}`,
    ].join('\n');

    let memoryRetained = false;
    let retainError: string | undefined;

    try {
      await retain(memoryContent, {
        contactId: contact.id,
        contactName: contact.name,
        company: contact.company,
        role: contact.role,
        meetingId: noteId,
        documentId: `meeting-${contact.id}-${noteId}`,
        date: newNote.date,
        sentiment: String(newNote.sentiment),
        tags: [
          contact.id,
          `contact:${contact.id}`,
          contact.company.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          `sentiment:${newNote.sentiment}`,
        ],
      });
      memoryRetained = true;
    } catch (err: unknown) {
      console.error('Failed to retain note in Hindsight:', err);
      retainError = (err as Error).message;
    }

    return NextResponse.json(
      {
        note: newNote,
        memoryRetained,
        retainError,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/notes:', error);
    return NextResponse.json({ error: 'Failed to create meeting note' }, { status: 500 });
  }
}
