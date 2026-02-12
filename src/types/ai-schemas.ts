import { z } from 'zod';

// Common Citation Schema
export const CitationSchema = z.object({
  section: z.string().describe("The specific section/subsection ID/header"),
  quote: z.string().describe("Direct quote from the bill text supporting the statement"),
  url: z.string().nullable().describe("URL anchor to the specific section"),
});

// A. Bill Summary Schema
export const BillSummarySchema = z.object({
  bill_id: z.string(),
  version_id: z.string(),
  tldr_bullets: z.array(z.object({
    text: z.string(),
    citations: z.array(CitationSchema),
    confidence: z.enum(['high', 'medium', 'low'])
  })).describe("3-5 bullet points summarizing the bill"),
  what_it_does: z.array(z.object({
    text: z.string(),
    citations: z.array(CitationSchema),
  })).describe("Detailed breakdown of affirmative actions"),
  what_it_does_not_do: z.array(z.object({
    text: z.string(),
    citations: z.array(CitationSchema),
  })).describe("Clarification of common misconceptions or exclusions"),
  key_numbers: z.array(z.object({
    label: z.string(),
    value: z.string(),
    citations: z.array(CitationSchema),
    confidence: z.enum(['high', 'medium', 'low'])
  })).describe("Funding amounts, dates, thresholds"),
  plain_english_overview: z.string().describe("1-2 paragraph simple explanation"),
  limitations: z.string().describe("What the summary might miss or context needed"),
  overall_confidence: z.enum(['high', 'medium', 'low'])
});
export type BillSummary = z.infer<typeof BillSummarySchema>;


// B. Bill Change Summary Schema
export const BillChangeSummarySchema = z.object({
  bill_id: z.string(),
  from_version_id: z.string(),
  to_version_id: z.string(),
  changes: z.array(z.object({
    type: z.enum(['added', 'removed', 'modified']),
    summary: z.string(),
    citations: z.array(CitationSchema),
    confidence: z.enum(['high', 'medium', 'low'])
  })),
  overall_confidence: z.enum(['high', 'medium', 'low'])
});
export type BillChangeSummary = z.infer<typeof BillChangeSummarySchema>;


// C. Claim Check Schema
export const ClaimCheckSchema = z.object({
  claim_id: z.string(),
  bill_id: z.string(),
  claim: z.string(),
  verdict: z.enum(['Accurate', 'Partially accurate', 'Misleading', 'Unsupported', 'False']),
  explanation: z.string(),
  evidence: z.array(CitationSchema),
  what_the_bill_says: z.string().describe("What the bill actually says relevant to the claim"),
  common_misunderstandings: z.array(z.string()),
  limitations: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
  last_checked: z.string().datetime()
});
export type ClaimCheck = z.infer<typeof ClaimCheckSchema>;
