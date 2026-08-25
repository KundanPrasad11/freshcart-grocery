export type Product = {
  id: string; slug: string; name: string; category: string; price: number;
  originalPrice: number | null; rating: number; reviews: number; unit: string; badge: string;
  image: string; description: string; ingredients: string; nutrition: string; inStock: boolean; featured: boolean;
};
export type CartItem = { productId: string; quantity: number };
export type Category = { id: string; name: string; emoji: string; description: string };
export const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
