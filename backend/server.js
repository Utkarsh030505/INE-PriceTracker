import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import supabase from './supabase.js';
import { searchProducts, scrapeTrackedProduct } from './scraper.js';
import { processAlertsForProduct } from './services/alertsService.js';
import { calculateNextScrapeAt, isProductDue, isValidInterval } from './services/schedulerService.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (!process.env.FRONTEND_URL) return callback(null, true);
    const normalizedFrontend = process.env.FRONTEND_URL.replace(/\/$/, '');
    if (origin === normalizedFrontend || origin.startsWith('http://localhost:')) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
}));
app.use(express.json());

// --- Health ---

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Dashboard statistics ---

app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const [productsRes, scrapeLogsTodayRes, failedLogsRes, alertsRes] = await Promise.all([
      supabase.from('tracked_products').select('current_stock'),
      supabase
        .from('scrape_logs')
        .select('id', { count: 'exact', head: true })
        .gte('scraped_at', today.toISOString()),
      supabase
        .from('scrape_logs')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'failed'),
      supabase
        .from('product_alerts')
        .select('id', { count: 'exact', head: true })
        .eq('alert_type', 'price_drop'),
    ]);

    const products = productsRes.data || [];
    let inStock = 0;
    let outOfStock = 0;

    for (const p of products) {
      const stock = (p.current_stock || '').toLowerCase();
      if (stock.includes('out of stock')) {
        outOfStock++;
      } else if (stock.includes('in stock') || stock.includes('only') || stock.includes('left')) {
        inStock++;
      }
    }

    res.json({
      totalTracked: products.length,
      inStock,
      outOfStock,
      scrapesToday: scrapeLogsTodayRes.count ?? 0,
      failedScrapes: failedLogsRes.count ?? 0,
      priceDrops: alertsRes?.count ?? 0,
    });
  } catch (err) {
    console.error('Dashboard stats error:', err.message);
    res.status(500).json({ error: 'Failed to compute dashboard stats' });
  }
});

// --- Search INE store products ---

app.get('/api/products/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length === 0) return res.json([]);
    const results = await searchProducts(q);
    res.json(results);
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

// --- Tracked products ---

function formatTrackedProduct(p) {
  if (!p) return p;
  let previous_price = null;
  if (Array.isArray(p.price_history) && p.price_history.length > 1) {
    const sorted = [...p.price_history].sort(
      (a, b) => new Date(b.scraped_at) - new Date(a.scraped_at)
    );
    previous_price = sorted[1]?.price != null ? Number(sorted[1].price) : null;
  }
  return {
    ...p,
    previous_price: p.previous_price ?? previous_price,
    scrape_interval_minutes: p.scrape_interval_minutes || 120,
    next_scrape_at: p.next_scrape_at || null,
    price_alert_enabled: p.price_alert_enabled ?? true,
    stock_alert_enabled: p.stock_alert_enabled ?? true,
    price_drop_threshold_pct: p.price_drop_threshold_pct ?? 0,
  };
}

app.get('/api/products/tracked', async (req, res) => {
  const { data, error } = await supabase
    .from('tracked_products')
    .select('*, price_history(price, scraped_at)')
    .order('created_at', { ascending: false });
  if (error) {
    const fallback = await supabase
      .from('tracked_products')
      .select('*')
      .order('created_at', { ascending: false });
    if (fallback.error) return res.status(500).json({ error: fallback.error.message });
    return res.json((fallback.data || []).map(formatTrackedProduct));
  }
  res.json((data || []).map(formatTrackedProduct));
});

app.post('/api/products/track', async (req, res) => {
  const { product_name, product_url } = req.body;
  if (!product_name || !product_url) {
    return res.status(400).json({ error: 'product_name and product_url are required' });
  }

  // Safe diagnostics (DO NOT print actual secret values)
  console.log(`SUPABASE_URL loaded: ${Boolean(process.env.SUPABASE_URL)}`);
  console.log(`SUPABASE_ANON_KEY loaded: ${Boolean(process.env.SUPABASE_ANON_KEY)}`);
  console.log(`SUPABASE_PUBLISHABLE_KEY loaded: ${Boolean(process.env.SUPABASE_PUBLISHABLE_KEY)}`);

  // Check if already tracked
  const { data: existing, error: selectError } = await supabase
    .from('tracked_products')
    .select('*')
    .eq('product_url', product_url)
    .single();

  if (selectError && selectError.code !== 'PGRST116') {
    console.error('--- Supabase Select Diagnostic ---');
    console.error('Message:', selectError.message);
    console.error('Code:', selectError.code);
    console.error('Details:', selectError.details);
    console.error('Hint:', selectError.hint);
    console.error('Status:', selectError.status || selectError.statusCode || 'N/A');
    console.error('-----------------------------------');
  }

  if (existing) return res.json(formatTrackedProduct(existing));

  const { data, error } = await supabase
    .from('tracked_products')
    .insert({ product_name, product_url })
    .select()
    .single();

  if (error) {
    console.error('--- Supabase Insert Diagnostic ---');
    console.error('Message:', error.message);
    console.error('Code:', error.code);
    console.error('Details:', error.details);
    console.error('Hint:', error.hint);
    console.error('Status:', error.status || error.statusCode || 'N/A');
    console.error('Full Error Object:', JSON.stringify(error, null, 2));
    console.error('-----------------------------------');

    return res.status(error.status || 500).json({
      error: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      status: error.status || 500
    });
  }

  res.status(201).json(formatTrackedProduct(data));
});

app.get('/api/products/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('tracked_products')
    .select('*, price_history(price, scraped_at)')
    .eq('id', req.params.id)
    .single();
  if (error) {
    const fallback = await supabase
      .from('tracked_products')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (fallback.error) return res.status(404).json({ error: 'Product not found' });
    return res.json(formatTrackedProduct(fallback.data));
  }
  res.json(formatTrackedProduct(data));
});

app.delete('/api/products/:id', async (req, res) => {
  const { error } = await supabase
    .from('tracked_products')
    .delete()
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// --- Price history ---

app.get('/api/products/:id/history', async (req, res) => {
  const { data, error } = await supabase
    .from('price_history')
    .select('*')
    .eq('tracked_product_id', req.params.id)
    .order('scraped_at', { ascending: true })
    .limit(50);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// --- Scrape logs ---

app.get('/api/products/:id/logs', async (req, res) => {
  const { data, error } = await supabase
    .from('scrape_logs')
    .select('*')
    .eq('tracked_product_id', req.params.id)
    .order('scraped_at', { ascending: false })
    .limit(50);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// --- Scrape single product ---

async function runScrapeForProduct(product) {
  const result = await scrapeTrackedProduct(product);

  // Log each attempt
  for (const attempt of result.attempts) {
    await supabase.from('scrape_logs').insert({
      tracked_product_id: product.id,
      attempt_number: attempt.attemptNumber,
      status: attempt.status,
      error_message: attempt.errorMessage,
      duration_ms: attempt.durationMs,
    });
  }

  // Calculate next scheduled scrape time based on configured interval
  const nextScrapeAt = calculateNextScrapeAt(product.scrape_interval_minutes, new Date());

  if (result.success) {
    // Update product with new price/stock and next_scrape_at
    await supabase
      .from('tracked_products')
      .update({
        current_price: result.price,
        current_stock: result.stock,
        last_scraped_at: new Date().toISOString(),
        last_scrape_status: 'success',
        next_scrape_at: nextScrapeAt,
      })
      .eq('id', product.id);

    // Record price history
    await supabase.from('price_history').insert({
      tracked_product_id: product.id,
      price: result.price,
      stock_status: result.stock,
    });

    // Process price-drop and back-in-stock alerts safely (never fails the scrape)
    try {
      await processAlertsForProduct(product, result.price, result.stock, supabase);
    } catch (alertErr) {
      console.error('[Alert] Error in scrape flow:', alertErr.message);
    }
  } else {
    // Failed: preserve current_price and current_stock, update status and schedule future retry
    await supabase
      .from('tracked_products')
      .update({
        last_scraped_at: new Date().toISOString(),
        last_scrape_status: 'failed',
        next_scrape_at: nextScrapeAt,
      })
      .eq('id', product.id);
  }

  return result;
}

// --- Frequency Configuration API ---

app.patch('/api/products/:id/frequency', async (req, res) => {
  try {
    const { scrape_interval_minutes } = req.body;
    const interval = Number(scrape_interval_minutes);
    if (!isValidInterval(interval)) {
      return res.status(400).json({
        error: 'Invalid scrape interval. Supported values: 30, 60, 120, 360, 720, 1440 minutes.',
      });
    }

    const next_scrape_at = calculateNextScrapeAt(interval, new Date());

    const { data, error } = await supabase
      .from('tracked_products')
      .update({
        scrape_interval_minutes: interval,
        next_scrape_at,
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    console.error('Update frequency error:', err.message);
    res.status(500).json({ error: 'Failed to update frequency' });
  }
});

// --- Alerts API ---

app.get('/api/alerts', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('product_alerts')
      .select('*, tracked_products(product_name, product_url)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      // Graceful fallback if join not available
      const { data: fallbackData } = await supabase
        .from('product_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      return res.json(fallbackData || []);
    }
    res.json(data || []);
  } catch (err) {
    console.error('Fetch alerts error:', err.message);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

app.get('/api/products/:id/alerts', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('product_alerts')
      .select('*')
      .eq('tracked_product_id', req.params.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return res.json([]);
    res.json(data || []);
  } catch (err) {
    console.error('Fetch product alerts error:', err.message);
    res.status(500).json({ error: 'Failed to fetch product alerts' });
  }
});

app.patch('/api/products/:id/alert-settings', async (req, res) => {
  try {
    const { price_alert_enabled, stock_alert_enabled, price_drop_threshold_pct } = req.body;
    const updates = {};
    if (typeof price_alert_enabled === 'boolean') updates.price_alert_enabled = price_alert_enabled;
    if (typeof stock_alert_enabled === 'boolean') updates.stock_alert_enabled = stock_alert_enabled;
    if (price_drop_threshold_pct !== undefined) {
      const val = Number(price_drop_threshold_pct);
      if (isNaN(val) || val < 0 || val > 100) {
        return res.status(400).json({ error: 'Threshold must be between 0 and 100' });
      }
      updates.price_drop_threshold_pct = val;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid alert settings provided' });
    }

    const { data, error } = await supabase
      .from('tracked_products')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    console.error('Update alert settings error:', err.message);
    res.status(500).json({ error: 'Failed to update alert settings' });
  }
});

app.post('/api/products/:id/scrape', async (req, res) => {
  try {
    const { data: product, error } = await supabase
      .from('tracked_products')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !product) return res.status(404).json({ error: 'Product not found' });

    const result = await runScrapeForProduct(product);
    res.json(result);
  } catch (err) {
    console.error('Scrape error:', err.message);
    res.status(500).json({ error: 'Scrape failed: ' + err.message });
  }
});

// --- Bulk scrape (cron endpoint — async fire-and-forget) ---

let isScraping = false;

app.post('/api/scrape/run', async (req, res) => {
  const rawAuth = req.headers['x-cron-secret'] || req.headers['authorization'];
  const secret = rawAuth ? rawAuth.replace(/^Bearer\s+/i, '').trim() : null;
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Prevent overlapping scrape batches
  if (isScraping) {
    return res.json({ success: true, status: 'already_running' });
  }

  try {
    const { data: products, error } = await supabase
      .from('tracked_products')
      .select('*');

    if (error) return res.status(500).json({ error: error.message });
    if (!products || products.length === 0) {
      return res.json({ success: true, status: 'no_products', scraped: 0, failed: 0 });
    }

    // Filter products that are currently due for scraping
    const now = new Date();
    const dueProducts = products.filter((p) => isProductDue(p, now));

    if (dueProducts.length === 0) {
      return res.json({
        success: true,
        status: 'no_products_due',
        totalTracked: products.length,
        due: 0,
        scraped: 0,
        failed: 0,
      });
    }

    // Acquire lock BEFORE responding
    isScraping = true;
    const dueCount = dueProducts.length;

    // Respond immediately — cron-job.org gets HTTP 200 in < 1 second
    res.json({
      success: true,
      status: 'started',
      due: dueCount,
      totalTracked: products.length,
    });

    // Run the existing scrape batch in the background (fire-and-forget)
    // This continues after the HTTP response has been sent
    setImmediate(async () => {
      let scraped = 0;
      let failed = 0;
      const startTime = Date.now();
      console.log(`[Cron] Background scrape started for ${dueCount} due product(s) (out of ${products.length} tracked)`);

      try {
        // Scrape due products sequentially — unchanged scraper execution
        for (const product of dueProducts) {
          try {
            const result = await runScrapeForProduct(product);
            if (result.success) scraped++;
            else failed++;
          } catch {
            failed++;
          }
        }
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[Cron] Background scrape finished: ${scraped} scraped, ${failed} failed (${elapsed}s)`);
      } catch (err) {
        console.error('[Cron] Unexpected background scrape error:', err.message);
      } finally {
        isScraping = false;
      }
    });
  } catch (err) {
    isScraping = false;
    console.error('Bulk scrape error:', err.message);
    res.status(500).json({ error: 'Bulk scrape failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`SUPABASE_URL loaded: ${Boolean(process.env.SUPABASE_URL)}`);
  console.log(`SUPABASE_ANON_KEY loaded: ${Boolean(process.env.SUPABASE_ANON_KEY)}`);
  console.log(`SUPABASE_PUBLISHABLE_KEY loaded: ${Boolean(process.env.SUPABASE_PUBLISHABLE_KEY)}`);
});
