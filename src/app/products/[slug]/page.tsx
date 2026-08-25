"use client";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useState } from "react";
import { money } from "@/lib/catalog";
import { ProductCard } from "@/components/ui";
import { useStore } from "@/context/store";

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [quantity, setQuantity] = useState(1);
  const { products, addToCart, wishlist, toggleWishlist, user } = useStore();
  const product = products.find((item) => item.slug === slug);
  if (!product)
    return (
      <section className="page">
        <p>We couldn&apos;t find that product.</p>
        <Link className="button" href="/products">
          Back to groceries
        </Link>
      </section>
    );
  const saved = wishlist.includes(product.id);
  const related = products
    .filter((item) => item.category === product.category && item.id !== product.id)
    .slice(0, 4);
  const add = async () => {
    for (let i = 0; i < quantity; i++) await addToCart(product.id);
  };
  return (
    <section className="page">
      <div className="breadcrumb">
        <Link href="/products">Shop</Link> /{" "}
        <Link href={`/products?category=${encodeURIComponent(product.category)}`}>
          {product.category}
        </Link>{" "}
        / {product.name}
      </div>
      <div className="detail">
        <div className="detail-image">
          <Image
            src={product.image}
            alt={product.name}
            fill
            priority
            sizes="(max-width: 800px) 100vw, 50vw"
          />
        </div>
        <div>
          <div className="eyebrow">{product.badge}</div>
          <h1>{product.name}</h1>
          <div className="rating">
            ★ {product.rating} <span>({product.reviews} reviews)</span>
          </div>
          <div className="price">
            {money(product.price)} <small> / {product.unit}</small>
          </div>
          <p className="description">{product.description}</p>
          <div className="detail-action">
            <div className="quantity">
              <button
                type="button"
                aria-label="Remove one"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
              >
                −
              </button>
              <span>{quantity}</span>
              <button type="button" aria-label="Add one" onClick={() => setQuantity(quantity + 1)}>
                +
              </button>
            </div>
            {user ? (
              <button className="button" onClick={() => void add()}>
                Add to cart · {money(product.price * quantity)}
              </button>
            ) : (
              <Link className="button" href="/auth">
                Sign in to add
              </Link>
            )}
            <button
              className={saved ? "heart saved" : "heart"}
              onClick={() => void toggleWishlist(product.id)}
              aria-label={saved ? "Remove product from wishlist" : "Save product to wishlist"}
              aria-pressed={saved}
            >
              {saved ? "♥" : "♡"}
            </button>
          </div>
          <div className="detail-facts">
            <div>
              <b>Ingredients</b>
              {product.ingredients}
            </div>
            <div>
              <b>Nutrition</b>
              {product.nutrition}
            </div>
          </div>
        </div>
      </div>
      <div className="section-head" style={{ marginTop: 80 }}>
        <div>
          <div className="eyebrow">More to love</div>
          <h2>From the same aisle</h2>
        </div>
      </div>
      <div className="product-grid">
        {related.map((item) => (
          <ProductCard product={item} key={item.id} />
        ))}
      </div>
    </section>
  );
}
