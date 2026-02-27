import { storage } from "./storage";
import { 
  AFRIBAPAY_COUNTRIES, 
  getCurrencyForCountry,
  getOtpInstructionsForOperator,
  getWaveInstructions,
  operatorRequiresOtpForCountry,
  getPaymentInstructions,
} from "@shared/afribapay-countries";

const AFRIBAPAY_SANDBOX_URL = "https://api-sandbox.afribapay.com/v1";
const AFRIBAPAY_PRODUCTION_URL = "https://api.afribapay.com/v1";

export interface AfribaPayConfig {
  apiUser: string;
  apiKey: string;
  merchantKey: string;
  agentId?: string | null;
  isLive: boolean;
}

interface TokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

export async function getAfribaPayConfig(): Promise<AfribaPayConfig | null> {
  try {
    const config = await storage.getProviderConfig("afribapay");
    if (!config?.isActive) {
      return null;
    }
    if (!config.apiKey || !config.secretKey || !config.publicKey) {
      console.log("[AfribaPay] Missing configuration (apiUser, apiKey, or merchantKey)");
      return null;
    }
    const isLive = config.publicKey?.startsWith("pk_") && !config.publicKey?.includes("sandbox");
    return {
      apiUser: config.publicKey,
      apiKey: config.apiKey,
      merchantKey: config.secretKey,
      agentId: config.masterKey,
      isLive: isLive,
    };
  } catch (error) {
    console.error("[AfribaPay] Error getting config:", error);
    return null;
  }
}

function getBaseUrl(isLive: boolean): string {
  return isLive ? AFRIBAPAY_PRODUCTION_URL : AFRIBAPAY_SANDBOX_URL;
}

async function getAccessToken(config: AfribaPayConfig): Promise<string | null> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token;
  }

  try {
    const baseUrl = getBaseUrl(config.isLive);
    const credentials = Buffer.from(`${config.apiUser}:${config.apiKey}`).toString("base64");

    const response = await fetch(`${baseUrl}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({}),
    });

    const data = await response.json();

    if (!response.ok || !data.data?.access_token) {
      console.error("[AfribaPay] Token error:", data);
      return null;
    }

    const expiresIn = data.data.expires_in || 86400;
    tokenCache = {
      token: data.data.access_token,
      expiresAt: Date.now() + (expiresIn - 300) * 1000,
    };

    console.log("[AfribaPay] Access token obtained successfully");
    return tokenCache.token;
  } catch (error) {
    console.error("[AfribaPay] Token fetch error:", error);
    return null;
  }
}

export function formatPhoneForAfribaPay(phone: string, countryCode: string): string {
  let sanitized = phone.replace(/\s+/g, "").replace(/[^0-9]/g, "");
  
  const country = AFRIBAPAY_COUNTRIES.find(c => c.code === countryCode);
  if (!country) return sanitized;
  
  const prefixDigits = country.phoneCode.replace("+", "");
  
  // Si le numéro commence par le préfixe pays (ex: 229...), on le retire
  if (sanitized.startsWith(prefixDigits)) {
    return sanitized.substring(prefixDigits.length);
  }
  
  // Si le numéro a déjà la bonne longueur, on le retourne tel quel
  // (Exemple: Bénin "01XXXXXXXX" = 10 chiffres, le 0 est partie du numéro)
  if (sanitized.length === country.phoneDigits) {
    return sanitized;
  }
  
  // Si le numéro est trop long d'un chiffre et commence par "0",
  // c'est un indicatif national à retirer (ex: CM "0656..." → "656...")
  if (sanitized.startsWith("0") && sanitized.length === country.phoneDigits + 1) {
    return sanitized.substring(1);
  }
  
  return sanitized;
}

export interface AfribaPayPayinParams {
  amount: number;
  currency: string;
  phone: string;
  countryCode: string;
  operator: string;
  otpCode?: string;
  orderId?: string;
  referenceId?: string;
  notifyUrl?: string;
  returnUrl?: string;
  cancelUrl?: string;
}

export interface AfribaPayPayinResult {
  success: boolean;
  transactionId?: string;
  orderId?: string;
  status?: string;
  providerLink?: string;
  message?: string;
  error?: string;
  amount?: number;
  amountTotal?: number;
  fees?: number;
  taxes?: number;
}

export async function createAfribaPayPayin(params: AfribaPayPayinParams): Promise<AfribaPayPayinResult> {
  try {
    const config = await getAfribaPayConfig();
    if (!config) {
      return { success: false, error: "AfribaPay non configure ou desactive" };
    }

    const token = await getAccessToken(config);
    if (!token) {
      return { success: false, error: "Impossible d'obtenir le token d'acces AfribaPay" };
    }

    const baseUrl = getBaseUrl(config.isLive);
    const formattedPhone = formatPhoneForAfribaPay(params.phone, params.countryCode);
    
    const requestBody: Record<string, any> = {
      operator: params.operator.toLowerCase(),
      country: params.countryCode.toUpperCase(),
      phone_number: formattedPhone,
      amount: Math.round(params.amount),
      currency: params.currency,
      merchant_key: config.merchantKey,
      lang: "fr",
    };

    if (params.otpCode) {
      requestBody.otp_code = params.otpCode;
    }
    if (params.orderId) {
      requestBody.order_id = params.orderId;
    }
    if (params.referenceId) {
      requestBody.reference_id = params.referenceId;
    }
    if (params.notifyUrl) {
      requestBody.notify_url = params.notifyUrl;
    }
    if (params.returnUrl) {
      requestBody.return_url = params.returnUrl;
    }
    if (params.cancelUrl) {
      requestBody.cancel_url = params.cancelUrl;
    }

    console.log(`[AfribaPay Payin] Request: country=${params.countryCode}, operator=${params.operator}, amount=${params.amount}, phone=${formattedPhone}`);

    const response = await fetch(`${baseUrl}/pay/payin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok || !data.data?.transaction_id) {
      console.error("[AfribaPay Payin] Error:", data);
      return {
        success: false,
        error: data.message || data.error || "Erreur lors de l'initiation du paiement",
      };
    }

    console.log(`[AfribaPay Payin] Success: transaction_id=${data.data.transaction_id}, status=${data.data.status}`);

    return {
      success: true,
      transactionId: data.data.transaction_id,
      orderId: data.data.order_id,
      status: data.data.status,
      providerLink: data.data.provider_link,
      amount: data.data.amount,
      amountTotal: data.data.amount_total,
      fees: data.data.fees,
      taxes: data.data.taxes,
      message: "Paiement initie avec succes",
    };
  } catch (error) {
    console.error("[AfribaPay Payin] Exception:", error);
    return { success: false, error: "Erreur de connexion a AfribaPay" };
  }
}

export interface AfribaPayPayoutParams {
  amount: number;
  currency: string;
  phone: string;
  countryCode: string;
  operator: string;
  orderId?: string;
  referenceId?: string;
  notifyUrl?: string;
}

export interface AfribaPayPayoutResult {
  success: boolean;
  transactionId?: string;
  orderId?: string;
  status?: string;
  message?: string;
  error?: string;
  amount?: number;
  fees?: number;
}

export async function createAfribaPayPayout(params: AfribaPayPayoutParams): Promise<AfribaPayPayoutResult> {
  try {
    const config = await getAfribaPayConfig();
    if (!config) {
      return { success: false, error: "AfribaPay non configure ou desactive" };
    }

    const token = await getAccessToken(config);
    if (!token) {
      return { success: false, error: "Impossible d'obtenir le token d'acces AfribaPay" };
    }

    const baseUrl = getBaseUrl(config.isLive);
    const formattedPhone = formatPhoneForAfribaPay(params.phone, params.countryCode);

    const requestBody: Record<string, any> = {
      operator: params.operator.toLowerCase(),
      country: params.countryCode.toUpperCase(),
      phone_number: formattedPhone,
      amount: Math.round(params.amount),
      currency: params.currency,
      merchant_key: config.merchantKey,
      lang: "fr",
    };

    if (params.orderId) {
      requestBody.order_id = params.orderId;
    }
    if (params.referenceId) {
      requestBody.reference_id = params.referenceId;
    }
    if (params.notifyUrl) {
      requestBody.notify_url = params.notifyUrl;
    }

    console.log(`[AfribaPay Payout] Request: country=${params.countryCode}, operator=${params.operator}, amount=${params.amount}, phone=${formattedPhone}`);

    const response = await fetch(`${baseUrl}/pay/payout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok || !data.data?.transaction_id) {
      console.error("[AfribaPay Payout] Error:", data);
      return {
        success: false,
        error: data.message || data.error || "Erreur lors de l'initiation du transfert",
      };
    }

    console.log(`[AfribaPay Payout] Success: transaction_id=${data.data.transaction_id}, status=${data.data.status}`);

    return {
      success: true,
      transactionId: data.data.transaction_id,
      orderId: data.data.order_id,
      status: data.data.status,
      amount: data.data.amount,
      fees: data.data.fees,
      message: "Transfert initie avec succes",
    };
  } catch (error) {
    console.error("[AfribaPay Payout] Exception:", error);
    return { success: false, error: "Erreur de connexion a AfribaPay" };
  }
}

export interface AfribaPayTransactionResult {
  success: boolean;
  transactionId?: string;
  orderId?: string;
  status?: string;
  amount?: number;
  currency?: string;
  operator?: string;
  country?: string;
  phone?: string;
  message?: string;
  error?: string;
}

export async function getAfribaPayTransaction(transactionId: string): Promise<AfribaPayTransactionResult> {
  try {
    const config = await getAfribaPayConfig();
    if (!config) {
      return { success: false, error: "AfribaPay non configure ou desactive" };
    }

    const token = await getAccessToken(config);
    if (!token) {
      return { success: false, error: "Impossible d'obtenir le token d'acces AfribaPay" };
    }

    const baseUrl = getBaseUrl(config.isLive);

    const response = await fetch(`${baseUrl}/transactions/${transactionId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok || !data.data) {
      console.error("[AfribaPay Transaction] Error:", data);
      return {
        success: false,
        error: data.message || data.error || "Transaction non trouvee",
      };
    }

    return {
      success: true,
      transactionId: data.data.transaction_id,
      orderId: data.data.order_id,
      status: data.data.status,
      amount: data.data.amount,
      currency: data.data.currency,
      operator: data.data.operator,
      country: data.data.country,
      phone: data.data.phone_number,
    };
  } catch (error) {
    console.error("[AfribaPay Transaction] Exception:", error);
    return { success: false, error: "Erreur de connexion a AfribaPay" };
  }
}

export async function verifyAfribaPayPayment(transactionId: string): Promise<{
  verified: boolean;
  status: string;
  amount?: number;
  currency?: string;
  error?: string;
}> {
  const result = await getAfribaPayTransaction(transactionId);
  
  if (!result.success) {
    return { verified: false, status: "unknown", error: result.error };
  }

  const isSuccess = result.status?.toUpperCase() === "SUCCESS";
  
  return {
    verified: isSuccess,
    status: result.status || "unknown",
    amount: result.amount,
    currency: result.currency,
  };
}

export function operatorRequiresOtp(countryCode: string, operator: string): boolean {
  return operatorRequiresOtpForCountry(countryCode, operator);
}

export function getOtpInstructions(countryCode: string, operator: string): string | null {
  const instructions = getPaymentInstructions(countryCode, operator);
  return instructions.otpInstructions || instructions.waveInstructions || instructions.generalInstructions;
}

export { getPaymentInstructions, getOtpInstructionsForOperator, getWaveInstructions } from "@shared/afribapay-countries";

export const AFRIBAPAY_STATUS_MAPPING: Record<string, string> = {
  PENDING: "pending",
  PROCESSING: "pending",
  SUCCESS: "completed",
  SUCCESSFUL: "completed",
  FAILED: "failed",
  CANCELLED: "failed",
  EXPIRED: "failed",
};

export function mapAfribaPayStatus(afribaPayStatus: string): string {
  return AFRIBAPAY_STATUS_MAPPING[afribaPayStatus?.toUpperCase()] || "pending";
}

export function translateAfribaPayError(rawError: string | undefined, context: "deposit" | "withdrawal" | "transfer" = "withdrawal"): string {
  if (!rawError) {
    const defaults: Record<string, string> = {
      deposit: "Le paiement a echoue. Veuillez reessayer.",
      withdrawal: "Le retrait a echoue. Veuillez reessayer.",
      transfer: "Le transfert a echoue. Veuillez reessayer.",
    };
    return defaults[context];
  }

  const err = rawError.toLowerCase();

  if (err.includes("insufficient") || err.includes("solde insuffisant") || err.includes("balance") || err.includes("fonds")) {
    return "Votre solde est insuffisant pour cette operation.";
  }
  if (err.includes("invalid phone") || err.includes("invalid number") || err.includes("numero invalide") || err.includes("phone_number") || err.includes("phone number")) {
    return "Le numero de telephone est incorrect ou non enregistre chez cet operateur.";
  }
  if (err.includes("limit") || err.includes("plafond") || err.includes("maximum") || err.includes("exceed")) {
    return "Le plafond de transaction de l'operateur a ete atteint. Veuillez reessayer avec un montant inferieur ou contacter le support.";
  }
  if (err.includes("timeout") || err.includes("time out") || err.includes("expired") || err.includes("expire")) {
    return "La session de paiement a expire. Veuillez reessayer.";
  }
  if (err.includes("unavailable") || err.includes("indisponible") || err.includes("service") || err.includes("maintenance") || err.includes("down")) {
    return "Le service est momentanement indisponible. Veuillez reessayer dans quelques minutes.";
  }
  if (err.includes("cancelled") || err.includes("annule") || err.includes("cancel")) {
    return "La transaction a ete annulee.";
  }
  if (err.includes("not found") || err.includes("not allowed") || err.includes("country") || err.includes("operator")) {
    return "Ce service n'est pas disponible pour ce pays ou cet operateur.";
  }
  if (err.includes("kyc") || err.includes("verif") || err.includes("identit")) {
    return "Votre identite n'a pas pu etre verifiee. Veuillez completer votre KYC.";
  }
  if (err.includes("duplicate") || err.includes("doublon") || err.includes("already")) {
    return "Une transaction similaire est deja en cours. Veuillez patienter avant de reessayer.";
  }
  if (err.includes("amount") || err.includes("montant") || err.includes("minimum") || err.includes("maximum")) {
    return "Le montant de la transaction est invalide. Verifiez les limites autorisees.";
  }
  if (err.includes("network") || err.includes("reseau") || err.includes("connexion") || err.includes("connection")) {
    return "Erreur de reseau. Veuillez verifier votre connexion et reessayer.";
  }

  // Generic fallback
  const fallbacks: Record<string, string> = {
    deposit: "Le paiement n'a pas abouti. Veuillez reessayer ou contacter le support si le probleme persiste.",
    withdrawal: "Le retrait n'a pas abouti. Votre solde n'a pas ete debite. Veuillez reessayer ou contacter le support.",
    transfer: "Le transfert n'a pas abouti. Votre solde n'a pas ete debite. Veuillez reessayer ou contacter le support.",
  };
  return fallbacks[context];
}

console.log("[AfribaPay] Module loaded - will use dynamic configuration from database");
