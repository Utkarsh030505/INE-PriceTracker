import { useState, useEffect, useCallback, useMemo } from 'react';
import { getTrackedProducts, getDashboardStats, getAlerts } from '../api';
import SearchBar from '../components/SearchBar';
import TrackedProduct from '../components/TrackedProduct';

export default function Dashboard() {
  const [products, setProducts] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({
    totalTracked: 0,
    inStock: 0,
    outOfStock: 0,
    scrapesToday: 0,
    failedScrapes: 0,
    priceDrops: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProducts = useCallback(async (isBackground = false) => {
    try {
      const [productsData, statsData, alertsData] = await Promise.all([
        getTrackedProducts(),
        getDashboardStats().catch(() => null),
        getAlerts().catch(() => []),
      ]);
      setProducts(productsData || []);
      setAlerts(alertsData || []);
      if (statsData) {
        setStats(statsData);
      } else {
        setStats((prev) => ({ ...prev, totalTracked: (productsData || []).length }));
      }
    } catch {
      if (!isBackground) {
        setProducts([]);
      }
    }
    if (!isBackground) {
      setLoading(false);
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetchProducts(false);
  }, [fetchProducts]);

  // Background polling every 30 seconds with tab visibility detection
  useEffect(() => {
    let isPolling = false;

    const poll = async () => {
      if (document.hidden || isPolling) return;
      isPolling = true;
      try {
        await fetchProducts(true);
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
  }, [fetchProducts]);

  // Relative time ticker: re-renders every 60 seconds
  const [, setTimerTick] = useState(0);
  useEffect(() => {
    const tickInterval = setInterval(() => {
      if (!document.hidden) {
        setTimerTick((t) => t + 1);
      }
    }, 60000);
    return () => clearInterval(tickInterval);
  }, []);

  async function handleManualRefresh() {
    setRefreshing(true);
    await fetchProducts(false);
    setTimeout(() => setRefreshing(false), 400);
  }

  const [sortOption, setSortOption] = useState('recently_updated');

  const sortedProducts = useMemo(() => {
    let list = [...products];
    if (sortOption === 'recently_updated') {
      list.sort((a, b) => new Date(b.last_scraped_at || b.updated_at || 0) - new Date(a.last_scraped_at || a.updated_at || 0));
    } else if (sortOption === 'price_low') {
      list.sort((a, b) => (Number(a.current_price) || 0) - (Number(b.current_price) || 0));
    } else if (sortOption === 'price_high') {
      list.sort((a, b) => (Number(b.current_price) || 0) - (Number(a.current_price) || 0));
    } else if (sortOption === 'discount') {
      list.sort((a, b) => {
        const discA = a.previous_price && a.current_price ? (a.previous_price - a.current_price) / a.previous_price : 0;
        const discB = b.previous_price && b.current_price ? (b.previous_price - b.current_price) / b.previous_price : 0;
        return discB - discA;
      });
    }
    return list;
  }, [products, sortOption]);

  return (
    <div>
      {/* 1. Hero / Page Introduction matching reference */}
      <section className="mb-6 pt-2 sm:pt-4">
        {/* Eyebrow Pill */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wider bg-[#F3E8FF] text-[#9333EA] mb-3 shadow-2xs">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
          </svg>
          <span>TRACK SMARTER</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-black tracking-tight text-[#111827] leading-tight">
          Track Prices. Find Better Deals.
        </h1>

        {/* Hero Subtitle */}
        <p className="mt-2 text-sm sm:text-base text-[#6B7280] max-w-2xl leading-relaxed">
          Search the 1,000-item store catalog, track products, and monitor live price and stock movements via automated Playwright scraping.
        </p>
      </section>

      {/* 2. Search Bar Area */}
      <SearchBar onProductTracked={fetchProducts} trackedProducts={products} />

      {/* 3. Tracked Products — Exact match to reference layout */}
      <section id="tracked-section" className="mb-12">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-[#111827]">
              Tracked Products
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#E5E7EB] text-[#4B5563]">
              {products.length} {products.length === 1 ? 'product' : 'products'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#6B7280]">Sort by</span>
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                className="bg-white border border-[#E5E7EB] text-[#111827] rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-[#0A21C0] shadow-xs cursor-pointer"
              >
                <option value="recently_updated">Recently Updated</option>
                <option value="price_low">Price: Low to High</option>
                <option value="price_high">Price: High to Low</option>
                <option value="discount">Biggest Discount</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={refreshing || loading}
              className="p-1.5 rounded-lg bg-white border border-[#E5E7EB] text-[#6B7280] hover:text-[#0A21C0] transition-colors disabled:opacity-50 shadow-xs"
              title="Refresh all tracked products"
            >
              <svg
                className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#0A21C0]' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2.2"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>
          </div>
        </div>

        {/* Loading State: 3-Column Light Card Skeletons */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white border border-[#E5E7EB] rounded-3xl p-6 sm:p-7 animate-pulse flex flex-col justify-between h-[480px] shadow-[0_2px_12px_rgba(0,0,0,0.03)]"
              >
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <div className="h-5 bg-[#F3F4F6] rounded-full w-24"></div>
                    <div className="flex gap-2">
                      <div className="w-3 h-3 bg-[#F3F4F6] rounded-full"></div>
                      <div className="w-4 h-4 bg-[#F3F4F6] rounded"></div>
                      <div className="w-4 h-4 bg-[#F3F4F6] rounded"></div>
                    </div>
                  </div>
                  <div className="w-full h-48 bg-[#F1F3F5] rounded-2xl mb-5"></div>
                  <div className="h-6 bg-[#F3F4F6] rounded-lg w-4/5 mb-2"></div>
                  <div className="h-4 bg-[#F3F4F6] rounded w-1/2 mb-5"></div>
                </div>
                <div>
                  <div className="h-8 bg-[#F3F4F6] rounded-lg w-2/5 mb-4"></div>
                  <div className="h-12 bg-[#0A21C0]/20 rounded-xl w-full"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && sortedProducts.length === 0 && (
          <div className="bg-white border border-[#E5E7EB] rounded-3xl py-16 px-4 text-center shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-[#F8F9FA] border border-[#E5E7EB] flex items-center justify-center mx-auto mb-4 text-[#6B7280]">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[#111827] mb-1.5">
              No products tracked yet
            </h3>
            <p className="text-sm text-[#6B7280] max-w-md mx-auto mb-6">
              Start tracking a product from the catalog above to monitor its price drops, stock availability, and historical trends.
            </p>
            <button
              type="button"
              onClick={() => {
                window.scrollTo({ top: 120, behavior: 'smooth' });
                document.querySelector('input[type="text"]')?.focus();
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0A21C0] hover:bg-[#1E3DE6] text-white font-bold text-sm shadow-md transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <span>Track Your First Product</span>
            </button>
          </div>
        )}

        {/* Populated 3-Column Product Grid — Strictly Max 3 Cards Per Row on Desktop */}
        {!loading && sortedProducts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedProducts.map((product) => (
              <TrackedProduct
                key={product.id}
                product={product}
                onRefresh={fetchProducts}
              />
            ))}
          </div>
        )}
      </section>

      {/* 4. Dashboard Statistics (Secondary Monitoring) */}
      <section id="stats-section" className="mb-10">
        <h3 className="text-sm font-bold text-[#6B7280] uppercase tracking-wider mb-3">
          Telemetry &amp; Scrape Stats
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-xs">
            <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider block">Total Tracked</span>
            <span className="text-xl font-black text-[#111827] mt-1 block">{loading ? '—' : stats.totalTracked}</span>
          </div>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-xs">
            <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider block">In Stock</span>
            <span className="text-xl font-black text-[#16A34A] mt-1 block">{loading ? '—' : stats.inStock}</span>
          </div>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-xs">
            <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider block">Out of Stock</span>
            <span className="text-xl font-black text-[#EF4444] mt-1 block">{loading ? '—' : stats.outOfStock}</span>
          </div>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-xs">
            <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider block">Scrapes Today</span>
            <span className="text-xl font-black text-[#0A21C0] mt-1 block">{loading ? '—' : stats.scrapesToday}</span>
          </div>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-xs">
            <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider block">Failed Scrapes</span>
            <span className="text-xl font-black text-[#F59E0B] mt-1 block">{loading ? '—' : stats.failedScrapes}</span>
          </div>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-xs">
            <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider block">Price Drops</span>
            <span className="text-xl font-black text-[#EF4444] mt-1 block">{loading ? '—' : stats.priceDrops}</span>
          </div>
        </div>
      </section>

      {/* 5. Alerts / Recent Activity */}
      <section id="alerts-section" className="bg-white border border-[#E5E7EB] rounded-2xl shadow-xs overflow-hidden mb-10">
        <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[#111827]">Recent Alerts &amp; Activity</h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#0A21C0] border border-blue-200">
              {alerts.length}
            </span>
          </div>
          <span className="text-xs text-[#6B7280]">Automated price drop &amp; stock notifications</span>
        </div>

        {alerts.length === 0 ? (
          <div className="py-8 px-4 text-center">
            <p className="text-sm text-[#4B5563]">No alert events recorded yet.</p>
            <p className="text-xs text-[#9CA3AF] mt-1">Alerts trigger automatically when prices drop or items return to stock.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#E5E7EB]">
            {alerts.slice(0, 5).map((alert) => (
              <div key={alert.id} className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-slate-50/80 transition-colors">
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-0.5 rounded-md font-bold text-[11px] ${
                    alert.alert_type === 'price_drop'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}>
                    {alert.alert_type === 'price_drop' ? 'Price Drop' : 'Back in Stock'}
                  </span>
                  <span className="font-bold text-[#111827]">
                    {alert.tracked_products?.product_name || 'Tracked Product'}
                  </span>
                  <span className="text-[#4B5563]">
                    {alert.alert_type === 'price_drop' ? (
                      <>
                        <span>₹{alert.previous_price} → </span>
                        <span className="font-bold text-[#16A34A]">₹{alert.current_price}</span>{' '}
                        <span className="font-bold text-[#EF4444]">(-{alert.percentage_change}%)</span>
                      </>
                    ) : (
                      <>Now available: <span className="font-bold text-emerald-700">{alert.current_stock || 'In Stock'}</span></>
                    )}
                  </span>
                </div>
                <span className="text-[#6B7280] font-mono text-[11px] whitespace-nowrap">
                  {new Date(alert.created_at).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
