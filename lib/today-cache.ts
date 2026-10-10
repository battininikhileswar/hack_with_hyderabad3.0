import fs from 'fs';
import path from 'path';
import { getContactById } from '@/lib/store';
import { recall } from '@/lib/hindsight';
import { chatCompletion, safeParseJson } from '@/lib/groq';

const CACHE_FILE = path.join(process.cwd(), 'data', 'today-briefings-cache.json');

export interface CachedTodayBriefing {
  contactId: string;
  contactName: string;
  company: string;
  relationshipStatus: 'at_risk' | 'healthy' | 'expanding' | 'fragile' | 'neutral' | string;
  topRisk: string;
  executiveSummary: string;
  sentimentTrajectory?: string;
  trustLevel?: string;
  keyTactics?: string[];
  cachedAt: string;
}

export function getAllCachedBriefings(): Record<string, CachedTodayBriefing> {
  try {
    if (!fs.existsSync(CACHE_FILE)) {
      return {};
    }
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading today briefings cache:', err);
    return {};
  }
}

export function getCachedBriefing(contactId: string): CachedTodayBriefing | null {
  const cache = getAllCachedBriefings();
  return cache[contactId] || null;
}

export function setCachedBriefing(contactId: string, data: CachedTodayBriefing): void {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const cache = getAllCachedBriefings();
    cache[contactId] = data;
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing today briefings cache:', err);
  }
}

/**
 * Retrieves today's briefing card summary for a contact.
 * Returns from cache if available, or generates from Hindsight memory and stores into cache.
 */
export async function getOrGenerateTodayBriefing(
  contactId: string,
  forceRefresh = false
): Promise<CachedTodayBriefing> {
  const cached = getCachedBriefing(contactId);
  if (cached && !forceRefresh) {
    return cached;
  }

  const contact = getContactById(contactId);
  if (!contact) {
    throw new Error(`Contact with ID ${contactId} not found.`);
  }

  // 1. Recall memory facts for this contact
  let recalledFacts: string[] = [];
  try {
    const recallRes = await recall(
      `What are the most critical risks, broken promises, objections, and relationship health status for ${contact.name}?`,
      { contactId: contact.id, budget: 'mid', maxTokens: 3000 }
    );
    if (recallRes && recallRes.facts) {
      recalledFacts = recallRes.facts.map((f) => f.text);
    }
  } catch (err) {
    console.warn(`[today-cache] Memory recall warning for ${contact.name}:`, err);
  }

  // Fallback to defaults if memory is cold or unavailable
  if (recalledFacts.length === 0) {
    const fallback: CachedTodayBriefing = {
      contactId: contact.id,
      contactName: contact.name,
      company: contact.company,
      relationshipStatus: 'neutral',
      topRisk: 'No historical risk data recorded in memory yet.',
      executiveSummary: `Introductory upcoming discussion with ${contact.name} at ${contact.company}.`,
      sentimentTrajectory: 'Neutral',
      trustLevel: 'baseline',
      cachedAt: new Date().toISOString(),
    };
    setCachedBriefing(contact.id, fallback);
    return fallback;
  }

  // 2. Synthesize relationship status and top risk from memory using LLM
  try {
    const prompt = `You are an executive relationship analyst. Analyze the following past memory facts for ${contact.name} (${contact.company}, ${contact.role}):

MEMORY FACTS:
${recalledFacts.slice(0, 12).map((f) => `- ${f}`).join('\n')}

Extract the following JSON strictly:
{
  "relationshipStatus": "<one of: 'at_risk', 'healthy', 'fragile', 'expanding', 'neutral'>",
  "topRisk": "<1 concise, punchy sentence identifying the number one highest risk or sensitivity from memory>",
  "executiveSummary": "<2 concise sentences summarizing where the relationship currently stands>",
  "sentimentTrajectory": "<e.g., 'Volatile', 'Recovering', 'Positive', 'Declining'>",
  "trustLevel": "<e.g., 'fragile', 'high', 'moderate', 'guarded'>"
}`;

    const llmRes = await chatCompletion({
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: 'You are an executive relationship memory analyst. Output valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const parsed = safeParseJson(llmRes.content || '{}');
    const briefing: CachedTodayBriefing = {
      contactId: contact.id,
      contactName: contact.name,
      company: contact.company,
      relationshipStatus: parsed.relationshipStatus || 'neutral',
      topRisk: parsed.topRisk || 'No critical risks flagged in memory.',
      executiveSummary: parsed.executiveSummary || `Active account engagement with ${contact.name}.`,
      sentimentTrajectory: parsed.sentimentTrajectory || 'Stable',
      trustLevel: parsed.trustLevel || 'moderate',
      cachedAt: new Date().toISOString(),
    };

    setCachedBriefing(contact.id, briefing);
    return briefing;
  } catch (llmErr) {
    console.error(`[today-cache] Error generating briefing with LLM:`, llmErr);
    // Provide safe deterministic fallback from recalled facts
    const topFact = recalledFacts[0] || 'Ongoing enterprise discussions';
    const fallback: CachedTodayBriefing = {
      contactId: contact.id,
      contactName: contact.name,
      company: contact.company,
      relationshipStatus: 'at_risk',
      topRisk: topFact.slice(0, 160),
      executiveSummary: `Relationship with ${contact.name} at ${contact.company}.`,
      cachedAt: new Date().toISOString(),
    };
    setCachedBriefing(contact.id, fallback);
    return fallback;
  }
}
