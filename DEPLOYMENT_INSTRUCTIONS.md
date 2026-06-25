# 🚀 GUIDE DE DÉPLOIEMENT COMPLET - VERCEL + NEON

Guide complet pour déployer KejaTransfer sur Vercel avec Neon Database. Les anciens utilisateurs pourront se connecter sans problème!

---

## 📋 TABLE DES MATIÈRES

1. [Étape 1: Préparer GitHub](#étape-1-préparer-github)
2. [Étape 2: Créer un Projet Vercel](#étape-2-créer-un-projet-vercel)
3. [Étape 3: Ajouter les Variables d'Environnement](#étape-3-ajouter-les-variables-denvironnement)
4. [Étape 4: Configurer le Déploiement](#étape-4-configurer-le-déploiement)
5. [Étape 5: Tester le Déploiement](#étape-5-tester-le-déploiement)
6. [Étape 6: Les Anciens Utilisateurs](#étape-6-les-anciens-utilisateurs)

---

## ✅ ÉTAPE 1: PRÉPARER GITHUB

### 1.1 - Vérifier que le projet est sur GitHub

Si ton projet n'est pas encore sur GitHub, crée le repository:

**Via GitHub Web:**
1. Va sur https://github.com/new
2. **Repository name:** `KejaTransfer`
3. **Description:** `Mobile Money Payment Platform for Africa`
4. **Visibility:** Public (ou Private selon tes préférences)
5. Clique **"Create repository"**

**Via Terminal (si tu dois pousser depuis Replit):**

```bash
# Clone le projet depuis Replit en local (ou utilise Git depuis Replit)
git remote add origin https://github.com/BKAPAY/KejaTransfer.git
git branch -M main
git push -u origin main
```

### 1.2 - Vérifier les fichiers importants

Assure-toi que tu as ces fichiers à la racine de ton repository:

```
✅ vercel.json           (CRÉÉ - Configuration Vercel)
✅ .env.example          (CRÉÉ - Exemple de variables)
✅ .env.production       (CRÉÉ - Variables de production)
✅ package.json          (Déjà présent)
✅ tsconfig.json         (Déjà présent)
✅ drizzle.config.ts     (Déjà présent)
✅ server/index.ts       (Point d'entrée)
✅ migrations/           (Dossier avec migrations)
```

### 1.3 - Vérifier le .gitignore

Assure-toi que le `.gitignore` **EXCLUT** ces dossiers:

```bash
cat .gitignore
```

Tu devrais voir:
```
node_modules/
dist/
.env
.env.local
uploads/
.replit
```

Si le `.gitignore` n'existe pas ou est incomplet, crée-le:

```bash
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*

# Environment variables
.env
.env.local
.env.production.local
.env.*.local

# Build outputs
dist/
build/
.next/

# Vercel
.vercel

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
.DS_Store?
._*

# Uploads
uploads/
uploads/*

# Replit
.replit
.upm/

# Python
__pycache__/
*.py[cod]
*.egg-info/
EOF
```

Puis ajoute et pousse:

```bash
git add .gitignore
git commit -m "Add proper gitignore"
git push origin main
```

### 1.4 - Vérifier que le package.json a les bons scripts

```bash
grep -A 10 '"scripts"' package.json
```

Tu devrais voir:
```json
"scripts": {
  "dev": "NODE_ENV=development tsx server/index.ts",
  "build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
  "start": "NODE_ENV=production node dist/index.js",
  "check": "tsc",
  "db:push": "drizzle-kit push"
}
```

✅ **Si tout est bon, continue à l'Étape 2!**

---

## 📦 ÉTAPE 2: CRÉER UN PROJET VERCEL

### 2.1 - Créer un compte Vercel (si tu n'en as pas)

1. Va sur https://vercel.com/signup
2. Clique **"Continue with GitHub"**
3. Autorise Vercel à accéder à ton GitHub
4. Vérifie ton email

### 2.2 - Créer un nouveau projet Vercel

**Méthode 1 - Via Interface Web (Recommandée pour la première fois):**

1. Va sur https://vercel.com/dashboard
2. Clique **"New Project"** (ou "Add New" → "Project")
3. **Importer un repository Git:**
   - Clique **"Import Git Repository"**
   - Cherche `BKAPAY/KejaTransfer`
   - Clique **"Import"**

**Méthode 2 - Via Vercel CLI:**

```bash
# Installe Vercel CLI
npm install -g vercel

# Depuis le répertoire du projet
cd /chemin/vers/KejaTransfer

# Déploie
vercel --prod
```

### 2.3 - Configurer le nom du projet

Quand Vercel te demande:

```
? Set up and deploy "KejaTransfer"? [Y/n]
> Y

? Which scope do you want to deploy to? 
> BKAPAY (ton username GitHub)

? Link to existing project? [y/N]
> N (nouvelle création)

? What's your project's name?
> KejaTransfer

? In which directory is your code located?
> .

? Want to modify vercel.json?
> N (tu l'as déjà)
```

**ATTENDS L'ERREUR DE BUILD** - c'est normal, on va ajouter les variables d'env après!

---

## 🔐 ÉTAPE 3: AJOUTER LES VARIABLES D'ENVIRONNEMENT

### 3.1 - Aller aux Settings Vercel

1. Va sur https://vercel.com/dashboard
2. Clique sur ton projet **"KejaTransfer"**
3. Clique sur l'onglet **"Settings"** (Paramètres)
4. Dans le menu de gauche, cherche **"Environment Variables"**

### 3.2 - Ajouter la DATABASE_URL

**Première variable:**

| Champ | Valeur |
|-------|--------|
| **Name** | `DATABASE_URL` |
| **Value** | `postgresql://neondb_owner:npg_bISNisU5E9eC@ep-cold-art-ata9blqg-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require` |
| **Environment** | ✅ Production ✅ Preview ✅ Development |

**Copie exactement la valeur** (c'est ta chaîne de connexion Neon)

Puis clique **"Save"**

### 3.3 - Ajouter NODE_ENV

**Deuxième variable:**

| Champ | Valeur |
|-------|--------|
| **Name** | `NODE_ENV` |
| **Value** | `production` |
| **Environment** | ✅ Production ✅ Preview ✅ Development |

Clique **"Save"**

### 3.4 - Ajouter PORT

**Troisième variable:**

| Champ | Valeur |
|-------|--------|
| **Name** | `PORT` |
| **Value** | `3000` |
| **Environment** | ✅ Production ✅ Preview ✅ Development |

Clique **"Save"**

### 3.5 - Ajouter BASE_URL (Optionnel mais recommandé)

Si tu connais déjà ton domaine Vercel:

| Champ | Valeur |
|-------|--------|
| **Name** | `BASE_URL` |
| **Value** | `https://keja-transfer.vercel.app` (remplace par ton domaine) |
| **Environment** | ✅ Production |

Clique **"Save"**

### 3.6 - Variables optionnelles pour Paydunya

Si tu utilises Paydunya, ajoute aussi:

```
PAYDUNYA_MASTER_KEY = [ta clé master live]
PAYDUNYA_PRIVATE_KEY = live_private_xxxxx
PAYDUNYA_PUBLIC_KEY = live_public_xxxxx
PAYDUNYA_TOKEN = [ton token live]
```

---

## ⚙️ ÉTAPE 4: CONFIGURER LE DÉPLOIEMENT

### 4.1 - Aller aux Build Settings

Depuis le project Vercel:

1. **Settings** → **Build & Development Settings**

Vérifie que c'est comme ça:

| Setting | Valeur |
|---------|--------|
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |
| **Development Command** | `npm run dev` |

### 4.2 - Framework Preset

Vercel devrait auto-détecter **"Other"** - c'est correct!

### 4.3 - Sauvegarder

Clique en bas: **"Save"**

---

## 🔄 ÉTAPE 5: DÉCLENCHER LE DÉPLOIEMENT

### 5.1 - Méthode 1: Via Git (RECOMMANDÉ)

Fais un simple push, Vercel redéploiera automatiquement:

```bash
# Depuis ton répertoire local
git add .
git commit -m "Add Vercel deployment configuration"
git push origin main
```

**Vercel verra le push et redéploiera automatiquement!**

### 5.2 - Méthode 2: Forcer un redéploiement

Depuis le dashboard Vercel:

1. Projet **"KejaTransfer"**
2. Onglet **"Deployments"**
3. Clique sur les trois points (⋮) du dernier déploiement
4. Clique **"Redeploy"**

### 5.3 - Regarder le déploiement en direct

Dans l'onglet **"Deployments"**, tu verras:

```
⏳ Building...
✅ Built successfully
🚀 Deploying...
✅ Live!
```

---

## ✅ ÉTAPE 6: TESTER LE DÉPLOIEMENT

### 6.1 - Trouver ton URL

Dans le dashboard Vercel:

1. Projet → **"Deployments"**
2. Le premier déploiement sera **"LIVE"** ✅
3. Clique dessus, tu verras:
   - **Production URL:** `https://KejaTransfer-xxxxx.vercel.app`

### 6.2 - Test #1: Vérifier la santé de l'app

```bash
curl https://KejaTransfer-xxxxx.vercel.app/healthz
```

Tu devrais voir:
```json
{
  "status": "healthy"
}
```

Si tu vois ça ✅ **Le déploiement fonctionne!**

### 6.3 - Test #2: Aller à l'accueil

Ouvre dans le navigateur:
```
https://KejaTransfer-xxxxx.vercel.app
```

Tu devrais voir la page d'accueil KejaTransfer

### 6.4 - Test #3: Les Anciens Utilisateurs Peuvent Se Connecter

1. Va à l'URL du déploiement
2. Essaie de te connecter avec un **compte ancien** (celui de Replit)
3. Tu devrais voir ton dashboard

✅ **Si c'est bon, tu es prêt pour la production!**

---

## 👥 ÉTAPE 7: LES ANCIENS UTILISATEURS

### ✅ Pourquoi les anciennes données fonctionnent

1. **Les tables existent sur Neon** - aucune ne sera supprimée
2. **Les migrations sont sûres** - elles s'exécutent idempotent (peuvent se rejouer)
3. **Les mots de passe bcrypt sont intacts** - tous les utilisateurs peuvent se reconnecter
4. **Les API keys existent** - tous les marchands peuvent continuer à utiliser l'API

### ⚠️ Comportement attendu

- ✅ Les anciens utilisateurs **voient tous leurs comptes/transactions**
- ✅ Les anciennes API keys **fonctionnent toujours**
- ⚠️ Les sessions anciennes ne transfert PAS (normal - les users doivent se reconnecter une fois)
- ✅ Leurs mots de passe fonctionnent toujours

### 📱 Communication aux utilisateurs

Envoie ce message:

```
🎉 KejaTransfer a une nouvelle infrastructure!

Nous avons migré vers une meilleure plateforme.

❓ Que se passe-t-il?
✅ Vos comptes existent toujours
✅ Tous vos paiements sont préservés
✅ Vos API keys fonctionnent toujours

📝 Action requise:
Il faut vous reconnecter UNE FOIS avec vos identifiants.

🔐 Vos données:
- Solde: Intact ✅
- Transactions: Intactes ✅
- Paramètres: Intacts ✅

Merci! 🙏
```

---

## 🌐 ÉTAPE 8: CONFIGURER UN DOMAINE PERSONNALISÉ (OPTIONNEL)

Si tu veux `bkapay.app` au lieu de `vercel.app`:

### 8.1 - Ajouter le domaine

1. **Settings** → **Domains** (Domaines)
2. Clique **"Add"** (Ajouter)
3. Entre: `bkapay.app`

### 8.2 - Configuration DNS

Deux options:

**Option A: Nameservers Vercel (Plus simple)**
- Vercel te donne des nameservers
- Mets à jour ton registrar (GoDaddy, Namecheap, etc.)
- Attends 24-48h

**Option B: CNAME (Si tu gardes ton registrar)**
- Vercel te donne un CNAME: `cname.vercel-dns.com`
- Crée un record CNAME: `bkapay.app CNAME cname.vercel-dns.com`

### 8.3 - Mettre à jour BASE_URL

**Settings** → **Environment Variables**

Modifie ou crée:

```
BASE_URL = https://bkapay.app
```

Applique à: ✅ Production

---

## 🔧 ÉTAPE 9: CONFIGURER LES WEBHOOKS PAYDUNYA

Si tu utilises Paydunya:

### 9.1 - URL du Webhook

Va sur https://app.paydunya.com (mode LIVE)

1. **Configuration** → **Webhooks**
2. **URL de rappel:** `https://KejaTransfer-xxxxx.vercel.app/api/webhook/paydunya`
3. Clique **"Save"**

### 9.2 - Test du Webhook

Depuis Vercel:

```bash
# Voir les logs en direct
vercel logs --follow
```

Tu devrais voir les webhooks arriver!

---

## 📊 ÉTAPE 10: MONITORING & LOGS

### 10.1 - Voir les Logs en Direct

Via Vercel CLI:

```bash
vercel logs --follow
```

Via Dashboard:
1. **Deployments** → Clique un déploiement
2. Onglet **"Logs"**

### 10.2 - Ajouter du Monitoring (Optionnel)

Pour un meilleur suivi des erreurs:

```bash
npm install @sentry/node
```

Puis crée un compte sur https://sentry.io

---

## ✅ VALIDATION FINALE

Avant de considérer que c'est LIVE:

- [ ] DATABASE_URL ajoutée à Vercel
- [ ] `/healthz` retourne `{"status": "healthy"}`
- [ ] Page d'accueil s'ouvre
- [ ] Au moins 1 ancien user se connecte avec succès
- [ ] Webhooks Paydunya configurés (si applicable)
- [ ] Les logs Vercel ne montrent pas d'erreurs 500
- [ ] Domaine personnalisé configuré (optionnel)

---

## 🚀 RÉSUMÉ DES COMMANDES

```bash
# 1. Préparer le projet
git add .
git commit -m "Add Vercel deployment config"
git push origin main

# 2. Vercel redéploie automatiquement

# 3. Vérifier le déploiement
curl https://KejaTransfer-xxxxx.vercel.app/healthz

# 4. Voir les logs
vercel logs --follow
```

---

## 📞 SUPPORT

- **Vercel**: https://vercel.com/docs
- **Neon**: https://neon.tech/docs
- **Drizzle ORM**: https://orm.drizzle.team

---

## 🎉 C'EST FAIT!

Ton application est maintenant sur **Vercel** avec **Neon Database**, et tes anciens utilisateurs peuvent se connecter! 🎉

**Prochaines étapes:**
- Monitore les logs en direct
- Teste un paiement complet
- Fais connaître la nouvelle URL à tes utilisateurs
