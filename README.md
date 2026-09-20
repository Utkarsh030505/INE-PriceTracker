# INE Product Price Tracker

A production-ready web application that tracks product prices and stock availability from the INE Demo Store (`https://demo.inelabteamdev.com/`). It scrapes real-time prices every 2 hours via an external scheduler and maintains full price history and detailed attempt logs.

## Live Application

- **Frontend (Vercel)**: [https://ine-price-tracker-seven.vercel.app/](https://ine-price-tracker-seven.vercel.app/)
- **Backend (Render)**: [https://ine-pricetracker-backend.onrender.com](https://ine-pricetracker-backend.onrender.com)
- **Database (Supabase)**: Managed PostgreSQL with foreign keys and Row Level Security

---

## 1. Project Overview

The INE Demo Store is a client-rendered React 19 Single Page Application equipped with anti-bot price challenges (canvas/WebGL fingerprinting, mandatory mouse dwelling, and encrypted challenge token exchange). This project solves the challenge by combining a lightweight metadata search index with a Playwright browser scraper that simulates authentic human interactions to extract live prices and stock levels.

---

## 2. Features

- **Product Search**: Fast, deterministic search across all 1,000 store products by name, brand, category, or SKU.
- **Product Tracking**: One-click tracking saving products directly into Supabase PostgreSQL.
- **Automated 2-Hour Scraping**: Scheduled bulk scraping via external cron (`cron-job.org`).
- **Live On-Demand Scraping**: Instant "Scrape Now" trigger with real-time UI updates.
- **Price & Stock History**: Interactive Recharts time-series line chart tracking fluctuations.
- **Comprehensive Scrape Logs**: Per-attempt transparency recording duration, status, and error details.
- **Headed Playwright Mode**: CLI script (`run-headed.js`) designed for live screen-recording demonstrations.
- **Resilient Failure Handling**: Exponential backoff retries and strict preservation of previous valid data on failure.

---

## 3. Architecture

```
┌───────────────────────────┐      ┌───────────────────────────┐      ┌───────────────────────────┐
│     Vercel (Frontend)     │─────▶│     Render (Backend)      │─────▶│    Supabase PostgreSQL    │
│  React 18 + Vite + Tailwind│      │ Express + Playwright CLI  │      │ 3 Tables + Indexes + RLS  │
└───────────────────────────┘      └───────────────────────────┘      └───────────────────────────┘
                                                 ▲
                                                 │ POST /api/scrape/run (Bearer CRON_SECRET)
                                   ┌───────────────────────────┐
                                   │   cron-job.org (2 Hours)  │
                                   └───────────────────────────┘
```

---

## 4. Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 18, Vite 5, Tailwind CSS | Single-page interface, responsive tables, clean typography |
| **Charts** | Recharts | Interactive price fluctuation time-series visualization |
| **API Client** | Axios | Frontend-to-backend communication with baseURL config |
| **Backend** | Node.js (ESM), Express | REST API, cron authorization, retry coordination |
| **Scraping** | Playwright (Chromium) | Anti-bot bypass, mouse emulation, DOM extraction |
| **Database** | Supabase (PostgreSQL) | Relational persistence with foreign keys and cascade deletes |
| **Scheduling**| cron-job.org | Independent 2-hour recurring cron trigger |

---

## 5. Project Structure

```
ine-price-tracker/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── SearchBar.jsx       # Debounced search + request race condition protection
│   │   │   ├── ProductCard.jsx     # Search result card with Track action
│   │   │   ├── TrackedProduct.jsx  # Dashboard table row with Scrape/Remove actions
│   │   │   ├── PriceChart.jsx      # Recharts price trend line chart
│   │   │   └── ScrapeLogs.jsx      # Detailed scrape attempt audit log table
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx       # Main dashboard: search + tracked products
│   │   │   └── ProductDetails.jsx  # Product detail: stats + chart + logs
│   │   ├── api.js                  # Axios client module
│   │   ├── App.jsx                 # Routes & layout shell
│   │   ├── main.jsx                # React root
│   │   └── index.css               # Tailwind directives
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
├── backend/
│   ├── catalog.json                # Pre-indexed search metadata (1,000 products)
│   ├── scraper.js                  # Playwright scraper + search engine + retry logic
│   ├── server.js                   # Express server with 9 REST endpoints + cron route
│   ├── supabase.js                 # Supabase client singleton
│   ├── run-headed.js               # Standalone script for headed demo
│   ├── scraper.test.js             # Jest test suite (28 tests)
│   └── package.json
├── supabase.sql                    # Production PostgreSQL DDL schema
├── README.md                       # Submission documentation
├── DESIGN.md                       # Engineering design notes
├── .gitignore
└── .env.example                    # Environment variable template
```

---

## 6. Local Setup

### Prerequisites
- Node.js 18+ (tested on Node v20/v24)
- Supabase account (free tier)

### 1. Clone Repository & Install Dependencies
```bash
git clone <repo-url>
cd ine-price-tracker

# Backend setup
cd backend
npm install
npx playwright install chromium
cd ..

# Frontend setup
cd frontend
npm install
cd ..
```

### 2. Configure Environment Variables
Copy `.env.example` to `backend/.env` and fill in your Supabase credentials:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key
CRON_SECRET=your-chosen-cron-secret
FRONTEND_URL=http://localhost:5173
PORT=3001
```

Create `frontend/.env`:
```env
VITE_API_URL=http://localhost:3001
```

### 3. Initialize Database Schema
Execute the SQL statements in `supabase.sql` using the Supabase SQL Editor.

### 4. Run Locally
```bash
# Terminal 1 — Backend (runs on http://localhost:3001)
cd backend
npm run dev

# Terminal 2 — Frontend (runs on http://localhost:5173)
cd frontend
npm run dev
```

---

## 7. Search Architecture (`backend/catalog.json`)

> [!IMPORTANT]
> **Boundary Notice**: `backend/catalog.json` is strictly an **offline search/discovery index**. It contains only static product metadata (`id`, `name`, `brand`, `category`, `sku`, `slug`, `url`). It contains **ZERO price or stock data**. All price and stock values are scraped dynamically in real time using Playwright.

### Why Pre-Indexing was Required
The INE mock store's `/api/catalog` endpoint returns a randomly shuffled sample of 60 items on each request and applies aggressive rate limiting (HTTP 429) after rapid requests. The local search index provides:
1. **Determinism**: The same query produces identical, reliable results every time.
2. **Instant Response**: $<1\text{ ms}$ search responses without network latency or 429 rate limits.
3. **Relevance Ranking**: Prioritizes exact matches $\to$ prefix matches $\to$ substring matches, with a stable `id` tie-breaker.
4. **Race-Condition Protection**: `SearchBar.jsx` tracks request sequence IDs (`latestRequestIdRef`), immediately discarding stale out-of-order responses.

---

## 8. Scraping & Retry Workflow

1. **Browser Launch**: Playwright launches Chromium (headless in production, headed for demo).
2. **Navigation**: Visits `https://demo.inelabteamdev.com/product/:id`.
3. **Overlay Handling**: Detects and dismisses the store's cookie modal.
4. **Mouse Simulation**: Moves the cursor over `.price-block` with 14 small movements over $\ge 600\text{ ms}$ to fulfill anti-bot dwell time requirements.
5. **Challenge Trigger**: Clicks the "Reveal price" button.
6. **Data Extraction**: Extracts the dynamic price element (handling standard, European comma-decimal, lakh, and unicode variants) and stock badge text.
7. **Validation**: Rejects non-positive or non-numeric prices.
8. **Retry Logic**: Up to 3 attempts with exponential backoff (1s, 2s, 4s).
9. **Data Preservation**: If all attempts fail, `last_scrape_status` is marked `'failed'`, but existing valid `current_price` and `current_stock` are **never overwritten with null**.

---

## 9. Headed Scraper Demo

For the required 2–4 minute video recording:

```bash
cd backend

# Successful scrape demonstration:
node run-headed.js https://demo.inelabteamdev.com/product/1

# Failure and retry demonstration (using an invalid product ID):
node run-headed.js https://demo.inelabteamdev.com/product/999999
```

The terminal outputs formatted, real-time status messages:
```
SCRAPE STARTED
Target: https://demo.inelabteamdev.com/product/1

Attempt 1
Requesting page...
Waiting for content...
Price found: ₹10797
Stock found: out of stock
Validation successful
Saved successfully
```

---

## 10. External Cron Setup (Every 2 Hours)

1. Register or log in at [cron-job.org](https://cron-job.org).
2. Create a new cron job with the following parameters:
   - **Title**: `INE Price Tracker - 2 Hour Scrape`
   - **URL**: `https://ine-pricetracker-backend.onrender.com/api/scrape/run`
   - **HTTP Method**: `POST`
   - **Request Header**: `Authorization: Bearer <YOUR_CRON_SECRET>`
   - **Schedule**: User-defined cron expression: `0 */2 * * *` (Every 2 hours)
3. **Verification**: Check the Execution History in cron-job.org (expect HTTP 200 `{ "success": true, "scraped": N, "failed": 0 }`) or view the updated `last_scraped_at` timestamp in the frontend.

---

## 11. Automated Testing

Run the test suite in `backend/`:
```bash
cd backend
npm test
```

### Coverage (28/28 tests passing):
- **Price Extraction**: Standard INR, Euro comma-decimal, Lakh notation, fullwidth unicode, trailing notes, decimal cents.
- **Stock Extraction**: All 5 dynamic store badge phrasing formats, out of stock, unknown fallback.
- **Validation**: Rejection of null, empty, non-numeric, zero, negative, and symbol-only values.
- **Retry Handling**: Simulated timeout retries and HTTP 503 retries.
- **Failure Handling**: Final status marking and data preservation rule verification.

---

## 12. Deployment

### Frontend $\to$ Vercel
- **Framework Preset**: Vite
- **Root Directory**: `frontend`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Environment Variable**: `VITE_API_URL=https://ine-pricetracker-backend.onrender.com`

### Backend $\to$ Render
- **Environment**: Node
- **Root Directory**: `backend`
- **Build Command**: `npm install && npx playwright install chromium --with-deps`
- **Start Command**: `npm start`
- **Environment Variables**:
  - `SUPABASE_URL`: Supabase project URL
  - `SUPABASE_PUBLISHABLE_KEY`: Supabase anon/publishable key
  - `CRON_SECRET`: Secret token protecting the cron endpoint
  - `FRONTEND_URL`: `https://ine-price-tracker-seven.vercel.app`

---

## 13. Known Limitations

- **Pre-Indexed Catalog**: The search index contains the 1,000 mock store products discovered during project setup. Newly created products on the target store (if any are added dynamically) will not appear in search until indexed, although direct URLs can always be tracked.
- **Sequential Scraping**: Bulk cron scraping operates sequentially to prevent triggering anti-bot rate limits on the target mock store.
- **No User Authentication**: By design specification, the dashboard is open without multi-user auth partitions.
