# BKApay - API REST Complète pour Développeurs

## Vue d'ensemble

BKApay est une plateforme de paiement mobile money pour l'Afrique de l'Ouest. Cette documentation API permet aux développeurs tiers d'intégrer facilement les paiements dans leurs applications.

**Base URL:** `https://bkapay.app/api`

## Authentification

### Par clé API (Recommandé pour les intégrations)

Toutes les requêtes d'API qui nécessitent l'authentification doivent inclure votre clé API dans le header:

```
Authorization: Bearer YOUR_PUBLIC_KEY
```

Ou en paramètre POST:

```json
{
  "publicKey": "pk_live_xxxxx"
}
```

### Par session (Pour les applications front-end)

Les applications web peuvent utiliser les sessions. Une fois connecté, les cookies de session gèrent automatiquement l'authentification.

## Codes d'erreur

| Code | Signification |
|------|---------------|
| 200 | Succès |
| 400 | Requête invalide |
| 401 | Non authentifié |
| 403 | Non autorisé |
| 404 | Ressource non trouvée |
| 409 | Conflit (ex: ressource existe déjà) |
| 500 | Erreur serveur |

## Format de réponse

### Réponse réussie
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "...": "fields"
  }
}
```

### Réponse en erreur
```json
{
  "error": "Message d'erreur",
  "details": {
    "field": "Message d'erreur spécifique"
  }
}
```

---

# ENDPOINTS

## 1. AUTHENTIFICATION

### Créer un compte
**POST** `/auth/signup`

```bash
curl -X POST https://bkapay.app/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jean",
    "lastName": "Dupont",
    "email": "jean@example.com",
    "password": "SecurePassword123!"
  }'
```

**Réponse:**
```json
{
  "success": true,
  "message": "Compte créé avec succès"
}
```

### Se connecter
**POST** `/auth/login`

```bash
curl -X POST https://bkapay.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jean@example.com",
    "password": "SecurePassword123!"
  }'
```

**Réponse:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "firstName": "Jean",
    "lastName": "Dupont",
    "email": "jean@example.com",
    "balance": 50000
  }
}
```

### Récupérer le profil actuel
**GET** `/auth/me`

Requires: Session authentifiée

```bash
curl https://bkapay.app/api/auth/me \
  -H "Cookie: connect.sid=..."
```

### Se déconnecter
**POST** `/auth/logout`

Requires: Session authentifiée

---

## 2. CLÉS API

Les clés API permettent aux développeurs d'intégrer les paiements dans leurs applications.

### Lister les clés API
**GET** `/api-keys`

Requires: Session authentifiée

```bash
curl https://bkapay.app/api/api-keys \
  -H "Cookie: connect.sid=..."
```

**Réponse:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Production API Key",
      "publicKey": "pk_live_xxxxx",
      "isActive": true,
      "createdAt": "2025-01-15T10:30:00Z"
    }
  ]
}
```

### Créer une nouvelle clé API
**POST** `/api-keys`

Requires: Session authentifiée

```bash
curl -X POST https://bkapay.app/api/api-keys \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=..." \
  -d '{
    "name": "Mon Application Web"
  }'
```

**Réponse:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Mon Application Web",
    "publicKey": "pk_live_xxxxx",
    "privateKey": "sk_live_xxxxx",
    "isActive": true,
    "createdAt": "2025-01-15T10:30:00Z"
  }
}
```

### Supprimer une clé API
**DELETE** `/api-keys/:id`

Requires: Session authentifiée

---

## 3. LIENS DE PAIEMENT

Les liens de paiement permettent d'accepter des paiements pour des produits/services avec montant fixe.

### Créer un lien de paiement
**POST** `/payment-links`

Requires: Session authentifiée

```bash
curl -X POST https://bkapay.app/api/payment-links \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=..." \
  -d '{
    "productName": "Abonnement Premium",
    "description": "Accès illimité à tous les services",
    "amount": 50000,
    "imageUrl": "https://example.com/image.jpg",
    "isActive": true
  }'
```

**Réponse:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "productName": "Abonnement Premium",
    "description": "Accès illimité à tous les services",
    "amount": 50000,
    "token": "abcd1234",
    "isActive": true,
    "createdAt": "2025-01-15T10:30:00Z"
  }
}
```

### Lister vos liens de paiement
**GET** `/payment-links`

Requires: Session authentifiée

### Récupérer les détails d'un lien (public)
**GET** `/payment-links/public/:token`

Public endpoint - pas d'authentification nécessaire

### Modifier un lien de paiement
**PATCH** `/payment-links/:id`

Requires: Session authentifiée

```bash
curl -X PATCH https://bkapay.app/api/payment-links/uuid \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=..." \
  -d '{
    "productName": "Abonnement Premium v2",
    "amount": 75000
  }'
```

### Supprimer un lien de paiement
**DELETE** `/payment-links/:id`

Requires: Session authentifiée

---

## 4. LIENS MARCHANDS

Un lien unique par marchand permettant aux clients de choisir le montant.

### Créer un lien marchand
**POST** `/merchant-links`

Requires: Session authentifiée

```bash
curl -X POST https://bkapay.app/api/merchant-links \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=..." \
  -d '{
    "merchantName": "MONENTREPRISE"
  }'
```

**Règles:**
- 3-10 caractères majuscules uniquement
- Doit être globalement unique
- Un seul lien marchand par utilisateur

### Lister vos liens marchands
**GET** `/merchant-links`

Requires: Session authentifiée

### Récupérer un lien marchand (public)
**GET** `/merchant-links/public/:token`

Public endpoint

### Supprimer un lien marchand
**DELETE** `/merchant-links/:id`

Requires: Session authentifiée

---

## 5. PAIEMENTS (Intégration par clés API)

### Créer un paiement (PUBLIC)
**POST** `/payments/create`

Public endpoint - Utilisez votre clé publique

```bash
curl -X POST https://bkapay.app/api/payments/create \
  -H "Content-Type: application/json" \
  -d '{
    "publicKey": "pk_live_xxxxx",
    "amount": 50000,
    "description": "Achat de produit",
    "customerName": "Jean Dupont",
    "customerEmail": "jean@example.com",
    "customerPhone": "+221781234567",
    "country": "SN",
    "operator": "orange"
  }'
```

**Paramètres:**
- `publicKey` (string, requis): Votre clé API publique
- `amount` (number, requis): Montant en XOF
- `description` (string, requis): Description du paiement
- `customerName` (string, requis): Nom du client
- `customerEmail` (string, requis): Email du client
- `customerPhone` (string, requis): Numéro mobile du client
- `country` (string, requis): Code pays (BJ, TG, CI, SN, BF, ML)
- `operator` (string, requis): Code opérateur (orange, mtn, moov, wave, free, tmoney, wizall, expresso)
- `metadata` (object, optionnel): Données personnalisées

**Opérateurs par pays:**
- **Sénégal (SN)**: orange, free, expresso, wave, wizall
- **Côte d'Ivoire (CI)**: orange, mtn, moov, wave
- **Burkina Faso (BF)**: orange, moov
- **Bénin (BJ)**: moov, mtn
- **Togo (TG)**: tmoney, moov
- **Mali (ML)**: orange, moov

**Réponse:**
```json
{
  "success": true,
  "data": {
    "transactionId": "uuid",
    "redirectUrl": "https://app.paydunya.com/checkout/...",
    "status": "pending"
  }
}
```

### Soumettre un paiement
**POST** `/payments/submit`

```bash
curl -X POST https://bkapay.app/api/payments/submit \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "uuid",
    "paymentMethod": "ORANGE_MONEY",
    "phoneNumber": "+221781234567"
  }'
```

---

## 6. TABLEAU DE BORD

### Récupérer les statistiques
**GET** `/dashboard/stats`

Requires: Session authentifiée

```bash
curl https://bkapay.app/api/dashboard/stats \
  -H "Cookie: connect.sid=..."
```

**Réponse:**
```json
{
  "success": true,
  "data": {
    "totalRevenue": 500000,
    "totalTransactions": 25,
    "activePaymentLinks": 5,
    "balance": 250000,
    "revenueByDate": [...],
    "revenueByOperator": [...],
    "revenueByCountry": [...]
  }
}
```

### Récupérer l'historique des transactions
**GET** `/transactions`

Requires: Session authentifiée

```bash
curl "https://bkapay.app/api/transactions?limit=20&offset=0" \
  -H "Cookie: connect.sid=..."
```

**Paramètres query:**
- `limit` (number): Nombre de transactions à retourner (défaut: 20)
- `offset` (number): Décalage pour la pagination (défaut: 0)
- `status` (string): Filtrer par statut (completed, pending, failed, cancelled)
- `type` (string): Filtrer par type (payment_link, merchant_link, api_payment, deposit, transfer)

**Réponse:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "api_payment",
      "amount": 50000,
      "currency": "XOF",
      "status": "completed",
      "country": "SN",
      "operator": "orange",
      "customerName": "Jean",
      "customerEmail": "jean@example.com",
      "description": "Achat",
      "createdAt": "2025-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 20,
    "offset": 0
  }
}
```

---

## 7. DÉPÔTS

### Créer un dépôt
**POST** `/deposits`

Requires: Session authentifiée

```bash
curl -X POST https://bkapay.app/api/deposits \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=..." \
  -d '{
    "amount": 100000,
    "country": "SN",
    "operator": "orange"
  }'
```

---

## 8. TRANSFERTS / RETRAITS

### Créer un transfert
**POST** `/transfers`

Requires: Session authentifiée

```bash
curl -X POST https://bkapay.app/api/transfers \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=..." \
  -d '{
    "amount": 50000,
    "country": "SN",
    "operator": "orange",
    "phoneNumber": "+221781234567"
  }'
```

---

## 9. WEBHOOKS

### Notification de paiement
**POST** `/webhooks/paydunya`

BKApay envoie des notifications webhook pour les changements de statut de paiement.

**Headers:**
```
X-Webhook-Signature: signature_sha256
```

**Payload:**
```json
{
  "event": "payment.completed",
  "transactionId": "uuid",
  "status": "completed",
  "amount": 50000,
  "timestamp": "2025-01-15T10:30:00Z"
}
```

**Events:**
- `payment.completed`: Paiement complété
- `payment.failed`: Paiement échoué
- `payment.cancelled`: Paiement annulé
- `payment.pending`: Paiement en attente

---

## Exemple d'intégration complète

### 1. Créer une clé API
- Connectez-vous à BKApay
- Allez à Paramètres > Clés API
- Créez une nouvelle clé

### 2. Intégrer sur votre site
```javascript
// Sur votre frontend
async function initPayment() {
  const response = await fetch('https://bkapay.app/api/payments/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      publicKey: 'pk_live_xxxxx',
      amount: 50000,
      description: 'Achat de produit X',
      customerName: 'Jean Dupont',
      customerEmail: 'jean@example.com',
      customerPhone: '+221781234567',
      country: 'SN',
      operator: 'orange'
    })
  });

  const data = await response.json();
  if (data.success) {
    // Rediriger le client vers Paydunya
    window.location.href = data.data.redirectUrl;
  }
}
```

### 3. Gérer les webhooks
```javascript
// Backend webhook handler
app.post('/webhooks/bkapay', (req, res) => {
  const { event, transactionId, status, amount } = req.body;
  
  if (event === 'payment.completed') {
    // Mettre à jour votre base de données
    // Donner accès à votre client
    console.log(`Paiement de ${amount} XOF reçu!`);
  }
  
  res.json({ success: true });
});
```

---

## Rate Limiting

Les endpoints sont limités à:
- **10 requêtes par seconde** par clé API
- **100 requêtes par minute** par adresse IP

En cas de dépassement: HTTP 429 Too Many Requests

---

## Support

- **Documentation:** https://docs.bkapay.app
- **Email:** support@bkapay.app
- **Chat:** support.bkapay.app
- **Status:** status.bkapay.app

---

## Changelog

### Version 1.0 (2025-01-15)
- ✅ API de paiement complète
- ✅ Gestion des clés API
- ✅ Webhooks
- ✅ Historique des transactions
- ✅ Support multi-pays et opérateurs
