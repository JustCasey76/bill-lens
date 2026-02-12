# BillLens

Automated, trustworthy legislation tracker and fact-checking hub. Track US Congress bills, read AI summaries with citations, and verify viral claims against official bill text.

**Stack:** Next.js 16, Firebase Admin SDK (Firestore), OpenAI, Congress.gov API.

## Running locally

1. **Environment:** Copy `.env.example` to `.env` and fill in your keys:

   - `OPENAI_API_KEY` — for AI summaries and claim fact-checking
   - `CONGRESS_GOV_API_KEY` — for bill ingestion from Congress.gov
   - `FIREBASE_SERVICE_ACCOUNT_KEY` — JSON string for Firestore access (or set `GOOGLE_APPLICATION_CREDENTIALS` to a file path)
   - `NEXT_PUBLIC_FIREBASE_*` — client-side Firebase config for Analytics
   - `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` — for NextAuth Google sign-in

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Dev server:**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Deploy to Firebase Hosting

On Windows, `firebase deploy` can fail with a symlink error. Use **GitHub Actions** so the build runs on Linux:

1. **Push this repo to GitHub** (if you haven't already).

2. **Get a Firebase CI token:** run `npx firebase-tools login:ci` in a terminal, sign in, and copy the token.

3. **Add GitHub repo secrets** (Settings > Secrets and variables > Actions):
   - `FIREBASE_TOKEN` — the CI token from step 2
   - `FIREBASE_SERVICE_ACCOUNT_KEY` — your service account JSON (for Firestore)
   - `OPENAI_API_KEY`, `CONGRESS_GOV_API_KEY` — API keys
   - Firebase client vars: `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`, `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`

4. **Push to `main`** (or run the "Deploy to Firebase Hosting" workflow manually). Your app will be at **https://bill-lens.web.app**.

## Deploy to Vercel

Connect the repo on [vercel.com](https://vercel.com); set the environment variables listed above in the Vercel project settings.

## Other deploy options

- **Firebase (local):** `firebase deploy` — may fail on Windows due to symlinks. Use the GitHub workflow or the Docker script at `scripts/deploy-firebase.ps1`.

See `docs/PRD.md` for product overview and `docs/IA_and_Data.md` for data/IA notes.
