import { Component } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ProductDetails from './pages/ProductDetails';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-white border border-[#E5E7EB] rounded-3xl p-8 max-w-lg mx-auto text-center shadow-sm my-12">
          <div className="w-12 h-12 rounded-full bg-[#FEE2E2] text-[#DC2626] flex items-center justify-center mx-auto mb-4 font-bold text-xl">
            !
          </div>
          <h2 className="text-lg font-bold text-[#111827] mb-2">Something went wrong</h2>
          <p className="text-xs text-[#6B7280] mb-4">
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-[#0A21C0] hover:bg-[#1E3DE6] text-white text-xs font-bold rounded-xl transition-colors"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const location = useLocation();
  const isDashboard = location.pathname === '/';

  const scrollToSection = (id) => {
    if (!isDashboard) return;
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] text-[#111827]">
      {/* Navbar matching reference image */}
      <header className="sticky top-0 z-40 bg-[#F8F9FA]/95 backdrop-blur-md border-b border-[#E5E7EB]">
        <div className="max-w-[1200px] w-full mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="h-11 w-11 rounded-xl bg-[#0B1120] text-white flex items-center justify-center shadow-sm group-hover:bg-[#141619] transition-colors flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <rect x="2" y="3" width="20" height="14" rx="2" strokeWidth="2" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8m-4-4v4M6 12l3-3 3 3 5-5" strokeWidth="2" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-[#111827] text-lg tracking-tight leading-tight">
                INE Price Tracker
              </span>
              <span className="text-xs text-[#6B7280] font-medium">
                Catalog Discovery &amp; Anti-Bot Price Monitor
              </span>
            </div>
          </Link>

          {/* Navigation */}
          <div className="flex items-center">
            <nav className="hidden md:flex items-center gap-6 text-sm font-semibold h-20">
              <Link
                to="/"
                className={`relative flex items-center h-full transition-colors ${
                  isDashboard
                    ? 'text-[#0A21C0] font-bold'
                    : 'text-[#6B7280] hover:text-[#111827]'
                }`}
              >
                <span>Dashboard</span>
                {isDashboard && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#0A21C0] rounded-t-full"></span>
                )}
              </Link>
              <button
                type="button"
                onClick={() => scrollToSection('alerts-section')}
                className="text-[#6B7280] hover:text-[#111827] transition-colors"
              >
                Alerts
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 sm:px-6 py-8">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/product/:id" element={<ProductDetails />} />
          </Routes>
        </ErrorBoundary>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E5E7EB] bg-[#F8F9FA] mt-auto py-6">
        <div className="max-w-[1200px] w-full mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#6B7280]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#111827]">INE Product Price Tracker</span>
            <span>·</span>
            <span>Automated 2-Hour Cron</span>
            <span>·</span>
            <span>Playwright Anti-Bot Engine</span>
          </div>
          <div className="text-[#6B7280]">
            Deployed on Vercel &amp; Render · Supabase PostgreSQL
          </div>
        </div>
      </footer>
    </div>
  );
}
