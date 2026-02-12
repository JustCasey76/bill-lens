/**
 * Reset Firestore collections (bills, claims, bill versions, etc.).
 * Run with: npx tsx scripts/reset-db.ts
 * Requires FIREBASE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS.
 */
import 'dotenv/config';
import { getDb, COLLECTIONS } from '@/lib/firestore';

const BATCH_SIZE = 500;

async function deleteCollection(name: string) {
    const db = getDb();
    const col = db.collection(name);
    let deleted = 0;
    let snap = await col.limit(BATCH_SIZE).get();
    while (!snap.empty) {
        const batch = db.batch();
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        deleted += snap.size;
        if (snap.size < BATCH_SIZE) break;
        snap = await col.limit(BATCH_SIZE).get();
    }
    return deleted;
}

async function main() {
    console.log('Clearing Firestore collections...');
    const collections = [
        COLLECTIONS.jobLogs,
        COLLECTIONS.claims,
        COLLECTIONS.billVersions,
        COLLECTIONS.billActions,
        COLLECTIONS.bills,
    ];
    for (const name of collections) {
        const n = await deleteCollection(name);
        console.log(`  ${name}: ${n} deleted`);
    }
    console.log('Database cleared!');
}

main().catch((e) => console.error(e));
