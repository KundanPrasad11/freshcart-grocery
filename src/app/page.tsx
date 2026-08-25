"use client";
import Link from "next/link";
import { ProductCard } from "@/components/ui";
import { useStore } from "@/context/store";

export default function HomePage() {
  const { categories, products } = useStore();
  const featured = products.filter((product) => product.featured).slice(0, 4);
  return (
    <>
      <section className="hero">
        <div className="hero-box">
          <div className="hero-content">
            <div className="eyebrow">Grocery, thoughtfully chosen</div>
            <h1>Good food feels like home.</h1>
            <p>Fresh, everyday essentials from growers and makers we trust—delivered with care.</p>
            <Link className="button lime" href="/products">
              Shop groceries
            </Link>
          </div>
        </div>
      </section>
      <section className="trust-row">
        <div>
          <span>✦</span>Picked with care
        </div>
        <div>
          <span>◌</span>Same-day delivery
        </div>
        <div>
          <span>♧</span>Quality you can taste
        </div>
      </section>
      <section className="page">
        <div className="section-head">
          <div>
            <div className="eyebrow">Explore the pantry</div>
            <h2>Shop by category</h2>
          </div>
          <Link href="/categories">See all categories →</Link>
        </div>
        <div className="category-grid">
          {categories.map((category) => (
            <Link
              href={`/products?category=${encodeURIComponent(category.name)}`}
              className="category-card"
              key={category.id}
            >
              <div>{category.emoji}</div>
              <h3>{category.name}</h3>
              <p>{category.description}</p>
            </Link>
          ))}
        </div>
        <div className="section-head">
          <div>
            <div className="eyebrow">Just in season</div>
            <h2>Fresh picks for you</h2>
          </div>
          <Link href="/products">Shop all →</Link>
        </div>
        <div className="product-grid">
          {featured.map((product, index) => (
            <ProductCard key={product.id} product={product} priority={index < 2} />
          ))}
        </div>
      </section>
      <section className="feature-band">
        <div>
          <div className="eyebrow">The FreshCart difference</div>
          <h2>Food that does good, from farm to front door.</h2>
          <p>
            We buy closer to the source, favor food made with care, and make every delivery feel a
            little more personal.
          </p>
        </div>
        <div className="feature-points">
          <div>
            <h3>01. Thoughtfully sourced</h3>
            <p>Partnering with growers, makers, and local favorites.</p>
          </div>
          <div>
            <h3>02. Always fresh</h3>
            <p>We pack each order like it&apos;s for our own table.</p>
          </div>
          <div>
            <h3>03. Simple pricing</h3>
            <p>Good ingredients, fair prices, no membership required.</p>
          </div>
          <div>
            <h3>04. Delivered your way</h3>
            <p>Choose a time that fits naturally into your day.</p>
          </div>
        </div>
      </section>
    </>
  );
}
