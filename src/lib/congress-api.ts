import axios, { AxiosInstance } from 'axios';

/**
 * Congress.gov API v3 client.
 *
 * Key behaviors:
 * - Bill type comes from API as uppercase ("HR", "S", "HJRES") — we normalize to lowercase
 * - Text content is NOT returned by the API — it provides URLs to congress.gov files
 * - We fetch actual text from those URLs (no API key needed for congress.gov file URLs)
 * - Rate limit: 5,000 requests/hour
 */

const BASE_URL = 'https://api.congress.gov/v3';
const API_KEY = process.env.CONGRESS_GOV_API_KEY;

// ── Types matching actual API response shapes ──────────────

export interface CongressBillListItem {
    congress: number;
    type: string;           // "HR", "S", "HJRES", etc. (uppercase from API)
    number: string;
    title: string;
    originChamber: string;  // "House" or "Senate"
    originChamberCode: string;
    updateDate: string;
    url: string;            // API URL for full details
    latestAction?: {
        actionDate: string;
        actionTime?: string;
        text: string;
    };
}

export interface CongressBillDetail {
    congress: number;
    type: string;
    number: string;
    title: string;
    originChamber: string;
    introducedDate: string;
    updateDate: string;
    policyArea?: { name: string };
    sponsors?: Array<{
        bioguideId: string;
        fullName: string;
        firstName: string;
        lastName: string;
        party: string;
        state: string;
        district?: number;
    }>;
    latestAction?: {
        actionDate: string;
        text: string;
    };
    actions?: { count: number; url: string };
    textVersions?: { count: number; url: string };
    summaries?: { count: number; url: string };
}

export interface CongressTextVersion {
    date: string | null;
    type: string;           // "Introduced in House", "Engrossed in House", etc.
    formats: Array<{
        type: string;       // "Generated HTML", "Formatted Text", "PDF", "Formatted XML"
        url: string;
    }>;
}

export interface CongressAction {
    actionDate: string;
    actionTime?: string;
    text: string;
    type: string;           // "Floor", "Committee", "IntroReferral", etc.
    sourceSystem?: {
        code: number;
        name: string;       // "Senate", "House floor actions", etc.
    };
}

// ── API Client ─────────────────────────────────────────────

function createClient(): AxiosInstance {
    return axios.create({
        baseURL: BASE_URL,
        params: {
            api_key: API_KEY,
            format: 'json',
        },
        timeout: 30000,
    });
}

const client = createClient();

// Helper: pause between requests to respect rate limits
async function rateLimitDelay(ms = 250): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}

/**
 * Fetch a list of recently updated bills.
 * The API returns bill.type in UPPERCASE — callers should normalize.
 */
export async function fetchRecentBills(limit = 20, offset = 0): Promise<CongressBillListItem[]> {
    if (!API_KEY) {
        console.warn('No CONGRESS_GOV_API_KEY provided. Returning empty.');
        return [];
    }

    const res = await client.get('/bill', {
        params: { limit, offset, sort: 'updateDate+desc' },
    });
    return res.data.bills || [];
}

/**
 * Fetch full details for a single bill (sponsors, policy area, etc.).
 */
export async function fetchBillDetails(
    congress: number, type: string, number: string
): Promise<CongressBillDetail | null> {
    if (!API_KEY) return null;

    try {
        const res = await client.get(`/bill/${congress}/${type.toLowerCase()}/${number}`);
        return res.data.bill || null;
    } catch (err: any) {
        console.error(`Failed to fetch bill details for ${congress}/${type}/${number}:`, err.message);
        return null;
    }
}

/**
 * Fetch text version metadata for a bill.
 * Returns URLs to actual text files — NOT the text content itself.
 */
export async function fetchBillTextVersions(
    congress: number, type: string, number: string
): Promise<CongressTextVersion[]> {
    if (!API_KEY) return [];

    try {
        const res = await client.get(`/bill/${congress}/${type.toLowerCase()}/${number}/text`);
        return res.data.textVersions || [];
    } catch (err: any) {
        console.error(`Failed to fetch text versions for ${congress}/${type}/${number}:`, err.message);
        return [];
    }
}

/**
 * Fetch the actual bill text content from a congress.gov URL.
 * These URLs do NOT require an API key.
 *
 * Priority: Formatted XML > Generated HTML > Formatted Text
 * We parse XML/HTML to extract clean text for storage.
 */
export async function fetchBillTextContent(
    formats: CongressTextVersion['formats']
): Promise<{ text: string; url: string; format: string } | null> {
    // Priority order for text extraction quality
    const formatPriority = ['Formatted XML', 'Generated HTML', 'Formatted Text'];

    for (const preferred of formatPriority) {
        const fmt = formats.find(f => f.type === preferred);
        if (!fmt) continue;

        try {
            const res = await axios.get(fmt.url, {
                timeout: 30000,
                headers: {
                    'User-Agent': 'BillLens/1.0 (legislative tracker)',
                    'Accept': 'text/html,application/xhtml+xml,application/xml,text/plain,*/*',
                },
                // Get as text regardless of content type
                responseType: 'text',
            });

            const raw = typeof res.data === 'string' ? res.data : String(res.data);

            if (raw && raw.length > 50) {
                return {
                    text: raw,
                    url: fmt.url,
                    format: fmt.type,
                };
            }
        } catch (err: any) {
            console.error(`Failed to fetch bill text from ${fmt.url}:`, err.message);
            continue;
        }
    }

    return null;
}

/**
 * Fetch actions (legislative history) for a bill.
 */
export async function fetchBillActions(
    congress: number, type: string, number: string
): Promise<CongressAction[]> {
    if (!API_KEY) return [];

    try {
        const res = await client.get(`/bill/${congress}/${type.toLowerCase()}/${number}/actions`);
        return res.data.actions || [];
    } catch (err: any) {
        console.error(`Failed to fetch actions for ${congress}/${type}/${number}:`, err.message);
        return [];
    }
}

export { rateLimitDelay };
