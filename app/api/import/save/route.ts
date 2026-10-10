import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getContactById, upsertMeetingNote } from '@/lib/store';
import { retain, deleteDocument } from '@/lib/hindsight';
import { MeetingNote, MeetingOutcome, SentimentType } from '@/types';

export interface ImportPromiseItem {
  promise: string;
  owner: 'us' | 'them' | 'both' | string;
  dueDate?: string | null;
  dueNote?: string | null;
  status: 'pending' | 'in_progress' | 'kept' | string;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { contactId, date, summary, sentiment, outcome, promises, openQuestions, transcript } = body;

    if (!contactId || !date || !summary) {
      return NextResponse.json(
        { error: 'contactId, date, and summary are required.' },
        { status: 400 }
      );
    }

    const contact = getContactById(contactId);
    if (!contact) {
      return NextResponse.json(
        { error: `Contact not found with ID "${contactId}".` },
        { status: 404 }
      );
    }

    // 3. Duplicate guard: build documentId deterministically from contactId + date + sha256 hash of transcript
    const rawContentForHash = (transcript || summary).trim();
    const transcriptHash = crypto
      .createHash('sha256')
      .update(rawContentForHash)
      .digest('hex')
      .slice(0, 12);
    const documentId = `import-${contactId}-${date}-${transcriptHash}`;

    // Clean promises & open questions
    const cleanPromises: ImportPromiseItem[] = Array.isArray(promises) ? promises : [];
    const cleanQuestions: string[] = Array.isArray(openQuestions) ? openQuestions.map(String) : [];

    // Formatted promise strings for standard MeetingNote structure
    const promiseStrings = cleanPromises.map((p) => {
      const ownerLabel = p.owner === 'us' ? 'Our Team' : p.owner === 'them' ? contact.name : 'Joint';
      const dueStr = p.dueDate ? ` (Due: ${p.dueDate})` : p.dueNote ? ` (Timeframe: ${p.dueNote})` : '';
      const statusStr = p.status ? ` [Status: ${p.status}]` : '';
      return `[${ownerLabel}] ${p.promise}${dueStr}${statusStr}`;
    });

    const newMeetingNote: MeetingNote = {
      id: documentId,
      contactId,
      date,
      summary,
      promisesMade: promiseStrings,
      openQuestions: cleanQuestions,
      sentiment: (sentiment || 'neutral') as SentimentType,
      outcome: (outcome || 'advanced') as MeetingOutcome,
      rawNotes: transcript || summary,
      createdAt: new Date().toISOString(),
    };

    // 1. Upsert note to local store (replaces if identical documentId exists)
    upsertMeetingNote(newMeetingNote);

    // 2. Retain main meeting note into Hindsight
    // Note: If documentId already exists in Hindsight, delete/replace first
    const bankId = process.env.HINDSIGHT_BANK_ID || 'meeting-prep-agent';
    try {
      await deleteDocument(bankId, documentId);
    } catch {
      // Ignore if document didn't exist yet
    }

    const mainMemoryContent = `Meeting with ${contact.name} (${contact.role} at ${contact.company}) on ${date}.
Outcome: ${(outcome || 'advanced').toUpperCase()}. Sentiment: ${sentiment || 'neutral'}.
Executive Summary:
${summary}

Open Questions & Dependencies:
${cleanQuestions.length > 0 ? cleanQuestions.map((q) => `- ${q}`).join('\n') : 'None recorded.'}

Discussion Transcript:
${(transcript || summary).slice(0, 4000)}`;

    const mainTags = [
      `contact:${contact.id}`,
      `outcome:${outcome || 'advanced'}`,
      'type:meeting',
      'type:imported_meeting',
    ];

    console.log(`[Import Save] Retaining main meeting memory "${documentId}" into Hindsight bank...`);
    await retain(mainMemoryContent, {
      contactId: contact.id,
      contactName: contact.name,
      date,
      documentId,
      outcome: outcome || 'advanced',
      tags: mainTags,
    });

    // 3. Retain each promise as a separate tagged memory
    // Mapping requirement: owner "us" -> promise:our, "them" -> promise:their, "both" -> promise:both
    let retainedPromisesCount = 0;
    for (let idx = 0; idx < cleanPromises.length; idx++) {
      const p = cleanPromises[idx];
      if (!p.promise || !p.promise.trim()) continue;

      const normOwner = (p.owner || '').toLowerCase().trim();
      const promiseTag =
        normOwner === 'them'
          ? 'promise:their'
          : normOwner === 'both'
          ? 'promise:both'
          : 'promise:our';

      const ownerDisplay =
        normOwner === 'them'
          ? contact.name
          : normOwner === 'both'
          ? `Mutual (${contact.name} & our team)`
          : 'Our Team';

      const dueInfo = p.dueDate
        ? ` (Due date: ${p.dueDate})`
        : p.dueNote
        ? ` (Timeframe: ${p.dueNote})`
        : '';

      const promiseContent = `[Promise - ${ownerDisplay}] In meeting with ${contact.name} on ${date}: ${p.promise}${dueInfo}. Status: ${p.status || 'pending'}. Outcome: ${(outcome || 'advanced').toUpperCase()}.`;

      const promiseDocId = `${documentId}-p${idx + 1}`;
      try {
        await deleteDocument(bankId, promiseDocId);
      } catch {
        // Ignore if not present
      }

      const promiseTags = [
        `contact:${contact.id}`,
        'type:promise',
        promiseTag,
        `status:${p.status || 'pending'}`,
        `outcome:${outcome || 'advanced'}`,
        'type:imported_meeting',
      ];

      try {
        await retain(promiseContent, {
          contactId: contact.id,
          contactName: contact.name,
          date,
          documentId: promiseDocId,
          outcome: outcome || 'advanced',
          tags: promiseTags,
        });
        retainedPromisesCount++;
      } catch (promiseRetainErr) {
        console.warn(`[Import Save] Warning retaining individual promise for ${contact.name}:`, promiseRetainErr);
      }
    }

    return NextResponse.json({
      success: true,
      contact,
      meetingNote: newMeetingNote,
      documentId,
      retainedMainMemory: {
        documentId,
        content: mainMemoryContent,
        tags: mainTags,
      },
      retainedPromisesCount,
      totalPromises: cleanPromises.length,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Import Save] Unexpected error:', error);
    const rawMsg = (error as Error).message || String(error);
    const isHindsight = /hindsight|bank|vectorize|retain/i.test(rawMsg);
    return NextResponse.json(
      {
        error: isHindsight
          ? `Hindsight Memory Bank Error: ${rawMsg}`
          : `Failed to save and retain imported meeting: ${rawMsg}`,
        service: isHindsight ? 'hindsight' : 'unknown',
        rawError: rawMsg,
      },
      { status: 500 }
    );
  }
}
