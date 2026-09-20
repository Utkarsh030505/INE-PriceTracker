import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return (
    d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) +
    ' ' +
    d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  );
}

function formatPrice(val) {
  if (val == null || isNaN(val)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val);
}

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    return (
      <div className="bg-[#0B1120] text-white rounded-xl px-3 py-2 text-xs shadow-xl border border-[#1E293B]">
        <p className="text-[#9CA3AF] font-mono text-[11px] mb-1">{label}</p>
        <p className="text-sm font-bold text-[#10B981]">
          {formatPrice(payload[0].value)}
        </p>
        {item.stock && (
          <p className="text-[11px] text-[#9CA3AF] mt-0.5">
            Stock: <span className="font-semibold text-white">{item.stock}</span>
          </p>
        )}
      </div>
    );
  }
  return null;
}

export default function PriceChart({ history = [] }) {
  const chartData = useMemo(() => {
    return (history || []).map((h) => ({
      time: formatDate(h.scraped_at),
      price: Number(h.price),
      stock: h.stock_status,
    }));
  }, [history]);

  const stats = useMemo(() => {
    if (!chartData || chartData.length === 0) return null;
    const prices = chartData.map((d) => d.price).filter((p) => !isNaN(p) && p > 0);
    if (prices.length === 0) return null;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const latest = prices[prices.length - 1];
    const initial = prices[0];
    const diff = latest - initial;
    const diffPct = initial > 0 ? ((diff / initial) * 100).toFixed(1) : 0;
    return { min, max, latest, diff, diffPct };
  }, [chartData]);

  if (!chartData || chartData.length === 0) {
    return (
      <div className="py-12 px-4 text-center bg-[#F8F9FA] rounded-2xl border border-[#E5E7EB]">
        <svg className="w-8 h-8 text-[#9CA3AF] mx-auto mb-2" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
        </svg>
        <p className="text-sm font-bold text-[#111827]">No price history recorded yet</p>
        <p className="text-xs text-[#6B7280] mt-1">
          Perform a manual scrape or wait for the 2-hour scheduled scrape to build price trends.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Mini Stats Row */}
      {stats && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-4 border-b border-[#E5E7EB] text-xs">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-[#6B7280] uppercase tracking-wider text-[10px] font-semibold block">Lowest</span>
              <span className="font-bold text-[#16A34A]">{formatPrice(stats.min)}</span>
            </div>
            <div className="h-4 w-[1px] bg-[#E5E7EB]"></div>
            <div>
              <span className="text-[#6B7280] uppercase tracking-wider text-[10px] font-semibold block">Highest</span>
              <span className="font-bold text-[#DC2626]">{formatPrice(stats.max)}</span>
            </div>
            <div className="h-4 w-[1px] bg-[#E5E7EB]"></div>
            <div>
              <span className="text-[#6B7280] uppercase tracking-wider text-[10px] font-semibold block">Data Points</span>
              <span className="font-bold text-[#111827]">{chartData.length}</span>
            </div>
          </div>

          {chartData.length > 1 && (
            <div className="flex items-center gap-1.5 font-semibold">
              <span className="text-[#6B7280]">Net Change:</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  stats.diff < 0
                    ? 'bg-[#DCFCE7] text-[#15803D] border border-emerald-200'
                    : stats.diff > 0
                    ? 'bg-[#FEE2E2] text-[#DC2626] border border-rose-200'
                    : 'bg-[#F8F9FA] text-[#6B7280] border border-[#E5E7EB]'
                }`}
              >
                {stats.diff < 0 ? `-${formatPrice(Math.abs(stats.diff))} (${stats.diffPct}%)` : stats.diff > 0 ? `+${formatPrice(stats.diff)} (+${stats.diffPct}%)` : 'No change'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Chart */}
      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: '#6B7280' }}
              axisLine={{ stroke: '#E5E7EB' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#6B7280' }}
              axisLine={{ stroke: '#E5E7EB' }}
              tickLine={false}
              tickFormatter={(v) => `₹${v}`}
              domain={['auto', 'auto']}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="price"
              stroke="#0A21C0"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#0A21C0', strokeWidth: 1.5, stroke: '#FFFFFF' }}
              activeDot={{ r: 5, fill: '#10B981', strokeWidth: 2, stroke: '#111827' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
