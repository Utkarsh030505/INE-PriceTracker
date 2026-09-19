import { useState, useEffect, useCallback } from 'react';
import { getTrackedProducts } from '../api';
import SearchBar from '../components/SearchBar';
import TrackedProduct from '../components/TrackedProduct';

export default function Dashboard() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    try {
      const data = await getTrackedProducts();
      setProducts(data);
    } catch {
      setProducts([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Dashboard</h2>

      <SearchBar onProductTracked={fetchProducts} />

      <div className="bg-white border border-gray-200 rounded-md">
        <div className="px-3 py-2 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-700">Tracked Products</h3>
        </div>

        {loading && (
          <p className="px-3 py-4 text-sm text-gray-500">Loading...</p>
        )}

        {!loading && products.length === 0 && (
          <p className="px-3 py-4 text-sm text-gray-500">
            No products tracked yet. Search above to start tracking.
          </p>
        )}

        {!loading && products.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-500 uppercase">
                  <th className="py-2 px-3 font-medium">Product</th>
                  <th className="py-2 px-3 font-medium">Price</th>
                  <th className="py-2 px-3 font-medium">Stock</th>
                  <th className="py-2 px-3 font-medium">Last Scraped</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                  <th className="py-2 px-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
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
      </div>
    </div>
  );
}
