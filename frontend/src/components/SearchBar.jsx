import { useState, useRef, useCallback, useMemo } from 'react';
import { searchProducts, trackProduct } from '../api';
import ProductCard from './ProductCard';

const CATEGORIES = [
  'All',
  'Audio',
  'Laptops',
  'Wearables',
  'Monitors',
  'Peripherals',
  'Power',
  'Smart Home',
  'Bags',
  'Kitchen',
  'Footwear',
];

const POPULAR_SEARCHES = ['Nordkraft', 'Helix', 'Audio', 'Laptops', 'Vantablack', 'Monitors'];

export default function SearchBar({ onProductTracked, trackedProducts = [] }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState('relevance');

  const timerRef = useRef(null);
  const latestRequestIdRef = useRef(0);
  const inputRef = useRef(null);

  // Set of tracked product URLs for fast lookup
  const trackedUrls = useMemo(() => {
    return new Set((trackedProducts || []).map((p) => p.product_url));
  }, [trackedProducts]);

  const executeSearch = useCallback(async (searchQuery) => {
    const trimmed = (searchQuery || '').trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const requestId = ++latestRequestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const data = await searchProducts(trimmed);
      // Discard stale responses if a newer search was initiated
      if (requestId === latestRequestIdRef.current) {
        // Deduplicate products by stable unique id
        const seen = new Set();
        const unique = [];
        for (const item of data || []) {
          if (item && item.id != null && !seen.has(item.id)) {
            seen.add(item.id);
            unique.push(item);
          }
        }
        setResults(unique);
      }
    } catch (err) {
      if (requestId === latestRequestIdRef.current) {
        setError('Failed to query product catalog. Please check your connection and try again.');
        setResults([]);
      }
    } finally {
      if (requestId === latestRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  function handleChange(e) {
    const value = e.target.value;
    setQuery(value);

    if (timerRef.current) clearTimeout(timerRef.current);

    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    // Debounce: 350ms
    timerRef.current = setTimeout(() => {
      executeSearch(value);
    }, 350);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (timerRef.current) clearTimeout(timerRef.current);
    executeSearch(query);
  }

  function handleClear() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setQuery('');
    setResults([]);
    setError(null);
    setSelectedCategory('All');
    inputRef.current?.focus();
  }

  function handleCategoryClick(cat) {
    setSelectedCategory(cat);
    if (cat === 'All') {
      if (query.trim().length >= 2) {
        executeSearch(query);
      }
    } else {
      setQuery(cat);
      executeSearch(cat);
    }
  }

  function handleQuickSearch(term) {
    setQuery(term);
    setSelectedCategory('All');
    executeSearch(term);
  }

  async function handleTrack(product) {
    setTracking(product.id);
    try {
      await trackProduct(product.name, product.url);
      onProductTracked?.();
    } catch (err) {
      alert('Failed to track product: ' + (err.response?.data?.error || err.message));
    }
    setTracking(null);
  }

  // Filter and sort results
  const displayedResults = useMemo(() => {
    let list = [...results];
    if (selectedCategory !== 'All') {
      list = list.filter(
        (p) => (p.category || '').toLowerCase() === selectedCategory.toLowerCase()
      );
    }
    if (sortBy === 'name') {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sortBy === 'brand') {
      list.sort((a, b) => (a.brand || '').localeCompare(b.brand || ''));
    }
    return list;
  }, [results, selectedCategory, sortBy]);

  const hasSearched = query.trim().length >= 2;

  return (
    <section className="mb-10">
      {/* Search Bar Container */}
      <div className="bg-white border border-zinc-200/90 rounded-2xl p-3 sm:p-4 shadow-sm">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          {/* Search Icon */}
          <div className="absolute left-3.5 sm:left-4 pointer-events-none text-zinc-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>

          {/* Text Input */}
          <input
            ref={inputRef}
            type="text"
            placeholder="Search by product name, brand (e.g. Nordkraft), category, or SKU..."
            value={query}
            onChange={handleChange}
            onKeyDown={(e) => {
              if (e.key === 'Escape') handleClear();
            }}
            className="w-full pl-11 pr-24 sm:pr-28 py-3 bg-zinc-50/70 border border-zinc-200/80 rounded-xl text-sm sm:text-base text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 transition-all"
          />

          {/* Right Action Icons & Badges */}
          <div className="absolute right-3 flex items-center gap-2">
            {loading && (
              <svg className="animate-spin w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
            )}

            {query && !loading && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/70 transition-colors"
                title="Clear search (Esc)"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}

            <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-zinc-400 bg-zinc-100 rounded border border-zinc-200">
              Esc
            </span>
          </div>
        </form>

        {/* Category Filter Chips */}
        <div className="mt-3 pt-3 border-t border-zinc-100 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs font-medium text-zinc-400 mr-1 flex-shrink-0">Filter:</span>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => handleCategoryClick(cat)}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                  isSelected
                    ? 'bg-zinc-900 text-white shadow-xs'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/80 hover:text-zinc-900'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200/80 flex items-center justify-between gap-3 text-sm text-rose-800">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-rose-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => executeSearch(query)}
            className="text-xs font-semibold px-2.5 py-1 rounded bg-rose-100 hover:bg-rose-200 text-rose-900 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeletons */}
      {loading && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="h-4 w-40 bg-zinc-200 rounded animate-pulse"></div>
            <div className="h-4 w-24 bg-zinc-200 rounded animate-pulse"></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white border border-zinc-200 rounded-xl p-4 animate-pulse flex flex-col justify-between h-44">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="h-5 w-16 bg-zinc-100 rounded-md"></div>
                    <div className="h-3 w-16 bg-zinc-100 rounded"></div>
                  </div>
                  <div className="h-4 w-full bg-zinc-100 rounded mb-2"></div>
                  <div className="h-4 w-3/4 bg-zinc-100 rounded"></div>
                </div>
                <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
                  <div className="h-3 w-12 bg-zinc-100 rounded"></div>
                  <div className="h-7 w-20 bg-zinc-100 rounded-lg"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results Section */}
      {!loading && hasSearched && results.length > 0 && (
        <div className="mt-6">
          {/* Results Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-zinc-200">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-900">
                Found <strong className="font-semibold text-zinc-900">{displayedResults.length}</strong>{' '}
                {displayedResults.length === 1 ? 'product' : 'products'}
                {query && (
                  <>
                    {' '}for <span className="font-medium text-zinc-900">"{query}"</span>
                  </>
                )}
                {selectedCategory !== 'All' && (
                  <span className="ml-1 text-xs text-zinc-500">in {selectedCategory}</span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Sort selector */}
              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                <span>Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-white border border-zinc-200 text-zinc-700 rounded-lg px-2 py-1 text-xs font-medium focus:outline-none focus:border-zinc-900"
                >
                  <option value="relevance">Relevance</option>
                  <option value="name">Name (A-Z)</option>
                  <option value="brand">Brand (A-Z)</option>
                </select>
              </div>

              {/* Close results */}
              <button
                type="button"
                onClick={handleClear}
                className="text-xs font-medium text-zinc-500 hover:text-zinc-900 underline transition-colors"
              >
                Close search
              </button>
            </div>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedResults.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onTrack={() => handleTrack(product)}
                tracking={tracking === product.id}
                isTracked={trackedUrls.has(product.url)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty Search State */}
      {!loading && hasSearched && results.length === 0 && (
        <div className="mt-6 bg-white border border-zinc-200 rounded-2xl p-8 sm:p-10 text-center">
          <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-3 text-zinc-400">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <h4 className="text-base font-semibold text-zinc-900 mb-1">
            No products found matching "{query}"
          </h4>
          <p className="text-sm text-zinc-500 max-w-md mx-auto mb-5">
            We couldn't find any products in the 1,000-item store catalog with that query. Try checking for typos, or browse popular searches below:
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {POPULAR_SEARCHES.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => handleQuickSearch(term)}
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
