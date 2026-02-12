import axios from 'axios';
import * as cheerio from 'cheerio';
import { epsteinDocuments } from '@/lib/db';
import { logJob } from '@/lib/logger';

// The DOJ Epstein Library has 12 data sets, each with paginated PDF lists.
// The DOJ rate-limits paginated requests (403 after a few pages), so we:
//   1. Scrape page 1 of each data set to discover the URL pattern + file range
//   2. Infer remaining PDF URLs from the sequential EFTA numbering pattern
//   3. For non-EFTA patterns, scrape a few extra pages with long delays

const DOJ_BASE = 'https://www.justice.gov';
const DATA_SET_COUNT = 12;

function getDataSetUrl(setNum: number, page: number = 0): string {
    const base = `${DOJ_BASE}/epstein/doj-disclosures/data-set-${setNum}-files`;
    return page > 0 ? `${base}?page=${page}` : base;
}

async function fetchPage(url: string): Promise<string | null> {
    try {
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Referer': 'https://www.justice.gov/epstein/doj-disclosures',
            },
            timeout: 30000,
        });
        return data;
    } catch (err: any) {
        await logJob('EPSTEIN-SCRAPE', 'ERROR', `Failed to fetch ${url}: ${err.message}`);
        return null;
    }
}

function extractPdfLinks(html: string): { url: string; title: string }[] {
    const $ = cheerio.load(html);
    const links: { url: string; title: string }[] = [];

    $('a[href$=".pdf"]').each((_, el) => {
        const href = $(el).attr('href');
        const linkText = $(el).text().trim() || 'Untitled Document';
        if (href) {
            const fullUrl = href.startsWith('http') ? href : new URL(href, DOJ_BASE).toString();
            links.push({ url: fullUrl, title: linkText });
        }
    });

    return links;
}

function detectTotalPages(html: string): number {
    const $ = cheerio.load(html);
    let totalPages = 1;

    // Check "Last" link for exact page count
    const lastLink = $('a[title="Go to last page"]').attr('href') ||
        $('li.pager__item--last a').attr('href');
    if (lastLink) {
        const match = lastLink.match(/[?&]page=(\d+)/);
        if (match) return parseInt(match[1], 10) + 1;
    }

    // Fallback: find highest page number in pagination links
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

/**
 * Given PDFs from page 1, detect the EFTA numbering pattern and generate
 * URLs for all pages we can't scrape due to rate limiting.
 */
function inferRemainingPdfUrls(
    page1Pdfs: { url: string; title: string }[],
    totalPages: number,
    perPage: number,
    dataSetNum: number,
): { url: string; title: string }[] {
    // Extract EFTA numbers from the first page
    const eftaNumbers: number[] = [];
    let baseUrlTemplate = '';

    for (const pdf of page1Pdfs) {
        const match = pdf.url.match(/EFTA(\d+)\.pdf/);
        if (match) {
            eftaNumbers.push(parseInt(match[1], 10));
            if (!baseUrlTemplate) {
                baseUrlTemplate = pdf.url.replace(/EFTA\d+\.pdf/, 'EFTA{NUM}.pdf');
            }
        }
    }

    if (eftaNumbers.length < 2 || !baseUrlTemplate) {
        // Non-EFTA pattern, can't infer
        return [];
    }

    // Sort to find the range
    eftaNumbers.sort((a, b) => a - b);
    const startNum = eftaNumbers[0];
    const endOfPage1 = eftaNumbers[eftaNumbers.length - 1];
    const totalEstimatedDocs = totalPages * perPage;
    const endNum = startNum + totalEstimatedDocs - 1;

    const inferred: { url: string; title: string }[] = [];

    // Generate URLs for numbers beyond page 1
    for (let num = endOfPage1 + 1; num <= endNum; num++) {
        const paddedNum = String(num).padStart(8, '0');
        const url = baseUrlTemplate.replace('{NUM}', paddedNum);
        const filename = `EFTA${paddedNum}.pdf`;
        inferred.push({ url, title: filename.replace('.pdf', '') });
    }

    return inferred;
}

export async function scrapeEpsteinDocuments(options?: {
    dataSets?: number[];
    maxPagesPerSet?: number;
}) {
    const dataSets = options?.dataSets || Array.from({ length: DATA_SET_COUNT }, (_, i) => i + 1);

    await logJob('EPSTEIN-SCRAPE', 'INFO', `Starting scrape of ${dataSets.length} data sets`);

    let totalFound = 0;
    let totalQueued = 0;
    let totalSkipped = 0;

    for (const setNum of dataSets) {
        const setLabel = `Data Set ${setNum}`;

        // Step 1: Fetch page 1 to discover pattern and pagination
        const firstPageHtml = await fetchPage(getDataSetUrl(setNum));
        if (!firstPageHtml) {
            await logJob('EPSTEIN-SCRAPE', 'ERROR', `${setLabel}: Could not fetch page 1, skipping`);
            continue;
        }

        const page1Pdfs = extractPdfLinks(firstPageHtml);
        const totalPages = detectTotalPages(firstPageHtml);
        const perPage = page1Pdfs.length || 50;

        await logJob('EPSTEIN-SCRAPE', 'INFO',
            `${setLabel}: Found ${page1Pdfs.length} PDFs on page 1, ${totalPages} total pages (~${totalPages * perPage} docs)`);

        // Step 2: Try to scrape pages 2-4 with delays (these sometimes work)
        const additionalPdfs: { url: string; title: string }[] = [];
        const maxExtraPages = Math.min(totalPages - 1, 3); // Only try 3 extra pages

        for (let page = 1; page <= maxExtraPages; page++) {
            // 3-second delay between paginated requests
            await new Promise(r => setTimeout(r, 3000));

            const html = await fetchPage(getDataSetUrl(setNum, page));
            if (html) {
                const pdfs = extractPdfLinks(html);
                additionalPdfs.push(...pdfs);
                await logJob('EPSTEIN-SCRAPE', 'INFO', `${setLabel}: Page ${page + 1}: ${pdfs.length} PDFs`);
            } else {
                await logJob('EPSTEIN-SCRAPE', 'INFO', `${setLabel}: Page ${page + 1} blocked, switching to inference`);
                break;
            }
        }

        // Step 3: Infer remaining URLs from the EFTA numbering pattern
        const allScrapedPdfs = [...page1Pdfs, ...additionalPdfs];
        const inferredPdfs = inferRemainingPdfUrls(page1Pdfs, totalPages, perPage, setNum);

        await logJob('EPSTEIN-SCRAPE', 'INFO',
            `${setLabel}: Scraped ${allScrapedPdfs.length}, inferred ${inferredPdfs.length} additional URLs`);

        const allPdfs = [...allScrapedPdfs, ...inferredPdfs];
        totalFound += allPdfs.length;

        // Step 4: Create DB records for new documents
        for (const pdf of allPdfs) {
            const existing = await epsteinDocuments.findBySourceUrl(pdf.url);
            if (existing) {
                totalSkipped++;
                continue;
            }

            const filename = pdf.url.split('/').pop() || '';
            const documentType = filename.startsWith('EFTA') ? 'EFTA Disclosure' : 'Court Document';

            await epsteinDocuments.create({
                title: pdf.title || filename.replace('.pdf', ''),
                sourceUrl: pdf.url,
                fileType: 'pdf',
                documentType,
                status: 'pending',
            });
            totalQueued++;
        }

        await logJob('EPSTEIN-SCRAPE', 'INFO',
            `${setLabel}: Done — ${totalQueued} new, ${totalSkipped} skipped`);

        // 5-second delay between data sets
        if (setNum < dataSets[dataSets.length - 1]) {
            await new Promise(r => setTimeout(r, 5000));
        }
    }

    await logJob('EPSTEIN-SCRAPE', 'SUCCESS',
        `Scrape complete. Found ${totalFound} documents total, ${totalQueued} new, ${totalSkipped} already indexed.`);

    return { totalFound, totalQueued, totalSkipped };
}
