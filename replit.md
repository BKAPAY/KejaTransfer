# BKApay - Plateforme de Paiement Mobile Money

## Vue d'ensemble
BKApay est une plateforme moderne de paiement mobile money pour l'Afrique de l'Ouest. Elle permet aux entreprises et particuliers d'accepter des paiements via mobile money (Orange Money, MTN, Moov, Wave, Free Money, T-Money, Wizall, Expresso) dans 6 pays: Bénin, Togo, Côte d'Ivoire, Sénégal, Burkina Faso et Mali.

## Dernières modifications (24 Novembre 2025 - Session 3 FINAL)
- ✅ **PAYDUNYA SOFTPAY INTÉGRATION DIRECTE (EMBEDDED)**
  * **QR Codes affichés directement dans BKApay** - Pas de redirection externe
  * Frontend génère QR Code dynamiquement avec librairie qrcode.js
  * Utilisateurs scannent le QR avec leur téléphone depuis BKApay
  * Webhook Paydunya confirme paiement en temps réel
  * Interface professionnelle maintient branding BKApay
  * Pages impactées: `/pay/:token` et `/merchant/:token`
  * Composant réutilisable: `SoftPayQRCode`
- ✅ **BUGS CORRIGÉS**
  * Dépôt: Corrigé mapping des champs (accepte `phone` au lieu de `customerPhone`)
  * Transfert: Formatage correct du numéro téléphone avec code pays Paydunya v2
  * Types: Ajout `@types/qrcode` pour LSP
- ✅ Architecture transactions webhook-driven opérationnelle
- ✅ KYC obligatoire pour clés API et transferts
- ✅ Frais silencieux par pays (3% Bénin, 6% autres)
- ✅ Système de suspension de comptes
- ✅ API Paydunya v2 pour retraits avec formatage téléphone correct

## Architecture du projet

### Frontend (React + TypeScript)
- **Pages publiques**:
  - Page d'accueil avec hero section
  - Inscription/Connexion
  - Pages de paiement public avec QR Code embedded (NOUVEAU)
  - Statut de paiement en temps réel

- **Dashboard (authentifié)**:
  - Vue d'ensemble avec statistiques
  - Gestion des liens de paiement
  - Gestion des liens marchands
  - Gestion des clés API (KYC required)
  - Historique des transactions
  - Dépôts via mobile money (fixe)
  - Transferts/Retraits vers mobile money (flexible)
  - Profil utilisateur
  - Paramètres, Annonces, Support

- **Admin Dashboard**:
  - Gestion utilisateurs
  - Suspension/réactivation
  - Gestion KYC
  - Historique KYC avec filtrage

### Backend (Express + PostgreSQL)
- **Paydunya SoftPay**: QR Codes embedded sans redirection
- **Webhooks**: Transactions créées post-confirmation Paydunya
- **Flux paiements**: 
  1. Utilisateur remplit formulaire
  2. Backend crée facture Paydunya
  3. Frontend affiche QR Code (pas de redirection)
  4. Utilisateur scanne et paie
  5. Webhook Paydunya confirme → Transaction créée
  6. Statut mis à jour en temps réel

### Base de données (PostgreSQL)
- **users**: Utilisateurs avec KYC et suspension
- **payment_links**: Liens avec montant fixe
- **merchant_links**: Liens marchands flexibles
- **api_keys**: Clés pour développeurs
- **transactions**: Historique (statuts: completed, failed)

## Technologies

### Frontend
- React 18 + TypeScript
- Wouter pour routing
- React Hook Form + Zod validation
- Shadcn UI + Tailwind CSS
- TanStack Query pour data fetching
- **qrcode.js** - Génération QR Codes embedded

### Backend
- Express.js + TypeScript
- PostgreSQL + Drizzle ORM
- Bcrypt pour hashing
- Express Session
- Paydunya API v1 & v2

### Intégration Paydunya
- **Endpoint factures**: `/api/v1/checkout-invoice/create`
- **SoftPay QR Codes**: Embedded dans BKApay
- **Withdrawals API v2**: `/api/v2/disburse/get-invoice` + `/api/v2/disburse/submit-invoice`
- **Webhooks**: `/api/webhooks/paydunya`
- **Clés LIVE**: Configurées et testées ✅
- **Formatage téléphone**: Code pays automatiquement ajouté (+229 Bénin, +221 Sénégal, etc.)

## Opérateurs supportés par pays
- **Sénégal**: Orange Money, Free Money, Expresso, Wave, Wizall
- **Côte d'Ivoire**: Orange Money, MTN, Moov, Wave
- **Burkina Faso**: Orange Money, Moov
- **Bénin**: Moov, MTN
- **Togo**: T-Money, Moov
- **Mali**: Orange Money, Moov

## Flux de paiement (Embedded SoftPay)

### 1. Utilisateur sur page de paiement
- Remplit formulaire: nom, email, téléphone, pays, opérateur

### 2. Backend traite la requête
- Crée facture Paydunya
- Retourne URL de paiement Paydunya

### 3. Frontend affiche QR Code
- Génère QR Code avec URL de paiement
- Affiche dans card professionnelle BKApay
- Aucune redirection Paydunya

### 4. Utilisateur scanne et paie
- Scanne QR avec son téléphone
- Paie via son opérateur mobile
- Reste dans sa session Paydunya

### 5. Webhook confirme
- Paydunya envoie webhook
- Transaction créée avec statut "completed" ou "failed"
- Solde utilisateur mis à jour
- Statut visible en temps réel dans BKApay

## Caractéristiques principales

### 1. Paiements Embedded (NOUVEAU)
- QR Codes générés et affichés directement dans BKApay
- Pas de redirection externe
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
- Statuts: completed, failed
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
BASE_URL=https://bkapay.com
```

## Fichiers modifiés (Session 3)
- ✅ `client/src/components/softpay-qrcode.tsx` (NOUVEAU)
- ✅ `client/src/pages/pay.tsx`
- ✅ `client/src/pages/merchant.tsx`
- ✅ `client/src/pages/dashboard/deposit.tsx` (correction dépôt)
- ✅ `server/routes.ts` (correction dépôt, transfert, QR code)
- ✅ `server/utils/qrcode.ts` (NOUVEAU)
- ✅ `package.json` - qrcode, @types/qrcode

## Statuts des fonctionnalités
- ✅ Authentication & KYC
- ✅ Paiements embedded (SoftPay QR Code)
- ✅ Liens de paiement & marchands
- ✅ Transactions webhook-driven
- ✅ Frais silencieux
- ✅ Suspension comptes
- ✅ API Gateway
- ✅ Admin Panel
- ✅ Dépôts et Transferts
- 📋 SDKs officiels (planifié)
- 📋 Plugins WooCommerce (planifié)
