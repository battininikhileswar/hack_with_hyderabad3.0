import { NextResponse } from 'next/server';
import { getContactById, addMeetingNote, getMeetingsByContact, saveAppData, getAppData } from '@/lib/store';
import { retain } from '@/lib/hindsight';
import { chatCompletion, safeParseJson } from '@/lib/groq';
import { MeetingNote, MeetingOutcome, ExtractedPromise } from '@/types';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { contactId, date, outcome, rawNotes } = body;

    if (!contactId || !date || !outcome || !rawNotes) {
      return NextResponse.json(
        { error: 'contactId, date, outcome, and rawNotes are required' },
        { status: 400 }
      );
    }

    if (!['advanced', 'stalled', 'lost_ground'].includes(outcome)) {
      return NextResponse.json(
        { error: 'outcome must be one of: advanced, stalled, lost_ground' },
        { status: 400 }
      );
    }

    const contact = getContactById(contactId);
    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    // Map outcome to baseline sentiment
    const sentiment =
      outcome === 'advanced' ? 'positive' : outcome === 'stalled' ? 'mixed' : 'negative';

    // 1. Use Groq to extract structured promises and commitments from raw notes
    const extractionSystemPrompt = `You are an executive assistant analyzing raw meeting debrief notes.
Your task is to extract all explicit promises, commitments, and action items made during the meeting by both sides.

Rules:
- Do not use emojis anywhere in your text.
- Do not use em dashes in your text. Use periods, commas, or colons instead.
- "ourPromises": Commitments, deliverables, or follow-ups promised by our company/team.
- "theirPromises": Commitments, decisions, or deliverables promised by the contact or their team.
- For each item, extract:
  - "promise": concise description of the commitment
  - "dueDate": specific date (YYYY-MM-DD) or explicit timeframe (e.g., "by next Friday", "end of month") if mentioned, or null
  - "owner": person or team responsible (e.g., "Engineering Team", "General Counsel", contact name)
- If none were made in a category, return an empty array.
- Output valid JSON only adhering strictly to the schema below without markdown backticks:

{
  "summary": "1-2 sentence high-level executive summary of what transpired in this meeting and the primary driver of the outcome.",
  "ourPromises": [
    {
      "promise": "Description of commitment made by our team",
      "dueDate": "YYYY-MM-DD or timeframe or null",
      "owner": "Our Team"
    }
  ],
  "theirPromises": [
    {
      "promise": "Description of commitment made by the contact/counterparty",
      "dueDate": "YYYY-MM-DD or timeframe or null",
      "owner": "Contact Name"
    }
  ],
  "openQuestions": [
    "Unresolved question or objection that remained open after the meeting"
  ]
}`;

    const extractionUserPrompt = `CONTACT: ${contact.name} (${contact.role} at ${contact.company})
MEETING DATE: ${date}
MEETING OUTCOME: ${outcome.toUpperCase()}

RAW MEETING NOTES:
${rawNotes}`;

    let extractedSummary = `Meeting with ${contact.name} on ${date} (Outcome: ${outcome.replace('_', ' ')})`;
    let ourPromises: ExtractedPromise[] = [];
    let theirPromises: ExtractedPromise[] = [];
    let openQuestions: string[] = [];

    try {
      const groqRes = await chatCompletion({
        model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: extractionSystemPrompt },
          { role: 'user', content: extractionUserPrompt },
        ],
        temperature: 0.1,
        max_tokens: 1800,
      });

      const parsed = safeParseJson<Record<string, unknown>>(groqRes.content || '{}');
      if (parsed.success) {
        if (typeof parsed.data.summary === 'string' && parsed.data.summary.trim()) {
          extractedSummary = parsed.data.summary.trim();
        }
        if (Array.isArray(parsed.data.ourPromises)) {
          ourPromises = parsed.data.ourPromises as ExtractedPromise[];
        }
        if (Array.isArray(parsed.data.theirPromises)) {
          theirPromises = parsed.data.theirPromises as ExtractedPromise[];
        }
        if (Array.isArray(parsed.data.openQuestions)) {
          openQuestions = parsed.data.openQuestions.map(String);
        }
      }
    } catch (groqErr) {
      console.warn('Groq promise extraction warning in /api/debrief:', groqErr);
    }

    // 2. Save structured note into local store
    const noteId = `debrief-${contactId}-${Date.now()}`;
    const allPromiseStrings = [
      ...ourPromises.map((p) => `[Our Team] ${p.promise}${p.dueDate ? ` (Due: ${p.dueDate})` : ''}`),
      ...theirPromises.map((p) => `[${contact.name}] ${p.promise}${p.dueDate ? ` (Due: ${p.dueDate})` : ''}`),
    ];

    const newNote: MeetingNote = {
      id: noteId,
      contactId,
      date,
      summary: extractedSummary,
      promisesMade: allPromiseStrings,
      openQuestions,
      sentiment,
      outcome: outcome as MeetingOutcome,
      rawNotes,
      createdAt: new Date().toISOString(),
    };

    addMeetingNote(newNote);

    // 3. retain() the meeting debrief notes into Hindsight memory bank
    const debriefMemoryContent = `Meeting with ${contact.name} (${contact.role} at ${contact.company}) on ${date}.
Meeting Outcome: ${outcome.toUpperCase()} (Tactic & Progress State).
Executive Summary: ${extractedSummary}
Discussion Notes:
${rawNotes}`;

    const debriefTags = [
      `contact:${contact.id}`,
      `outcome:${outcome}`,
      'type:debrief',
      'type:meeting',
    ];

    await retain(debriefMemoryContent, {
      contactId: contact.id,
      contactName: contact.name,
      date,
      documentId: noteId,
      outcome,
      tags: debriefTags,
    });

    // 4. Retain each extracted promise as a separate tagged memory in Hindsight
    let retainedPromiseCount = 0;

    for (const p of ourPromises) {
      if (!p.promise) continue;
      const promiseContent = `[Promise - Our Team] In meeting with ${contact.name} on ${date}, our team promised: ${p.promise}${p.dueDate ? ` (Due date: ${p.dueDate})` : ''}. Meeting outcome was ${outcome.toUpperCase()}.`;
      await retain(promiseContent, {
        contactId: contact.id,
        contactName: contact.name,
        date,
        outcome,
        tags: [
          `contact:${contact.id}`,
          'type:promise',
          'promise:our',
          `outcome:${outcome}`,
        ],
      });
      retainedPromiseCount++;
    }

    for (const p of theirPromises) {
      if (!p.promise) continue;
      const promiseContent = `[Promise - Counterparty] In meeting on ${date}, ${contact.name} promised: ${p.promise}${p.dueDate ? ` (Due date: ${p.dueDate})` : ''}. Meeting outcome was ${outcome.toUpperCase()}.`;
      await retain(promiseContent, {
        contactId: contact.id,
        contactName: contact.name,
        date,
        outcome,
        tags: [
          `contact:${contact.id}`,
          'type:promise',
          'promise:their',
          `outcome:${outcome}`,
        ],
      });
      retainedPromiseCount++;
    }

    // 5. Return detailed confirmation payload showing what was stored
    return NextResponse.json({
      success: true,
      contact,
      meetingNote: newNote,
      outcome,
      retainedNoteMemory: {
        content: debriefMemoryContent,
        tags: debriefTags,
        timestamp: date,
      },
      extractedPromises: {
        ourPromises,
        theirPromises,
      },
      retainedPromiseCount,
      storedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error processing post-meeting debrief in /api/debrief:', error);
    const rawMsg = (error as Error).message || 'Failed to process post-meeting debrief';
    const isHindsight = /hindsight|bank|vectorize|retain/i.test(rawMsg);
    const isGroq = /groq|openai|rate_limit|429/i.test(rawMsg);
    return NextResponse.json(
      {
        error: isHindsight
          ? `Hindsight Memory Bank Error: ${rawMsg}`
          : isGroq
          ? `Groq LLM Service Error: ${rawMsg}`
          : `Debrief Processing Error: ${rawMsg}`,
        service: isHindsight ? 'hindsight' : isGroq ? 'groq' : 'unknown',
        rawError: rawMsg,
      },
      { status: 500 }
    );
  }
}
