export default function Loading() {
    return (
        <div className="container mx-auto px-4 py-8 max-w-5xl">
            <div className="animate-pulse space-y-6">
                <div className="h-4 w-40 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="h-8 w-64 bg-slate-200 dark:bg-slate-800 rounded" />
                        <div className="h-24 bg-blue-50 dark:bg-blue-900/10 rounded-xl" />
                        <div className="h-96 bg-slate-100 dark:bg-slate-900 rounded-xl" />
                    </div>
                    <div className="space-y-6">
                        <div className="h-12 bg-blue-100 dark:bg-blue-900/20 rounded-xl" />
                        <div className="h-48 bg-slate-100 dark:bg-slate-900 rounded-xl" />
                    </div>
                </div>
            </div>
        </div>
    );
}
