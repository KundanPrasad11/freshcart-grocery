"use client";
import { ProductCard, EmptyState } from "@/components/ui";
import { useStore } from "@/context/store";

export default function WishlistPage() {
  const { wishlist, products } = useStore();
  const saved = products.filter((p) => wishlist.includes(p.id));
  return (
    <section className="page">
      <div className="page-intro">
        <div className="eyebrow">Saved for later</div>
        <h1>Wishlist</h1>
        <p>Your personal shelf of things you&apos;ll want to bring home.</p>
      </div>
      {saved.length ? (
        <div className="product-grid">
          {saved.map((product) => (
            <ProductCard product={product} key={product.id} headingLevel={2} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Nothing saved yet."
          body="Tap the heart on any product to keep it here."
        />
      )}
    </section>
  );
}
