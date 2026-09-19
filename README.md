# INE Price Tracker

A web application that tracks product prices and stock availability from the INE Demo Store (`demo.inelabteamdev.com`). Scrapes prices every 2 hours and maintains a full history with detailed attempt logs.

## Features

- Search INE store products by name, brand, or category
- Track products and monitor price/stock changes over time
- Automated scraping every 2 hours via external cron
- Price and stock history with line charts
- Detailed scrape attempt logs (retries, errors, durations)
- Manual one-click scraping
- Headed Playwright mode for live demonstration

## Architecture

```
┌─────────┐     ┌──────────┐     ┌──────────┐
│  Vercel │────▶│  Render  │────▶│ Supabase │
│(Frontend)│    │(Backend) │     │  (DB)    │
└─────────┘     └──────────┘     └──────────┘
                     ▲
                     │
              ┌──────────────┐
              │ cron-job.org │
              │ (every 2 hrs)│
              └──────────────┘
```

The INE Demo Store is a React SPA with anti-bot price challenges (canvas fingerprinting, mouse tracking, challenge tokens). HTTP scraping is not viable — Playwright simulates real browser interaction to extract prices.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, Tailwind CSS, Axios, Recharts |
| Backend | Node.js, Express |
| Database | Supabase PostgreSQL |
| Scraping | Playwright (Chromium) |
| Scheduling | cron-job.org |

## Setup Instructions

### Prerequisites

- Node.js 18+
- Supabase account (free tier works)

### 1. Clone and Install

```bash
git clone <repo-url>
cd ine-price-tracker

# Backend
cd backend
npm install
npx playwright install chromium
cd ..

# Frontend
cd frontend
npm install
cd ..
```

### 2. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor**
3. Paste and run the contents of `supabase.sql`
4. Copy your project URL and anon key from **Settings → API**

### 3. Environment Variables

Create `backend/.env`:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
CRON_SECRET=some-secret-string
FRONTEND_URL=http://localhost:5173
PORT=3001
```

Create `frontend/.env`:

```
VITE_API_URL=http://localhost:3001
```

### 4. Run Locally

```bash
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser.

## Testing

```bash
cd backend
npm test
```

Tests cover price parsing, stock parsing, validation rules, and data preservation logic.

## Headed Scraper Demo

For the 2–4 minute screen recording:

```bash
cd backend
npm run headed
# Or with a specific product:
node run-headed.js https://demo.inelabteamdev.com/product/5
```

This opens a visible Chromium window and logs every scraping step to the terminal.

## 2-Hour Cron Setup

1. Go to [cron-job.org](https://cron-job.org)
2. Create a new cron job:
   - **URL**: `https://your-backend.onrender.com/api/scrape/run`
   - **Method**: POST
   - **Header**: `x-cron-secret: your-cron-secret`
   - **Schedule**: `0 */2 * * *` (every 2 hours)

## Deployment

### Frontend → Vercel

1. Connect GitHub repo to Vercel
2. Root directory: `frontend`
3. Environment variable: `VITE_API_URL=https://your-backend.onrender.com`

### Backend → Render

1. Create a Web Service on Render
2. Root directory: `backend`
3. Build command: `npm install && npx playwright install chromium --with-deps`
4. Start command: `npm start`
5. Environment variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `CRON_SECRET`, `FRONTEND_URL`

### Database → Supabase

Already configured in setup step 2.

## Environment Variables

| Variable | Where | Description |
|---|---|---|
| `SUPABASE_URL` | Backend | Supabase project URL |
| `SUPABASE_ANON_KEY` | Backend | Supabase anonymous key |
| `CRON_SECRET` | Backend | Secret to protect cron endpoint |
| `FRONTEND_URL` | Backend | Frontend URL for CORS |
| `PORT` | Backend | Server port (default 3001) |
| `VITE_API_URL` | Frontend | Backend API URL |
