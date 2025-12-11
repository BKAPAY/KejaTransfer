# BKApay - Plateforme de Paiement Mobile Money

## Overview
BKApay is a modern mobile money payment platform designed for West Africa. It enables businesses and individuals to accept payments via various mobile money services across 7 countries: Benin, Togo, Ivory Coast, Senegal, Burkina Faso, Guinea, and Niger. The platform uses FedaPay as the payment gateway, offering robust features for deposits, withdrawals, payment links, and API integrations with a uniform 6% transaction fee.

## User Preferences
I prefer detailed explanations.
The application should be 100% functional before deployment.
Webhooks must be correctly configured for the production domain.
FedaPay API keys should be LIVE for production environments.
The BASE_URL must be set to the production domain.
Automatic database migration with smart reconciliation is a must-have for deployment.
Authentication should be persistent across sessions and handle production environment specifics like reverse proxies and cookie policies.

## System Architecture

### UI/UX Decisions
The frontend utilizes React 18 with TypeScript, styled with Shadcn UI and Tailwind CSS for a professional and consistent design. Navigation is handled by Wouter. Public pages include a hero section, authentication flows, and dedicated policy pages. The authenticated dashboard provides an overview, transaction history, payment/merchant link management, API key management, and dedicated interfaces for deposits and withdrawals. An Admin Dashboard is available for user, KYC, and suspension management. UI messages are sanitized to be 100% in French, without technical codes or special characters, for a professional user experience.

### Technical Implementations
- **Frontend**: React 18, TypeScript, Wouter, React Hook Form + Zod, Shadcn UI, Tailwind CSS, TanStack Query.
- **Backend**: Express.js, TypeScript, PostgreSQL, Drizzle ORM, Bcrypt for password hashing, Express Session for session management.
- **Database**: PostgreSQL storing `users`, `payment_links`, `merchant_links`, `api_keys`, and `transactions` (with statuses: pending, completed, failed).
- **Authentication**: Persistent sessions managed using `connect-pg-simple` for PostgreSQL, `app.set("trust proxy", 1)` for production environments, and `sameSite: 'lax'` for cookies.
- **Automatic Database Migrations**: A `db-bootstrap.ts` script handles automatic Drizzle ORM migrations on startup, including intelligent reconciliation for tracking existing migrations, SHA256 hash verification, and transactional backfilling.
- **Payment Gateway: FedaPay** (migrated from Paydunya):
  - **Collect (Incoming Payments)**: Supports 6 countries - BJ (MTN, Moov, Celtiis), TG (Moov, TogoCom), CI (MTN), SN (Free), GN (MTN), NE (Airtel)
  - **Payout (Outgoing Payments)**: Supports 6 countries - BJ (MTN, Moov, Celtiis), TG (Moov, TogoCom), CI (MTN, Moov, Wave, Orange), SN (Wave, Orange), BF (Moov, Orange), GN (MTN)
  - **Operator Codes**: Use FedaPay format (mtn_open, moov_open, wave_open, orange_open, free_open, celtiis_open, togocom_open, airtel_open)
  - **Payment Flow**: Form submission -> FedaPay redirect page -> Webhook/polling confirmation
  - **Webhooks**: /api/webhooks/fedapay for automatic transaction status updates
- **Withdrawal Flows**: Implemented using FedaPay Payout API. Features include KYC validation, balance checks, proper phone number sanitization, and immediate balance deduction on success.
- **Silent Fees**: Automatic calculation of transaction fees - UNIFORM 6% for ALL countries and operators.
- **Account Suspension**: System for suspending and reactivating user accounts with primary admin protection.
- **API Gateway v1.3**: Provides public/private API keys for developers to integrate with BKApay for incoming payments, including pending transaction creation, strict country validation, and automatic webhook/callback notifications for subscription/account activation.
- **Fee System**: Robust and deterministic fee calculation logic distinguishing between INCOMING (client pays gross, credited net) and OUTGOING (user requests net, debited net+fees) transactions.
- **Webhook Processing**: Uses fedapayTransactionId in metadata for deterministic transaction lookup.
- **Payment Timeout**: 10 minutes for both frontend countdown and backend polling before marking transactions as failed.
- **Transaction Security (CRITICAL)**: 
  - Transactions are created as "pending" and ONLY marked "completed" after strict FedaPay confirmation
  - Atomic `finalizeIncomingTransaction` function prevents duplicate balance credits from webhook/polling race conditions
  - No transactions are finalized without explicit FedaPay confirmation of payment receipt
- **Operator Filtering**: Country-specific operator filtering with separate lists for collect (deposits) and payout (withdrawals).
- **Versioned Documentation**: API documentation is now versioned with URLs like `/documentation/v1.3`. The system supports multiple versions, shows deprecation notices for old versions, and displays changelog for the current version.

## External Dependencies
- **FedaPay API**: Payment gateway for West Africa - handles both collect (incoming) and payout (outgoing) transactions.
- **PostgreSQL**: Primary database.
- **Drizzle ORM**: For database interactions.
- **connect-pg-simple**: For PostgreSQL session store.

## FedaPay Configuration
- **Environment Variable**: `FEDAPAY_SECRET_KEY` (sk_live_* for production, sk_sandbox_* for testing)
- **Currency**: XOF only
- **Country Codes**: Lowercase (bj, tg, ci, sn, bf, gn, ne)
- **Mode**: MUST be specified in Transaction.create() - use "live" for production
- **Webhook URL**: https://bkapay.com/api/webhooks/fedapay
