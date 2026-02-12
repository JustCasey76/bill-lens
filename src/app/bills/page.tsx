import { bills } from '@/lib/db';
import { BillCard } from '@/components/Cards';
import { Search, FileText } from 'lucide-react';
import { isFirestoreAvailable } from '@/lib/firestore';

export const dynamic = 'force-dynamic';

export default async function AllBillsPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string }>;
}) {
    const { q } = await searchParams;

    let billsList: any[] = [];
    if (isFirestoreAvailable()) {
        try {
            billsList = await bills.findMany({
                where: q ? { titleContains: q } : undefined,
                orderBy: { field: 'updatedAt', direction: 'desc' },
                take: 50,
            });
        } catch (e) {
            console.error('Failed to fetch bills:', e);
        }
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row justify-between items-end md:items-center mb-8 gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl text-white">
                        <FileText size={22} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Legislative Tracker</h1>
                        <p className="text-slate-500 text-sm mt-1">
                            {q ? `${billsList.length} results for "${q}"` : `Tracking ${billsList.length} recent bills from Congress`}
                        </p>
                    </div>
                </div>

                <form className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        name="q"
                        defaultValue={q || ''}
                        placeholder="Filter bills..."
                        className="w-full h-10 rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:bg-slate-900 dark:border-slate-800 dark:text-white shadow-sm"
                    />
                </form>
            </div>

            {billsList.length === 0 ? (
                <div className="text-center py-20 text-slate-500 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                    <FileText size={40} className="mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                    {q ? (
                        <>
                            <p className="text-lg font-medium">No bills found</p>
                            <p className="text-sm mt-2">Try different search terms</p>
                        </>
                    ) : (
                        <p>No bills tracked yet. Trigger ingestion from the Admin Dashboard.</p>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {billsList.map((bill) => (
                        <BillCard key={bill.id} bill={bill} />
                    ))}
                </div>
            )}
        </div>
    );
}
