# BillLens - Product Requirements Document

## 1. Project Overview
**Name:** BillLens (Working Title)
**Goal:** Automated, trustworthy, SEO-friendly legislation tracker & fact-checking hub.
**Target Audience:** General public, journalists, researchers.

## 2. Core Value Proposition
- **Accuracy-First:** All claims backed by exact bill text citations.
- **Neutrality:** Objective summaries, no partisan framing.
- **Zero-Maintenance:** Low-ops, automated ingestion and updates.
- **Speed:** Updates within 1 hour of source availability.

## 3. Key Features
- **Legislation Tracker:** Real-time status, text tracking, version diffing.
- **Smart Summaries:** AI-generated "What it does", "TL;DR", "Key numbers".
- **Fact-Checking Hub:** Verify trending claims against bill text.
- **Search & Discovery:** Filter by topic, status, text search.
- **Transparency:** Clear confidence scores, source links, methodology.

## 4. User Flows
- **Triage:** User sees trending bill -> reads summary -> checks status.
- **Verification:** User sees viral claim -> checks BillLens -> sees "False" with quote.
- **Deep Dive:** User compares versions via Diff Viewer.

## 5. Technical Constraints & Requirements
- **Stack:** Next.js 16, Firebase Admin SDK (Firestore), OpenAI, Congress.gov API.
- **Performance:** 90+ Lighthouse score, SSR/ISR where possible.
- **Security:** Rate limiting, strict JSON parsing for AI outputs.
- **SEO:** Structured data, sitemaps, semantic HTML.

## 6. Metrics for Success
- **Verification Rate:** % of claims successfully mapped to verdict.
- **Traffic:** Organic search growth (programmatic SEO).
- **Trust:** Low bounce rate on methodology pages.
