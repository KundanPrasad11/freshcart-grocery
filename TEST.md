# FreshCart automated tests

## Setup

Copy `.env.test.example` values into `.env.local`, or provide `MONGODB_URI_TEST` and `MONGODB_DB_TEST` in your shell. The test database name must end in `_test` or `_e2e`; the reset helper refuses every other database name.

## Commands

- `npm run test:unit` — totals, discounts, Zod schemas, malformed JSON, HTML escaping, and rate limits.
- `npm run test:api` — real MongoDB integration coverage for registration, catalog, cart/order mutations, stock, and invoices. It uses only the dedicated test database.
- `npm run test:e2e` — Playwright Chromium journey for sign-up → cart → checkout. It starts an isolated app on port 3001 and stubs the invoice browser request, so no email is sent.
- `npm run test` — unit plus API suites.
- `npm run test:all` — all automated suites.
- `npm run test:coverage` — coverage report for testable server and library code.

Run `npx playwright install chromium` once after installing dependencies. Run `npm run build` as the release gate after the automated suites pass.

## Manual visual checks

Automated coverage replaces the former manual functional checklist. Keep manual checks only for responsive behavior at 375px and 768px, image loading, and final visual polish.

## Coverage boundary

- Invoice email composition is verified with a mocked Resend response in API tests; real delivery remains an external integration concern.
- Browser tests use a fresh MongoDB test database and one worker because registrations are IP-rate-limited and checkout changes inventory.
