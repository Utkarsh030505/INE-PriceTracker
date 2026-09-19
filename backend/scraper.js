import { chromium } from 'playwright';

const STORE_BASE = 'https://demo.inelabteamdev.com';
const MAX_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 1000;
const NAV_TIMEOUT = 15000;
const PRICE_TIMEOUT = 15000;

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

// --- Search products via INE catalog API (no Playwright needed) ---

export async function searchProducts(query) {
  if (!query || query.trim().length === 0) return [];
  const q = query.toLowerCase().trim();
  const matches = [];
  const maxPages = 5;
  const pageSize = 60;

  for (let page = 1; page <= maxPages && matches.length < 20; page++) {
    const url = `${STORE_BASE}/api/catalog?page=${page}&pageSize=${pageSize}`;
    const res = await fetch(url);
    if (!res.ok) break;
    const data = await res.json();
    if (!data.items || data.items.length === 0) break;

    for (const item of data.items) {
      if (
        item.name.toLowerCase().includes(q) ||
        item.brand.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      ) {
        matches.push({
          id: item.id,
          name: item.name,
          brand: item.brand,
          category: item.category,
          slug: item.slug,
          url: `${STORE_BASE}/product/${item.id}`,
        });
        if (matches.length >= 20) break;
      }
    }

    if (data.page >= data.pages) break;
  }

  return matches;
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
