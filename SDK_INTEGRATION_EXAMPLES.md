# BKApay SDK - Guide d'Intégration

## JavaScript/Node.js

### Installation
```bash
npm install bkapay
```

### Utilisation basique
```javascript
import { BKApayClient } from 'bkapay';

const client = new BKApayClient({
  publicKey: 'pk_live_xxxxx',
  apiUrl: 'https://bkapay.app/api'
});

// Créer un paiement
const payment = await client.createPayment({
  amount: 50000,
  description: 'Achat de produit',
  customerName: 'Jean Dupont',
  customerEmail: 'jean@example.com',
  customerPhone: '+221781234567',
  country: 'SN',
  operator: 'orange'
});

// Rediriger vers le paiement
window.location.href = payment.redirectUrl;
```

### Écouter les webhooks
```javascript
import { BKApayWebhook } from 'bkapay';

const webhook = new BKApayWebhook({
  secret: 'sk_live_xxxxx'
});

app.post('/webhooks/bkapay', (req, res) => {
  const event = webhook.verify(req.body, req.headers['x-webhook-signature']);
  
  if (event.type === 'payment.completed') {
    // Mettre à jour votre base de données
    updateUserSubscription(event.data.transactionId);
  }
  
  res.json({ success: true });
});
```

---

## Python

### Installation
```bash
pip install bkapay
```

### Utilisation
```python
from bkapay import BKApayClient

client = BKApayClient(
    public_key='pk_live_xxxxx',
    api_url='https://bkapay.app/api'
)

# Créer un paiement
payment = client.create_payment(
    amount=50000,
    description='Achat de produit',
    customer_name='Jean Dupont',
    customer_email='jean@example.com',
    customer_phone='+221781234567',
    country='SN',
    operator='orange'
)

# Rediriger le client
redirect(payment['redirectUrl'])
```

---

## PHP

### Installation
```bash
composer require bkapay/sdk
```

### Utilisation
```php
<?php
require_once 'vendor/autoload.php';

use BKApay\Client;

$client = new Client([
    'publicKey' => 'pk_live_xxxxx',
    'apiUrl' => 'https://bkapay.app/api'
]);

// Créer un paiement
$payment = $client->createPayment([
    'amount' => 50000,
    'description' => 'Achat de produit',
    'customerName' => 'Jean Dupont',
    'customerEmail' => 'jean@example.com',
    'customerPhone' => '+221781234567',
    'country' => 'SN',
    'operator' => 'orange'
]);

// Rediriger
header('Location: ' . $payment['redirectUrl']);
exit;
```

---

## React Example

```jsx
import React, { useState } from 'react';
import { useCallback } from 'react';

export function PaymentForm() {
  const [loading, setLoading] = useState(false);

  const handlePayment = useCallback(async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('https://bkapay.app/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicKey: 'pk_live_xxxxx',
          amount: 50000,
          description: 'Achat',
          customerName: 'Jean',
          customerEmail: 'jean@example.com',
          customerPhone: '+221781234567',
          country: 'SN',
          operator: 'orange'
        })
      });

      const data = await response.json();
      if (data.success) {
        window.location.href = data.data.redirectUrl;
      }
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <form onSubmit={handlePayment}>
      <button type="submit" disabled={loading}>
        {loading ? 'En cours...' : 'Payer maintenant'}
      </button>
    </form>
  );
}
```

---

## Vue.js Example

```vue
<template>
  <div>
    <button 
      @click="handlePayment" 
      :disabled="loading"
    >
      {{ loading ? 'En cours...' : 'Payer' }}
    </button>
  </div>
</template>

<script>
export default {
  data() {
    return {
      loading: false
    }
  },
  methods: {
    async handlePayment() {
      this.loading = true;
      try {
        const response = await fetch('https://bkapay.app/api/payments/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publicKey: 'pk_live_xxxxx',
            amount: 50000,
            description: 'Achat',
            customerName: 'Jean',
            customerEmail: 'jean@example.com',
            customerPhone: '+221781234567',
            country: 'SN',
            operator: 'orange'
          })
        });

        const data = await response.json();
        if (data.success) {
          window.location.href = data.data.redirectUrl;
        }
      } finally {
        this.loading = false;
      }
    }
  }
}
</script>
```

---

## Gestion d'erreurs

```javascript
try {
  const payment = await client.createPayment({...});
} catch (error) {
  if (error.code === 'INVALID_API_KEY') {
    console.error('Clé API invalide');
  } else if (error.code === 'INVALID_COUNTRY') {
    console.error('Pays non supporté');
  } else if (error.code === 'INVALID_OPERATOR') {
    console.error('Opérateur non supporté dans ce pays');
  } else if (error.code === 'INSUFFICIENT_BALANCE') {
    console.error('Solde insuffisant');
  } else {
    console.error('Erreur:', error.message);
  }
}
```

---

## Environnements

### Développement
```javascript
const client = new BKApayClient({
  publicKey: 'pk_test_xxxxx',
  apiUrl: 'https://test.bkapay.app/api'
});
```

### Production
```javascript
const client = new BKApayClient({
  publicKey: 'pk_live_xxxxx',
  apiUrl: 'https://bkapay.app/api'
});
```

---

## Sécurité

### Ne jamais exposer votre clé privée
```javascript
// ❌ MAUVAIS - Clé privée exposée au frontend
const client = new BKApayClient({
  privateKey: 'sk_live_xxxxx'  // Ne jamais faire ça!
});

// ✅ BON - Utiliser la clé publique au frontend
const client = new BKApayClient({
  publicKey: 'pk_live_xxxxx'
});

// Utiliser la clé privée uniquement au backend
app.post('/api/verify-payment', (req, res) => {
  const verified = verifyPaymentWithPrivateKey(
    req.body,
    'sk_live_xxxxx'
  );
  // ...
});
```

### Valider les webhooks
```javascript
import crypto from 'crypto';

function verifyWebhook(payload, signature, secret) {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return hash === signature;
}
```

---

## Tests

### Numéros de test
- **Sénégal (Orange):** +221781234567
- **Côte d'Ivoire (Orange):** +22501234567
- **Montant test:** 1000 XOF (accepté automatiquement)

### Environnement de test
```javascript
const testClient = new BKApayClient({
  publicKey: 'pk_test_xxxxx',
  isTest: true
});
```
