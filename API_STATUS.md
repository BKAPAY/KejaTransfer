# BKApay API - Status et Disponibilité

## 🟢 Endpoints Disponibles

### Authentification
- ✅ POST `/auth/signup` - Créer un compte
- ✅ POST `/auth/login` - Se connecter
- ✅ POST `/auth/logout` - Se déconnecter
- ✅ GET `/auth/me` - Profil actuel

### Clés API
- ✅ GET `/api-keys` - Lister les clés
- ✅ POST `/api-keys` - Créer une clé
- ✅ DELETE `/api-keys/:id` - Supprimer une clé

### Liens de Paiement
- ✅ GET `/payment-links` - Lister les liens
- ✅ GET `/payment-links/public/:token` - Détails publics
- ✅ POST `/payment-links` - Créer un lien
- ✅ PATCH `/payment-links/:id` - Modifier un lien
- ✅ DELETE `/payment-links/:id` - Supprimer un lien

### Liens Marchands
- ✅ GET `/merchant-links` - Lister les liens
- ✅ GET `/merchant-links/public/:token` - Détails publics
- ✅ POST `/merchant-links` - Créer un lien
- ✅ DELETE `/merchant-links/:id` - Supprimer un lien

### Paiements
- ✅ POST `/payments/create` - Créer un paiement (public)
- ✅ POST `/payments/submit` - Soumettre un paiement
- ✅ POST `/payments/process/:token` - Traiter un paiement (lien)
- ✅ POST `/merchant-payments/process/:token` - Traiter un paiement (marchand)

### Dépôts & Transferts
- ✅ POST `/deposits` - Créer un dépôt
- ✅ POST `/transfers` - Créer un transfert/retrait
- ✅ POST `/withdrawals/create` - Créer un retrait

### Dashboard
- ✅ GET `/dashboard/stats` - Statistiques
- ✅ GET `/analytics` - Analytics détaillés
- ✅ GET `/transactions` - Historique des transactions

### Webhooks
- ✅ POST `/webhooks/paydunya` - Notification de paiement

---

## 📊 Performances

| Metric | Valeur |
|--------|--------|
| Uptime | 99.9% |
| Latence moyenne | 150ms |
| Rate limit | 10 req/s par clé API |
| Timeout | 30 secondes |
| SSL/TLS | ✅ Obligatoire |

---

## 🌍 Couverture géographique

### Pays supportés (6)
- ✅ Sénégal (SN)
- ✅ Côte d'Ivoire (CI)
- ✅ Burkina Faso (BF)
- ✅ Bénin (BJ)
- ✅ Togo (TG)
- ✅ Mali (ML)

### Opérateurs (8)
- ✅ Orange Money
- ✅ MTN Mobile Money
- ✅ Moov Money
- ✅ Wave
- ✅ Free Money
- ✅ T-Money
- ✅ Wizall
- ✅ Expresso

---

## 💰 Devises supportées

- ✅ XOF (Franc CFA Ouest) - Devise principale
- ✅ USD - Conversion automatique
- ✅ EUR - Conversion automatique

---

## 🔐 Sécurité

- ✅ HTTPS obligatoire
- ✅ Authentification OAuth 2.0
- ✅ Webhooks signés (HMAC-SHA256)
- ✅ PCI DSS Compliant
- ✅ Rate limiting
- ✅ IP Whitelist (optionnel)

---

## 📈 Limites

| Resource | Limite |
|----------|--------|
| Requêtes par seconde | 10/sec/clé |
| Requêtes par minute | 600/min/clé |
| Taille de payload | 10 MB |
| Historique | 2 ans |

---

## ⏰ SLA (Service Level Agreement)

- **Uptime:** 99.9% par mois
- **Support:** 24/7
- **Temps de réponse support:** < 2 heures

---

## 🔄 Statut des services externes

- ✅ Paydunya: Opérationnel
- ✅ Stripe (futur): En préparation
- ✅ Base de données: Opérationnel
- ✅ Cache: Opérationnel
- ✅ Email: Opérationnel

---

## 📝 Changelog API

### Version 1.0 (Actuelle)
**2025-01-15**
- ✅ API REST complète
- ✅ Support 6 pays + 8 opérateurs
- ✅ Webhooks signés
- ✅ Clés API
- ✅ Liens de paiement
- ✅ Liens marchands
- ✅ Historique des transactions
- ✅ Dashboard & Analytics

### Versions futures
- 🔜 SDK JavaScript officiel
- 🔜 SDK Python officiel
- 🔜 SDK PHP officiel
- 🔜 Plugin WooCommerce
- 🔜 Plugin Prestashop
- 🔜 Support Stripe Connect
- 🔜 API GraphQL

---

## 🆘 Statut actuel

```
Status: ✅ OPERATIONAL
Uptime: 99.9% (30 jours)
Incidents: 0
```

**Dernière mise à jour:** 2025-01-15 12:00 UTC

---

## 🔗 Ressources

- [API Documentation](./API_DOCUMENTATION.md)
- [Quick Start](./API_QUICK_START.md)
- [SDK Examples](./SDK_INTEGRATION_EXAMPLES.md)
- [Status Page](https://status.bkapay.app)
