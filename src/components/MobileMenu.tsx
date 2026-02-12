"use client";
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';

const navLinks = [
    { href: '/bills', label: 'All Bills' },
    { href: '/claims', label: 'Fact Checks' },
    { href: '/epstein-files', label: 'Epstein Files' },
    { href: '/methodology', label: 'Methodology' },
];

export function MobileMenu() {
    const [open, setOpen] = useState(false);

    return (
        <div className="md:hidden">
            <button
                onClick={() => setOpen(!open)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Toggle menu"
            >
                {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {open && (
                <div className="absolute top-16 left-0 right-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-lg z-50">
                    <div className="container mx-auto px-4 py-4 space-y-1">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                onClick={() => setOpen(false)}
                                className="block px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                {link.label}
                            </Link>
                        ))}
                        <div className="flex items-center justify-between px-3 py-2.5">
                            <span className="text-sm text-slate-500">Theme</span>
                            <ThemeToggle />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
