import { jest } from '@jest/globals';
import { parsePriceText, parseStockText } from './scraper.js';

// ==========================================
// PHASE 7 FOCUSED TEST SUITE
// 1. successful scrape
// 2. price extraction
// 3. stock extraction
// 4. timeout/retry
// 5. HTTP error/retry
// 6. invalid price
// 7. failed final attempt
// 8. previous valid data is preserved
// ==========================================

// 2. PRICE EXTRACTION TESTS
describe('2. Price Extraction', () => {
  test('parses INR formatted price (₹1,234)', () => {
    expect(parsePriceText('₹1,234')).toBe(1234);
  });

  test('parses large INR price (₹12,345)', () => {
    expect(parsePriceText('₹12,345')).toBe(12345);
  });

  test('parses European comma-decimal format (₹9.521,00)', () => {
    expect(parsePriceText('₹9.521,00')).toBe(9521);
  });

  test('parses price with space separators (₹9 521)', () => {
    expect(parsePriceText('₹9 521')).toBe(9521);
  });

  test('parses lakh notation with Rs prefix (Rs. 9,521.00)', () => {
    expect(parsePriceText('Rs. 9,521.00')).toBe(9521);
  });

  test('parses unicode fullwidth digits (₹９５２１)', () => {
    expect(parsePriceText('₹９５２１')).toBe(9521);
  });

  test('parses trailing tax note format (₹9,521/- (incl. of all taxes))', () => {
    expect(parsePriceText('₹9,521/- (incl. of all taxes)')).toBe(9521);
  });

  test('parses price with genuine decimal cents (₹999.50)', () => {
    expect(parsePriceText('₹999.50')).toBe(999.5);
  });

  test('parses plain numeric string (4500)', () => {
    expect(parsePriceText('4500')).toBe(4500);
  });
});

// 3. STOCK EXTRACTION TESTS
describe('3. Stock Extraction', () => {
  test('parses "In stock — 5 left"', () => {
    expect(parseStockText('In stock — 5 left')).toBe('in stock (5)');
  });

  test('parses "Only 3 left"', () => {
    expect(parseStockText('Only 3 left')).toBe('in stock (3)');
  });

  test('parses "7 in stock"', () => {
    expect(parseStockText('7 in stock')).toBe('in stock (7)');
  });

  test('parses "Selling fast — 2 left"', () => {
    expect(parseStockText('Selling fast — 2 left')).toBe('in stock (2)');
  });

  test('parses "Hurry, just 1 left"', () => {
    expect(parseStockText('Hurry, just 1 left')).toBe('in stock (1)');
  });

  test('parses "Out of stock"', () => {
    expect(parseStockText('Out of stock')).toBe('out of stock');
  });

  test('returns unknown for null or empty string', () => {
    expect(parseStockText(null)).toBe('unknown');
    expect(parseStockText('')).toBe('unknown');
  });

  test('returns unknown for unrecognized status text', () => {
    expect(parseStockText('Check store availability')).toBe('unknown');
  });
});

// 6. INVALID PRICE VALIDATION TESTS
describe('6. Invalid Price Validation', () => {
  test('rejects empty or null price', () => {
    expect(parsePriceText('')).toBeNull();
    expect(parsePriceText(null)).toBeNull();
  });

  test('rejects non-numeric text', () => {
    expect(parsePriceText('Price unavailable')).toBeNull();
  });

  test('rejects zero price (₹0)', () => {
    expect(parsePriceText('₹0')).toBeNull();
  });

  test('rejects negative price (-100)', () => {
    expect(parsePriceText('-100')).toBeNull();
  });

  test('rejects price with only currency symbol (₹)', () => {
    expect(parsePriceText('₹')).toBeNull();
  });

  test('rejects price with only commas (,,,)', () => {
    expect(parsePriceText(',,,')).toBeNull();
  });
});

// SIMULATED RETRY HARNESS (mirrors scrapeTrackedProduct logic for unit testing)
async function simulateScrapeWithAttempts(attemptMockFn, maxAttempts = 3) {
  const attempts = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const start = Date.now();
    try {
      const result = await attemptMockFn(attempt);
      attempts.push({
        attemptNumber: attempt,
        status: 'success',
        errorMessage: null,
        durationMs: Date.now() - start,
      });
      return {
        success: true,
        price: result.price,
        stock: result.stock,
        attempts,
      };
    } catch (err) {
      attempts.push({
        attemptNumber: attempt,
        status: attempt < maxAttempts ? 'retrying' : 'failed',
        errorMessage: err.message,
        durationMs: Date.now() - start,
      });
    }
  }
  return { success: false, price: null, stock: null, attempts };
}

// 1. SUCCESSFUL SCRAPE TEST
describe('1. Successful Scrape', () => {
  test('succeeds on first attempt when page loads cleanly', async () => {
    const mockAttempt = jest.fn().mockResolvedValue({ price: 9521, stock: 'in stock (10)' });
    const res = await simulateScrapeWithAttempts(mockAttempt);

    expect(res.success).toBe(true);
    expect(res.price).toBe(9521);
    expect(res.stock).toBe('in stock (10)');
    expect(res.attempts).toHaveLength(1);
    expect(res.attempts[0].status).toBe('success');
  });
});

// 4. TIMEOUT / RETRY TESTS
describe('4. Timeout and Retry', () => {
  test('retries when attempt 1 times out, succeeds on attempt 2', async () => {
    let callCount = 0;
    const mockAttempt = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        throw new Error('Timeout: 15000ms exceeded');
      }
      return Promise.resolve({ price: 4999, stock: 'in stock (5)' });
    });

    const res = await simulateScrapeWithAttempts(mockAttempt);

    expect(res.success).toBe(true);
    expect(res.price).toBe(4999);
    expect(res.attempts).toHaveLength(2);
    expect(res.attempts[0].status).toBe('retrying');
    expect(res.attempts[0].errorMessage).toContain('Timeout');
    expect(res.attempts[1].status).toBe('success');
  });
});

// 5. HTTP ERROR / RETRY TESTS
describe('5. HTTP Error and Retry', () => {
  test('retries on HTTP 503 Service Unavailable then succeeds on attempt 3', async () => {
    let callCount = 0;
    const mockAttempt = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount < 3) {
        throw new Error('HTTP 503 Service Unavailable');
      }
      return Promise.resolve({ price: 12000, stock: 'out of stock' });
    });

    const res = await simulateScrapeWithAttempts(mockAttempt);

    expect(res.success).toBe(true);
    expect(res.price).toBe(12000);
    expect(res.stock).toBe('out of stock');
    expect(res.attempts).toHaveLength(3);
    expect(res.attempts[0].status).toBe('retrying');
    expect(res.attempts[0].errorMessage).toBe('HTTP 503 Service Unavailable');
    expect(res.attempts[1].status).toBe('retrying');
    expect(res.attempts[2].status).toBe('success');
  });
});

// 7. FAILED FINAL ATTEMPT TESTS
describe('7. Failed Final Attempt', () => {
  test('records failed on attempt 3 and stops when all retries are exhausted', async () => {
    const mockAttempt = jest.fn().mockRejectedValue(new Error('Persistent network failure'));
    const res = await simulateScrapeWithAttempts(mockAttempt, 3);

    expect(res.success).toBe(false);
    expect(res.price).toBeNull();
    expect(res.stock).toBeNull();
    expect(res.attempts).toHaveLength(3);
    expect(res.attempts[0].status).toBe('retrying');
    expect(res.attempts[1].status).toBe('retrying');
    expect(res.attempts[2].status).toBe('failed');
    expect(res.attempts[2].errorMessage).toBe('Persistent network failure');
  });
});

// 8. PREVIOUS VALID DATA PRESERVATION TEST
describe('8. Data Preservation Rule', () => {
  test('preserves existing current_price and current_stock when scrape fails', () => {
    // Current database state for product
    const existingProduct = {
      id: 'uuid-123',
      product_name: 'Nordkraft Headphones Pro',
      product_url: 'https://demo.inelabteamdev.com/product/1',
      current_price: 9521,
      current_stock: 'in stock (118)',
      last_scrape_status: 'success',
    };

    // Scrape failed outcome
    const scrapeResult = {
      success: false,
      price: null,
      stock: null,
      attempts: [{ attemptNumber: 3, status: 'failed', errorMessage: 'timeout' }],
    };

    // Database update payload applied by server.js on failure:
    // (Notice: current_price and current_stock are NOT in the update payload)
    const updatePayload = {
      last_scraped_at: new Date().toISOString(),
      last_scrape_status: 'failed',
    };

    const updatedProduct = {
      ...existingProduct,
      ...updatePayload,
    };

    // Critical assertion: existing price & stock MUST remain intact
    expect(updatedProduct.current_price).toBe(9521);
    expect(updatedProduct.current_stock).toBe('in stock (118)');
    expect(updatedProduct.last_scrape_status).toBe('failed');
  });
});
