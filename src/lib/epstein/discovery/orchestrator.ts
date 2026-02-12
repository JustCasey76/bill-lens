import { epsteinDocuments, urlAliases, discoveryRuns } from '@/lib/db';
import { logJob } from '@/lib/logger';
import { normalizeUrl } from './normalize-url';
import { crawlHubPages, type DiscoveredUrl } from './hub-crawler';
import { discoverFromSitemaps } from './sitemap-parser';
import { discoverFromInternetArchive } from './ia-cdx';

/**
 * Discovery orchestrator.
 *
 * Runs all discovery sources in priority order, deduplicates URLs,
 * creates/updates EpsteinDocument records, and logs the run.
 *
 * No files are stored — only URLs and metadata.
 */

export type DiscoverySource = 'hub-scrape' | 'sitemap-parse' | 'ia-cdx' | 'all';

export interface DiscoveryOptions {
    sources?: DiscoverySource[];
    /** Max hub pages to crawl */
    maxHubs?: number;
    /** Delay between requests in ms */
    delayMs?: number;
}

interface DeduplicatedDoc {
    url: string;
    canonicalUrl: string;
    title: string;
    fileType: 'pdf' | 'html' | 'unknown';
    discoverySource: string;
    sourceHub: string;
}

export interface DiscoveryResult {
    runId: string;
    totalDiscovered: number;
    newDocuments: number;
    existingUpdated: number;
    aliasesCreated: number;
    errors: number;
    bySource: Record<string, number>;
}

/**
 * Deduplicate discovered URLs across all sources.
 */
function deduplicateUrls(
    allUrls: Array<DiscoveredUrl & { discoverySource: string }>
): DeduplicatedDoc[] {
    const byCanonical = new Map<string, DeduplicatedDoc>();

    for (const item of allUrls) {
        const canonical = normalizeUrl(item.url);
        if (!byCanonical.has(canonical)) {
            byCanonical.set(canonical, {
                url: item.url,
                canonicalUrl: canonical,
                title: item.title,
                fileType: item.fileType,
                discoverySource: item.discoverySource,
                sourceHub: item.sourceHub,
            });
        }
    }

    return Array.from(byCanonical.values());
}

/**
 * Persist discovered URLs to Firestore.
 */
async function persistDiscoveries(
    docs: DeduplicatedDoc[],
): Promise<{ newCount: number; updatedCount: number; aliasCount: number }> {
    let newCount = 0;
    let updatedCount = 0;
    let aliasCount = 0;

    for (const doc of docs) {
        // Check if we already have this document
        const existing = await epsteinDocuments.findByCanonicalUrlOrSourceUrl(
            doc.canonicalUrl,
            doc.url,
        );

        if (existing) {
            // Update last-seen in lineage
            const lineage = (existing.discoveryLineage as any[]) || [];
            const existingEntry = lineage.find(
                (e: any) => e.source === doc.discoverySource && e.sourceId === doc.sourceHub
            );

            if (existingEntry) {
                existingEntry.lastSeen = new Date().toISOString().split('T')[0];
            } else {
                lineage.push({
                    source: doc.discoverySource,
                    sourceId: doc.sourceHub,
                    firstSeen: new Date().toISOString().split('T')[0],
                    lastSeen: new Date().toISOString().split('T')[0],
                });
            }

            await epsteinDocuments.update(existing.id, {
                canonicalUrl: existing.canonicalUrl || doc.canonicalUrl,
                discoveryLineage: lineage,
            });
            updatedCount++;

            // Create alias if the source URL is different from existing
            if (doc.url !== existing.sourceUrl && doc.url !== existing.canonicalUrl) {
                try {
                    await urlAliases.upsert(doc.url, {
                        documentId: existing.id,
                        discoverySource: doc.discoverySource,
                    });
                    aliasCount++;
                } catch {
                    // Ignore errors
                }
            }
        } else {
            // Create new document record
            const documentType = doc.fileType === 'pdf'
                ? (doc.url.includes('EFTA') ? 'EFTA Disclosure' : 'Court Document')
                : 'Web Page';

            try {
                await epsteinDocuments.create({
                    title: doc.title,
                    sourceUrl: doc.url,
                    canonicalUrl: doc.canonicalUrl,
                    fileType: doc.fileType === 'unknown' ? 'pdf' : doc.fileType,
                    documentType,
                    status: 'pending',
                    discoveryLineage: [{
                        source: doc.discoverySource,
                        sourceId: doc.sourceHub,
                        firstSeen: new Date().toISOString().split('T')[0],
                        lastSeen: new Date().toISOString().split('T')[0],
                    }],
                });
                newCount++;
            } catch (err: any) {
                // Handle duplicate errors (race conditions)
                updatedCount++;
            }
        }
    }

    return { newCount, updatedCount, aliasCount };
}

/**
 * Run the full discovery pipeline.
 */
export async function runDiscovery(options?: DiscoveryOptions): Promise<DiscoveryResult> {
    const sources = options?.sources ?? ['all'];
    const runAll = sources.includes('all');

    // Create the discovery run record
    const run = await discoveryRuns.create({
        source: sources.join(','),
        config: options as any,
    });

    await logJob('DISCOVERY', 'INFO', `Starting discovery run ${run.id} with sources: ${sources.join(', ')}`);

    const allDiscovered: Array<DiscoveredUrl & { discoverySource: string }> = [];
    const bySource: Record<string, number> = {};
    let totalErrors = 0;

    // 1. Hub crawler (PRIMARY)
    if (runAll || sources.includes('hub-scrape')) {
        try {
            const hubResult = await crawlHubPages({
                maxHubs: options?.maxHubs,
                delayMs: options?.delayMs,
            });
            const tagged = hubResult.documents.map(d => ({ ...d, discoverySource: 'hub-scrape' as const }));
            allDiscovered.push(...tagged);
            bySource['hub-scrape'] = hubResult.documents.length;
            totalErrors += hubResult.errors;
        } catch (err: any) {
            await logJob('DISCOVERY', 'ERROR', `Hub crawler failed: ${err.message}`);
            totalErrors++;
        }
    }

    // 2. Sitemap parser (SECONDARY)
    if (runAll || sources.includes('sitemap-parse')) {
        try {
            const sitemapResult = await discoverFromSitemaps({
                delayMs: options?.delayMs,
            });
            const tagged = sitemapResult.documents.map(d => ({ ...d, discoverySource: 'sitemap-parse' as const }));
            allDiscovered.push(...tagged);
            bySource['sitemap-parse'] = sitemapResult.documents.length;
            totalErrors += sitemapResult.errors;
        } catch (err: any) {
            await logJob('DISCOVERY', 'ERROR', `Sitemap parser failed: ${err.message}`);
            totalErrors++;
        }
    }

    // 3. Internet Archive CDX (TERTIARY)
    if (runAll || sources.includes('ia-cdx')) {
        try {
            const iaResult = await discoverFromInternetArchive({
                delayMs: options?.delayMs,
            });
            const tagged = iaResult.documents.map(d => ({ ...d, discoverySource: 'ia-cdx' as const }));
            allDiscovered.push(...tagged);
            bySource['ia-cdx'] = iaResult.documents.length;
            totalErrors += iaResult.errors;
        } catch (err: any) {
            await logJob('DISCOVERY', 'ERROR', `IA CDX discovery failed: ${err.message}`);
            totalErrors++;
        }
    }

    // Deduplicate across all sources
    await logJob('DISCOVERY', 'INFO', `Total raw URLs: ${allDiscovered.length}. Deduplicating...`);
    const deduplicated = deduplicateUrls(allDiscovered);
    await logJob('DISCOVERY', 'INFO', `After dedup: ${deduplicated.length} unique URLs`);

    // Persist to database
    const { newCount, updatedCount, aliasCount } = await persistDiscoveries(deduplicated);

    // Complete the discovery run record
    await discoveryRuns.update(run.id, {
        urlsFound: deduplicated.length,
        urlsNew: newCount,
        urlsChanged: updatedCount,
        errors: totalErrors,
        completedAt: new Date(),
    });

    const result: DiscoveryResult = {
        runId: run.id,
        totalDiscovered: deduplicated.length,
        newDocuments: newCount,
        existingUpdated: updatedCount,
        aliasesCreated: aliasCount,
        errors: totalErrors,
        bySource,
    };

    await logJob('DISCOVERY', 'SUCCESS', result);
    return result;
}
