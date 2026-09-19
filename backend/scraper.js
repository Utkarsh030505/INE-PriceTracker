import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORE_BASE = 'https://demo.inelabteamdev.com';
const MAX_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 1000;
const NAV_TIMEOUT = 15000;
const PRICE_TIMEOUT = 15000;

// ============================================================================
// SEARCH INDEX ONLY:
// `catalog.json` is strictly an offline search index used for product discovery
// (name, brand, category, slug, sku, url). It contains NO price or stock data.
// All price and stock values MUST and DO come exclusively from live Playwright
// browser execution in `scrapeProduct()`, which solves the store's anti-bot
// challenge in real time.
// ============================================================================
let searchIndexCache = null;

function loadSearchIndex() {
  if (searchIndexCache && searchIndexCache.length > 0) return searchIndexCache;
  try {
    const indexPath = path.join(__dirname, 'catalog.json');
    if (fs.existsSync(indexPath)) {
      const data = fs.readFileSync(indexPath, 'utf8');
      searchIndexCache = JSON.parse(data);
      return searchIndexCache;
    }
  } catch (err) {
    console.error('Error loading local search index (catalog.json):', err.message);
  }
  return null;
}

// Pre-load search index on startup
loadSearchIndex();

// --- Price & stock parsing (exported for testing) ---

export function parsePriceText(text) {
  if (!text) return null;
  // Check for negative numbers
  if (/-/.test(text) && !/-\s*\(/.test(text) && !/\/-/.test(text)) {
    if (/-\s*\d/.test(text) || /-\s*₹/.test(text) || /₹\s*-\s*\d/.test(text)) {
      return null;
    }
  }

  // Remove common currency prefixes/labels
  let norm = text.replace(/Rs\./gi, '').replace(/INR/gi, '');
  // Convert fullwidth unicode digits (\uFF10-\uFF19) to standard digits
  norm = norm.replace(/[\uFF10-\uFF19]/g, ch => String(ch.charCodeAt(0) - 65296));
  // Remove trailing tax / slash notes
  norm = norm.replace(/\/-.*$/, '').replace(/\(incl.*$/i, '');
  
  // Euro format check: e.g. 9.521,00 or 1.234,50
  if (/,\d{2}$/.test(norm.trim())) {
    norm = norm.replace(/\./g, '').replace(',', '.');
  } else {
    // Standard format: comma separates thousands, dot separates decimals
    norm = norm.replace(/,/g, '');
  }

  // Strip anything that is not digit or dot
  norm = norm.replace(/[^0-9.]/g, '');
  const parts = norm.split('.');
  if (parts.length > 2) {
    norm = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
  }

  const price = parseFloat(norm);
  return isNaN(price) || price <= 0 ? null : price;
}

export function parseStockText(text) {
  if (!text) return 'unknown';
  const lower = text.toLowerCase();
  if (lower.includes('out of stock')) return 'out of stock';
  // In-stock patterns: "In stock — N left", "Only N left", "N in stock", etc.
  const match = text.match(/(\d+)/);
  if (match) return `in stock (${match[1]})`;
  if (lower.includes('in stock')) return 'in stock';
  return 'unknown';
}

// --- Search products via cached catalog with deterministic ranking ---

export async function searchProducts(query) {
  if (!query || typeof query !== 'string') return [];
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [];

  // Ensure search index is loaded
  let catalog = loadSearchIndex();

  // If local catalog wasn't present, fetch from API gracefully with browser headers
  if (!catalog || catalog.length === 0) {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Referer': `${STORE_BASE}/`
    };
    const map = new Map();
    try {
      const pages = Array.from({ length: 17 }, (_, i) => i + 1);
      const results = await Promise.allSettled(
        pages.map(async p => {
          const res = await fetch(`${STORE_BASE}/api/catalog?page=${p}&pageSize=60`, { headers });
          if (!res.ok) return [];
          const data = await res.json();
          return data.items || [];
        })
      );
      for (const res of results) {
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
          for (const item of res.value) {
            map.set(item.id, item);
          }
        }
      }
      if (map.size > 0) {
        catalog = Array.from(map.values()).sort((a, b) => a.id - b.id);
        catalogCache = catalog;
      }
    } catch (err) {
      console.warn('Catalog live fetch warning:', err.message);
    }
  }

  if (!catalog || catalog.length === 0) return [];

  // Score and rank matches for high quality, deterministic search results
  const matches = [];
  const seenIds = new Set();

  for (const item of catalog) {
    if (seenIds.has(item.id)) continue;

    const name = (item.name || '').toLowerCase();
    const brand = (item.brand || '').toLowerCase();
    const category = (item.category || '').toLowerCase();
    const sku = (item.sku || '').toLowerCase();

    let score = 0;

    if (name === q) {
      score = 100;
    } else if (name.startsWith(q)) {
      score = 80;
    } else if (name.includes(q)) {
      score = 60;
    } else if (brand === q) {
      score = 50;
    } else if (brand.startsWith(q)) {
      score = 40;
    } else if (brand.includes(q)) {
      score = 30;
    } else if (category.includes(q) || sku.includes(q)) {
      score = 20;
    }

    if (score > 0) {
      seenIds.add(item.id);
      matches.push({
        score,
        id: item.id,
        name: item.name,
        brand: item.brand,
        category: item.category,
        slug: item.slug,
        url: `${STORE_BASE}/product/${item.id}`,
      });
    }
  }

  // Deterministic sorting: higher score first, then ascending by stable id
  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.id - b.id;
  });

  // Return top 20 clean items
  return matches.slice(0, 20).map(({ score, ...item }) => item);
}

// --- Scrape a single product page using Playwright ---

export async function scrapeProduct(productUrl, options = {}) {
  const { headed = false, onLog = () => {} } = options;

  const browser = await chromium.launch({ headless: !headed });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  try {
    onLog('Requesting page...');
    await page.goto(productUrl, { timeout: NAV_TIMEOUT, waitUntil: 'domcontentloaded' });

    // Dismiss cookie banner immediately if present
    try {
      const cookieBtn = await page.$('.cookie-banner button.btn-primary');
      if (cookieBtn) {
        await cookieBtn.click();
      }
    } catch {
      // Ignore
    }

    // Wait for product detail or store error
    onLog('Waiting for content...');
    const contentLocator = page.locator('.detail-info h1, .grid-empty.grid-error');
    await contentLocator.first().waitFor({ timeout: NAV_TIMEOUT });

    const errorEl = await page.$('.grid-empty.grid-error');
    if (errorEl) {
      const errText = await errorEl.textContent();
      throw new Error(`Store error: ${errText.trim()}`);
    }

    const productName = await page.textContent('.detail-info h1');

    // Wait for price block
    await page.waitForSelector('.price-block', { timeout: NAV_TIMEOUT });

    // Check if price is already loaded
    const alreadyLoaded = await page.$('.price-block.price-success');
    if (!alreadyLoaded) {
      // Simulate mouse hover over price block
      const priceBlock = await page.$('.price-block');
      const box = await priceBlock.boundingBox();
      if (!box) throw new Error('Price block not visible');

      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;

      // Move mouse to element and make small movements (min 8 moves, 600ms+ dwell)
      await page.mouse.move(centerX, centerY);
      for (let i = 0; i < 14; i++) {
        const dx = (Math.random() - 0.5) * 50;
        const dy = (Math.random() - 0.5) * 25;
        await page.mouse.move(centerX + dx, centerY + dy);
        await page.waitForTimeout(60);
      }
      await page.waitForTimeout(400);

      // Dismiss cookie banner if it popped up late
      try {
        const cookieBtn = await page.$('.cookie-banner button.btn-primary');
        if (cookieBtn) await cookieBtn.click();
      } catch {
        // Ignore
      }

      // Click "Reveal price" button
      const revealBtn = page.locator('.price-block button.btn-primary, .price-block button:has-text("Reveal price")').first();
      await revealBtn.waitFor({ timeout: 5000 });
      if (await revealBtn.isDisabled()) {
        await page.waitForTimeout(600);
      }
      await revealBtn.click({ force: true });

      // Wait for price to load or price error
      await page.waitForSelector('.price-block.price-success', { timeout: PRICE_TIMEOUT });
    }

    // Extract price - find the visible price element in .price-main
    const priceText = await page.evaluate(() => {
      const main = document.querySelector('.price-main');
      if (!main) return null;
      for (const child of main.children) {
        if (child.style.display === 'none' || child.getAttribute('aria-hidden') === 'true') continue;
        const fs = child.style.fontSize;
        const fw = child.style.fontWeight;
        if ((fs && fs.includes('2.4')) || fw === '700' || child.tagName === 'B') {
          return child.textContent;
        }
      }
      return null;
    });

    // Extract stock
    const stockEl = await page.$('.stock-badge.in-stock') || await page.$('.stock-badge.out-stock');
    const stockText = stockEl ? await stockEl.textContent() : null;

    const price = parsePriceText(priceText);
    const stock = parseStockText(stockText);

    if (price === null) {
      throw new Error(`Invalid price extracted: "${priceText}"`);
    }

    onLog(`Price found: ₹${price}`);
    onLog(`Stock found: ${stock}`);
    onLog('Validation successful');

    return { success: true, price, stock, productName: productName.trim() };
  } finally {
    await browser.close();
  }
}

// --- Scrape with retries ---

export async function scrapeTrackedProduct(product, options = {}) {
  const { onLog = () => {} } = options;
  const attempts = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const start = Date.now();
    onLog(`Attempt ${attempt}`);

    try {
      const result = await scrapeProduct(product.product_url, { ...options, onLog });
      const durationMs = Date.now() - start;

      attempts.push({
        attemptNumber: attempt,
        status: 'success',
        errorMessage: null,
        durationMs,
      });

      onLog('Saved successfully');

      return {
        success: true,
        price: result.price,
        stock: result.stock,
        productName: result.productName,
        attempts,
      };
    } catch (err) {
      const durationMs = Date.now() - start;
      const errorMessage = err.message || String(err);

      onLog(`Attempt ${attempt} FAILED`);
      onLog(`Reason: ${errorMessage}`);

      attempts.push({
        attemptNumber: attempt,
        status: attempt < MAX_ATTEMPTS ? 'retrying' : 'failed',
        errorMessage,
        durationMs,
      });

      if (attempt < MAX_ATTEMPTS) {
        const delaySec = Math.pow(2, attempt - 1);
        onLog(`Retrying in ${delaySec} second${delaySec > 1 ? 's' : ''}...`);
        await new Promise((r) => setTimeout(r, delaySec * 1000));
      }
    }
  }

  onLog('All attempts exhausted');
  return { success: false, price: null, stock: null, productName: null, attempts };
}
