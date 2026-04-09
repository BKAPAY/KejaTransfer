import { storage } from "./storage";

const FEEXPAY_BASE_URL = "https://api.feexpay.me";

console.log("[FeeXPay] Module loaded - will use dynamic configuration from database");

export interface FeeXPayConfig {
  apiKey: string;
  shopId: string;
}

export async function getFeeXPayConfig(): Promise<FeeXPayConfig | null> {
  try {
    const config = await storage.getProviderConfig("feexpay");
    if (!config?.isActive) return null;
    if (!config.apiKey || !config.publicKey) {
      console.log("[FeeXPay] Missing configuration (apiKey or shopId)");
      return null;
    }
    return {
      apiKey: config.apiKey,
      shopId: config.publicKey,
    };
  } catch (error) {
    console.error("[FeeXPay] Error getting config:", error);
    return null;
  }
}

function getAuthHeaders(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
}

export interface FeeXPayPayinParams {
  networkKey: string;
  shopId: string;
  amount: number;
  phoneNumber: string;
  otpCode?: string;
  firstName?: string;
  lastName?: string;
  description?: string;
  callbackUrl?: string;
}

export interface FeeXPayPayinResult {
  success: boolean;
  reference?: string;
  transactionId?: string;
  message?: string;
  requiresOtp?: boolean;
  redirectUrl?: string;
  error?: string;
}

export async function createFeeXPayPayin(
  config: FeeXPayConfig,
  params: FeeXPayPayinParams
): Promise<FeeXPayPayinResult> {
  try {
    const body: Record<string, unknown> = {
      shop: params.shopId,
      amount: params.amount,
      phoneNumber: Number(params.phoneNumber),
    };
    if (params.otpCode !== undefined) {
      body.otp = params.otpCode;
    }
    if (params.firstName) body.firstName = params.firstName;
    if (params.lastName) body.lastName = params.lastName;
    if (params.description) body.description = params.description;
    if (params.callbackUrl) body.callback_url = params.callbackUrl;

    const url = `${FEEXPAY_BASE_URL}/api/transactions/public/requesttopay/${params.networkKey}`;
    console.log(`[FeeXPay] Payin request to ${params.networkKey}:`, { amount: params.amount, phone: params.phoneNumber });

    const response = await fetch(url, {
      method: "POST",
      headers: getAuthHeaders(config.apiKey),
      body: JSON.stringify(body),
    });

    const data = await response.json();
    console.log(`[FeeXPay] Payin response:`, JSON.stringify(data).slice(0, 500));

    if (!response.ok) {
      return {
        success: false,
        error: data?.message || data?.error || `Erreur HTTP ${response.status}`,
      };
    }

    if (data?.status === "failed" || data?.status === "error") {
      return { success: false, error: data?.message || "Paiement echoue" };
    }

    const reference = data?.reference || data?.id || data?.transactionId || data?.data?.reference;
    if (!reference) {
      console.warn("[FeeXPay] No reference in response:", data);
    }

    const redirectUrl = data?.redirect_url || data?.redirectUrl || data?.url;

    return {
      success: true,
      reference,
      transactionId: reference,
      message: data?.message || "Paiement initie avec succes",
      redirectUrl,
    };
  } catch (error: any) {
    console.error("[FeeXPay] Payin error:", error);
    return { success: false, error: error?.message || "Erreur de connexion FeeXPay" };
  }
}

export interface FeeXPayPayoutParams {
  networkKey: string;
  shopId: string;
  amount: number;
  phoneNumber: string;
  firstName?: string;
  lastName?: string;
  description?: string;
  callbackUrl?: string;
}

export interface FeeXPayPayoutResult {
  success: boolean;
  reference?: string;
  transactionId?: string;
  message?: string;
  error?: string;
}

export async function createFeeXPayPayout(
  config: FeeXPayConfig,
  params: FeeXPayPayoutParams
): Promise<FeeXPayPayoutResult> {
  try {
    const body: Record<string, unknown> = {
      shop: params.shopId,
      amount: params.amount,
      phoneNumber: Number(params.phoneNumber),
      operator: params.networkKey,
    };
    if (params.firstName) body.firstName = params.firstName;
    if (params.lastName) body.lastName = params.lastName;
    if (params.description) body.description = params.description;
    if (params.callbackUrl) body.callback_url = params.callbackUrl;

    const url = `${FEEXPAY_BASE_URL}/api/transactions/public/payout`;
    console.log(`[FeeXPay] Payout request (operator=${params.networkKey}):`, { amount: params.amount, phone: params.phoneNumber });

    const response = await fetch(url, {
      method: "POST",
      headers: getAuthHeaders(config.apiKey),
      body: JSON.stringify(body),
    });

    const data = await response.json();
    console.log(`[FeeXPay] Payout response:`, JSON.stringify(data).slice(0, 500));

    if (!response.ok) {
      return {
        success: false,
        error: data?.message || data?.error || `Erreur HTTP ${response.status}`,
      };
    }

    if (data?.status === "failed" || data?.status === "error") {
      return { success: false, error: data?.message || "Paiement echoue" };
    }

    const reference = data?.reference || data?.id || data?.transactionId || data?.data?.reference;

    return {
      success: true,
      reference,
      transactionId: reference,
      message: data?.message || "Paiement sortant initie avec succes",
    };
  } catch (error: any) {
    console.error("[FeeXPay] Payout error:", error);
    return { success: false, error: error?.message || "Erreur de connexion FeeXPay" };
  }
}

export interface FeeXPayStatusResult {
  success: boolean;
  status?: string;
  mappedStatus?: "pending" | "completed" | "failed";
  raw?: any;
  error?: string;
}

export async function checkFeeXPayTransactionStatus(
  config: FeeXPayConfig,
  reference: string
): Promise<FeeXPayStatusResult> {
  const endpoints = [
    `${FEEXPAY_BASE_URL}/api/transactions/public/${reference}`,
    `${FEEXPAY_BASE_URL}/api/transactions/${config.shopId}/${reference}`,
    `${FEEXPAY_BASE_URL}/api/transactions/${reference}`,
  ];

  for (const url of endpoints) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: getAuthHeaders(config.apiKey),
      });

      if (response.status === 404) continue;

      if (!response.ok) {
        console.log(`[FeeXPay] Status check ${url} returned HTTP ${response.status}`);
        continue;
      }

      const data = await response.json();
      const rawStatus = data?.status || data?.transaction?.status || data?.data?.status;

      if (!rawStatus) {
        return { success: true, status: "pending", mappedStatus: "pending", raw: data };
      }

      const mapped = mapFeeXPayStatus(rawStatus);
      console.log(`[FeeXPay] Status found via ${url.replace(FEEXPAY_BASE_URL, '')}: ${rawStatus} -> ${mapped}`);
      return { success: true, status: rawStatus, mappedStatus: mapped, raw: data };
    } catch (error: any) {
      console.log(`[FeeXPay] Status check error for ${url}: ${error?.message}`);
      continue;
    }
  }

  return { success: false, error: "Transaction not found on any endpoint" };
}

export function mapFeeXPayStatus(status: string): "pending" | "completed" | "failed" {
  const s = (status || "").toLowerCase();
  if (s === "successful" || s === "success" || s === "completed" || s === "paid") return "completed";
  if (s === "failed" || s === "error" || s === "cancelled" || s === "canceled") return "failed";
  return "pending";
}

export function translateFeeXPayError(error: string | undefined, type: "deposit" | "withdrawal" | "transfer"): string {
  if (!error) {
    if (type === "deposit") return "Depot echoue. Verifiez vos informations et reessayez.";
    if (type === "transfer") return "Transfert echoue. Verifiez vos informations et reessayez.";
    return "Retrait echoue. Verifiez vos informations et reessayez.";
  }
  const e = error.toLowerCase();
  if (e.includes("insufficient") || e.includes("solde")) return "Solde insuffisant chez l'operateur.";
  if (e.includes("invalid") && e.includes("phone")) return "Numero de telephone invalide.";
  if (e.includes("unauthorized") || e.includes("401")) return "Erreur d'authentification FeeXPay. Verifiez la cle API.";
  if (e.includes("timeout") || e.includes("timed out")) return "Delai d'attente depasse. Reessayez.";
  if (type === "deposit") return "Depot echoue. Verifiez vos informations et reessayez.";
  if (type === "transfer") return "Transfert echoue. Verifiez vos informations et reessayez.";
  return "Retrait echoue. Verifiez vos informations et reessayez.";
}
