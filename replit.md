# BKApay - Plateforme de Paiement Mobile Money

## Vue d'ensemble
BKApay est une plateforme moderne de paiement mobile money pour l'Afrique de l'Ouest. Elle permet aux entreprises et particuliers d'accepter des paiements via mobile money (Orange Money, MTN, Moov, Wave, Free Money, T-Money, Wizall, Expresso) dans 6 pays: Bénin, Togo, Côte d'Ivoire, Sénégal, Burkina Faso et Mali.

## Dernières modifications (24 Novembre 2025 - Session 7 FOOTER POLICY PAGES)
- ✅ **DÉPÔTS SOFTPAY SANS REDIRECTION - IMPLEMENTATION COMPLETE**
  * **Endpoint Dépôts**: POST `/api/softpay/create-payment` via Paydunya API v1 (checkout-invoice/create)
  * **Flux de dépôt SOFTPAY**:
    1. Utilisateur remplit formulaire (montant, pays, opérateur, numéro)
    2. Backend crée facture Paydunya v1
    3. Frontend reçoit token et attache custom_data (userId, country, operator, phone)
    4. Polling au frontend vérifie le statut toutes les 3 secondes
    5. Webhook Paydunya confirme paiement et met à jour solde
  * **Webhook Endpoint**: POST `/api/webhooks/paydunya` pour traiter les confirmations
  * **Polling**: Vérifie le statut du paiement en temps réel (3s interval)
  * **BASE_URL**: Configuré sur https://bkapay.com pour webhooks corrects
  * **Support multi-pays/opérateurs**: 6 pays, 15+ opérateurs supportés
  * **IMPORTANT**: Paydunya n'envoie SMS QUE pour numéros africains (testez avec un vrai numéro!)

- ✅ **RETRAITS/TRANSFERTS VIA PAYDUNYA v2 - IMPLEMENTATION COMPLETE**
  * **Endpoint Retraits**: POST `/api/transfers` via Paydunya v2 Disburse API
  * **Flux de retrait complet**:
    1. Utilisateur remplit formulaire (montant, pays, opérateur, numéro)
    2. Backend crée invoice de déboursement via Paydunya v2
    3. Backend soumet l'invoice pour exécution
    4. Solde utilisateur débité immédiatement après succès
    5. Transaction créée avec statut "completed"
  * **Clés Paydunya LIVE mises à jour**: Nouvelle configuration active
  * **Page Transfer**: Interface complète avec calcul des frais en temps réel
  * **KYC obligatoire**: Vérification requise avant transferts
  * **Support multi-pays/opérateurs**: 6 pays, 17 opérateurs supportés

- ✅ **PAGES DE POLITIQUE - IMPLEMENTATION COMPLETE** (SESSION 7)
  * **Page Conditions**: `/terms` - Conditions Générales d'Utilisation complètes
  * **Page Confidentialité**: `/privacy` - Politique de confidentialité détaillée
  * **Page Cookies**: `/cookies` - Politique de gestion des cookies
  * **Footer configuré**: Liens cliquables vers les 3 pages de politique
  * **Navigation**: Bouton "Retour" pour revenir à l'accueil depuis chaque page
  * **Design cohérent**: Layout professionnel avec Cards shadcn, sticky header

- ✅ **PAYDUNYA PSR (PAIEMENT SANS REDIRECTION)** 
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
  - **Pages de politique** (NEW):
    * Conditions Générales d'Utilisation (/terms)
    * Politique de Confidentialité (/privacy)
    * Politique de Cookies (/cookies)
    * Liens cliquables dans le footer de la page d'accueil

- **Dashboard (authentifié)**:
  - Vue d'ensemble avec statistiques
  - Gestion des liens de paiement
  - Gestion des liens marchands
  - Gestion des clés API (KYC required)
  - Historique des transactions
  - **Dépôts SOFTPAY** via mobile money (polling + webhook) - NEW
  - Transferts/Retraits vers mobile money (Paydunya v2)
  - Profil utilisateur
  - Paramètres, Annonces, Support

- **Admin Dashboard**:
  - Gestion utilisateurs
  - Suspension/réactivation
  - Gestion KYC
  - Historique KYC avec filtrage

### Backend (Express + PostgreSQL)
- **Paydunya SOFTPAY**: Endpoint `/api/softpay/create-payment` (API v1 - checkout-invoice/create)
- **Paydunya Retraits**: Endpoint `/api/transfers` (API v2 - Disburse)
- **Webhooks**: POST `/api/webhooks/paydunya` - confirme paiements et met à jour balances
- **Polling Endpoint**: POST `/api/softpay/verify-payment` - vérifie statut du paiement
- **Flux paiements SOFTPAY**: 
  1. Utilisateur remplit formulaire
  2. Backend crée facture Paydunya + transaction (pending)
  3. Frontend affiche modal PSR ou message d'attente
  4. Utilisateur complète le paiement sur mobile
  5. Webhook Paydunya confirme → Transaction updated → Solde updaté
  6. Polling détecte completion et rafraîchit l'interface

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
- **Paydunya API v1** (invoices/SOFTPAY) + **v2** (withdrawals)

### Intégration Paydunya
- **SOFTPAY API v1**: `/api/v1/checkout-invoice/create`
- **SOFTPAY Polling**: POST `/api/softpay/verify-payment` + `/api/softpay/create-payment`
- **PSR SDK**: Affiche modal popup en frontend
- **PSR Backend Endpoint**: GET `/api/paydunya-api?ref=transactionId`
- **Withdrawals API v2**: `/api/v2/disburse/get-invoice` + `/api/v2/disburse/submit-invoice`
- **Webhooks**: POST `/api/webhooks/paydunya` (confirmation paiements + solde update)
- **Clés LIVE**: Configurées et testées ✅
- **BASE_URL**: https://bkapay.com (pour webhooks corrects)

## Opérateurs supportés par pays
- **Sénégal**: Orange Money, Free Money, Expresso, Wave, Wizall
- **Côte d'Ivoire**: Orange Money, MTN, Moov, Wave
- **Burkina Faso**: Orange Money, Moov
- **Bénin**: Moov, MTN
- **Togo**: T-Money, Moov
- **Mali**: Orange Money, Moov

## Flux de paiement SOFTPAY (Sans Redirection)

### 1. Utilisateur sur page de dépôt
- Remplit formulaire: montant, pays, opérateur, numéro téléphone

### 2. Backend traite la requête
- Crée facture Paydunya v1
- Crée transaction avec statut "pending"
- Retourne token de la facture

### 3. Frontend affiche message d'attente
- Commence polling toutes les 3 secondes
- Vérifie le statut via `/api/softpay/verify-payment`

### 4. Utilisateur complète le paiement
- Reçoit SMS sur mobile money (opérateur)
- Confirme le paiement directement sur le téléphone
- Paydunya vérifie et confirme

### 5. Webhook confirme et met à jour
- Paydunya envoie webhook à `/api/webhooks/paydunya`
- Transaction mise à jour avec statut "completed"
- Solde utilisateur mis à jour automatiquement
- Polling détecte la completion et rafraîchit l'interface

## Flux de retrait/transfert (Paydunya v2)

### 1. Utilisateur sur page de transfert
- Remplit formulaire: montant, pays, opérateur, numéro téléphone
- Solde affiché avec calcul des frais en temps réel

### 2. Validation
- Vérification KYC obligatoire
- Vérification du solde (montant + frais)
- Validation du numéro de téléphone

### 3. Backend traite le retrait
- Étape 1: Crée invoice de déboursement via `/disburse/get-invoice`
- Étape 2: Soumet l'invoice via `/disburse/submit-invoice`
- Retour: Status success/pending/failed

### 4. Balance mise à jour
- Solde débité immédiatement après succès
- Transaction créée avec statut "completed"
- Historique visible dans les transactions

## Caractéristiques principales

### 1. Dépôts SOFTPAY
- Création facture via API v1 Paydunya
- Polling pour vérifier le statut
- Webhook pour confirmer paiement
- Solde mis à jour automatiquement
- Support multi-pays/opérateurs

### 2. Retraits/Transferts
- Via Paydunya v2 Disburse API
- Débit immédiat du solde
- Support multi-pays/opérateurs
- KYC obligatoire

### 3. Paiements PSR Embedded
- Modal popup Paydunya affichée directement dans BKApay
- Pas de redirection externe vers Paydunya
- Interface cohérente et professionnelle

### 4. Liens de paiement
- Montant fixe ou flexible
- Images optionnelles
- Suivi des paiements

### 5. API Gateway
- Clés API publique/privée pour développeurs
- Paiements entrants: `/api/payments/create`
- Documentation complète

### 6. Frais silencieux
- Bénin: 3% entrant/sortant
- Autres pays: 6% entrant/sortant
- Calculés automatiquement

## Variables d'environnement
```
DATABASE_URL=postgresql://...
SESSION_SECRET=your_secret_key
BASE_URL=https://bkapay.com (production)
PAYDUNYA_MASTER_KEY=QdR289f6-ll84-iO0N-GgKj-0E3FWpnG0xqM
PAYDUNYA_PUBLIC_KEY=live_public_GQEwMGBbhQW87K04Jf9Tg8kxYib
PAYDUNYA_PRIVATE_KEY=live_private_5wUDp3LBBaBM9LLDVY7DVaCTOFE
PAYDUNYA_TOKEN=XN1wEVW2Er1PkdtZcj9L
```

## Fichiers clés
- `client/src/pages/dashboard/deposit.tsx` - Page de dépôt SOFTPAY avec polling
- `client/src/pages/dashboard/withdrawal.tsx` - Page de retrait/transfert
- `server/routes.ts` - Endpoints pour dépôts, retraits, webhooks
- `shared/schema.ts` - Schémas de validation et types
- `server/storage.ts` - Gestion des transactions et soldes

## Statuts des fonctionnalités
- ✅ Authentication & KYC
- ✅ **Dépôts SOFTPAY (NEW - polling + webhooks)**
- ✅ **Retraits/Transferts via Paydunya v2**
- ✅ Paiements PSR embedded (SANS REDIRECTION)
- ✅ Liens de paiement & marchands
- ✅ Transactions webhook-driven
- ✅ Frais silencieux
- ✅ Suspension comptes
- ✅ API Gateway
- ✅ Admin Panel
- 📋 SDKs officiels (planifié)
- 📋 Plugins WooCommerce (planifié)

## Notes importantes pour le test

### ⚠️ Numéros de téléphone pour test
- **Paydunya n'envoie les SMS que sur les numéros africains**
- Testez avec un vrai numéro: Sénégal (+221), Bénin (+229), Côte d'Ivoire (+225), etc.
- Ne testez pas avec des numéros français (+33), US (+1), etc.
- Opérateurs supportés: MTN, Orange Money, Moov, Wave, etc. selon le pays

### ✅ Flux de test
1. Créer un compte et se connecter
2. Aller à "Dépôt"
3. Remplir le formulaire avec:
   - Montant (ex: 1000 XOF)
   - Pays (ex: Bénin)
   - Opérateur (ex: MTN)
   - **Numéro africain valide** (ex: numéro MTN Bénin)
4. Cliquer "Créer la facture"
5. Attendre le SMS sur le mobile (3-5 secondes)
6. Confirmer le paiement sur mobile
7. Voir le solde augmenter dans le dashboard

### 🚀 Prêt pour production
- Application est **100% fonctionnelle**
- Webhooks configurés pour BKApay.com
- Paydunya API v1 & v2 testées et opérationnelles
- BASE_URL défini pour https://bkapay.com
- Clés Paydunya LIVE configurées
