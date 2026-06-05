---
name: PawaPay metadata submerchant
description: Ne pas envoyer submerchantLegalName/submerchantSegment à PawaPay sans activation explicite de la feature submerchant sur le compte.
---

**Règle :** Ne jamais passer `submerchantLegalName` ni `submerchantSegment` à `createPawaPayDeposit` dans `handlePawaPayDeposit` (server/pawapay-routes.ts).

**Why :** PawaPay production rejette la requête avec `DUPLICATE_METADATA_FIELD` (failureCode) si la feature submerchant n'est pas activée sur le compte. Le message d'erreur est trompeur ("Duplicate field with fieldName 'fieldValue'") — il ne s'agit pas d'un vrai doublon mais d'une feature gate côté PawaPay.

**How to apply :** Si un jour la feature submerchant est activée sur le compte PawaPay production, on peut réintroduire ces paramètres. En attendant, l'appel dans `handlePawaPayDeposit` ne doit passer que : amount, currency, country, operator, phone, description, externalId, preAuthorisationCode.
