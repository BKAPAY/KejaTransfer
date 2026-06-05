import type { User } from "../shared/schema";

// Message affiche quand l'utilisateur n'a PAS encore configure son secteur d'activite.
export const SECTOR_NOT_CONFIGURED_MESSAGE =
  "Votre secteur d'activité n'est pas encore configuré. Rendez-vous dans votre Profil pour le renseigner, puis attendez sa validation par un administrateur avant de pouvoir effectuer un retrait.";

// Message affiche quand le secteur est configure mais en attente de validation par un admin.
export const SECTOR_PENDING_MESSAGE =
  "Votre secteur d'activité est en attente de validation par un administrateur. Les retraits et transferts seront de nouveau disponibles dès qu'il aura été validé.";

/**
 * Restriction par secteur désactivée — retourne toujours null (aucun blocage).
 * Tous les utilisateurs peuvent effectuer des retraits/transferts quel que soit leur secteur.
 */
export function getSectorWithdrawalBlockMessage(
  user: Pick<User, "kycSector" | "sectorStatus">,
): string | null {
  return null;
}
