---
name: Double countdown pattern
description: Le countdown de paiement doit être démarré exactement une fois — règle stricte onSubmit vs onSuccess.
---

**Règle :** `countdown.startCountdown()` ne doit être appelé qu'à UN seul endroit pour chaque chemin de paiement :
- Dans `onSubmit`/`handleSubmit` : seulement si `!showOtpOnForm` (paiement direct sans OTP à saisir sur le form)
- Dans `initMutation.onSuccess` : seulement si `showOtpOnForm` (l'OTP est affiché → le countdown démarre après confirmation serveur)

**Why :** Appeler `startCountdown()` deux fois remet le timer à zéro, ce qui coupe visuellement le décompte en cours et perturbe l'UX (l'utilisateur voit le timer repartir de zéro quelques ms après avoir commencé).

**How to apply :**
- `deposit.tsx` onSuccess redirect → pas de startCountdown (déjà démarré dans onSubmit)
- `deposit.tsx` onSuccess normal → `if (currentOperatorNeedsOtp) countdown.startCountdown()`
- `api-pay.tsx` onSuccess polling → `if (newStage === "polling" && showOtpOnForm)`
- `merchant.tsx` onSuccess else → `if (showOtpOnForm) countdown.startCountdown()`
- `pay.tsx` et `checkout.tsx` : déjà corrects, ne pas modifier
