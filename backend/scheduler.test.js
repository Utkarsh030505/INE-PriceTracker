import {
  SUPPORTED_INTERVALS,
  DEFAULT_INTERVAL_MINUTES,
  isValidInterval,
  isProductDue,
  calculateNextScrapeAt,
} from './services/schedulerService.js';

describe('schedulerService - Interval Validation', () => {
  test('supported intervals include 30, 60, 120, 360, 720, 1440', () => {
    expect(SUPPORTED_INTERVALS).toEqual([30, 60, 120, 360, 720, 1440]);
    expect(isValidInterval(30)).toBe(true);
    expect(isValidInterval(60)).toBe(true);
    expect(isValidInterval(120)).toBe(true);
    expect(isValidInterval(360)).toBe(true);
    expect(isValidInterval(720)).toBe(true);
    expect(isValidInterval(1440)).toBe(true);
  });

  test('rejects unsupported intervals', () => {
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

  test('returns false when next_scrape_at is in the future (product not due)', () => {
    const futureTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect(isProductDue({ next_scrape_at: futureTime })).toBe(false);
  });
});

describe('schedulerService - calculateNextScrapeAt', () => {
  test('correctly adds interval minutes to base time', () => {
    const base = new Date('2026-09-20T12:00:00.000Z');

    const next30 = calculateNextScrapeAt(30, base);
    expect(new Date(next30).toISOString()).toBe('2026-09-20T12:30:00.000Z');

    const next60 = calculateNextScrapeAt(60, base);
    expect(new Date(next60).toISOString()).toBe('2026-09-20T13:00:00.000Z');

    const next120 = calculateNextScrapeAt(120, base);
    expect(new Date(next120).toISOString()).toBe('2026-09-20T14:00:00.000Z');
  });

  test('uses default 120-minute interval if an unsupported value is passed', () => {
    const base = new Date('2026-09-20T12:00:00.000Z');
    const result = calculateNextScrapeAt(999, base); // Unsupported -> fallback to 120m
    expect(new Date(result).toISOString()).toBe('2026-09-20T14:00:00.000Z');
  });

  test('ensures failed scrape still receives a valid future next_scrape_at timestamp', () => {
    const now = new Date('2026-09-20T10:00:00.000Z');
    const interval = 60; // 1 hour
    const nextScrape = calculateNextScrapeAt(interval, now);

    expect(new Date(nextScrape).getTime()).toBeGreaterThan(now.getTime());
    expect(new Date(nextScrape).toISOString()).toBe('2026-09-20T11:00:00.000Z');
  });
});
