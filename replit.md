# BKApay - Plateforme de Paiement Mobile Money

## Vue d'ensemble
BKApay est une plateforme moderne de paiement mobile money pour l'Afrique de l'Ouest. Elle permet aux entreprises et particuliers d'accepter des paiements via mobile money (Orange Money, MTN, Moov, Wave, Free Money, T-Money, Wizall, Expresso) dans 6 pays: Bénin, Togo, Côte d'Ivoire, Sénégal, Burkina Faso et Mali.

## Dernières modifications (24 Novembre 2025 - Session 4 PSR IMPLEMENTATION)
- ✅ **PAYDUNYA PSR (PAIEMENT SANS REDIRECTION) - IMPLEMENTATION COMPLETE**
  * **Endpoint PSR**: GET `/api/paydunya-api?ref=...` retourne `{success: true, token: "..."}`
  * **SDK Paydunya PSR chargé**: Popup/modal sans redirection externe
  * **Flux PSR complet**:
    1. Utilisateur remplit formulaire
    2. Backend crée invoice checkout Paydunya + transaction
    3. Frontend charge SDK PSR Paydunya
    4. Frontend affiche modal de paiement (SANS REDIRECTION)
    5. Utilisateur paie dans le modal
    6. Webhook confirme et crée/met à jour transaction
  * **Utilisateur reste sur BKApay**: Interface cohérente, pas de redirection
  * **Pages modifiées**: `/pay/:token`, `/merchant/:token`, `/api/deposits`
  * **Librairie PSR jQuery Paydunya**: Intégrée dynamiquement

- ✅ **TRANSACTIONS WEBHOOK-DRIVEN OPERATIONAL**
- ✅ **KYC OBLIGATOIRE POUR TRANSFERTS**
- ✅ **FRAIS SILENCIEUX PAR PAYS** (3% Bénin, 6% autres)
- ✅ **SYSTÈME DE SUSPENSION COMPTES**
- ✅ **API PAYDUNYA V1 & V2 CONFIGURÉES**

## Architecture du projet

### Frontend (React + TypeScript)
- **Pages publiques**:
  - Page d'accueil avec hero section
  - Inscription/Connexion
  - Pages de paiement public avec PSR modal embedded (NOUVEAU - sans redirection)
  - Statut de paiement en temps réel

- **Dashboard (authentifié)**:
  - Vue d'ensemble avec statistiques
  - Gestion des liens de paiement
  - Gestion des liens marchands
  - Gestion des clés API (KYC required)
  - Historique des transactions
  - Dépôts via mobile money (PSR modal)
  - Transferts/Retraits vers mobile money
  - Profil utilisateur
  - Paramètres, Annonces, Support

- **Admin Dashboard**:
  - Gestion utilisateurs
  - Suspension/réactivation
  - Gestion KYC
  - Historique KYC avec filtrage

### Backend (Express + PostgreSQL)
- **Paydunya PSR**: Modal popup sans redirection externe
- **Webhooks**: Transactions créées post-confirmation Paydunya
- **Flux paiements PSR**: 
  1. Utilisateur remplit formulaire
  2. Backend crée facture Paydunya + transaction
  3. Frontend affiche modal PSR (pas de redirection!)
  4. Utilisateur scanne/paie dans modal
  5. Webhook Paydunya confirme → Transaction mise à jour
  6. Statut visible en temps réel dans BKApay

### Base de données (PostgreSQL)
- **users**: Utilisateurs avec KYC et suspension
- **payment_links**: Liens avec montant fixe
- **merchant_links**: Liens marchands flexibles
- **api_keys**: Clés pour développeurs
- **transactions**: Historique (statuts: pending, completed, failed)

## Technologies

### Frontend
- React 18 + TypeScript
- Wouter pour routing
- React Hook Form + Zod validation
- Shadcn UI + Tailwind CSS
- TanStack Query pour data fetching
- **Paydunya PSR SDK** - Modal popup sans redirection

### Backend
- Express.js + TypeScript
- PostgreSQL + Drizzle ORM
- Bcrypt pour hashing
- Express Session
- **Paydunya API v1** (invoices) + **v2** (withdrawals)

### Intégration Paydunya
- **API PAR Endpoint**: `/api/v1/checkout-invoice/create`
- **PSR SDK**: Affiche modal popup en frontend
- **PSR Backend Endpoint**: GET `/api/paydunya-api?ref=transactionId`
- **Withdrawals API v2**: `/api/v2/disburse/get-invoice` + `/api/v2/disburse/submit-invoice`
- **Webhooks**: `/api/webhooks/paydunya` (confirmation paiements)
- **Clés LIVE**: Configurées et testées ✅

## Opérateurs supportés par pays
- **Sénégal**: Orange Money, Free Money, Expresso, Wave, Wizall
- **Côte d'Ivoire**: Orange Money, MTN, Moov, Wave
- **Burkina Faso**: Orange Money, Moov
- **Bénin**: Moov, MTN
- **Togo**: T-Money, Moov
- **Mali**: Orange Money, Moov

## Flux de paiement (PSR - Sans Redirection)

### 1. Utilisateur sur page de paiement
- Remplit formulaire: nom, email, téléphone, pays, opérateur

### 2. Backend traite la requête
- Crée facture Paydunya
- Crée transaction avec statut "pending"
- Retourne token de la facture

### 3. Frontend affiche modal PSR
- Charge SDK Paydunya PSR
- Affiche modal popup de paiement
- Utilisateur ne quitte jamais BKApay

### 4. Utilisateur paie
- Paie dans la modal PSR
- Modal gère toute interaction Paydunya
- Pas de redirection externe

### 5. Webhook confirme
- Paydunya envoie webhook
- Transaction mise à jour avec statut "completed"
- Solde utilisateur mis à jour
- Statut visible en temps réel

## Caractéristiques principales

### 1. Paiements PSR Embedded (NOUVEAU)
- Modal popup Paydunya affichée directement dans BKApay
- Pas de redirection externe vers Paydunya
- Interface cohérente et professionnelle
- Utilisateurs ne quittent jamais BKApay

### 2. Liens de paiement
- Montant fixe ou flexible
- Images optionnelles
- Suivi des paiements

### 3. API Gateway
- Clés API publique/privée pour développeurs
- Paiements entrants: `/api/payments/create`
- Documentation complète

### 4. Gestion des transactions
- Historique complet
- Statuts: pending, completed, failed
- Filtres par type, pays, opérateur

### 5. Frais silencieux
- Bénin: 3% entrant/sortant
- Autres pays: 6% entrant/sortant
- Calculés automatiquement

### 6. Suspension de comptes
- Admin peut suspendre utilisateurs
- Toutes fonctionnalités désactivées

## Variables d'environnement
```
DATABASE_URL=postgresql://...
SESSION_SECRET=your_secret_key
PAYDUNYA_MASTER_KEY=QdR289f6-ll84-iO0N-GgKj-0E3FWpnG0xqM
PAYDUNYA_PUBLIC_KEY=live_public_GQEwMGBbhQW87K04Jf9Tg8kxYib
PAYDUNYA_PRIVATE_KEY=live_private_5wUDp3LBBaBM9LLDVY7DVaCTOFE
PAYDUNYA_TOKEN=XN1wEVW2Er1PkdtZcj9L
BASE_URL=https://bkapay.com (optionnel - pour production)
```

## Fichiers modifiés (Session 4)
- ✅ `server/routes.ts` - PSR endpoint + transactions côté PSR
- ✅ `client/src/pages/pay.tsx` - SDK PSR + modal (pas QR code)
- ✅ `client/src/pages/merchant.tsx` - SDK PSR + modal
- ✅ `server/routes.ts` - Deposit PSR support

## Statuts des fonctionnalités
- ✅ Authentication & KYC
- ✅ **Paiements PSR embedded (SANS REDIRECTION)** ← NOUVEAU
- ✅ Liens de paiement & marchands
- ✅ Transactions webhook-driven
- ✅ Frais silencieux
- ✅ Suspension comptes
- ✅ API Gateway
- ✅ Admin Panel
- ✅ Dépôts et Transferts (PSR pour dépôts)
- 📋 Retraits via Paydunya v2 (blocage URL callback en dev)
- 📋 SDKs officiels (planifié)
- 📋 Plugins WooCommerce (planifié)
