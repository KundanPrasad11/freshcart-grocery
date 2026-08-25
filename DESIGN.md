# FreshCart design brief

## Product direction

FreshCart is an editorial-feeling grocery storefront: warm, calm, and ingredient-led rather than a dense supermarket grid. The visual language uses a cream canvas, deep evergreen type, soft produce greens, and a bright lime highlight for primary actions.

## Information architecture

- Home: brand story, category entry points, and seasonal featured products.
- Shop: searchable, filterable, sortable product catalog.
- Product detail: product story, price, nutrition, and add-to-cart action.
- Cart and checkout: compact review, delivery and payment capture, confirmation.
- Account: sign-in, wishlist, and order history with invoice downloads.

## Components and behavior

The header exposes the high-frequency actions (shop, categories, orders, wishlist, cart, account). Product cards are deliberately compact and include both save and add actions. Cart, wishlist, user, and order state are held in one local storage-backed provider so the demo works across routes and refreshes.

## Responsive approach

The layout switches to two-column product/category grids on small screens. Filters become a compact horizontal set and the header hides lower-priority navigation while retaining account and cart actions. The home hero illustration moves below the copy, preserving readable contrast.

## Production integration boundaries

Authentication uses Auth.js credentials with bcrypt password hashes. User cart, wishlist, and order state live in a server-side file store for this local implementation; replace it with a managed database before a multi-instance deployment. Use a PCI-compliant processor such as Stripe for payments. Invoice emailing uses a server-side Resend route; set `RESEND_API_KEY` and `INVOICE_FROM` in `.env.local` to enable it. Never send payment or email credentials to the browser.
