import Groq from 'groq-sdk';
import type {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletion,
} from 'groq-sdk/resources/chat/completions';

export const DEFAULT_GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

/**
 * Returns a configured Groq client with current process.env values
 */
export function getGroqClient(): Groq {
  return new Groq({
    apiKey: process.env.GROQ_API_KEY || '',
  });
}

/**
 * Exported client reference
 */
export const groq = getGroqClient();

export interface SafeToolCall {
  id: string;
  name: string;
  rawArguments: string;
  parsedArguments: Record<string, unknown> | null;
  parseError?: string;
}

export interface GroqCompletionResult {
  content: string | null;
  toolCalls: SafeToolCall[];
  rawResponse: ChatCompletion;
  model: string;
  usage?: ChatCompletion['usage'];
}

export interface ChatOptions {
  model?: string;
  messages: ChatCompletionMessageParam[];
  tools?: ChatCompletionTool[];
  tool_choice?: ChatCompletionCreateParamsNonStreaming['tool_choice'];
  temperature?: number;
  max_tokens?: number;
  response_format?: ChatCompletionCreateParamsNonStreaming['response_format'];
  maxRetries?: number;
  retryDelayMs?: number;
}

/**
 * Helper to safely parse JSON arguments produced by LLMs, handling markdown wrapping or trailing commas
 */
export function safeParseJson<T = Record<string, unknown>>(
  input: string
): { success: true; data: T } | { success: false; error: string } {
  try {
    const trimmed = input.trim();

    // 1. Try direct parse
    try {
      return { success: true, data: JSON.parse(trimmed) as T };
    } catch {
      // continue
    }

    // 2. Try markdown fence extraction ```json ... ```
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenceMatch && fenceMatch[1]) {
      try {
        return { success: true, data: JSON.parse(fenceMatch[1].trim()) as T };
      } catch {
        // continue
      }
    }

    // 3. Try finding outermost { ... }
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const jsonCandidate = trimmed.slice(firstBrace, lastBrace + 1);
      try {
        return { success: true, data: JSON.parse(jsonCandidate) as T };
      } catch {
        // Attempt sanitizing common LLM syntax anomalies
        let sanitized = jsonCandidate;
        // Fix mismatched array closure before another property (e.g. [ ... }\n , "property")
        sanitized = sanitized.replace(/(\[[^\]]*?)\s*\}\s*,\s*"/g, '$1],\n  "');
        // Trailing commas before closing braces/brackets
        sanitized = sanitized.replace(/,\s*([\]}])/g, '$1');
        return { success: true, data: JSON.parse(sanitized) as T };
      }
    }

    return { success: false, error: 'No JSON object found in input' };
  } catch (err: unknown) {
    const e = err as Error;
    return { success: false, error: e.message || 'Invalid JSON' };
  }
}

/**
 * Executes an async operation with exponential backoff for transient failures (rate limits, 5xx server errors, network hiccups)
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error: unknown) {
      attempt++;
      const err = error as { status?: number; code?: string; message?: string };
      const isRetryable =
        err?.status === 429 || // Rate limit
        (err?.status && err.status >= 500) || // Server error
        err?.code === 'ECONNRESET' ||
        err?.code === 'ETIMEDOUT' ||
        err?.message?.includes('fetch failed');

      if (attempt > maxRetries || !isRetryable) {
        throw error;
      }

      const backoff = delayMs * Math.pow(2, attempt - 1) + Math.random() * 200;
      console.warn(
        `[Groq API warning] Transient error (${err?.status || err?.code || 'network'}). Retrying attempt ${attempt}/${maxRetries} after ${Math.round(backoff)}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }
}

/**
 * Main chat completion wrapper for Groq with automatic retry and robust tool-call parsing
 */
export async function chatCompletion(options: ChatOptions): Promise<GroqCompletionResult> {
  const client = getGroqClient();
  const model = options.model || process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
  const maxRetries = options.maxRetries ?? 3;
  const retryDelayMs = options.retryDelayMs ?? 1000;

  const response = await withRetry(
    async () => {
      return await client.chat.completions.create({
        model,
        messages: options.messages,
        tools: options.tools,
        tool_choice: options.tool_choice,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.max_tokens,
        response_format: options.response_format,
      });
    },
    maxRetries,
    retryDelayMs
  );

  const choice = response.choices?.[0];
  const message = choice?.message;
  const content = message?.content ?? null;

  // Process and validate tool calls
  const toolCalls: SafeToolCall[] = [];
  if (message?.tool_calls && message.tool_calls.length > 0) {
    for (const call of message.tool_calls) {
      if (call.type === 'function') {
        const rawArgs = call.function.arguments || '{}';
        const parseResult = safeParseJson(rawArgs);

        toolCalls.push({
          id: call.id,
          name: call.function.name,
          rawArguments: rawArgs,
          parsedArguments: parseResult.success ? parseResult.data : null,
          parseError: parseResult.success ? undefined : parseResult.error,
        });
      }
    }
  }

  return {
    content,
    toolCalls,
    rawResponse: response,
    model: response.model,
    usage: response.usage,
  };
}

/**
 * Agentic execution wrapper that retries conversation turns if the model produces malformed tool arguments
 */
export async function chatWithToolCallingRecovery(
  initialMessages: ChatCompletionMessageParam[],
  tools: ChatCompletionTool[],
  options?: Omit<ChatOptions, 'messages' | 'tools'> & { maxToolFixRetries?: number }
): Promise<GroqCompletionResult> {
  const maxToolFixRetries = options?.maxToolFixRetries ?? 2;
  const currentMessages: ChatCompletionMessageParam[] = [...initialMessages];

  for (let attempt = 0; attempt <= maxToolFixRetries; attempt++) {
    const result = await chatCompletion({
      ...options,
      messages: currentMessages,
      tools,
    });

    const failedCall = result.toolCalls.find((tc) => tc.parsedArguments === null);

    // If there were no parsing failures or no tool calls, return successfully
    if (!failedCall) {
      return result;
    }

    if (attempt === maxToolFixRetries) {
      console.error(
        `[Groq Function Calling Error] Tool "${failedCall.name}" arguments could not be parsed after ${maxToolFixRetries} recovery attempts. Arguments:`,
        failedCall.rawArguments
      );
      return result; // return result with parsedArguments: null and parseError
    }

    console.warn(
      `[Groq Function Calling Recovery] Failed to parse JSON arguments for tool "${failedCall.name}": ${failedCall.parseError}. Requesting correction from model...`
    );

    // Append assistant's problematic message and user corrective prompt
    currentMessages.push(result.rawResponse.choices[0].message);
    currentMessages.push({
      role: 'user',
      content: `The arguments for tool "${failedCall.name}" were invalid JSON (${failedCall.parseError}). Please call the function again with valid JSON arguments adhering to the schema.`,
    });
  }

  throw new Error('Failed to complete function call after recovery attempts.');
}
