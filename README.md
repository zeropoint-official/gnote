# Gnote — AI Note Organizer

Your AI-powered second brain. Write raw thoughts, and Gnote's AI organizes them into a living, evolving knowledge structure.

## Stack

- **Frontend**: Next.js 15 + Tailwind CSS + shadcn/ui
- **Backend**: Next.js API Routes (Vercel serverless)
- **Database & Auth**: Appwrite Cloud
- **AI**: Claude API (Haiku for per-note, Sonnet for reorganization)
- **Deployment**: Vercel

## Setup

### 1. Appwrite Cloud

1. Create a project at [cloud.appwrite.io](https://cloud.appwrite.io)
2. Enable Email/Password authentication (and optionally Google OAuth)
3. Create an API key with Database and Users scopes

### 2. Environment Variables

Copy `.env.local` and fill in your credentials:

```
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=your-project-id
APPWRITE_API_KEY=your-api-key
NEXT_PUBLIC_APPWRITE_DATABASE_ID=gnote-db
NEXT_PUBLIC_APPWRITE_RAW_NOTES_COLLECTION_ID=raw-notes
NEXT_PUBLIC_APPWRITE_CATEGORIES_COLLECTION_ID=categories
NEXT_PUBLIC_APPWRITE_ORGANIZED_NOTES_COLLECTION_ID=organized-notes
NEXT_PUBLIC_APPWRITE_USER_SETTINGS_COLLECTION_ID=user-settings
ANTHROPIC_API_KEY=your-anthropic-api-key
CRON_SECRET=any-random-secret-string
```

### 3. Create Database Collections

```bash
npm install
npx tsx scripts/setup-appwrite.ts
```

### 4. Configure Permissions

In Appwrite Console, for each collection, add permissions:
- Role: **Any** → Read, Create, Update, Delete (for development)
- For production: scope to authenticated users

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How It Works

1. **Capture**: Write raw notes on the home page
2. **AI Organizes**: Claude Haiku categorizes each note in real-time
3. **Browse**: View your organized knowledge on the Mind page
4. **Auto-Reorganize**: A weekly cron job uses Claude Sonnet to restructure, merge, and archive

## Deployment (Vercel)

1. Push to GitHub
2. Import in Vercel
3. Add all env vars from `.env.local`
4. Add `NEXT_PUBLIC_APP_URL` with your Vercel domain
5. The cron job in `vercel.json` will auto-activate
