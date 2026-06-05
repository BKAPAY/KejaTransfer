---
name: PawaPay metadata submerchant
description: Format correct des métadonnées submerchant pour PawaPay API v2 — format plat clé-valeur, pas fieldName/fieldValue.
---

**Règle :** L'API PawaPay v2 (`/v2/deposits`, `/v2/payouts`) attend les métadonnées en format **plat clé-valeur** :
```json
"metadata": [
  { "submerchant_legal_name": "Prénom Nom" },
  { "submerchant_segment": "TECH" }
]
```
NE PAS utiliser le format v1 `fieldName`/`fieldValue` :
```json
"metadata": [
  { "fieldName": "submerchant_legal_name", "fieldValue": "...", "isPII": false }
]
```

**Why :** Le format v1 envoyé sur l'endpoint v2 fait que PawaPay voit deux objets contenant chacun la clé `fieldValue` → rejette avec `DUPLICATE_METADATA_FIELD`. L'erreur PawaPay est trompeuse car elle affiche littéralement `'fieldValue'` comme le nom du champ en doublon, pas le nom du champ submerchant.

**Données envoyées :**
- Compte personnel : `submerchant_legal_name` = prénom + nom (`user.firstName + user.lastName`)
- Compte business : `submerchant_legal_name` = nom de l'entreprise (`user.businessName`) ou prénom+nom
- `submerchant_segment` = `user.kycSubSector || user.kycSector` (optionnel)

**How to apply :** Dans `server/pawapay.ts`, la construction metadata utilise désormais `{ "nomChamp": "valeur" }` pour deposits ET payouts. Dans `server/pawapay-routes.ts`, `handlePawaPayDeposit` construit `submerchantLegalName` et `submerchantSegment` et les passe à `createPawaPayDeposit`.
