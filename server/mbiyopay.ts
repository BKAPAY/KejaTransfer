import { storage } from "./storage";

const MBIYOPAY_BASE_URL = "https://dashboard.mbiyo.africa/api/v1";
const MBIYOPAY_TIMEOUT_MS = 30000; // 30 seconds timeout for API calls

export const MBIYOPAY_SUPPORTED_COUNTRIES = ["bj", "bf", "ci", "sn", "tg", "ml", "gn", "cm", "cg", "cd", "gm"];

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
};

export const MBIYOPAY_OPERATORS: Record<string, string[]> = {
  bj: ["mtn", "moov", "celtiis"],
  bf: ["orange", "moov", "coris"],
  ci: ["orange", "mtn", "wave", "moov"],
  sn: ["orange", "free"],
  tg: ["moov", "togocom"],
  ml: ["orange", "moov"],
  gn: ["orange"],
  cm: ["orange", "moov"],
  cg: ["mtn"],
  cd: ["mpesa", "airtel", "orange", "afrimoney"],
  gm: ["afrimoney", "qmoney", "wave"],
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
  },
  cm: {
    orange: "orange",
    moov: "moov",
  },
  cg: {
    mtn: "mtn",
  },
  cd: {
    mpesa: "mpesa",
    airtel: "airtel",
    orange: "orange",
    afrimoney: "afrimoney",
  },
  gm: {
    afrimoney: "afrimoney",
    qmoney: "qmoney",
    wave: "wave",
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
  
  // Countries that KEEP the leading 0 (Benin and Ivory Coast changed their formats)
  // BJ: 01XXXXXXXX (10 digits, keep leading 0)
  // CI: 0XXXXXXXXX (10 digits, keep leading 0)
  const keepLeadingZero = ["bj", "ci"];
  
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
}

export interface MbiyoPayPayinResult {
  success: boolean;
  transactionId?: string;
  status?: string;
  redirectUrl?: string;
  message?: string;
  error?: string;
  fee?: number;
  chargedAmount?: number;
  instructions?: string; // Special instructions for Gambia networks
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
    
    // MbiyoPay documentation shows network in UPPERCASE in the example (e.g., "ORANGE")
    const requestBody = {
      amount: params.amount,
      currency: params.currency,
      payment_method: "mobile_money",
      order_id: params.orderId || `BKAPAY-${Date.now()}`,
      callback_url: params.callbackUrl || `${process.env.BASE_URL || "https://bkapay.com"}/api/webhooks/mbiyopay`,
      metadata: {
        network: apiOperatorCode.toUpperCase(),
        phone_number: formattedPhone,
        country_code: params.countryCode.toUpperCase(),
      },
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
    
    if (data.status === "success" && data.data) {
      console.log(`[MbiyoPay Payin] Payment created: ${data.data.transaction_id}`);
      // Capture instructions field for Gambia networks
      const result: MbiyoPayPayinResult = {
        success: true,
        transactionId: data.data.transaction_id,
        status: data.data.status,
        redirectUrl: data.data.redirect_url,
        message: data.message || "Paiement initie avec succes",
        fee: data.data.fee,
        chargedAmount: data.data.charged_amount,
      };
      // Add instructions for Gambia if present
      if (data.data.instructions) {
        result.instructions = data.data.instructions;
        console.log(`[MbiyoPay Payin] Instructions provided: ${data.data.instructions}`);
      }
      return result;
    }
    
    console.error("[MbiyoPay Payin] Error:", data);
    
    // Handle specific MbiyoPay error messages professionally
    let errorMessage = "Paiement echoue";
    const apiMessage = data.message?.toLowerCase() || "";
    
    if (apiMessage.includes("invalid") && apiMessage.includes("phone")) {
      errorMessage = "Paiement echoue: Numero de telephone invalide.";
    } else if (apiMessage.includes("network") || apiMessage.includes("operator")) {
      errorMessage = "Paiement echoue: Operateur non supporte pour ce pays.";
    } else if (apiMessage.includes("amount")) {
      errorMessage = "Paiement echoue: Montant invalide.";
    } else if (data.message) {
      errorMessage = `Paiement echoue: ${data.message}`;
    }
    
    return { 
      success: false, 
      error: errorMessage
    };
  } catch (error: any) {
    console.error("[MbiyoPay Payin] Exception:", error.name, error.message);
    if (error.name === "AbortError") {
      return { success: false, error: "Paiement echoue: Le service MbiyoPay ne repond pas. Veuillez reessayer dans quelques minutes." };
    }
    return { success: false, error: "Paiement echoue: Erreur de connexion au service de paiement." };
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
    
    // MbiyoPay documentation shows network in UPPERCASE
    const requestBody = {
      amount: params.amount,
      currency: params.currency,
      payment_method: "mobile_money",
      order_id: params.orderId || `BKAPAY-PAYOUT-${Date.now()}`,
      callback_url: params.callbackUrl || `${process.env.BASE_URL || "https://bkapay.com"}/api/webhooks/mbiyopay`,
      metadata: {
        network: apiOperatorCode.toUpperCase(),
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
    
    if (data.status === "success" && data.data) {
      console.log(`[MbiyoPay Payout] Payout created: ${data.data.transaction_id}`);
      return {
        success: true,
        transactionId: data.data.transaction_id,
        status: data.data.status,
        message: data.message || "Retrait initie avec succes",
        fee: data.data.fee,
        chargedAmount: data.data.charged_amount,
      };
    }
    
    console.error("[MbiyoPay Payout] Error:", data);
    
    // Handle specific MbiyoPay error messages professionally
    let errorMessage = "Retrait echoue";
    const apiMessage = data.message?.toLowerCase() || "";
    
    if (apiMessage.includes("insufficient balance") || apiMessage.includes("balance")) {
      errorMessage = "Retrait echoue: Insuffisance de solde dans le wallet de paiement. Veuillez reessayer plus tard.";
    } else if (apiMessage.includes("kyc")) {
      errorMessage = "Retrait echoue: Verification KYC requise par le fournisseur.";
    } else if (apiMessage.includes("invalid") && apiMessage.includes("phone")) {
      errorMessage = "Retrait echoue: Numero de telephone invalide.";
    } else if (apiMessage.includes("network") || apiMessage.includes("operator")) {
      errorMessage = "Retrait echoue: Operateur non supporte pour ce pays.";
    } else if (data.message) {
      errorMessage = `Retrait echoue: ${data.message}`;
    }
    
    return { 
      success: false, 
      error: errorMessage 
    };
  } catch (error: any) {
    console.error("[MbiyoPay Payout] Exception:", error.name, error.message);
    if (error.name === "AbortError") {
      return { success: false, error: "Retrait echoue: Le service MbiyoPay ne repond pas. Veuillez reessayer dans quelques minutes." };
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
    
    if (data.status === "success" && data.data) {
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
      error: data.message || "Transaction non trouvee" 
    };
  } catch (error: any) {
    console.error("[MbiyoPay Status] Exception:", error);
    return { success: false, error: error.message || "Erreur de connexion" };
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
