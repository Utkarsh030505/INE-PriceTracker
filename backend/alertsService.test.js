import { jest } from '@jest/globals';
import {
  detectPriceDrop,
  detectBackInStock,
  isOutOfStock,
  isInStock,
  processAlertsForProduct,
} from './services/alertsService.js';

describe('alertsService - Price Drop Detection', () => {
  test('detects genuine price decrease when threshold is 0', () => {
    const res = detectPriceDrop(10000, 9000, 0);
    expect(res.triggered).toBe(true);
    expect(res.percentageDrop).toBe(10);
  });

  test('detects genuine price decrease when threshold > 0 and drop meets threshold', () => {
    // 10000 -> 8500 is a 15% drop, threshold is 10%
    const res = detectPriceDrop(10000, 8500, 10);
    expect(res.triggered).toBe(true);
    expect(res.percentageDrop).toBe(15);
  });

  test('does not trigger when price drop is below configured threshold', () => {
    // 10000 -> 9500 is a 5% drop, threshold is 10%
    const res = detectPriceDrop(10000, 9500, 10);
    expect(res.triggered).toBe(false);
    expect(res.percentageDrop).toBe(5);
  });

  test('does not trigger when price is unchanged (equal price)', () => {
    const res = detectPriceDrop(9521, 9521, 0);
    expect(res.triggered).toBe(false);
    expect(res.percentageDrop).toBeNull();
  });

  test('does not trigger when price increased', () => {
    const res = detectPriceDrop(8000, 9500, 0);
    expect(res.triggered).toBe(false);
    expect(res.percentageDrop).toBeNull();
  });

  test('does not calculate percentage or trigger when previous price <= 0', () => {
    expect(detectPriceDrop(0, 5000, 0).triggered).toBe(false);
    expect(detectPriceDrop(-100, 5000, 0).triggered).toBe(false);
    expect(detectPriceDrop(null, 5000, 0).triggered).toBe(false);
    expect(detectPriceDrop(undefined, 5000, 0).triggered).toBe(false);
  });

  test('does not trigger when current price <= 0 or invalid', () => {
    expect(detectPriceDrop(5000, 0, 0).triggered).toBe(false);
    expect(detectPriceDrop(5000, -50, 0).triggered).toBe(false);
    expect(detectPriceDrop(5000, null, 0).triggered).toBe(false);
  });
});

describe('alertsService - Back In Stock Detection', () => {
  test('triggers when previous stock is out of stock and current stock is in stock', () => {
    expect(detectBackInStock('out of stock', 'in stock (5)').triggered).toBe(true);
    expect(detectBackInStock('Out of Stock', 'In stock').triggered).toBe(true);
    expect(detectBackInStock('out of stock', 'Only 2 left').triggered).toBe(true);
  });

  test('does not trigger for IN_STOCK -> IN_STOCK', () => {
    expect(detectBackInStock('in stock (10)', 'in stock (5)').triggered).toBe(false);
  });

  test('does not trigger for IN_STOCK -> OUT_OF_STOCK', () => {
    expect(detectBackInStock('in stock (5)', 'out of stock').triggered).toBe(false);
  });

  test('does not trigger for UNKNOWN -> IN_STOCK', () => {
    expect(detectBackInStock('unknown', 'in stock (10)').triggered).toBe(false);
    expect(detectBackInStock(null, 'in stock (10)').triggered).toBe(false);
  });
});

describe('alertsService - Stock Parsing Helpers', () => {
  test('isOutOfStock identifies out of stock formats correctly', () => {
    expect(isOutOfStock('out of stock')).toBe(true);
    expect(isOutOfStock('Out of Stock')).toBe(true);
    expect(isOutOfStock('in stock (5)')).toBe(false);
    expect(isOutOfStock(null)).toBe(false);
  });

  test('isInStock identifies positive stock states correctly', () => {
    expect(isInStock('in stock (5)')).toBe(true);
    expect(isInStock('In stock')).toBe(true);
    expect(isInStock('Only 1 left')).toBe(true);
    expect(isInStock('Selling fast — 2 left')).toBe(true);
    expect(isInStock('out of stock')).toBe(false);
    expect(isInStock('unknown')).toBe(false);
    expect(isInStock(null)).toBe(false);
  });
});

describe('alertsService - Duplicate Prevention & Persistence', () => {
  test('prevents duplicate alert insertion for the same transition', async () => {
    const product = {
      id: 'prod-uuid-1',
      product_name: 'Test Headphones',
      current_price: 10000,
      current_stock: 'in stock',
      price_alert_enabled: true,
      price_drop_threshold_pct: 0,
    };

    // Mock Supabase: first check returns existing alert
    const mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'existing-alert-id' } }),
          })),
        })),
        insert: jest.fn(),
      })),
    };

    const created = await processAlertsForProduct(product, 9000, 'in stock', mockSupabase);
    expect(created).toHaveLength(0);
    expect(mockSupabase.from).toHaveBeenCalledWith('product_alerts');
  });

  test('inserts new alert when transition is unique', async () => {
    const product = {
      id: 'prod-uuid-2',
      product_name: 'Test Amplifier',
      current_price: 15000,
      current_stock: 'out of stock',
      price_alert_enabled: true,
      stock_alert_enabled: true,
      price_drop_threshold_pct: 0,
    };

    const mockInsertedAlert = {
      id: 'new-alert-uuid',
      alert_type: 'price_drop',
      previous_price: 15000,
      current_price: 12000,
    };

    const mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn().mockResolvedValue({ data: null }), // No duplicate!
          })),
        })),
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: mockInsertedAlert, error: null }),
          })),
        })),
      })),
    };

    const created = await processAlertsForProduct(product, 12000, 'in stock', mockSupabase);
    expect(created.length).toBeGreaterThanOrEqual(1);
    expect(created[0].alert_type).toBe('price_drop');
  });

  test('respects disabled price alert setting', async () => {
    const product = {
      id: 'prod-uuid-3',
      product_name: 'Silent Product',
      current_price: 10000,
      current_stock: 'in stock',
      price_alert_enabled: false, // Disabled
    };

    const mockSupabase = { from: jest.fn() };
    const created = await processAlertsForProduct(product, 8000, 'in stock', mockSupabase);
    expect(created).toHaveLength(0);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});
