import type { User } from "@shared/schema";
import type { IStorage } from "./storage";

// Limites mensuelles par défaut pour les comptes personnels (en unités de la devise)
export const DEFAULT_MONTHLY_LIMITS: Record<string, number> = {
  XOF: 1_000_000,
  XAF: 1_000_000,
  CDF: 5_000_000,
};

// Vérifie si le montant entrant est autorisé selon la limite mensuelle du compte personnel.
// Retourne { allowed: true } si autorisé, ou { allowed: false, message } si bloqué.
export async function checkPersonalMonthlyLimit(
  owner: User,
  incomingAmount: number,    // montant crédité sur le solde de l'owner, dans ownerCurrency
  ownerCurrency: string,
  storage: IStorage
): Promise<{ allowed: boolean; message?: string; used: number; limit: number }> {
  // Uniquement pour les comptes personnels
  if (owner.accountType !== "personal") {
    return { allowed: true, used: 0, limit: 0 };
  }

  const defaultLimit = DEFAULT_MONTHLY_LIMITS[ownerCurrency];
  if (!defaultLimit) {
    // Pas de limite définie pour cette devise → transaction autorisée
    return { allowed: true, used: 0, limit: 0 };
  }

  // La limite admin personnalisée est stockée dans la même devise que la devise par défaut
  const limit = owner.monthlyLimit ?? defaultLimit;

  const now = new Date();
  const used = await storage.getUserMonthlyIncomingByCurrency(
    owner.id,
    ownerCurrency,
    now.getFullYear(),
    now.getMonth() + 1
  );

  console.log(`[LimitemensuelleCheck] user=${owner.id} | limit=${limit} ${ownerCurrency} | used=${used} | incoming=${incomingAmount} | total=${used + incomingAmount} | allowed=${used + incomingAmount <= limit}`);

  if (used + incomingAmount > limit) {
    const remaining = Math.max(0, limit - used);
    return {
      allowed: false,
      message: `Limite mensuelle de ${limit.toLocaleString("fr-FR")} ${ownerCurrency} atteinte. Vous avez déjà reçu ${used.toLocaleString("fr-FR")} ${ownerCurrency} ce mois. Il vous reste ${remaining.toLocaleString("fr-FR")} ${ownerCurrency} disponibles.`,
      used,
      limit,
    };
  }

  return { allowed: true, used, limit };
}
