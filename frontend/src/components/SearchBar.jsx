import { useState, useRef, useCallback } from 'react';
import { searchProducts, trackProduct } from '../api';
import ProductCard from './ProductCard';

export default function SearchBar({ onProductTracked }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tracking, setTracking] = useState(null);
  const timerRef = useRef(null);
  const latestRequestIdRef = useRef(0);

  const executeSearch = useCallback(async (searchQuery) => {
    const trimmed = (searchQuery || '').trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const requestId = ++latestRequestIdRef.current;
    setLoading(true);

    try {
      const data = await searchProducts(trimmed);
      // Discard stale responses if a newer search was initiated
      if (requestId === latestRequestIdRef.current) {
        // Deduplicate products by stable unique id
        const seen = new Set();
        const unique = [];
        for (const item of (data || [])) {
          if (item && item.id != null && !seen.has(item.id)) {
            seen.add(item.id);
            unique.push(item);
          }
        }
        setResults(unique);
      }
    } catch {
      if (requestId === latestRequestIdRef.current) {
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
      return;
    }

    // Sensible debounce: 350ms
    timerRef.current = setTimeout(() => {
      executeSearch(value);
    }, 350);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (timerRef.current) clearTimeout(timerRef.current);
    executeSearch(query);
  }

  async function handleTrack(product) {
    setTracking(product.id);
    try {
      await trackProduct(product.name, product.url);
      onProductTracked?.();
      setQuery('');
      setResults([]);
    } catch (err) {
      alert('Failed to track product: ' + (err.response?.data?.error || err.message));
    }
    setTracking(null);
  }

  return (
    <div className="relative mb-6">
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Search INE store products..."
          value={query}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        />
      </form>
      {loading && (
        <p className="text-xs text-gray-500 mt-1">Searching...</p>
      )}
      {results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-sm max-h-80 overflow-y-auto">
          {results.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onTrack={() => handleTrack(product)}
              tracking={tracking === product.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
