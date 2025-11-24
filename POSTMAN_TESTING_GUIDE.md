# Guide de Test Backend SOFTPAY - Postman

## Configuration Postman

### Environment Variables
Créez un environnement Postman avec:
```
BASE_URL = http://localhost:5000
AUTH_COOKIE = (sera automatiquement rempli après login)
```

## 1. Authentification

### Login
```
POST {{BASE_URL}}/api/auth/login
Content-Type: application/json

{
  "email": "kpetekoussojuste1@gmail.com",
  "password": "votre_mot_de_passe"
}
```

**Important**: Copiez le cookie de session de la réponse et ajoutez-le à tous les appels suivants.

## 2. Test SOFTPAY - Flux Dépôt (Deposit)

### 2.1 INIT - Créer Invoice Paydunya
```
POST {{BASE_URL}}/api/softpay/init-payment
Cookie: connect.sid=<votre_cookie_session>
Content-Type: application/json

{
  "amount": 1000,
  "description": "Test dépôt Orange Money",
  "country": "SN",
  "operator": "orange",
  "phone": "+221771234567",
  "customerName": "Test User",
  "customerEmail": "test@example.com"
}
```

**Réponse attendue**:
```json
{
  "success": true,
  "transactionId": "uuid-transaction",
  "token": "paydunya-token-here",
  "ussdInstruction": "Composez *144*4*6# pour Orange Money Sénégal",
  "requiresOTP": true,
  "requiresTwoStep": false
}
```

### 2.2 CONFIRM - Appeler SOFTPAY avec OTP
```
POST {{BASE_URL}}/api/softpay/confirm-payment
Cookie: connect.sid=<votre_cookie_session>
Content-Type: application/json

{
  "transactionId": "<uuid-transaction-from-init>",
  "token": "<paydunya-token-from-init>",
  "authorizationCode": "123456"
}
```

**Réponse attendue** (succès):
```json
{
  "success": true,
  "message": "Paiement initié avec succès",
  "transactionId": "uuid-transaction",
  "fees": 60,
  "currency": "XOF"
}
```

## 3. Test des 19 Opérateurs

### Orange Money - 4 pays

**Sénégal (SN)**:
```json
{
  "country": "SN",
  "operator": "orange",
  "phone": "+221771234567",
  "authorizationCode": "123456"
}
```

**Côte d'Ivoire (CI)**:
```json
{
  "country": "CI",
  "operator": "orange",
  "phone": "+2250701234567",
  "authorizationCode": "123456"
}
```

**Burkina Faso (BF)**:
```json
{
  "country": "BF",
  "operator": "orange",
  "phone": "+22670123456",
  "authorizationCode": "123456"
}
```

**Mali (ML)**:
```json
{
  "country": "ML",
  "operator": "orange",
  "phone": "+22370123456",
  "authorizationCode": "123456"
}
```

### MTN - 3 pays

**Côte d'Ivoire (CI)**:
```json
{
  "country": "CI",
  "operator": "mtn",
  "phone": "+2250501234567",
  "authorizationCode": "123456"
}
```

**Bénin (BJ)**:
```json
{
  "country": "BJ",
  "operator": "mtn",
  "phone": "+22996123456",
  "authorizationCode": "123456"
}
```

**Mali (ML)**:
```json
{
  "country": "ML",
  "operator": "mtn-ml",
  "phone": "+22376123456",
  "authorizationCode": "123456"
}
```

### Moov - 5 pays

**Côte d'Ivoire (CI)**:
```json
{
  "country": "CI",
  "operator": "moov",
  "phone": "+2250101234567",
  "authorizationCode": "123456"
}
```

**Burkina Faso (BF)**:
```json
{
  "country": "BF",
  "operator": "moov",
  "phone": "+22670123456",
  "authorizationCode": "123456"
}
```

**Bénin (BJ)**:
```json
{
  "country": "BJ",
  "operator": "moov",
  "phone": "+22997123456",
  "authorizationCode": "123456"
}
```

**Togo (TG)**:
```json
{
  "country": "TG",
  "operator": "moov",
  "phone": "+22890123456",
  "authorizationCode": "123456"
}
```

**Mali (ML)**:
```json
{
  "country": "ML",
  "operator": "moov",
  "phone": "+22370123456",
  "authorizationCode": "123456"
}
```

### Wave - 2 pays

**Sénégal (SN)**:
```json
{
  "country": "SN",
  "operator": "wave",
  "phone": "+221771234567",
  "authorizationCode": "123456"
}
```

**Côte d'Ivoire (CI)**:
```json
{
  "country": "CI",
  "operator": "wave",
  "phone": "+2250701234567",
  "authorizationCode": "123456"
}
```

### Autres opérateurs Sénégal

**Free Money (SN)**:
```json
{
  "country": "SN",
  "operator": "free",
  "phone": "+221761234567",
  "authorizationCode": "123456"
}
```

**Wizall (SN)** - TWO-STEP:
```json
{
  "country": "SN",
  "operator": "wizall",
  "phone": "+221771234567"
}
```
*Note*: Première requête sans authorizationCode. Réponse contient wizallTransactionId. Deuxième requête avec authorizationCode + wizallTransactionId.

**Expresso (SN)**:
```json
{
  "country": "SN",
  "operator": "expresso",
  "phone": "+221701234567",
  "authorizationCode": "123456"
}
```

### T-Money (TG)

```json
{
  "country": "TG",
  "operator": "tmoney",
  "phone": "+22890123456",
  "authorizationCode": "123456"
}
```

### Paydunya Wallet (Global)

```json
{
  "country": "SN",
  "operator": "paydunya",
  "phone": "+221771234567",
  "authorizationCode": "123456"
}
```

## 4. Test Wizall Two-Step

### Step 1: Init + First Confirm
```
POST {{BASE_URL}}/api/softpay/init-payment
{
  "amount": 1000,
  "country": "SN",
  "operator": "wizall",
  "phone": "+221771234567"
}
```

Puis:
```
POST {{BASE_URL}}/api/softpay/confirm-payment
{
  "transactionId": "<uuid>",
  "token": "<token>",
  "authorizationCode": ""
}
```

**Réponse attendue**:
```json
{
  "success": true,
  "message": "Code OTP envoyé. Veuillez entrer le code reçu par SMS.",
  "transactionId": "uuid",
  "requiresOTP": true,
  "wizallTransactionId": "wizall-transaction-id"
}
```

### Step 2: Second Confirm avec OTP
```
POST {{BASE_URL}}/api/softpay/confirm-payment
{
  "transactionId": "<uuid>",
  "token": "<token>",
  "authorizationCode": "123456"
}
```

## 5. Test Payment Links

### 5.1 Créer Payment Link
```
POST {{BASE_URL}}/api/payments
Cookie: connect.sid=<session>
Content-Type: application/json

{
  "title": "Test Payment Link",
  "amount": 5000,
  "country": "SN",
  "operator": "orange"
}
```

### 5.2 INIT Payment Link SOFTPAY
```
POST {{BASE_URL}}/api/payments/softpay-init/<payment-link-token>
Content-Type: application/json

{
  "amount": 5000,
  "country": "SN",
  "operator": "orange",
  "phone": "+221771234567",
  "customerName": "Client Test",
  "customerEmail": "client@test.com"
}
```

### 5.3 CONFIRM Payment Link SOFTPAY
```
POST {{BASE_URL}}/api/payments/softpay-confirm
Content-Type: application/json

{
  "transactionId": "<uuid>",
  "token": "<paydunya-token>",
  "authorizationCode": "123456"
}
```

## 6. Test Merchant Links

### 6.1 Créer Merchant Link
```
POST {{BASE_URL}}/api/merchant-links
Cookie: connect.sid=<session>
Content-Type: application/json

{
  "merchantName": "Boutique Test",
  "merchantPhone": "+221771234567",
  "merchantEmail": "merchant@test.com",
  "country": "SN",
  "operator": "orange"
}
```

### 6.2 INIT Merchant Link SOFTPAY
```
POST {{BASE_URL}}/api/merchant-links/softpay-init/<merchant-link-token>
Content-Type: application/json

{
  "amount": 2500,
  "country": "SN",
  "operator": "orange",
  "customerName": "Client Final",
  "customerEmail": "client@final.com",
  "customerPhone": "+221771234567"
}
```

### 6.3 CONFIRM Merchant Link SOFTPAY
```
POST {{BASE_URL}}/api/merchant-links/softpay-confirm
Content-Type: application/json

{
  "transactionId": "<uuid>",
  "token": "<paydunya-token>",
  "authorizationCode": "123456"
}
```

## 7. Test API Gateway

### 7.1 Créer API Key
```
POST {{BASE_URL}}/api/keys
Cookie: connect.sid=<session>
Content-Type: application/json

{
  "name": "Test API Key"
}
```

### 7.2 CREATE Payment (INIT)
```
POST {{BASE_URL}}/api/payments/create
Authorization: Bearer <public-api-key>
Content-Type: application/json

{
  "amount": 3000,
  "description": "Test API Payment",
  "country": "SN",
  "operator": "orange",
  "customerName": "API Client",
  "customerEmail": "api@client.com",
  "customerPhone": "+221771234567"
}
```

### 7.3 CONFIRM Payment (SOFTPAY)
```
POST {{BASE_URL}}/api/payments/confirm-softpay
Authorization: Bearer <public-api-key>
Content-Type: application/json

{
  "transactionId": "<uuid>",
  "authorizationCode": "123456"
}
```

## 8. Vérifications Backend

### Hardening Non-JSON
Testez avec un token invalide pour vérifier que le backend retourne un message propre:
```json
{
  "success": false,
  "message": "Erreur lors du paiement"
}
```

Au lieu de crasher avec erreur 500.

### Extraction TransactionID
Pour Wizall, vérifiez que la réponse contient bien `wizallTransactionId` après le premier confirm.

## Notes Importantes

1. **Numéros de téléphone**: Pour un test RÉEL avec Paydunya, utilisez des numéros africains valides. Les SMS OTP ne seront envoyés que vers ces numéros.

2. **Environnement**: 
   - Development: Clés TEST Paydunya
   - Production: Clés LIVE Paydunya

3. **Webhooks**: Pour tester les webhooks Paydunya localement, utilisez ngrok:
   ```bash
   ngrok http 5000
   ```
   Puis configurez l'URL webhook dans votre compte Paydunya.

4. **Instructions USSD**: Les instructions retournées par `/init` sont à afficher à l'utilisateur pour qu'il compose le code USSD sur son téléphone.

5. **Wave Redirect**: Pour Wave, la réponse contient `redirectUrl` - le client doit rediriger vers cette URL.

## Codes de Réponse

| Code | Signification |
|------|--------------|
| 200  | Succès |
| 400  | Erreur client (mauvais paramètres) |
| 401  | Non authentifié |
| 403  | Compte suspendu / Action interdite |
| 500  | Erreur serveur (ne devrait jamais arriver avec le hardening) |

## Debugging

Pour voir les logs backend détaillés:
```bash
# Dans le terminal Replit
tail -f /tmp/logs/Start_application_*.log
```

Les logs montreront:
- `[SOFTPAY INIT]` - Création invoice
- `[SOFTPAY CONFIRM]` - Appel endpoint operator-specific
- `[WIZALL CONFIRM]` - Confirmation two-step Wizall
