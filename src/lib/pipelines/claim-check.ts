import { OpenAI } from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { SYSTEM_PROMPT_BASE, CLAIM_CHECK_PROMPT } from '@/lib/ai/prompts';
import { ClaimCheckSchema } from '@/types/ai-schemas';
import { claims, bills, billVersions, type Verdict } from '@/lib/db';
import { logJob } from '@/lib/logger';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Map AI verdict strings to Verdict type values
function mapVerdictToEnum(verdict: string): Verdict {
    const map: Record<string, Verdict> = {
        'Accurate': 'Accurate',
        'Partially accurate': 'PartiallyAccurate',
        'Misleading': 'Misleading',
        'Unsupported': 'Unsupported',
        'False': 'False',
    };
    return map[verdict] || 'Unsupported';
}

async function generateClaimCheck(claim: string, billText: string) {
    const completion = await openai.chat.completions.create({
        model: "gpt-4o-2024-08-06",
        messages: [
            { role: "system", content: SYSTEM_PROMPT_BASE },
            { role: "user", content: CLAIM_CHECK_PROMPT(claim, billText) },
        ],
        response_format: zodResponseFormat(ClaimCheckSchema, "claim_check"),
    });

    const content = completion.choices[0].message.content;
    if (!content) return null;
    return JSON.parse(content);
}

export async function checkClaim(claimId: string) {
    await logJob('CLAIM-CHECK', 'INFO', `Checking claim ${claimId}`);

    const claim = await claims.findById(claimId);

    if (!claim) {
        await logJob('CLAIM-CHECK', 'ERROR', `Claim ${claimId} not found`);
        return;
    }

    // Get bill text from the latest version
    let billText: string | null = null;
    if (claim.billId) {
        const versions = await billVersions.findByBill(claim.billId, {
            orderBy: { field: 'date', direction: 'desc' },
            take: 1,
        });
        billText = versions[0]?.fullText || null;
    }

    if (!billText || billText.length < 50) {
        // No bill text available -- mark as unsupported
        await claims.update(claimId, {
            status: 'checked',
            verdict: 'Unsupported',
            analysis: {
                claim_id: claimId,
                bill_id: claim.billId || '',
                claim: claim.content,
                verdict: 'Unsupported',
                explanation: 'No bill text is available to verify this claim against.',
                evidence: [],
                what_the_bill_says: 'Bill text not available.',
                common_misunderstandings: [],
                limitations: 'This claim could not be checked because the related bill text has not been ingested yet.',
                confidence: 'low',
                last_checked: new Date().toISOString(),
            },
        });
        await logJob('CLAIM-CHECK', 'INFO', `No bill text for claim ${claimId}, marked Unsupported`);
        return;
    }

    // Truncate to avoid massive context
    const truncatedText = billText.substring(0, 100000);

    try {
        const result = await generateClaimCheck(claim.content, truncatedText);

        if (!result) throw new Error("No data returned from AI");

        const verdictEnum = mapVerdictToEnum(result.verdict);

        await claims.update(claimId, {
            status: 'checked',
            verdict: verdictEnum,
            analysis: result,
        });

        await logJob('CLAIM-CHECK', 'SUCCESS', `Claim ${claimId} verdict: ${verdictEnum}`);
    } catch (err: any) {
        await claims.update(claimId, { status: 'error' });
        await logJob('CLAIM-CHECK', 'ERROR', { message: "AI Claim Check Failed", error: err.message });
    }
}
