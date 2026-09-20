export default function ProductCard({ product, onTrack, tracking, isTracked, isAnyTracking }) {
  return (
    <div className="group bg-white border border-[#E5E7EB] hover:border-[#0A21C0]/50 rounded-2xl p-4 transition-all duration-150 hover:shadow-md flex flex-col justify-between h-full shadow-2xs">
      {/* Top Meta */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md border bg-[#F8F9FA] text-[#0A21C0] border-[#E5E7EB] uppercase tracking-wider">
            {product.category || 'Product'}
          </span>
          <span className="text-xs font-semibold text-[#6B7280] truncate">
            {product.brand}
          </span>
        </div>

        {/* Product Name */}
        <h4
          className="text-sm font-bold text-[#111827] group-hover:text-[#0A21C0] line-clamp-2 leading-snug transition-colors"
          title={product.name}
        >
          {product.name}
        </h4>

        {/* SKU / Slug */}
        <div className="flex items-center gap-2 mt-2 text-[11px] font-mono text-[#6B7280]">
          <span>{product.sku || `ID: ${product.id}`}</span>
          {product.slug && <span>·</span>}
          {product.slug && <span className="truncate max-w-[140px] text-[#6B7280] font-sans">{product.slug}</span>}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="pt-4 mt-3 border-t border-[#E5E7EB] flex items-center justify-between gap-2">
        {/* Store Link */}
        <a
          href={product.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#6B7280] hover:text-[#111827] transition-colors"
          title="Open product on INE mock store"
        >
          <span>Store</span>
          <svg className="w-3 h-3 text-[#6B7280]" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </a>

        {/* Track Button */}
        {isTracked ? (
          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-[#DCFCE7] text-[#15803D] border border-emerald-200 shadow-2xs">
            <svg className="w-3.5 h-3.5 text-[#15803D]" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Tracked
          </span>
        ) : (
          <button
            type="button"
            onClick={onTrack}
            disabled={tracking || isAnyTracking}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-[#0A21C0] hover:bg-[#1E3DE6] text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-xs transition-colors focus-visible:outline-none"
          >
            {tracking ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span>Fetching price...</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span>Track</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
