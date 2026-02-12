export { normalizeUrl, computeDocId, hashBuffer, hashText, resolveRedirects } from './normalize-url';
export { crawlHubPages, type DiscoveredUrl, type HubCrawlResult } from './hub-crawler';
export { discoverFromSitemaps, type SitemapResult } from './sitemap-parser';
export { discoverFromInternetArchive, type IaCdxResult } from './ia-cdx';
export { runDiscovery, type DiscoveryOptions, type DiscoveryResult, type DiscoverySource } from './orchestrator';
