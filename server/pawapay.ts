import { storage } from "./storage";
import { PAWAPAY_COUNTRIES, getCorrespondent } from "@shared/pawapay-countries";
import { randomUUID } from "crypto";

const PAWAPAY_SANDBOX_URL = "https://api.sandbox.pawapay.io";
const PAWAPAY_PRODUCTION_URL = "https://api.pawapay.io";

// Mapping of PawaPay country codes to international dial codes
const COUNTRY_DIAL_CODES: Record<string, string> = {
  // PawaPay supported countries
  BJ: "229", BF: "226", CM: "237", CD: "243", CG: "242", CI: "225",
  GA: "241", GH: "233", KE: "254", LS: "266", MW: "265", MZ: "258",
  NG: "234", RW: "250", SN: "221", SL: "232", TZ: "255", UG: "256",
  ZM: "260",
  // Other countries (non-PawaPay providers)
  GM: "220", GN: "224", ML: "223", TG: "228", ZW: "263", MG: "261", EG: "20",
};

/**
 * Sanitize phone number to PawaPay MSISDN format.
 * Rules: digits only, no leading +, country code prepended if missing.
 * The local number is kept intact (including any "01" prefix in Benin, etc.)
 * Example: "0146447319" + country "BJ" → "2290146447319"
 * Example: "+2290146447319" → "2290146447319"
 */
function sanitizePhoneForPawaPay(phone: string, country: string): string {
  let n = phone.replace(/\s+/g, "").replace(/[^0-9+]/g, "");
  if (n.startsWith("+")) n = n.substring(1);

  const dialCode = COUNTRY_DIAL_CODES[country.toUpperCase()] || "";
  console.log(`[PawaPay Phone] Raw="${n}" country=${country} dialCode=${dialCode}`);

  if (!dialCode || n.startsWith(dialCode)) {
    // Already has country code or unknown country — keep as is
    console.log(`[PawaPay Phone] Final MSISDN: "${n}" (len=${n.length})`);
    return n;
  }

  // No country code yet — prepend it (keep full local number including leading digits)
  n = dialCode + n;
  console.log(`[PawaPay Phone] Added dial code → Final MSISDN: "${n}" (len=${n.length})`);
  return n;
}

export interface PawaPayConfig {
  apiToken: string;
  isSandbox: boolean;
}

console.log("[PawaPay] Module loaded - will use dynamic configuration from database");

export async function getPawaPayConfig(): Promise<PawaPayConfig | null> {
  try {
    const config = await storage.getProviderConfig("pawapay");
    if (!config?.isActive) {
      return null;
    }
    if (!config.apiKey) {
      console.log("[PawaPay] Missing API token");
      return null;
    }
    const secretKeyLower = (config.secretKey || "").trim().toLowerCase();
    const isSandbox = secretKeyLower !== "live";
    console.log(`[PawaPay] Mode: ${isSandbox ? "SANDBOX (api.sandbox.pawapay.io)" : "PRODUCTION (api.pawapay.io)"} — secretKey="${config.secretKey || "(vide)"}"`);
    return {
      apiToken: config.apiKey,
      isSandbox,
    };
  } catch (error) {
    console.error("[PawaPay] Error getting config:", error);
    return null;
  }
}

function getBaseUrl(isSandbox: boolean): string {
  return isSandbox ? PAWAPAY_SANDBOX_URL : PAWAPAY_PRODUCTION_URL;
}

async function pawaPayRequest(
  config: PawaPayConfig,
  method: "GET" | "POST",
  endpoint: string,
  body?: object
): Promise<{ ok: boolean; status: number; data: any }> {
  const url = `${getBaseUrl(config.isSandbox)}${endpoint}`;
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${config.apiToken}`,
    "Content-Type": "application/json",
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data: any;
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  return { ok: response.ok, status: response.status, data };
}

export interface PawaPayDepositParams {
  amount: number;
  currency: string;
  country: string;
  operator: string;
  phone: string;
  description: string;
  externalId?: string;
  preAuthorisationCode?: string;
}

export interface PawaPayDepositResult {
  success: boolean;
  depositId?: string;
  status?: string;
  message?: string;
  error?: string;
}

function mapPaymentErrorCode(code: string): string {
  const c = (code || "").toUpperCase();
  if (c.includes("NOT_ALLOWED") || c.includes("NOT_ACTIVATED")) return "Service temporairement indisponible pour cet opérateur. Veuillez contacter le support.";
  if (c.includes("DECLINED") || c.includes("PAYER_DECLINED") || c.includes("REFUSED")) return "Transaction refusée. Veuillez réessayer ou utiliser un autre moyen de paiement.";
  if (c.includes("LIMIT") || c.includes("MAX_AMOUNT") || c.includes("MIN_AMOUNT")) return "Montant hors des limites autorisées pour cet opérateur.";
  if (c.includes("INSUFFICIENT")) return "Solde insuffisant. Veuillez recharger votre compte mobile money avant de réessayer.";
  if (c.includes("DUPLICATE")) return "Transaction en cours. Veuillez patienter avant de réessayer.";
  if (c.includes("UNAVAILABLE") || c.includes("TEMPORARILY")) return "Service temporairement indisponible. Veuillez réessayer dans quelques minutes.";
  if (c.includes("INVALID_PHONE") || c.includes("INVALID_MSISDN")) return "Numéro de téléphone invalide ou non enregistré chez l'opérateur.";
  if (c.includes("TIMEOUT") || c.includes("TIMED_OUT")) return "Délai de validation dépassé. Veuillez réessayer.";
  if (c.includes("SYSTEM") || c.includes("INTERNAL")) return "Erreur technique. Veuillez réessayer.";
  return "Paiement non effectué. Veuillez réessayer ou utiliser un autre moyen de paiement.";
}

export async function createPawaPayDeposit(params: PawaPayDepositParams): Promise<PawaPayDepositResult> {
  const config = await getPawaPayConfig();
  if (!config) {
    return { success: false, error: "Service de paiement non disponible. Veuillez contacter le support." };
  }

  const correspondent = getCorrespondent(params.country, params.operator);
  if (!correspondent) {
    return { success: false, error: "Opérateur non disponible pour ce pays." };
  }

  const depositId = params.externalId || randomUUID();
  const amountStr = Math.floor(params.amount).toString();

  const sanitizedPhone = sanitizePhoneForPawaPay(params.phone, params.country);

  // v2 API: customerMessage must be 4–22 chars
  const customerMessage = (params.description || "Paiement BKApay").substring(0, 22).padEnd(4, " ").substring(0, 22);

  // PawaPay v2 deposit body — exact format from official documentation
  const body: any = {
    depositId,
    amount: amountStr,
    currency: params.currency,
    payer: {
      type: "MMO",
      accountDetails: {
        phoneNumber: sanitizedPhone,
        provider: correspondent,
      },
    },
    customerMessage,
  };

  if (params.preAuthorisationCode) {
    body.preAuthorisationCode = params.preAuthorisationCode;
  }

  const mode = config.isSandbox ? "SANDBOX" : "PRODUCTION";
  console.log(`[PawaPay Deposit] [${mode}] Initiating ${amountStr} ${params.currency} via ${correspondent}, phone: ***${sanitizedPhone.slice(-4)}${params.preAuthorisationCode ? " [OTP provided]" : ""}`);

  try {
    const result = await pawaPayRequest(config, "POST", "/v2/deposits", body);

    console.log(`[PawaPay Deposit] [${mode}] HTTP ${result.status}, status="${result.data?.status}", raw=${JSON.stringify(result.data).substring(0, 400)}`);

    if (result.status === 200 && result.data.status === "ACCEPTED") {
      return {
        success: true,
        depositId: result.data.depositId,
        status: "pending",
        message: "Dépôt initié. Veuillez valider sur votre téléphone.",
      };
    }

    if (result.data.status === "REJECTED") {
      const fr = result.data.failureReason;
      const reason = fr?.failureCode || fr?.rejectionCode || fr?.failureMessage || fr?.message || fr?.code || (typeof fr === "string" ? fr : null) || "UNKNOWN";
      const hint = config.isSandbox ? " [MODE SANDBOX]" : "";
      console.error(`[PawaPay Deposit] [${mode}] Rejected: ${reason}${hint}`, fr ? JSON.stringify(fr) : "(failureReason null)");
      return { success: false, error: mapPaymentErrorCode(reason) };
    }

    console.error(`[PawaPay Deposit] [${mode}] Unexpected response:`, JSON.stringify(result.data).substring(0, 400));
    return { success: false, error: "Paiement non effectué. Veuillez réessayer." };
  } catch (error: any) {
    console.error(`[PawaPay Deposit] [${mode}] Error:`, error);
    return { success: false, error: "Service momentanément indisponible. Veuillez réessayer." };
  }
}

export interface PawaPayPayoutParams {
  amount: number;
  currency: string;
  country: string;
  operator: string;
  phone: string;
  description: string;
  externalId?: string;
}

export interface PawaPayPayoutResult {
  success: boolean;
  payoutId?: string;
  status?: string;
  message?: string;
  error?: string;
}

export async function createPawaPayPayout(params: PawaPayPayoutParams): Promise<PawaPayPayoutResult> {
  const config = await getPawaPayConfig();
  if (!config) {
    return { success: false, error: "Service de retrait non disponible. Veuillez contacter le support." };
  }

  const correspondent = getCorrespondent(params.country, params.operator);
  if (!correspondent) {
    return { success: false, error: "Opérateur non disponible pour ce pays." };
  }

  const payoutId = params.externalId || randomUUID();
  const amountStr = Math.floor(params.amount).toString();

  const sanitizedPhone = sanitizePhoneForPawaPay(params.phone, params.country);

  // v2 API: customerMessage must be 4–22 chars
  const customerMessage = (params.description || "Retrait BKApay").substring(0, 22).padEnd(4, " ").substring(0, 22);

  // PawaPay v2 payout body — exact format from official documentation
  const body: any = {
    payoutId,
    amount: amountStr,
    currency: params.currency,
    recipient: {
      type: "MMO",
      accountDetails: {
        phoneNumber: sanitizedPhone,
        provider: correspondent,
      },
    },
    customerMessage,
  };

  const mode = config.isSandbox ? "SANDBOX" : "PRODUCTION";
  console.log(`[PawaPay Payout] [${mode}] Initiating ${amountStr} ${params.currency} via ${correspondent}, phone: ***${sanitizedPhone.slice(-4)}`);

  try {
    const result = await pawaPayRequest(config, "POST", "/v2/payouts", body);

    console.log(`[PawaPay Payout] [${mode}] HTTP ${result.status}, status="${result.data?.status}", raw=${JSON.stringify(result.data).substring(0, 400)}`);

    if (result.status === 200 && result.data.status === "ACCEPTED") {
      return {
        success: true,
        payoutId: result.data.payoutId,
        status: "pending",
        message: "Retrait initié avec succès",
      };
    }

    if (result.data.status === "REJECTED") {
      const fr = result.data.failureReason;
      const reason = fr?.failureCode || fr?.rejectionCode || fr?.failureMessage || fr?.message || fr?.code || (typeof fr === "string" ? fr : null) || "UNKNOWN";
      const hint = config.isSandbox ? " [MODE SANDBOX]" : "";
      console.error(`[PawaPay Payout] [${mode}] Rejected: ${reason}${hint}`, fr ? JSON.stringify(fr) : "(failureReason null)");
      return { success: false, error: mapPaymentErrorCode(reason) };
    }

    console.error(`[PawaPay Payout] [${mode}] Unexpected response:`, JSON.stringify(result.data).substring(0, 400));
    return { success: false, error: "Retrait non effectué. Veuillez réessayer." };
  } catch (error: any) {
    console.error(`[PawaPay Payout] [${mode}] Error:`, error);
    return { success: false, error: "Service momentanément indisponible. Veuillez réessayer." };
  }
}

export async function getPawaPayDepositStatus(depositId: string): Promise<{ status: string; data?: any }> {
  const config = await getPawaPayConfig();
  if (!config) return { status: "error" };

  try {
    const result = await pawaPayRequest(config, "GET", `/v2/deposits/${depositId}`);
    console.log(`[PawaPay] Deposit status raw response: ok=${result.ok} status=${result.status} data=${JSON.stringify(result.data).substring(0, 600)}`);
    if (result.ok && result.data) {
      // PawaPay response: {"data": {depositObject}, "status": "FOUND"}
      // The real transaction status is in result.data.data.status
      const deposit = result.data?.data || (Array.isArray(result.data) ? result.data[0] : result.data);
      const txStatus = deposit?.status || "UNKNOWN";
      return { status: txStatus, data: deposit };
    }
    return { status: "error" };
  } catch (error) {
    console.error("[PawaPay] Error getting deposit status:", error);
    return { status: "error" };
  }
}

export async function getPawaPayPayoutStatus(payoutId: string): Promise<{ status: string; data?: any }> {
  const config = await getPawaPayConfig();
  if (!config) return { status: "error" };

  try {
    const result = await pawaPayRequest(config, "GET", `/v2/payouts/${payoutId}`);
    console.log(`[PawaPay] Payout status raw response: ok=${result.ok} status=${result.status} data=${JSON.stringify(result.data).substring(0, 600)}`);
    if (result.ok && result.data) {
      // PawaPay response: {"data": {payoutObject}, "status": "FOUND"}
      const payout = result.data?.data || (Array.isArray(result.data) ? result.data[0] : result.data);
      const txStatus = payout?.status || "UNKNOWN";
      return { status: txStatus, data: payout };
    }
    return { status: "error" };
  } catch (error) {
    console.error("[PawaPay] Error getting payout status:", error);
    return { status: "error" };
  }
}

export function mapPawaPayStatus(status: string): "pending" | "completed" | "failed" {
  switch (status?.toUpperCase()) {
    case "COMPLETED":
      return "completed";
    case "FAILED":
    case "REJECTED":
    case "TIMED_OUT":
      return "failed";
    default:
      return "pending";
  }
}

export const PAWAPAY_SUPPORTED_COUNTRIES = PAWAPAY_COUNTRIES.map(c => c.code.toLowerCase());
