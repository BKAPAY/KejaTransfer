# BKApay - Mobile Money Payment Platform

## Overview
BKApay is a mobile money payment platform for Africa, enabling businesses and individuals to accept payments via various mobile money services across multiple countries. It supports deposits, withdrawals, payment links, and API integrations with a uniform 6% transaction fee. The platform's vision is to become a leading payment solution in the region, simplifying financial transactions and fostering economic growth.

## User Preferences
TOUTES les communications avec l'utilisateur doivent être en français. Pas d'anglais dans les messages, explications, résumés ou descriptions de tâches.
I prefer detailed explanations in French.
The application should be 100% functional before deployment.
Webhooks must be correctly configured for the production domain.
FedaPay API keys should be LIVE for production environments.
The BASE_URL must be set to the production domain.
Automatic database migration with smart reconciliation is a must-have for deployment.
Authentication should be persistent across sessions and handle production environment specifics like reverse proxies and cookie policies.

## System Architecture

### UI/UX Decisions
The frontend uses React 18 with TypeScript, Shadcn UI, and Tailwind CSS for a professional and consistent design, with Wouter for navigation. Public pages include authentication flows and policy pages. The authenticated dashboard offers an overview, transaction history, payment/merchant link management, API key management, and interfaces for deposits and withdrawals. An Admin Dashboard manages users, KYC, and suspensions. All UI messages are in French, avoiding technical jargon.

### Technical Implementations
- **Frontend**: React 18, TypeScript, Wouter, React Hook Form + Zod, Shadcn UI, Tailwind CSS, TanStack Query.
- **Backend**: Express.js, TypeScript, PostgreSQL, Drizzle ORM, Bcrypt, Express Session.
- **Database**: PostgreSQL storing `users`, `payment_links`, `merchant_links`, `api_keys`, and `transactions` with various statuses.
- **Authentication**: Persistent sessions using `connect-pg-simple`, configured for production environments (`app.set("trust proxy", 1)`, `sameSite: 'lax'`).
- **Automatic Database Migrations**: `db-bootstrap.ts` script handles Drizzle ORM migrations on startup with intelligent reconciliation and SHA256 hash verification.
- **Multi-Provider System**: Supports AfribaPay, Paydunya, FedaPay, MbiyoPay, MoneyFusion (payout-only), and NOWPayments (cryptocurrency) with mutual exclusivity per country (for both payin and payout).
- **Payment Gateway Integration**: FedaPay is a primary gateway for collect (incoming) and payout (outgoing) payments across 7 countries. Payments involve FedaPay redirect and webhook/polling confirmation.
- **Withdrawal Flows**: Utilizes FedaPay Payout API, including KYC validation, balance checks, and phone number sanitization. Transfer and Withdrawal pages feature a `PaymentMethodSelector` toggle between Mobile Money and Cryptocurrency options.
- **Crypto Withdrawals/Transfers (NOWPayments)**: Users can withdraw or transfer funds to a crypto wallet address via the `CryptoWithdrawalFlow` component. Backend validates security code, crypto minimums, wallet address, and balance, then automatically calls the NOWPayments Payout API (`POST /v1/payout`) to initiate the withdrawal. If the API call fails, the user's balance is refunded. A dedicated webhook (`POST /api/webhooks/nowpayments/payout`) handles payout status notifications (FINISHED, FAILED, etc.) with mandatory IPN signature verification and idempotent processing to prevent double refunds. Transaction metadata stores `payoutId` and `payoutWithdrawalId` for tracking.
- **Silent Fees**: A uniform 6% transaction fee is applied across all countries and operators.
  - **Deposits (Incoming)**: Client pays GROSS, user receives NET (GROSS - 6%).
  - **Withdrawals (Outgoing)**: User enters GROSS, provider receives NET (GROSS - 6%). User's balance debited GROSS.
  - **Transfers (Outgoing)**: User enters NET, provider receives NET. User's balance debited NET + 6%.
- **Login Tracking System**: Records login history per user including IP address, approximate geolocation (city, country, ISP via ip-api.com), device type, browser, OS. Admin can view full connection history from the management page via "Connexions" button. Table `login_logs` created at bootstrap. Includes mandatory camera photo capture and GPS precise location at each login via `/login-verify` page. Users who refuse camera/GPS permissions are blocked from accessing the dashboard. Photo and GPS coordinates (with Google Maps link) displayed in admin connection history. Session stores `loginLogId` and `loginVerified` flags. Server-side enforcement via `requireAuth` middleware blocks unverified sessions.
- **Account Suspension**: System for user account suspension and reactivation.
- **Deposit Toggle System**: Global deposit enable/disable via `platform_settings` key `deposit_enabled`, plus per-user override via `users.deposit_override_enabled`. Admin page has a "Depot : ON/OFF" button for global toggle. When global deposit is OFF, management page shows per-user "Depot ON/OFF" buttons. Server-side enforcement on `/api/fedapay/deposit` and `/api/softpay/init-payment` blocks deposits when disabled. When global deposit is re-enabled, all per-user overrides are reset to false.
- **API Gateway**: Provides versioned API for developers to integrate with BKApay for incoming payments, including webhook/callback notifications.
  - **Legacy API Pay** (`/api-pay/:publicKey?amount=...`): Simple redirect flow, amount visible in URL. Still supported for backward compatibility.
  - **Secure Payment Sessions v1.6** (`POST /api/v1/payment-sessions`): Server-side session creation with secret key (`sk_live_`). Amount locked server-side, never in URL. Creates a `payment_url` pointing to `/checkout/:sessionId`. Table `payment_sessions` in DB. Routes: `GET /api/v1/payment-sessions/:id` (public session info), `POST /api/v1/payment-sessions/:id/pay` (initiate payment, all providers: PawaPay/FedaPay/Paydunya/MbiyoPay/AfribaPay), `GET /api/v1/payment-sessions/:id/status` (session status). Frontend checkout page at `client/src/pages/checkout.tsx`.
  - **API Payout v1.5** (`POST /api/v1/payout`): Send money to mobile money numbers via API key.
  - **Business API v2.0** (Direct payin/payout for business accounts):
    - Single `bt_live_...` token for authentication (table: `business_tokens`).
    - `POST /api/v1/business/payin`: Direct mobile money collection (no redirect). Body: `{phone, operator, country, amount, currency}`. Supports all providers including Paydunya (invoice + Softpay STK push).
    - `POST /api/v1/business/payout`: Direct mobile money disbursement. Debits business wallet per country.
    - **Provider Transparency**: All business API responses are provider-agnostic. Error messages are sanitized to never expose internal provider names (PawaPay, Paydunya, FedaPay, etc.). Generic error codes: `OPERATOR_UNAVAILABLE`, `TRANSACTION_FAILED`, `INTERNAL_ERROR`.
    - **Business Wallet Isolation**: Business payins credit `business_wallets` (per country/currency), NOT `users.balance`. `finalizeIncomingTransaction` detects `metadata.scope === "business"` and routes the credit to `creditBusinessWallet(userId, country, currency, netAmount)`. If business wallet coordinates are missing, the transaction is marked completed but NOT credited to personal balance (safety guard). Business payouts debit from `business_wallets`. All payout handlers accept `skipBalanceOps` to bypass personal balance operations. On failure (sync or async via polling/webhooks), the business wallet is refunded via `creditBusinessWallet`. The `safeRefundOutgoingTransaction` function in `payment-polling.ts` is scope-aware: checks `metadata.scope === "business"` and refunds business wallet accordingly.
    - `GET /api/v1/business/payin/:id/status` and `GET /api/v1/business/payout/:id/status`: Status check endpoints.
    - Token management: `GET/POST/PUT/DELETE /api/business/tokens`, regenerate, callback secret management.
    - Uses business-scope provider configs, fee configs, country-operator configs (scope="business").
- **Account Separation**: Personal and business accounts are fully isolated:
  - Admin stats (`/api/admin/stats`) filter personal-only users. Business stats at `/api/admin/business/stats`.
  - Provider configs, fee configs, country-operator configs all use `scope` column ("personal"|"business").
  - Business admin pages mirror personal admin quality (providers, country-operator, fees, management with stats).
  - Documentation page has two tabs: "Integration Compte Personnel" and "Integration Compte Entreprise".
- **Transaction Security**: Transactions are created as "pending" and only marked "completed" after strict FedaPay confirmation, using atomic functions to prevent race conditions.
- **Customer Email Privacy**: Customer emails are never sent to payment providers; generic `noreply@bkapay.com` is used for provider API calls.
- **Operator Filtering**: Country-specific operator filtering for collect and payout.
- **User Country System**: Users must select from 5 authorized countries during registration, which cannot be changed later.
- **Withdrawal Security System**: Allows users to configure up to 3 withdrawal phone numbers and requires a 6-digit bcrypt-hashed security code for all withdrawals.
- **Phone Input**: Implements `PhoneInputWithPrefix` with locked country dial codes for various forms.
- **Email Verification**: Supports optional two-step email verification during signup and a three-step password reset flow using Gmail SMTP via nodemailer.
- **Cryptocurrency Payments (NOWPayments)**: Supports various cryptocurrencies with a XOF → USD conversion and a complex fee structure (10% markup, 15% crypto fee, optional 6% standard fee). Admin controls crypto availability at the **currency level** with separate `payinEnabled` and `payoutEnabled` toggles per cryptocurrency (BTC, ETH, USDT, etc.) in the Countries & Operators page (NOWPayments tab), Fournisseurs page, and Crypto Config page. The `crypto_currencies` table stores `payin_enabled` and `payout_enabled` columns. The `/api/crypto/currencies` endpoint accepts a `direction=payin|payout` query parameter to return only currencies enabled for that direction. `CryptoPaymentFlow` fetches payin-enabled currencies, `CryptoWithdrawalFlow` fetches payout-enabled currencies. Crypto option is always shown in PaymentMethodSelector.
- **Multi-Currency Support**: Supports multiple currencies for certain countries (e.g., CDF and USD for DRC) with a `CurrencySelector` and real-time conversion using an exchange rate API.
- **Currency Conversion Rule**: All final converted amounts are sent to payment providers, with transaction metadata storing `providerAmount`, `providerCurrency`, `balanceAmount`, and `balanceCurrency`.
- **PawaPay Decimal Support**: Zero-decimal currencies (XOF, XAF, CDF, RWF, UGX, TZS, MWK, SLE, NGN, KES, GNF, MGA) are floored to integers. All other currencies (USD, GHS, ZMW, MZN, LSL, EUR) preserve 2 decimal places. The `roundForCurrency()` function in `server/pawapay.ts` and `roundToDecimals()` in `server/currency-converter.ts` both enforce this consistently.
- **EMALI Transactional**: EMALI can execute retraits et transferts via OpenAI function calling (tools: calculate_fees, execute_withdrawal, execute_transfer, convert_currency). Le chat guide l'utilisateur étape par étape, vérifie KYC/code de sécurité/numéros autorisés, calcule les frais, et exécute les opérations en temps réel. Sécurité: validation des numéros de retrait autorisés côté serveur, code de sécurité obligatoire pour les retraits.
- **Admin Messaging System**: Admin can send broadcast emails to users via the "Messages" tab in the admin dashboard. Features: audience filtering by account type (personal/merchant/both) and KYC status (verified/unverified/all), or manual user selection with search. AI message polishing via OpenAI GPT-4o (accept/reject flow). Emails sent via existing Mailtrap system with branded HTML template. Server-side validation (string type checks, length limits, admin exclusion). HTML injection protection via `escapeHtml()` function.
- **Bank Account Configuration**: Business users can configure bank account details (holder, IBAN, bank name, SWIFT/BIC, branch info, country, currency) in Settings page. Admin can view bank account details for each business user.
- **Settlement (Règlement) System**: Business users can request fund transfers from their wallets to their bank account. Creates a settlement record with status "pending". Admin can view/manage settlements in the "Reglements" tab of business admin with pending count badge, and mark them as "completed". Table: `settlements` with bank account snapshot.
- **Business Admin Reorganization**: Admin business management page has 3 tabs: Utilisateurs, Pays (country stats with payment counts), Reglements (with pending badge). "Soldes" button shows wallet balances. Bank detail dialog for each user.
- **Active Users 7 Days**: Route `/api/admin/active-users-7d` now includes both transaction activity AND login activity (login_logs table). No longer excludes admin users.

## External Dependencies
- **AfribaPay API**: Payment gateway.
- **Paydunya API**: Payment gateway.
- **FedaPay API**: Payment gateway.
- **MbiyoPay API**: Payment gateway.
- **MoneyFusion API**: Payout-only payment gateway (24 countries, withdrawals/transfers only). Documentation officielle: https://docs.moneyfusion.net/fr/payout. Endpoint: `POST https://pay.moneyfusion.net/api/v1/withdraw`. Header: `moneyfusion-private-key`. Body: `{countryCode, phone (format local sans préfixe), amount, withdraw_mode, webhook_url}`. Webhooks: `payout.session.completed` / `payout.session.cancelled`. IP du serveur doit être whitelistée dans le dashboard MoneyFusion.
- **NOWPayments API**: Cryptocurrency payment gateway.
- **PostgreSQL**: Primary database.
- **Drizzle ORM**: Database interactions.
- **connect-pg-simple**: PostgreSQL session store.
- **nodemailer**: Email service (for Gmail SMTP).