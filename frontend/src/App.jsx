import { Routes, Route, Link } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ProductDetails from './pages/ProductDetails';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-50/50">
      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-zinc-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="h-9 w-9 rounded-lg bg-zinc-900 text-white flex items-center justify-center shadow-sm group-hover:bg-zinc-800 transition-colors">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6H2.25m0 0H3m-3 0h1.5m0 0v9.75m0 0H2.25m.75 0h.75m0 0h16.5m0 0v-9.75m0 0h.75m-.75 0h-1.5m1.5 0H21m-18 0h18M3.75 4.5h16.5m0 0v-.75A.75.75 0 0019.5 3H4.5a.75.75 0 00-.75.75v.75m16.5 0H3.75" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9" />
              </svg>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-zinc-900 text-base tracking-tight">INE Price Tracker</span>
                <span className="hidden sm:inline-block text-[10px] font-medium tracking-wider uppercase px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
                  Live Scraper
                </span>
              </div>
              <span className="hidden sm:block text-xs text-zinc-500">Catalog Discovery & Anti-Bot Price Monitor</span>
            </div>
          </Link>

          {/* Right Controls / Badges */}
          <div className="flex items-center gap-3">
            {/* Cron Status Badge */}
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/70 shadow-sm" title="Automated scraping triggered every 2 hours via cron-job.org">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>2h Cron Active</span>
            </div>

            {/* Mock Store Link */}
            <a
              href="https://demo.inelabteamdev.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-700 hover:text-zinc-900 bg-white hover:bg-zinc-100 border border-zinc-200 shadow-sm transition-colors"
            >
              <span>Mock Store</span>
              <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/product/:id" element={<ProductDetails />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white mt-auto py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="font-medium text-zinc-700">INE Product Price Tracker</span>
            <span>·</span>
            <span>Automated 2-Hour Cron</span>
            <span>·</span>
            <span>Playwright Anti-Bot Engine</span>
          </div>
          <div className="text-zinc-400">
            Deployed on Vercel & Render · Supabase PostgreSQL
          </div>
        </div>
      </footer>
    </div>
  );
}
