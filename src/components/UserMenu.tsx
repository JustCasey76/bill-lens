'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { LogIn, LogOut, User, ShieldCheck } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

export function UserMenu() {
    const { data: session, status } = useSession();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    if (status === 'loading') {
        return <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />;
    }

    if (!session) {
        return (
            <button
                onClick={() => signIn('google')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
                <LogIn size={14} />
                Sign in
            </button>
        );
    }

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2"
            >
                {session.user.image ? (
                    <img
                        src={session.user.image}
                        alt=""
                        className="w-8 h-8 rounded-full border-2 border-blue-500"
                    />
                ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
                        {session.user.name?.[0] || '?'}
                    </div>
                )}
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 py-2 z-50">
                    <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                            {session.user.name}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{session.user.email}</p>
                    </div>

                    {session.user.role === 'admin' && (
                        <Link
                            href="/admin"
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                        >
                            <ShieldCheck size={14} />
                            Admin Dashboard
                        </Link>
                    )}

                    <Link
                        href="/profile"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                        <User size={14} />
                        Profile
                    </Link>

                    <button
                        onClick={() => signOut()}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                        <LogOut size={14} />
                        Sign out
                    </button>
                </div>
            )}
        </div>
    );
}
