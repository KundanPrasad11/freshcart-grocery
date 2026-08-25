"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Product, money } from "@/lib/catalog";
import { useStore } from "@/context/store";
import { signOut } from "next-auth/react";
import { ProductCardActions } from "@/components/product-card-actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useState } from "react";

export function Header() {
  const { cart, wishlist, user } = useStore();
  const pathname = usePathname();
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const nav = [
    ["Shop", "/products"],
    ["Categories", "/categories"],
    ["Orders", "/orders"],
  ] as const;
  return (
    <>
      <div className="announcement">
        Free delivery on orders over ₹999 <span>•</span> Fresh groceries, thoughtfully sourced
      </div>
      <header>
        <Link href="/" className="brand">
          <span>✦</span> freshcart
        </Link>
        <nav aria-label="Primary navigation">
          {nav.map(([label, href]) => (
            <Link key={href} className={pathname === href ? "active" : ""} href={href}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <Link href="/wishlist" aria-label="Wishlist">
            ♡{wishlist.length > 0 && <em>{wishlist.length}</em>}
          </Link>
          <Link href="/cart" aria-label="Cart">
            🛒{count > 0 && <em>{count}</em>}
          </Link>
          {user ? (
            <button
              className="account-button"
              onClick={() => setShowSignOutConfirm(true)}
              title="Sign out"
              aria-label="Open account options"
            >
              {user.name.split(" ")[0]}
            </button>
          ) : (
            <Link className="account-button" href="/auth">
              Sign in
            </Link>
          )}
        </div>
      </header>
      <ConfirmDialog
        open={showSignOutConfirm}
        title="Sign out of FreshCart?"
        description="Your cart, wishlist, and past orders will remain safely stored in your account."
        confirmLabel="Sign out"
        tone="danger"
        onCancel={() => setShowSignOutConfirm(false)}
        onConfirm={() => void signOut({ callbackUrl: "/" })}
      />
    </>
  );
}
export function Footer() {
  return (
    <footer>
      <div className="brand">
        <span>✦</span> freshcart
      </div>
      <p>Better food, made simple.</p>
      <div>
        <Link href="/products">Shop all</Link>
        <Link href="/orders">My orders</Link>
        <Link href="/auth">Account</Link>
      </div>
      <small>© 2026 FreshCart Grocery Co.</small>
    </footer>
  );
}
export function ProductCard({
  product,
  priority = false,
  headingLevel = 3,
}: {
  product: Product;
  priority?: boolean;
  headingLevel?: 2 | 3;
}) {
  const { addToCart, cart, updateQuantity, wishlist, toggleWishlist, user } = useStore();
  const saved = wishlist.includes(product.id);
  const added = cart.find((item) => item.productId === product.id)?.quantity ?? 0;
  const ProductHeading = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className="product-card">
      <Link href={`/products/${product.slug}`} className="product-image">
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 800px) 50vw, (max-width: 1100px) 33vw, 25vw"
          priority={priority}
        />
        <span>{product.badge}</span>
      </Link>
      <div className="product-copy">
        <div className="product-meta">
          {product.category} <b>★ {product.rating}</b>
        </div>
        <Link href={`/products/${product.slug}`}>
          <ProductHeading>{product.name}</ProductHeading>
        </Link>
        <p>{product.unit}</p>
        <div className="product-buy">
          <strong>{money(product.price)}</strong>
          {product.originalPrice && <del>{money(product.originalPrice)}</del>}
          <button
            className={saved ? "heart saved" : "heart"}
            onClick={() => void toggleWishlist(product.id)}
            aria-label={saved ? "Remove product from wishlist" : "Save product to wishlist"}
            aria-pressed={saved}
          >
            {saved ? "♥" : "♡"}
          </button>
          <ProductCardActions
            addedQuantity={added}
            isSignedIn={Boolean(user)}
            onAdd={() => void addToCart(product.id)}
            onRemove={() => void updateQuantity(product.id, added - 1)}
          />
        </div>
      </div>
    </article>
  );
}
export function EmptyState({
  title,
  body,
  href = "/products",
  action = "Browse groceries",
}: {
  title: string;
  body: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="empty">
      <div>🌿</div>
      <h2>{title}</h2>
      <p>{body}</p>
      <Link className="button" href={href}>
        {action}
      </Link>
    </div>
  );
}
