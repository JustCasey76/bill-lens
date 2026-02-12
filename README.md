# BillLens

Automated, trustworthy legislation tracker and fact-checking hub. Track US Congress bills, read AI summaries with citations, and verify viral claims against official bill text.

**Stack:** Next.js, Prisma, PostgreSQL, Redis, BullMQ.

## Running locally

1. **Start Postgres and Redis** (Docker):

   ```bash
   docker-compose up -d
   ```

   Postgres: `localhost:5433`, DB `billlens`. Redis: `localhost:6379`.

2. **Environment:** Create `.env` in the project root and set:

   - `DATABASE_URL` — e.g. `postgresql://postgres:password@localhost:5433/billlens`
   - `REDIS_URL` — optional; defaults to `localhost:6379`
   - `OPENAI_API_KEY` — for summaries and claim-check
   - `CONGRESS_GOV_API_KEY` — for bill ingestion
   - **Firebase (client, optional):** `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`, `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` — for Firebase Analytics (see `src/lib/firebase.ts`)

3. **Database:**

   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

4. **Dev server:**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Deploy to Firebase (online)

On Windows, `firebase deploy` can fail with a symlink error. Use **GitHub Actions** so the build runs on Linux and deploys for you:

1. **Push this repo to GitHub** (if you haven’t already).

2. **Get a Firebase CI token:** run `npx firebase-tools login:ci` in a terminal, sign in, and copy the token.

3. **Add GitHub repo secrets** (Settings → Secrets and variables → Actions):
   - `FIREBASE_TOKEN` — the token from step 2
   - Optional (for client env in build): `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`, `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` (same values as in your `.env`)

4. **Push to `main` or `master`** (or run the “Deploy to Firebase Hosting” workflow manually). The workflow will build and deploy. Your app will be at **https://bill-lens.web.app**.

For the deployed app to use the database and APIs, configure production env vars (e.g. `DATABASE_URL`, `REDIS_URL`, `OPENAI_API_KEY`, `CONGRESS_GOV_API_KEY`) in the Firebase/Cloud Functions environment.

## Other deploy options

- **Firebase (local):** `firebase deploy` — may fail on Windows due to symlinks; enable Developer Mode (Windows Settings → For developers) and try again, or use the GitHub workflow above.
- **Vercel:** Connect the repo; set `DATABASE_URL`, `REDIS_URL`, `OPENAI_API_KEY`, `CONGRESS_GOV_API_KEY` in the project environment.

See `docs/PRD.md` for product overview and `docs/IA_and_Data.md` for data/IA notes.
