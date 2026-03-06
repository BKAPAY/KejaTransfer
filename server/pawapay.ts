import { storage } from "./storage";
import { PAWAPAY_COUNTRIES, getCorrespondent } from "@shared/pawapay-countries";
import { randomUUID } from "crypto";

const PAWAPAY_SANDBOX_URL = "https://api.sandbox.pawapay.io";
const PAWAPAY_PRODUCTION_URL = "https://api.pawapay.io";

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

export async function createPawaPayDeposit(params: PawaPayDepositParams): Promise<PawaPayDepositResult> {
  const config = await getPawaPayConfig();
  if (!config) {
    return { success: false, error: "PawaPay n'est pas configuré. Veuillez configurer le token API dans l'interface administrateur." };
  }

  const correspondent = getCorrespondent(params.country, params.operator);
  if (!correspondent) {
    return { success: false, error: `Opérateur ${params.operator} non supporté pour ${params.country} avec PawaPay` };
  }

  const depositId = params.externalId || randomUUID();
  const amountStr = Math.floor(params.amount).toString();

  let sanitizedPhone = params.phone.replace(/\s+/g, "").replace(/[^0-9+]/g, "");
  if (sanitizedPhone.startsWith("+")) {
    sanitizedPhone = sanitizedPhone.substring(1);
  }

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
      const hint = config.isSandbox ? " [MODE SANDBOX — entrez 'live' dans le champ Environnement pour utiliser la production]" : "";
      console.error(`[PawaPay Deposit] [${mode}] Rejected: ${reason}${hint}`, fr ? JSON.stringify(fr) : "(failureReason null)");
      return { success: false, error: `Dépôt refusé: ${reason}` };
    }

    console.error(`[PawaPay Deposit] [${mode}] Unexpected response:`, JSON.stringify(result.data).substring(0, 400));
    return { success: false, error: "Erreur lors de l'initiation du dépôt PawaPay" };
  } catch (error: any) {
    console.error(`[PawaPay Deposit] [${mode}] Error:`, error);
    return { success: false, error: error?.message || "Erreur de connexion à PawaPay" };
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
    return { success: false, error: "PawaPay n'est pas configuré. Veuillez configurer le token API dans l'interface administrateur." };
  }

  const correspondent = getCorrespondent(params.country, params.operator);
  if (!correspondent) {
    return { success: false, error: `Opérateur ${params.operator} non supporté pour ${params.country} avec PawaPay` };
  }

  const payoutId = params.externalId || randomUUID();
  const amountStr = Math.floor(params.amount).toString();

  let sanitizedPhone = params.phone.replace(/\s+/g, "").replace(/[^0-9+]/g, "");
  if (sanitizedPhone.startsWith("+")) {
    sanitizedPhone = sanitizedPhone.substring(1);
  }

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
      const hint = config.isSandbox ? " [MODE SANDBOX — entrez 'live' dans le champ Environnement pour utiliser la production]" : "";
      console.error(`[PawaPay Payout] [${mode}] Rejected: ${reason}${hint}`, fr ? JSON.stringify(fr) : "(failureReason null)");
      return { success: false, error: `Retrait refusé: ${reason}` };
    }

    console.error(`[PawaPay Payout] [${mode}] Unexpected response:`, JSON.stringify(result.data).substring(0, 400));
    return { success: false, error: "Erreur lors de l'initiation du retrait PawaPay" };
  } catch (error: any) {
    console.error(`[PawaPay Payout] [${mode}] Error:`, error);
    return { success: false, error: error?.message || "Erreur de connexion à PawaPay" };
  }
}

export async function getPawaPayDepositStatus(depositId: string): Promise<{ status: string; data?: any }> {
  const config = await getPawaPayConfig();
  if (!config) return { status: "error" };

  try {
    const result = await pawaPayRequest(config, "GET", `/v2/deposits/${depositId}`);
    if (result.ok && result.data) {
      return { status: result.data.status || "UNKNOWN", data: result.data };
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
    if (result.ok && result.data) {
      return { status: result.data.status || "UNKNOWN", data: result.data };
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
