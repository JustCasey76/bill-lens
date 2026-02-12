export default function Loading() {
    return (
        <div className="container mx-auto px-4 py-8">
            <div className="animate-pulse space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-slate-200 dark:bg-slate-800 rounded-xl" />
                    <div>
                        <div className="h-7 w-36 bg-slate-200 dark:bg-slate-800 rounded" />
                        <div className="h-4 w-64 bg-slate-100 dark:bg-slate-900 rounded mt-2" />
                    </div>
                </div>
                <div className="h-36 bg-slate-100 dark:bg-slate-900 rounded-xl" />
                <div className="flex gap-2">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-8 w-24 bg-slate-100 dark:bg-slate-900 rounded-full" />
                    ))}
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="h-44 bg-slate-100 dark:bg-slate-900 rounded-xl" />
                    ))}
                </div>
            </div>
        </div>
    );
}
