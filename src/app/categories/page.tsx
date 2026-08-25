"use client";
import Link from "next/link";
import { useStore } from "@/context/store";

export default function CategoriesPage() {
  const { categories, products } = useStore();
  return <section className="page"><div className="page-intro"><div className="eyebrow">Make it delicious</div><h1>Find your everyday favorites</h1><p>From quick breakfast staples to the ingredients for a proper dinner, every aisle is full of good things.</p></div><div className="category-grid">{categories.map((category) => <Link href={`/products?category=${encodeURIComponent(category.name)}`} className="category-card" key={category.id}><div>{category.emoji}</div><h3>{category.name}</h3><p>{products.filter((product) => product.category === category.name).length} products · {category.description}</p></Link>)}</div></section>;
}
