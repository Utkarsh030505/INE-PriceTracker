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

function formatFullDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleString('en-IN');
}

function StatusBadge({ status }) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span>
        Pending
      </span>
    );
  }
  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        Healthy
      </span>
    );
  }
  if (status === 'retrying') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/60">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
        Retrying
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200/60">
      <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
      Failed
    </span>
  );
}

function StockBadge({ stock }) {
  if (!stock || stock === 'unknown') {
    return <span className="text-xs text-zinc-400 font-medium">—</span>;
  }
  const s = stock.toLowerCase();
  if (s.includes('out of stock')) {
    return (
      <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200/60">
        {stock}
      </span>
    );
  }
  if (s.includes('only') || s.includes('hurry') || s.includes('selling fast')) {
    return (
      <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/60">
        {stock}
      </span>
    );
  }
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60">
      {stock}
    </span>
  );
}

export default function TrackedProduct({ product, onRefresh }) {
  const [scraping, setScraping] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleScrape() {
    setScraping(true);
    try {
      await scrapeProduct(product.id);
      onRefresh?.();
    } catch {
      alert('Manual scrape failed. Please verify that the target store is accessible.');
    }
    setScraping(false);
  }

  async function handleDelete() {
    if (!confirm(`Remove "${product.product_name}" from tracking? All history and logs will be removed.`)) {
      return;
    }
    setDeleting(true);
    try {
      await deleteProduct(product.id);
      onRefresh?.();
    } catch {
      alert('Delete failed.');
    }
    setDeleting(false);
  }

  return (
    <>
      {/* Desktop Table Row */}
      <tr className="hidden md:table-row border-b border-zinc-100 hover:bg-zinc-50/70 transition-colors">
        {/* Product Name & Link */}
        <td className="py-3.5 px-4">
          <div className="flex flex-col max-w-[280px]">
            <Link
              to={`/product/${product.id}`}
              className="text-sm font-semibold text-zinc-900 hover:text-zinc-950 hover:underline line-clamp-1"
              title={product.product_name}
            >
              {product.product_name}
            </Link>
            <div className="flex items-center gap-2 mt-0.5">
              <a
                href={product.product_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-zinc-400 hover:text-zinc-600 truncate inline-flex items-center gap-1"
              >
                <span>{product.product_url.replace('https://demo.inelabteamdev.com', '')}</span>
                <svg className="w-3 h-3 text-zinc-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
              <span className="text-[10px] font-mono text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200 flex-shrink-0">
                {product.scrape_interval_minutes < 60 ? `${product.scrape_interval_minutes}m` : `${(product.scrape_interval_minutes || 120) / 60}h`} sync
              </span>
            </div>
          </div>
        </td>

        {/* Current Price */}
        <td className="py-3.5 px-4">
          <span className="text-sm font-semibold text-zinc-900">
            {formatPrice(product.current_price)}
          </span>
        </td>

        {/* Current Stock */}
        <td className="py-3.5 px-4">
          <StockBadge stock={product.current_stock} />
        </td>

        {/* Last Scraped */}
        <td className="py-3.5 px-4">
          <span
            className="text-xs text-zinc-500 cursor-help"
            title={formatFullDate(product.last_scraped_at)}
          >
            {timeAgo(product.last_scraped_at)}
          </span>
        </td>

        {/* Health Status */}
        <td className="py-3.5 px-4">
          <StatusBadge status={product.last_scrape_status} />
        </td>

        {/* Actions */}
        <td className="py-3.5 px-4 text-right">
          <div className="flex items-center justify-end gap-2">
            <Link
              to={`/product/${product.id}`}
              className="text-xs font-medium px-2.5 py-1.5 rounded-lg text-zinc-700 bg-zinc-100 hover:bg-zinc-200 transition-colors"
            >
              Details
            </Link>
            <button
              type="button"
              onClick={handleScrape}
              disabled={scraping}
              className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 disabled:opacity-50 transition-colors shadow-xs"
            >
              {scraping ? (
                <>
                  <svg className="animate-spin w-3 h-3 text-zinc-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  <span>Scraping...</span>
                </>
              ) : (
                <>
                  <svg className="w-3 h-3 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                  <span>Scrape</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              title="Remove product from tracking"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.75" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </button>
          </div>
        </td>
      </tr>

      {/* Mobile Card Row (< md) */}
      <tr className="md:hidden table-row border-b border-zinc-100">
        <td colSpan="6" className="p-4">
          <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <Link
                  to={`/product/${product.id}`}
                  className="text-sm font-semibold text-zinc-900 hover:underline leading-snug block"
                >
                  {product.product_name}
                </Link>
                <span className="text-[10px] font-mono text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200 inline-block mt-1">
                  {product.scrape_interval_minutes < 60 ? `${product.scrape_interval_minutes}m` : `${(product.scrape_interval_minutes || 120) / 60}h`} sync
                </span>
              </div>
              <StatusBadge status={product.last_scrape_status} />
            </div>

            {/* Price & Stock */}
            <div className="flex items-center justify-between py-2 border-y border-zinc-100 my-2">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-medium block">Price</span>
                <span className="text-base font-semibold text-zinc-900">{formatPrice(product.current_price)}</span>
              </div>
              <div className="text-right">
                <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-medium block">Stock</span>
                <StockBadge stock={product.current_stock} />
              </div>
            </div>

            {/* Time & Actions */}
            <div className="flex items-center justify-between pt-1 text-xs text-zinc-500">
              <span>Updated {timeAgo(product.last_scraped_at)}</span>
              <div className="flex items-center gap-2">
                <Link
                  to={`/product/${product.id}`}
                  className="px-2.5 py-1 rounded bg-zinc-100 text-zinc-700 font-medium"
                >
                  Details
                </Link>
                <button
                  type="button"
                  onClick={handleScrape}
                  disabled={scraping}
                  className="px-2.5 py-1 rounded bg-zinc-900 text-white font-medium disabled:opacity-50"
                >
                  {scraping ? 'Scraping...' : 'Scrape'}
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="p-1 text-zinc-400 hover:text-rose-600"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.75" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </td>
      </tr>
    </>
  );
}
