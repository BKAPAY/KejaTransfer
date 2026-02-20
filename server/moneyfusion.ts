import { storage } from "./storage";
import { getMoneyFusionWithdrawMode, getMoneyFusionCurrency, isMoneyFusionSupported } from "@shared/moneyfusion-countries";

const MONEYFUSION_API_URL = "https://pay.moneyfusion.net/api/v1";
const MONEYFUSION_TIMEOUT_MS = 30000;

async function getMoneyFusionApiKey(): Promise<string | null> {
  try {
    const config = await storage.getProviderConfig("moneyfusion");
    if (!config?.isActive || !config?.apiKey) {
      return null;
    }
    return config.apiKey;
  } catch (error) {
    console.error("[MoneyFusion] Error getting API key:", error);
    return null;
  }
}

export interface MoneyFusionPayoutParams {
  amount: number;
  phone: string;
  countryCode: string;
  operatorCode: string;
  webhookUrl?: string;
}

export interface MoneyFusionPayoutResult {
  success: boolean;
  tokenPay?: string;
  message?: string;
  error?: string;
}

export async function createMoneyFusionPayout(params: MoneyFusionPayoutParams): Promise<MoneyFusionPayoutResult> {
  try {
    const apiKey = await getMoneyFusionApiKey();
    if (!apiKey) {
      return { success: false, error: "Le service de retrait est temporairement indisponible. Veuillez reessayer plus tard." };
    }

    const countryLower = params.countryCode.toLowerCase();

    if (!isMoneyFusionSupported(countryLower, params.operatorCode)) {
      return { success: false, error: "L'operation n'est pas disponible pour le moment. Veuillez reessayer plus tard." };
    }

    const withdrawMode = getMoneyFusionWithdrawMode(countryLower, params.operatorCode);
    if (!withdrawMode) {
      return { success: false, error: "L'operation n'est pas disponible pour le moment. Veuillez reessayer plus tard." };
    }

    let cleanPhone = params.phone.replace(/[\s\-\.]+/g, "");
    if (cleanPhone.startsWith("+")) {
      cleanPhone = cleanPhone.substring(1);
    }

    const baseUrl = process.env.BASE_URL || "https://bkapay.com";
    const webhookUrl = params.webhookUrl || `${baseUrl}/api/webhooks/moneyfusion/payout`;

    const requestBody = {
      countryCode: countryLower,
      phone: cleanPhone,
      amount: Math.floor(params.amount),
      withdraw_mode: withdrawMode,
      webhook_url: webhookUrl,
    };

    console.log(`[MoneyFusion Payout] Initiating: ${params.amount} to ${cleanPhone}, mode=${withdrawMode}, country=${countryLower}`);
    console.log(`[MoneyFusion Payout] Request body:`, JSON.stringify(requestBody));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MONEYFUSION_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${MONEYFUSION_API_URL}/withdraw`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "moneyfusion-private-key": apiKey,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const data = await response.json();
    console.log(`[MoneyFusion Payout] HTTP ${response.status} Response:`, JSON.stringify(data));

    if (data.statut === true && data.tokenPay) {
      console.log(`[MoneyFusion Payout] Success - tokenPay: ${data.tokenPay}`);
      return {
        success: true,
        tokenPay: data.tokenPay,
        message: "Operation en cours de traitement. Veuillez patienter.",
      };
    }

    console.error("[MoneyFusion Payout] Error response:", JSON.stringify(data));

    const msgLower = (data.message || "").toLowerCase();

    if (msgLower.includes("insufficient") || msgLower.includes("solde") || msgLower.includes("balance") || msgLower.includes("wallet") || msgLower.includes("fonds")) {
      return { success: false, error: "Le service est temporairement indisponible. Veuillez reessayer plus tard." };
    }
    if (msgLower.includes("ip") || msgLower.includes("adresse") || msgLower.includes("autoris")) {
      console.error("[MoneyFusion Payout] IP not whitelisted");
      return { success: false, error: "Le service est temporairement indisponible. Veuillez reessayer plus tard." };
    }
    if (msgLower.includes("phone") || msgLower.includes("numero") || msgLower.includes("tel")) {
      return { success: false, error: "Numero de telephone invalide. Veuillez verifier et reessayer." };
    }
    if (msgLower.includes("amount") || msgLower.includes("montant")) {
      return { success: false, error: "Montant invalide. Veuillez verifier et reessayer." };
    }
    if (msgLower.includes("api") || msgLower.includes("key") || msgLower.includes("cle") || msgLower.includes("auth")) {
      console.error("[MoneyFusion Payout] Authentication error");
      return { success: false, error: "Le service est temporairement indisponible. Veuillez reessayer plus tard." };
    }

    return { success: false, error: "L'operation a echoue. Veuillez reessayer dans quelques minutes." };
  } catch (error: any) {
    console.error("[MoneyFusion Payout] Exception:", error.name, error.message);
    if (error.name === "AbortError") {
      return { success: false, error: "Le service ne repond pas. Veuillez reessayer dans quelques minutes." };
    }
    return { success: false, error: "Erreur de connexion au service. Veuillez reessayer plus tard." };
  }
}

export interface MoneyFusionWebhookPayload {
  event: string;
  tokenPay: string;
  montant: number;
  numeroRetrait: string;
  moyen: string;
  webhook_url?: string;
  createdAt: string;
}

export function validateMoneyFusionWebhook(payload: any): MoneyFusionWebhookPayload | null {
  if (!payload || !payload.event || !payload.tokenPay) {
    console.error("[MoneyFusion Webhook] Invalid payload - missing event or tokenPay");
    return null;
  }

  const validEvents = ["payout.session.completed", "payout.session.cancelled"];
  if (!validEvents.includes(payload.event)) {
    console.error(`[MoneyFusion Webhook] Unknown event: ${payload.event}`);
    return null;
  }

  return {
    event: payload.event,
    tokenPay: payload.tokenPay,
    montant: payload.montant,
    numeroRetrait: payload.numeroRetrait,
    moyen: payload.moyen,
    webhook_url: payload.webhook_url,
    createdAt: payload.createdAt,
  };
}

export function isMoneyFusionPayoutCompleted(event: string): boolean {
  return event === "payout.session.completed";
}

export function isMoneyFusionPayoutFailed(event: string): boolean {
  return event === "payout.session.cancelled";
}
