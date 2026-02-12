import { createHash } from 'crypto';
import axios from 'axios';

/**
 * URL normalization + dedup utilities.
 * Produces a stable canonical URL for deduplication without storing files.
 */

const TRACKING_PARAMS = new Set([
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'fbclid', 'gclid', 'msclkid', 'ref', 'source', 'mc_cid', 'mc_eid',
]);

/**
 * Normalize a URL to a canonical form for dedup:
 * - Force https
 * - Lowercase host
 * - Strip tracking params and fragments
 * - Remove trailing slash (except root)
 * - Sort remaining query params
 */
export function normalizeUrl(rawUrl: string): string {
    try {
        const url = new URL(rawUrl);

        // Force https
        url.protocol = 'https:';

        // Lowercase host
        url.hostname = url.hostname.toLowerCase();

        // Strip tracking params
        for (const param of TRACKING_PARAMS) {
            url.searchParams.delete(param);
        }

        // Sort remaining params for stability
        url.searchParams.sort();

        // Strip fragment
        url.hash = '';

        let result = url.toString();

        // Remove trailing slash unless it's just the root path
        if (result.endsWith('/') && url.pathname !== '/') {
            result = result.slice(0, -1);
        }

        return result;
    } catch {
        // If URL is malformed, return as-is
        return rawUrl;
    }
}

/**
 * Compute a stable doc ID from a canonical URL.
 */
export function computeDocId(canonicalUrl: string): string {
    return createHash('sha256').update(canonicalUrl).digest('hex');
}

/**
 * Compute SHA-256 hash of a buffer (in-memory, no file I/O).
 */
export function hashBuffer(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Compute SHA-256 hash of a string.
 */
export function hashText(text: string): string {
    return createHash('sha256').update(text, 'utf-8').digest('hex');
}

/**
 * Resolve a URL through redirects to find the final destination.
 * Uses HEAD requests to avoid downloading content.
 */
export async function resolveRedirects(url: string): Promise<string> {
    try {
        const response = await axios.head(url, {
            maxRedirects: 10,
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            validateStatus: (status) => status < 400,
        });
        // axios follows redirects automatically; response.request.res.responseUrl has final URL
        const finalUrl = response.request?.res?.responseUrl || response.request?.responseURL || url;
        return finalUrl;
    } catch {
        // If HEAD fails, return original — we'll try GET during extraction
        return url;
    }
}

export interface DeduplicationResult {
    canonicalUrl: string;
    finalUrl: string;
    isDuplicate: boolean;
    existingDocId?: string;
}
