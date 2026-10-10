import { getHindsightClient } from '../lib/hindsight';
import fs from 'fs';
import path from 'path';

// Parse .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      process.env[key] = val;
    }
  }
}

async function main() {
  const client = getHindsightClient();
  const bankId = process.env.HINDSIGHT_BANK_ID || 'meeting-prep-agent';
  const contactId = 'contact-elena-rostova';
  const contactName = 'Elena Rostova';

  console.log(`=== Probing Hindsight SDK reflect() ===`);
  console.log(`Endpoint: ${process.env.HINDSIGHT_ENDPOINT}`);
  console.log(`API Key: ${process.env.HINDSIGHT_API_KEY ? 'Present (length: ' + process.env.HINDSIGHT_API_KEY.length + ')' : 'MISSING'}`);
  console.log(`Bank ID: ${bankId}`);
  console.log(`Contact: ${contactName} (${contactId})`);

  const query = `Analyze all past meetings and interactions with ${contactName}. What were the key trust turning points, which specific tactics advanced versus stalled meetings, and what are ${contactName}'s communication preferences?`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    console.log(`\n--- Attempt ${attempt} ---`);
    try {
      const startTime = Date.now();
      const rawResponse = await client.reflect(bankId, query, {
        budget: 'low',
        tags: [`contact:${contactId}`],
        includeFacts: true,
      });
      const durationMs = Date.now() - startTime;
      console.log(`Duration: ${durationMs}ms`);
      console.log(`Raw Response Type: ${typeof rawResponse}`);
      console.log(`Raw Response Keys:`, Object.keys(rawResponse || {}));
      console.log(`Raw Response JSON:\n`, JSON.stringify(rawResponse, null, 2));
      return;
    } catch (err: any) {
      console.error(`Attempt ${attempt} Error:`, err?.message || err);
      if (err?.name) console.error(`Error name:`, err.name);
      if (err?.stack) console.error(`Stack trace:\n`, err.stack);
    }
  }
}

main();
