"use client";
import { useState, useEffect, useRef } from 'react';
import { TelemetryConsole } from '@/components/TelemetryConsole';
import { Database, BookOpen, Shield, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';

type JobStatus = 'idle' | 'running' | 'success' | 'error';

interface JobState {
    status: JobStatus;
    message: string;
    startedAt: number | null;
    elapsed: number;
    details?: {
        billsProcessed?: number;
        versionsCreated?: number;
        textsDownloaded?: number;
        summariesQueued?: number;
        totalFound?: number;
        totalQueued?: number;
        totalSkipped?: number;
    };
}

const initialJobState: JobState = {
    status: 'idle',
    message: '',
    startedAt: null,
    elapsed: 0,
};

function formatElapsed(ms: number): string {
    const secs = Math.floor(ms / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins}m ${rem}s`;
}

function StatusIcon({ status }: { status: JobStatus }) {
    switch (status) {
        case 'running':
            return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
        case 'success':
            return <CheckCircle2 className="w-4 h-4 text-green-500" />;
        case 'error':
            return <XCircle className="w-4 h-4 text-red-500" />;
        default:
            return null;
    }
}

function ProgressBar({ active }: { active: boolean }) {
    if (!active) return null;
    return (
        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mt-3">
            <div className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500 rounded-full animate-[shimmer_1.5s_ease-in-out_infinite] bg-[length:200%_100%]" />
            <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
        </div>
    );
}

export default function AdminDashboard() {
    const [ingest, setIngest] = useState<JobState>(initialJobState);
    const [scrape, setScrape] = useState<JobState>(initialJobState);
    const ingestTimer = useRef<NodeJS.Timeout | null>(null);
    const scrapeTimer = useRef<NodeJS.Timeout | null>(null);

    // Elapsed-time ticker
    useEffect(() => {
        const tick = setInterval(() => {
            setIngest(prev => prev.status === 'running' && prev.startedAt
                ? { ...prev, elapsed: Date.now() - prev.startedAt }
                : prev
            );
            setScrape(prev => prev.status === 'running' && prev.startedAt
                ? { ...prev, elapsed: Date.now() - prev.startedAt }
                : prev
            );
        }, 1000);
        return () => clearInterval(tick);
    }, []);

    // Auto-clear success/error after 30s
    useEffect(() => {
        if (ingest.status === 'success' || ingest.status === 'error') {
            ingestTimer.current = setTimeout(() => setIngest(initialJobState), 30000);
            return () => { if (ingestTimer.current) clearTimeout(ingestTimer.current); };
        }
    }, [ingest.status]);

    useEffect(() => {
        if (scrape.status === 'success' || scrape.status === 'error') {
            scrapeTimer.current = setTimeout(() => setScrape(initialJobState), 30000);
            return () => { if (scrapeTimer.current) clearTimeout(scrapeTimer.current); };
        }
    }, [scrape.status]);

    const triggerIngest = async () => {
        setIngest({ status: 'running', message: 'Fetching bills from Congress.gov...', startedAt: Date.now(), elapsed: 0 });
        try {
            const res = await fetch('/api/admin/ingest', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                setIngest({
                    status: 'success',
                    message: data.message || 'Ingestion complete.',
                    startedAt: null,
                    elapsed: 0,
                    details: {
                        billsProcessed: data.billsProcessed,
                        versionsCreated: data.versionsCreated,
                        textsDownloaded: data.textsDownloaded,
                        summariesQueued: data.summariesQueued,
                    },
                });
            } else {
                setIngest({ status: 'error', message: data.error || 'Ingestion failed.', startedAt: null, elapsed: 0 });
            }
        } catch {
            setIngest({ status: 'error', message: 'Network error — could not reach server.', startedAt: null, elapsed: 0 });
        }
    };

    const triggerEpsteinScrape = async () => {
        setScrape({ status: 'running', message: 'Scraping DOJ document pages...', startedAt: Date.now(), elapsed: 0 });
        try {
            const res = await fetch('/api/admin/epstein-scrape', { method: 'POST' });
            const data = await res.json();
            if (data.success !== false) {
                setScrape({
                    status: 'success',
                    message: data.message || 'Scrape complete.',
                    startedAt: null,
                    elapsed: 0,
                    details: {
                        totalFound: data.totalFound,
                        totalQueued: data.totalQueued,
                        totalSkipped: data.totalSkipped,
                    },
                });
            } else {
                setScrape({ status: 'error', message: data.error || 'Scrape failed.', startedAt: null, elapsed: 0 });
            }
        } catch {
            setScrape({ status: 'error', message: 'Network error — could not reach server.', startedAt: null, elapsed: 0 });
        }
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">Admin Dashboard</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Bill Ingestion */}
                <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <Database className="w-5 h-5 text-blue-600" />
                        <h2 className="font-semibold">Bill Ingestion</h2>
                    </div>
                    <p className="text-sm text-slate-500 mb-4">
                        Fetch and process recent bills from Congress.gov
                    </p>
                    <button
                        onClick={triggerIngest}
                        disabled={ingest.status === 'running'}
                        className="w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                        {ingest.status === 'running' ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Running...
                            </>
                        ) : (
                            'Trigger Ingestion'
                        )}
                    </button>

                    <ProgressBar active={ingest.status === 'running'} />

                    {/* Status Display */}
                    {ingest.status !== 'idle' && (
                        <div className={`mt-3 p-3 rounded-lg text-xs ${
                            ingest.status === 'running' ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' :
                            ingest.status === 'success' ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' :
                            'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                        }`}>
                            <div className="flex items-start gap-2">
                                <StatusIcon status={ingest.status} />
                                <div className="flex-1 min-w-0">
                                    <p className={`font-medium ${
                                        ingest.status === 'running' ? 'text-blue-700 dark:text-blue-300' :
                                        ingest.status === 'success' ? 'text-green-700 dark:text-green-300' :
                                        'text-red-700 dark:text-red-300'
                                    }`}>
                                        {ingest.message}
                                    </p>
                                    {ingest.status === 'running' && (
                                        <p className="text-slate-500 mt-1 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            Elapsed: {formatElapsed(ingest.elapsed)}
                                        </p>
                                    )}
                                    {ingest.status === 'success' && ingest.details && (
                                        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-slate-600 dark:text-slate-400">
                                            {ingest.details.billsProcessed !== undefined && (
                                                <span>Bills: <strong>{ingest.details.billsProcessed}</strong></span>
                                            )}
                                            {ingest.details.versionsCreated !== undefined && (
                                                <span>Versions: <strong>{ingest.details.versionsCreated}</strong></span>
                                            )}
                                            {ingest.details.textsDownloaded !== undefined && (
                                                <span>Texts: <strong>{ingest.details.textsDownloaded}</strong></span>
                                            )}
                                            {ingest.details.summariesQueued !== undefined && (
                                                <span>Summaries: <strong>{ingest.details.summariesQueued}</strong></span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Epstein Files Scraper */}
                <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <BookOpen className="w-5 h-5 text-slate-600" />
                        <h2 className="font-semibold">Epstein Files</h2>
                    </div>
                    <p className="text-sm text-slate-500 mb-4">
                        Scrape and index DOJ documents for full-text search
                    </p>
                    <button
                        onClick={triggerEpsteinScrape}
                        disabled={scrape.status === 'running'}
                        className="w-full px-4 py-2.5 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 dark:bg-slate-700 dark:hover:bg-slate-600"
                    >
                        {scrape.status === 'running' ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Scraping...
                            </>
                        ) : (
                            'Trigger DOJ Scrape'
                        )}
                    </button>

                    <ProgressBar active={scrape.status === 'running'} />

                    {scrape.status !== 'idle' && (
                        <div className={`mt-3 p-3 rounded-lg text-xs ${
                            scrape.status === 'running' ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' :
                            scrape.status === 'success' ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' :
                            'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                        }`}>
                            <div className="flex items-start gap-2">
                                <StatusIcon status={scrape.status} />
                                <div className="flex-1 min-w-0">
                                    <p className={`font-medium ${
                                        scrape.status === 'running' ? 'text-blue-700 dark:text-blue-300' :
                                        scrape.status === 'success' ? 'text-green-700 dark:text-green-300' :
                                        'text-red-700 dark:text-red-300'
                                    }`}>
                                        {scrape.message}
                                    </p>
                                    {scrape.status === 'running' && (
                                        <p className="text-slate-500 mt-1 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            Elapsed: {formatElapsed(scrape.elapsed)}
                                        </p>
                                    )}
                                    {scrape.status === 'success' && scrape.details && (
                                        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-slate-600 dark:text-slate-400">
                                            {scrape.details.totalFound !== undefined && (
                                                <span>Found: <strong>{scrape.details.totalFound}</strong></span>
                                            )}
                                            {scrape.details.totalQueued !== undefined && (
                                                <span>New: <strong>{scrape.details.totalQueued}</strong></span>
                                            )}
                                            {scrape.details.totalSkipped !== undefined && (
                                                <span>Skipped: <strong>{scrape.details.totalSkipped}</strong></span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Claim Check Status */}
                <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <Shield className="w-5 h-5 text-indigo-600" />
                        <h2 className="font-semibold">Fact Checks</h2>
                    </div>
                    <p className="text-sm text-slate-500 mb-4">
                        Claims are processed automatically when submitted by users
                    </p>
                    <a
                        href="/claims"
                        className="block w-full px-4 py-2.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 text-center transition-colors"
                    >
                        View Claims
                    </a>
                </div>
            </div>

            {/* Live Telemetry - real-time logs from backend */}
            <TelemetryConsole />
        </div>
    );
}
