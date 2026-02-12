import axios from 'axios';
import { logJob } from '@/lib/logger';
import { normalizeUrl } from './normalize-url';
import type { DiscoveredUrl } from './hub-crawler';

/**
 * Internet Archive CDX discovery (TERTIARY source).
 *
 * Queries the Wayback Machine's CDX API for historical snapshots of
 * justice.gov/epstein URLs. This catches pages that were published
 * and later removed or restructured — without needing to crawl DOJ directly.
 *
 * The CDX server is freely queryable with no API key required.
 */

const CDX_API = 'https://web.archive.org/cdx/search/cdx';

const CDX_QUERIES = [
    'justice.gov/epstein/*',
    'justice.gov/usao-sdny/*epstein*',
    'justice.gov/opa/*epstein*',
];

/** MIME types we care about */
const RELEVANT_MIMETYPES = new Set([
    'application/pdf',
    'text/html',
    'application/xhtml+xml',
]);

interface CdxRecord {
    url: string;
    timestamp: string;
    mimetype: string;
    statuscode: string;
    digest: string;
}

/**
 * Query the CDX API for a URL pattern and return unique original URLs.
 */
async function queryCdx(urlPattern: string, options?: {
    limit?: number;
}): Promise<CdxRecord[]> {
    const limit = options?.limit ?? 10000;

    try {
        const { data } = await axios.get(CDX_API, {
            params: {
                url: urlPattern,
                output: 'json',
                fl: 'original,timestamp,mimetype,statuscode,digest',
                filter: 'statuscode:200',
                collapse: 'urlkey',  // Deduplicate by URL
                limit,
            },
            timeout: 60000,
            headers: {
                'User-Agent': 'BillLens/1.0 (research tool; +https://billlens.com)',
            },
        });

        if (!Array.isArray(data) || data.length < 2) return [];

        // First row is headers, rest are data
        const headers = data[0] as string[];
        const records: CdxRecord[] = [];

        for (let i = 1; i < data.length; i++) {
            const row = data[i] as string[];
            const record: Record<string, string> = {};
            headers.forEach((h, idx) => { record[h] = row[idx]; });

            records.push({
                url: record.original || '',
                timestamp: record.timestamp || '',
                mimetype: record.mimetype || '',
                statuscode: record.statuscode || '',
                digest: record.digest || '',
            });
        }

        return records;
    } catch (err: any) {
        await logJob('DISCOVERY-IA-CDX', 'ERROR', `CDX query failed for ${urlPattern}: ${err.message}`);
        return [];
    }
}

export interface IaCdxResult {
    documents: DiscoveredUrl[];
    totalRecords: number;
    uniqueUrls: number;
    errors: number;
}

/**
 * Discover Epstein-related URLs from the Internet Archive.
 * Returns original justice.gov URLs (not Wayback URLs).
 */
export async function discoverFromInternetArchive(options?: {
    delayMs?: number;
    limitPerQuery?: number;
}): Promise<IaCdxResult> {
    const delayMs = options?.delayMs ?? 2000;
    const limitPerQuery = options?.limitPerQuery ?? 10000;

    const documents: DiscoveredUrl[] = [];
    const seenUrls = new Set<string>();
    let totalRecords = 0;
    let errors = 0;

    await logJob('DISCOVERY-IA-CDX', 'INFO', `Starting Internet Archive CDX discovery with ${CDX_QUERIES.length} queries`);

    for (const query of CDX_QUERIES) {
        if (CDX_QUERIES.indexOf(query) > 0) {
            await new Promise(r => setTimeout(r, delayMs));
        }

        const records = await queryCdx(query, { limit: limitPerQuery });
        if (records.length === 0) {
            errors++;
            continue;
        }

        totalRecords += records.length;

        for (const record of records) {
            // Only process relevant content types
            if (!RELEVANT_MIMETYPES.has(record.mimetype)) continue;

            const normalized = normalizeUrl(record.url);
            if (seenUrls.has(normalized)) continue;
            seenUrls.add(normalized);

            const fileType = record.mimetype === 'application/pdf' ? 'pdf' as const : 'html' as const;
            const filename = record.url.split('/').pop() || '';

            documents.push({
                url: record.url,  // Original justice.gov URL, NOT Wayback URL
                title: filename.replace(/\.(pdf|html?)$/i, '') || 'Untitled',
                sourceHub: `ia-cdx:${query}`,
                fileType,
            });
        }

        await logJob('DISCOVERY-IA-CDX', 'INFO',
            `CDX query "${query}": ${records.length} records, ${documents.length} unique relevant so far`);
    }

    await logJob('DISCOVERY-IA-CDX', 'INFO',
        `IA CDX discovery complete. ${totalRecords} records scanned, ${documents.length} unique relevant URLs found`);

    return {
        documents,
        totalRecords,
        uniqueUrls: seenUrls.size,
        errors,
    };
}
