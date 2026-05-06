# BKApay - Mobile Money Payment Platform

BKApay is a mobile money payment platform for Africa, enabling businesses and individuals to accept payments via various mobile money services across multiple countries.

## Run & Operate

```bash
# Install dependencies
npm install

# Run development server (frontend and backend)
npm run dev

# Build for production
npm run build

# Typecheck
npm run typecheck

# Generate Drizzle migrations
drizzle-kit generate:pg

# Push DB schema changes
drizzle-kit push:pg
```

**Required Environment Variables:**
- `DATABASE_URL`
- `SESSION_SECRET`
- `FEDAPAY_API_KEY`, `FEDAPAY_SECRET_KEY`
- `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`
- `MONEYFUSION_PRIVATE_KEY`
- `FEEXPAY_API_KEY`, `FEEXPAY_PUBLIC_KEY`
- `MAILTRAP_USER`, `MAILTRAP_PASS`
- `GMAIL_SMTP_USER`, `GMAIL_SMTP_PASS`
- `OPENAI_API_KEY`
- `BASE_URL` (production domain)

## Stack

- **Frontend:** React 18, TypeScript, Shadcn UI, Tailwind CSS, Wouter, TanStack Query, React Hook Form, Zod
- **Backend:** Express.js, TypeScript, PostgreSQL, Drizzle ORM, Bcrypt, Express Session
- **Database:** PostgreSQL
- **Build Tool:** Vite

## Where things live

- **Frontend App:** `client/src/`
- **Backend API & Logic:** `server/`
- **Database Schema:** `server/db/schema.ts`
- **Drizzle Migrations:** `server/db/migrations/`
- **API Routes:** `server/routes.ts`
- **Authentication Middleware:** `server/middleware/auth.ts`
- **Payment Gateway Integrations:** `server/{gateway_name}.ts` (e.g., `server/fedapay.ts`, `server/nowpayments.ts`)
- **Shared Utilities/Types:** `shared/`
- **Frontend Theme & Styles:** `client/src/index.css`, `client/tailwind.config.js`

## Architecture decisions

- **Unified 6% Transaction Fee:** A flat 6% fee is applied universally, simplifying pricing but requiring careful calculation logic for gross/net amounts based on transaction direction (deposit/withdrawal/transfer).
- **Multi-Provider System with Country/Direction Exclusivity:** Supports numerous payment gateways, but only one provider is active per country for a given operation (payin/payout), simplifying user choice and reducing integration complexity.
- **Strict Account Isolation (Personal vs. Business):** Personal and business accounts are entirely separate, including balances, transaction flows, API keys, and admin views, ensuring data integrity and tailored functionality.
- **Robust Security for Withdrawals and Logins:** Withdrawals require a 6-digit security code and pre-registered phone numbers. Logins enforce mandatory camera photo capture and GPS location, with server-side validation, significantly enhancing account security.
- **Silent Fees & Provider Agnostic API:** All fees are silently incorporated into transactions. The Business API v2.0 provides provider-agnostic responses, abstracting underlying gateway specifics from integrators.

## Product

- Mobile money deposits and withdrawals
- Payment links for individuals and merchants
- API integrations for businesses (payin/payout)
- Cryptocurrency withdrawals (via NOWPayments)
- User dashboard for transaction history, link management, API keys
- Admin dashboard for user management, KYC, suspensions, platform settings
- Real-time transaction processing with webhook confirmations
- Multi-currency support with exchange rate conversions
- EMALI (AI assistant) for transactional operations (withdrawals, transfers)
- Admin broadcast messaging system with AI polishing
- Business bank account configuration and settlement requests

## User preferences

TOUTES les communications avec l'utilisateur doivent être en français. Pas d'anglais dans les messages, explications, résumés ou descriptions de tâches.
I prefer detailed explanations in French.
The application should be 100% functional before deployment.
Webhooks must be correctly configured for the production domain.
FedaPay API keys should be LIVE for production environments.
The BASE_URL must be set to the production domain.
Automatic database migration with smart reconciliation is a must-have for deployment.
Authentication should be persistent across sessions and handle production environment specifics like reverse proxies and cookie policies.

## Gotchas

- **Database Migrations:** Always run `drizzle-kit generate:pg` then `drizzle-kit push:pg` after schema changes. The `db-bootstrap.ts` script handles intelligent reconciliation on startup.
- **Session Persistence:** Ensure `app.set("trust proxy", 1)` and `sameSite: 'lax'` are correctly configured for production to handle reverse proxies and cookie policies.
- **Crypto Fees:** Cryptocurrency transactions involve a complex fee structure (10% markup, 15% crypto fee, optional 6% standard fee) and XOF → USD conversion.
- **PawaPay Decimal Handling:** Be aware of zero-decimal currency specific rounding rules enforced by `roundForCurrency()` and `roundToDecimals()`.
- **Business API Safety:** If `metadata.scope === "business"` is missing for an incoming transaction, funds will NOT be credited to a business wallet, acting as a safety guard.

## Pointers

- **Drizzle ORM Documentation:** [https://orm.drizzle.team/docs/overview](https://orm.drizzle.team/docs/overview)
- **FedaPay API Docs:** _Populate as you build_
- **NOWPayments API Docs:** _Populate as you build_
- **MoneyFusion API Docs:** [https://docs.moneyfusion.net/fr/payout](https://docs.moneyfusion.net/fr/payout)
- **Shadcn UI Documentation:** [https://ui.shadcn.com/docs](https://ui.shadcn.com/docs)
- **Tailwind CSS Documentation:** [https://tailwindcss.com/docs](https://tailwindcss.com/docs)