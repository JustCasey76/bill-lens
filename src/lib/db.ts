/**
 * Database abstraction layer — Firestore-backed replacement for Prisma.
 *
 * Provides typed CRUD helpers for every collection, matching the
 * data shapes previously defined in the Prisma schema.
 *
 * Key differences from PostgreSQL/Prisma:
 * - No ACID transactions across collections (use batched writes where needed)
 * - Full-text search uses tokenized searchTerms array instead of tsvector
 * - Composite unique constraints enforced via deterministic document IDs
 * - Relations are denormalized or resolved via secondary queries
 */

import {
    getDb,
    COLLECTIONS,
    FieldValue,
    Timestamp,
    generateId,
    toDate,
    toTimestamp,
    stripUndefined,
    buildSearchTerms,
    Filter,
} from './firestore';

// ── Type Definitions (matching Prisma schema) ──────────────

export interface User {
    id: string;
    name: string | null;
    email: string | null;
    emailVerified: Date | null;
    image: string | null;
    role: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Account {
    id: string;
    userId: string;
    type: string;
    provider: string;
    providerAccountId: string;
    refresh_token: string | null;
    access_token: string | null;
    expires_at: number | null;
    token_type: string | null;
    scope: string | null;
    id_token: string | null;
    session_state: string | null;
}

export interface Session {
    id: string;
    sessionToken: string;
    userId: string;
    expires: Date;
}

export interface Bill {
    id: string;
    congress: number;
    type: string;
    number: string;
    title: string;
    sponsor: string | null;
    sponsorParty: string | null;
    sponsorState: string | null;
    introDate: Date | null;
    status: string | null;
    policyArea: string | null;
    originChamber: string | null;
    congressGovUrl: string | null;
    latestActionDate: Date | null;
    latestActionText: string | null;
    updatedAt: Date;
    createdAt: Date;
}

export interface BillVersion {
    id: string;
    billId: string;
    code: string;
    date: Date | null;
    textUrl: string | null;
    fullText: string | null;
    sections: any | null;
    summary: any | null;
    diffAnalysis: any | null;
    createdAt: Date;
}

export interface BillAction {
    id: string;
    billId: string;
    date: Date;
    text: string;
    actionType: string | null;
    chamber: string | null;
    createdAt: Date;
}

export type Verdict = 'Accurate' | 'PartiallyAccurate' | 'Misleading' | 'Unsupported' | 'False';

export interface Claim {
    id: string;
    billId: string | null;
    content: string;
    sourceUrl: string | null;
    sourceDate: Date | null;
    status: string;
    verdict: Verdict | null;
    analysis: any | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface EpsteinDocument {
    id: string;
    title: string;
    sourceUrl: string;
    canonicalUrl: string | null;
    finalUrl: string | null;
    documentType: string | null;
    fileType: string;
    contentType: string | null;
    pageCount: number | null;
    rawText: string | null;
    summary: string | null;
    lengthChars: number | null;
    textHash: string | null;
    byteHash: string | null;
    caseNumber: string | null;
    filedDate: Date | null;
    parties: string[];
    keywords: string[];
    entities: string[];
    httpEtag: string | null;
    httpLastModified: string | null;
    lastFetchedAt: Date | null;
    extractionQuality: number | null;
    ocrRequired: boolean;
    discoveryLineage: any | null;
    status: string;
    searchTerms?: string[];
    createdAt: Date;
    updatedAt: Date;
}

export interface UrlAlias {
    id: string;
    documentId: string;
    aliasUrl: string;
    discoverySource: string;
    firstSeen: Date;
    lastSeen: Date;
}

export interface DiscoveryRun {
    id: string;
    source: string;
    config: any | null;
    urlsFound: number;
    urlsNew: number;
    urlsChanged: number;
    errors: number;
    startedAt: Date;
    completedAt: Date | null;
}

export interface JobLog {
    id: string;
    jobType: string;
    status: string;
    details: any | null;
    startedAt: Date;
    completedAt: Date | null;
}

// ── Task Queue Item (replaces BullMQ jobs) ─────────────────

export interface TaskQueueItem {
    id: string;
    queue: string;
    jobName: string;
    data: any;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    createdAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
    error: string | null;
    removeOnComplete: boolean;
}

// ── Firestore Serialization Helpers ────────────────────────

function docToData<T>(doc: FirebaseFirestore.DocumentSnapshot): T | null {
    if (!doc.exists) return null;
    const data = doc.data()!;

    // Convert all Timestamp fields to Dates
    const result: any = { id: doc.id };
    for (const [key, value] of Object.entries(data)) {
        if (value instanceof Timestamp) {
            result[key] = value.toDate();
        } else {
            result[key] = value;
        }
    }
    return result as T;
}

function docsToData<T>(snapshot: FirebaseFirestore.QuerySnapshot): T[] {
    return snapshot.docs.map(doc => docToData<T>(doc)!);
}

// ── Database Operations ────────────────────────────────────

// ── Users ──

export const users = {
    async findById(id: string): Promise<User | null> {
        const doc = await getDb().collection(COLLECTIONS.users).doc(id).get();
        return docToData<User>(doc);
    },

    async findByEmail(email: string): Promise<User | null> {
        const snap = await getDb()
            .collection(COLLECTIONS.users)
            .where('email', '==', email)
            .limit(1)
            .get();
        return snap.empty ? null : docToData<User>(snap.docs[0]);
    },

    async create(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
        const id = generateId();
        const now = new Date();
        const user: User = {
            id,
            ...data,
            role: data.role || 'user',
            createdAt: now,
            updatedAt: now,
        };
        await getDb().collection(COLLECTIONS.users).doc(id).set(stripUndefined(user));
        return user;
    },

    async update(id: string, data: Partial<User>): Promise<User> {
        const updateData = stripUndefined({ ...data, updatedAt: new Date() });
        await getDb().collection(COLLECTIONS.users).doc(id).update(updateData);
        return (await users.findById(id))!;
    },
};

// ── Bills ──

/** Generate deterministic doc ID for bill uniqueness */
function billDocId(congress: number, type: string, number: string): string {
    return `${congress}_${type.toLowerCase()}_${number}`;
}

export const bills = {
    async findById(id: string): Promise<Bill | null> {
        const doc = await getDb().collection(COLLECTIONS.bills).doc(id).get();
        return docToData<Bill>(doc);
    },

    async findByCompositeKey(congress: number, type: string, number: string): Promise<Bill | null> {
        const id = billDocId(congress, type, number);
        return bills.findById(id);
    },

    async upsert(
        key: { congress: number; type: string; number: string },
        updateData: Partial<Bill>,
        createData: Partial<Bill>,
    ): Promise<Bill> {
        const id = billDocId(key.congress, key.type, key.number);
        const existing = await bills.findById(id);

        if (existing) {
            const update = stripUndefined({ ...updateData, updatedAt: new Date() });
            await getDb().collection(COLLECTIONS.bills).doc(id).update(update);
            return (await bills.findById(id))!;
        } else {
            const now = new Date();
            const bill: Bill = {
                id,
                congress: key.congress,
                type: key.type,
                number: key.number,
                title: 'Untitled Bill',
                sponsor: null,
                sponsorParty: null,
                sponsorState: null,
                introDate: null,
                status: null,
                policyArea: null,
                originChamber: null,
                congressGovUrl: null,
                latestActionDate: null,
                latestActionText: null,
                createdAt: now,
                updatedAt: now,
                ...createData,
            };
            await getDb().collection(COLLECTIONS.bills).doc(id).set(stripUndefined(bill));
            return bill;
        }
    },

    async findMany(options?: {
        where?: { status?: string; congress?: number; policyArea?: string; titleContains?: string };
        orderBy?: { field: string; direction: 'asc' | 'desc' };
        take?: number;
        skip?: number;
    }): Promise<Bill[]> {
        let query: FirebaseFirestore.Query = getDb().collection(COLLECTIONS.bills);

        if (options?.where?.status) {
            query = query.where('status', '==', options.where.status);
        }
        if (options?.where?.congress) {
            query = query.where('congress', '==', options.where.congress);
        }
        if (options?.where?.policyArea) {
            query = query.where('policyArea', '==', options.where.policyArea);
        }

        if (options?.orderBy) {
            query = query.orderBy(options.orderBy.field, options.orderBy.direction);
        }

        if (options?.take) {
            query = query.limit(options.take);
        }

        // Note: Firestore doesn't support offset natively. Use cursor-based pagination in production.
        // For now, fetch take+skip and slice.
        if (options?.skip && options.skip > 0) {
            query = query.limit((options.take || 20) + options.skip);
            const snap = await query.get();
            const all = docsToData<Bill>(snap);
            return all.slice(options.skip);
        }

        const snap = await query.get();
        const results = docsToData<Bill>(snap);

        // Client-side title filter (Firestore can't do case-insensitive contains)
        if (options?.where?.titleContains) {
            const q = options.where.titleContains.toLowerCase();
            return results.filter(b => b.title.toLowerCase().includes(q));
        }

        return results;
    },

    async count(where?: { status?: string }): Promise<number> {
        let query: FirebaseFirestore.Query = getDb().collection(COLLECTIONS.bills);
        if (where?.status) query = query.where('status', '==', where.status);
        const snap = await query.count().get();
        return snap.data().count;
    },
};

// ── Bill Versions ──

function billVersionDocId(billId: string, code: string): string {
    return `${billId}_${code}`;
}

export const billVersions = {
    async findById(id: string): Promise<BillVersion | null> {
        const doc = await getDb().collection(COLLECTIONS.billVersions).doc(id).get();
        return docToData<BillVersion>(doc);
    },

    async findByBillAndCode(billId: string, code: string): Promise<BillVersion | null> {
        return billVersions.findById(billVersionDocId(billId, code));
    },

    async create(data: Omit<BillVersion, 'id' | 'createdAt'>): Promise<BillVersion> {
        const id = billVersionDocId(data.billId, data.code);
        const version: BillVersion = {
            id,
            ...data,
            createdAt: new Date(),
        };
        await getDb().collection(COLLECTIONS.billVersions).doc(id).set(stripUndefined(version));
        return version;
    },

    async update(id: string, data: Partial<BillVersion>): Promise<BillVersion> {
        await getDb().collection(COLLECTIONS.billVersions).doc(id).update(stripUndefined(data));
        return (await billVersions.findById(id))!;
    },

    async findByBill(billId: string, options?: { orderBy?: { field: string; direction: 'asc' | 'desc' }; take?: number }): Promise<BillVersion[]> {
        let query: FirebaseFirestore.Query = getDb()
            .collection(COLLECTIONS.billVersions)
            .where('billId', '==', billId);

        if (options?.orderBy) {
            query = query.orderBy(options.orderBy.field, options.orderBy.direction);
        }
        if (options?.take) {
            query = query.limit(options.take);
        }

        const snap = await query.get();
        return docsToData<BillVersion>(snap);
    },
};

// ── Bill Actions ──

export const billActions = {
    async findFirst(where: { billId: string; date: Date; text: string }): Promise<BillAction | null> {
        const snap = await getDb()
            .collection(COLLECTIONS.billActions)
            .where('billId', '==', where.billId)
            .where('date', '==', where.date)
            .where('text', '==', where.text)
            .limit(1)
            .get();
        return snap.empty ? null : docToData<BillAction>(snap.docs[0]);
    },

    async create(data: Omit<BillAction, 'id' | 'createdAt'>): Promise<BillAction> {
        const id = generateId();
        const action: BillAction = {
            id,
            ...data,
            createdAt: new Date(),
        };
        await getDb().collection(COLLECTIONS.billActions).doc(id).set(stripUndefined(action));
        return action;
    },

    async findByBill(billId: string): Promise<BillAction[]> {
        const snap = await getDb()
            .collection(COLLECTIONS.billActions)
            .where('billId', '==', billId)
            .orderBy('date', 'desc')
            .get();
        return docsToData<BillAction>(snap);
    },

    async deleteByBill(billId: string): Promise<void> {
        const snap = await getDb()
            .collection(COLLECTIONS.billActions)
            .where('billId', '==', billId)
            .get();

        const batch = getDb().batch();
        snap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    },
};

// ── Claims ──

export const claims = {
    async findById(id: string): Promise<Claim | null> {
        const doc = await getDb().collection(COLLECTIONS.claims).doc(id).get();
        return docToData<Claim>(doc);
    },

    async findByIdWithBill(id: string): Promise<{ claim: Claim; bill: Bill | null } | null> {
        const claim = await claims.findById(id);
        if (!claim) return null;
        const bill = claim.billId ? await bills.findById(claim.billId) : null;
        return { claim, bill };
    },

    async create(data: { content: string; billId?: string | null; sourceUrl?: string | null; status?: string }): Promise<Claim> {
        const id = generateId();
        const now = new Date();
        const claim: Claim = {
            id,
            billId: data.billId || null,
            content: data.content,
            sourceUrl: data.sourceUrl || null,
            sourceDate: null,
            status: data.status || 'pending',
            verdict: null,
            analysis: null,
            createdAt: now,
            updatedAt: now,
        };
        await getDb().collection(COLLECTIONS.claims).doc(id).set(stripUndefined(claim));
        return claim;
    },

    async update(id: string, data: Partial<Claim>): Promise<Claim> {
        const updateData = stripUndefined({ ...data, updatedAt: new Date() });
        await getDb().collection(COLLECTIONS.claims).doc(id).update(updateData);
        return (await claims.findById(id))!;
    },

    async findMany(options?: {
        where?: { status?: string; verdict?: string; contentContains?: string };
        orderBy?: { field: string; direction: 'asc' | 'desc' };
        take?: number;
        skip?: number;
    }): Promise<Claim[]> {
        let query: FirebaseFirestore.Query = getDb().collection(COLLECTIONS.claims);

        if (options?.where?.status) {
            query = query.where('status', '==', options.where.status);
        }
        if (options?.where?.verdict) {
            query = query.where('verdict', '==', options.where.verdict);
        }

        if (options?.orderBy) {
            query = query.orderBy(options.orderBy.field, options.orderBy.direction);
        }

        const limit = (options?.take || 20) + (options?.skip || 0);
        query = query.limit(limit);

        const snap = await query.get();
        let results = docsToData<Claim>(snap);

        if (options?.skip) {
            results = results.slice(options.skip);
        }

        // Client-side content filter
        if (options?.where?.contentContains) {
            const q = options.where.contentContains.toLowerCase();
            results = results.filter(c => c.content.toLowerCase().includes(q));
        }

        return results;
    },

    async count(where?: { status?: string; verdict?: string; contentContains?: string }): Promise<number> {
        let query: FirebaseFirestore.Query = getDb().collection(COLLECTIONS.claims);
        if (where?.status) query = query.where('status', '==', where.status);
        if (where?.verdict) query = query.where('verdict', '==', where.verdict);

        if (where?.contentContains) {
            // Can't count with client-side filter efficiently, fetch all
            const snap = await query.get();
            const q = where.contentContains.toLowerCase();
            return snap.docs.filter(d => (d.data().content || '').toLowerCase().includes(q)).length;
        }

        const snap = await query.count().get();
        return snap.data().count;
    },
};

// ── Epstein Documents ──

export const epsteinDocuments = {
    async findById(id: string): Promise<EpsteinDocument | null> {
        const doc = await getDb().collection(COLLECTIONS.epsteinDocuments).doc(id).get();
        return docToData<EpsteinDocument>(doc);
    },

    async findBySourceUrl(sourceUrl: string): Promise<EpsteinDocument | null> {
        const snap = await getDb()
            .collection(COLLECTIONS.epsteinDocuments)
            .where('sourceUrl', '==', sourceUrl)
            .limit(1)
            .get();
        return snap.empty ? null : docToData<EpsteinDocument>(snap.docs[0]);
    },

    async findByCanonicalUrlOrSourceUrl(canonicalUrl: string, sourceUrl: string): Promise<EpsteinDocument | null> {
        // Try canonical URL first
        let snap = await getDb()
            .collection(COLLECTIONS.epsteinDocuments)
            .where('canonicalUrl', '==', canonicalUrl)
            .limit(1)
            .get();

        if (!snap.empty) return docToData<EpsteinDocument>(snap.docs[0]);

        // Fallback to source URL
        snap = await getDb()
            .collection(COLLECTIONS.epsteinDocuments)
            .where('sourceUrl', '==', sourceUrl)
            .limit(1)
            .get();

        return snap.empty ? null : docToData<EpsteinDocument>(snap.docs[0]);
    },

    async create(data: Partial<EpsteinDocument> & { title: string; sourceUrl: string }): Promise<EpsteinDocument> {
        const id = generateId();
        const now = new Date();
        const doc: EpsteinDocument = {
            id,
            title: data.title,
            sourceUrl: data.sourceUrl,
            canonicalUrl: data.canonicalUrl || null,
            finalUrl: data.finalUrl || null,
            documentType: data.documentType || null,
            fileType: data.fileType || 'pdf',
            contentType: data.contentType || null,
            pageCount: data.pageCount || null,
            rawText: data.rawText || null,
            summary: data.summary || null,
            lengthChars: data.lengthChars || null,
            textHash: data.textHash || null,
            byteHash: data.byteHash || null,
            caseNumber: data.caseNumber || null,
            filedDate: data.filedDate || null,
            parties: data.parties || [],
            keywords: data.keywords || [],
            entities: data.entities || [],
            httpEtag: data.httpEtag || null,
            httpLastModified: data.httpLastModified || null,
            lastFetchedAt: data.lastFetchedAt || null,
            extractionQuality: data.extractionQuality || null,
            ocrRequired: data.ocrRequired || false,
            discoveryLineage: data.discoveryLineage || null,
            status: data.status || 'pending',
            searchTerms: buildSearchTerms(data.title, data.summary, data.rawText),
            createdAt: now,
            updatedAt: now,
        };
        await getDb().collection(COLLECTIONS.epsteinDocuments).doc(id).set(stripUndefined(doc));
        return doc;
    },

    async update(id: string, data: Partial<EpsteinDocument>): Promise<EpsteinDocument> {
        const updateData: any = stripUndefined({ ...data, updatedAt: new Date() });

        // Rebuild search terms if text/title/summary changed
        if (data.rawText !== undefined || data.title !== undefined || data.summary !== undefined) {
            const existing = await epsteinDocuments.findById(id);
            if (existing) {
                updateData.searchTerms = buildSearchTerms(
                    data.title || existing.title,
                    data.summary !== undefined ? data.summary : existing.summary,
                    data.rawText !== undefined ? data.rawText : existing.rawText,
                );
            }
        }

        await getDb().collection(COLLECTIONS.epsteinDocuments).doc(id).update(updateData);
        return (await epsteinDocuments.findById(id))!;
    },

    async upsertBySourceUrl(
        sourceUrl: string,
        updateData: Partial<EpsteinDocument>,
        createData: Partial<EpsteinDocument> & { title: string; sourceUrl: string },
    ): Promise<EpsteinDocument> {
        const existing = await epsteinDocuments.findBySourceUrl(sourceUrl);

        if (existing) {
            return epsteinDocuments.update(existing.id, updateData);
        } else {
            return epsteinDocuments.create(createData);
        }
    },

    /**
     * Full-text search using tokenized searchTerms.
     * Splits query into words and matches documents containing all query words.
     */
    async search(q: string, options?: {
        status?: string;
        documentType?: string;
        limit?: number;
        offset?: number;
    }): Promise<{ documents: EpsteinDocument[]; total: number }> {
        const limit = options?.limit || 20;
        const offset = options?.offset || 0;

        // Tokenize query
        const queryWords = q
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2);

        if (queryWords.length === 0) {
            return { documents: [], total: 0 };
        }

        // Firestore array-contains can only match one value at a time.
        // Use array-contains with the first word, then filter client-side for remaining words.
        let query: FirebaseFirestore.Query = getDb()
            .collection(COLLECTIONS.epsteinDocuments)
            .where('status', '==', options?.status || 'indexed')
            .where('searchTerms', 'array-contains', queryWords[0]);

        if (options?.documentType) {
            query = query.where('documentType', '==', options.documentType);
        }

        // Fetch more than needed for client-side filtering
        const fetchLimit = (limit + offset) * 3;
        query = query.limit(fetchLimit);

        const snap = await query.get();
        let results = docsToData<EpsteinDocument>(snap);

        // Client-side filter for additional query words
        if (queryWords.length > 1) {
            const additionalWords = queryWords.slice(1);
            results = results.filter(doc => {
                const terms = doc.searchTerms || [];
                return additionalWords.every(word =>
                    terms.some(term => term.startsWith(word) || term === word)
                );
            });
        }

        // Score results: count matching terms for ranking
        const scored = results.map(doc => {
            const terms = doc.searchTerms || [];
            let score = 0;
            for (const word of queryWords) {
                // Title match gets higher score
                if (doc.title.toLowerCase().includes(word)) score += 10;
                if (doc.summary?.toLowerCase().includes(word)) score += 5;
                if (terms.includes(word)) score += 1;
            }
            return { doc, score };
        });

        scored.sort((a, b) => b.score - a.score);

        const total = scored.length;
        const paginated = scored.slice(offset, offset + limit).map(s => s.doc);

        return { documents: paginated, total };
    },

    async findMany(options?: {
        where?: { status?: string | { in: string[] }; documentType?: string };
        orderBy?: { field: string; direction: 'asc' | 'desc' };
        take?: number;
        skip?: number;
        select?: string[];
    }): Promise<EpsteinDocument[]> {
        let query: FirebaseFirestore.Query = getDb().collection(COLLECTIONS.epsteinDocuments);

        if (options?.where?.status) {
            if (typeof options.where.status === 'string') {
                query = query.where('status', '==', options.where.status);
            } else if (options.where.status.in) {
                query = query.where('status', 'in', options.where.status.in);
            }
        }
        if (options?.where?.documentType) {
            query = query.where('documentType', '==', options.where.documentType);
        }

        if (options?.orderBy) {
            query = query.orderBy(options.orderBy.field, options.orderBy.direction);
        }

        const limit = (options?.take || 20) + (options?.skip || 0);
        query = query.limit(limit);

        const snap = await query.get();
        let results = docsToData<EpsteinDocument>(snap);

        if (options?.skip) {
            results = results.slice(options.skip);
        }

        // Apply field selection client-side
        if (options?.select) {
            results = results.map(doc => {
                const filtered: any = { id: doc.id };
                for (const field of options.select!) {
                    filtered[field] = (doc as any)[field];
                }
                return filtered;
            });
        }

        return results;
    },

    async count(where?: { status?: string }): Promise<number> {
        let query: FirebaseFirestore.Query = getDb().collection(COLLECTIONS.epsteinDocuments);
        if (where?.status) query = query.where('status', '==', where.status);
        const snap = await query.count().get();
        return snap.data().count;
    },
};

// ── URL Aliases ──

export const urlAliases = {
    async findByAliasUrl(aliasUrl: string): Promise<UrlAlias | null> {
        const snap = await getDb()
            .collection(COLLECTIONS.urlAliases)
            .where('aliasUrl', '==', aliasUrl)
            .limit(1)
            .get();
        return snap.empty ? null : docToData<UrlAlias>(snap.docs[0]);
    },

    async upsert(
        aliasUrl: string,
        data: { documentId: string; discoverySource: string },
    ): Promise<UrlAlias> {
        const existing = await urlAliases.findByAliasUrl(aliasUrl);

        if (existing) {
            await getDb().collection(COLLECTIONS.urlAliases).doc(existing.id).update({
                lastSeen: new Date(),
            });
            return { ...existing, lastSeen: new Date() };
        } else {
            const id = generateId();
            const now = new Date();
            const alias: UrlAlias = {
                id,
                documentId: data.documentId,
                aliasUrl,
                discoverySource: data.discoverySource,
                firstSeen: now,
                lastSeen: now,
            };
            await getDb().collection(COLLECTIONS.urlAliases).doc(id).set(stripUndefined(alias));
            return alias;
        }
    },
};

// ── Discovery Runs ──

export const discoveryRuns = {
    async create(data: { source: string; config?: any }): Promise<DiscoveryRun> {
        const id = generateId();
        const run: DiscoveryRun = {
            id,
            source: data.source,
            config: data.config || null,
            urlsFound: 0,
            urlsNew: 0,
            urlsChanged: 0,
            errors: 0,
            startedAt: new Date(),
            completedAt: null,
        };
        await getDb().collection(COLLECTIONS.discoveryRuns).doc(id).set(stripUndefined(run));
        return run;
    },

    async update(id: string, data: Partial<DiscoveryRun>): Promise<void> {
        await getDb().collection(COLLECTIONS.discoveryRuns).doc(id).update(stripUndefined(data));
    },
};

// ── Job Logs ──

export const jobLogs = {
    async create(data: { jobType: string; status: string; details?: any }): Promise<JobLog> {
        const id = generateId();
        const log: JobLog = {
            id,
            jobType: data.jobType,
            status: data.status,
            details: data.details || null,
            startedAt: new Date(),
            completedAt: new Date(),
        };
        await getDb().collection(COLLECTIONS.jobLogs).doc(id).set(stripUndefined(log));
        return log;
    },

    async findMany(options?: { orderBy?: { field: string; direction: 'asc' | 'desc' }; take?: number }): Promise<JobLog[]> {
        let query: FirebaseFirestore.Query = getDb().collection(COLLECTIONS.jobLogs);

        if (options?.orderBy) {
            query = query.orderBy(options.orderBy.field, options.orderBy.direction);
        }

        if (options?.take) {
            query = query.limit(options.take);
        }

        const snap = await query.get();
        return docsToData<JobLog>(snap);
    },
};

// ── Task Queue (replaces BullMQ) ──

export const taskQueue = {
    async add(queue: string, jobName: string, data: any, options?: { removeOnComplete?: boolean }): Promise<TaskQueueItem> {
        const id = generateId();
        const task: TaskQueueItem = {
            id,
            queue,
            jobName,
            data,
            status: 'pending',
            createdAt: new Date(),
            startedAt: null,
            completedAt: null,
            error: null,
            removeOnComplete: options?.removeOnComplete ?? true,
        };
        await getDb().collection(COLLECTIONS.taskQueue).doc(id).set(stripUndefined(task));
        return task;
    },

    async claimNext(queue: string): Promise<TaskQueueItem | null> {
        // Atomically claim the next pending task
        const snap = await getDb()
            .collection(COLLECTIONS.taskQueue)
            .where('queue', '==', queue)
            .where('status', '==', 'pending')
            .orderBy('createdAt', 'asc')
            .limit(1)
            .get();

        if (snap.empty) return null;

        const doc = snap.docs[0];
        const ref = doc.ref;

        // Use transaction to prevent double-claiming
        return getDb().runTransaction(async (tx) => {
            const freshDoc = await tx.get(ref);
            const data = freshDoc.data();
            if (!data || data.status !== 'pending') return null;

            tx.update(ref, {
                status: 'processing',
                startedAt: new Date(),
            });

            return docToData<TaskQueueItem>(freshDoc);
        });
    },

    async complete(id: string): Promise<void> {
        const ref = getDb().collection(COLLECTIONS.taskQueue).doc(id);
        const doc = await ref.get();
        const data = doc.data();

        if (data?.removeOnComplete) {
            await ref.delete();
        } else {
            await ref.update({
                status: 'completed',
                completedAt: new Date(),
            });
        }
    },

    async fail(id: string, error: string): Promise<void> {
        await getDb().collection(COLLECTIONS.taskQueue).doc(id).update({
            status: 'failed',
            error,
            completedAt: new Date(),
        });
    },
};

// ── Health Check ──

export async function checkConnection(): Promise<boolean> {
    try {
        // Simple read to verify Firestore is accessible
        await getDb().collection(COLLECTIONS.jobLogs).limit(1).get();
        return true;
    } catch {
        return false;
    }
}
