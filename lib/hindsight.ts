import { HindsightClient, recallResponseToPromptString } from '@vectorize-io/hindsight-client';
import { MemoryMetadata, RecallFilters, RecallResult, MemoryFact } from '@/types';

/**
 * Returns a configured HindsightClient with current process.env values
 */
export function getHindsightClient(): HindsightClient {
  const baseUrl = process.env.HINDSIGHT_ENDPOINT || 'https://api.hindsight.vectorize.io';
  const apiKey = process.env.HINDSIGHT_API_KEY || '';
  return new HindsightClient({
    baseUrl,
    apiKey,
  });
}

/**
 * Exported client reference
 */
export const hindsightClient = getHindsightClient();

/**
 * Helper to convert arbitrary metadata into Record<string, string> expected by Hindsight SDK
 */
function sanitizeMetadata(raw?: MemoryMetadata): Record<string, string> | undefined {
  if (!raw) return undefined;
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined || value === null) continue;
    if (key === 'tags' || key === 'bankId' || key === 'documentId') continue;
    sanitized[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }
  return sanitized;
}

/**
 * Retains memory content into Hindsight with contextual metadata and tags
 *
 * @param memoryContent - The text/content to store in the agent memory
 * @param metadata - Contextual metadata such as contactId, date, tags, and custom fields
 */
export async function retain(
  memoryContent: string,
  metadata?: MemoryMetadata
) {
  const client = getHindsightClient();
  const bankId = metadata?.bankId || process.env.HINDSIGHT_BANK_ID || 'meeting-prep-agent';

  // Build tags for granular memory retrieval
  const tags: string[] = [...(metadata?.tags || [])];
  if (metadata?.contactId) {
    tags.push(`contact:${metadata.contactId}`);
    tags.push(metadata.contactId);
  }

  const timestamp = metadata?.date ? new Date(metadata.date) : new Date();
  const context = metadata?.context || (metadata?.contactName ? `Meeting with ${metadata.contactName}` : undefined);
  const stringMetadata = sanitizeMetadata(metadata);
  const documentId = typeof metadata?.documentId === 'string' ? metadata.documentId : undefined;

  try {
    const response = await client.retain(bankId, memoryContent, {
      timestamp: isNaN(timestamp.getTime()) ? undefined : timestamp,
      context,
      documentId,
      metadata: stringMetadata,
      tags: tags.length > 0 ? Array.from(new Set(tags)) : undefined,
    });

    return {
      success: true,
      bankId,
      documentId,
      response,
    };
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`[Hindsight retain error in bank "${bankId}"]:`, err?.message || error);
    throw new Error(`Failed to retain memory in Hindsight: ${err?.message || 'Unknown error'}`);
  }
}

/**
 * Recalls relevant memories from Hindsight based on a query and optional filters
 *
 * @param query - The semantic query (e.g. "What did we promise John last month?")
 * @param filters - Optional filters such as contactId, budget, tags, and temporal window
 */
export async function recall(
  query: string,
  filters?: RecallFilters
): Promise<RecallResult> {
  const client = getHindsightClient();
  const bankId = filters?.bankId || process.env.HINDSIGHT_BANK_ID || 'meeting-prep-agent';

  // Build tags filter
  const tags: string[] = [...(filters?.tags || [])];
  if (filters?.contactId) {
    tags.push(`contact:${filters.contactId}`);
  }

  const temporalWindow =
    filters?.temporalWindow?.start && filters?.temporalWindow?.end
      ? {
          start: filters.temporalWindow.start,
          end: filters.temporalWindow.end,
        }
      : undefined;

  try {
    const response = await client.recall(bankId, query, {
      budget: filters?.budget || 'mid',
      maxTokens: filters?.maxTokens,
      types: filters?.types,
      preferObservations: filters?.preferObservations,
      tags: tags.length > 0 ? tags : undefined,
      temporalWindow,
    });

    // Format facts into clean structured objects
    const chunksMap = (response as { chunks?: Record<string, { text?: string }> }).chunks || {};
    const rawResults = (response as { results?: Array<{
      text: string;
      context?: string;
      occurred_start?: string;
      occurred_end?: string;
      mentioned_at?: string;
      chunk_id?: string;
      document_id?: string;
      id?: string;
    }> }).results || [];

    const facts: MemoryFact[] = rawResults.map((result) => ({
      id: result.id,
      text: result.text,
      context: result.context,
      occurredStart: result.occurred_start,
      occurredEnd: result.occurred_end,
      mentionedAt: result.mentioned_at,
      sourceChunk: result.chunk_id && chunksMap[result.chunk_id] ? chunksMap[result.chunk_id].text : undefined,
      documentId: result.document_id,
    }));

    // Format into prompt-friendly string using Hindsight's native formatter
    let rawSummaryPrompt = '';
    try {
      rawSummaryPrompt = recallResponseToPromptString(response);
    } catch {
      rawSummaryPrompt = facts.map((f) => `- ${f.text}${f.context ? ` (${f.context})` : ''}`).join('\n');
    }

    return {
      facts,
      rawSummaryPrompt,
      entities: (response as { entities?: Record<string, unknown> }).entities,
      rawResponse: response,
    };
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`[Hindsight recall error in bank "${bankId}"]:`, err?.message || error);
    throw new Error(`Failed to recall memories from Hindsight: ${err?.message || 'Unknown error'}`);
  }
}

/**
 * Deletes a document by ID from Hindsight (for cleanup / testing)
 */
export async function deleteDocument(bankId: string, documentId: string) {
  const client = getHindsightClient();
  return await client.deleteDocument(bankId, documentId);
}

export interface ReflectOptions {
  bankId?: string;
  contactId?: string;
  context?: string;
  budget?: 'low' | 'mid' | 'high';
  tags?: string[];
}

export interface ReflectResult {
  text: string;
  rawResponse?: unknown;
}

/**
 * Reflects and synthesizes patterns across memories using Hindsight's agentic reflect operation
 */
export async function reflect(
  query: string,
  options?: ReflectOptions
): Promise<ReflectResult> {
  const client = getHindsightClient();
  const bankId = options?.bankId || process.env.HINDSIGHT_BANK_ID || 'meeting-prep-agent';
  const tags: string[] = [...(options?.tags || [])];
  if (options?.contactId) {
    tags.push(`contact:${options.contactId}`);
  }

  try {
    const response = await client.reflect(bankId, query, {
      budget: options?.budget || 'low',
      context: options?.context,
      tags: tags.length > 0 ? tags : undefined,
    });
    return {
      text: response.text || '',
      rawResponse: response,
    };
  } catch (error: unknown) {
    const err = error as Error;
    console.warn(`[Hindsight reflect warning in bank "${bankId}"]:`, err?.message || error);
    return {
      text: '',
      rawResponse: null,
    };
  }
}

