# BKApay - Mobile Money Payment Platform

## Overview
BKApay is a mobile money payment platform for West Africa, enabling businesses and individuals to accept payments via various mobile money services across multiple countries. It supports deposits, withdrawals, payment links, and API integrations with a uniform 6% transaction fee. The platform's vision is to become a leading payment solution in the region, simplifying financial transactions and fostering economic growth.

## User Preferences
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
- **Multi-Provider System**: Supports AfribaPay, Paydunya, FedaPay, MbiyoPay, and NOWPayments (cryptocurrency) with mutual exclusivity per country (for both payin and payout).
- **Payment Gateway Integration**: FedaPay is a primary gateway for collect (incoming) and payout (outgoing) payments across 7 countries. Payments involve FedaPay redirect and webhook/polling confirmation.
- **Withdrawal Flows**: Utilizes FedaPay Payout API, including KYC validation, balance checks, and phone number sanitization. Transfer and Withdrawal pages feature a `PaymentMethodSelector` toggle between Mobile Money and Cryptocurrency options.
- **Crypto Withdrawals/Transfers (NOWPayments)**: Users can withdraw or transfer funds to a crypto wallet address via the `CryptoWithdrawalFlow` component. Backend validates security code, crypto minimums, wallet address, and balance, then automatically calls the NOWPayments Payout API (`POST /v1/payout`) to initiate the withdrawal. If the API call fails, the user's balance is refunded. A dedicated webhook (`POST /api/webhooks/nowpayments/payout`) handles payout status notifications (FINISHED, FAILED, etc.) with mandatory IPN signature verification and idempotent processing to prevent double refunds. Transaction metadata stores `payoutId` and `payoutWithdrawalId` for tracking.
- **Silent Fees**: A uniform 6% transaction fee is applied across all countries and operators.
  - **Deposits (Incoming)**: Client pays GROSS, user receives NET (GROSS - 6%).
  - **Withdrawals (Outgoing)**: User enters GROSS, provider receives NET (GROSS - 6%). User's balance debited GROSS.
  - **Transfers (Outgoing)**: User enters NET, provider receives NET. User's balance debited NET + 6%.
- **Account Suspension**: System for user account suspension and reactivation.
- **API Gateway**: Provides versioned API for developers to integrate with BKApay for incoming payments, including webhook/callback notifications.
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

## External Dependencies
- **AfribaPay API**: Payment gateway.
- **Paydunya API**: Payment gateway.
- **FedaPay API**: Payment gateway.
- **MbiyoPay API**: Payment gateway.
- **NOWPayments API**: Cryptocurrency payment gateway.
- **PostgreSQL**: Primary database.
- **Drizzle ORM**: Database interactions.
- **connect-pg-simple**: PostgreSQL session store.
- **nodemailer**: Email service (for Gmail SMTP).