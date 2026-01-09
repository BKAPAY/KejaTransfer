import crypto from "crypto";

const NOWPAYMENTS_API_URL = "https://api.nowpayments.io/v1";

interface NowPaymentsConfig {
  apiKey: string;
  ipnSecret?: string;
}

interface ApiStatus {
  message: string;
}

interface CurrencyInfo {
  id: string;
  code: string;
  name: string;
  min_amount: number;
  max_amount: number;
  is_fiat: boolean;
}

interface MinAmountResponse {
  currency_from: string;
  currency_to: string;
  min_amount: number;
  fiat_equivalent?: number;
}

interface EstimateResponse {
  currency_from: string;
  currency_to: string;
  amount_from: number;
  estimated_amount: number;
}

interface CreatePaymentRequest {
  price_amount: number;
  price_currency: string;
  pay_currency: string;
  ipn_callback_url?: string;
  order_id?: string;
  order_description?: string;
  case?: string;
}

interface PaymentResponse {
  payment_id: string;
  payment_status: string;
  pay_address: string;
  pay_amount: number;
  pay_currency: string;
  price_amount: number;
  price_currency: string;
  order_id?: string;
  order_description?: string;
  purchase_id?: string;
  created_at: string;
  updated_at: string;
  payin_extra_id?: string;
  network?: string;
  smart_contract?: string;
}

interface PaymentStatusResponse {
  payment_id: string;
  payment_status: string;
  pay_address: string;
  pay_amount: number;
  actually_paid: number;
  pay_currency: string;
  price_amount: number;
  price_currency: string;
  order_id?: string;
  order_description?: string;
  outcome_amount?: number;
  outcome_currency?: string;
  created_at: string;
  updated_at: string;
}

export class NowPaymentsClient {
  private apiKey: string;
  private ipnSecret?: string;

  constructor(config: NowPaymentsConfig) {
    this.apiKey = config.apiKey;
    this.ipnSecret = config.ipnSecret;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${NOWPAYMENTS_API_URL}${endpoint}`;
    const headers: Record<string, string> = {
      "x-api-key": this.apiKey,
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `NOWPayments API error: ${response.status}`);
    }

    return response.json();
  }

  async getStatus(): Promise<ApiStatus> {
    return this.request<ApiStatus>("/status");
  }

  async getAvailableCurrencies(): Promise<{ currencies: string[] }> {
    return this.request<{ currencies: string[] }>("/currencies");
  }

  async getFullCurrencies(): Promise<{ currencies: CurrencyInfo[] }> {
    return this.request<{ currencies: CurrencyInfo[] }>("/full-currencies");
  }

  async getMinAmount(currencyFrom: string, currencyTo: string): Promise<MinAmountResponse> {
    return this.request<MinAmountResponse>(`/min-amount?currency_from=${currencyFrom}&currency_to=${currencyTo}`);
  }

  async getEstimate(amount: number, currencyFrom: string, currencyTo: string): Promise<EstimateResponse> {
    return this.request<EstimateResponse>(
      `/estimate?amount=${amount}&currency_from=${currencyFrom}&currency_to=${currencyTo}`
    );
  }

  async createPayment(data: CreatePaymentRequest): Promise<PaymentResponse> {
    return this.request<PaymentResponse>("/payment", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatusResponse> {
    return this.request<PaymentStatusResponse>(`/payment/${paymentId}`);
  }

  verifyIpnSignature(body: any, signature: string): boolean {
    if (!this.ipnSecret) {
      console.error("[NOWPayments] IPN secret not configured");
      return false;
    }

    const sortObject = (obj: any): any => {
      return Object.keys(obj)
        .sort()
        .reduce((result: any, key) => {
          result[key] = obj[key] && typeof obj[key] === "object" ? sortObject(obj[key]) : obj[key];
          return result;
        }, {});
    };

    const sortedBody = sortObject(body);
    const hmac = crypto.createHmac("sha512", this.ipnSecret);
    hmac.update(JSON.stringify(sortedBody));
    const calculatedSignature = hmac.digest("hex");

    return calculatedSignature === signature;
  }
}

export const SUPPORTED_CRYPTOCURRENCIES = [
  { code: "btc", name: "Bitcoin", symbol: "BTC" },
  { code: "eth", name: "Ethereum", symbol: "ETH" },
  { code: "usdttrc20", name: "Tether (TRC20)", symbol: "USDT" },
  { code: "usdterc20", name: "Tether (ERC20)", symbol: "USDT" },
  { code: "ltc", name: "Litecoin", symbol: "LTC" },
  { code: "xrp", name: "Ripple", symbol: "XRP" },
  { code: "trx", name: "Tron", symbol: "TRX" },
  { code: "bnbmainnet", name: "BNB", symbol: "BNB" },
  { code: "sol", name: "Solana", symbol: "SOL" },
  { code: "doge", name: "Dogecoin", symbol: "DOGE" },
  { code: "matic", name: "Polygon", symbol: "MATIC" },
  { code: "ada", name: "Cardano", symbol: "ADA" },
];

export function getCryptoDisplayName(code: string): string {
  const crypto = SUPPORTED_CRYPTOCURRENCIES.find((c) => c.code === code);
  return crypto ? crypto.name : code.toUpperCase();
}

export function getCryptoSymbol(code: string): string {
  const crypto = SUPPORTED_CRYPTOCURRENCIES.find((c) => c.code === code);
  return crypto ? crypto.symbol : code.toUpperCase();
}
