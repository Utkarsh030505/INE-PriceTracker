export default function ProductCard({ product, onTrack, tracking }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
      <div>
        <p className="text-sm font-medium text-gray-900">{product.name}</p>
        <p className="text-xs text-gray-500">
          {product.brand} · {product.category}
        </p>
      </div>
      <button
        onClick={onTrack}
        disabled={tracking}
        className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {tracking ? 'Tracking...' : 'Track'}
      </button>
    </div>
  );
}
