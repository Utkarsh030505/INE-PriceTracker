import {
  SUPPORTED_INTERVALS,
  DEFAULT_INTERVAL_MINUTES,
  SCHEDULING_TOLERANCE_MS,
  isValidInterval,
  isProductDue,
  calculateNextScrapeAt,
} from './services/schedulerService.js';

describe('schedulerService - Interval Validation', () => {
  test('supported intervals include 120, 240, 480, 720, 1440', () => {
    expect(SUPPORTED_INTERVALS).toEqual([120, 240, 480, 720, 1440]);
    expect(isValidInterval(120)).toBe(true);
    expect(isValidInterval(240)).toBe(true);
    expect(isValidInterval(480)).toBe(true);
    expect(isValidInterval(720)).toBe(true);
    expect(isValidInterval(1440)).toBe(true);
  });

  test('rejects unsupported and legacy intervals (including 30m, 60m, 360m)', () => {
    expect(isValidInterval(30)).toBe(false);
    expect(isValidInterval(60)).toBe(false);
    expect(isValidInterval(360)).toBe(false);
    expect(isValidInterval(5)).toBe(false);
    expect(isValidInterval(15)).toBe(false);
    expect(isValidInterval(45)).toBe(false);
    expect(isValidInterval(180)).toBe(false);
    expect(isValidInterval(-120)).toBe(false);
    expect(isValidInterval('invalid')).toBe(false);
    expect(isValidInterval(null)).toBe(false);
  });

  test('defaults to 120-minute (2-hour) interval', () => {
    expect(DEFAULT_INTERVAL_MINUTES).toBe(120);
  });
});

describe('schedulerService - Due Check (isProductDue)', () => {
  test('returns true when next_scrape_at is null or missing (newly tracked)', () => {
    expect(isProductDue({ next_scrape_at: null })).toBe(true);
    expect(isProductDue({})).toBe(true);
  });

  test('returns true when next_scrape_at is in the past (product due)', () => {
    const pastTime = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(isProductDue({ next_scrape_at: pastTime })).toBe(true);
  });

  test('returns true when next_scrape_at is exactly now', () => {
    const now = new Date();
    expect(isProductDue({ next_scrape_at: now.toISOString() }, now)).toBe(true);
  });

  test('returns false when next_scrape_at is in the future beyond tolerance (product not due)', () => {
    const futureTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect(isProductDue({ next_scrape_at: futureTime })).toBe(false);
  });

  test('returns true when next_scrape_at is within scheduling tolerance (prevents 2h skip)', () => {
    const now = new Date('2026-09-21T02:01:00.000Z');
    // Product finished scraping 30 seconds into previous batch -> next_scrape_at is 30s ahead of now
    const nextWithinTolerance = new Date('2026-09-21T02:01:30.000Z').toISOString();
    expect(isProductDue({ next_scrape_at: nextWithinTolerance }, now)).toBe(true);
  });

  test('returns false when next_scrape_at is in the future beyond scheduling tolerance', () => {
    const now = new Date('2026-09-21T02:01:00.000Z');
    // 5 minutes in the future -> beyond 2-minute tolerance
    const nextBeyondTolerance = new Date('2026-09-21T02:06:00.000Z').toISOString();
    expect(isProductDue({ next_scrape_at: nextBeyondTolerance }, now)).toBe(false);
  });
});

describe('schedulerService - calculateNextScrapeAt', () => {
  test('focused test: scrape_interval_minutes = 120 correctly adds exactly 120 minutes (2 hours, NOT 240m)', () => {
    const now = new Date('2026-09-21T10:00:00.000Z');
    const interval = 120;
    const nextScrape = calculateNextScrapeAt(interval, now);

    const expectedTime = new Date('2026-09-21T12:00:00.000Z').getTime();
    const actualTime = new Date(nextScrape).getTime();

    // Verify exactly 120 minutes (7,200,000 ms) added to current time
    expect(actualTime - now.getTime()).toBe(120 * 60 * 1000);
    expect(actualTime).toBe(expectedTime);
    expect(nextScrape).toBe('2026-09-21T12:00:00.000Z');
  });

  test('correctly adds interval minutes for all supported intervals (120, 240, 480, 720, 1440)', () => {
    const base = new Date('2026-09-20T12:00:00.000Z');

    // 120 minutes (2 hours)
    const next120 = calculateNextScrapeAt(120, base);
    expect(new Date(next120).toISOString()).toBe('2026-09-20T14:00:00.000Z');
    expect(new Date(next120).getTime() - base.getTime()).toBe(120 * 60 * 1000);

    // 240 minutes (4 hours)
    const next240 = calculateNextScrapeAt(240, base);
    expect(new Date(next240).toISOString()).toBe('2026-09-20T16:00:00.000Z');
    expect(new Date(next240).getTime() - base.getTime()).toBe(240 * 60 * 1000);

    // 480 minutes (8 hours)
    const next480 = calculateNextScrapeAt(480, base);
    expect(new Date(next480).toISOString()).toBe('2026-09-20T20:00:00.000Z');
    expect(new Date(next480).getTime() - base.getTime()).toBe(480 * 60 * 1000);

    // 720 minutes (12 hours)
    const next720 = calculateNextScrapeAt(720, base);
    expect(new Date(next720).toISOString()).toBe('2026-09-21T00:00:00.000Z');
    expect(new Date(next720).getTime() - base.getTime()).toBe(720 * 60 * 1000);

    // 1440 minutes (24 hours)
    const next1440 = calculateNextScrapeAt(1440, base);
    expect(new Date(next1440).toISOString()).toBe('2026-09-21T12:00:00.000Z');
    expect(new Date(next1440).getTime() - base.getTime()).toBe(1440 * 60 * 1000);
  });

  test('uses default 120-minute interval if an unsupported or missing value is passed', () => {
    const base = new Date('2026-09-20T12:00:00.000Z');
    const resultUnsupported = calculateNextScrapeAt(999, base); // Unsupported -> fallback to 120m
    expect(new Date(resultUnsupported).toISOString()).toBe('2026-09-20T14:00:00.000Z');

    const resultRemoved30 = calculateNextScrapeAt(30, base); // 30m removed -> fallback to 120m
    expect(new Date(resultRemoved30).toISOString()).toBe('2026-09-20T14:00:00.000Z');

    const resultRemoved60 = calculateNextScrapeAt(60, base); // 60m removed -> fallback to 120m
    expect(new Date(resultRemoved60).toISOString()).toBe('2026-09-20T14:00:00.000Z');

    const resultUndefined = calculateNextScrapeAt(undefined, base); // Undefined -> fallback to 120m
    expect(new Date(resultUndefined).toISOString()).toBe('2026-09-20T14:00:00.000Z');

    const resultNull = calculateNextScrapeAt(null, base); // Null -> fallback to 120m
    expect(new Date(resultNull).toISOString()).toBe('2026-09-20T14:00:00.000Z');
  });

  test('ensures failed scrape still receives a valid future next_scrape_at timestamp', () => {
    const now = new Date('2026-09-20T10:00:00.000Z');
    const interval = 240; // 4 hours
    const nextScrape = calculateNextScrapeAt(interval, now);

    expect(new Date(nextScrape).getTime()).toBeGreaterThan(now.getTime());
    expect(new Date(nextScrape).toISOString()).toBe('2026-09-20T14:00:00.000Z');
  });
});
