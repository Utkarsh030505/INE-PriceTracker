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
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function StatusBadge({ status }) {
  if (!status) return <span className="text-xs text-gray-400">—</span>;
  const color = status === 'success' ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50';
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${color}`}>
      {status}
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
      alert('Scrape failed');
    }
    setScraping(false);
  }

  async function handleDelete() {
    if (!confirm('Remove this product from tracking?')) return;
    setDeleting(true);
    try {
      await deleteProduct(product.id);
      onRefresh?.();
    } catch {
      alert('Delete failed');
    }
    setDeleting(false);
  }

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="py-2 px-3 text-sm text-gray-900 font-medium max-w-[200px] truncate">
        {product.product_name}
      </td>
      <td className="py-2 px-3 text-sm text-gray-900">{formatPrice(product.current_price)}</td>
      <td className="py-2 px-3 text-xs text-gray-600">{product.current_stock || '—'}</td>
      <td className="py-2 px-3 text-xs text-gray-500">{timeAgo(product.last_scraped_at)}</td>
      <td className="py-2 px-3"><StatusBadge status={product.last_scrape_status} /></td>
      <td className="py-2 px-3">
        <div className="flex items-center gap-2">
          <Link
            to={`/product/${product.id}`}
            className="text-xs text-blue-600 hover:underline"
          >
            View
          </Link>
          <button
            onClick={handleScrape}
            disabled={scraping}
            className="text-xs px-2 py-0.5 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
          >
            {scraping ? 'Scraping...' : 'Scrape Now'}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs text-red-600 hover:underline disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      </td>
    </tr>
  );
}
