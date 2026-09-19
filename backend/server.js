import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import supabase from './supabase.js';
import { searchProducts, scrapeTrackedProduct } from './scraper.js';

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

app.get('/api/products/tracked', async (req, res) => {
  const { data, error } = await supabase
    .from('tracked_products')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
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

  if (existing) return res.json(existing);

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

  res.status(201).json(data);
});

app.get('/api/products/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('tracked_products')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (error) return res.status(404).json({ error: 'Product not found' });
  res.json(data);
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

  if (result.success) {
    // Update product with new price/stock
    await supabase
      .from('tracked_products')
      .update({
        current_price: result.price,
        current_stock: result.stock,
        last_scraped_at: new Date().toISOString(),
        last_scrape_status: 'success',
      })
      .eq('id', product.id);

    // Record price history
    await supabase.from('price_history').insert({
      tracked_product_id: product.id,
      price: result.price,
      stock_status: result.stock,
    });
  } else {
    // Failed: preserve current_price and current_stock, only update status
    await supabase
      .from('tracked_products')
      .update({
        last_scraped_at: new Date().toISOString(),
        last_scrape_status: 'failed',
      })
      .eq('id', product.id);
  }

  return result;
}

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

// --- Bulk scrape (cron endpoint) ---

app.post('/api/scrape/run', async (req, res) => {
  const rawAuth = req.headers['x-cron-secret'] || req.headers['authorization'];
  const secret = rawAuth ? rawAuth.replace(/^Bearer\s+/i, '').trim() : null;
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { data: products, error } = await supabase
      .from('tracked_products')
      .select('*');

    if (error) return res.status(500).json({ error: error.message });
    if (!products || products.length === 0) {
      return res.json({ success: true, scraped: 0, failed: 0 });
    }

    let scraped = 0;
    let failed = 0;

    // Scrape sequentially to avoid overwhelming the store
    for (const product of products) {
      try {
        const result = await runScrapeForProduct(product);
        if (result.success) scraped++;
        else failed++;
      } catch {
        failed++;
      }
    }

    res.json({ success: true, scraped, failed });
  } catch (err) {
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
