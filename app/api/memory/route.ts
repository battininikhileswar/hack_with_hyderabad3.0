import { NextResponse } from 'next/server';
import { recall } from '@/lib/hindsight';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { query, contactId, budget } = body;

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const result = await recall(query, {
      contactId: contactId || undefined,
      budget: budget || 'mid',
      maxTokens: 2500,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in /api/memory:', error);
    const rawMsg = (error as Error).message || 'Recall failed';
    return NextResponse.json(
      {
        error: `Hindsight Memory Bank Error: ${rawMsg}`,
        service: 'hindsight',
        rawError: rawMsg,
      },
      { status: 500 }
    );
  }
}
