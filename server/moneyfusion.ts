import { storage } from "./storage";
import { getMoneyFusionWithdrawMode, getMoneyFusionCurrency, isMoneyFusionSupported } from "@shared/moneyfusion-countries";
import postgres from "postgres";

const MONEYFUSION_API_URL = "https://pay.moneyfusion.net/api/v1";
const MONEYFUSION_TIMEOUT_MS = 30000;

let cachedServerIp: string | null = null;

async function getServerPublicIp(): Promise<string> {
  if (cachedServerIp) return cachedServerIp;
  try {
    const res = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    cachedServerIp = data.ip || "unknown";
    return cachedServerIp!;
  } catch {
    return "unknown";
  }
}

async function logMoneyFusionIpError(errorMessage: string, countryCode: string, operatorCode: string) {
  try {
    const ip = await getServerPublicIp();
    const client = postgres(process.env.DATABASE_URL!);
    await client`
      INSERT INTO moneyfusion_ip_logs (ip_address, error_message, country_code, operator_code)
      VALUES (${ip}, ${errorMessage}, ${countryCode}, ${operatorCode})
    `;
    await client.end();
    console.log(`[MoneyFusion IP Log] Logged IP ${ip} for ${countryCode}/${operatorCode}`);
  } catch (e) {
    console.error("[MoneyFusion IP Log] Failed to log IP error:", e);
  }
}

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

    const COUNTRY_DIAL_CODES: Record<string, string> = {
      "bj": "229", "ci": "225", "sn": "221", "bf": "226", "tg": "228",
      "ml": "223", "cg": "242", "cm": "237", "cd": "243", "ga": "241",
      "gn": "224", "gm": "220", "gh": "233", "gw": "245", "ke": "254",
      "mr": "222", "ne": "227", "ug": "256", "cf": "236", "rw": "250",
      "sl": "232", "tz": "255", "td": "235", "et": "251",
    };

    let cleanPhone = params.phone.replace(/[\s\-\.]+/g, "");
    if (cleanPhone.startsWith("+")) {
      cleanPhone = cleanPhone.substring(1);
    }
    const dialCode = COUNTRY_DIAL_CODES[countryLower];
    if (dialCode && cleanPhone.startsWith(dialCode)) {
      cleanPhone = cleanPhone.substring(dialCode.length);
    }
    if (cleanPhone.startsWith("00") && dialCode && cleanPhone.startsWith("00" + dialCode)) {
      cleanPhone = cleanPhone.substring(2 + dialCode.length);
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
      logMoneyFusionIpError(data.message || "IP non autorisée", countryLower, params.operatorCode);
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

export interface MoneyFusionPayoutStatusResult {
  success: boolean;
  status?: "pending" | "paid" | "failure" | "no paid";
  tokenPay?: string;
  montant?: number;
  moyen?: string;
  error?: string;
}

export async function checkMoneyFusionPayoutStatus(tokenPay: string): Promise<MoneyFusionPayoutStatusResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let response: Response;
    try {
      response = await fetch(`https://www.pay.moneyfusion.net/paiementNotif/${tokenPay}`, {
        method: "GET",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const data = await response.json();
    console.log(`[MoneyFusion StatusCheck] tokenPay=${tokenPay} response:`, JSON.stringify(data));

    if (data.statut === true && data.data) {
      const paymentStatus = (data.data.statut || "").toLowerCase();
      return {
        success: true,
        status: paymentStatus as any,
        tokenPay: data.data.tokenPay,
        montant: data.data.Montant,
        moyen: data.data.moyen,
      };
    }

    return { success: false, error: data.message || "Unknown error" };
  } catch (error: any) {
    console.error(`[MoneyFusion StatusCheck] Error for tokenPay=${tokenPay}:`, error.message);
    return { success: false, error: error.message };
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
  if (!payload || !payload.tokenPay) {
    console.error("[MoneyFusion Webhook] Invalid payload - missing tokenPay");
    return null;
  }

  const event = payload.event || "";
  const validEvents = ["payout.session.completed", "payout.session.cancelled", "payout.session.pending"];
  if (event && !validEvents.includes(event)) {
    console.error(`[MoneyFusion Webhook] Unknown event: ${event}`);
    return null;
  }

  return {
    event: event,
    tokenPay: payload.tokenPay,
    montant: payload.montant || payload.Montant,
    numeroRetrait: payload.numeroRetrait || payload.numeroSend || "",
    moyen: payload.moyen || "",
    webhook_url: payload.webhook_url,
    createdAt: payload.createdAt || "",
  };
}

export function isMoneyFusionPayoutCompleted(event: string): boolean {
  return event === "payout.session.completed";
}

export function isMoneyFusionPayoutFailed(event: string): boolean {
  return event === "payout.session.cancelled";
}
