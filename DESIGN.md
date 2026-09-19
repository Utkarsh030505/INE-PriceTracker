# Design Notes — INE Price Tracker

## Scraping Strategy

The INE Demo Store (`demo.inelabteamdev.com`) is a React SPA with significant anti-bot measures:

- **Canvas and WebGL fingerprinting** — the store generates browser fingerprints to verify it's a real browser
- **Mouse movement tracking** — requires minimum 8 mouse moves over the price area with 600ms+ dwell time before prices can be revealed
- **Challenge token exchange** — prices are fetched through an obfuscated multi-step process involving encrypted challenge/response
- **Dynamic CSS class randomization** — the `/api/layout` endpoint randomizes CSS class names on each load

HTTP scraping (fetch + Cheerio) was evaluated first but is not viable because price and stock data are not present in any API response or server-rendered HTML. The HTML body is just `<div id="root"></div>` — all content is JavaScript-rendered.

**Playwright** was chosen because it provides a real Chromium browser that passes all fingerprinting checks and can simulate the required mouse interactions to trigger the price reveal.

## Retry Strategy

- **Maximum 3 attempts** per scrape operation
- **Exponential backoff**: 1s → 2s → 4s between attempts
- Each attempt is independently logged with its outcome, timing, and error details
- Transient failures (timeouts, network errors) trigger a retry
- The final attempt is marked `failed` if all attempts are exhausted

## Timeout Strategy

- **Page navigation**: 15-second timeout (accounts for slow server responses)
- **Price reveal wait**: 15-second timeout (the store's challenge system can take several seconds)
- **Total worst-case per product**: ~45 seconds (3 attempts × 15s each)
- Timeouts are generous to avoid false failures on slow connections

## Data Validation

- **Price**: must be a positive number after stripping currency formatting (₹, commas). Zero and negative values are rejected.
- **Stock**: must match known patterns ("in stock", "out of stock") or defaults to "unknown". The store uses 5 random text formats for in-stock status — all are parsed via regex to extract the quantity.
- Both values are validated before being saved. A scrape is only marked `success` if price is valid.

## Failure Handling

When a scrape fails:
- `current_price` and `current_stock` are **preserved** (never overwritten with null)
- Only `last_scrape_status` is updated to `"failed"`
- All scrape attempts are recorded in `scrape_logs` regardless of outcome
- `price_history` only records successful, validated scrapes

## Why Previous Valid Data is Preserved

If a scrape fails due to a transient issue (network timeout, store temporarily down, challenge system failure), the last known good price and stock are still the best available data. Overwriting them with null would:
1. Lose information
2. Break the price chart display
3. Mislead users into thinking the product has no price

The `last_scrape_status` field clearly indicates whether the current values are from a recent successful scrape or are stale.

## Why External Cron

`setInterval` in Node.js is unreliable for production scheduling:
- Process restarts clear the timer
- Long-running intervals drift
- Memory leaks can accumulate
- No visibility into execution history

External cron services like cron-job.org:
- Run independently of the application lifecycle
- Provide execution logs and failure notifications
- The schedule can be adjusted without redeploying
- The cron simply calls `POST /api/scrape/run` with a secret header

## Deployment Architecture

```
┌─────────┐     ┌──────────┐     ┌──────────┐
│  Vercel │────▶│  Render  │────▶│ Supabase │
│(Frontend)│    │(Backend) │     │  (DB)    │
└─────────┘     └──────────┘     └──────────┘
                     ▲
              ┌──────────────┐
              │ cron-job.org │
              │ (every 2 hrs)│
              └──────────────┘
```

- **Frontend**: Static React app served from Vercel's CDN. Zero server-side processing.
- **Backend**: Express server on Render with Playwright installed. Handles scraping, API, and database operations.
- **Database**: Supabase provides managed PostgreSQL with automatic backups and a REST API.
- **Scheduler**: cron-job.org triggers the `/api/scrape/run` endpoint every 2 hours.

## Trade-offs

| Decision | Trade-off |
|---|---|
| Playwright over Cheerio | Slower and more resource-intensive, but required by the store's anti-bot measures |
| Sequential scraping | Slower for many products, but avoids overwhelming the target store and hitting rate limits |
| External cron | Extra service to configure, but more reliable than in-process scheduling |
| No authentication | Simpler to build and deploy, but not suitable for multi-user production use |
| Client-side catalog search | Must fetch multiple catalog pages from the INE API, but the store has no search endpoint |
| 3 database tables only | Simple schema, may not scale for analytics — sufficient for the assignment scope |

## AI-Assisted Development

### Initial AI approach
[fill this in after reviewing the implementation]

### What went wrong
[fill this in after reviewing the implementation]

### How I corrected it
[fill this in after reviewing the implementation]
