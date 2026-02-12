import axios from 'axios';
import * as cheerio from 'cheerio';
import { logJob } from '@/lib/logger';
import { normalizeUrl } from './normalize-url';

/**
 * Hub-page graph discovery (PRIMARY source).
 *
 * Crawls known DOJ listing/index pages and extracts document links + additional
 * hub pages. This expands the original scraper beyond the 12 data-set pages to
 * cover press releases, court filings, and other sub-sections under /epstein.
 *
 * No files are stored — only URLs are collected.
 */

const DOJ_BASE = 'https://www.justice.gov';

const FETCH_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Referer': 'https://www.justice.gov/epstein',
};

/** URL patterns that indicate relevant Epstein-related content */
const ALLOWLIST_PATTERNS = [
    /\/epstein\//i,
    /\/usao-sdny\/.*epstein/i,
    /\/opa\/.*epstein/i,
    /\/archive\/.*epstein/i,
];

/** Known root hub pages to start crawling from */
const SEED_HUBS: string[] = [
    `${DOJ_BASE}/epstein`,
    `${DOJ_BASE}/epstein/doj-disclosures`,
    // Data set pages 1-12
    ...Array.from({ length: 12 }, (_, i) => `${DOJ_BASE}/epstein/doj-disclosures/data-set-${i + 1}-files`),
];

export interface DiscoveredUrl {
    url: string;
    title: string;
    sourceHub: string;
    fileType: 'pdf' | 'html' | 'unknown';
}

async function fetchPage(url: string): Promise<string | null> {
    try {
        const { data } = await axios.get(url, {
            headers: FETCH_HEADERS,
            timeout: 30000,
            maxRedirects: 5,
        });
        return data;
    } catch (err: any) {
        await logJob('DISCOVERY-HUB', 'ERROR', `Failed to fetch ${url}: ${err.message}`);
        return null;
    }
}

function isRelevantUrl(href: string): boolean {
    return ALLOWLIST_PATTERNS.some(pattern => pattern.test(href));
}

function classifyFileType(url: string): 'pdf' | 'html' | 'unknown' {
    const lower = url.toLowerCase();
    if (lower.endsWith('.pdf')) return 'pdf';
    if (lower.match(/\.(html?|asp|php)$/)) return 'html';
    // DOJ pages without extensions are typically HTML
    if (!lower.match(/\.\w{2,4}$/)) return 'html';
    return 'unknown';
}

/**
 * Extract all links from a hub page.
 * Returns both document links (PDFs, content pages) and additional hub links.
 */
function extractLinks(html: string, sourceUrl: string): {
    documents: DiscoveredUrl[];
    hubs: string[];
} {
    const $ = cheerio.load(html);
    const documents: DiscoveredUrl[] = [];
    const hubs: string[] = [];
    const seen = new Set<string>();

    $('a[href]').each((_, el) => {
        const rawHref = $(el).attr('href');
        if (!rawHref) return;

        // Resolve relative URLs
        let fullUrl: string;
        try {
            fullUrl = rawHref.startsWith('http')
                ? rawHref
                : new URL(rawHref, DOJ_BASE).toString();
        } catch {
            return;
        }

        // Only process justice.gov URLs
        if (!fullUrl.includes('justice.gov')) return;

        const normalized = normalizeUrl(fullUrl);
        if (seen.has(normalized)) return;
        seen.add(normalized);

        const linkText = $(el).text().trim() || '';
        const fileType = classifyFileType(fullUrl);

        // PDF links are always documents
        if (fileType === 'pdf') {
            documents.push({
                url: fullUrl,
                title: linkText || fullUrl.split('/').pop()?.replace('.pdf', '') || 'Untitled',
                sourceHub: sourceUrl,
                fileType: 'pdf',
            });
            return;
        }

        // Relevant HTML pages
        if (isRelevantUrl(fullUrl)) {
            // Pages with pagination or listing indicators are likely hubs
            const isLikelyHub = fullUrl.includes('?page=') ||
                linkText.toLowerCase().includes('data set') ||
                linkText.toLowerCase().includes('view all') ||
                fullUrl.match(/\/(disclosures|releases|filings|documents)\/?$/);

            if (isLikelyHub) {
                hubs.push(fullUrl);
            } else {
                documents.push({
                    url: fullUrl,
                    title: linkText || 'Untitled Page',
                    sourceHub: sourceUrl,
                    fileType: 'html',
                });
            }
        }
    });

    // Also check for pagination links on the current hub
    $('a[href*="?page="]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        const fullUrl = href.startsWith('http') ? href : new URL(href, DOJ_BASE).toString();
        if (fullUrl.includes('justice.gov') && isRelevantUrl(fullUrl)) {
            hubs.push(fullUrl);
        }
    });

    return { documents, hubs };
}

/**
 * Detect the EFTA numbering pattern and infer remaining PDF URLs
 * for paginated data sets that block after a few pages.
 */
function inferEftaUrls(
    knownPdfs: DiscoveredUrl[],
    totalPages: number,
    perPage: number,
    sourceHub: string,
): DiscoveredUrl[] {
    const eftaNumbers: number[] = [];
    let baseUrlTemplate = '';

    for (const pdf of knownPdfs) {
        const match = pdf.url.match(/EFTA(\d+)\.pdf/);
        if (match) {
            eftaNumbers.push(parseInt(match[1], 10));
            if (!baseUrlTemplate) {
                baseUrlTemplate = pdf.url.replace(/EFTA\d+\.pdf/, 'EFTA{NUM}.pdf');
            }
        }
    }

    if (eftaNumbers.length < 2 || !baseUrlTemplate) return [];

    eftaNumbers.sort((a, b) => a - b);
    const startNum = eftaNumbers[0];
    const endOfKnown = eftaNumbers[eftaNumbers.length - 1];
    const totalEstimatedDocs = totalPages * perPage;
    const endNum = startNum + totalEstimatedDocs - 1;

    const inferred: DiscoveredUrl[] = [];
    for (let num = endOfKnown + 1; num <= endNum; num++) {
        const paddedNum = String(num).padStart(8, '0');
        const url = baseUrlTemplate.replace('{NUM}', paddedNum);
        inferred.push({
            url,
            title: `EFTA${paddedNum}`,
            sourceHub,
            fileType: 'pdf',
        });
    }

    return inferred;
}

function detectTotalPages(html: string): number {
    const $ = cheerio.load(html);
    let totalPages = 1;

    const lastLink = $('a[title="Go to last page"]').attr('href') ||
        $('li.pager__item--last a').attr('href');
    if (lastLink) {
        const match = lastLink.match(/[?&]page=(\d+)/);
        if (match) return parseInt(match[1], 10) + 1;
    }

    $('a[href*="?page="]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const match = href.match(/[?&]page=(\d+)/);
        if (match) {
            const pageNum = parseInt(match[1], 10) + 1;
            if (pageNum > totalPages) totalPages = pageNum;
        }
    });

    return totalPages;
}

export interface HubCrawlResult {
    documents: DiscoveredUrl[];
    hubsCrawled: number;
    errors: number;
}

/**
 * Crawl all known hub pages + discovered hubs (bounded BFS).
 * Returns discovered document URLs without downloading any content.
 */
export async function crawlHubPages(options?: {
    maxHubs?: number;
    maxPagesPerHub?: number;
    delayMs?: number;
}): Promise<HubCrawlResult> {
    const maxHubs = options?.maxHubs ?? 50;
    const maxPagesPerHub = options?.maxPagesPerHub ?? 4;
    const delayMs = options?.delayMs ?? 3000;

    const allDocuments: DiscoveredUrl[] = [];
    const seenUrls = new Set<string>();
    const hubQueue = [...SEED_HUBS];
    const visitedHubs = new Set<string>();
    let errors = 0;

    await logJob('DISCOVERY-HUB', 'INFO', `Starting hub crawl with ${SEED_HUBS.length} seed URLs`);

    while (hubQueue.length > 0 && visitedHubs.size < maxHubs) {
        const hubUrl = hubQueue.shift()!;
        const normalizedHub = normalizeUrl(hubUrl);

        if (visitedHubs.has(normalizedHub)) continue;
        visitedHubs.add(normalizedHub);

        // Delay between hub requests
        if (visitedHubs.size > 1) {
            await new Promise(r => setTimeout(r, delayMs));
        }

        const html = await fetchPage(hubUrl);
        if (!html) {
            errors++;
            continue;
        }

        const { documents, hubs } = extractLinks(html, hubUrl);
        const totalPages = detectTotalPages(html);

        // Add new documents
        for (const doc of documents) {
            const normalized = normalizeUrl(doc.url);
            if (!seenUrls.has(normalized)) {
                seenUrls.add(normalized);
                allDocuments.push(doc);
            }
        }

        // Add discovered hubs to queue
        for (const hub of hubs) {
            const normalizedNewHub = normalizeUrl(hub);
            if (!visitedHubs.has(normalizedNewHub)) {
                hubQueue.push(hub);
            }
        }

        // For data-set pages, try EFTA inference if we can't paginate fully
        if (hubUrl.includes('data-set-') && hubUrl.includes('-files')) {
            const pdfDocs = documents.filter(d => d.fileType === 'pdf');
            const perPage = pdfDocs.length || 50;

            // Try to scrape a few extra pages
            const extraPdfs: DiscoveredUrl[] = [];
            const extraPages = Math.min(totalPages - 1, maxPagesPerHub - 1);

            for (let page = 1; page <= extraPages; page++) {
                await new Promise(r => setTimeout(r, delayMs));
                const pageUrl = `${hubUrl}?page=${page}`;
                const pageHtml = await fetchPage(pageUrl);
                if (!pageHtml) {
                    // Rate-limited, switch to inference
                    break;
                }
                const pageLinks = extractLinks(pageHtml, hubUrl);
                for (const doc of pageLinks.documents) {
                    const normalized = normalizeUrl(doc.url);
                    if (!seenUrls.has(normalized)) {
                        seenUrls.add(normalized);
                        extraPdfs.push(doc);
                        allDocuments.push(doc);
                    }
                }
            }

            // Infer remaining EFTA URLs
            const allKnownPdfs = [...pdfDocs, ...extraPdfs];
            const inferred = inferEftaUrls(allKnownPdfs, totalPages, perPage, hubUrl);
            for (const doc of inferred) {
                const normalized = normalizeUrl(doc.url);
                if (!seenUrls.has(normalized)) {
                    seenUrls.add(normalized);
                    allDocuments.push(doc);
                }
            }
        }

        await logJob('DISCOVERY-HUB', 'INFO',
            `Hub ${visitedHubs.size}/${maxHubs}: ${hubUrl} → ${documents.length} docs found`);
    }

    await logJob('DISCOVERY-HUB', 'INFO',
        `Hub crawl complete. ${visitedHubs.size} hubs crawled, ${allDocuments.length} documents discovered, ${errors} errors`);

    return {
        documents: allDocuments,
        hubsCrawled: visitedHubs.size,
        errors,
    };
}
