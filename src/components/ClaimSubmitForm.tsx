"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Send, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export function ClaimSubmitForm() {
    const router = useRouter();
    const [content, setContent] = useState('');
    const [sourceUrl, setSourceUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ type: 'success' | 'error'; message: string; claimId?: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim() || content.length < 10) return;

        setLoading(true);
        setResult(null);

        try {
            const res = await fetch('/api/claims', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: content.trim(),
                    sourceUrl: sourceUrl.trim() || undefined,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setResult({ type: 'error', message: data.error?.[0]?.message || 'Failed to submit claim' });
                return;
            }

            setResult({
                type: 'success',
                message: 'Claim submitted! Fact-checking in progress...',
                claimId: data.claim.id,
            });
            setContent('');
            setSourceUrl('');

            // Poll for completion then redirect
            if (data.claim.id) {
                pollForResult(data.claim.id);
            }
        } catch {
            setResult({ type: 'error', message: 'Network error. Please try again.' });
        } finally {
            setLoading(false);
        }
    };

    const pollForResult = async (claimId: string) => {
        let attempts = 0;
        const maxAttempts = 40; // ~2 minutes at 3s intervals
        const interval = setInterval(async () => {
            attempts++;
            try {
                const res = await fetch(`/api/claims/${claimId}`);
                const data = await res.json();
                if (data.claim?.status === 'checked') {
                    clearInterval(interval);
                    router.push(`/claim/${claimId}`);
                } else if (data.claim?.status === 'error' || attempts >= maxAttempts) {
                    clearInterval(interval);
                    if (data.claim?.status === 'error') {
                        setResult({ type: 'error', message: 'Fact-check failed. Please try again.' });
                    } else {
                        // Still pending after max attempts -- redirect anyway
                        router.push(`/claim/${claimId}`);
                    }
                }
            } catch {
                clearInterval(interval);
            }
        }, 3000);
    };

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold text-lg mb-1">Check a Claim</h2>
            <p className="text-sm text-slate-500 mb-4">
                Paste a claim you&apos;ve seen on social media and we&apos;ll verify it against official bill text
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                    <Search className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder='e.g. "The new border bill gives $5 billion to fund a wall from coast to coast..."'
                        rows={3}
                        maxLength={2000}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-11 pr-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:bg-slate-800 dark:border-slate-700 dark:text-white resize-none"
                    />
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    <input
                        type="url"
                        value={sourceUrl}
                        onChange={(e) => setSourceUrl(e.target.value)}
                        placeholder="Source URL (optional)"
                        className="flex-1 h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                    />
                    <button
                        type="submit"
                        disabled={loading || content.trim().length < 10}
                        className="inline-flex items-center justify-center gap-2 h-10 px-6 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            <>
                                <Send className="w-4 h-4" />
                                Fact-Check This
                            </>
                        )}
                    </button>
                </div>
            </form>

            {result && (
                <div className={`mt-4 flex items-center gap-2 text-sm rounded-lg p-3 ${
                    result.type === 'success'
                        ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                        : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                }`}>
                    {result.type === 'success' ? (
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    ) : (
                        <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    {result.message}
                </div>
            )}
        </div>
    );
}
