---
name: Restriction pays par secteur d'activité
description: Comment la restriction "un seul pays" (secteurs locaux) est appliquée à travers BKApay
---

# Restriction pays par secteur d'activité

Colonne `users.multiCountryEnabled` (boolean). false = restreint à son pays ; true = tous pays.
Settée au KYC via `isInternationalActivity()` (shared/activity-sectors.ts). L'admin peut la basculer
depuis le profil utilisateur.

## Règle d'application (server/routes.ts helpers)
- `getUserHomeCountry(user)` : entreprise→businessCountry||country, sinon country.
- `effectiveAllowedCountries(owner, linkAllowed)` : si owner restreint → [home], sinon linkAllowed||[].
- `isCountryBlockedForOwner(owner, country)` : true si owner restreint et country≠home.

## Deux niveaux de défense (les DEUX sont nécessaires)
1. **Affichage** : on force `allowedCountries=[home]` dans les endpoints publics (payment-links/public,
   merchant-links/public, api-key-info, payment-sessions GET). Toutes les pages publiques filtrent
   leur sélecteur de pays par `allowedCountries`. **Piège** : pages publiques ≠ pages marchand —
   filtrer côté propriétaire (owner), jamais par la session du visiteur.
2. **Enforcement** : `isCountryBlockedForOwner` dans CHAQUE route de traitement (api-pay/init,
   payment-sessions/pay, fedapay/payment-link, fedapay/merchant-link, /api/v1/payout,
   business payin+payout). Un lien créé sans allowedCountries (=tous) passerait sinon.

**Why** : l'override d'affichage seul est contournable (POST direct) ; l'enforcement seul laisse voir
les mauvais pays dans l'UI. Code d'erreur API = `COUNTRY_RESTRICTED` (403).

## Endpoint deposits à double usage
`/api/countries-operators/deposits` sert AUSSI les pages publiques de paiement. Le filtre par session
ne s'applique QUE si `?scope=self` (pages marchand : deposit/payment-links/api). Sans scope=self,
ne jamais filtrer par session sinon les payeurs publics seraient bloqués.

## Wallets entreprise
`/api/business/wallet-country-settings` marque les pays restreints comme `disabled` (inactifs, pas
supprimés) en couvrant TOUT le référentiel wallets (WALLET_ORDER, ~26 pays), pas seulement
COLLECT_COUNTRIES (16).
