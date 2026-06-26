# ✅ Checklist de Déploiement Production - BKApay

## 🔐 Étape 1: Activer le Mode Production Paydunya

### A. Dans le Dashboard Paydunya
1. Connectez-vous sur https://app.paydunya.com
2. Menu de gauche → **"Intégrez notre API"**
3. Sélectionnez votre application → **"Détails"**
4. Cliquez **"Modifier la configuration"**
5. Pour **"Activer le mode production"**: sélectionnez **"Oui, l'application est prête"**
6. Sauvegardez

### B. Récupérer les Clés LIVE
1. Dans le dashboard, allez dans **"Clés API"**
2. Copiez les clés suivantes (commençant par `live_`):
   - `PAYDUNYA_MASTER_KEY` (Master Key)
   - `PAYDUNYA_PRIVATE_KEY` (commence par `live_private_...`)
   - `PAYDUNYA_PUBLIC_KEY` (commence par `live_public_...`)
   - `PAYDUNYA_TOKEN` (Token)

### C. Mettre à Jour les Secrets Vercel
1. Dans Vercel, onglet **"Secrets"** (🔒 dans le menu latéral)
2. Remplacez les valeurs actuelles par les clés LIVE:
   ```
   PAYDUNYA_MASTER_KEY=votre_master_key_live
   PAYDUNYA_PRIVATE_KEY=live_private_xxxxxxxxxxxxxxx
   PAYDUNYA_PUBLIC_KEY=live_public_xxxxxxxxxxxxxxx
   PAYDUNYA_TOKEN=votre_token_live
   ```
3. Redémarrez l'application

## 🌐 Étape 2: Configurer le Domaine de Production

### A. Mettre à Jour BASE_URL
Dans les variables d'environnement (onglet "Secrets"):
```
BASE_URL=https://bkapay.com
```

### B. Configurer le Webhook Paydunya
1. Dans le dashboard Paydunya → **Configuration**
2. Webhook URL de rappel: `https://bkapay.com/api/webhook/paydunya`
3. Sauvegardez

## 📱 Étape 3: Tests de Validation

### Tests Obligatoires AVANT Production
Utilisez des **VRAIS numéros africains** car Paydunya envoie uniquement des SMS vers l'Afrique:

#### A. Test Deposit Dashboard
1. Connectez-vous avec un compte test
2. Accédez à **Dépôt**
3. Testez avec:
   - **Orange SN**: Numéro réel sénégalais (ex: +221 77 123 45 67)
   - **MTN BJ**: Numéro réel béninois
   - **Wizall SN**: Pour tester flux OTP two-step

#### B. Test Payment Link Public
1. Créez un lien de paiement dans le dashboard
2. Partagez le lien `/pay/:token`
3. Testez avec numéro africain réel

#### C. Test Merchant Link Public
1. Créez un lien marchand
2. Partagez le lien `/merchant/:token`
3. Testez paiement complet

### Opérateurs à Tester en Priorité
- ✅ **Orange Money Sénégal** (USSD + OTP)
- ✅ **Wizall Sénégal** (Two-step OTP)
- ✅ **MTN Bénin** (Standard)
- ✅ **Wave Sénégal** (Redirect)
- ✅ **Free Money** (USSD validation)

## ⚠️ Comportement Attendu en LIVE

### SMS OTP
- **Orange SN**: Doit composer `#144#391*[PIN]#` pour générer OTP
- **Wizall SN**: Reçoit SMS avec code à 6 chiffres
- **Free SN**: Compose `#150#` pour valider
- **Expresso**: Reçoit SMS de validation

### Délais
- Init → USSD: Immédiat
- USSD/OTP → Confirmation: 10-30 secondes
- Webhook callback: 5-60 secondes

## 🔒 Sécurité Production

### Variables d'Environnement Requises
```bash
# Paydunya LIVE (remplacer par vos clés live_*)
PAYDUNYA_MASTER_KEY=xxxxx
PAYDUNYA_PRIVATE_KEY=live_private_xxxxx
PAYDUNYA_PUBLIC_KEY=live_public_xxxxx
PAYDUNYA_TOKEN=xxxxx

# Configuration
BASE_URL=https://bkapay.com

# Database (déjà configuré)
DATABASE_URL=postgresql://...
```

### Session & Cookies (déjà configuré)
- ✅ `trust proxy: 1` activé
- ✅ `sameSite: 'lax'` pour cookies
- ✅ Session PostgreSQL avec `connect-pg-simple`

## 📊 Monitoring Post-Déploiement

### A. Logs Backend
Surveillez dans les logs:
```bash
[Paydunya API] /softpay/... - Status: 200
[Webhook] Transaction completed: xxx
```

### B. Dashboard Admin
1. Vérifiez transactions en temps réel
2. Surveillez statuts: `pending` → `completed`
3. Vérifiez soldes utilisateurs

### C. Tests Continus
- Testez 1 transaction par opérateur
- Vérifiez webhooks reçus
- Validez crédits utilisateurs

## 🚨 Troubleshooting

### "OTP non reçu"
- ✅ Vérifiez que clés sont `live_*` et non `test_*`
- ✅ Vérifiez mode production activé dans dashboard Paydunya
- ✅ Utilisez numéro africain valide
- ✅ Opérateur doit avoir solde suffisant

### "Transaction timeout"
- Normal si client n'entre pas OTP à temps (2 min)
- Transaction reste `pending` → ne pas re-créer

### "Webhook non reçu"
- Vérifiez URL webhook: `https://bkapay.com/api/webhook/paydunya`
- Vérifiez logs backend pour erreurs 500

## ✅ Validation Finale

Avant de mettre en production:
- [ ] Clés LIVE configurées dans secrets
- [ ] Mode production activé sur Paydunya
- [ ] BASE_URL = https://bkapay.com
- [ ] Webhook configuré
- [ ] Tests réussis avec numéros africains
- [ ] Au moins 1 transaction complète par type (deposit, payment link, merchant link)
- [ ] Admin dashboard accessible
- [ ] Monitoring configuré

---

## 📞 Support Paydunya

En cas de problème:
- **Email**: [email protected]
- **WhatsApp**: +221 77 190 26 41
- **Docs**: https://developers.paydunya.com/
