/**
 * Alert detection and processing service
 * Handles price-drop and back-in-stock alert logic with strict validation and deduplication.
 */

export function isOutOfStock(stockText) {
  if (!stockText || typeof stockText !== 'string') return false;
  return stockText.toLowerCase().includes('out of stock');
}

export function isInStock(stockText) {
  if (!stockText || typeof stockText !== 'string') return false;
  const s = stockText.toLowerCase().trim();
  if (s === '' || s === 'unknown' || s.includes('out of stock')) return false;
  return s.includes('in stock') || s.includes('only') || s.includes('left') || s.includes('fast');
}

/**
 * Price-drop detection
 * Rule:
 * - previous_price > 0 AND current_price > 0 AND current_price < previous_price
 * - percentage_drop = ((previous_price - current_price) / previous_price) * 100
 * - If threshold == 0: any genuine decrease triggers
 * - If threshold > 0: percentage_drop >= threshold must be satisfied
 * - If price unchanged or increased: NO alert
 * - If previous_price <= 0: DO NOT calculate percentage
 */
export function detectPriceDrop(previousPrice, currentPrice, thresholdPct = 0) {
  const prev = Number(previousPrice);
  const curr = Number(currentPrice);

  if (isNaN(prev) || isNaN(curr) || prev <= 0 || curr <= 0) {
    return { triggered: false, percentageDrop: null };
  }

  // Price must strictly decrease
  if (curr >= prev) {
    return { triggered: false, percentageDrop: null };
  }

  const drop = ((prev - curr) / prev) * 100;
  const roundedDrop = Number(drop.toFixed(2));
  const threshold = Math.max(0, Number(thresholdPct) || 0);

  if (threshold > 0 && roundedDrop < threshold) {
    return { triggered: false, percentageDrop: roundedDrop };
  }

  return { triggered: true, percentageDrop: roundedDrop };
}

/**
 * Back-in-stock detection
 * Detect ONLY this transition:
 * previous stock = OUT_OF_STOCK
 * current stock = IN_STOCK
 * Do NOT trigger for: IN_STOCK -> IN_STOCK, IN_STOCK -> OUT_OF_STOCK, UNKNOWN -> IN_STOCK
 */
export function detectBackInStock(previousStock, currentStock) {
  if (isOutOfStock(previousStock) && isInStock(currentStock)) {
    return { triggered: true };
  }
  return { triggered: false };
}

/**
 * Process scrape result against previous product state and insert alerts into Supabase
 */
export async function processAlertsForProduct(product, newPrice, newStock, supabase) {
  if (!product || !supabase) return [];
  const alertsCreated = [];

  try {
    const priceAlertEnabled = product.price_alert_enabled ?? true;
    const stockAlertEnabled = product.stock_alert_enabled ?? true;
    const thresholdPct = Number(product.price_drop_threshold_pct) || 0;

    // 1. Check Price Drop
    if (priceAlertEnabled && product.current_price != null && newPrice != null) {
      const dropCheck = detectPriceDrop(product.current_price, newPrice, thresholdPct);
      if (dropCheck.triggered) {
        const transitionKey = `${product.id}:price_drop:${product.current_price}:${newPrice}`;

        // Deduplication check: ensure this specific price transition wasn't already recorded
        const { data: existing } = await supabase
          .from('product_alerts')
          .select('id')
          .eq('transition_key', transitionKey)
          .maybeSingle();

        if (!existing) {
          const alertPayload = {
            tracked_product_id: product.id,
            alert_type: 'price_drop',
            previous_price: product.current_price,
            current_price: newPrice,
            percentage_change: dropCheck.percentageDrop,
            previous_stock: product.current_stock || null,
            current_stock: newStock || null,
            transition_key: transitionKey,
          };

          const { data: inserted, error: insertErr } = await supabase
            .from('product_alerts')
            .insert(alertPayload)
            .select()
            .single();

          if (!insertErr && inserted) {
            alertsCreated.push(inserted);
            console.log(`[Alert] Price drop recorded for "${product.product_name}": ₹${product.current_price} -> ₹${newPrice} (-${dropCheck.percentageDrop}%)`);
          }
        }
      }
    }

    // 2. Check Back-in-Stock
    if (stockAlertEnabled && product.current_stock && newStock) {
      const stockCheck = detectBackInStock(product.current_stock, newStock);
      if (stockCheck.triggered) {
        const transitionKey = `${product.id}:back_in_stock:${product.current_stock}:${newStock}`;

        const { data: existing } = await supabase
          .from('product_alerts')
          .select('id')
          .eq('transition_key', transitionKey)
          .maybeSingle();

        if (!existing) {
          const alertPayload = {
            tracked_product_id: product.id,
            alert_type: 'back_in_stock',
            previous_price: product.current_price || null,
            current_price: newPrice || null,
            percentage_change: null,
            previous_stock: product.current_stock,
            current_stock: newStock,
            transition_key: transitionKey,
          };

          const { data: inserted, error: insertErr } = await supabase
            .from('product_alerts')
            .insert(alertPayload)
            .select()
            .single();

          if (!insertErr && inserted) {
            alertsCreated.push(inserted);
            console.log(`[Alert] Back-in-stock recorded for "${product.product_name}": "${product.current_stock}" -> "${newStock}"`);
          }
        }
      }
    }
  } catch (err) {
    // Alert processing must NEVER crash scraping or fail the scrape
    console.error('[Alert] Error processing product alerts:', err.message);
  }

  return alertsCreated;
}
