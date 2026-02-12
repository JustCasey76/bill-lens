import axios from 'axios';
import { PDFParse } from 'pdf-parse';
import * as cheerio from 'cheerio';
import { epsteinDocuments } from '@/lib/db';
import { logJob } from '@/lib/logger';
import { hashBuffer, hashText, normalizeUrl } from './discovery/normalize-url';

/**
 * Document extraction pipeline.
 *
 * Downloads content into memory, extracts text, computes hashes,
 * then immediately discards the binary buffer. No files are ever
 * written to disk or uploaded to storage.
 *
 * Supports:
 * - Conditional fetch via ETag/Last-Modified (skip unchanged docs)
 * - PDF text extraction with quality scoring
 * - HTML boilerplate removal
 * - OCR flagging for scanned PDFs (extraction deferred to external service)
 */

const FETCH_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': '*/*',
};

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB hard limit
const FETCH_TIMEOUT = 90000;
const MIN_QUALITY_THRESHOLD = 50; // chars per page — below this, flag for OCR

interface FetchResult {
    buffer: Buffer;
    contentType: string;
    etag?: string;
    lastModified?: string;
    statusCode: number;
}

/**
 * Fetch content into memory with conditional request support.
 * Returns null if the content hasn't changed (304).
 */
async function fetchWithConditional(
    url: string,
    existingEtag?: string | null,
    existingLastModified?: string | null,
): Promise<FetchResult | null> {
    const headers: Record<string, string> = { ...FETCH_HEADERS };

    if (existingEtag) headers['If-None-Match'] = existingEtag;
    if (existingLastModified) headers['If-Modified-Since'] = existingLastModified;

    const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: FETCH_TIMEOUT,
        maxContentLength: MAX_BYTES,
        maxBodyLength: MAX_BYTES,
        headers,
        validateStatus: (status) => status < 500,
    });

    if (response.status === 304) return null;

    if (response.status === 403 || response.status === 429) {
        throw new Error(`Rate limited (${response.status}) fetching ${url}`);
    }

    if (response.status !== 200) {
        throw new Error(`HTTP ${response.status} fetching ${url}`);
    }

    return {
        buffer: Buffer.from(response.data),
        contentType: response.headers['content-type'] || '',
        etag: response.headers['etag'] || undefined,
        lastModified: response.headers['last-modified'] || undefined,
        statusCode: response.status,
    };
}

/**
 * Extract text from a PDF buffer (in-memory, no file I/O).
 */
async function extractPdfText(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
    try {
        const parser = new PDFParse({ data: new Uint8Array(buffer), verbosity: 0 });
        const result = await parser.getText();
        const text = result.text;
        const pageCount = result.total;
        await parser.destroy();
        return { text, pageCount };
    } catch {
        return { text: '', pageCount: 0 };
    }
}

/**
 * Extract main content text from HTML, stripping boilerplate.
 */
function extractHtmlText(html: string): { text: string; title: string } {
    const $ = cheerio.load(html);

    $('script, style, nav, footer, header, .menu, .sidebar, .breadcrumb, .pager, #skip-link, .usa-banner').remove();

    const contentSelectors = [
        'article',
        '.field--name-body',
        '.node__content',
        '.field-content',
        '.node-content',
        '[role="main"]',
        'main',
        '#content',
        '.content',
    ];

    let mainText = '';
    for (const selector of contentSelectors) {
        const el = $(selector);
        if (el.length > 0 && el.text().trim().length > 100) {
            mainText = el.text();
            break;
        }
    }

    if (!mainText) {
        mainText = $('body').text();
    }

    mainText = mainText
        .replace(/\s+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    const title = $('title').text().trim() || $('h1').first().text().trim() || '';

    return { text: mainText, title };
}

/**
 * Compute extraction quality score.
 */
function computeQuality(text: string, pageCount: number, fileType: string): {
    quality: number;
    needsOcr: boolean;
} {
    if (fileType !== 'pdf' || pageCount === 0) {
        return { quality: text.length > 0 ? 100 : 0, needsOcr: false };
    }

    const charsPerPage = text.length / pageCount;
    return {
        quality: Math.round(charsPerPage * 100) / 100,
        needsOcr: charsPerPage < MIN_QUALITY_THRESHOLD,
    };
}

/**
 * Process a single document: fetch into memory, extract text, compute hashes,
 * discard binary buffer. No files are persisted.
 */
export async function processEpsteinDocument(url: string, title: string) {
    await logJob('EPSTEIN-PROCESS', 'INFO', `Processing: ${title}`);

    try {
        // Look up existing record for conditional fetch data
        const existing = await epsteinDocuments.findBySourceUrl(url);

        // Mark as processing (upsert)
        await epsteinDocuments.upsertBySourceUrl(
            url,
            { status: 'processing' },
            {
                title,
                sourceUrl: url,
                canonicalUrl: normalizeUrl(url),
                fileType: 'pdf',
                status: 'processing',
            },
        );

        // Fetch into memory with conditional request support
        const fetchResult = await fetchWithConditional(
            url,
            existing?.httpEtag,
            existing?.httpLastModified,
        );

        // 304 Not Modified — no re-extraction needed
        if (!fetchResult) {
            const doc = await epsteinDocuments.findBySourceUrl(url);
            if (doc) {
                await epsteinDocuments.update(doc.id, {
                    status: existing?.status === 'indexed' ? 'indexed' : existing?.status || 'pending',
                    lastFetchedAt: new Date(),
                });
            }
            await logJob('EPSTEIN-PROCESS', 'INFO', `Unchanged (304): ${title}`);
            return;
        }

        const { buffer, contentType, etag, lastModified } = fetchResult;

        // Compute byte hash before any processing
        const byteHashValue = hashBuffer(buffer);

        // Check if content changed by comparing byte hashes
        if (existing?.byteHash === byteHashValue && existing?.status === 'indexed') {
            await epsteinDocuments.update(existing.id, {
                status: 'indexed',
                lastFetchedAt: new Date(),
                httpEtag: etag || existing.httpEtag,
                httpLastModified: lastModified || existing.httpLastModified,
            });
            await logJob('EPSTEIN-PROCESS', 'INFO', `Content unchanged (hash match): ${title}`);
            return;
        }

        // Detect content type and extract text
        const isPdf = contentType.includes('pdf') || url.toLowerCase().endsWith('.pdf');
        const isHtml = contentType.includes('html') || contentType.includes('xhtml');

        let rawText = '';
        let pageCount = 0;
        let extractedTitle = title;
        let fileType = 'pdf';

        if (isPdf) {
            const result = await extractPdfText(buffer);
            rawText = result.text;
            pageCount = result.pageCount;
            fileType = 'pdf';
        } else if (isHtml) {
            const result = extractHtmlText(buffer.toString('utf-8'));
            rawText = result.text;
            extractedTitle = result.title || title;
            fileType = 'html';
            pageCount = 1;
        } else {
            rawText = '';
            await logJob('EPSTEIN-PROCESS', 'INFO', `Unsupported content type ${contentType} for: ${title}`);
        }

        // Compute text hash and quality
        const textHashValue = rawText ? hashText(rawText) : null;
        const { quality, needsOcr } = computeQuality(rawText, pageCount, fileType);

        // Determine final status
        let status: string;
        if (needsOcr) {
            status = 'needs_ocr';
        } else if (rawText && rawText.length > 50) {
            status = 'indexed';
        } else {
            status = 'error';
        }

        // Persist extracted text + metadata (no binary storage)
        const doc = await epsteinDocuments.findBySourceUrl(url);
        if (doc) {
            await epsteinDocuments.update(doc.id, {
                title: extractedTitle,
                rawText: rawText || '[No text extracted]',
                pageCount,
                lengthChars: rawText.length,
                fileType,
                contentType,
                byteHash: byteHashValue,
                textHash: textHashValue,
                httpEtag: etag || null,
                httpLastModified: lastModified || null,
                lastFetchedAt: new Date(),
                extractionQuality: quality,
                ocrRequired: needsOcr,
                status,
                canonicalUrl: normalizeUrl(url),
            });
        }

        await logJob('EPSTEIN-PROCESS', 'SUCCESS',
            `Indexed: ${extractedTitle} (${pageCount} pages, ${rawText.length} chars, quality: ${quality}${needsOcr ? ', NEEDS OCR' : ''})`);

    } catch (err: any) {
        await logJob('EPSTEIN-PROCESS', 'ERROR', { message: `Failed: ${title}`, error: err.message });

        await epsteinDocuments.upsertBySourceUrl(
            url,
            { status: 'error' },
            {
                title,
                sourceUrl: url,
                canonicalUrl: normalizeUrl(url),
                status: 'error',
            },
        );
    }
}

/**
 * Process all pending documents in batches.
 */
export async function processAllPending(options?: {
    batchSize?: number;
    delayMs?: number;
    maxDocuments?: number;
}): Promise<{ processed: number; errors: number }> {
    const batchSize = options?.batchSize ?? 10;
    const delayMs = options?.delayMs ?? 2000;
    const maxDocuments = options?.maxDocuments ?? 500;

    const pending = await epsteinDocuments.findMany({
        where: { status: { in: ['pending', 'needs_ocr'] } },
        orderBy: { field: 'createdAt', direction: 'asc' },
        take: maxDocuments,
        select: ['sourceUrl', 'title'],
    });

    await logJob('EPSTEIN-BATCH', 'INFO', `Processing ${pending.length} pending documents`);

    let processed = 0;
    let errors = 0;

    for (let i = 0; i < pending.length; i++) {
        const doc = pending[i];

        try {
            await processEpsteinDocument(doc.sourceUrl, doc.title);
            processed++;
        } catch {
            errors++;
        }

        if (i < pending.length - 1) {
            await new Promise(r => setTimeout(r, delayMs));
        }

        if ((i + 1) % batchSize === 0) {
            await logJob('EPSTEIN-BATCH', 'INFO', `Progress: ${i + 1}/${pending.length} (${errors} errors)`);
        }
    }

    await logJob('EPSTEIN-BATCH', 'SUCCESS', `Batch complete: ${processed} processed, ${errors} errors`);
    return { processed, errors };
}
