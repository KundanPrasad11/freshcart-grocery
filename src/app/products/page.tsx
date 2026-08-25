"use client";

import { Suspense, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ProductCard } from "@/components/ui";
import { useStore } from "@/context/store";

export default function ProductsPage() {
  return (
    <Suspense fallback={<section className="page">Loading groceries…</section>}>
      <Catalog />
    </Suspense>
  );
}
function Catalog() {
  const { categories, products } = useStore();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const category = params.get("category") ?? "All";
  const search = params.get("q") ?? "";
  const organic = params.get("organic") === "1";
  const local = params.get("local") === "1";
  const price = params.get("price") ?? "Any";
  const sort = params.get("sort") ?? "featured";
  const updateFilter = (key: string, value: string, fallback = "") => {
    const next = new URLSearchParams(params.toString());
    if (!value || value === fallback) next.delete(key);
    else next.set(key, value);
    router.replace(next.size ? `${pathname}?${next.toString()}` : pathname, { scroll: false });
  };
  const clearFilters = () => router.replace(pathname, { scroll: false });
  const filtered = useMemo(
    () =>
      products
        .filter(
          (p) =>
            (category === "All" || p.category === category) &&
            (!organic || p.badge.toLowerCase().includes("organic")) &&
            (!local || p.badge.toLowerCase().includes("local")) &&
            (price === "Any" ||
              (price === "Under 200" ? p.price < 200 : p.price >= 200 && p.price <= 500)) &&
            p.name.toLowerCase().includes(search.toLowerCase())
        )
        .sort((a, b) =>
          sort === "price-low"
            ? a.price - b.price
            : sort === "price-high"
              ? b.price - a.price
              : sort === "rating"
                ? b.rating - a.rating
                : Number(b.featured) - Number(a.featured)
        ),
    [products, category, search, organic, local, price, sort]
  );
  const hasFilters =
    category !== "All" ||
    Boolean(search) ||
    organic ||
    local ||
    price !== "Any" ||
    sort !== "featured";
  return (
    <section className="page">
      <div className="page-intro">
        <div className="eyebrow">All groceries</div>
        <h1>The good stuff, all in one place.</h1>
        <p>Stock up on the ingredients that make your table feel like yours.</p>
      </div>
      <div className="shop-layout">
        <aside className="filters" aria-label="Product filters">
          <fieldset className="filter-group">
            <legend>Category</legend>
            {["All", ...categories.map((x) => x.name)].map((name) => (
              <label key={name}>
                <input
                  type="radio"
                  checked={category === name}
                  onChange={() => updateFilter("category", name, "All")}
                />
                {name}
              </label>
            ))}
          </fieldset>
          <fieldset className="filter-group">
            <legend>Diet & values</legend>
            <label>
              <input
                type="checkbox"
                checked={organic}
                onChange={(event) => updateFilter("organic", event.target.checked ? "1" : "")}
              />
              Organic
            </label>
            <label>
              <input
                type="checkbox"
                checked={local}
                onChange={(event) => updateFilter("local", event.target.checked ? "1" : "")}
              />
              Local
            </label>
          </fieldset>
          <fieldset className="filter-group">
            <legend>Price</legend>
            {["Any", "Under 200", "200 to 500"].map((value) => (
              <label key={value}>
                <input
                  type="radio"
                  checked={price === value}
                  onChange={() => updateFilter("price", value, "Any")}
                />
                {value === "Any" ? "Any price" : `₹${value.replace(" to ", "–₹")}`}
              </label>
            ))}
          </fieldset>
          {hasFilters && (
            <button className="link-button filter-clear" type="button" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </aside>
        <div>
          <div className="catalog-top">
            <p aria-live="polite">{filtered.length} products</p>
            <div>
              <label className="sr-only" htmlFor="catalog-search">
                Search groceries
              </label>
              <input
                id="catalog-search"
                className="search"
                value={search}
                placeholder="Search groceries"
                onChange={(event) => updateFilter("q", event.target.value)}
              />
              <select
                value={sort}
                onChange={(event) => updateFilter("sort", event.target.value, "featured")}
                aria-label="Sort products"
              >
                <option value="featured">Featured</option>
                <option value="price-low">Price: low to high</option>
                <option value="price-high">Price: high to low</option>
                <option value="rating">Top rated</option>
              </select>
            </div>
          </div>
          <div className="product-grid">
            {filtered.map((product) => (
              <ProductCard key={product.id} product={product} headingLevel={2} />
            ))}
          </div>
          {!filtered.length && (
            <p role="status">
              No products match those filters. Clear a filter or try another search.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
