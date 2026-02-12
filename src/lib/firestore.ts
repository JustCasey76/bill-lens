import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import {
    getFirestore,
    type Firestore,
    FieldValue,
    Timestamp,
    Filter,
} from 'firebase-admin/firestore';

// ── Singleton Admin SDK Initialization ─────────────────────
// Firebase Admin SDK is used server-side (API routes, Cloud Functions).
// The client-side Firebase SDK (firebase.ts) is separate.

let adminApp: App;
let db: Firestore;

function getAdminApp(): App {
    if (adminApp) return adminApp;

    const existing = getApps();
    if (existing.length > 0) {
        adminApp = existing[0];
        return adminApp;
    }

    // In Firebase Cloud Functions the environment is pre-configured.
    // For local dev, use GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_KEY.
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (serviceAccountKey) {
        const parsed = JSON.parse(serviceAccountKey);
        adminApp = initializeApp({
            credential: cert(parsed),
            projectId: parsed.project_id,
        });
    } else {
        // Runs inside Cloud Functions or with GOOGLE_APPLICATION_CREDENTIALS set
        adminApp = initializeApp();
    }

    return adminApp;
}

export function getDb(): Firestore {
    if (db) return db;
    db = getFirestore(getAdminApp());
    return db;
}

export { FieldValue, Timestamp, Filter };

// ── Collection Names ───────────────────────────────────────

export const COLLECTIONS = {
    users: 'users',
    accounts: 'accounts',
    sessions: 'sessions',
    verificationTokens: 'verificationTokens',
    bills: 'bills',
    billVersions: 'billVersions',
    billActions: 'billActions',
    claims: 'claims',
    epsteinDocuments: 'epsteinDocuments',
    urlAliases: 'urlAliases',
    discoveryRuns: 'discoveryRuns',
    jobLogs: 'jobLogs',
    taskQueue: 'taskQueue',
} as const;

// ── Helper Utilities ───────────────────────────────────────

/** Generate a UUID-like ID (Firestore auto-IDs are fine too) */
export function generateId(): string {
    return getDb().collection('_').doc().id;
}

/** Convert Firestore Timestamp to Date for consistent serialization */
export function toDate(ts: Timestamp | Date | string | null | undefined): Date | null {
    if (!ts) return null;
    if (ts instanceof Timestamp) return ts.toDate();
    if (ts instanceof Date) return ts;
    return new Date(ts);
}

/** Convert Date to Firestore Timestamp */
export function toTimestamp(date: Date | string | null | undefined): Timestamp | null {
    if (!date) return null;
    if (date instanceof Date) return Timestamp.fromDate(date);
    return Timestamp.fromDate(new Date(date));
}

/** Strip undefined values from an object (Firestore doesn't accept undefined) */
export function stripUndefined<T extends Record<string, any>>(obj: T): T {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
            result[key] = value;
        }
    }
    return result;
}

// ── Epstein Full-Text Search ───────────────────────────────
// Firestore doesn't have native full-text search like PostgreSQL tsvector.
// We implement a keyword-based search using tokenized searchTerms array.
// For production, consider Algolia or Typesense integration.

/**
 * Tokenize text into lowercase search terms for Firestore array-contains queries.
 * Creates n-grams and individual words for partial matching.
 */
export function tokenizeForSearch(text: string): string[] {
    if (!text) return [];

    const words = text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2); // Skip very short words

    // Use unique words as search tokens (deduplicated)
    const tokens = new Set<string>();
    for (const word of words) {
        tokens.add(word);
        // Also add prefix substrings for partial matching (min 3 chars)
        for (let i = 3; i < Math.min(word.length, 8); i++) {
            tokens.add(word.substring(0, i));
        }
    }

    // Limit to prevent exceeding Firestore document size limits
    const arr = Array.from(tokens);
    return arr.slice(0, 500);
}

/**
 * Create search terms from title, summary, and raw text with weighting.
 * Title terms appear first (highest priority in array-contains-any matching).
 */
export function buildSearchTerms(title: string, summary?: string | null, rawText?: string | null): string[] {
    const titleTokens = tokenizeForSearch(title);
    const summaryTokens = summary ? tokenizeForSearch(summary) : [];
    const textTokens = rawText ? tokenizeForSearch(rawText.substring(0, 10000)) : [];

    // Merge with deduplication, prioritizing title > summary > text
    const seen = new Set<string>();
    const result: string[] = [];

    for (const t of [...titleTokens, ...summaryTokens, ...textTokens]) {
        if (!seen.has(t)) {
            seen.add(t);
            result.push(t);
        }
    }

    return result.slice(0, 500);
}
