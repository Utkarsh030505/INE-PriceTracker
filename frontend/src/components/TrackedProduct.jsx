import { useState } from 'react';
import { Link } from 'react-router-dom';
import { scrapeProduct, deleteProduct } from '../api';

function formatPrice(price) {
  if (price == null) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(price);
}

function timeAgo(date) {
  if (!date) return 'Never';
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function StockStatus({ stock }) {
  if (!stock || stock === 'unknown') {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-[#DCFCE7] text-[#15803D]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#15803D] flex-shrink-0"></span>
        <span className="truncate">In Stock</span>
      </div>
    );
  }

  const s = stock.toLowerCase();
  const isOutOfStock = s.includes('out of stock');
  const isHurry = s.includes('only') || s.includes('hurry') || s.includes('selling fast');

  if (isOutOfStock) {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-[#FEE2E2] text-[#B91C1C]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#B91C1C] flex-shrink-0"></span>
        <span className="truncate">Out of Stock</span>
      </div>
    );
  }

  if (isHurry) {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-[#FEF3C7] text-[#B45309]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#B45309] flex-shrink-0"></span>
        <span className="truncate">{stock}</span>
      </div>
    );
  }

  let label = stock;
  if (!s.startsWith('in stock') && !isNaN(parseInt(s))) {
    label = `In Stock (${stock})`;
  } else {
    label = stock.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return (
    <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-[#DCFCE7] text-[#15803D]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#15803D] flex-shrink-0"></span>
      <span className="truncate">{label}</span>
    </div>
  );
}

function HealthDot({ status }) {
  let color = 'bg-[#9CA3AF]';
  let label = 'Healthy';

  if (status === 'success') {
    color = 'bg-[#9CA3AF]';
    label = 'Healthy';
  } else if (status === 'retrying') {
    color = 'bg-[#F59E0B] animate-pulse';
    label = 'Retrying';
  } else if (status === 'failed') {
    color = 'bg-[#EF4444]';
    label = 'Failed';
  }

  return (
    <span
      className="inline-flex items-center justify-center cursor-help px-0.5"
      title={`Scraper: ${label}`}
      aria-label={`Scraper: ${label}`}
    >
      <span className={`w-2 h-2 rounded-full ${color}`}></span>
    </span>
  );
}

function CategoryArtwork({ name = '' }) {
  const n = name.toLowerCase();

  // Speaker
  if (
    n.includes('speaker') ||
    n.includes('sound') ||
    n.includes('audio bar') ||
    n.includes('subwoofer')
  ) {
    return (
      <svg className="w-24 h-24 text-[#0F172A]" viewBox="0 0 64 64" fill="none">
        {/* Speaker Cabinet */}
        <rect x="18" y="10" width="28" height="44" rx="4" stroke="#0F172A" strokeWidth="2.5" fill="white" />
        {/* Tweeter */}
        <circle cx="32" cy="22" r="5" stroke="#0F172A" strokeWidth="2" fill="white" />
        <circle cx="32" cy="22" r="2" fill="#0F172A" />
        {/* Woofer */}
        <circle cx="32" cy="39" r="9" stroke="#0F172A" strokeWidth="2" fill="white" />
        <circle cx="32" cy="39" r="4.5" fill="#0A21C0" />
      </svg>
    );
  }

  // Turntable
  if (n.includes('turntable') || n.includes('record') || n.includes('vinyl')) {
    return (
      <svg className="w-24 h-24 text-[#0F172A]" viewBox="0 0 64 64" fill="none">
        {/* Turntable Plinth */}
        <rect x="12" y="12" width="40" height="40" rx="6" stroke="#0F172A" strokeWidth="2.5" fill="white" />
        {/* Platter / Vinyl */}
        <circle cx="30" cy="32" r="14" stroke="#0F172A" strokeWidth="2" fill="white" />
        <circle cx="30" cy="32" r="9" stroke="#0F172A" strokeWidth="1.5" strokeDasharray="3 2" />
        <circle cx="30" cy="32" r="3.5" fill="#0A21C0" />
        {/* Tonearm */}
        <circle cx="45" cy="20" r="2.5" fill="#0A21C0" />
        <path d="M45 20L37 36" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="37" cy="36" r="1.5" fill="#0F172A" />
      </svg>
    );
  }

  // Audio / Headphones (Nordkraft Headphones)
  if (
    n.includes('headphone') ||
    n.includes('audio') ||
    n.includes('earphone') ||
    n.includes('tws') ||
    n.includes('nordkraft')
  ) {
    return (
      <svg className="w-24 h-24 text-[#0F172A]" viewBox="0 0 64 64" fill="none">
        {/* Headband Arc */}
        <path d="M17 34C17 24.5 23.5 17 32 17C40.5 17 47 24.5 47 34" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" />
        {/* Left Earcup */}
        <rect x="13" y="32" width="8" height="18" rx="4" stroke="#0F172A" strokeWidth="2.5" fill="#0A21C0" />
        {/* Right Earcup */}
        <rect x="43" y="32" width="8" height="18" rx="4" stroke="#0F172A" strokeWidth="2.5" fill="#0A21C0" />
      </svg>
    );
  }

  // Laptop / Computer
  if (
    n.includes('laptop') ||
    n.includes('computer') ||
    n.includes('macbook') ||
    n.includes('notebook')
  ) {
    return (
      <svg className="w-24 h-24 text-[#0F172A]" viewBox="0 0 64 64" fill="none">
        <rect x="14" y="16" width="36" height="24" rx="3" stroke="#0F172A" strokeWidth="2.5" fill="white" />
        <rect x="18" y="20" width="28" height="16" rx="1.5" fill="#0A21C0" fillOpacity="0.2" stroke="#0A21C0" strokeWidth="1.5" />
        <path d="M8 44h48a2 2 0 012 2v1H6v-1a2 2 0 012-2z" stroke="#0F172A" strokeWidth="2.5" fill="white" />
        <path d="M28 44h8" stroke="#0A21C0" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  // Wearable: Smartwatch
  if (n.includes('watch') || n.includes('band') || n.includes('wearable')) {
    return (
      <svg className="w-24 h-24 text-[#0F172A]" viewBox="0 0 64 64" fill="none">
        <rect x="23" y="8" width="18" height="10" rx="2" stroke="#0F172A" strokeWidth="2" fill="white" />
        <rect x="23" y="46" width="18" height="10" rx="2" stroke="#0F172A" strokeWidth="2" fill="white" />
        <rect x="18" y="16" width="28" height="32" rx="8" stroke="#0F172A" strokeWidth="2.5" fill="white" />
        <circle cx="32" cy="32" r="9" stroke="#0A21C0" strokeWidth="2" fill="#0A21C0" fillOpacity="0.15" />
        <path d="M32 27v5l3 3" stroke="#0A21C0" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  // Monitor / Display
  if (n.includes('monitor') || n.includes('display') || n.includes('screen') || n.includes('tv')) {
    return (
      <svg className="w-24 h-24 text-[#0F172A]" viewBox="0 0 64 64" fill="none">
        <rect x="10" y="14" width="44" height="28" rx="3" stroke="#0F172A" strokeWidth="2.5" fill="white" />
        <rect x="14" y="18" width="36" height="20" rx="1" fill="#0A21C0" fillOpacity="0.2" stroke="#0A21C0" strokeWidth="1" />
        <path d="M28 42l-2 8h16l-2-8" stroke="#0F172A" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M20 50h24" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }

  // Generic / Tech item
  return (
    <svg className="w-24 h-24 text-[#0F172A]" viewBox="0 0 64 64" fill="none">
      <path d="M32 12L16 21v22l16 9 16-9V21L32 12z" stroke="#0F172A" strokeWidth="2.5" fill="white" strokeLinejoin="round" />
      <path d="M16 21l16 9 16-9" stroke="#0F172A" strokeWidth="2" />
      <path d="M32 30v22" stroke="#0F172A" strokeWidth="2" />
      <circle cx="32" cy="30" r="4" fill="#0A21C0" />
    </svg>
  );
}

export default function TrackedProduct({ product, onRefresh }) {
  const [scraping, setScraping] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleScrape(e) {
    e.stopPropagation();
    if (scraping) return;
    setScraping(true);
    try {
      await scrapeProduct(product.id);
      onRefresh?.();
    } catch {
      alert('Manual scrape failed. Please verify that the target store is accessible.');
    } finally {
      setScraping(false);
    }
  }

  async function handleDelete(e) {
    e.stopPropagation();
    if (deleting) return;
    if (!confirm(`Remove "${product.product_name}" from tracking? All history and logs will be removed.`)) {
      return;
    }
    setDeleting(true);
    try {
      await deleteProduct(product.id);
      onRefresh?.();
    } catch {
      alert('Delete failed.');
    } finally {
      setDeleting(false);
    }
  }

  const currentPrice = product.current_price != null ? Number(product.current_price) : null;
  const previousPrice = product.previous_price != null ? Number(product.previous_price) : null;

  // Behavior States:
  // 1. Price drop
  const isPriceDrop = previousPrice != null && currentPrice != null && previousPrice > currentPrice && previousPrice > 0;
  const discountPercent = isPriceDrop
    ? Math.round(((previousPrice - currentPrice) / previousPrice) * 100)
    : null;

  // 2. Price increase
  const isPriceIncrease = previousPrice != null && currentPrice != null && previousPrice < currentPrice;

  // 3. Price unchanged or baseline
  const isPriceUnchanged = !isPriceDrop && !isPriceIncrease;

  const syncLabel = product.scrape_interval_minutes < 60
    ? `${product.scrape_interval_minutes}m sync`
    : `${(product.scrape_interval_minutes || 120) / 60}h sync`;

  return (
    <div className="group relative flex flex-col justify-between bg-white border border-[#E5E7EB] hover:border-[#0A21C0]/40 rounded-3xl p-6 sm:p-7 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-lg transition-all duration-200">
      {/* Top Section */}
      <div>
        {/* Header Row: Stock Status + Action Controls */}
        <div className="flex items-center justify-between gap-2 mb-3 min-w-0">
          <div className="min-w-0 flex-shrink">
            <StockStatus stock={product.current_stock} />
          </div>

          <div className="flex items-center gap-2.5 text-[#9CA3AF] flex-shrink-0">
            <HealthDot status={product.last_scrape_status} />

            <button
              type="button"
              onClick={handleScrape}
              disabled={scraping}
              className="p-1 rounded text-[#9CA3AF] hover:text-[#111827] transition-colors disabled:opacity-50"
              title={scraping ? 'Scraping live store...' : 'Scrape now'}
              aria-label={scraping ? 'Scraping live store' : 'Scrape now'}
            >
              {scraping ? (
                <svg className="animate-spin w-4 h-4 text-[#0A21C0]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              )}
            </button>

            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="p-1 rounded text-[#9CA3AF] hover:text-[#EF4444] transition-colors disabled:opacity-50"
              title="Untrack product"
              aria-label="Untrack product"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </button>
          </div>
        </div>

        {/* Product Visual Container */}
        <div className="w-full h-48 bg-[#F1F3F5] rounded-2xl flex items-center justify-center p-6 my-5 overflow-hidden">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.product_name}
              className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
              onError={(e) => {
                e.target.style.display = 'none';
                if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div className={`w-full h-full items-center justify-center transition-transform duration-300 group-hover:scale-105 ${product.image_url ? 'hidden' : 'flex'}`}>
            <CategoryArtwork name={product.product_name} />
          </div>
        </div>

        {/* Product Title */}
        <Link
          to={`/product/${product.id}`}
          className="block text-[#111827] font-extrabold text-lg sm:text-[19px] leading-snug line-clamp-1 hover:text-[#0A21C0] transition-colors mb-1"
          title={product.product_name}
        >
          {product.product_name}
        </Link>

        {/* Metadata */}
        <div className="text-xs text-[#6B7280] font-medium mb-4">
          <span>{syncLabel}</span>
          <span className="mx-1.5">·</span>
          <span>Updated {timeAgo(product.last_scraped_at)}</span>
        </div>
      </div>

      {/* Bottom Section: Stacked Price + CTA */}
      <div className="mt-auto">
        {/* Deal State 1: Genuine Price Drop */}
        {isPriceDrop && (
          <div className="mb-5">
            <div className="mb-1">
              <span className="inline-block bg-[#FEE2E2] text-[#EF4444] font-bold text-xs px-2.5 py-0.5 rounded-md">
                {discountPercent}% OFF
              </span>
            </div>
            <div className="text-[32px] font-black text-[#16A34A] tracking-tight leading-tight">
              {formatPrice(currentPrice)}
            </div>
            <div className="text-sm text-[#9CA3AF] line-through font-medium mt-0.5">
              {formatPrice(previousPrice)}
            </div>
          </div>
        )}

        {/* Deal State 2: Price Increased */}
        {isPriceIncrease && (
          <div className="mb-5">
            <div className="text-[32px] font-black text-[#16A34A] tracking-tight leading-tight">
              {formatPrice(currentPrice)}
            </div>
            <div className="text-sm text-[#9CA3AF] font-medium mt-0.5">
              Was: <span className="line-through">{formatPrice(previousPrice)}</span>
            </div>
          </div>
        )}

        {/* Deal State 3: Price Unchanged or Baseline */}
        {isPriceUnchanged && (
          <div className="mb-5">
            <div className="text-[32px] font-black text-[#16A34A] tracking-tight leading-tight">
              {formatPrice(currentPrice)}
            </div>
            <div className="text-xs text-[#6B7280] font-medium mt-1">
              No recent price change
            </div>
          </div>
        )}

        {/* Primary CTA: Cobalt Blue "Get Deal" */}
        <a
          href={product.product_url}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full bg-[#0A21C0] hover:bg-[#1E3DE6] active:bg-[#050A44] text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all text-sm tracking-wide group/btn"
        >
          <svg
            className="w-4 h-4 text-white flex-shrink-0 transition-transform group-hover/btn:scale-110"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2.5"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
          </svg>
          <span>Get Deal</span>
        </a>

        {/* Secondary Link: View Price History */}
        <div className="mt-3 text-center">
          <Link
            to={`/product/${product.id}`}
            className="inline-flex items-center justify-center gap-1 text-xs font-semibold text-[#0A21C0] hover:underline transition-colors py-1 group/link"
          >
            <span>View Price History</span>
            <span className="group-hover/link:translate-x-0.5 transition-transform">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
