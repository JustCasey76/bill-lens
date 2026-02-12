'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    User, Mail, Calendar, ShieldCheck, Database,
    Shield, FileText, BarChart3, Settings,
    ExternalLink, LogOut,
} from 'lucide-react';
import { signOut } from 'next-auth/react';

export default function ProfilePage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    if (status === 'loading') {
        return (
            <div className="container mx-auto px-4 py-12">
                <div className="max-w-3xl mx-auto space-y-6">
                    <div className="h-48 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
                    <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
                </div>
            </div>
        );
    }

    if (!session) {
        router.push('/auth/signin');
        return null;
    }

    const isAdmin = session.user?.role === 'admin';
    const joinDate = new Date().toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
    });

    return (
        <div className="container mx-auto px-4 py-8 max-w-3xl">
            {/* Profile Header */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="h-24 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600" />
                <div className="px-6 pb-6">
                    <div className="flex items-end gap-4 -mt-10">
                        {session.user?.image ? (
                            <img
                                src={session.user.image}
                                alt=""
                                className="w-20 h-20 rounded-2xl border-4 border-white dark:border-slate-900 shadow-lg"
                            />
                        ) : (
                            <div className="w-20 h-20 rounded-2xl border-4 border-white dark:border-slate-900 shadow-lg bg-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                                {session.user?.name?.[0] || '?'}
                            </div>
                        )}
                        <div className="pb-1">
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                                    {session.user?.name || 'User'}
                                </h1>
                                {isAdmin && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded-full">
                                        <ShieldCheck size={10} />
                                        Admin
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {session.user?.email}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Account Info */}
            <div className="mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Account Information</h2>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    <div className="flex items-center gap-3 px-6 py-4">
                        <User size={16} className="text-slate-400" />
                        <div className="flex-1">
                            <p className="text-xs text-slate-500 dark:text-slate-400">Full Name</p>
                            <p className="text-sm font-medium text-slate-900 dark:text-white">{session.user?.name || 'Not set'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 px-6 py-4">
                        <Mail size={16} className="text-slate-400" />
                        <div className="flex-1">
                            <p className="text-xs text-slate-500 dark:text-slate-400">Email Address</p>
                            <p className="text-sm font-medium text-slate-900 dark:text-white">{session.user?.email}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 px-6 py-4">
                        <ShieldCheck size={16} className="text-slate-400" />
                        <div className="flex-1">
                            <p className="text-xs text-slate-500 dark:text-slate-400">Role</p>
                            <p className="text-sm font-medium text-slate-900 dark:text-white capitalize">{session.user?.role || 'user'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 px-6 py-4">
                        <Calendar size={16} className="text-slate-400" />
                        <div className="flex-1">
                            <p className="text-xs text-slate-500 dark:text-slate-400">Member Since</p>
                            <p className="text-sm font-medium text-slate-900 dark:text-white">{joinDate}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 px-6 py-4">
                        <ExternalLink size={16} className="text-slate-400" />
                        <div className="flex-1">
                            <p className="text-xs text-slate-500 dark:text-slate-400">Auth Provider</p>
                            <p className="text-sm font-medium text-slate-900 dark:text-white">Google</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Admin Navigation - only for admins */}
            {isAdmin && (
                <div className="mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
                    <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                            <ShieldCheck size={16} className="text-blue-600" />
                            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Admin Tools</h2>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 p-2">
                        <Link
                            href="/admin"
                            className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <BarChart3 size={16} className="text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-900 dark:text-white">Dashboard</p>
                                <p className="text-xs text-slate-500">Overview &amp; telemetry</p>
                            </div>
                        </Link>
                        <Link
                            href="/admin"
                            onClick={() => {
                                // Will navigate to admin and auto-trigger
                            }}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            <div className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <Database size={16} className="text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-900 dark:text-white">Bill Ingestion</p>
                                <p className="text-xs text-slate-500">Bills not yet passed</p>
                            </div>
                        </Link>
                        <Link
                            href="/claims"
                            className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                                <Shield size={16} className="text-indigo-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-900 dark:text-white">Fact Checks</p>
                                <p className="text-xs text-slate-500">Review submitted claims</p>
                            </div>
                        </Link>
                        <Link
                            href="/bills"
                            className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                <FileText size={16} className="text-amber-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-900 dark:text-white">All Bills</p>
                                <p className="text-xs text-slate-500">Browse legislation</p>
                            </div>
                        </Link>
                        <Link
                            href="/epstein-files"
                            className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            <div className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                <Settings size={16} className="text-red-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-900 dark:text-white">Epstein Files</p>
                                <p className="text-xs text-slate-500">Search indexed documents</p>
                            </div>
                        </Link>
                    </div>
                </div>
            )}

            {/* Sign Out */}
            <div className="mt-6 mb-12">
                <button
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/50 rounded-2xl text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shadow-sm"
                >
                    <LogOut size={16} />
                    Sign out
                </button>
            </div>
        </div>
    );
}
