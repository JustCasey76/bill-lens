import * as cheerio from 'cheerio';
import {
    fetchRecentBills,
    fetchBillDetails,
    fetchBillTextVersions,
    fetchBillTextContent,
    fetchBillActions,
    rateLimitDelay,
} from '@/lib/congress-api';
import { summaryQueue } from '@/lib/queue';
import { bills, billVersions, billActions } from '@/lib/db';
import { logJob } from '@/lib/logger';

/**
 * Bill ingestion pipeline.
 *
 * Fetches recent bills from Congress.gov API v3, retrieves full details
 * (sponsors, policy area, actions), downloads actual bill text from
 * congress.gov file URLs, and stores everything in Firestore.
 *
 * Key behaviors:
 * - Actually fetches bill text (not placeholder strings)
 * - Parses XML/HTML to extract clean text
 * - Normalizes bill type to lowercase (API returns uppercase "HR", "S")
 * - Fetches bill details for sponsor, policy area, chamber
 * - Ingests legislative actions timeline
 * - Maps version.type (e.g., "Introduced in House") as the version code
 */

/**
 * Extract clean text content from bill XML or HTML.
 * Congress.gov serves bills as XML (preferred) or HTML.
 */
function extractBillText(raw: string, format: string): string {
    const $ = cheerio.load(raw, {
        xmlMode: format === 'Formatted XML',
    });

    if (format === 'Formatted XML') {
        $('metadata, form, attestation, endorsement').remove();

        const bodySelectors = [
            'legis-body',
            'resolution-body',
            'amendment-body',
            'engrossed-amendment-body',
        ];

        for (const selector of bodySelectors) {
            const el = $(selector);
            if (el.length > 0 && el.text().trim().length > 50) {
                return cleanText(el.text());
            }
        }

        return cleanText($.root().text());
    }

    $('script, style, nav, footer, header, .breadcrumb, #header, #footer, .top-wrapper').remove();

    const contentSelectors = [
        '.generated-html-container',
        '#content',
        'main',
        'article',
        'body',
    ];

    for (const selector of contentSelectors) {
        const el = $(selector);
        if (el.length > 0 && el.text().trim().length > 100) {
            return cleanText(el.text());
        }
    }

    return cleanText($.root().text());
}

function cleanText(text: string): string {
    return text
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/^\s+|\s+$/gm, '')
        .trim();
}

/**
 * Map a text version type string to a short code for storage.
 */
function versionTypeToCode(versionType: string): string {
    const typeMap: Record<string, string> = {
        'Introduced in House': 'ih',
        'Introduced in Senate': 'is',
        'Reported in House': 'rh',
        'Reported in Senate': 'rs',
        'Engrossed in House': 'eh',
        'Engrossed in Senate': 'es',
        'Enrolled Bill': 'enr',
        'Enrolled as Agreed': 'eas',
        'Public Print': 'pp',
        'Placed on Calendar Senate': 'pcs',
        'Placed on Calendar House': 'pch',
        'Referred in Senate': 'rfs',
        'Referred in House': 'rfh',
        'Received in House': 'rdh',
        'Received in Senate': 'rds',
        'Conference Report': 'cph',
        'Amendment in Senate': 'as',
    };

    return typeMap[versionType] || versionType.toLowerCase().replace(/\s+/g, '_').substring(0, 20);
}

export interface IngestResult {
    billsProcessed: number;
    versionsCreated: number;
    actionsCreated: number;
    textsDownloaded: number;
    summariesQueued: number;
    errors: string[];
}

/**
 * Main ingestion pipeline. Fetches recent bills and processes them fully.
 */
export async function ingestRecentBills(limit = 20): Promise<IngestResult> {
    const result: IngestResult = {
        billsProcessed: 0,
        versionsCreated: 0,
        actionsCreated: 0,
        textsDownloaded: 0,
        summariesQueued: 0,
        errors: [],
    };

    await logJob('INGESTION', 'INFO', 'Starting bill ingestion...');

    if (!process.env.CONGRESS_GOV_API_KEY) {
        await logJob('INGESTION', 'ERROR', 'Missing CONGRESS_GOV_API_KEY');
        result.errors.push('Missing CONGRESS_GOV_API_KEY');
        return result;
    }

    // 1. Fetch recent bills list
    let apiBills;
    try {
        apiBills = await fetchRecentBills(limit);
    } catch (err: any) {
        await logJob('INGESTION', 'ERROR', { message: 'Failed to fetch recent bills', error: err.message });
        result.errors.push(`Fetch failed: ${err.message}`);
        return result;
    }

    if (!apiBills || apiBills.length === 0) {
        await logJob('INGESTION', 'INFO', 'No recent bills found from API.');
        return result;
    }

    await logJob('INGESTION', 'INFO', `Found ${apiBills.length} recent bills. Processing...`);

    for (const b of apiBills) {
        const billType = b.type.toLowerCase(); // API returns "HR" → we store "hr"
        const billLabel = `${b.type}${b.number} (${b.congress}th)`;

        try {
            // 2. Fetch full bill details (sponsors, policy area, etc.)
            await rateLimitDelay();
            const details = await fetchBillDetails(b.congress, billType, b.number);

            const sponsor = details?.sponsors?.[0];
            const policyArea = details?.policyArea?.name || null;
            const introDate = details?.introducedDate
                ? new Date(details.introducedDate)
                : new Date(b.updateDate);

            // Build congress.gov URL
            const chamberSlug = (b.originChamber || 'House').toLowerCase();
            const typeSlug = chamberSlug === 'senate' ? 'senate-bill' : 'house-bill';
            const congressGovUrl = `https://www.congress.gov/bill/${b.congress}th-congress/${typeSlug}/${b.number}`;

            // Derive a meaningful status from latest action text
            const latestActionText = b.latestAction?.text || details?.latestAction?.text || null;
            const latestActionDate = b.latestAction?.actionDate || details?.latestAction?.actionDate;
            const status = deriveStatus(latestActionText);

            // 3. Upsert Bill record in Firestore
            const billRecord = await bills.upsert(
                { congress: b.congress, type: billType, number: b.number },
                {
                    title: b.title || undefined,
                    sponsor: sponsor?.fullName || undefined,
                    sponsorParty: sponsor?.party || undefined,
                    sponsorState: sponsor?.state || undefined,
                    policyArea,
                    originChamber: b.originChamber || undefined,
                    congressGovUrl,
                    status,
                    latestActionText,
                    latestActionDate: latestActionDate ? new Date(latestActionDate) : undefined,
                },
                {
                    title: b.title || 'Untitled Bill',
                    sponsor: sponsor?.fullName || null,
                    sponsorParty: sponsor?.party || null,
                    sponsorState: sponsor?.state || null,
                    policyArea,
                    originChamber: b.originChamber || null,
                    congressGovUrl,
                    status: status || 'Introduced',
                    introDate,
                    latestActionText,
                    latestActionDate: latestActionDate ? new Date(latestActionDate) : null,
                },
            );

            result.billsProcessed++;

            // 4. Fetch and ingest actions
            await rateLimitDelay();
            const actions = await fetchBillActions(b.congress, billType, b.number);

            if (actions && actions.length > 0) {
                for (const action of actions) {
                    const existingAction = await billActions.findFirst({
                        billId: billRecord.id,
                        date: new Date(action.actionDate),
                        text: action.text,
                    });

                    if (!existingAction) {
                        await billActions.create({
                            billId: billRecord.id,
                            date: new Date(action.actionDate),
                            text: action.text,
                            actionType: action.type || null,
                            chamber: action.sourceSystem?.name || null,
                        });
                        result.actionsCreated++;
                    }
                }
            }

            // 5. Fetch text versions and download actual text
            await rateLimitDelay();
            const textVersions = await fetchBillTextVersions(b.congress, billType, b.number);

            if (!textVersions || textVersions.length === 0) continue;

            for (const v of textVersions) {
                const code = versionTypeToCode(v.type);

                // Skip if we already have this version with real text
                const existing = await billVersions.findByBillAndCode(billRecord.id, code);
                if (existing?.fullText && existing.fullText.length > 100 && !existing.fullText.startsWith('[')) {
                    continue;
                }

                // Download actual bill text from congress.gov
                if (!v.formats || v.formats.length === 0) continue;

                await rateLimitDelay(500);
                const textContent = await fetchBillTextContent(v.formats);

                let fullText = '';
                let textUrl = '';

                if (textContent) {
                    fullText = extractBillText(textContent.text, textContent.format);
                    textUrl = textContent.url;
                    result.textsDownloaded++;
                }

                const pdfFormat = v.formats.find(f => f.type === 'PDF');
                const displayUrl = textUrl || pdfFormat?.url || '';

                if (existing) {
                    await billVersions.update(existing.id, {
                        fullText: fullText || existing.fullText || 'No text available',
                        textUrl: displayUrl || existing.textUrl,
                        date: v.date ? new Date(v.date) : existing.date,
                    });

                    if (fullText.length > 200 && !existing.summary) {
                        await summaryQueue.add('summarize', { versionId: existing.id });
                        result.summariesQueued++;
                    }
                } else {
                    const newVersion = await billVersions.create({
                        billId: billRecord.id,
                        code,
                        date: v.date ? new Date(v.date) : new Date(),
                        fullText: fullText || 'No text available',
                        textUrl: displayUrl,
                        sections: null,
                        summary: null,
                        diffAnalysis: null,
                    });
                    result.versionsCreated++;

                    if (fullText.length > 200) {
                        await summaryQueue.add('summarize', { versionId: newVersion.id });
                        result.summariesQueued++;
                        await logJob('INGESTION', 'INFO', `Queued summary for ${billLabel} v.${code}`);
                    }
                }
            }
        } catch (err: any) {
            const msg = `Error processing ${billLabel}: ${err.message}`;
            result.errors.push(msg);
            await logJob('INGESTION', 'ERROR', msg);
        }
    }

    await logJob('INGESTION', 'SUCCESS', {
        message: 'Ingestion complete.',
        ...result,
    });

    return result;
}

/**
 * Derive a human-readable bill status from the latest action text.
 */
function deriveStatus(actionText: string | null | undefined): string {
    if (!actionText) return 'Introduced';

    const lower = actionText.toLowerCase();

    if (lower.includes('became public law') || lower.includes('became law')) return 'Enacted';
    if (lower.includes('signed by president') || lower.includes('signed by the president')) return 'Signed by President';
    if (lower.includes('presented to president') || lower.includes('presented to the president')) return 'Presented to President';
    if (lower.includes('passed senate') || lower.includes('passed/agreed to in senate')) return 'Passed Senate';
    if (lower.includes('passed house') || lower.includes('passed/agreed to in house')) return 'Passed House';
    if (lower.includes('enrolled')) return 'Enrolled';
    if (lower.includes('conference report')) return 'In Conference';
    if (lower.includes('reported by') || lower.includes('ordered to be reported')) return 'Reported by Committee';
    if (lower.includes('referred to')) return 'Referred to Committee';
    if (lower.includes('introduced')) return 'Introduced';
    if (lower.includes('vetoed')) return 'Vetoed';

    return 'Updated';
}
