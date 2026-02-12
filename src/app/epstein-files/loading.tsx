export default function Loading() {
    return (
        <div className="container mx-auto px-4 py-8">
            <div className="animate-pulse space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-slate-200 dark:bg-slate-800 rounded-xl" />
                    <div>
                        <div className="h-7 w-36 bg-slate-200 dark:bg-slate-800 rounded" />
                        <div className="h-4 w-56 bg-slate-100 dark:bg-slate-900 rounded mt-2" />
                    </div>
                </div>
                <div className="h-20 bg-amber-50 dark:bg-amber-900/10 rounded-xl" />
                <div className="h-12 w-full max-w-2xl bg-slate-100 dark:bg-slate-900 rounded-xl" />
                <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-28 bg-slate-100 dark:bg-slate-900 rounded-xl" />
                    ))}
                </div>
            </div>
        </div>
    );
}
