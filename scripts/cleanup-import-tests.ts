import readline from 'readline';
import { loadEnvConfig } from '@next/env';
import { getHindsightClient } from '../lib/hindsight';
import { getAppData, saveAppData } from '../lib/store';

// Load environment variables from .env.local
loadEnvConfig(process.cwd());

async function main() {
  const bankId = process.env.HINDSIGHT_BANK_ID || 'meeting-prep-agent';
  const client = getHindsightClient();

  console.log('====================================================');
  console.log('CLEANUP IMPORTED TEST MEETINGS');
  console.log('====================================================');
  console.log(`Hindsight Bank ID: "${bankId}"`);

  // 1. Find documents and memories tagged with type:imported_meeting
  console.log('\nScanning Hindsight for documents and memories with tag "type:imported_meeting"...');
  
  let hindsightDocs: Array<{ id: string; tags?: string[]; created_at?: string }> = [];
  try {
    const docsRes = await client.listDocuments(bankId);
    hindsightDocs = (docsRes.items || []).filter(
      (d) =>
        (d.tags && d.tags.includes('type:imported_meeting')) ||
        (d.tags && d.tags.includes('type:promise')) ||
        (typeof d.id === 'string' && d.id.startsWith('import-'))
    );
  } catch (err: any) {
    console.warn('Warning querying Hindsight documents:', err.message);
  }

  let hindsightMemories: Array<{ id: string; text?: string; document_id?: string | null; tags?: string[] }> = [];
  try {
    const memRes = await client.listMemories(bankId, { limit: 100 });
    hindsightMemories = (memRes.items || []).filter(
      (m) =>
        (m.tags && m.tags.includes('type:imported_meeting')) ||
        (m.document_id && m.document_id.startsWith('import-'))
    );
  } catch (err: any) {
    console.warn('Warning querying Hindsight memories:', err.message);
  }

  // 2. Find local store meetings with import- prefix
  const appData = getAppData();
  const localImportMeetings = appData.meetings.filter(
    (m) => m.id && (m.id.startsWith('import-') || (m.rawNotes && m.rawNotes.includes('Elena Rostova (VP of Engineering')))
  );

  console.log('\n--- FOUND IN HINDSIGHT ---');
  console.log(`Documents (${hindsightDocs.length}):`);
  hindsightDocs.forEach((d) => console.log(`  - Doc ID: ${d.id} | Created: ${d.created_at}`));

  console.log(`\nMemories (${hindsightMemories.length}):`);
  hindsightMemories.forEach((m) =>
    console.log(`  - Memory ID: ${m.id} | Doc: ${m.document_id || 'none'} | "${(m.text || '').slice(0, 60)}..."`)
  );

  console.log('\n--- FOUND IN LOCAL STORE ---');
  console.log(`Meetings (${localImportMeetings.length}):`);
  localImportMeetings.forEach((m) =>
    console.log(`  - Note ID: ${m.id} | Date: ${m.date} | Contact: ${m.contactId} | "${m.summary.slice(0, 60)}..."`)
  );

  if (hindsightDocs.length === 0 && hindsightMemories.length === 0 && localImportMeetings.length === 0) {
    console.log('\nNo imported test documents found. Nothing to delete.');
    return;
  }

  // Check for auto-confirmation via CLI flag or prompt
  const hasConfirmFlag = process.argv.includes('--yes') || process.argv.includes('-y');
  let confirmed = hasConfirmFlag;

  if (!confirmed) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    confirmed = await new Promise<boolean>((resolve) => {
      rl.question(
        '\nAre you sure you want to DELETE all listed imported documents from Hindsight and the local store? (type "yes" to confirm): ',
        (answer) => {
          rl.close();
          resolve(answer.trim().toLowerCase() === 'yes');
        }
      );
    });
  }

  if (!confirmed) {
    console.log('\nCleanup cancelled. No documents or records were deleted.');
    return;
  }

  console.log('\nConfirmed! Proceeding with deletion...');

  // 1. Delete documents from Hindsight
  let deletedDocs = 0;
  for (const d of hindsightDocs) {
    try {
      console.log(`Deleting Hindsight document "${d.id}"...`);
      await client.deleteDocument(bankId, d.id);
      deletedDocs++;
    } catch (err: any) {
      console.warn(`Failed to delete Hindsight document "${d.id}":`, err.message);
    }
  }

  // Also check if any promise docIds exist that weren't caught
  for (const m of hindsightMemories) {
    if (m.document_id && !hindsightDocs.some((d) => d.id === m.document_id)) {
      try {
        await client.deleteDocument(bankId, m.document_id);
      } catch {
        // ignore
      }
    }
  }

  // 2. Delete from local store
  if (localImportMeetings.length > 0) {
    const importIds = new Set(localImportMeetings.map((m) => m.id));
    appData.meetings = appData.meetings.filter((m) => !importIds.has(m.id));
    saveAppData(appData);
    console.log(`Deleted ${localImportMeetings.length} imported meeting notes from local store.`);
  }

  console.log(`\nCleanup complete! Deleted ${deletedDocs} Hindsight documents and ${localImportMeetings.length} local meeting notes.`);
}

main().catch((err) => {
  console.error('Fatal error in cleanup script:', err);
  process.exit(1);
});
