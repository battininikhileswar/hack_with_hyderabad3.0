import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getContactById } from '@/lib/store';
import { LearningCurveData } from '@/types';

const CACHE_FILE = path.join(process.cwd(), 'data', 'learning-curve-cache.json');

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const contactId = searchParams.get('contactId') || 'contact-elena-rostova';

    const contact = getContactById(contactId);
    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    // Check pre-generated instant cache
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
      const cacheData = JSON.parse(raw) as LearningCurveData;
      if (cacheData.contact?.id === contactId) {
        return NextResponse.json({
          ...cacheData,
          cached: true,
        });
      }
    }

    return NextResponse.json(
      { error: 'No learning curve data found for this contact' },
      { status: 404 }
    );
  } catch (error) {
    console.error('Error fetching learning curve data:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve learning curve data' },
      { status: 500 }
    );
  }
}
