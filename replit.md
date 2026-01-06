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
- **Fee Deduction Logic**:
  - **Deposits (INCOMING)**: Client pays GROSS amount. User receives NET (GROSS - 6% fees)
  - **Withdrawals (OUTGOING)**: User enters GROSS amount. Provider receives NET (GROSS - 6% fees). User's balance is debited GROSS amount.
  - **Transfers (OUTGOING)**: User enters NET amount. Provider receives NET. User's balance is debited NET + 6% fees.
- **Account Suspension**: System for suspending and reactivating user accounts with primary admin protection.
- **API Gateway v1.3**: Provides public/private API keys for developers to integrate with BKApay for incoming payments, including pending transaction creation, strict country validation, and automatic webhook/callback notifications for subscription/account activation.
- **Fee System**: Robust and deterministic fee calculation logic distinguishing between INCOMING (client pays gross, credited net) and OUTGOING (user requests net, debited net+fees) transactions.
- **Webhook Processing**: Uses fedapayTransactionId in metadata for deterministic transaction lookup.
- **Payment Timeout**: 10 minutes for both frontend countdown and backend polling before marking transactions as failed.
- **Transaction Security (CRITICAL)**: 
  - Transactions are created as "pending" and ONLY marked "completed" after strict FedaPay confirmation
  - Atomic `finalizeIncomingTransaction` function prevents duplicate balance credits from webhook/polling race conditions
  - No transactions are finalized without explicit FedaPay confirmation of payment receipt
- **Customer Email Privacy (CRITICAL)**: 
  - Customer email addresses are NEVER sent to payment providers (FedaPay, Paydunya, AfribaPay)
  - All provider API calls use generic email: `noreply@bkapay.com`
  - This protects customer privacy and prevents providers from contacting customers directly
  - Customer emails are stored internally for BKApay's own notifications only
- **Operator Filtering**: Country-specific operator filtering with separate lists for collect (deposits) and payout (withdrawals).
- **Versioned Documentation**: API documentation is now versioned with URLs like `/documentation/v1.3`. The system supports multiple versions, shows deprecation notices for old versions, and displays changelog for the current version.
- **User Country System**: Users must select their country from 5 authorized countries (BJ, TG, CI, BF, SN) during registration. Legacy users without country must select it in their profile before using certain features. Country cannot be changed once set.
- **Withdrawal Security System**:
  - **Withdrawal Phone Numbers**: Users configure up to 3 withdrawal phone numbers in settings. Withdrawals are only allowed to these pre-configured numbers.
  - **Security Code**: 6-digit security code required for all withdrawals, hashed with bcrypt. Users set it in settings, and must provide current code to change it.
  - **Dashboard Actions**: Three buttons in order: Dépôt (deposit), Transfert (send to any number), Retrait (withdraw to pre-configured numbers with security code).
- **Phone Input with Locked Prefix**: All phone number inputs display a locked country dial code prefix (e.g., "+229" for Benin). Users enter only local digits. Component: `PhoneInputWithPrefix`. Used on deposit, transfer, payment links, merchant checkout, API payment, and settings pages. Storage keeps local digits for backend formatting flexibility.
- **Email Verification System**:
  - **Signup Verification**: Optional two-step signup with 6-digit email verification code. Controlled by GMAIL_APP_PASSWORD environment variable - if not configured, verification is skipped.
  - **Password Reset**: Three-step flow (email → 6-digit code → new password) via `/forgot-password` page.
  - **Verification Codes**: 6-digit codes expire after 10 minutes. Single-use codes stored in `verification_codes` table.
  - **Email Service**: Uses Gmail SMTP via nodemailer. Requires `GMAIL_USER` and `GMAIL_APP_PASSWORD` secrets.

## Multi-Provider System (NEW)
BKApay now supports 3 payment providers with mutual exclusivity:
- **AfribaPay**: 15 countries (Benin, Togo, CI, Senegal, Ghana, Cameroon, etc.)
- **Paydunya**: 6 countries (Benin, Togo, CI, Senegal, Burkina Faso, Mali)
- **FedaPay**: 7 countries (Benin, Togo, CI, Senegal, Guinea, Niger, Burkina Faso)

### Mutual Exclusivity
- A country can only be active for ONE provider at a time (separately for payin and payout)
- Enabling a country for one provider automatically disables it for other providers
- Managed via admin page `/dashboard/country-operator-config`

### Provider Configuration Files
- `shared/afribapay-countries.ts` - AfribaPay countries and operators
- `shared/paydunya-countries.ts` - Paydunya countries and operators  
- `shared/fedapay-countries.ts` - FedaPay countries and operators

### Admin Pages
- `/dashboard/fournisseurs` - Manage API keys and toggle providers on/off
- `/dashboard/country-operator-config` - Enable/disable countries and operators per provider

### Database Tables
- `provider_configs` - API keys and active status per provider
- `country_operator_config` - Operator-level payin/payout settings (with provider field)
- `country_status` - Country-level payin/payout settings (with provider field)

## External Dependencies
- **AfribaPay API**: Payment gateway for 15 African countries
- **Paydunya API**: Payment gateway for West Africa (6 countries)
- **FedaPay API**: Payment gateway for francophone Africa (7 countries)
- **PostgreSQL**: Primary database.
- **Drizzle ORM**: For database interactions.
- **connect-pg-simple**: For PostgreSQL session store.

## FedaPay Configuration
- **Environment Variable**: `FEDAPAY_SECRET_KEY` (sk_live_* for production, sk_sandbox_* for testing)
- **Currency**: XOF only
- **Country Codes**: Lowercase (bj, tg, ci, sn, bf, gn, ne)
- **Mode**: MUST be specified in Transaction.create() - use "live" for production
- **Webhook URL**: https://bkapay.com/api/webhooks/fedapay

## Phone Number Formats by Country
| Country | Format | Digits | International Format | Notes |
|---------|--------|--------|---------------------|-------|
| **BJ (Bénin)** | 01XXXXXXXX | 10 | +22901XXXXXXXX | Changed Nov 30 2024 - KEEP leading 0 |
| **CI (Côte d'Ivoire)** | 0XXXXXXXXX | 10 | +2250XXXXXXXXX | Changed 2021 - KEEP leading 0 |
| **SN (Sénégal)** | 7XXXXXXXX | 9 | +2217XXXXXXXX | Remove leading 0 |
| **GN (Guinée)** | 6XXXXXXXX | 9 | +2246XXXXXXXX | Remove leading 0 |
| **TG (Togo)** | 9XXXXXXX | 8 | +2289XXXXXXX | Remove leading 0 |
| **BF (Burkina Faso)** | 7XXXXXXX | 8 | +2267XXXXXXX | Remove leading 0 |
| **NE (Niger)** | 8XXXXXXX | 8 | +2278XXXXXXX | Remove leading 0 |

## FedaPay Payout Operator Codes (Verified)
| Operator | Code | Countries |
|----------|------|-----------|
| MTN Benin | `mtn_open` | BJ |
| Moov Benin | `moov` | BJ |
| Celtiis Benin | `sbin` | BJ |
| MTN CI | `mtn_ci` | CI |
| Moov CI | `moov_ci` | CI |
| Wave CI | `wave_ci` | CI |
| Orange CI | `orange_ci` | CI |
| Moov Togo | `moov_tg` | TG |
| TogoCom | `togocel` | TG |
| Wave Senegal | `wave_sn` | SN |
| Orange Senegal | `orange_sn` | SN |
| Moov BF | `moov_bf` | BF |
| Orange BF | `orange-bf` | BF (note: hyphen!) |
| MTN Guinea | `mtn_open_gn` | GN |
