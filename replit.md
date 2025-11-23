# BKApay - Plateforme de Paiement Mobile Money

## Vue d'ensemble
BKApay est une plateforme moderne de paiement mobile money pour l'Afrique de l'Ouest. Elle permet aux entreprises et particuliers d'accepter des paiements via mobile money (Orange Money, MTN, Moov, Wave, Free Money, T-Money, Wizall, Expresso) dans 6 pays: Bénin, Togo, Côte d'Ivoire, Sénégal, Burkina Faso et Mali.

## Dernières modifications (22 Novembre 2025)
- ✅ Création complète de la plateforme BKApay (MVP achevé)
- ✅ Implémentation de l'authentération personnalisée (sans Replit Auth)
- ✅ Configuration complète du frontend avec React, Tailwind CSS et Shadcn UI
- ✅ Mise en place du backend avec Express, PostgreSQL et intégration Paydunya
- ✅ Création de toutes les fonctionnalités: liens de paiement, liens marchands, API Gateway
- ✅ Design professionnel aux couleurs du logo (vert et doré)
- ✅ Dashboard Analytics avec graphiques détaillés (revenus par date, opérateur, pays, type)
- ✅ Support multi-devises (XOF, USD, EUR) avec conversion
- ✅ Migration vers driver postgres-js pour une meilleure stabilité
- ✅ **CORRECTION**: Persistance de session - l'utilisateur reste connecté après actualisation
- ✅ **NOUVEAU**: Détails des transactions cliquables dans l'historique (email, téléphone du client)
- ✅ **NOUVEAU**: Dépôts via Paydunya (formulaire simplifié: montant + pays + opérateur)
- ✅ **NOUVEAU**: Transferts via API Paydunya Disburse (débits de compte)
- ✅ **NOUVEAU**: Endpoint public `/api/payments/create` pour intégration par clés API (paiements entrants et sortants)
- ✅ **NOUVEAU**: Modification des liens de paiement (users can create, modify, or delete)

## Architecture du projet

### Frontend (React + TypeScript)
- **Pages publiques**:
  - Page d'accueil avec hero section et présentation
  - Inscription/Connexion utilisateur
  - Pages de paiement public (liens de paiement et liens marchands)

- **Dashboard (authentifié)**:
  - Vue d'ensemble avec statistiques en XOF
  - Gestion des liens de paiement
  - Gestion des liens marchands
  - Gestion des clés API
  - Historique des transactions
  - Profil utilisateur
  - Paramètres, Annonces, Documentation, Support

### Backend (Express + PostgreSQL)
- **Authentification**: Sessions avec bcrypt pour le hashing des mots de passe
- **API Routes**:
  - `/api/auth/*` - Inscription, connexion, déconnexion, profil
  - `/api/dashboard/stats` - Statistiques utilisateur
  - `/api/payment-links` - CRUD liens de paiement
  - `/api/merchant-links` - CRUD liens marchands
  - `/api/api-keys` - CRUD clés API
  - `/api/transactions` - Historique des transactions
  - `/api/payments/process/:token` - Traitement paiements (liens)
  - `/api/merchant-payments/process/:token` - Traitement paiements (marchands)
  - `/api/payments/create` - Paiements via clé API (public, pour développeurs)
  - `/api/deposits` - Dépôts sur le compte
  - `/api/transfers` - Transferts/retraits vers mobile money
  - `/api/webhooks/paydunya` - Webhook pour notifications Paydunya

### Base de données (PostgreSQL)
- **users**: Utilisateurs de la plateforme
- **payment_links**: Liens de paiement avec montant fixe
- **merchant_links**: Liens marchands avec montant flexible
- **api_keys**: Clés API pour intégration
- **transactions**: Historique complet des transactions

## Intégration Paydunya
L'application utilise l'API Paydunya pour traiter les paiements mobile money:

### Clés API Paydunya (configuration)
- Clé Principale: Tz2P2cx3-hYKE-Jvh2-9aTw-Jvo3n9OWptIE
- Clé Publique: live_public_dS2oPIQXEEVyG4XXxwv6qsiX3ze
- Clé Privée: live_private_2ZXWJvCMlCwfjZ1KK5W7kuVkpCj
- Token: QyQQLjXhF3hhoAZLFknk

### Flux de paiement
1. L'utilisateur crée un lien de paiement ou lien marchand
2. Le client remplit le formulaire de paiement
3. L'app appelle l'API Paydunya pour créer une invoice
4. Le client est redirigé vers la page de paiement Paydunya
5. Paydunya traite le paiement via mobile money
6. Webhook notifie KEJAtransfer du résultat
7. La transaction et le solde sont mis à jour

## Opérateurs supportés par pays
- **Sénégal**: Orange Money, Free Money, Expresso, Wave, Wizall
- **Côte d'Ivoire**: Orange Money, MTN, Moov, Wave
- **Burkina Faso**: Orange Money, Moov
- **Bénin**: Moov, MTN
- **Togo**: T-Money, Moov
- **Mali**: Orange Money, Moov

## Variables d'environnement
- `DATABASE_URL`: URL de connexion PostgreSQL
- `SESSION_SECRET`: Secret pour les sessions
- `PAYDUNYA_MASTER_KEY`: Clé principale Paydunya
- `PAYDUNYA_PUBLIC_KEY`: Clé publique Paydunya
- `PAYDUNYA_PRIVATE_KEY`: Clé privée Paydunya
- `PAYDUNYA_TOKEN`: Token Paydunya
- `BASE_URL`: URL de base de l'application (pour webhooks)

## Fonctionnalités principales

### 1. Liens de paiement
- Créer des liens avec montant fixe pour produits/services
- Upload d'image optionnel
- Partage facile du lien
- Suivi des paiements

### 2. Liens marchands
- Lien unique par marchand
- Montant défini par le client
- Parfait pour donations, pourboires, etc.

### 3. API Gateway
- Génération de clés API (publique/privée) pour développeurs
- **Paiements entrants**: Endpoint public `/api/payments/create` pour intégrer collecte de paiements
  - Les revenus vont directement au dashboard du développeur
  - Pas besoin de gérer directement Paydunya
- **Paiements sortants**: Les développeurs peuvent faire des transferts/retraits depuis leur dashboard
- Redirection vers interface de paiement Paydunya
- Webhook pour notifications des paiements

### 4. Gestion des transactions
- Historique complet
- Statuts: completed, pending, failed, cancelled
- Filtres par type, pays, opérateur
- Export des données

## Design
- Couleurs principales: Vert (#228B22 environ) et Doré/Accent (#FFD700 environ)
- Police: Inter pour le corps, DM Sans pour les titres
- Design responsive mobile-first
- Composants Shadcn UI
- Mode sombre supporté

## Système de clés API (Paiements entrants et sortants)

### Flux complet des paiements via clés API:
1. **Développeur crée une clé API** sur KEJAtransfer (génère publicKey et privateKey)
2. **Intègre sur son site** en appelant `/api/payments/create` avec sa publicKey
3. **Clients du développeur payent** → funds vont au dashboard du développeur
4. **Développeur fait un retrait** depuis sa page Transferts → prélève sur son dashboard et envoie aux clients finaux via mobile money

### Exemple d'intégration:
```javascript
// Sur le site du développeur
const response = await fetch('https://keja.app/api/payments/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    publicKey: 'pk_live_xxxxx',
    amount: 50000,
    description: 'Achat produit',
    customerName: 'Jean',
    customerEmail: 'jean@example.com',
    customerPhone: '+221781234567',
    country: 'SN',
    operator: 'orange'
  })
});
const { redirectUrl } = await response.json();
// Rediriger client vers Paydunya
window.location.href = redirectUrl;
```

## API REST Complète pour Développeurs Tiers (NOUVEAU - 2025)

### Endpoints disponibles
- ✅ **POST `/api/payments/create`** - Créer un paiement via clé API (public)
- ✅ **GET `/api/transactions`** - Historique des transactions
- ✅ **GET `/api/dashboard/stats`** - Statistiques en temps réel
- ✅ **GET/POST `/api/payment-links`** - Gestion des liens de paiement
- ✅ **GET/POST `/api/merchant-links`** - Gestion des liens marchands
- ✅ **GET/POST `/api/api-keys`** - Gestion des clés API
- ✅ **POST `/api/deposits`** - Créer un dépôt
- ✅ **POST `/api/transfers`** - Créer un transfert/retrait
- ✅ **POST `/api/webhooks/paydunya`** - Webhooks signés pour notifications

### Authentification API
- Clés API publiques/privées pour développeurs
- Bearer token authentication
- Rate limiting: 10 requêtes/sec par clé
- Webhooks signés (HMAC-SHA256)

### Documentation
- `API_DOCUMENTATION.md` - Documentation complète
- `API_QUICK_START.md` - Guide de démarrage rapide
- `SDK_INTEGRATION_EXAMPLES.md` - Exemples d'intégration (JS, Python, PHP, React, Vue)
- `API_STATUS.md` - Statut et disponibilité

### Features futures
- SDK JavaScript officiel
- SDK Python officiel
- SDK PHP officiel
- Plugin WooCommerce
- Plugin Prestashop
- Support Stripe Connect
- API GraphQL

## Prochaines étapes potentielles
- Implémenter les SDKs officiels
- Ajouter les plugins de paiement
- Support API GraphQL
- Application mobile
