import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getProduct,
  getProductHistory,
  getProductLogs,
  scrapeProduct,
  getProductAlerts,
  updateAlertSettings,
  updateProductFrequency,
} from '../api';
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
  return new Date(dateStr).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-600">
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span>
        Pending
      </span>
    );
  }
  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        Healthy
      </span>
    );
  }
  if (status === 'retrying') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200/60">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
        Retrying
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200/60">
      <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
      Failed
    </span>
  );
}

function StockBadge({ stock }) {
  if (!stock || stock === 'unknown') {
    return <span className="text-sm text-zinc-400 font-medium">—</span>;
  }
  const s = stock.toLowerCase();
  if (s.includes('out of stock')) {
    return (
      <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200/60">
        {stock}
      </span>
    );
  }
  if (s.includes('only') || s.includes('hurry') || s.includes('selling fast')) {
    return (
      <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200/60">
        {stock}
      </span>
    );
  }
  return (
    <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60">
      {stock}
    </span>
  );
}

export default function ProductDetails() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [history, setHistory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [scrapeFeedback, setScrapeFeedback] = useState(null);

  // Alert Settings & Frequency state
  const [priceAlert, setPriceAlert] = useState(true);
  const [stockAlert, setStockAlert] = useState(true);
  const [thresholdPct, setThresholdPct] = useState(0);
  const [frequencyMinutes, setFrequencyMinutes] = useState(120);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsFeedback, setSettingsFeedback] = useState(null);
  const [updatingFreq, setUpdatingFreq] = useState(false);
  const [freqFeedback, setFreqFeedback] = useState(null);

  const fetchAll = useCallback(async (isBackground = false) => {
    try {
      const [p, h, l, a] = await Promise.all([
        getProduct(id),
        getProductHistory(id),
        getProductLogs(id),
        getProductAlerts(id).catch(() => []),
      ]);
      setProduct(p);
      setHistory(h || []);
      setLogs(l || []);
      setAlerts(a || []);
      if (p && !isBackground) {
        setPriceAlert(p.price_alert_enabled !== false);
        setStockAlert(p.stock_alert_enabled !== false);
        setThresholdPct(p.price_drop_threshold_pct ?? 0);
        setFrequencyMinutes(p.scrape_interval_minutes || 120);
      }
    } catch {
      if (!isBackground) {
        setProduct(null);
      }
    }
    if (!isBackground) {
      setLoading(false);
    }
  }, [id]);

  // Initial fetch
  useEffect(() => {
    fetchAll(false);
  }, [fetchAll]);

  // 30-second background polling with tab visibility detection
  useEffect(() => {
    let isPolling = false;

    const poll = async () => {
      if (document.hidden || isPolling) return;
      isPolling = true;
      try {
        await fetchAll(true);
      } finally {
        isPolling = false;
      }
    };

    const intervalId = setInterval(poll, 30000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        poll();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchAll]);

  // Relative timer ticker (updates "2m ago" -> "3m ago" every 60s without network calls)
  const [, setTimerTick] = useState(0);
  useEffect(() => {
    const tickInterval = setInterval(() => {
      if (!document.hidden) {
        setTimerTick((t) => t + 1);
      }
    }, 60000);
    return () => clearInterval(tickInterval);
  }, []);

  async function handleSaveAlertSettings(e) {
    e?.preventDefault();
    setSavingSettings(true);
    setSettingsFeedback(null);
    try {
      await updateAlertSettings(id, {
        price_alert_enabled: priceAlert,
        stock_alert_enabled: stockAlert,
        price_drop_threshold_pct: Number(thresholdPct) || 0,
      });
      setSettingsFeedback({ type: 'success', message: 'Alert settings updated successfully.' });
      setTimeout(() => setSettingsFeedback(null), 3000);
    } catch (err) {
      setSettingsFeedback({ type: 'error', message: 'Failed to update alert settings.' });
    }
    setSavingSettings(false);
  }

  async function handleFrequencyChange(newFreq) {
    const mins = Number(newFreq);
    setFrequencyMinutes(mins);
    setUpdatingFreq(true);
    setFreqFeedback(null);
    try {
      const updated = await updateProductFrequency(id, mins);
      setProduct((prev) => ({ ...prev, ...updated }));
      setFreqFeedback({
        type: 'success',
        message: `Scrape schedule set to every ${mins < 60 ? mins + ' minutes' : mins / 60 + ' hours'}.`,
      });
      setTimeout(() => setFreqFeedback(null), 3000);
    } catch (err) {
      setFreqFeedback({ type: 'error', message: 'Failed to update scrape schedule.' });
    }
    setUpdatingFreq(false);
  }

  async function handleScrape() {
    setScraping(true);
    setScrapeFeedback(null);
    try {
      const res = await scrapeProduct(id);
      await fetchAll();
      setScrapeFeedback({
        type: res.success ? 'success' : 'error',
        message: res.success
          ? `Scraped successfully in ${res.durationMs || 0}ms. Price: ${formatPrice(res.price)}`
          : 'Scrape failed to extract price. Valid data was preserved.',
      });
    } catch (err) {
      setScrapeFeedback({
        type: 'error',
        message: 'Network error triggering live scraper: ' + (err.response?.data?.error || err.message),
      });
    }
    setScraping(false);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-4 w-32 bg-zinc-200 rounded animate-pulse"></div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-6 animate-pulse h-48"></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white border border-zinc-200 rounded-xl p-4 h-24 animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="bg-white border border-zinc-200 rounded-2xl p-10 text-center">
        <h3 className="text-lg font-semibold text-zinc-900 mb-2">Product Not Found</h3>
        <p className="text-sm text-zinc-500 mb-4">
          This product may have been removed or the ID is invalid.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 transition-colors"
        >
          ← Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb Navigation */}
      <div className="mb-5 flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          <span>Back to Monitored Products</span>
        </Link>

        <span className="text-xs text-zinc-400">
          Last checked: <span className="text-zinc-600 font-medium">{timeAgo(product.last_scraped_at)}</span>
        </span>
      </div>

      {/* Main Product Overview Header */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 sm:p-6 shadow-xs mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-mono text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                Tracked Item
              </span>
              <StatusBadge status={product.last_scrape_status} />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
              {product.product_name}
            </h1>
            <a
              href={product.product_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 mt-1 truncate max-w-lg transition-colors"
            >
              <span>{product.product_url}</span>
              <svg className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          </div>

          {/* Action Button */}
          <div className="flex-shrink-0">
            <button
              type="button"
              onClick={handleScrape}
              disabled={scraping}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 text-xs sm:text-sm font-medium shadow-sm transition-colors"
            >
              {scraping ? (
                <>
                  <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  <span>Scraping Store via Playwright...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-zinc-300" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                  <span>Run Scraper Now</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {scrapeFeedback && (
          <div
            className={`mt-4 p-3 rounded-xl text-xs flex items-center justify-between border ${
              scrapeFeedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            <span>{scrapeFeedback.message}</span>
            <button
              type="button"
              onClick={() => setScrapeFeedback(null)}
              className="text-xs font-semibold underline ml-3"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* 4 Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-5 border-t border-zinc-100">
          <div className="bg-zinc-50/70 border border-zinc-100 rounded-xl p-3.5">
            <span className="text-[10px] sm:text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
              Current Price
            </span>
            <span className="text-xl sm:text-2xl font-bold text-zinc-900 mt-1 block">
              {formatPrice(product.current_price)}
            </span>
          </div>

          <div className="bg-zinc-50/70 border border-zinc-100 rounded-xl p-3.5">
            <span className="text-[10px] sm:text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
              Stock Status
            </span>
            <div className="mt-1.5">
              <StockBadge stock={product.current_stock} />
            </div>
          </div>

          <div className="bg-zinc-50/70 border border-zinc-100 rounded-xl p-3.5">
            <span className="text-[10px] sm:text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
              Last Scraped
            </span>
            <span className="text-xs font-medium text-zinc-700 mt-1.5 block" title={formatDate(product.last_scraped_at)}>
              {formatDate(product.last_scraped_at)}
            </span>
          </div>

          <div className="bg-zinc-50/70 border border-zinc-100 rounded-xl p-3.5">
            <span className="text-[10px] sm:text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
              Scrape Health
            </span>
            <div className="mt-1.5">
              <StatusBadge status={product.last_scrape_status} />
            </div>
          </div>
        </div>
      </div>

      {/* Alert Settings & Scrape Frequency */}
      <section className="bg-white border border-zinc-200 rounded-2xl p-5 sm:p-6 shadow-xs mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Frequency Configuration */}
          <div className="border-b md:border-b-0 md:border-r border-zinc-100 pb-5 md:pb-0 md:pr-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-zinc-900">Scrape Frequency</h2>
              <span className="text-[11px] font-mono text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                Next: {product.next_scrape_at ? timeAgo(product.next_scrape_at) : 'Due on next trigger'}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mb-3">
              Configure how often this product should be automatically refreshed by the scraper.
            </p>
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-700 block">Sync Interval</label>
              <select
                value={frequencyMinutes}
                onChange={(e) => handleFrequencyChange(e.target.value)}
                disabled={updatingFreq}
                className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs font-medium text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400"
              >
                <option value={30}>Every 30 minutes</option>
                <option value={60}>Every 1 hour</option>
                <option value={120}>Every 2 hours (Default)</option>
                <option value={360}>Every 6 hours</option>
                <option value={720}>Every 12 hours</option>
                <option value={1440}>Every 24 hours</option>
              </select>
              {freqFeedback && (
                <p className={`text-xs ${freqFeedback.type === 'success' ? 'text-emerald-600' : 'text-rose-600'} mt-1`}>
                  {freqFeedback.message}
                </p>
              )}
            </div>
          </div>

          {/* Alert Configuration */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-zinc-900">Alert Notifications</h2>
              <span className="text-[11px] text-zinc-400">In-app alert logs</span>
            </div>
            <p className="text-xs text-zinc-500 mb-3">
              Configure triggers for price decreases and inventory restock events.
            </p>

            <form onSubmit={handleSaveAlertSettings} className="space-y-3">
              <div className="flex items-center justify-between py-1">
                <div>
                  <span className="text-xs font-medium text-zinc-800 block">Price Drop Alerts</span>
                  <span className="text-[11px] text-zinc-400">Trigger on genuine price decreases</span>
                </div>
                <input
                  type="checkbox"
                  checked={priceAlert}
                  onChange={(e) => setPriceAlert(e.target.checked)}
                  className="w-4 h-4 rounded text-zinc-900 border-zinc-300 focus:ring-zinc-900"
                />
              </div>

              <div className="flex items-center justify-between py-1">
                <div>
                  <span className="text-xs font-medium text-zinc-800 block">Back-in-Stock Alerts</span>
                  <span className="text-[11px] text-zinc-400">Trigger when out of stock items return</span>
                </div>
                <input
                  type="checkbox"
                  checked={stockAlert}
                  onChange={(e) => setStockAlert(e.target.checked)}
                  className="w-4 h-4 rounded text-zinc-900 border-zinc-300 focus:ring-zinc-900"
                />
              </div>

              <div className="pt-2 border-t border-zinc-100 flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-medium text-zinc-800 block">Drop Threshold (%)</span>
                  <span className="text-[11px] text-zinc-400">0% triggers on any price drop</span>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={thresholdPct}
                    onChange={(e) => setThresholdPct(e.target.value)}
                    className="w-16 text-center bg-white border border-zinc-200 rounded-lg px-2 py-1 text-xs font-medium text-zinc-800"
                  />
                  <span className="text-xs text-zinc-400">%</span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                >
                  {savingSettings ? 'Saving...' : 'Save Alert Settings'}
                </button>
                {settingsFeedback && (
                  <span className={`text-xs ${settingsFeedback.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {settingsFeedback.message}
                  </span>
                )}
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Price History Chart */}
      <section className="bg-white border border-zinc-200 rounded-2xl p-5 sm:p-6 shadow-xs mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Price Trend History</h2>
            <p className="text-xs text-zinc-500">
              Interactive timeline of price changes captured by Playwright.
            </p>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700">
            {history.length} {history.length === 1 ? 'Point' : 'Points'}
          </span>
        </div>
        <PriceChart history={history} />
      </section>

      {/* Scrape Logs */}
      <section className="bg-white border border-zinc-200 rounded-2xl p-5 sm:p-6 shadow-xs mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Scrape Attempt Logs</h2>
            <p className="text-xs text-zinc-500">
              Full transparency per attempt: status, execution duration, and error diagnostics.
            </p>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700">
            {logs.length} {logs.length === 1 ? 'Log' : 'Logs'}
          </span>
        </div>
        <ScrapeLogs logs={logs} />
      </section>

      {/* Alert Event History */}
      <section className="bg-white border border-zinc-200 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Alert Event History</h2>
            <p className="text-xs text-zinc-500">
              Audit log of triggered price drop and back-in-stock notifications.
            </p>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700">
            {alerts.length} {alerts.length === 1 ? 'Alert' : 'Alerts'}
          </span>
        </div>

        {alerts.length === 0 ? (
          <div className="py-6 px-4 text-center border border-dashed border-zinc-200 rounded-xl">
            <p className="text-xs text-zinc-500">No alert events recorded for this product yet.</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">Events appear here when scraped data meets your alert thresholds.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-xl overflow-hidden">
            {alerts.map((alert) => (
              <div key={alert.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-zinc-50/50">
                <div className="flex items-center gap-2.5">
                  <span className={`px-2 py-0.5 rounded-full font-medium text-[11px] ${
                    alert.alert_type === 'price_drop'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  }`}>
                    {alert.alert_type === 'price_drop' ? 'Price Drop' : 'Back in Stock'}
                  </span>
                  <span className="text-zinc-700 font-medium">
                    {alert.alert_type === 'price_drop'
                      ? `₹${alert.previous_price} → ₹${alert.current_price} (-${alert.percentage_change}%)`
                      : `Restocked: ${alert.current_stock || 'In Stock'}`}
                  </span>
                </div>
                <span className="text-zinc-400 font-mono text-[11px]">
                  {new Date(alert.created_at).toLocaleString('en-IN', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
