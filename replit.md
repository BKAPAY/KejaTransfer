# BKApay - Plateforme de Paiement Mobile Money

## Dernières modifications (24 Novembre 2025)

### Session 11 - Correction Filtrage Opérateurs & Documentation SMS ✅
**Problème**: Les opérateurs ne s'affichaient pas dans les formulaires de dépôt, transfert et retrait. SMS de validation Paydunya non fonctionnels.
**Cause**: Logique de filtrage comparait des objets au lieu des codes d'opérateurs. Requêtes API non parsées. API SOFTPAY manquante.
**Solution**: 
- Correction du filtrage: `allCountryOperators.filter(op => (enabledCountriesOperators[selectedCountry] || []).includes(op.code))`
- Suppression du fallback "BJ" qui empêchait l'affichage initial
- Ajout du parsing JSON dans les mutations (`res.json()`)
- Ajout message UX quand aucun opérateur disponible
- Suppression des placeholders d'exemple (0146447319)
- Documentation complète du problème SMS Paydunya SOFTPAY
**Résultat**: ✅ Opérateurs s'affichent correctement. Polling fonctionne. Message d'erreur UX quand config vide. **⚠️ SMS validation nécessite implémentation SOFTPAY API spécifique par opérateur.**

### Session 10 - Configuration Pays/Opérateurs ✅
**Problème**: Erreur 500 "db.update(...).returning is not a function" lors de l'activation/désactivation des opérateurs.
**Cause**: Syntaxe incorrecte Drizzle ORM dans `updateCountryOperatorConfig` et `getCountryOperatorConfig`.
**Solution**: Correction des méthodes pour utiliser `eq()` et `and()` au lieu de callbacks JavaScript.
**Résultat**: ✅ Toggles fonctionnent, état persiste, plus d'erreur 500.

### Session 9 - Authentification Production ✅
**Problème**: Sessions non persistantes en production, déconnexion à l'actualisation.
**Cause**: MemoryStore par défaut, manque de `trust proxy`, `sameSite: 'strict'` trop restrictif.
**Solution**: Implémentation connect-pg-simple, activation trust proxy, changement à `sameSite: 'lax'`.
**Résultat**: ✅ Login fonctionne, sessions persistent, pas de déconnexion intempestive.

### Session 8 - Migration Automatique ✅
**Problème**: Erreur "relation already exists" lors du déploiement en production.
**Cause**: Migrations appliquées mais non trackées dans drizzle.__drizzle_migrations.
**Solution**: Réconciliation transactionnelle avec calcul SHA256 et backfill automatique.
**Résultat**: ✅ Migrations automatiques, gère tous les scénarios de déploiement.

## Overview
BKApay is a modern mobile money payment platform designed for West Africa. It enables businesses and individuals to accept payments via various mobile money services (Orange Money, MTN, Moov, Wave, Free Money, T-Money, Wizall, Expresso) across 6 countries: Benin, Togo, Ivory Coast, Senegal, Burkina Faso, and Mali. The platform aims to streamline mobile money transactions, offering robust features for deposits, withdrawals, payment links, and API integrations.

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
The frontend utilizes React 18 with TypeScript, styled with Shadcn UI and Tailwind CSS for a professional and consistent design. Navigation is handled by Wouter. Public pages include a hero section, authentication flows, and dedicated policy pages (Terms, Privacy, Cookies) linked in the footer. The authenticated dashboard provides an overview, transaction history, payment/merchant link management, API key management, and dedicated interfaces for deposits and withdrawals. An Admin Dashboard is available for user, KYC, and suspension management.

### Technical Implementations
- **Frontend**: React 18, TypeScript, Wouter, React Hook Form + Zod, Shadcn UI, Tailwind CSS, TanStack Query, Paydunya PSR SDK for embedded payment modals.
- **Backend**: Express.js, TypeScript, PostgreSQL, Drizzle ORM for database interactions, Bcrypt for password hashing, Express Session for session management.
- **Database**: PostgreSQL storing `users` (with KYC and suspension status), `payment_links`, `merchant_links`, `api_keys`, and `transactions` (with statuses: pending, completed, failed).
- **Authentication**: Persistent sessions managed using `connect-pg-simple` for PostgreSQL, `app.set("trust proxy", 1)` for production environments, and `sameSite: 'lax'` for cookies to ensure secure and stable user sessions.
- **Automatic Database Migrations**: A `db-bootstrap.ts` script handles automatic Drizzle ORM migrations on startup, including intelligent reconciliation for tracking existing migrations, SHA256 hash verification, and transactional backfilling of missing migration entries. This ensures seamless synchronization between development and production environments.
- **Payment Flows (SOFTPAY Deposits)**: Utilizes Paydunya API v1. Users initiate deposits via a form, the backend creates a Paydunya invoice, and the frontend polls for payment status updates every 3 seconds. A Paydunya webhook confirms the payment, updating the transaction status and user balance.
- **Withdrawal/Transfer Flows**: Implemented using Paydunya v2 Disburse API. After KYC validation and balance checks, the backend creates and submits a disbursement invoice. The user's balance is debited immediately upon successful submission, and a transaction record is created.
- **Embedded PSR Payments**: Integrates Paydunya's PSR SDK to display payment modals directly within the BKApay platform, eliminating external redirections.
- **Silent Fees**: Automatic calculation of transaction fees (3% for Benin, 6% for other countries) applied silently to transactions.
- **Account Suspension**: System for suspending and reactivating user accounts.
- **API Gateway**: Provides public/private API keys for developers to integrate with BKApay for incoming payments.

## External Dependencies
- **Paydunya API v1**: Used for creating checkout invoices for SOFTPAY deposits (`checkout-invoice/create`).
- **Paydunya API v2**: Used for disbursements (withdrawals/transfers) via the Disburse API (`disburse/get-invoice`, `disburse/submit-invoice`).
- **Paydunya PSR SDK**: Integrated into the frontend for embedded payment modals.
- **PostgreSQL**: Primary database for storing all application data.
- **Drizzle ORM**: Used for interacting with the PostgreSQL database.
- **connect-pg-simple**: PostgreSQL session store for persistent user sessions.