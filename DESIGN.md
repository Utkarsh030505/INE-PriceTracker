# Design Notes — INE Product Price Tracker

## 1. Scraping Strategy & Why Playwright was Required

The initial task was to evaluate standard HTTP fetch + Cheerio parsing against the target INE mock store (`https://demo.inelabteamdev.com/`). Technical inspection immediately revealed that simple HTTP scraping is not viable for the following architectural reasons:

1. **Client-Side SPA Architecture**: The server returns an empty HTML document (`<div id="root"></div>`). The application is entirely rendered by client-side React 19 JavaScript.
2. **Missing Price/Stock in APIs**: The store's REST endpoints (`/api/catalog` and `/api/product/:id`) return metadata only (name, description, specs, category). Neither price nor stock availability are present in any API payload.
3. **Anti-Bot & Interaction Barriers**:
   - **Mouse Interaction Tracker**: The price block tracks cursor movements via internal listeners, requiring a minimum of 8 movements and $\ge 600\text{ ms}$ dwell time before enabling the "Reveal price" button.
   - **Canvas & WebGL Fingerprinting**: The frontend executes canvas drawing challenges (`ar()`), WebGL context extraction (`or()`), and frame-timing challenges (`sr()`) before issuing a challenge token.
   - **Decoy Elements**: The DOM renders hidden decoy elements (`<span class="price-value" aria-hidden="true" style="display:none">`) with fake values designed to trick naive scrapers.
   - **Dynamic Obfuscated Layout**: CSS classes are randomized via `/api/layout`.

**Playwright (Chromium)** was chosen because a real browser engine can execute client-side JavaScript, pass canvas/WebGL checks, simulate realistic cursor movements, dismiss cookie overlays, and resolve the live price challenge in real time.

---

## 2. Product Search Index vs. Dynamic Price/Stock Scraping

There is a strict architectural separation of concerns between **product discovery** and **live price tracking**:

```
┌──────────────────────────────────────────────────┐
│              PRODUCT SEARCH INDEX                │
│             (`backend/catalog.json`)             │
│  - Static metadata: id, name, brand, slug, url   │
│  - ZERO price or stock values                    │
│  - Instant, deterministic autocompletion         │
└─────────────────────────┬────────────────────────┘
                          │ User selects product to track
                          ▼
┌──────────────────────────────────────────────────┐
│              DYNAMIC LIVE SCRAPER                │
│             (Playwright Chromium)                │
│  - Executes live browser interaction on demand   │
│  - Resolves anti-bot challenges                  │
│  - Extracts real-time price & stock from DOM     │
│  - Persists directly into Supabase               │
└──────────────────────────────────────────────────┘
```

- **`catalog.json` as a Search Index**: The mock store's `/api/catalog` endpoint returned random subsets and rate-limited rapid calls with HTTP 429. Indexing all 1,000 product names, brands, categories, and slugs offline provides instant, deterministic search with zero rate-limit risks.
- **Why Price/Stock Never Come From `catalog.json`**: The core purpose of a price tracker is detecting price fluctuations over time. If prices were read from an index, they would be static and stale. Price and stock are **always** extracted dynamically by launching Playwright on the live product URL (`https://demo.inelabteamdev.com/product/:id`).

---

## 3. Search Reliability Problem & Solution

### The Problem
During early testing, searching for valid products like `"Nordkraft Headphones Three"` occasionally returned 1 result and frequently returned 0 results. Root cause analysis revealed:
1. The mock store's catalog endpoint returns a randomly shuffled 60-item sample on every call. Querying only 5 pages covered $\approx 25\%$ of the catalog per request, giving a $75\%$ failure rate for any specific product.
2. Rapid typing triggered unauthenticated Node fetch calls that hit HTTP 429 rate limits, causing silent loop breaks.
3. In `SearchBar.jsx`, asynchronous requests returned out-of-order, allowing older slow requests to overwrite newer results.

### The Solution
1. **Pre-Indexed Catalog**: All 1,000 product metadata records were harvested and saved to `backend/catalog.json`, loaded into an in-memory cache on backend startup.
2. **Deterministic Relevance Ranking**: Normalized, case-insensitive scoring prioritizes exact name matches $\to$ prefix matches $\to$ substring matches, with a stable ascending `id` tie-breaker.
3. **Frontend Request Sequence Tracking**: `latestRequestIdRef` in `SearchBar.jsx` tracks request order and discards stale out-of-order responses.
4. **Form Submission & Debounce**: Added a `<form onSubmit>` handler for immediate `Enter` submission alongside a sensible 350ms typing debounce.

---

## 4. Resilience, Retries & Timeouts

### Retry Strategy
- **Maximum Attempts**: 3 attempts per scrape job.
- **Exponential Backoff**: 1s $\to$ 2s $\to$ 4s delay between retry attempts.
- **Attempt Transparency**: Every individual attempt is logged to the `scrape_logs` table with attempt number, status (`success`, `retrying`, or `failed`), duration in milliseconds, and detailed error messages.

### Timeout Strategy
- **Page Navigation**: 15,000ms timeout for initial navigation.
- **Content & Challenge Resolution**: 15,000ms timeout for price block loading.
- Early detection of store error pages (`.grid-empty.grid-error`) triggers immediate retry rather than stalling on selector timeouts.

### Data Validation & Preservation Rule
- **Price Validation**: Extracted text is normalized to handle INR symbols (`₹`), European comma-decimal notation (`₹9.521,00`), Lakh notation (`Rs. 9,521.00`), unicode fullwidth numerals, and trailing tax notes. Zero, negative, and non-numeric values are rejected.
- **Stock Validation**: Matches all 5 dynamic store badge phrasing formats (`"In stock — N left"`, `"Only N left"`, `"N in stock"`, etc.) and `"Out of stock"`.
- **Previous Valid Data Preservation**: If a scrape fails after exhausting all 3 retries, `last_scrape_status` is updated to `'failed'`, but existing valid `current_price` and `current_stock` in Supabase are **never overwritten with null**. Stale good data is preserved until the next successful scrape.
- **Price History**: Written to the `price_history` table exclusively on successful scrapes.

---

## 5. Scheduling & Deployment Architecture

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

- **Frontend on Vercel**: Static React single-page application served via edge CDN. Configured with `VITE_API_URL` pointing to the Render backend.
- **Backend on Render**: Node.js/Express service with Playwright and Chromium dependencies installed. Exposes REST endpoints and coordinates scraping.
- **Database on Supabase**: Managed PostgreSQL relational database with 3 tables (`tracked_products`, `price_history`, `scrape_logs`), indexes on foreign keys and timestamps, and permissive Row Level Security (RLS).
- **External Cron via cron-job.org**: Node in-process timers (`setInterval`) drift and reset on server restarts. An external HTTPS webhook calling `POST /api/scrape/run` every 2 hours guarantees independent, reliable scheduling. Protected by a `Bearer CRON_SECRET` header.

---

## 6. Trade-offs & Known Limitations

| Decision | Trade-off / Rationale |
|---|---|
| **Playwright vs. Cheerio** | Playwright is more memory-intensive and slower than HTTP parsing, but required due to client-side anti-bot challenges and DOM encryption. |
| **Offline Search Index vs. Live Store Search** | The mock store lacks a server-side search API and returns random catalog samples. Pre-indexing 1,000 product metadata records ensures $<1\text{ ms}$ deterministic search, but dynamic additions to the store require re-indexing. |
| **Sequential Scraping in Bulk Cron** | Scraping products sequentially takes longer than parallel execution, but avoids overwhelming the target mock store and hitting rate limits. |
| **Open Dashboard (No Authentication)** | Keeping the application open without multi-user auth simplifies deployment and evaluation, fulfilling the internship specification without over-engineering. |

---

## 7. AI-Assisted Development Reflection

### Initial AI Approach
The initial agent plan attempted to break development into parallel subagents to generate frontend and backend files concurrently. The agent also initially assumed the catalog API would accept a query parameter (`/api/catalog?q=...`) for server-side search.

### What Went Wrong
1. **Subagent Instantiation Failure**: Subagents failed due to environment configuration constraints (`planner config is not declarative`).
2. **Catalog Misconceptions**: Initial tests revealed that the mock store completely ignored the `q` query parameter and randomized products across pagination, causing intermittent empty search results.
3. **Format Variations**: The store introduced obfuscated price rendering variations (European comma-decimal separators, unicode digits, and layout randomization) that broke standard regex number stripping.
4. **Environment Naming Discrepancies**: Supabase API credentials were configured in `.env` under `SUPABASE_PUBLISHABLE_KEY` rather than `SUPABASE_ANON_KEY`, resulting in initial 401 connection failures.

### How It Was Corrected
1. **Direct System Execution**: Cleaned up failed subagents and executed all code generation, testing, and debugging directly.
2. **Robust Reverse Engineering**: Thoroughly inspected the client-side bundle and live DOM, discovering the mouse-movement requirement ($\ge 600\text{ ms}$ dwell) and the 5 stock text variations.
3. **Deterministic Search Engine**: Harvested all 1,000 product identities into `backend/catalog.json` as a pure search index, completely decoupling search reliability from the store's pagination randomizer.
4. **Resilient Parser**: Upgraded `parsePriceText` to handle all international currency and unicode numeral formats cleanly, verified by 28 automated Jest tests.
