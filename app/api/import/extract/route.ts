import { NextResponse } from 'next/server';
import { getGroqClient, chatCompletion, safeParseJson } from '@/lib/groq';
import { getContactById } from '@/lib/store';

// Maximum audio file upload limit: 25 MB (Groq Whisper limit)
const MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';

    let contactId = '';
    let meetingDate = '';
    let transcriptText = '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      contactId = String(formData.get('contactId') || '');
      meetingDate = String(formData.get('date') || '');
      const rawText = formData.get('transcript');
      const audioFile = formData.get('audio') as File | null;

      if (rawText && typeof rawText === 'string' && rawText.trim()) {
        transcriptText = rawText.trim();
      } else if (audioFile && audioFile.size > 0) {
        // Enforce size limit
        if (audioFile.size > MAX_AUDIO_SIZE_BYTES) {
          return NextResponse.json(
            {
              error: `Audio file is too large (${(audioFile.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed size for Groq Whisper is 25MB. Please compress or split the audio file.`,
            },
            { status: 413 }
          );
        }

        try {
          const groq = getGroqClient();
          console.log(`[Import Meeting] Transcribing audio with Groq Whisper (${audioFile.name}, ${audioFile.size} bytes)...`);
          const transcription = await groq.audio.transcriptions.create({
            file: audioFile,
            model: 'whisper-large-v3-turbo',
            response_format: 'verbose_json',
            temperature: 0.0,
          });

          transcriptText = (transcription.text || '').trim();
          console.log(`[Import Meeting] Transcription complete (${transcriptText.length} characters).`);
        } catch (transcribeError) {
          console.error('[Import Meeting] Groq Whisper error:', transcribeError);
          const rawErr = (transcribeError as Error).message || String(transcribeError);
          return NextResponse.json(
            {
              error: `Audio transcription failed via Groq Whisper: ${rawErr}. Please ensure the audio file is a valid supported format (mp3, mp4, mpeg, mpga, m4a, wav, webm) and retry.`,
              service: 'groq_whisper',
              rawError: rawErr,
            },
            { status: 502 }
          );
        }
      }
    } else {
      // JSON body
      const body = await req.json();
      contactId = body.contactId || '';
      meetingDate = body.date || '';
      transcriptText = (body.transcript || '').trim();
    }

    if (!contactId) {
      return NextResponse.json(
        { error: 'A contact must be selected to import this meeting.' },
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

    if (!transcriptText || transcriptText.trim().length === 0) {
      return NextResponse.json(
        {
          error: 'Transcript is empty. Please paste conversation notes or upload an audio file containing audible speech.',
        },
        { status: 400 }
      );
    }

    // Default meeting date to today if not provided
    const targetDate = meetingDate && /^\d{4}-\d{2}-\d{2}/.test(meetingDate)
      ? meetingDate.slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    // Extract structured note using Groq LLM
    const extractionSystemPrompt = `You are an executive meeting analyst specializing in relationship intelligence.
Analyze the provided meeting transcript or discussion between our team and the contact.
Extract a precise structured meeting record with executive summary, promises, open questions, overall sentiment, and meeting outcome.

Rules:
- Do not use emojis anywhere in your text.
- Do not use em dashes in your text. Use periods, commas, or colons instead.
- "sentiment" must be one of: "positive", "mixed", "neutral", "negative".
- "outcome" must be one of: "advanced" (deal/partnership moved forward), "stalled" (delayed/blocked/waiting), "lost_ground" (relationship strained or terms rejected).
- "promises" must be an array of objects:
  - "promise": concrete description of what was committed.
  - "owner": must be strictly one of: "us", "them", or "both".
    * Map named people using the contact profile: the contact (${contact.name} and their company/colleagues) means "them".
    * Our team, solutions architects, account executives, engineers, or company representatives mean "us".
    * Mutual commitments or joint deliverables mean "both".
  - "dueDate": strictly an ISO date (YYYY-MM-DD) or null.
    * Only set "dueDate" if a specific date or calendar day can be resolved (e.g. "October 18, 2026" becomes "2026-10-18").
    * Phrases like "by next touchpoint", "next week", "end of month", or "Q4" MUST have "dueDate" set to null.
  - "dueNote": if a relative, qualitative, or non-ISO timeframe was mentioned (e.g. "by next touchpoint", "in two weeks", "pending legal review"), put that text in "dueNote". If a specific date was provided, "dueNote" can be the original phrase or null.
  - "status": "pending", "in_progress", or "kept".
- "openQuestions": list of questions, objections, or dependencies left unresolved at the end of the meeting.
- Output valid JSON only, adhering strictly to the schema below without markdown formatting or backticks:

{
  "summary": "2-3 clear sentences summarizing the core discussion, key decisions, and strategic momentum.",
  "sentiment": "positive" | "mixed" | "neutral" | "negative",
  "outcome": "advanced" | "stalled" | "lost_ground",
  "promises": [
    {
      "promise": "Description of promise",
      "owner": "us" | "them" | "both",
      "dueDate": "YYYY-MM-DD" | null,
      "dueNote": "Textual timeframe like 'by next touchpoint' or null",
      "status": "pending" | "in_progress" | "kept"
    }
  ],
  "openQuestions": [
    "Unresolved question or open requirement"
  ]
}`;

    const extractionUserPrompt = `CONTACT PROFILE:
- Name: ${contact.name}
- Role: ${contact.role}
- Company: ${contact.company}
- Meeting Date: ${targetDate}

TRANSCRIPT CONTENT:
${transcriptText.slice(0, 24000)}

Extract the structured meeting note JSON now.`;

    const groqRes = await chatCompletion({
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: extractionSystemPrompt },
        { role: 'user', content: extractionUserPrompt },
      ],
      temperature: 0.1,
      max_tokens: 2200,
    });

    const parsed = safeParseJson<Record<string, unknown>>(groqRes.content || '{}');
    if (!parsed.success) {
      console.error('[Import Meeting] Failed to parse Groq extraction JSON:', groqRes.content);
      return NextResponse.json(
        {
          error: 'Failed to extract structured meeting information from transcript. The AI output was not valid JSON.',
          service: 'groq',
          rawContent: groqRes.content,
        },
        { status: 500 }
      );
    }

    const data = parsed.data;

    // Normalize output fields
    const summary = typeof data.summary === 'string' && data.summary.trim()
      ? data.summary.trim()
      : `Discussion with ${contact.name} regarding project milestones and commitments.`;

    const sentiment = ['positive', 'mixed', 'neutral', 'negative'].includes(String(data.sentiment))
      ? String(data.sentiment)
      : 'neutral';

    const outcome = ['advanced', 'stalled', 'lost_ground'].includes(String(data.outcome))
      ? String(data.outcome)
      : 'advanced';

    const contactLower = contact.name.toLowerCase();
    const contactFirst = contact.name.split(' ')[0].toLowerCase();
    const contactCompany = contact.company.toLowerCase();

    const normalizeOwner = (rawOwner: unknown): 'us' | 'them' | 'both' => {
      const o = String(rawOwner || '').toLowerCase().trim();
      if (o === 'both' || o.includes('both') || o.includes('mutual') || o.includes('joint')) {
        return 'both';
      }
      if (
        o === 'them' ||
        o.includes(contactLower) ||
        o.includes(contactFirst) ||
        o.includes(contactCompany) ||
        o.includes('client') ||
        o.includes('customer') ||
        o.includes('counterparty')
      ) {
        return 'them';
      }
      return 'us';
    };

    const normalizeDateAndNote = (rawDate: unknown, rawNote: unknown): { isoDate: string | null; dueNote: string | null } => {
      const dateStr = rawDate ? String(rawDate).trim() : '';
      const noteStr = rawNote ? String(rawNote).trim() : '';

      // Check if rawDate is a strict ISO date (YYYY-MM-DD)
      const isoMatch = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
      if (isoMatch) {
        return {
          isoDate: isoMatch[1],
          dueNote: noteStr || null,
        };
      }

      // Check if text has embedded ISO date
      const embeddedMatch = (dateStr + ' ' + noteStr).match(/(\d{4}-\d{2}-\d{2})/);
      if (embeddedMatch) {
        return {
          isoDate: embeddedMatch[1],
          dueNote: dateStr !== embeddedMatch[1] ? dateStr : (noteStr || null),
        };
      }

      // Non-ISO date (e.g. "by next touchpoint", "in two weeks")
      return {
        isoDate: null,
        dueNote: dateStr || noteStr || null,
      };
    };

    const rawPromises = Array.isArray(data.promises) ? data.promises : [];
    const promises = rawPromises.map((p: Record<string, unknown>) => {
      const { isoDate, dueNote } = normalizeDateAndNote(p.dueDate, p.dueNote);
      return {
        promise: String(p.promise || ''),
        owner: normalizeOwner(p.owner),
        dueDate: isoDate,
        dueNote: dueNote,
        status: ['pending', 'in_progress', 'kept'].includes(String(p.status)) ? String(p.status) : 'pending',
      };
    }).filter((p) => p.promise.length > 0);

    const openQuestions = Array.isArray(data.openQuestions)
      ? data.openQuestions.map(String).filter((q) => q.trim().length > 0)
      : [];

    return NextResponse.json({
      success: true,
      contact,
      date: targetDate,
      transcript: transcriptText,
      extracted: {
        summary,
        sentiment,
        outcome,
        promises,
        openQuestions,
      },
    });
  } catch (error) {
    console.error('[Import Meeting] Unexpected error:', error);
    const rawMsg = (error as Error).message || String(error);
    return NextResponse.json(
      {
        error: `Import failed: ${rawMsg}`,
        service: 'import',
        rawError: rawMsg,
      },
      { status: 500 }
    );
  }
}
