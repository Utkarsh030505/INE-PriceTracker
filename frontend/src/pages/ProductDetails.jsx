import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProduct, getProductHistory, getProductLogs, scrapeProduct } from '../api';
import PriceChart from '../components/PriceChart';
import ScrapeLogs from '../components/ScrapeLogs';

function formatPrice(price) {
  if (price == null) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(price);
}

function formatDate(dateStr) {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleString('en-IN');
}

export default function ProductDetails() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [history, setHistory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);

  async function fetchAll() {
    try {
      const [p, h, l] = await Promise.all([
        getProduct(id),
        getProductHistory(id),
        getProductLogs(id),
      ]);
      setProduct(p);
      setHistory(h);
      setLogs(l);
    } catch {
      setProduct(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchAll();
  }, [id]);

  async function handleScrape() {
    setScraping(true);
    try {
      await scrapeProduct(id);
      await fetchAll();
    } catch {
      alert('Scrape failed');
    }
    setScraping(false);
  }

  if (loading) return <p className="text-sm text-gray-500">Loading...</p>;
  if (!product) return <p className="text-sm text-red-600">Product not found.</p>;

  return (
    <div>
      <Link to="/" className="text-sm text-blue-600 hover:underline mb-4 inline-block">
        ← Back to Dashboard
      </Link>

      {/* Product Info */}
      <div className="bg-white border border-gray-200 rounded-md p-4 mb-6">
        <h2 className="text-lg font-semibold text-gray-900">{product.product_name}</h2>
        <a
          href={product.product_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline break-all"
        >
          {product.product_url}
        </a>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
          <div>
            <p className="text-xs text-gray-500 uppercase">Current Price</p>
            <p className="text-lg font-semibold text-gray-900">{formatPrice(product.current_price)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Stock</p>
            <p className="text-sm text-gray-700">{product.current_stock || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Last Scraped</p>
            <p className="text-sm text-gray-700">{formatDate(product.last_scraped_at)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Status</p>
            <p className="text-sm text-gray-700">{product.last_scrape_status || '—'}</p>
          </div>
        </div>

        <button
          onClick={handleScrape}
          disabled={scraping}
          className="mt-4 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {scraping ? 'Scraping...' : 'Scrape Now'}
        </button>
      </div>

      {/* Price History Chart */}
      <div className="bg-white border border-gray-200 rounded-md p-4 mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Price History</h3>
        <PriceChart history={history} />
      </div>

      {/* Scrape Logs */}
      <div className="bg-white border border-gray-200 rounded-md p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Scrape Logs</h3>
        <ScrapeLogs logs={logs} />
      </div>
    </div>
  );
}
