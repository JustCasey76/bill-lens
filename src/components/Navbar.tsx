import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';
import { MobileMenu } from './MobileMenu';
import { SearchDropdown } from './SearchDropdown';
import { UserMenu } from './UserMenu';

export function Navbar() {
    return (
        <nav className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur-lg dark:bg-slate-900/80 dark:border-slate-800">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <Link href="/" className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    BillLens
                </Link>

                <div className="hidden md:flex items-center space-x-6 text-sm font-medium text-slate-600 dark:text-slate-300">
                    <Link href="/bills" className="hover:text-blue-600 transition-colors">All Bills</Link>
                    <Link href="/claims" className="hover:text-blue-600 transition-colors">Fact Checks</Link>
                    <Link href="/epstein-files" className="hover:text-blue-600 transition-colors">Epstein Files</Link>
                    <Link href="/methodology" className="hover:text-blue-600 transition-colors">Methodology</Link>
                </div>

                <div className="flex items-center space-x-3">
                    <div className="hidden sm:block">
                        <SearchDropdown />
                    </div>
                    <div className="hidden md:block">
                        <ThemeToggle />
                    </div>
                    <UserMenu />
                    <MobileMenu />
                </div>
            </div>
        </nav>
    );
}
