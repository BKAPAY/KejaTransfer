import { FedaPay } from "fedapay";
import { storage } from "./storage";

const PAYDUNYA_API_URL = "https://app.paydunya.com/api/v1";
const PAYDUNYA_API_URL_V2 = "https://app.paydunya.com/api/v2";

export interface FedaPayConfig {
  secretKey: string;
  publicKey?: string;
  isLive: boolean;
}

export interface PaydunyaConfig {
  masterKey: string;
  publicKey: string;
  privateKey: string;
  token: string;
  apiUrl: string;
  apiUrlV2: string;
}

export interface NowPaymentsConfig {
  apiKey: string;
  ipnSecret?: string;
}

export async function getFedaPayConfig(): Promise<FedaPayConfig | null> {
  const config = await storage.getProviderConfig("fedapay");
  
  if (!config || !config.isActive) {
    console.log("[Provider Config] FedaPay is not active or not configured");
    return null;
  }
  
  const secretKey = config.secretKey || config.apiKey;
  if (!secretKey) {
    console.log("[Provider Config] FedaPay secret key is missing");
    return null;
  }
  
  return {
    secretKey,
    publicKey: config.publicKey || undefined,
    isLive: secretKey.startsWith("sk_live_"),
  };
}

export async function configureFedaPay(): Promise<boolean> {
  const config = await getFedaPayConfig();
  
  if (!config) {
    console.log("[FedaPay] No valid configuration found");
    return false;
  }
  
  FedaPay.setApiKey(config.secretKey);
  FedaPay.setEnvironment(config.isLive ? "live" : "sandbox");
  console.log(`[FedaPay] Configured in ${config.isLive ? "PRODUCTION" : "SANDBOX"} mode`);
  
  return true;
}

export async function getPaydunyaConfig(): Promise<PaydunyaConfig | null> {
  const config = await storage.getProviderConfig("paydunya");
  
  if (!config || !config.isActive) {
    console.log("[Provider Config] Paydunya is not active or not configured");
    return null;
  }
  
  if (!config.masterKey || !config.publicKey || !config.secretKey || !config.token) {
    console.log("[Provider Config] Paydunya keys are incomplete");
    return null;
  }
  
  return {
    masterKey: config.masterKey,
    publicKey: config.publicKey,
    privateKey: config.secretKey,
    token: config.token,
    apiUrl: PAYDUNYA_API_URL,
    apiUrlV2: PAYDUNYA_API_URL_V2,
  };
}

export async function callPaydunyaAPI(endpoint: string, data: any): Promise<any> {
  const config = await getPaydunyaConfig();
  
  if (!config) {
    throw new Error("Paydunya n'est pas configuré. Veuillez configurer les clés API dans l'interface administrateur.");
  }
  
  try {
    const response = await fetch(`${config.apiUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "PAYDUNYA-MASTER-KEY": config.masterKey,
        "PAYDUNYA-PRIVATE-KEY": config.privateKey,
        "PAYDUNYA-TOKEN": config.token,
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    console.log(`[Paydunya API] ${endpoint} - Status: ${response.status}`, result);
    return result;
  } catch (error) {
    console.error(`[Paydunya API Error] ${endpoint}:`, error);
    throw error;
  }
}

export async function callPaydunyaAPIGet(endpoint: string): Promise<any> {
  const config = await getPaydunyaConfig();
  
  if (!config) {
    throw new Error("Paydunya n'est pas configuré. Veuillez configurer les clés API dans l'interface administrateur.");
  }
  
  try {
    const url = `${config.apiUrl}${endpoint}`;
    console.log(`[Paydunya API GET] Calling: ${url}`);
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "PAYDUNYA-MASTER-KEY": config.masterKey,
        "PAYDUNYA-PRIVATE-KEY": config.privateKey,
        "PAYDUNYA-TOKEN": config.token,
      },
    });

    const responseText = await response.text();
    console.log(`[Paydunya API GET] ${endpoint} - Status: ${response.status}, Response: ${responseText.substring(0, 500)}`);
    
    try {
      const result = JSON.parse(responseText);
      return result;
    } catch (e) {
      console.error(`[Paydunya API GET] Received non-JSON response:`, responseText.substring(0, 500));
      throw new Error(`Paydunya API error: ${responseText.substring(0, 200)}`);
    }
  } catch (error) {
    console.error(`[Paydunya API GET Error] ${endpoint}:`, error);
    throw error;
  }
}

export async function callPaydunyaAPIv2(endpoint: string, data: any): Promise<any> {
  const config = await getPaydunyaConfig();
  
  if (!config) {
    throw new Error("Paydunya n'est pas configuré. Veuillez configurer les clés API dans l'interface administrateur.");
  }
  
  try {
    const url = `${config.apiUrlV2}${endpoint}`;
    console.log(`[Paydunya APIv2] Calling: ${url}`);
    console.log(`[Paydunya APIv2] Data:`, data);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "PAYDUNYA-MASTER-KEY": config.masterKey,
        "PAYDUNYA-PRIVATE-KEY": config.privateKey,
        "PAYDUNYA-TOKEN": config.token,
      },
      body: JSON.stringify(data),
    });

    const responseText = await response.text();
    console.log(`[Paydunya APIv2] ${endpoint} - Status: ${response.status}, Response: ${responseText.substring(0, 500)}`);
    
    try {
      const result = JSON.parse(responseText);
      return result;
    } catch (e) {
      console.error(`[Paydunya APIv2] Received non-JSON response:`, responseText.substring(0, 500));
      throw new Error(`Paydunya APIv2 error: ${responseText.substring(0, 200)}`);
    }
  } catch (error) {
    console.error(`[Paydunya APIv2 Error] ${endpoint}:`, error);
    throw error;
  }
}

export async function getNowPaymentsConfig(): Promise<NowPaymentsConfig | null> {
  const config = await storage.getProviderConfig("nowpayments");
  
  if (!config || !config.isActive) {
    console.log("[Provider Config] NOWPayments is not active or not configured");
    return null;
  }
  
  if (!config.apiKey) {
    console.log("[Provider Config] NOWPayments API key is missing");
    return null;
  }
  
  return {
    apiKey: config.apiKey,
    ipnSecret: config.ipnSecret || undefined,
  };
}

export async function isProviderActive(provider: string): Promise<boolean> {
  const config = await storage.getProviderConfig(provider);
  return config?.isActive ?? false;
}
