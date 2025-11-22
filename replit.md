# KEJAtransfer - Plateforme de Paiement Mobile Money

## Vue d'ensemble
KEJAtransfer est une plateforme moderne de paiement mobile money pour l'Afrique de l'Ouest. Elle permet aux entreprises et particuliers d'accepter des paiements via mobile money (Orange Money, MTN, Moov, Wave, Free Money, T-Money, Wizall, Expresso) dans 6 pays: Bénin, Togo, Côte d'Ivoire, Sénégal, Burkina Faso et Mali.

## Dernières modifications (22 Novembre 2025)
- Création complète de la plateforme KEJAtransfer (MVP achevé)
- Implémentation de l'authentification personnalisée (sans Replit Auth)
- Configuration complète du frontend avec React, Tailwind CSS et Shadcn UI
- Mise en place du backend avec Express, PostgreSQL et intégration Paydunya
- Création de toutes les fonctionnalités: liens de paiement, liens marchands, API Gateway
- Design professionnel aux couleurs du logo (vert et doré)
- **NOUVEAUTÉ**: Dashboard Analytics avec graphiques détaillés (revenus par date, opérateur, pays, type)
- **NOUVEAUTÉ**: Support multi-devises (XOF, USD, EUR) avec conversion
- Migration vers driver postgres-js pour une meilleure stabilité

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
- Génération de clés API (publique/privée)
- Intégration sur sites web tiers
- Redirection vers interface de paiement KEJAtransfer
- Webhook pour notifications

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

## Note sur les paiements sortants
L'API Paydunya utilisée ne supporte actuellement que les paiements entrants (collecte de fonds). Pour les paiements sortants (transferts vers les utilisateurs), il faudra soit contacter Paydunya pour une API de payout, soit intégrer un service complémentaire.

## Prochaines étapes potentielles
- Implémenter les paiements sortants (si API disponible)
- Ajouter analytics avancés et graphiques
- Support multi-devises
- Notifications email/SMS
- API REST complète pour développeurs tiers
- Application mobile
