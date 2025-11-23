# BKApay - Démarrage Rapide (Quick Start)

Intégrez les paiements mobile money en moins de 5 minutes!

## 1. Créer une clé API

1. Connectez-vous à [bkapay.app](https://bkapay.app)
2. Allez à **Tableau de Bord** > **Clés API**
3. Cliquez **Nouvelle clé API**
4. Donnez-lui un nom (ex: "Mon Site Web", "Application Mobile", etc.)
5. Vous recevrez deux clés:
   - **Clé Publique (pk_live_xxxxx):** Pour votre frontend ✅
   - **Clé Privée (sk_live_xxxxx):** Pour votre backend 🔒

⚠️ **ATTENTION:**
- La clé privée n'apparaît qu'une SEULE fois. Copiez-la immédiatement!
- Gardez votre clé privée sécurisée (ne l'exposez JAMAIS au frontend)
- Stockez-la en variable d'environnement: `BKAPAY_SECRET_KEY=sk_live_xxxxx`

---

## 2. Intégration minimale (1 minute)

### HTML + JavaScript (Utiliser la clé PUBLIQUE)
```html
<button id="payButton">Payer 50 000 XOF</button>

<script>
  // 🔑 Utilisez la clé PUBLIQUE au frontend
  const publicKey = 'pk_live_xxxxx'; // EXPOSÉE au frontend - c'est normal!

  document.getElementById('payButton').addEventListener('click', async () => {
    const response = await fetch('https://bkapay.app/api/payments/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicKey,  // ✅ Clé publique
        amount: 50000,
        description: 'Mon premier paiement',
        customerName: 'Jean Dupont',
        customerEmail: 'jean@example.com',
        customerPhone: '+221781234567',
        country: 'SN',
        operator: 'orange'
      })
    });

    const { data } = await response.json();
    if (data.redirectUrl) {
      window.location.href = data.redirectUrl;
    }
  });
</script>
```

### Alternative: Utiliser le header Authorization
```javascript
// Même résultat avec Authorization header
const response = await fetch('https://bkapay.app/api/payments/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer pk_live_xxxxx'  // ✅ Header Bearer
  },
  body: JSON.stringify({
    amount: 50000,
    description: 'Mon premier paiement',
    customerName: 'Jean Dupont',
    customerEmail: 'jean@example.com',
    customerPhone: '+221781234567',
    country: 'SN',
    operator: 'orange'
  })
});
```

---

## 3. Traiter un paiement (Backend avec clé PRIVÉE)

### Node.js + Express
```javascript
// ✅ Utilisez la clé PRIVÉE au backend UNIQUEMENT
const BKAPAY_SECRET_KEY = process.env.BKAPAY_SECRET_KEY; // sk_live_xxxxx

// Récupérer le statut d'un paiement
app.get('/api/check-payment/:transactionId', (req, res) => {
  fetch('https://bkapay.app/api/transactions', {
    headers: {
      'Authorization': `Bearer ${BKAPAY_SECRET_KEY}` // 🔒 Header avec clé secrète
    }
  })
  .then(r => r.json())
  .then(data => {
    const transaction = data.data.find(t => t.id === req.params.transactionId);
    res.json(transaction);
  });
});

// Webhook pour les notifications BKApay
app.post('/webhook/bkapay', (req, res) => {
  const { event, data } = req.body;

  if (event === 'payment.completed') {
    const { transactionId, amount, customerEmail } = data;
    
    // ✅ Paiement réussi!
    // Mettre à jour votre base de données
    // Envoyer une confirmation au client
    console.log(`${amount} XOF reçu de ${customerEmail}`);
  }

  res.json({ success: true });
});
```

### Vérifier la signature du webhook
```javascript
import crypto from 'crypto';

function verifyWebhookSignature(payload, signature, secret) {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return hash === signature;
}

app.post('/webhook/bkapay', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  
  if (!verifyWebhookSignature(req.body, signature, BKAPAY_SECRET_KEY)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Traiter le webhook en confiance
  console.log('Webhook sécurisé reçu:', req.body);
  res.json({ success: true });
});
```

---

## 4. Vérifier le statut d'un paiement

```javascript
// Récupérer l'historique des transactions
const response = await fetch(
  'https://bkapay.app/api/transactions?status=completed',
  {
    headers: {
      'Authorization': 'Bearer pk_live_xxxxx'
    }
  }
);

const { data } = await response.json();
console.log(data); // Tous vos paiements complétés
```

---

## 5. Codes pays et opérateurs supportés

### Sénégal (SN)
- Orange Money ✅
- Free Money ✅
- Expresso ✅
- Wave ✅
- Wizall ✅

### Côte d'Ivoire (CI)
- Orange Money ✅
- MTN Mobile Money ✅
- Moov Money ✅
- Wave ✅

### Autres pays
- Burkina Faso (BF): Orange, Moov
- Bénin (BJ): Moov, MTN
- Togo (TG): T-Money, Moov
- Mali (ML): Orange, Moov

---

## 6. Gestion d'erreurs

```javascript
try {
  const response = await fetch('https://bkapay.app/api/payments/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({...})
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Erreur:', error.error);
    // Afficher l'erreur à l'utilisateur
  }

  const { data } = await response.json();
  // Rediriger vers le paiement
} catch (error) {
  console.error('Erreur réseau:', error);
}
```

---

## 7. Exemples de montants

| Description | Montant (XOF) |
|------------|--------------|
| Café ☕ | 1,000 |
| Repas 🍽️ | 5,000 |
| Abonnement mensuel 📱 | 25,000 |
| Formation 📚 | 50,000 |
| Service professionnel 👨‍💼 | 100,000 |

---

## 8. Tests

### Environnement de test
```javascript
const testKey = 'pk_test_xxxxx'; // Votre clé de test

const response = await fetch(
  'https://test.bkapay.app/api/payments/create',
  {
    method: 'POST',
    body: JSON.stringify({
      publicKey: testKey,
      amount: 1000, // Montant de test
      ...
    })
  }
);
```

### Numéros de test
- Sénégal: `+221781234567`
- Montant automatiquement accepté: `1000`

---

## 9. Dashboard

Une fois connecté, vous pouvez:
- 📊 Voir vos statistiques en temps réel
- 💳 Gérer vos liens de paiement
- 🔑 Créer de nouvelles clés API
- 📱 Gérer vos liens marchands
- 📈 Analyser vos revenus par pays/opérateur

---

## 10. Support

Besoin d'aide?

- 📖 **Docs complètes:** https://docs.bkapay.app
- 💬 **Chat:** support.bkapay.app
- 📧 **Email:** support@bkapay.app
- 🐛 **Issues:** github.com/bkapay/sdk

---

## Prochaines étapes

- ✅ Créer une clé API
- ✅ Ajouter le code de paiement à votre site
- ✅ Tester un paiement
- ✅ Mettre en production

**Bienvenue dans l'écosystème BKApay!** 🚀
