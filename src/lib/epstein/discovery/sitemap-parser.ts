import axios from 'axios';
import * as cheerio from 'cheerio';
import { logJob } from '@/lib/logger';
import { normalizeUrl } from './normalize-url';
import type { DiscoveredUrl } from './hub-crawler';

/**
 * Sitemap-based discovery (SECONDARY source).
 *
 * Fetches justice.gov sitemaps and filters for Epstein-related URLs.
 * Government sitemaps may be incomplete, so this supplements the hub crawler.
 */

const SITEMAP_URLS = [
    'https://www.justice.gov/sitemap.xml',
];

const RELEVANCE_PATTERNS = [
    /\/epstein\//i,
    /\/usao-sdny\/.*epstein/i,
    /\/opa\/.*epstein/i,
];

function isRelevantUrl(url: string): boolean {
    return RELEVANCE_PATTERNS.some(pattern => pattern.test(url));
}

function classifyFileType(url: string): 'pdf' | 'html' | 'unknown' {
    const lower = url.toLowerCase();
    if (lower.endsWith('.pdf')) return 'pdf';
    if (!lower.match(/\.\w{2,4}$/)) return 'html';
    return 'unknown';
}

/**
 * Parse a sitemap XML and extract URLs. Handles both sitemap indexes
 * (which point to other sitemaps) and regular sitemaps (which list page URLs).
 */
async function parseSitemap(url: string): Promise<{
    urls: { loc: string; lastmod?: string }[];
    childSitemaps: string[];
}> {
    try {
        const { data } = await axios.get(url, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; BillLens/1.0)',
                'Accept': 'application/xml,text/xml,*/*',
            },
        });

        const $ = cheerio.load(data, { xmlMode: true });
        const urls: { loc: string; lastmod?: string }[] = [];
        const childSitemaps: string[] = [];

        // Check for sitemap index (points to child sitemaps)
        $('sitemap').each((_, el) => {
            const loc = $(el).find('loc').text().trim();
            if (loc) childSitemaps.push(loc);
        });

        // Check for URL entries
        $('url').each((_, el) => {
            const loc = $(el).find('loc').text().trim();
            const lastmod = $(el).find('lastmod').text().trim() || undefined;
            if (loc) urls.push({ loc, lastmod });
        });

        return { urls, childSitemaps };
    } catch (err: any) {
        await logJob('DISCOVERY-SITEMAP', 'ERROR', `Failed to parse sitemap ${url}: ${err.message}`);
        return { urls: [], childSitemaps: [] };
    }
}

export interface SitemapResult {
    documents: DiscoveredUrl[];
    sitemapsParsed: number;
    totalUrlsScanned: number;
    errors: number;
}

/**
 * Discover Epstein-related URLs by parsing justice.gov sitemaps.
 * Follows sitemap indexes to find nested sitemaps.
 */
export async function discoverFromSitemaps(options?: {
    maxSitemaps?: number;
    delayMs?: number;
}): Promise<SitemapResult> {
    const maxSitemaps = options?.maxSitemaps ?? 20;
    const delayMs = options?.delayMs ?? 1000;

    const documents: DiscoveredUrl[] = [];
    const seenUrls = new Set<string>();
    const sitemapQueue = [...SITEMAP_URLS];
    const visitedSitemaps = new Set<string>();
    let totalUrlsScanned = 0;
    let errors = 0;

    await logJob('DISCOVERY-SITEMAP', 'INFO', 'Starting sitemap discovery');

    while (sitemapQueue.length > 0 && visitedSitemaps.size < maxSitemaps) {
        const sitemapUrl = sitemapQueue.shift()!;
        if (visitedSitemaps.has(sitemapUrl)) continue;
        visitedSitemaps.add(sitemapUrl);

        if (visitedSitemaps.size > 1) {
            await new Promise(r => setTimeout(r, delayMs));
        }

        const { urls, childSitemaps } = await parseSitemap(sitemapUrl);

        if (urls.length === 0 && childSitemaps.length === 0) {
            errors++;
            continue;
        }

        // Enqueue child sitemaps
        for (const child of childSitemaps) {
            if (!visitedSitemaps.has(child)) {
                // Only follow child sitemaps that might contain Epstein content
                // or the main index (which we need to enumerate)
                sitemapQueue.push(child);
            }
        }

        // Filter URLs for relevance
        for (const entry of urls) {
            totalUrlsScanned++;

            if (!isRelevantUrl(entry.loc)) continue;

            const normalized = normalizeUrl(entry.loc);
            if (seenUrls.has(normalized)) continue;
            seenUrls.add(normalized);

            const fileType = classifyFileType(entry.loc);
            documents.push({
                url: entry.loc,
                title: entry.loc.split('/').pop()?.replace(/\.(pdf|html?)$/i, '') || 'Untitled',
                sourceHub: sitemapUrl,
                fileType,
            });
        }

        await logJob('DISCOVERY-SITEMAP', 'INFO',
            `Parsed ${sitemapUrl}: ${urls.length} URLs, ${childSitemaps.length} child sitemaps, ${documents.length} relevant so far`);
    }

    await logJob('DISCOVERY-SITEMAP', 'INFO',
        `Sitemap discovery complete. ${visitedSitemaps.size} sitemaps parsed, ${totalUrlsScanned} URLs scanned, ${documents.length} relevant found`);

    return {
        documents,
        sitemapsParsed: visitedSitemaps.size,
        totalUrlsScanned,
        errors,
    };
}
