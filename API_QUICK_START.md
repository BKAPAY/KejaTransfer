# BKApay - Démarrage Rapide (Quick Start)

Intégrez les paiements mobile money en moins de 5 minutes!

## 1. Créer une clé API

1. Connectez-vous à [bkapay.app](https://bkapay.app)
2. Allez à **Paramètres** > **Clés API**
3. Cliquez **Générer une nouvelle clé**
4. Donnez-lui un nom (ex: "Mon Site Web")
5. Copiez votre clé **publique** (pk_live_xxxxx)

⚠️ **Important:** Gardez votre clé **privée** sécurisée!

---

## 2. Intégration minimale (1 minute)

### HTML + JavaScript
```html
<button id="payButton">Payer 50 000 XOF</button>

<script>
  const publicKey = 'pk_live_xxxxx'; // Votre clé publique

  document.getElementById('payButton').addEventListener('click', async () => {
    const response = await fetch('https://bkapay.app/api/payments/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicKey,
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
    window.location.href = data.redirectUrl;
  });
</script>
```

---

## 3. Traiter un paiement (Backend)

### Node.js + Express
```javascript
app.post('/api/webhook', (req, res) => {
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
