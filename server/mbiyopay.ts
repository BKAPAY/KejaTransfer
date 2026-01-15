import { storage } from "./storage";

const MBIYOPAY_BASE_URL = "https://dashboard.mbiyo.africa/api/v1";

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
  cd: "USD",
  gm: "GMD",
};

export const MBIYOPAY_OPERATORS: Record<string, string[]> = {
  bj: ["mtn", "moov", "celtiis"],
  bf: ["orange", "moov", "coris"],
  ci: ["orange", "mtn", "wave", "moov"],
  sn: ["orange", "free"],
  tg: ["moov", "togocom"],
  ml: ["orange", "moov"],
  gn: ["orange", "mtn"],
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
  
  // If phone already starts with country prefix digits, return as-is (without +)
  if (prefixDigits && sanitized.startsWith(prefixDigits)) {
    return sanitized;
  }
  
  // Countries that KEEP the leading 0 (Benin and Ivory Coast changed their formats)
  // BJ: 01XXXXXXXX (10 digits, keep leading 0)
  // CI: 0XXXXXXXXX (10 digits, keep leading 0)
  const keepLeadingZero = ["bj", "ci"];
  
  // Remove leading 0 ONLY for countries that don't keep it
  if (sanitized.startsWith("0") && !keepLeadingZero.includes(countryLower)) {
    sanitized = sanitized.substring(1);
  }
  
  // Return with country prefix (WITHOUT the +)
  // Example: 22901234567 for Benin, 2250123456789 for Ivory Coast
  return prefixDigits + sanitized;
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
    
    console.log(`[MbiyoPay Payin] Phone formatting: input="${params.phone}" -> output="${formattedPhone}" (country=${params.countryCode})`);
    
    const requestBody = {
      amount: params.amount,
      currency: params.currency,
      payment_method: "mobile_money",
      order_id: params.orderId || `BKAPAY-${Date.now()}`,
      callback_url: params.callbackUrl || `${process.env.BASE_URL || "https://bkapay.com"}/api/webhooks/mbiyopay`,
      metadata: {
        network: params.network.toUpperCase(),
        phone_number: formattedPhone,
        country_code: params.countryCode.toUpperCase(),
      },
    };
    
    console.log(`[MbiyoPay Payin] Creating payment: ${params.amount} ${params.currency}, ${params.network}/${params.countryCode}, phone=${formattedPhone}`);
    
    const response = await fetch(`${MBIYOPAY_BASE_URL}/merchant/payin`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
    
    const data = await response.json();
    
    if (data.status === "success" && data.data) {
      console.log(`[MbiyoPay Payin] Payment created: ${data.data.transaction_id}`);
      return {
        success: true,
        transactionId: data.data.transaction_id,
        status: data.data.status,
        redirectUrl: data.data.redirect_url,
        message: data.message || "Paiement initie avec succes",
        fee: data.data.fee,
        chargedAmount: data.data.charged_amount,
      };
    }
    
    console.error("[MbiyoPay Payin] Error:", data);
    return { 
      success: false, 
      error: data.message || "Erreur lors de l'initiation du paiement" 
    };
  } catch (error: any) {
    console.error("[MbiyoPay Payin] Exception:", error);
    return { success: false, error: error.message || "Erreur de connexion" };
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
    
    console.log(`[MbiyoPay Payout] Phone formatting: input="${params.phone}" -> output="${formattedPhone}" (country=${params.countryCode})`);
    
    const requestBody = {
      amount: params.amount,
      currency: params.currency,
      payment_method: "mobile_money",
      order_id: params.orderId || `BKAPAY-PAYOUT-${Date.now()}`,
      callback_url: params.callbackUrl || `${process.env.BASE_URL || "https://bkapay.com"}/api/webhooks/mbiyopay`,
      metadata: {
        network: params.network.toLowerCase(),
        phone_number: formattedPhone,
        country_code: params.countryCode.toUpperCase(),
      },
    };
    
    console.log(`[MbiyoPay Payout] Creating payout: ${params.amount} ${params.currency}, ${params.network}/${params.countryCode}, phone=${formattedPhone}`);
    
    const response = await fetch(`${MBIYOPAY_BASE_URL}/merchant/payout`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
    
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
    return { 
      success: false, 
      error: data.message || "Erreur lors du retrait" 
    };
  } catch (error: any) {
    console.error("[MbiyoPay Payout] Exception:", error);
    return { success: false, error: error.message || "Erreur de connexion" };
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
    
    const response = await fetch(`${MBIYOPAY_BASE_URL}/merchant/transactions/${transactionId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });
    
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
