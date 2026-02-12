import Link from 'next/link';
import { BadgeCheck, AlertTriangle, XCircle, HelpCircle, FileText } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

// Exported for reuse in claim detail page and elsewhere
export const verdictConfig = {
    Accurate: { color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", border: "border-l-green-500", icon: BadgeCheck },
    PartiallyAccurate: { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", border: "border-l-yellow-500", icon: AlertTriangle },
    Misleading: { color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400", border: "border-l-orange-500", icon: AlertTriangle },
    False: { color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", border: "border-l-red-500", icon: XCircle },
    Unsupported: { color: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400", border: "border-l-slate-400", icon: HelpCircle },
};

export function BillCard({ bill }: { bill: any }) {
    return (
        <Link href={`/bill/${bill.congress}/${bill.type}/${bill.number}`} className="block group">
            <div className="relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-lg hover:translate-y-[-2px]">
                {/* Gradient top accent */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />

                <div className="flex justify-between items-start mb-2 pt-1">
                    <span className="text-xs font-mono uppercase text-slate-500">{bill.type.toUpperCase()} {bill.number} &bull; {bill.congress}th Congress</span>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        {bill.status || "Introduced"}
                    </span>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
                    {bill.title}
                </h3>
                <div className="flex items-center gap-2 mt-4 text-xs text-slate-500">
                    <FileText className="w-3 h-3" />
                    <span>Latest Action: {new Date(bill.updatedAt).toLocaleDateString()}</span>
                </div>
            </div>
        </Link>
    );
}

export function ClaimCard({ claim }: { claim: any }) {
    // Support both Prisma shape (claim.verdict, claim.analysis) and mock shape (claim.verdict, claim.explanation)
    const verdict = claim.verdict || 'Unsupported';
    const config = verdictConfig[verdict as keyof typeof verdictConfig] || verdictConfig.Unsupported;
    const Icon = config.icon;
    const explanation = claim.explanation || (claim.analysis as any)?.explanation || '';
    const checkedDate = claim.checkedAt || claim.updatedAt;

    return (
        <Link href={`/claim/${claim.id}`} className="block group">
            <div className={cn(
                "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 transition-all duration-200 shadow-sm hover:shadow-lg hover:translate-y-[-2px] hover:border-blue-500",
                "border-l-4", config.border
            )}>
                <div className="flex items-center gap-2 mb-3">
                    <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold", config.color)}>
                        <Icon className="w-3.5 h-3.5" />
                        {verdict === 'PartiallyAccurate' ? 'Partially Accurate' : verdict}
                    </div>
                    {checkedDate && (
                        <span className="text-xs text-slate-400">&bull; {new Date(checkedDate).toLocaleDateString()}</span>
                    )}
                </div>
                <p className="font-medium text-slate-900 dark:text-slate-100 mb-3 line-clamp-3">
                    &ldquo;{claim.content || claim.claim}&rdquo;
                </p>
                {explanation && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
                        {explanation}
                    </p>
                )}
                <div className="mt-3 text-xs text-blue-600 dark:text-blue-400 font-medium group-hover:underline">
                    See the evidence &rarr;
                </div>
            </div>
        </Link>
    );
}
