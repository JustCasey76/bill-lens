import { OpenAI } from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { SUMMARIZATION_PROMPT } from '@/lib/ai/prompts';
import { BillSummarySchema } from '@/types/ai-schemas';
import { billVersions } from '@/lib/db';
import { logJob } from '@/lib/logger';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateBillSummary(text: string) {
    const completion = await openai.chat.completions.create({
        model: "gpt-4o-2024-08-06",
        messages: [
            { role: "system", content: "You are a helpful legislative assistant. You must output valid JSON." },
            { role: "user", content: SUMMARIZATION_PROMPT(text) },
        ],
        response_format: zodResponseFormat(BillSummarySchema, "bill_summary"),
    });

    const content = completion.choices[0].message.content;
    if (!content) return null;
    return JSON.parse(content);
}

export async function summarizeBillVersion(versionId: string) {
    await logJob('SUMMARY', 'INFO', `Summarizing version ${versionId}`);

    const version = await billVersions.findById(versionId);

    if (!version || !version.fullText) {
        await logJob('SUMMARY', 'ERROR', `Version ${versionId} not found or no text`);
        return;
    }

    // Truncate to avoid massive context (approx 100k chars ~ 25k tokens)
    const truncatedText = version.fullText.substring(0, 100000);

    try {
        const summaryData = await generateBillSummary(truncatedText);

        if (!summaryData) throw new Error("No data returned from AI");

        await billVersions.update(versionId, {
            summary: summaryData as any,
        });

        await logJob('SUMMARY', 'SUCCESS', `Generated summary for ${versionId}`);
    } catch (err: any) {
        await logJob('SUMMARY', 'ERROR', { message: "AI Generation Failed", error: err.message });
    }
}
