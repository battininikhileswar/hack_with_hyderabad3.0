import { NextResponse } from 'next/server';
import { getContacts, getMeetingsByContact, addContact } from '@/lib/store';
import { Contact } from '@/types';

export async function GET() {
  try {
    const contacts = getContacts();
    const enriched = contacts.map((contact) => {
      const meetings = getMeetingsByContact(contact.id);
      const sentiments = meetings.map((m) => m.sentiment);
      const latestSentiment = sentiments.length > 0 ? sentiments[sentiments.length - 1] : 'neutral';
      return {
        ...contact,
        meetingCount: meetings.length,
        latestSentiment,
        latestMeetingDate: meetings.length > 0 ? meetings[meetings.length - 1].date : null,
      };
    });

    return NextResponse.json({ contacts: enriched });
  } catch (error) {
    console.error('Error in GET /api/contacts:', error);
    return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, company, role, email } = body;

    if (!name || !company || !role) {
      return NextResponse.json({ error: 'Name, company, and role are required' }, { status: 400 });
    }

    const id = `contact-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;
    const newContact: Contact = {
      id,
      name,
      company,
      role,
      email: email || undefined,
      createdAt: new Date().toISOString(),
    };

    addContact(newContact);
    return NextResponse.json({ contact: newContact }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/contacts:', error);
    return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 });
  }
}
