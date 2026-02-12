"use client";
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, FileText, Shield, BookOpen, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface SearchResult {
    bills: Array<{ id: string; congress: number; type: string; number: string; title: string; url: string }>;
    claims: Array<{ id: string; content: string; verdict: string | null; url: string }>;
    epsteinDocs: Array<{ id: string; title: string; url: string }>;
}

export function SearchDropdown() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<NodeJS.Timeout>(undefined);
    const router = useRouter();

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (query.length < 2) {
            setResults(null);
            setOpen(false);
            return;
        }

        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
                const data = await res.json();
                setResults(data);
                setOpen(true);
            } catch {
                setResults(null);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(debounceRef.current);
    }, [query]);

    const hasResults = results && (results.bills.length > 0 || results.claims.length > 0 || results.epsteinDocs.length > 0);

    return (
        <div ref={containerRef} className="relative">
            <div className="relative">
                {loading ? (
                    <Loader2 className="absolute left-2.5 top-2.5 h-4 w-4 text-blue-500 animate-spin" />
                ) : (
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                )}
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => query.length >= 2 && results && setOpen(true)}
                    placeholder="Search bills, claims, documents..."
                    className="h-9 w-64 rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:bg-slate-800 dark:border-slate-700 dark:text-white transition-all"
                />
            </div>

            {open && (
                <div className="absolute top-full mt-2 right-0 w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden z-50">
                    {!hasResults ? (
                        <div className="p-4 text-center text-sm text-slate-500">
                            No results found for &ldquo;{query}&rdquo;
                        </div>
                    ) : (
                        <div className="max-h-96 overflow-y-auto">
                            {results!.bills.length > 0 && (
                                <div>
                                    <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400 bg-slate-50 dark:bg-slate-800/50">
                                        <FileText className="w-3 h-3 inline mr-1" /> Bills
                                    </div>
                                    {results!.bills.map((b) => (
                                        <Link
                                            key={b.id}
                                            href={b.url}
                                            onClick={() => { setOpen(false); setQuery(''); }}
                                            className="block px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                        >
                                            <span className="text-xs font-mono text-blue-600 dark:text-blue-400">
                                                {b.type.toUpperCase()} {b.number}
                                            </span>
                                            <p className="text-sm text-slate-800 dark:text-slate-200 line-clamp-1">{b.title}</p>
                                        </Link>
                                    ))}
                                </div>
                            )}

                            {results!.claims.length > 0 && (
                                <div>
                                    <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400 bg-slate-50 dark:bg-slate-800/50">
                                        <Shield className="w-3 h-3 inline mr-1" /> Fact Checks
                                    </div>
                                    {results!.claims.map((c) => (
                                        <Link
                                            key={c.id}
                                            href={c.url}
                                            onClick={() => { setOpen(false); setQuery(''); }}
                                            className="block px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                        >
                                            <p className="text-sm text-slate-800 dark:text-slate-200 line-clamp-1">{c.content}</p>
                                            {c.verdict && (
                                                <span className="text-xs text-slate-500">{c.verdict}</span>
                                            )}
                                        </Link>
                                    ))}
                                </div>
                            )}

                            {results!.epsteinDocs.length > 0 && (
                                <div>
                                    <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400 bg-slate-50 dark:bg-slate-800/50">
                                        <BookOpen className="w-3 h-3 inline mr-1" /> Epstein Files
                                    </div>
                                    {results!.epsteinDocs.map((d) => (
                                        <Link
                                            key={d.id}
                                            href={d.url}
                                            onClick={() => { setOpen(false); setQuery(''); }}
                                            className="block px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                        >
                                            <p className="text-sm text-slate-800 dark:text-slate-200 line-clamp-1">{d.title}</p>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
