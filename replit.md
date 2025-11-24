# BKApay - Plateforme de Paiement Mobile Money

## Overview
BKApay is a modern mobile money payment platform designed for West Africa. It enables businesses and individuals to accept payments via various mobile money services (Orange Money, MTN, Moov, Wave, Free Money, T-Money, Wizall, Expresso) across 6 countries: Benin, Togo, Ivory Coast, Senegal, Burkina Faso, and Mali. The platform aims to streamline mobile money transactions, offering robust features for deposits, withdrawals, payment links, and API integrations. The backend supports 19 SOFTPAY operators across these countries, ensuring comprehensive coverage and hardened error handling for production readiness.

## User Preferences
I prefer detailed explanations.
The application should be 100% functional before deployment.
Webhooks must be correctly configured for the production domain.
Paydunya API keys should be LIVE for production environments.
The BASE_URL must be set to the production domain.
Automatic database migration with smart reconciliation is a must-have for deployment.
Authentication should be persistent across sessions and handle production environment specifics like reverse proxies and cookie policies.
For testing, always use valid African phone numbers as Paydunya only sends SMS to them.

## System Architecture

### UI/UX Decisions
The frontend utilizes React 18 with TypeScript, styled with Shadcn UI and Tailwind CSS for a professional and consistent design. Navigation is handled by Wouter. Public pages include a hero section, authentication flows, and dedicated policy pages. The authenticated dashboard provides an overview, transaction history, payment/merchant link management, API key management, and dedicated interfaces for deposits and withdrawals. An Admin Dashboard is available for user, KYC, and suspension management. UI messages are sanitized to be 100% in French, without technical codes or special characters, for a professional user experience.

### Technical Implementations
- **Frontend**: React 18, TypeScript, Wouter, React Hook Form + Zod, Shadcn UI, Tailwind CSS, TanStack Query, Paydunya PSR SDK for embedded payment modals.
- **Backend**: Express.js, TypeScript, PostgreSQL, Drizzle ORM, Bcrypt for password hashing, Express Session for session management.
- **Database**: PostgreSQL storing `users`, `payment_links`, `merchant_links`, `api_keys`, and `transactions` (with statuses: pending, completed, failed).
- **Authentication**: Persistent sessions managed using `connect-pg-simple` for PostgreSQL, `app.set("trust proxy", 1)` for production environments, and `sameSite: 'lax'` for cookies.
- **Automatic Database Migrations**: A `db-bootstrap.ts` script handles automatic Drizzle ORM migrations on startup, including intelligent reconciliation for tracking existing migrations, SHA256 hash verification, and transactional backfilling.
- **Payment Flows (SOFTPAY Deposits)**: Utilizes Paydunya API v1 for creating invoices. The backend implements specific logic for 19 SOFTPAY operators (Orange Money, MTN, Moov, Wave, Free Money, Wizall, Expresso, T-Money, Paydunya wallet) with robust error handling, transaction ID extraction, and USSD instructions. Frontend polls for payment status.
- **Withdrawal/Transfer Flows**: Implemented using Paydunya v2 Disburse API, requiring KYC validation and balance checks.
- **Embedded PSR Payments**: Integrates Paydunya's PSR SDK for direct payment modals.
- **Silent Fees**: Automatic calculation of transaction fees (3% for Benin, 6% for other countries).
- **Account Suspension**: System for suspending and reactivating user accounts with primary admin protection.
- **API Gateway**: Provides public/private API keys for developers to integrate with BKApay for incoming payments, including pending transaction creation and strict country validation.
- **Fee System**: Robust and deterministic fee calculation logic distinguishing between INCOMING (client pays gross, credited net) and OUTGOING (user requests net, debited net+fees) transactions.
- **Webhook Processing**: Uses a dedicated `paydunyaToken` column for deterministic transaction lookup, eliminating fragile metadata parsing.
- **Operator Filtering**: Corrected logic for displaying operators based on country selection.

## External Dependencies
- **Paydunya API v1**: Used for creating checkout invoices (`checkout-invoice/create`) and SOFTPAY operator-specific endpoints.
- **Paydunya API v2**: Used for disbursements (`disburse/get-invoice`, `disburse/submit-invoice`).
- **Paydunya PSR SDK**: Integrated into the frontend for embedded payment modals.
- **PostgreSQL**: Primary database.
- **Drizzle ORM**: For database interactions.
- **connect-pg-simple**: For PostgreSQL session store.