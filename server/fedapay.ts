import { FedaPay, Transaction, Payout } from "fedapay";

if (!process.env.FEDAPAY_SECRET_KEY) {
  console.error("ERREUR: FEDAPAY_SECRET_KEY doit etre configure dans les variables d'environnement");
}

const isLiveKey = process.env.FEDAPAY_SECRET_KEY?.startsWith("sk_live_");
FedaPay.setApiKey(process.env.FEDAPAY_SECRET_KEY || "");
FedaPay.setEnvironment(isLiveKey ? "live" : "sandbox");

console.log(`[FedaPay] Initialized in ${isLiveKey ? "PRODUCTION" : "SANDBOX"} mode`);

export interface FedaPayOperator {
  code: string;
  name: string;
  countries: string[];
}

export const FEDAPAY_COLLECT_OPERATORS: Record<string, FedaPayOperator> = {
  mtn_bj: { code: "mtn_open", name: "MTN", countries: ["bj"] },
  moov_bj: { code: "moov", name: "Moov", countries: ["bj"] },
  celtiis_bj: { code: "celtiis", name: "Celtiis", countries: ["bj"] },
  moov_tg: { code: "moov_tg", name: "Moov", countries: ["tg"] },
  togocom_tg: { code: "togocel", name: "TogoCom", countries: ["tg"] },
  mtn_ci: { code: "mtn_ci", name: "MTN", countries: ["ci"] },
  free_sn: { code: "free_sn", name: "Free Senegal", countries: ["sn"] },
  mtn_gn: { code: "mtn_open_gn", name: "MTN Guinea", countries: ["gn"] },
  airtel_ne: { code: "airtel_ne", name: "Airtel Niger", countries: ["ne"] },
};

export const FEDAPAY_PAYOUT_OPERATORS: Record<string, FedaPayOperator> = {
  mtn_bj: { code: "mtn_open", name: "MTN", countries: ["bj"] },
  moov_bj: { code: "moov", name: "Moov", countries: ["bj"] },
  celtiis_bj: { code: "sbin", name: "Celtiis", countries: ["bj"] },
  moov_tg: { code: "moov_tg", name: "Moov", countries: ["tg"] },
  togocom_tg: { code: "togocel", name: "TogoCom", countries: ["tg"] },
  mtn_ci: { code: "mtn_ci", name: "MTN", countries: ["ci"] },
  moov_ci: { code: "moov_ci", name: "Moov", countries: ["ci"] },
  wave_ci: { code: "wave_ci", name: "Wave", countries: ["ci"] },
  orange_ci: { code: "orange_ci", name: "Orange", countries: ["ci"] },
  wave_sn: { code: "wave_sn", name: "Wave", countries: ["sn"] },
  orange_sn: { code: "orange_sn", name: "Orange", countries: ["sn"] },
  moov_bf: { code: "moov_bf", name: "Moov", countries: ["bf"] },
  orange_bf: { code: "orange-bf", name: "Orange", countries: ["bf"] },
  mtn_gn: { code: "mtn_open_gn", name: "MTN Guinea", countries: ["gn"] },
};

export const FEDAPAY_SUPPORTED_COUNTRIES_COLLECT = ["bj", "tg", "ci", "sn", "gn", "ne"];
export const FEDAPAY_SUPPORTED_COUNTRIES_PAYOUT = ["bj", "tg", "ci", "sn", "bf", "gn"];

export function getCollectOperatorCode(operator: string, country: string): string | null {
  const key = `${operator.toLowerCase()}_${country.toLowerCase()}`;
  return FEDAPAY_COLLECT_OPERATORS[key]?.code || null;
}

export function getPayoutOperatorCode(operator: string, country: string): string | null {
  const key = `${operator.toLowerCase()}_${country.toLowerCase()}`;
  return FEDAPAY_PAYOUT_OPERATORS[key]?.code || null;
}

export function getCollectOperatorsForCountry(country: string): { operator: string; name: string }[] {
  const countryLower = country.toLowerCase();
  const operators: { operator: string; name: string }[] = [];
  
  for (const [key, config] of Object.entries(FEDAPAY_COLLECT_OPERATORS)) {
    if (config.countries.includes(countryLower)) {
      const operatorKey = key.split("_")[0];
      operators.push({ operator: operatorKey, name: config.name });
    }
  }
  
  return operators;
}

export function getPayoutOperatorsForCountry(country: string): { operator: string; name: string }[] {
  const countryLower = country.toLowerCase();
  const operators: { operator: string; name: string }[] = [];
  
  for (const [key, config] of Object.entries(FEDAPAY_PAYOUT_OPERATORS)) {
    if (config.countries.includes(countryLower)) {
      const operatorKey = key.split("_")[0];
      if (!operators.find(o => o.operator === operatorKey)) {
        operators.push({ operator: operatorKey, name: config.name });
      }
    }
  }
  
  return operators;
}

export interface CreateCollectParams {
  amount: number;
  description: string;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
  customerPhone: string;
  country: string;
  operator: string;
  callbackUrl?: string;
  metadata?: Record<string, any>;
}

export interface CollectResult {
  success: boolean;
  transactionId?: number;
  reference?: string;
  status?: string;
  message?: string;
  error?: string;
}

export async function createCollect(params: CreateCollectParams): Promise<CollectResult> {
  try {
    const operatorCode = getCollectOperatorCode(params.operator, params.country);
    if (!operatorCode) {
      return { success: false, error: `Operateur ${params.operator} non supporte pour ${params.country}` };
    }

    let sanitizedPhone = params.customerPhone.replace(/\s+/g, "").replace(/[^0-9+]/g, "");
    if (sanitizedPhone.startsWith("+")) {
      sanitizedPhone = sanitizedPhone.substring(1);
    }
    const countryPrefixes: Record<string, string> = {
      "bj": "229", "tg": "228", "ci": "225", "sn": "221", "gn": "224", "ne": "227", "bf": "226"
    };
    const prefix = countryPrefixes[params.country.toLowerCase()];
    if (prefix && sanitizedPhone.startsWith(prefix)) {
      sanitizedPhone = sanitizedPhone.substring(prefix.length);
    }

    console.log(`[FedaPay Collect] Creating transaction: ${params.amount} XOF, ${params.operator}/${params.country}, phone: ${sanitizedPhone.slice(-4)}`);

    const transaction = await Transaction.create({
      description: params.description,
      amount: params.amount,
      currency: { iso: "XOF" },
      callback_url: params.callbackUrl,
      customer: {
        firstname: params.customerFirstName,
        lastname: params.customerLastName,
        email: "noreply@bkapay.com",
        phone_number: {
          number: sanitizedPhone,
          country: params.country.toLowerCase(),
        },
      },
      mode: operatorCode,
    });

    if (!transaction || !transaction.id) {
      return { success: false, error: "Echec de creation de la transaction FedaPay" };
    }

    console.log(`[FedaPay Collect] Transaction created: ${transaction.id}, status: ${transaction.status}`);

    const tokenResult = await transaction.generateToken();
    const token = tokenResult?.token;

    if (!token) {
      return { success: false, error: "Echec de generation du token de paiement" };
    }

    console.log(`[FedaPay Collect] Token generated, initiating payment with ${operatorCode}`);

    const phoneNumber = {
      number: sanitizedPhone,
      country: params.country.toLowerCase(),
    };

    await transaction.sendNowWithToken(operatorCode, token, phoneNumber);

    console.log(`[FedaPay Collect] Payment initiated successfully for transaction ${transaction.id}`);

    return {
      success: true,
      transactionId: transaction.id,
      reference: transaction.reference,
      status: transaction.status || "pending",
      message: "Paiement initie. Veuillez valider sur votre telephone.",
    };
  } catch (error: any) {
    console.error("[FedaPay Collect] Error:", error);
    const errorMessage = error?.message || error?.toString() || "Erreur inconnue";
    return { success: false, error: errorMessage };
  }
}

export interface CreatePayoutParams {
  amount: number;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
  customerPhone: string;
  country: string;
  operator: string;
}

export interface PayoutResult {
  success: boolean;
  payoutId?: number;
  reference?: string;
  status?: string;
  message?: string;
  error?: string;
}

export async function createPayout(params: CreatePayoutParams): Promise<PayoutResult> {
  try {
    const operatorCode = getPayoutOperatorCode(params.operator, params.country);
    if (!operatorCode) {
      return { success: false, error: `Operateur ${params.operator} non supporte pour les retraits vers ${params.country}` };
    }

    // Clean and format phone number for FedaPay payout (needs full international format with +)
    let sanitizedPhone = params.customerPhone.replace(/\s+/g, "").replace(/[^0-9+]/g, "");
    
    const countryPrefixes: Record<string, string> = {
      "bj": "229", "tg": "228", "ci": "225", "sn": "221", "gn": "224", "ne": "227", "bf": "226"
    };
    const prefix = countryPrefixes[params.country.toLowerCase()];
    
    // Remove + if present for processing
    if (sanitizedPhone.startsWith("+")) {
      sanitizedPhone = sanitizedPhone.substring(1);
    }
    
    // Add country prefix if not present
    if (prefix && !sanitizedPhone.startsWith(prefix)) {
      // Remove leading 0 if present (local format)
      if (sanitizedPhone.startsWith("0")) {
        sanitizedPhone = sanitizedPhone.substring(1);
      }
      sanitizedPhone = prefix + sanitizedPhone;
    }
    
    // Add + for international format (required by FedaPay payouts)
    const fullPhoneNumber = "+" + sanitizedPhone;

    console.log(`[FedaPay Payout] Creating payout: ${params.amount} XOF, ${operatorCode}/${params.country}, phone: ${fullPhoneNumber.slice(-4)}`);

    const payout = await Payout.create({
      amount: params.amount,
      currency: { iso: "XOF" },
      mode: operatorCode,
      customer: {
        firstname: params.customerFirstName,
        lastname: params.customerLastName,
        email: params.customerEmail,
        phone_number: {
          number: fullPhoneNumber,
          country: params.country.toLowerCase(),
        },
      },
    });

    if (!payout || !payout.id) {
      return { success: false, error: "Echec de creation du paiement sortant FedaPay" };
    }

    console.log(`[FedaPay Payout] Payout created: ${payout.id}, sending now...`);

    await payout.sendNow();

    console.log(`[FedaPay Payout] Payout sent: ${payout.id}, status: ${payout.status}`);

    return {
      success: true,
      payoutId: payout.id,
      reference: payout.reference,
      status: payout.status || "pending",
      message: "Retrait initie avec succes",
    };
  } catch (error: any) {
    console.error("[FedaPay Payout] Error:", error);
    
    // Check for specific FedaPay error messages
    const fedapayMessage = error?.httpResponse?.data?.message;
    const httpStatus = error?.httpStatus;
    const httpResponseData = error?.httpResponse?.config?.data;
    
    console.log("[FedaPay Payout] Request data sent:", httpResponseData);
    console.log("[FedaPay Payout] HTTP Status:", httpStatus);
    console.log("[FedaPay Payout] FedaPay message:", fedapayMessage);
    
    if (httpStatus === 403 || fedapayMessage === "Opération non autorisée") {
      return { 
        success: false, 
        error: "La fonctionnalité de retrait n'est pas activée sur le compte FedaPay. Veuillez contacter le support FedaPay à support@fedapay.com pour activer les payouts." 
      };
    }
    
    const errorMessage = fedapayMessage || error?.message || error?.toString() || "Erreur inconnue";
    return { success: false, error: errorMessage };
  }
}

export async function getTransactionStatus(transactionId: number): Promise<{ status: string; transaction?: any }> {
  try {
    const transaction = await Transaction.retrieve(transactionId);
    return { status: transaction.status || "unknown", transaction };
  } catch (error: any) {
    console.error("[FedaPay] Error getting transaction status:", error);
    return { status: "error" };
  }
}

export async function getPayoutStatus(payoutId: number): Promise<{ status: string; payout?: any }> {
  try {
    const payout = await Payout.retrieve(payoutId);
    return { status: payout.status || "unknown", payout };
  } catch (error: any) {
    console.error("[FedaPay] Error getting payout status:", error);
    return { status: "error" };
  }
}
