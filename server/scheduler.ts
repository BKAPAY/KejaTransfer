import { storage } from "./storage";
import { handleFedaPayWithdrawal, handleFedaPayTransfer } from "./fedapay-routes";
import { calculateOutgoingFee, getFeeFromDatabase } from "./utils/fees";
import bcrypt from "bcrypt";

const SCHEDULER_INTERVAL_MS = 30 * 1000; // Check every 30 seconds
let schedulerTimer: NodeJS.Timeout | null = null;

function getCurrencyForCountry(country: string): string {
  if (country === "CD") return "CDF";
  if (["CM", "TD", "CG", "CF", "GA"].includes(country)) return "XAF";
  return "XOF";
}

async function getActiveProviderForWithdrawal(country: string, operator: string): Promise<string | null> {
  const configs = await storage.getCountryOperatorConfigs();
  for (const config of configs) {
    if (
      config.country.toUpperCase() === country.toUpperCase() &&
      config.operator.toLowerCase() === operator.toLowerCase() &&
      config.outgoingEnabled
    ) {
      const countryStatuses = await storage.getCountryStatusesByProvider(config.provider);
      const countryStatus = countryStatuses.find(
        (cs) => cs.country.toUpperCase() === country.toUpperCase()
      );
      if (countryStatus && countryStatus.payoutEnabled) {
        return config.provider;
      }
    }
  }
  return null;
}

async function executeScheduledOperation(op: any): Promise<void> {
  console.log(`[Scheduler] Executing scheduled operation ${op.id} (${op.type}) for user ${op.userId}`);

  try {
    const user = await storage.getUser(op.userId);
    if (!user) {
      await storage.updateScheduledOperationStatus(op.id, "failed", "Utilisateur non trouvé");
      return;
    }

    if (user.suspended) {
      await storage.updateScheduledOperationStatus(op.id, "failed", "Compte suspendu");
      return;
    }

    if (user.kycStatus !== "verified") {
      await storage.updateScheduledOperationStatus(op.id, "failed", "KYC non vérifié");
      return;
    }

    if (op.type === "withdrawal") {
      if (!user.securityCode) {
        await storage.updateScheduledOperationStatus(op.id, "failed", "Code de sécurité non configuré");
        return;
      }

      if (!op.securityCodeHash || op.securityCodeHash !== "verified_at_creation") {
        await storage.updateScheduledOperationStatus(op.id, "failed", "Code de sécurité non vérifié lors de la programmation");
        return;
      }

      const sanitizedPhone = op.phone.replace(/\s+/g, "").replace(/^(\+|00)/, "");
      const allowedPhones = (user.withdrawalPhones || []).map((p: string) => p.replace(/\s+/g, "").replace(/^(\+|00)/, ""));
      if (allowedPhones.length === 0 || !allowedPhones.some((p: string) => sanitizedPhone.includes(p) || p.includes(sanitizedPhone))) {
        await storage.updateScheduledOperationStatus(op.id, "failed", "Numéro de retrait non autorisé");
        return;
      }
    }

    const activeProvider = await getActiveProviderForWithdrawal(op.country, op.operator);
    if (!activeProvider) {
      await storage.updateScheduledOperationStatus(op.id, "failed", "Aucun fournisseur actif pour ce pays/opérateur");
      return;
    }

    const userCurrency = getCurrencyForCountry(user.country || "BJ");
    const feeConfig = await getFeeFromDatabase(storage, activeProvider, op.country, op.operator);
    const feeInfo = calculateOutgoingFee(op.amount, feeConfig.outgoing);

    if (op.type === "withdrawal") {
      if (user.balance < feeInfo.totalDeductedFromBalance) {
        await storage.updateScheduledOperationStatus(op.id, "failed",
          `Solde insuffisant. Solde: ${user.balance.toLocaleString("fr-FR")} ${userCurrency}, Requis: ${feeInfo.totalDeductedFromBalance.toLocaleString("fr-FR")} ${userCurrency}`);
        return;
      }

      const sanitizedPhone = op.phone.replace(/\s+/g, "").replace(/^(\+|00)/, "");

      if (activeProvider === "fedapay") {
        const result = await handleFedaPayWithdrawal(op.userId, user, op.amount, op.country, op.operator, sanitizedPhone, userCurrency);
        if (result.success) {
          await storage.updateScheduledOperationStatus(op.id, "executed",
            `Retrait de ${feeInfo.amountReceived.toLocaleString("fr-FR")} ${userCurrency} envoyé vers ${op.phone}`, result.transactionId);
        } else {
          await storage.updateScheduledOperationStatus(op.id, "failed", result.error || "Erreur lors du retrait");
        }
      } else {
        await storage.updateScheduledOperationStatus(op.id, "failed", "Fournisseur non supporté");
      }
    } else if (op.type === "transfer") {
      const requiredBalance = op.amount + feeInfo.feeAmount;
      if (user.balance < requiredBalance) {
        await storage.updateScheduledOperationStatus(op.id, "failed",
          `Solde insuffisant. Solde: ${user.balance.toLocaleString("fr-FR")} ${userCurrency}, Requis: ${requiredBalance.toLocaleString("fr-FR")} ${userCurrency}`);
        return;
      }

      const sanitizedPhone = op.phone.replace(/\s+/g, "").replace(/^(\+|00)/, "");

      if (activeProvider === "fedapay") {
        const result = await handleFedaPayTransfer(op.userId, user, op.amount, op.country, op.operator, sanitizedPhone, userCurrency);
        if (result.success) {
          await storage.updateScheduledOperationStatus(op.id, "executed",
            `Transfert de ${op.amount.toLocaleString("fr-FR")} ${userCurrency} envoyé vers ${op.phone}`, result.transactionId);
        } else {
          await storage.updateScheduledOperationStatus(op.id, "failed", result.error || "Erreur lors du transfert");
        }
      } else {
        await storage.updateScheduledOperationStatus(op.id, "failed", "Fournisseur non supporté");
      }
    }
  } catch (error: any) {
    console.error(`[Scheduler] Error executing operation ${op.id}:`, error);
    await storage.updateScheduledOperationStatus(op.id, "failed", `Erreur interne: ${error.message || "Erreur inconnue"}`);
  }
}

async function processScheduledOperations(): Promise<void> {
  try {
    const pendingOps = await storage.getPendingScheduledOperations();
    if (pendingOps.length > 0) {
      console.log(`[Scheduler] Found ${pendingOps.length} pending operation(s) to execute`);
    }

    for (const op of pendingOps) {
      await executeScheduledOperation(op);
    }
  } catch (error: any) {
    console.error("[Scheduler] Error processing scheduled operations:", error);
  }
}

export function startScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
  }
  console.log("[Scheduler] Started - checking every 30 seconds for scheduled operations");
  schedulerTimer = setInterval(processScheduledOperations, SCHEDULER_INTERVAL_MS);
  setTimeout(processScheduledOperations, 5000);
}

export function stopScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    console.log("[Scheduler] Stopped");
  }
}
