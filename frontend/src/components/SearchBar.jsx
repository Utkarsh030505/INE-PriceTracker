import { useState, useRef } from 'react';
import { searchProducts, trackProduct } from '../api';
import ProductCard from './ProductCard';

export default function SearchBar({ onProductTracked }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tracking, setTracking] = useState(null);
  const timerRef = useRef(null);

  function handleChange(e) {
    const value = e.target.value;
    setQuery(value);

    if (timerRef.current) clearTimeout(timerRef.current);

    if (value.trim().length < 2) {
      setResults([]);
      return;
    }

    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchProducts(value.trim());
        setResults(data);
      } catch {
        setResults([]);
      }
      setLoading(false);
    }, 300);
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
      <input
        type="text"
        placeholder="Search INE store products..."
        value={query}
        onChange={handleChange}
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
      />
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
