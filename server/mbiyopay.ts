import { storage } from "./storage";

const MBIYOPAY_BASE_URL = "https://dashboard.mbiyo.africa/api/v1";
const MBIYOPAY_TIMEOUT_MS = 30000; // 30 seconds timeout for API calls

// Helper to safely extract message string from MbiyoPay API responses
// MbiyoPay sometimes returns message as a string, sometimes as an array
function extractMessage(msg: any): string {
  if (!msg) return "";
  if (typeof msg === "string") return msg;
  if (Array.isArray(msg)) return msg.join(", ");
  return String(msg);
}

export const MBIYOPAY_SUPPORTED_COUNTRIES = ["bj", "bf", "ci", "sn", "tg", "ml", "gn", "cm", "cg", "cd", "gm", "ga"];

export const MBIYOPAY_COUNTRY_CURRENCIES: Record<string, string> = {
  bj: "XOF",
  bf: "XOF",
  ci: "XOF",
  sn: "XOF",
  tg: "XOF",
  ml: "XOF",
  gn: "GNF",
  cm: "XAF",
  cg: "XAF",
  cd: "CDF",
  gm: "GMD",
  ga: "XAF",
};

export const MBIYOPAY_OPERATORS: Record<string, string[]> = {
  bj: ["mtn", "moov", "celtiis"],
  bf: ["orange", "moov", "coris"],
  ci: ["orange", "mtn", "wave", "moov"],
  sn: ["orange", "free"],
  tg: ["moov", "togocom"],
  ml: ["orange", "moov"],
  gn: ["orange", "mtn"],
  cm: ["orange", "mtn"],
  cg: ["mtn"],
  cd: ["vodacom", "airtel", "orange", "africell"],
  gm: ["afrimoney", "qmoney", "wave", "aps"],
  ga: ["moov", "airtel"],
};

export const COUNTRY_PHONE_PREFIXES: Record<string, string> = {
  bj: "+229",
  bf: "+226",
  ci: "+225",
  sn: "+221",
  tg: "+228",
  ml: "+223",
  gn: "+224",
  cm: "+237",
  cg: "+242",
  cd: "+243",
  gm: "+220",
  ga: "+241",
};

// Map internal operator codes to MbiyoPay API codes
// Names match the official MbiyoPay documentation exactly
export const MBIYOPAY_OPERATOR_API_CODES: Record<string, Record<string, string>> = {
  tg: {
    togocom: "togocom",
    moov: "moov",
  },
  bj: {
    mtn: "mtn",
    moov: "moov",
    celtiis: "celtiis",
  },
  bf: {
    orange: "orange",
    moov: "moov",
    coris: "coris",
  },
  ci: {
    orange: "orange",
    mtn: "mtn",
    wave: "wave",
    moov: "moov",
  },
  sn: {
    orange: "orange",
    free: "free",
  },
  ml: {
    orange: "orange",
    moov: "moov",
  },
  gn: {
    orange: "orange",
    mtn: "mtn",
  },
  cm: {
    orange: "orange",
    mtn: "mtn",
  },
  cg: {
    mtn: "mtn",
  },
  cd: {
    vodacom: "vodacom",
    airtel: "airtel",
    orange: "orange",
    africell: "africell",
  },
  gm: {
    afrimoney: "afrimoney",
    qmoney: "qmoney",
    wave: "wave",
    aps: "aps",
  },
  ga: {
    moov: "moov",
    airtel: "airtel",
  },
};

// Get the MbiyoPay API code for an operator
export function getMbiyoPayOperatorCode(countryCode: string, operatorCode: string): string {
  const countryLower = countryCode.toLowerCase();
  const operatorLower = operatorCode.toLowerCase();
  const countryMappings = MBIYOPAY_OPERATOR_API_CODES[countryLower];
  if (countryMappings && countryMappings[operatorLower]) {
    return countryMappings[operatorLower];
  }
  // Default: return the operator code as-is
  return operatorLower;
}

async function getMbiyoPayApiKey(): Promise<string | null> {
  try {
    const config = await storage.getProviderConfig("mbiyopay");
    if (!config?.isActive || !config?.apiKey) {
      return null;
    }
    return config.apiKey;
  } catch (error) {
    console.error("[MbiyoPay] Error getting API key:", error);
    return null;
  }
}

export function formatPhoneForMbiyoPay(phone: string, countryCode: string): string {
  // Remove all non-numeric characters (including +)
  let sanitized = phone.replace(/\s+/g, "").replace(/[^0-9]/g, "");
  
  const prefix = COUNTRY_PHONE_PREFIXES[countryCode.toLowerCase()];
  const prefixDigits = prefix ? prefix.replace("+", "") : "";
  const countryLower = countryCode.toLowerCase();
  
  // If phone already starts with country prefix digits, add + and return
  if (prefixDigits && sanitized.startsWith(prefixDigits)) {
    return "+" + sanitized;
  }
  
  // Countries that KEEP the leading 0 in international format
  // BJ: 01XXXXXXXX (10 digits, keep leading 0)
  // CI: 0XXXXXXXXX (10 digits, keep leading 0)
  // CG: 0XXXXXXXX (9 digits, keep leading 0 - MTN Congo Brazzaville)
  const keepLeadingZero = ["bj", "ci", "cg", "ga"];
  
  // Remove leading 0 ONLY for countries that don't keep it
  if (sanitized.startsWith("0") && !keepLeadingZero.includes(countryLower)) {
    sanitized = sanitized.substring(1);
  }
  
  // Return with country prefix (WITH the + as per MbiyoPay docs)
  // Example: +22901234567 for Benin, +2250123456789 for Ivory Coast
  return prefix + sanitized;
}

export interface MbiyoPayPayinParams {
  amount: number;
  currency: string;
  phone: string;
  countryCode: string;
  network: string;
  orderId?: string;
  callbackUrl?: string;
  otpCode?: string;
}

export function mbiyoPayOperatorRequiresOtp(countryCode: string, network: string): boolean {
  const country = countryCode.toLowerCase();
  const op = network.toLowerCase();
  if (op !== "orange") return false;
  if (country === "cd") return false;
  const countriesWithOrangeOtp = ["ci", "sn", "ml", "gn", "bf"];
  return countriesWithOrangeOtp.includes(country);
}

export function getMbiyoPayOtpInstructions(countryCode: string): { ussdCode: string; instructions: string; hint: string } {
  const country = countryCode.toUpperCase();
  const codes: Record<string, { ussdCode: string; instructions: string; hint: string }> = {
    SN: {
      ussdCode: "#144#391#",
      instructions: "Composez #144#391# puis entrez votre code secret Orange Money pour obtenir votre code de paiement",
      hint: "Entrez votre code secret Orange Money quand demande",
    },
    CI: {
      ussdCode: "#144*82#",
      instructions: "Composez #144*82# puis choisissez l'option 2 pour generer votre code de paiement",
      hint: "Selectionnez l'option 2 dans le menu",
    },
    BF: {
      ussdCode: "*144*4*6*100#",
      instructions: "Composez *144*4*6*100# puis suivez les instructions pour obtenir votre code de paiement",
      hint: "Entrez votre code secret Orange Money quand demande",
    },
    ML: {
      ussdCode: "#144#77#",
      instructions: "Composez #144#77# puis suivez les instructions pour obtenir votre code de paiement",
      hint: "Entrez votre code secret Orange Money quand demande",
    },
    GN: {
      ussdCode: "#144#",
      instructions: "Composez #144# puis selectionnez l'option 4 puis 2 pour obtenir votre code de paiement",
      hint: "Selectionnez l'option 4 puis l'option 2 dans le menu",
    },
    CM: {
      ussdCode: "#150*50#",
      instructions: "Composez #150*50# puis suivez les instructions pour obtenir votre code de paiement",
      hint: "Entrez votre code secret Orange Money quand demande",
    },
  };
  return codes[country] || {
    ussdCode: "#144#",
    instructions: "Composez #144# sur votre telephone Orange pour obtenir votre code de paiement",
    hint: "Suivez les instructions pour obtenir votre code",
  };
}

export interface MbiyoPayPayinResult {
  success: boolean;
  pending?: boolean;
  transactionId?: string;
  status?: string;
  redirectUrl?: string;
  message?: string;
  error?: string;
  fee?: number;
  chargedAmount?: number;
  instructions?: string;
  authMode?: string | null;
}

export async function createMbiyoPayPayin(params: MbiyoPayPayinParams): Promise<MbiyoPayPayinResult> {
  try {
    const apiKey = await getMbiyoPayApiKey();
    if (!apiKey) {
      return { success: false, error: "MbiyoPay non configure ou desactive" };
    }
    
    const countryLower = params.countryCode.toLowerCase();
    if (!MBIYOPAY_SUPPORTED_COUNTRIES.includes(countryLower)) {
      return { success: false, error: `Pays non supporte: ${params.countryCode}` };
    }
    
    const countryOperators = MBIYOPAY_OPERATORS[countryLower] || [];
    if (!countryOperators.includes(params.network.toLowerCase())) {
      return { success: false, error: `Operateur ${params.network} non supporte pour ${params.countryCode}` };
    }
    
    const formattedPhone = formatPhoneForMbiyoPay(params.phone, params.countryCode);
    
    // Get the correct API code for this operator (e.g., togocom -> tmoney)
    const apiOperatorCode = getMbiyoPayOperatorCode(params.countryCode, params.network);
    
    console.log(`[MbiyoPay Payin] Phone formatting: input="${params.phone}" -> output="${formattedPhone}" (country=${params.countryCode})`);
    console.log(`[MbiyoPay Payin] Operator mapping: ${params.network} -> ${apiOperatorCode}`);
    
    // MbiyoPay API docs specify network in lowercase (e.g., "orange", "moov", "mtn")
    const metadata: Record<string, string> = {
      network: apiOperatorCode.toLowerCase(),
      phone_number: formattedPhone,
      country_code: params.countryCode.toUpperCase(),
    };
    
    if (params.otpCode) {
      metadata.om_otp = params.otpCode;
      console.log(`[MbiyoPay Payin] Including OTP code in request (om_otp)`);
    }
    
    const requestBody = {
      amount: params.amount,
      currency: params.currency,
      payment_method: "mobile_money",
      order_id: params.orderId || `BKAPAY-${Date.now()}`,
      callback_url: params.callbackUrl || `${process.env.BASE_URL || "https://bkapay.com"}/api/webhooks/mbiyopay`,
      metadata,
    };
    
    console.log(`[MbiyoPay Payin] Creating payment: ${params.amount} ${params.currency}, ${params.network}/${params.countryCode}, phone=${formattedPhone}`);
    console.log(`[MbiyoPay Payin] Full request body:`, JSON.stringify(requestBody, null, 2));
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MBIYOPAY_TIMEOUT_MS);
    
    let response: Response;
    try {
      response = await fetch(`${MBIYOPAY_BASE_URL}/merchant/payin`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    
    const data = await response.json();
    
    const apiMessage = extractMessage(data.message);
    console.log(`[MbiyoPay Payin] Response: status=${data.status}, message="${apiMessage}", hasData=${!!data.data}`);
    if (data.data) {
      console.log(`[MbiyoPay Payin] Response data: transaction_id=${data.data.transaction_id}, status=${data.data.status}, redirect_url=${data.data.redirect_url || "NONE"}, fee=${data.data.fee}, instructions=${data.data.instructions || "NONE"}`);
    }

    // Success case: status is "success" and data contains transaction info
    if (data.status === "success" && data.data) {
      console.log(`[MbiyoPay Payin] Payment created: ${data.data.transaction_id}, redirectUrl=${data.data.redirect_url || "NONE"}, authMode=${data.data.auth_mode || "null"}`);
      const result: MbiyoPayPayinResult = {
        success: true,
        transactionId: data.data.transaction_id,
        status: data.data.status,
        redirectUrl: data.data.redirect_url,
        message: apiMessage || "Paiement initie avec succes",
        fee: data.data.fee,
        chargedAmount: data.data.charged_amount,
        authMode: data.data.auth_mode ?? null,
      };
      if (data.data.instructions) {
        result.instructions = data.data.instructions;
        console.log(`[MbiyoPay Payin] Instructions provided (auth_mode=${data.data.auth_mode})`);
      }
      return result;
    }

    // Some MbiyoPay responses have status != "success" but message contains "Success"
    // and data contains transaction info - handle this edge case
    if (data.data && data.data.transaction_id) {
      console.log(`[MbiyoPay Payin] Non-standard success: status=${data.status}, but data present with transaction_id=${data.data.transaction_id}, authMode=${data.data.auth_mode || "null"}`);
      return {
        success: true,
        transactionId: data.data.transaction_id,
        status: data.data.status,
        redirectUrl: data.data.redirect_url,
        message: apiMessage || "Paiement initie avec succes",
        fee: data.data.fee,
        chargedAmount: data.data.charged_amount,
        authMode: data.data.auth_mode ?? null,
      };
    }

    // CRITICAL: MbiyoPay sometimes returns status="failed" with message="Success" and data=null
    // This happens when the payment was actually initiated but the API response is contradictory
    // In this case, keep transaction as pending and let webhook/polling confirm the real status
    if (apiMessage.toLowerCase().includes("success") && (!data.data || data.data === null)) {
      console.log(`[MbiyoPay Payin] Ambiguous response: status=${data.status} but message="${apiMessage}" with no data - treating as PENDING (waiting for webhook)`);
      return {
        success: true,
        pending: true,
        message: "Paiement en cours de traitement. Veuillez patienter.",
      };
    }
    
    console.error("[MbiyoPay Payin] Error:", JSON.stringify(data));
    
    let errorMessage = "Paiement echoue";
    const msgLower = apiMessage.toLowerCase();
    
    if (msgLower.includes("invalid") && msgLower.includes("phone")) {
      errorMessage = "Paiement echoue: Numero de telephone invalide.";
    } else if (msgLower.includes("network") || msgLower.includes("operator")) {
      errorMessage = "Paiement echoue: Operateur non supporte pour ce pays.";
    } else if (msgLower.includes("amount")) {
      errorMessage = "Paiement echoue: Montant invalide.";
    } else {
      errorMessage = "Paiement echoue: Veuillez reessayer dans quelques minutes.";
    }
    
    return { 
      success: false, 
      error: errorMessage
    };
  } catch (error: any) {
    console.error("[MbiyoPay Payin] Exception:", error.name, error.message);
    if (error.name === "AbortError") {
      return { success: false, error: "Paiement echoue: Le service de paiement ne repond pas. Veuillez reessayer dans quelques minutes." };
    }
    return { success: false, error: "Paiement echoue: Erreur de connexion au service de paiement." };
  }
}

export interface MbiyoPayFinalizeResult {
  success: boolean;
  message?: string;
  error?: string;
}

export async function finalizeMbiyoPayPayin(transactionId: string, otp: string): Promise<MbiyoPayFinalizeResult> {
  try {
    const apiKey = await getMbiyoPayApiKey();
    if (!apiKey) {
      return { success: false, error: "MbiyoPay non configure ou desactive" };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MBIYOPAY_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${MBIYOPAY_BASE_URL}/merchant/transactions/${transactionId}/finalize`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ otp }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const data = await response.json();
    const apiMessage = extractMessage(data.message);
    console.log(`[MbiyoPay Finalize] Response: status=${data.status}, message="${apiMessage}"`);

    if (data.status === "success") {
      return { success: true, message: apiMessage || "Paiement finalise avec succes. En attente de confirmation." };
    }

    return { success: false, error: apiMessage || "Code invalide. Veuillez reessayer." };
  } catch (error: any) {
    console.error("[MbiyoPay Finalize] Exception:", error.name, error.message);
    if (error.name === "AbortError") {
      return { success: false, error: "Le service de paiement ne repond pas. Veuillez reessayer." };
    }
    return { success: false, error: "Erreur de connexion au service de paiement." };
  }
}

export interface MbiyoPayPayoutParams {
  amount: number;
  currency: string;
  phone: string;
  countryCode: string;
  network: string;
  orderId?: string;
  callbackUrl?: string;
  beneficiaryName?: string;
}

export interface MbiyoPayPayoutResult {
  success: boolean;
  pending?: boolean;
  transactionId?: string;
  status?: string;
  message?: string;
  error?: string;
  fee?: number;
  chargedAmount?: number;
}

export async function createMbiyoPayPayout(params: MbiyoPayPayoutParams): Promise<MbiyoPayPayoutResult> {
  try {
    const apiKey = await getMbiyoPayApiKey();
    if (!apiKey) {
      return { success: false, error: "MbiyoPay non configure ou desactive" };
    }
    
    const countryLower = params.countryCode.toLowerCase();
    if (!MBIYOPAY_SUPPORTED_COUNTRIES.includes(countryLower)) {
      return { success: false, error: `Pays non supporte: ${params.countryCode}` };
    }
    
    const formattedPhone = formatPhoneForMbiyoPay(params.phone, params.countryCode);
    
    // Get the correct API code for this operator (e.g., togocom -> tmoney)
    const apiOperatorCode = getMbiyoPayOperatorCode(params.countryCode, params.network);
    
    console.log(`[MbiyoPay Payout] Phone formatting: input="${params.phone}" -> output="${formattedPhone}" (country=${params.countryCode})`);
    console.log(`[MbiyoPay Payout] Operator mapping: ${params.network} -> ${apiOperatorCode}`);
    
    // MbiyoPay payout documentation shows network in lowercase (e.g., "orange", "moov", "mtn")
    const requestBody = {
      amount: params.amount,
      currency: params.currency,
      payment_method: "mobile_money",
      order_id: params.orderId || `BKAPAY-PAYOUT-${Date.now()}`,
      callback_url: params.callbackUrl || `${process.env.BASE_URL || "https://bkapay.com"}/api/webhooks/mbiyopay`,
      metadata: {
        network: apiOperatorCode.toLowerCase(),
        phone_number: formattedPhone,
        country_code: params.countryCode.toUpperCase(),
        beneficiary: params.beneficiaryName || "BKApay User",
      },
    };
    
    console.log(`[MbiyoPay Payout] Creating payout: ${params.amount} ${params.currency}, ${params.network}/${params.countryCode}, phone=${formattedPhone}`);
    console.log(`[MbiyoPay Payout] Full request body:`, JSON.stringify(requestBody, null, 2));
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MBIYOPAY_TIMEOUT_MS);
    
    let response: Response;
    try {
      response = await fetch(`${MBIYOPAY_BASE_URL}/merchant/payout`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    
    const data = await response.json();
    
    const apiMessage = extractMessage(data.message);
    console.log(`[MbiyoPay Payout] HTTP ${response.status} Response: status=${data.status}, message="${apiMessage}", hasData=${!!data.data}`);
    
    // Log specific HTTP error codes for debugging
    if (response.status === 403) {
      console.error(`[MbiyoPay Payout] HTTP 403 Forbidden - Likely KYC not approved for payouts on merchant account`);
      return { success: false, error: "Retrait echoue: Service temporairement indisponible." };
    }
    if (response.status === 401) {
      console.error(`[MbiyoPay Payout] HTTP 401 Unauthorized - API key invalid or expired`);
      return { success: false, error: "Retrait echoue: Service temporairement indisponible." };
    }
    if (response.status >= 500) {
      console.error(`[MbiyoPay Payout] HTTP ${response.status} Server Error - MbiyoPay service issue`);
      return { success: false, error: "Retrait echoue: Service temporairement indisponible. Reessayez dans quelques minutes." };
    }

    if (data.status === "success" && data.data) {
      console.log(`[MbiyoPay Payout] Payout created: ${data.data.transaction_id}`);
      return {
        success: true,
        transactionId: data.data.transaction_id,
        status: data.data.status,
        message: apiMessage || "Retrait initie avec succes",
        fee: data.data.fee,
        chargedAmount: data.data.charged_amount,
      };
    }

    if (data.data && data.data.transaction_id) {
      console.log(`[MbiyoPay Payout] Non-standard success: status=${data.status}, but data present with transaction_id=${data.data.transaction_id}`);
      return {
        success: true,
        transactionId: data.data.transaction_id,
        status: data.data.status,
        message: apiMessage || "Retrait initie avec succes",
        fee: data.data.fee,
        chargedAmount: data.data.charged_amount,
      };
    }

    // CRITICAL: MbiyoPay sometimes returns status="failed" with message="Success" and data=null
    // Keep transaction as pending and let webhook/polling confirm the real status
    if (apiMessage.toLowerCase().includes("success") && (!data.data || data.data === null)) {
      console.log(`[MbiyoPay Payout] Ambiguous response: status=${data.status} but message="${apiMessage}" with no data - treating as PENDING (waiting for webhook)`);
      return {
        success: true,
        pending: true,
        message: "Operation en cours de traitement. Veuillez patienter.",
      };
    }
    
    console.error("[MbiyoPay Payout] Error:", JSON.stringify(data));
    
    let errorMessage = "Retrait echoue";
    const msgLower = apiMessage.toLowerCase();
    
    if (msgLower.includes("insufficient balance") || msgLower.includes("balance") || msgLower.includes("wallet")) {
      errorMessage = "Retrait echoue: Service temporairement indisponible. Veuillez reessayer plus tard.";
    } else if (msgLower.includes("kyc")) {
      errorMessage = "Retrait echoue: Service temporairement indisponible.";
    } else if (msgLower.includes("invalid") && msgLower.includes("phone")) {
      errorMessage = "Retrait echoue: Numero de telephone invalide.";
    } else if (msgLower.includes("network") || msgLower.includes("operator")) {
      errorMessage = "Retrait echoue: Operateur non supporte pour ce pays.";
    } else if (msgLower.includes("transaction initiation failed")) {
      errorMessage = "Retrait echoue: Le service de retrait est temporairement indisponible. Veuillez reessayer plus tard.";
    } else {
      errorMessage = "Retrait echoue: Veuillez reessayer dans quelques minutes.";
    }
    
    return { 
      success: false, 
      error: errorMessage 
    };
  } catch (error: any) {
    console.error("[MbiyoPay Payout] Exception:", error.name, error.message);
    if (error.name === "AbortError") {
      return { success: false, error: "Retrait echoue: Le service de paiement ne repond pas. Veuillez reessayer dans quelques minutes." };
    }
    return { success: false, error: "Retrait echoue: Erreur de connexion au service de paiement." };
  }
}

export interface MbiyoPayStatusResult {
  success: boolean;
  transactionId?: string;
  status?: string;
  amount?: number;
  fee?: number;
  currency?: string;
  error?: string;
}

export async function getMbiyoPayTransactionStatus(transactionId: string): Promise<MbiyoPayStatusResult> {
  try {
    const apiKey = await getMbiyoPayApiKey();
    if (!apiKey) {
      return { success: false, error: "MbiyoPay non configure ou desactive" };
    }
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MBIYOPAY_TIMEOUT_MS);
    
    let response: Response;
    try {
      response = await fetch(`${MBIYOPAY_BASE_URL}/merchant/transactions/${transactionId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    
    const data = await response.json();
    
    const statusMessage = extractMessage(data.message);
    console.log(`[MbiyoPay Status] Response: status=${data.status}, message="${statusMessage}", hasData=${!!data.data}`);

    if (data.data) {
      return {
        success: true,
        transactionId: data.data.transaction_id,
        status: data.data.status,
        amount: data.data.amount,
        fee: data.data.fee,
        currency: data.data.currency,
      };
    }
    
    return { 
      success: false, 
      error: statusMessage || "Transaction non trouvee" 
    };
  } catch (error: any) {
    console.error("[MbiyoPay Status] Exception:", error);
    return { success: false, error: error.message || "Erreur de connexion" };
  }
}

export async function checkMbiyoPayMerchantStatus(): Promise<{
  success: boolean;
  balance?: number;
  currency?: string;
  kycStatus?: string;
  payoutEnabled?: boolean;
  error?: string;
  rawResponse?: any;
}> {
  try {
    const apiKey = await getMbiyoPayApiKey();
    if (!apiKey) {
      return { success: false, error: "MbiyoPay non configure ou desactive" };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MBIYOPAY_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${MBIYOPAY_BASE_URL}/merchant/balance`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const data = await response.json();
    console.log(`[MbiyoPay Diagnostic] HTTP ${response.status} Balance check:`, JSON.stringify(data));

    return {
      success: response.status === 200,
      balance: data.data?.balance || data.balance,
      currency: data.data?.currency || data.currency,
      kycStatus: data.data?.kyc_status || data.kyc_status,
      payoutEnabled: data.data?.payout_enabled || data.payout_enabled,
      rawResponse: data,
    };
  } catch (error: any) {
    console.error("[MbiyoPay Diagnostic] Error:", error.message);
    return { success: false, error: error.message };
  }
}

export function isCountrySupported(countryCode: string): boolean {
  return MBIYOPAY_SUPPORTED_COUNTRIES.includes(countryCode.toLowerCase());
}

export function getOperatorsForCountry(countryCode: string): string[] {
  return MBIYOPAY_OPERATORS[countryCode.toLowerCase()] || [];
}

export function getCurrencyForCountry(countryCode: string): string {
  return MBIYOPAY_COUNTRY_CURRENCIES[countryCode.toLowerCase()] || "XOF";
}

// Search for a transaction by order_id on MbiyoPay API
// Used when we don't have a mbiyopayTransactionId (ambiguous response with data=null)
export async function searchMbiyoPayTransactionByOrderId(orderId: string): Promise<MbiyoPayStatusResult> {
  try {
    const apiKey = await getMbiyoPayApiKey();
    if (!apiKey) {
      return { success: false, error: "MbiyoPay non configure ou desactive" };
    }
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MBIYOPAY_TIMEOUT_MS);
    
    // Try the transactions list endpoint with order_id filter
    let response: Response;
    try {
      response = await fetch(`${MBIYOPAY_BASE_URL}/merchant/transactions?order_id=${encodeURIComponent(orderId)}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    
    const data = await response.json();
    console.log(`[MbiyoPay Search] order_id=${orderId}, response status=${response.status}, apiStatus=${data.status}, hasData=${!!data.data}`);
    
    // Handle array response (list of transactions)
    if (data.data && Array.isArray(data.data) && data.data.length > 0) {
      const tx = data.data[0];
      console.log(`[MbiyoPay Search] Found transaction: id=${tx.transaction_id}, status=${tx.status}`);
      return {
        success: true,
        transactionId: tx.transaction_id,
        status: tx.status,
        amount: tx.amount,
        fee: tx.fee,
        currency: tx.currency,
      };
    }
    
    // Handle single object response
    if (data.data && data.data.transaction_id) {
      console.log(`[MbiyoPay Search] Found transaction: id=${data.data.transaction_id}, status=${data.data.status}`);
      return {
        success: true,
        transactionId: data.data.transaction_id,
        status: data.data.status,
        amount: data.data.amount,
        fee: data.data.fee,
        currency: data.data.currency,
      };
    }
    
    console.log(`[MbiyoPay Search] No transaction found for order_id=${orderId}`);
    return { success: false, error: "Transaction non trouvee par order_id" };
  } catch (error: any) {
    console.error(`[MbiyoPay Search] Error searching by order_id=${orderId}:`, error.message);
    return { success: false, error: error.message || "Erreur de recherche" };
  }
}

// Resend webhook notification for a specific transaction
export async function resendMbiyoPayWebhook(transactionId: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const apiKey = await getMbiyoPayApiKey();
    if (!apiKey) {
      return { success: false, error: "MbiyoPay non configure ou desactive" };
    }
    
    console.log(`[MbiyoPay] Resending webhook for transaction: ${transactionId}`);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MBIYOPAY_TIMEOUT_MS);
    
    let response: Response;
    try {
      response = await fetch(`${MBIYOPAY_BASE_URL}/merchant/transactions/${transactionId}/resend-webhook`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    
    const data = await response.json();
    
    if (data.status === "success") {
      console.log(`[MbiyoPay] Webhook resent successfully for: ${transactionId}`);
      return {
        success: true,
        message: data.message || "Webhook renvoye avec succes",
      };
    }
    
    console.error("[MbiyoPay] Resend webhook error:", data);
    return { 
      success: false, 
      error: data.message || "Impossible de renvoyer le webhook" 
    };
  } catch (error: any) {
    console.error("[MbiyoPay] Resend webhook exception:", error);
    return { success: false, error: "Erreur de connexion au service de paiement." };
  }
}
