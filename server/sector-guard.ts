import type { User } from "../shared/schema";

// Message affiche quand l'utilisateur n'a PAS encore configure son secteur d'activite.
export const SECTOR_NOT_CONFIGURED_MESSAGE =
  "Votre secteur d'activité n'est pas encore configuré. Rendez-vous dans votre Profil pour le renseigner, puis attendez sa validation par un administrateur avant de pouvoir effectuer un retrait.";

// Message affiche quand le secteur est configure mais en attente de validation par un admin.
export const SECTOR_PENDING_MESSAGE =
  "Votre secteur d'activité est en attente de validation par un administrateur. Les retraits et transferts seront de nouveau disponibles dès qu'il aura été validé.";

/**
 * Determine si les retraits/transferts/payouts doivent etre bloques a cause du secteur d'activite.
 *
 * Regle:
 * - Secteur absent (kycSector vide) -> bloque (anciens utilisateurs).
 * - Secteur present mais statut "pending" -> bloque (en attente de validation admin).
 * - Secteur present et statut "approved" -> autorise (nouveaux utilisateurs via KYC ou secteur valide).
 *
 * Retourne un message d'erreur en francais si bloque, sinon null.
 */
export function getSectorWithdrawalBlockMessage(
  user: Pick<User, "kycSector" | "sectorStatus">,
): string | null {
  if (!user.kycSector) return SECTOR_NOT_CONFIGURED_MESSAGE;
  if (user.sectorStatus === "pending") return SECTOR_PENDING_MESSAGE;
  return null;
}
