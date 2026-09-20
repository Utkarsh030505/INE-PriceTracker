import { useState, useEffect, useCallback } from 'react';
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

  const fetchProducts = useCallback(async () => {
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
      setProducts([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  async function handleManualRefresh() {
    setRefreshing(true);
    await fetchProducts();
    setTimeout(() => setRefreshing(false), 400);
  }

  return (
    <div>
      {/* Hero Header */}
      <section className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider bg-zinc-100 text-zinc-600 border border-zinc-200 mb-2">
              <svg className="w-3.5 h-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
              </svg>
              <span>Catalog & Price Intelligence</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
              INE Product Price Tracker
            </h1>
            <p className="mt-1.5 text-sm sm:text-base text-zinc-500 max-w-2xl">
              Search the 1,000-item store catalog, track products in Supabase, and monitor live price and stock movements via automated Playwright scraping.
            </p>
          </div>

          {/* Quick Schedule Badge */}
          <div className="bg-white border border-zinc-200 rounded-xl px-4 py-2.5 shadow-2xs">
            <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">Default Schedule</span>
            <span className="text-sm font-semibold text-emerald-600">Every 2 Hours</span>
          </div>
        </div>
      </section>

      {/* Real Summary Metrics */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <div className="bg-white border border-zinc-200/90 rounded-xl p-3.5 shadow-2xs">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">Total Tracked</span>
          <span className="text-xl font-bold text-zinc-900 mt-1 block">{loading ? '—' : stats.totalTracked}</span>
        </div>
        <div className="bg-white border border-zinc-200/90 rounded-xl p-3.5 shadow-2xs">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">In Stock</span>
          <span className="text-xl font-bold text-emerald-600 mt-1 block">{loading ? '—' : stats.inStock}</span>
        </div>
        <div className="bg-white border border-zinc-200/90 rounded-xl p-3.5 shadow-2xs">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">Out of Stock</span>
          <span className="text-xl font-bold text-rose-600 mt-1 block">{loading ? '—' : stats.outOfStock}</span>
        </div>
        <div className="bg-white border border-zinc-200/90 rounded-xl p-3.5 shadow-2xs">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">Scrapes Today</span>
          <span className="text-xl font-bold text-zinc-900 mt-1 block">{loading ? '—' : stats.scrapesToday}</span>
        </div>
        <div className="bg-white border border-zinc-200/90 rounded-xl p-3.5 shadow-2xs">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">Failed Scrapes</span>
          <span className="text-xl font-bold text-amber-600 mt-1 block">{loading ? '—' : stats.failedScrapes}</span>
        </div>
        <div className="bg-white border border-zinc-200/90 rounded-xl p-3.5 shadow-2xs">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">Price Drops</span>
          <span className="text-xl font-bold text-emerald-600 mt-1 block">{loading ? '—' : stats.priceDrops}</span>
        </div>
      </section>

      {/* Search & Discovery Area */}
      <SearchBar onProductTracked={fetchProducts} trackedProducts={products} />

      {/* Tracked Products Inventory */}
      <section className="bg-white border border-zinc-200 rounded-2xl shadow-xs overflow-hidden">
        {/* Section Header */}
        <div className="px-5 py-4 border-b border-zinc-200/80 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-semibold text-zinc-900">Monitored Products</h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200">
              {products.length}
            </span>
          </div>

          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-colors disabled:opacity-50"
            title="Refresh tracked products list"
          >
            <svg
              className={`w-3.5 h-3.5 text-zinc-400 ${refreshing ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-zinc-100 rounded-lg animate-pulse"></div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && products.length === 0 && (
          <div className="py-14 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-3 text-zinc-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-zinc-900 mb-1">
              No products tracked yet
            </h3>
            <p className="text-sm text-zinc-500 max-w-sm mx-auto mb-4">
              Use the catalog search above to find products from the INE store and start monitoring their prices and stock.
            </p>
          </div>
        )}

        {/* Populated Table */}
        {!loading && products.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="hidden md:table-row bg-zinc-50/70 border-b border-zinc-200/80 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4">Stock</th>
                  <th className="py-3 px-4">Last Scraped</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {products.map((product) => (
                  <TrackedProduct
                    key={product.id}
                    product={product}
                    onRefresh={fetchProducts}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent Alerts Feed */}
      <section className="mt-8 bg-white border border-zinc-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-zinc-900">Recent Alerts</h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200">
              {alerts.length}
            </span>
          </div>
          <span className="text-xs text-zinc-400">Automated price drop & stock notifications</span>
        </div>

        {alerts.length === 0 ? (
          <div className="py-8 px-4 text-center">
            <p className="text-sm text-zinc-500">No alert events recorded yet.</p>
            <p className="text-xs text-zinc-400 mt-1">Alerts trigger automatically when prices drop or items return to stock.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {alerts.slice(0, 8).map((alert) => (
              <div key={alert.id} className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-zinc-50/60 transition-colors">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded-full font-medium text-[11px] ${
                    alert.alert_type === 'price_drop'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  }`}>
                    {alert.alert_type === 'price_drop' ? 'Price Drop' : 'Back in Stock'}
                  </span>
                  <span className="font-semibold text-zinc-900">
                    {alert.tracked_products?.product_name || 'Tracked Product'}
                  </span>
                  <span className="text-zinc-500">
                    {alert.alert_type === 'price_drop'
                      ? `₹${alert.previous_price} → ₹${alert.current_price} (-${alert.percentage_change}%)`
                      : `Now available: ${alert.current_stock || 'In Stock'}`}
                  </span>
                </div>
                <span className="text-zinc-400 font-mono text-[11px] whitespace-nowrap">
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
