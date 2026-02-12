export function Footer() {
    return (
        <footer className="border-t bg-slate-50 py-12 dark:bg-slate-900 dark:border-slate-800">
            <div className="container mx-auto px-4 grid md:grid-cols-4 gap-8 text-sm">
                <div>
                    <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        BillLens
                    </span>
                    <p className="mt-4 text-slate-500">
                        Automated legislation tracking and fact-checking for the modern web.
                    </p>
                </div>
                <div>
                    <h3 className="font-semibold mb-3">Product</h3>
                    <ul className="space-y-2 text-slate-500">
                        <li><a href="/bills" className="hover:text-blue-600 transition-colors">Bills</a></li>
                        <li><a href="/claims" className="hover:text-blue-600 transition-colors">Fact Checks</a></li>
                        <li><a href="/epstein-files" className="hover:text-blue-600 transition-colors">Epstein Files</a></li>
                    </ul>
                </div>
                <div>
                    <h3 className="font-semibold mb-3">Resources</h3>
                    <ul className="space-y-2 text-slate-500">
                        <li><a href="/methodology">Methodology</a></li>
                        <li><a href="/docs/api">API</a></li>
                        <li><a href="/rss">RSS Feeds</a></li>
                    </ul>
                </div>
                <div>
                    <h3 className="font-semibold mb-3">Legal</h3>
                    <ul className="space-y-2 text-slate-500">
                        <li><a href="/privacy">Privacy Policy</a></li>
                        <li><a href="/terms">Terms of Service</a></li>
                        <li><a href="/trust">Trust & Safety</a></li>
                    </ul>
                </div>
            </div>
            <div className="container mx-auto px-4 mt-12 pt-8 border-t border-slate-200 text-center text-slate-400 dark:border-slate-800">
                © {new Date().getFullYear()} BillLens using public data from Congress.gov. Not an official government website.
            </div>
        </footer>
    );
}
