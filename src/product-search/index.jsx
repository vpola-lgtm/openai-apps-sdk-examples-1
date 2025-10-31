import React from "react";
import { createRoot } from "react-dom/client";
import { Star, ShoppingCart } from "lucide-react";
import { useWidgetProps } from "../use-widget-props";

function ProductCard({ product }) {
  return (
    <div className="px-3 -mx-2 rounded-2xl hover:bg-black/5 transition-colors">
      <div className="flex w-full items-center gap-4 py-4 border-b border-black/5 last:border-b-0">
        <img
          src={product.image || "https://via.placeholder.com/80x80?text=Product"}
          alt={product.name}
          className="h-16 w-16 sm:h-20 sm:w-20 rounded-lg object-cover ring ring-black/5 flex-shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm sm:text-base truncate">
            {product.name}
          </div>
          {product.description && (
            <div className="text-xs sm:text-sm text-black/60 mt-1 line-clamp-2">
              {product.description}
            </div>
          )}
          <div className="mt-2 flex items-center gap-3 text-sm">
            {product.rating && (
              <div className="flex items-center gap-1 text-black/70">
                <Star
                  strokeWidth={1.5}
                  className="h-3 w-3 text-black fill-black"
                />
                <span>
                  {product.rating?.toFixed
                    ? product.rating.toFixed(1)
                    : product.rating}
                </span>
              </div>
            )}
            {product.price && (
              <div className="font-semibold text-[#F46C21]">
                ${product.price.toFixed(2)}
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          className="flex-shrink-0 inline-flex items-center justify-center rounded-full bg-[#F46C21] text-white p-2.5 hover:opacity-90 active:opacity-100 transition-opacity"
          aria-label={`Add ${product.name} to cart`}
        >
          <ShoppingCart strokeWidth={1.5} className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function App() {
  const widgetData = useWidgetProps({
    query: "",
    products: [],
  });

  const query = widgetData?.query || "";
  const products = widgetData?.products || [];

  return (
    <div className="antialiased w-full text-black px-4 pb-4 border border-black/10 rounded-2xl sm:rounded-3xl overflow-hidden bg-white">
      <div className="max-w-full">
        <div className="flex flex-row items-center gap-4 sm:gap-4 border-b border-black/5 py-4">
          <div className="sm:w-18 w-16 aspect-square rounded-xl bg-gradient-to-br from-[#F46C21] to-[#E55A1A] flex items-center justify-center flex-shrink-0">
            <ShoppingCart className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-base sm:text-xl font-medium truncate">
              Product Search
            </div>
            {query && (
              <div className="text-sm text-black/60 truncate">
                Results for &quot;{query}&quot;
              </div>
            )}
          </div>
          <div className="flex-auto hidden sm:flex justify-end pr-2">
            <div className="text-sm text-black/60">
              {products.length} {products.length === 1 ? "result" : "results"}
            </div>
          </div>
        </div>
        <div className="min-w-full text-sm flex flex-col">
          {products.length > 0 ? (
            products.map((product, i) => (
              <ProductCard key={product.id || i} product={product} />
            ))
          ) : (
            <div className="py-8 text-center text-black/60">
              <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <div>No products found.</div>
              {query && (
                <div className="text-xs mt-1">Try a different search query.</div>
              )}
            </div>
          )}
        </div>
        {products.length > 0 && (
          <div className="sm:hidden px-0 pt-3 pb-2 border-t border-black/5">
            <div className="text-center text-sm text-black/60">
              {products.length} {products.length === 1 ? "result" : "results"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById("product-search-root")).render(<App />);

