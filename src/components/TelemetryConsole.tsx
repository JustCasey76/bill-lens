"use client";
import { useEffect, useState, useRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// types
interface Log {
    id: string;
    jobType: string;
    status: string;
    details: any;
    startedAt: string;
    completedAt?: string;
}

export function TelemetryConsole() {
    const [logs, setLogs] = useState<Log[]>([]);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const bottomRef = useRef<HTMLDivElement>(null);

    const fetchLogs = async () => {
        try {
            const res = await fetch('/api/admin/logs');
            if (res.ok) {
                const data = await res.json();
                setLogs(data);
            } else {
                console.error("Fetch logs failed", res.status);
            }
        } catch (err) {
            console.error("Fetch error", err);
        }
    };

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(() => {
            if (autoRefresh) fetchLogs();
        }, 2000); // 2s polling
        return () => clearInterval(interval);
    }, [autoRefresh]);

    function formatTime(iso: string) {
        return new Date(iso).toLocaleTimeString();
    }

    function getStatusColor(status: string) {
        switch (status) {
            case 'SUCCESS': return 'text-green-500';
            case 'ERROR': return 'text-red-500';
            case 'INFO': return 'text-blue-500';
            default: return 'text-slate-500';
        }
    }

    return (
        <div className="border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-950 text-slate-200 overflow-hidden flex flex-col h-96">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900">
                <h3 className="font-mono text-xs font-semibold text-slate-400 uppercase tracking-wider">Live Telemetry</h3>
                <div className="flex items-center gap-4 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={() => setAutoRefresh(!autoRefresh)}
                            className="rounded border-slate-700 bg-slate-800"
                        />
                        Auto-refresh
                    </label>
                </div>
            </div>

            <div className="flex-grow overflow-auto p-4 font-mono text-xs space-y-2">
                {logs.length === 0 && (
                    <div className="text-slate-600 italic">Waiting for telemetry...</div>
                )}
                {[...logs].reverse().map(log => (
                    <div key={log.id} className="flex gap-3">
                        <span className="text-slate-500 shrink-0 w-20">{formatTime(log.startedAt)}</span>
                        <span className={clsx("font-bold shrink-0 w-24", getStatusColor(log.status))}>
                            {log.jobType}
                        </span>
                        <span className="break-all text-slate-300">
                            {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                        </span>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>
        </div>
    );
}
