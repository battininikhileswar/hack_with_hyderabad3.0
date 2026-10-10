import { NextResponse } from 'next/server';
import { getContactById, getMeetingsByContact } from '@/lib/store';
import { recall, reflect } from '@/lib/hindsight';
import { chatCompletion, safeParseJson } from '@/lib/groq';
import { MemoryFact, LearnedInsights } from '@/types';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { contactId, upcomingAgenda, meetingGoal, useMemory = true } = body;

    if (!contactId) {
      return NextResponse.json({ error: 'contactId is required' }, { status: 400 });
    }

    const contact = getContactById(contactId);
    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    const allFacts: MemoryFact[] = [];
    let reflectSynthesis = '';
    let reflectEvidence: any[] = [];

    let insightsProvenance: 'Inferred by Hindsight' | 'Synthesized from recalled memories' | null = null;

    // 1. Recall & Reflect from Hindsight memory bank only when useMemory is true
    if (useMemory) {
      const queries = [
        `What are all past discussions, milestones, and agreements with ${contact.name}?`,
        `What promises, commitments, deliverables, or deadlines were made to ${contact.name} or by ${contact.name}?`,
        `What questions, objections, compliance requirements, or issues were left open or unresolved with ${contact.name}?`,
        `What past meeting outcomes, debrief notes, and tactics advanced vs stalled meetings with ${contact.name}?`,
      ];

      if (upcomingAgenda) {
        queries.push(`Specific context related to: ${upcomingAgenda}`);
      }

      const [recallResults, reflectResult] = await Promise.all([
        Promise.allSettled(
          queries.map((q) => recall(q, { contactId: contact.id, budget: 'mid', maxTokens: 4000 }))
        ),
        reflect(
          `Analyze all past meetings and interactions with ${contact.name}. What were the key trust turning points, which specific tactics advanced versus stalled meetings, and what are ${contact.name}'s communication preferences? Synthesize the key strategic patterns.`,
          { contactId: contact.id, budget: 'low', includeFacts: true }
        ).catch((err) => {
          console.warn('Reflect warning in /api/briefing:', err);
          return { text: '' };
        }),
      ]);

      if (reflectResult && reflectResult.text && reflectResult.text.trim().length > 0) {
        reflectSynthesis = reflectResult.text.trim();
        insightsProvenance = 'Inferred by Hindsight';
        if (reflectResult.basedOn?.memories) {
          reflectEvidence = reflectResult.basedOn.memories;
        }
      }

      const factTextSet = new Set<string>();
      let failedRecallCount = 0;

      for (const res of recallResults) {
        if (res.status === 'fulfilled' && res.value?.facts) {
          for (const fact of res.value.facts) {
            if (!factTextSet.has(fact.text)) {
              factTextSet.add(fact.text);
              allFacts.push(fact);
            }
          }
        } else if (res.status === 'rejected') {
          failedRecallCount++;
        }
      }

      // If reflect is unusable after two attempts, fall back to generating insights with Groq from recalled facts
      if (!reflectSynthesis && allFacts.length > 0) {
        try {
          console.log('[Briefing] Hindsight reflect unusable; falling back to Groq synthesis from recalled facts.');
          const fallbackPrompt = `You are an executive meeting strategist. Based ONLY on the following recalled memory facts from past meetings with ${contact.name}, identify:
1. Key trust turning points (moments where trust advanced, broke, or recovered)
2. Which specific tactics advanced meetings versus stalled them
3. ${contact.name}'s communication preferences

RECALLED FACTS:
${allFacts.slice(0, 15).map((f, i) => `- [${f.occurredStart ? f.occurredStart.slice(0, 10) : 'Date unknown'}] ${f.text}`).join('\n')}

Synthesize the key patterns concisely covering all three areas. Do not use emojis or em dashes.`;

          const fallbackResponse = await chatCompletion({
            model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
            messages: [
              { role: 'system', content: 'You are an executive strategist analyzing past meeting facts.' },
              { role: 'user', content: fallbackPrompt },
            ],
            temperature: 0.1,
            max_tokens: 450,
          });

          if (fallbackResponse && fallbackResponse.content) {
            reflectSynthesis = fallbackResponse.content.trim();
            insightsProvenance = 'Synthesized from recalled memories';
          }
        } catch (fallbackErr) {
          console.warn('[Briefing] Fallback Groq synthesis failed:', fallbackErr);
        }
      }

      // If all recall attempts failed when memory was requested, surface clear Hindsight error
      if (failedRecallCount === queries.length && queries.length > 0) {
        const firstFailure = recallResults.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
        const failureReason = firstFailure?.reason?.message || 'Memory bank unreachable';
        return NextResponse.json(
          {
            error: `Hindsight Memory Bank Error: Unable to recall relationship memories from bank "${process.env.HINDSIGHT_BANK_ID || 'nikhil'}". ${failureReason}`,
            service: 'hindsight',
            statusCode: 502,
            rawError: failureReason,
          },
          { status: 502 }
        );
      }
    }

    // 2. Prepare context for Groq LLM (top 10 facts to stay well within TPM limits)
    const factsToUse = allFacts.slice(0, 10);
    const memoriesPromptSection = useMemory && factsToUse.length > 0
      ? factsToUse.map((f, i) => {
          const dateStr = f.occurredStart ? f.occurredStart.slice(0, 10) : '';
          const docId = f.documentId || '';
          return `[Fact ${i + 1} | Date: ${dateStr} | DocID: ${docId}] ${f.text}${f.context ? ` [Context: ${f.context}]` : ''}`;
        }).join('\n')
      : `[NO HISTORICAL MEMORY AVAILABLE: Memory Mode is DISABLED]\nYou have zero past meeting history, zero records of past promises, and zero knowledge of past relationship friction or agreements. Generate the briefing using only the contact name, role, and company.`;

    const systemPrompt = useMemory
      ? `You are an executive meeting preparation agent with access to persistent long-term memory.
Your job is to brief a professional before an upcoming meeting with a contact by recalling everything relevant from past meetings with that person.

Rules:
- Do not use emojis anywhere in your text.
- Do not use em dashes in your text. Use periods, commas, or colons instead.
- Keep internal reasoning extremely concise (under 200 tokens) so you never run out of output tokens.
- Keep each list focused and concise: exactly 2-3 items for ourPromises, 1-2 for theirPromises, 2 for unresolvedQuestions, 2 for advancingTactics, 2 for stallingTacticsToAvoid, 2 for talkingPointsAndStrategy, and 2 for redFlagsAndSensitivities. Keep descriptions to 1 clear sentence.
- In "recommendedApproach", you MUST explicitly reference which specific past tactics led to advanced vs stalled meetings with this contact, synthesizing patterns from past meeting outcomes and Hindsight reflection.
- For each item in ourPromises, theirPromises, unresolvedQuestions, and redFlagsAndSensitivities:
  - If the item is directly derived from a recalled fact from memory above, set "sourceDate" to that fact date (YYYY-MM-DD) and "sourceDocumentId" to that fact DocID.
  - If an item cannot be attributed to a specific recalled fact, set sourceDate to null and sourceDocumentId to null. Do not invent sources.
- Output valid JSON only, adhering strictly to the schema below. Do not wrap with markdown backticks.

{
  "executiveSummary": "2-3 sentences synthesizing the current state of the relationship, past trajectory, and primary objective for this meeting.",
  "relationshipHealth": {
    "status": "critical" | "at_risk" | "healthy" | "expanding",
    "sentimentTrajectory": "Explanation of how tone and sentiment have shifted over the last 3 months.",
    "trustLevel": "high" | "moderate" | "low" | "fragile"
  },
  "commitments": {
    "ourPromises": [
      {
        "promise": "Description of promise",
        "dateMade": "YYYY-MM-DD",
        "status": "kept" | "broken" | "in_progress" | "pending",
        "impact": "Context on whether this caused friction or helped",
        "sourceDate": "YYYY-MM-DD or null",
        "sourceDocumentId": "DocID from matching fact or null"
      }
    ],
    "theirPromises": [
      {
        "promise": "Description of what contact promised",
        "status": "fulfilled" | "pending",
        "sourceDate": "YYYY-MM-DD or null",
        "sourceDocumentId": "DocID from matching fact or null"
      }
    ]
  },
  "unresolvedQuestions": [
    {
      "question": "The specific question or objection",
      "recurrence": "How many times or since when has this been open",
      "urgency": "high" | "medium" | "low",
      "suggestedAnswer": "How the user should address it in this meeting",
      "sourceDate": "YYYY-MM-DD or null",
      "sourceDocumentId": "DocID from matching fact or null"
    }
  ],
  "recommendedApproach": {
    "advancingTactics": [
      "Concrete tactic or behavior that historically advanced meetings with this contact"
    ],
    "stallingTacticsToAvoid": [
      "Concrete tactic, topic, or mistake that historically stalled meetings or lost ground"
    ],
    "strategicSummary": "2-3 sentences synthesizing the recommended tactical approach for this upcoming meeting based on past outcome patterns."
  },
  "recommendedAgenda": [
    {
      "timeframe": "First 5 mins" | "10-20 mins" | "20-35 mins" | "Wrap-up",
      "topic": "Agenda item topic",
      "objective": "What to achieve in this segment"
    }
  ],
  "talkingPointsAndStrategy": [
    "Specific tactical phrase or argument to make during the meeting"
  ],
  "redFlagsAndSensitivities": [
    {
      "text": "Topics, words, or unfulfilled expectations to be extremely careful about",
      "sourceDate": "YYYY-MM-DD or null",
      "sourceDocumentId": "DocID from matching fact or null"
    }
  ]
}`
      : `You are an executive meeting preparation agent operating in without-memory mode.
You have no access to past meeting notes, no historical memory of past interactions, no knowledge of past commitments, and no prior context on this relationship.
Based solely on the contact name, role, company, and provided meeting topic, generate a generic, plausible first-principles meeting preparation outline.

Rules:
- Do not use emojis anywhere in your text.
- Do not use em dashes in your text. Use periods, commas, or colons instead.
- Output valid JSON only, adhering strictly to the schema below without markdown backticks.

{
  "executiveSummary": "Generic summary based only on the person title and company.",
  "relationshipHealth": {
    "status": "unknown",
    "sentimentTrajectory": "No prior sentiment trajectory on record (memory disabled).",
    "trustLevel": "unknown"
  },
  "commitments": {
    "ourPromises": [],
    "theirPromises": []
  },
  "unresolvedQuestions": [],
  "recommendedApproach": {
    "advancingTactics": [
      "Standard collaborative discovery approach (memory disabled)"
    ],
    "stallingTacticsToAvoid": [
      "General avoidance of pushy sales tactics (memory disabled)"
    ],
    "strategicSummary": "No prior meeting outcome patterns on record (memory disabled)."
  },
  "recommendedAgenda": [
    {
      "timeframe": "First 5 mins" | "10-20 mins" | "20-35 mins" | "Wrap-up",
      "topic": "Generic agenda topic",
      "objective": "Generic meeting objective"
    }
  ],
  "talkingPointsAndStrategy": [
    "Standard generic sales or partnership talking point"
  ],
  "redFlagsAndSensitivities": []
}`;

    const userPrompt = `CONTACT PROFILE:
- Name: ${contact.name}
- Role: ${contact.role}
- Company: ${contact.company}
- Email: ${contact.email || 'N/A'}

UPCOMING MEETING DETAILS:
- Agenda / Focus: ${upcomingAgenda || 'General relationship check-in and next steps'}
- Goal: ${meetingGoal || 'Strengthen partnership, align on commitments, resolve open blockers'}

PAST MEETING MEMORIES FROM HINDSIGHT:
${memoriesPromptSection}
${reflectSynthesis ? `\n${insightsProvenance === 'Inferred by Hindsight' ? 'HINDSIGHT REFLECT SYNTHESIS (INFERRED BY HINDSIGHT)' : 'MEMORIES REFLECTION SYNTHESIS (SYNTHESIZED FROM RECALLED MEMORIES)'} (PATTERNS ACROSS MEMORIES - ADVANCED VS STALLED TACTICS):\n${reflectSynthesis.slice(0, 700)}\n` : ''}
Generate the JSON briefing now.`;

    let groqResponse;
    try {
      groqResponse = await chatCompletion({
        model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 3800,
      });
    } catch (groqErr) {
      console.error('Groq LLM error in /api/briefing:', groqErr);
      const rawMsg = (groqErr as Error).message || String(groqErr);
      const isRateLimit = /429|rate_limit|tokens per minute|tpm|rpm/i.test(rawMsg);
      return NextResponse.json(
        {
          error: isRateLimit
            ? 'Groq LLM Rate Limit Exceeded (TPM/RPM limit reached). Please wait 10-15 seconds before retrying, or uncheck "With Memory" to reduce context tokens.'
            : `Groq LLM Service Error: ${rawMsg}`,
          service: 'groq',
          statusCode: isRateLimit ? 429 : 502,
          rawError: rawMsg,
        },
        { status: isRateLimit ? 429 : 502 }
      );
    }

    const parsedBriefing = safeParseJson(groqResponse.content || '{}');

    if (!parsedBriefing.success) {
      console.error('Failed to parse Groq briefing JSON:', groqResponse.content);
      return NextResponse.json(
        {
          error: 'Failed to parse AI briefing JSON response',
          service: 'groq',
          statusCode: 500,
          rawContent: groqResponse.content,
        },
        { status: 500 }
      );
    }

    // Ensure consistent structure, validate and ground provenance for each item
    const briefingData = parsedBriefing.data as Record<string, unknown>;

    // Defensive normalization of keys
    const commitments = ((briefingData.commitments || {}) as Record<string, unknown>);
    if (!commitments.ourPromises && Array.isArray(briefingData.ourPromises)) {
      commitments.ourPromises = briefingData.ourPromises;
    }
    if (!commitments.theirPromises && Array.isArray(briefingData.theirPromises)) {
      commitments.theirPromises = briefingData.theirPromises;
    }
    briefingData.commitments = commitments;

    if (!briefingData.unresolvedQuestions && Array.isArray(briefingData.questions)) {
      briefingData.unresolvedQuestions = briefingData.questions;
    }
    if (!briefingData.redFlagsAndSensitivities && Array.isArray(briefingData.redFlags)) {
      briefingData.redFlagsAndSensitivities = briefingData.redFlags;
    }
    if (!briefingData.redFlagsAndSensitivities && Array.isArray(briefingData.sensitivities)) {
      briefingData.redFlagsAndSensitivities = briefingData.sensitivities;
    }

    const groundItem = (item: Record<string, unknown>, textValue: string) => {
      if (!useMemory || allFacts.length === 0) {
        item.sourceDate = null;
        item.sourceDocumentId = null;
        return;
      }

      // Check if provided sourceDate matches a recalled fact
      const rawDate = typeof item.sourceDate === 'string' ? item.sourceDate.slice(0, 10) : null;
      if (rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
        const matchingFact = allFacts.find((f) => f.occurredStart && f.occurredStart.startsWith(rawDate));
        if (matchingFact) {
          item.sourceDate = rawDate;
          item.sourceDocumentId = (typeof item.sourceDocumentId === 'string' && item.sourceDocumentId) || matchingFact.documentId || null;
          return;
        }
      }

      // Check if documentId matches
      const rawDocId = typeof item.sourceDocumentId === 'string' ? item.sourceDocumentId : null;
      if (rawDocId) {
        const matchingFact = allFacts.find((f) => f.documentId === rawDocId);
        if (matchingFact && matchingFact.occurredStart) {
          item.sourceDate = matchingFact.occurredStart.slice(0, 10);
          item.sourceDocumentId = matchingFact.documentId;
          return;
        }
      }

      // Semantic / keyword grounding against recalled facts
      const targetLower = textValue.toLowerCase();
      let bestMatch: MemoryFact | null = null;
      let highestScore = 0;

      for (const fact of allFacts) {
        if (!fact.occurredStart) continue;
        const factText = fact.text.toLowerCase();
        const words = targetLower.split(/[\s,.;:()"-]+/).filter((w) => w.length >= 4);
        let score = 0;
        for (const w of words) {
          if (factText.includes(w)) {
            score++;
          }
        }
        if (score > highestScore && score >= 2) {
          highestScore = score;
          bestMatch = fact;
        }
      }

      if (bestMatch && bestMatch.occurredStart) {
        item.sourceDate = bestMatch.occurredStart.slice(0, 10);
        item.sourceDocumentId = bestMatch.documentId || null;
      } else {
        // Do not invent sources
        item.sourceDate = null;
        item.sourceDocumentId = null;
      }
    };

    if (!useMemory) {
      const relHealth = (briefingData.relationshipHealth || {}) as Record<string, unknown>;
      briefingData.relationshipHealth = {
        status: relHealth.status || 'unknown',
        sentimentTrajectory: 'No prior sentiment trajectory on record (memory disabled)',
        trustLevel: relHealth.trustLevel || 'unknown',
      };
      briefingData.commitments = { ourPromises: [], theirPromises: [] };
      briefingData.unresolvedQuestions = [];
      briefingData.redFlagsAndSensitivities = [];
      briefingData.recommendedApproach = {
        advancingTactics: ['No past meeting outcome patterns on record (memory disabled)'],
        stallingTacticsToAvoid: ['No past meeting outcome patterns on record (memory disabled)'],
        strategicSummary: 'No prior meeting outcome patterns on record (memory disabled)',
      };
    } else {
      // Ground provenance for With Memory mode
      const commitments = (briefingData.commitments || {}) as Record<string, unknown>;
      if (Array.isArray(commitments.ourPromises)) {
        for (const p of commitments.ourPromises) {
          if (p && typeof p === 'object') {
            const pObj = p as Record<string, unknown>;
            groundItem(pObj, `${pObj.promise || ''} ${pObj.impact || ''}`);
          }
        }
      }
      if (Array.isArray(commitments.theirPromises)) {
        for (const p of commitments.theirPromises) {
          if (p && typeof p === 'object') {
            const pObj = p as Record<string, unknown>;
            groundItem(pObj, `${pObj.promise || ''}`);
          }
        }
      }
      if (Array.isArray(briefingData.unresolvedQuestions)) {
        for (const q of briefingData.unresolvedQuestions) {
          if (q && typeof q === 'object') {
            const qObj = q as Record<string, unknown>;
            groundItem(qObj, `${qObj.question || ''} ${qObj.suggestedAnswer || ''}`);
          }
        }
      }
      if (Array.isArray(briefingData.redFlagsAndSensitivities)) {
        briefingData.redFlagsAndSensitivities = briefingData.redFlagsAndSensitivities.map((rf) => {
          const rfObj: Record<string, unknown> =
            typeof rf === 'string'
              ? { text: rf, sourceDate: null, sourceDocumentId: null }
              : (rf as Record<string, unknown>);
          groundItem(rfObj, String(rfObj.text || ''));
          return rfObj;
        });
      }

      // Normalize recommendedApproach
      const rec = (briefingData.recommendedApproach || {}) as Record<string, unknown>;
      briefingData.recommendedApproach = {
        advancingTactics:
          Array.isArray(rec.advancingTactics) && rec.advancingTactics.length > 0
            ? rec.advancingTactics
            : [
                'Proactive technical discovery and transparent progress on performance benchmarks',
                'Demonstrating compliance alignment and testing with real-world payloads',
              ],
        stallingTacticsToAvoid:
          Array.isArray(rec.stallingTacticsToAvoid) && rec.stallingTacticsToAvoid.length > 0
            ? rec.stallingTacticsToAvoid
            : (Array.isArray(rec.pitfallsToAvoid) && rec.pitfallsToAvoid.length > 0
                ? rec.pitfallsToAvoid
                : [
                    'Missing committed deliverable dates without early proactive notification',
                    'Allowing contractual or liability redlines to linger unresolved',
                  ]),
        strategicSummary:
          typeof rec.strategicSummary === 'string' && rec.strategicSummary.trim()
            ? rec.strategicSummary.trim()
            : (typeof rec.strategicAdvice === 'string' && rec.strategicAdvice.trim()
                ? rec.strategicAdvice.trim()
                : 'Prioritize concrete delivery dates and direct technical alignment to rebuild confidence.'),
      };
    }

    // 4. Generate structured Learned Insights scoped to contact
    let learnedInsights: LearnedInsights | undefined = undefined;

    if (useMemory && reflectSynthesis) {
      console.log('[Briefing] Generating learned insights from reflectSynthesis (length:', reflectSynthesis.length, ')...');
      try {
        const contactMeetings = getMeetingsByContact(contact.id);
        const evidencePool = reflectEvidence.length > 0 ? reflectEvidence : allFacts;
        console.log('[Briefing] Evidence pool length:', evidencePool.length, 'Contact meetings:', contactMeetings.length);

        const parsePrompt = `You are an executive relationship intelligence parser.
Given this strategic synthesis about ${contact.name} (${contact.company}):

SYNTHESIS (${insightsProvenance}):
${reflectSynthesis}

SUPPORTING RECALLED EVIDENCE:
${evidencePool.slice(0, 15).map((m: any) => `- [Date: ${m.occurred_start?.slice(0, 10) || m.metadata?.date || m.mentioned_at?.slice(0, 10) || 'Date unknown'}] ${m.text}`).join('\n')}

PAST MEETINGS IN CRM:
${contactMeetings.map((m) => `- Date: ${m.date} | Summary: ${m.summary.slice(0, 80)}`).join('\n')}

Extract clean JSON strictly matching:
{
  "trustTurningPoints": [
    {
      "insight": "<concise turning point description>",
      "sourceDate": "<YYYY-MM-DD of the supporting meeting if identified from memories or CRM, otherwise null>",
      "meetingTitle": "<short title/summary of supporting meeting if known, otherwise null>"
    }
  ],
  "tactics": {
    "advancing": [
      {
        "tactic": "<concise tactic that advanced meetings>",
        "sourceDate": "<YYYY-MM-DD or null>",
        "meetingTitle": "<short title/summary or null>"
      }
    ],
    "stalling": [
      {
        "tactic": "<concise tactic or pitfall that stalled meetings>",
        "sourceDate": "<YYYY-MM-DD or null>",
        "meetingTitle": "<short title/summary or null>"
      }
    ]
  },
  "communicationPreferences": [
    {
      "preference": "<concise communication preference, e.g. Direct and purposeful, Demands certified technical proof>",
      "sourceDate": "<YYYY-MM-DD or null>",
      "meetingTitle": "<short title/summary or null>"
    }
  ]
}

Strict rules:
- Only output valid JSON matching the schema.
- For each item, link to the closest supporting meeting date in YYYY-MM-DD format if mentioned or implied in the evidence.
- If a date cannot be determined, set sourceDate to null.`;

        const parseRes = await chatCompletion({
          model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
          messages: [
            { role: 'system', content: 'You are an executive intelligence extractor. Output JSON only.' },
            { role: 'user', content: parsePrompt },
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' },
        });

        const parsed = safeParseJson(parseRes.content || '{}');
        const payload = (parsed.data && typeof parsed.data === 'object') ? parsed.data : parsed;
        console.log('[Briefing] parsed result keys:', Object.keys(parsed), 'payload keys:', Object.keys(payload));

        if (payload.trustTurningPoints || payload.tactics || payload.communicationPreferences) {
          learnedInsights = {
            provenance: insightsProvenance || 'Synthesized from recalled memories',
            trustTurningPoints: Array.isArray(payload.trustTurningPoints) ? payload.trustTurningPoints : [],
            tactics: {
              advancing: Array.isArray(payload.tactics?.advancing) ? payload.tactics.advancing : [],
              stalling: Array.isArray(payload.tactics?.stalling) ? payload.tactics.stalling : [],
            },
            communicationPreferences: Array.isArray(payload.communicationPreferences) ? payload.communicationPreferences : [],
            rawSynthesisText: reflectSynthesis,
            basedOnCount: evidencePool.length,
          };
          briefingData.learnedInsights = learnedInsights;
          console.log('[Briefing] Successfully attached learnedInsights:', {
            provenance: learnedInsights.provenance,
            trustTurningPoints: learnedInsights.trustTurningPoints.length,
            advancingTactics: learnedInsights.tactics.advancing.length,
            stallingTactics: learnedInsights.tactics.stalling.length,
            communicationPreferences: learnedInsights.communicationPreferences.length,
          });
        }
      } catch (err) {
        console.warn('Error formatting learned insights:', err);
      }
    }

    return NextResponse.json({
      contact,
      briefing: briefingData,
      learnedInsights: learnedInsights || undefined,
      relevantMemories: allFacts,
      reflectSynthesis: reflectSynthesis || undefined,
      insightsProvenance: insightsProvenance || undefined,
      useMemory,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Unexpected error generating briefing in /api/briefing:', error);
    const rawMsg = (error as Error).message || 'Failed to generate briefing';
    const isHindsight = /hindsight|vectorize|bank/i.test(rawMsg);
    const isGroq = /groq|openai|rate_limit|429/i.test(rawMsg);
    return NextResponse.json(
      {
        error: isHindsight
          ? `Hindsight Memory Bank Error: ${rawMsg}`
          : isGroq
          ? `Groq LLM Error: ${rawMsg}`
          : `Briefing Generation Error: ${rawMsg}`,
        service: isHindsight ? 'hindsight' : isGroq ? 'groq' : 'unknown',
        statusCode: 500,
        rawError: rawMsg,
      },
      { status: 500 }
    );
  }
}
