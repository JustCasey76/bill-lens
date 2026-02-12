export default function Loading() {
    return (
        <div className="container mx-auto px-4 py-8 max-w-5xl">
            <div className="animate-pulse space-y-6">
                <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-32 bg-slate-100 dark:bg-slate-900 rounded-xl" />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="h-48 bg-slate-100 dark:bg-slate-900 rounded-xl" />
                        <div className="h-36 bg-slate-100 dark:bg-slate-900 rounded-xl" />
                        <div className="h-48 bg-slate-100 dark:bg-slate-900 rounded-xl" />
                    </div>
                    <div className="space-y-6">
                        <div className="h-36 bg-slate-100 dark:bg-slate-900 rounded-xl" />
                        <div className="h-48 bg-slate-100 dark:bg-slate-900 rounded-xl" />
                    </div>
                </div>
            </div>
        </div>
    );
}
