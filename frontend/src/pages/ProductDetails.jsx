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
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-[#F8F9FA] text-[#6B7280] border border-[#E5E7EB]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#6B7280]"></span>
        Pending
      </span>
    );
  }
  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-[#DCFCE7] text-[#15803D] border border-emerald-200 shadow-2xs">
        <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]"></span>
        Healthy
      </span>
    );
  }
  if (status === 'retrying') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-[#FEF3C7] text-[#B45309] border border-amber-200 shadow-2xs">
        <span className="w-1.5 h-1.5 rounded-full bg-[#D97706]"></span>
        Retrying
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-[#FEE2E2] text-[#DC2626] border border-rose-200 shadow-2xs">
      <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626]"></span>
      Failed
    </span>
  );
}

function StockBadge({ stock }) {
  if (!stock || stock === 'unknown') {
    return <span className="text-sm text-[#6B7280] font-medium">—</span>;
  }
  const s = stock.toLowerCase();
  if (s.includes('out of stock')) {
    return (
      <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-[#FEE2E2] text-[#DC2626] border border-rose-200 shadow-2xs">
        {stock}
      </span>
    );
  }
  if (s.includes('only') || s.includes('hurry') || s.includes('selling fast')) {
    return (
      <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-[#FEF3C7] text-[#B45309] border border-amber-200 shadow-2xs">
        {stock}
      </span>
    );
  }
  return (
    <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-[#DCFCE7] text-[#15803D] border border-emerald-200 shadow-2xs">
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

  useEffect(() => {
    fetchAll(false);
  }, [fetchAll]);

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
      if (!document.hidden) poll();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchAll]);

  async function handleSaveAlertSettings(e) {
    e.preventDefault();
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
    } catch {
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
        message: `Schedule set to every ${mins < 60 ? mins + ' minutes' : mins / 60 + ' hours'}.`,
      });
      setTimeout(() => setFreqFeedback(null), 3000);
    } catch {
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
          ? `Scraped in ${res.durationMs || 0}ms. Price: ${formatPrice(res.price)}`
          : 'Scrape failed to extract price. Valid data preserved.',
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
        <div className="h-4 w-32 bg-[#E5E7EB] rounded animate-pulse"></div>
        <div className="bg-white border border-[#E5E7EB] rounded-3xl p-6 animate-pulse h-48 shadow-xs"></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white border border-[#E5E7EB] rounded-2xl p-4 h-24 animate-pulse shadow-xs"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="bg-white border border-[#E5E7EB] rounded-3xl p-10 text-center shadow-xs">
        <h3 className="text-lg font-bold text-[#111827] mb-2">Product Not Found</h3>
        <p className="text-sm text-[#6B7280] mb-4">
          This product may have been removed or the ID is invalid.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl bg-[#0A21C0] hover:bg-[#1E3DE6] text-white transition-colors"
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
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6B7280] hover:text-[#111827] transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          <span>Back to Monitored Deals</span>
        </Link>

        <span className="text-xs text-[#6B7280]">
          Last checked: <span className="text-[#111827] font-semibold">{timeAgo(product.last_scraped_at)}</span>
        </span>
      </div>

      {/* Main Product Overview Header */}
      <div className="bg-white border border-[#E5E7EB] rounded-3xl p-6 sm:p-7 shadow-xs mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono font-bold text-[#0A21C0] bg-[#F8F9FA] px-2.5 py-0.5 rounded border border-[#E5E7EB]">
                Tracked Item
              </span>
              <StatusBadge status={product.last_scrape_status} />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#111827]">
              {product.product_name}
            </h1>
            <a
              href={product.product_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-[#0A21C0] mt-1.5 truncate max-w-lg transition-colors"
            >
              <span>{product.product_url}</span>
              <svg className="w-3.5 h-3.5 text-[#6B7280] flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
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
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#0A21C0] hover:bg-[#1E3DE6] text-white disabled:opacity-50 text-xs sm:text-sm font-bold shadow-xs transition-colors"
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
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
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
                ? 'bg-[#DCFCE7] text-[#15803D] border-emerald-200'
                : 'bg-[#FEE2E2] text-[#DC2626] border-rose-200'
            }`}
          >
            <span>{scrapeFeedback.message}</span>
            <button
              type="button"
              onClick={() => setScrapeFeedback(null)}
              className="text-xs font-bold underline ml-3"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* 4 Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-5 border-t border-[#E5E7EB]">
          <div className="bg-[#F8F9FA] border border-[#E5E7EB] rounded-2xl p-4">
            <span className="text-[10px] sm:text-[11px] font-bold text-[#6B7280] uppercase tracking-wider block">
              Current Price
            </span>
            <span className="text-xl sm:text-2xl font-black text-[#16A34A] mt-1 block">
              {formatPrice(product.current_price)}
            </span>
          </div>

          <div className="bg-[#F8F9FA] border border-[#E5E7EB] rounded-2xl p-4">
            <span className="text-[10px] sm:text-[11px] font-bold text-[#6B7280] uppercase tracking-wider block">
              Stock Status
            </span>
            <div className="mt-1.5">
              <StockBadge stock={product.current_stock} />
            </div>
          </div>

          <div className="bg-[#F8F9FA] border border-[#E5E7EB] rounded-2xl p-4">
            <span className="text-[10px] sm:text-[11px] font-bold text-[#6B7280] uppercase tracking-wider block">
              Last Scraped
            </span>
            <span className="text-xs font-semibold text-[#111827] mt-1.5 block" title={formatDate(product.last_scraped_at)}>
              {formatDate(product.last_scraped_at)}
            </span>
          </div>

          <div className="bg-[#F8F9FA] border border-[#E5E7EB] rounded-2xl p-4">
            <span className="text-[10px] sm:text-[11px] font-bold text-[#6B7280] uppercase tracking-wider block">
              Scrape Health
            </span>
            <div className="mt-1.5">
              <StatusBadge status={product.last_scrape_status} />
            </div>
          </div>
        </div>
      </div>

      {/* Alert Settings & Scrape Frequency */}
      <section className="bg-white border border-[#E5E7EB] rounded-3xl p-6 sm:p-7 shadow-xs mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Frequency Configuration */}
          <div className="border-b md:border-b-0 md:border-r border-[#E5E7EB] pb-5 md:pb-0 md:pr-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-[#111827]">Scrape Frequency</h2>
              <span className="text-[11px] font-mono font-bold text-[#0A21C0] bg-[#F8F9FA] px-2 py-0.5 rounded border border-[#E5E7EB]">
                Next: {product.next_scrape_at ? timeAgo(product.next_scrape_at) : 'Due on next trigger'}
              </span>
            </div>
            <p className="text-xs text-[#6B7280] mb-3">
              Configure how often this product should be automatically refreshed by the scraper.
            </p>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#111827] block">Sync Interval</label>
              <select
                value={frequencyMinutes}
                onChange={(e) => handleFrequencyChange(e.target.value)}
                disabled={updatingFreq}
                className="w-full bg-[#F8F9FA] border border-[#E5E7EB] rounded-xl px-3 py-2.5 text-xs font-semibold text-[#111827] focus:bg-white focus:outline-none focus:border-[#0A21C0]"
              >
                <option value={120}>Every 2 hours (Default)</option>
                <option value={240}>Every 4 hours</option>
                <option value={480}>Every 8 hours</option>
                <option value={720}>Every 12 hours</option>
                <option value={1440}>Every 24 hours</option>
              </select>
              {freqFeedback && (
                <p className={`text-xs ${freqFeedback.type === 'success' ? 'text-[#16A34A]' : 'text-[#DC2626]'} mt-1`}>
                  {freqFeedback.message}
                </p>
              )}
            </div>
          </div>

          {/* Alert Configuration */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-[#111827]">Alert Notifications</h2>
              <span className="text-[11px] text-[#6B7280]">In-app alert logs</span>
            </div>
            <p className="text-xs text-[#6B7280] mb-3">
              Configure triggers for price decreases and inventory restock events.
            </p>

            <form onSubmit={handleSaveAlertSettings} className="space-y-3">
              <div className="flex items-center justify-between py-1">
                <div>
                  <span className="text-xs font-semibold text-[#111827] block">Price Drop Alerts</span>
                  <span className="text-[11px] text-[#6B7280]">Trigger on genuine price decreases</span>
                </div>
                <input
                  type="checkbox"
                  checked={priceAlert}
                  onChange={(e) => setPriceAlert(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#0A21C0] border-[#E5E7EB]"
                />
              </div>

              <div className="flex items-center justify-between py-1">
                <div>
                  <span className="text-xs font-semibold text-[#111827] block">Back-in-Stock Alerts</span>
                  <span className="text-[11px] text-[#6B7280]">Trigger when out of stock items return</span>
                </div>
                <input
                  type="checkbox"
                  checked={stockAlert}
                  onChange={(e) => setStockAlert(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#0A21C0] border-[#E5E7EB]"
                />
              </div>

              <div className="pt-2 border-t border-[#E5E7EB] flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-semibold text-[#111827] block">Drop Threshold (%)</span>
                  <span className="text-[11px] text-[#6B7280]">0% triggers on any price drop</span>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={thresholdPct}
                    onChange={(e) => setThresholdPct(e.target.value)}
                    className="w-16 text-center bg-[#F8F9FA] border border-[#E5E7EB] rounded-lg px-2 py-1 text-xs font-bold text-[#111827] focus:bg-white focus:outline-none focus:border-[#0A21C0]"
                  />
                  <span className="text-xs text-[#6B7280]">%</span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl bg-[#0A21C0] hover:bg-[#1E3DE6] text-white disabled:opacity-50 transition-colors shadow-xs"
                >
                  {savingSettings ? 'Saving...' : 'Save Alert Settings'}
                </button>
                {settingsFeedback && (
                  <span className={`text-xs font-bold ${settingsFeedback.type === 'success' ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                    {settingsFeedback.message}
                  </span>
                )}
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Price History Chart */}
      <section className="bg-white border border-[#E5E7EB] rounded-3xl p-6 sm:p-7 shadow-xs mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-[#111827]">Price Trend History</h2>
            <p className="text-xs text-[#6B7280]">
              Interactive timeline of price changes captured by Playwright.
            </p>
          </div>
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#F8F9FA] text-[#0A21C0] border border-[#E5E7EB]">
            {history.length} {history.length === 1 ? 'Point' : 'Points'}
          </span>
        </div>
        <PriceChart history={history} />
      </section>

      {/* Scrape Logs */}
      <section className="bg-white border border-[#E5E7EB] rounded-3xl p-6 sm:p-7 shadow-xs mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-[#111827]">Scrape Attempt Logs</h2>
            <p className="text-xs text-[#6B7280]">
              Full transparency per attempt: status, execution duration, and error diagnostics.
            </p>
          </div>
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#F8F9FA] text-[#0A21C0] border border-[#E5E7EB]">
            {logs.length} {logs.length === 1 ? 'Log' : 'Logs'}
          </span>
        </div>
        <ScrapeLogs logs={logs} />
      </section>

      {/* Alert Event History */}
      <section className="bg-white border border-[#E5E7EB] rounded-3xl p-6 sm:p-7 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-[#111827]">Alert Event History</h2>
            <p className="text-xs text-[#6B7280]">
              Audit log of triggered price drop and back-in-stock notifications.
            </p>
          </div>
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#F8F9FA] text-[#0A21C0] border border-[#E5E7EB]">
            {alerts.length} {alerts.length === 1 ? 'Alert' : 'Alerts'}
          </span>
        </div>

        {alerts.length === 0 ? (
          <div className="py-6 px-4 text-center border border-dashed border-[#E5E7EB] rounded-2xl bg-[#F8F9FA]/50">
            <p className="text-xs text-[#6B7280]">No alert events recorded for this product yet.</p>
            <p className="text-[11px] text-[#9CA3AF] mt-0.5">Events appear here when scraped data meets your alert thresholds.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#E5E7EB] border border-[#E5E7EB] rounded-2xl overflow-hidden">
            {alerts.map((alert) => (
              <div key={alert.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-slate-50/80 transition-colors">
                <div className="flex items-center gap-2.5">
                  <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                    alert.alert_type === 'price_drop'
                      ? 'bg-[#FEE2E2] text-[#DC2626] border border-rose-200'
                      : 'bg-[#DCFCE7] text-[#15803D] border border-emerald-200'
                  }`}>
                    {alert.alert_type === 'price_drop' ? 'Price Drop' : 'Back in Stock'}
                  </span>
                  <span className="text-[#111827] font-semibold">
                    {alert.alert_type === 'price_drop'
                      ? `₹${alert.previous_price} → ₹${alert.current_price} (-${alert.percentage_change}%)`
                      : `Restocked: ${alert.current_stock || 'In Stock'}`}
                  </span>
                </div>
                <span className="text-[#6B7280] font-mono text-[11px]">
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
