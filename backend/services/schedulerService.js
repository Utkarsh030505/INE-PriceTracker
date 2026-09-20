/**
 * Scheduler service for configurable per-product scrape frequencies
 * Supported intervals in minutes: 30m, 1h, 2h, 6h, 12h, 24h
 */

export const SUPPORTED_INTERVALS = [30, 60, 120, 360, 720, 1440];
export const DEFAULT_INTERVAL_MINUTES = 120; // 2 hours default

export const INTERVAL_LABELS = {
  30: 'Every 30 minutes',
  60: 'Every 1 hour',
  120: 'Every 2 hours',
  360: 'Every 6 hours',
  720: 'Every 12 hours',
  1440: 'Every 24 hours',
};

/**
 * Validates whether an interval is one of the supported values
 */
export function isValidInterval(minutes) {
  const num = Number(minutes);
  return SUPPORTED_INTERVALS.includes(num);
}

/**
 * Determines whether a product is currently due for scraping
 */
export function isProductDue(product, now = new Date()) {
  if (!product) return false;
  // If next_scrape_at is null or not set, it is immediately due
  if (!product.next_scrape_at) return true;

  const nextTime = new Date(product.next_scrape_at).getTime();
  const currentTime = new Date(now).getTime();

  if (isNaN(nextTime)) return true;
  return nextTime <= currentTime;
}

/**
 * Calculates the next scrape timestamp based on interval minutes
 */
export function calculateNextScrapeAt(intervalMinutes, fromTime = new Date()) {
  const num = Number(intervalMinutes);
  const interval = isValidInterval(num) ? num : DEFAULT_INTERVAL_MINUTES;
  const base = new Date(fromTime).getTime();
  const nextMs = isNaN(base) ? Date.now() + interval * 60 * 1000 : base + interval * 60 * 1000;
  return new Date(nextMs).toISOString();
}
