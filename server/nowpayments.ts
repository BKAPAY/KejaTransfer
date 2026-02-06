import crypto from "crypto";

const NOWPAYMENTS_API_URL = "https://api.nowpayments.io/v1";

interface NowPaymentsConfig {
  apiKey: string;
  ipnSecret?: string;
  email?: string;
  password?: string;
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

interface PayoutWithdrawal {
  address: string;
  currency: string;
  amount: number;
  extra_id?: string;
  ipn_callback_url?: string;
}

interface CreatePayoutRequest {
  withdrawals: PayoutWithdrawal[];
  ipn_callback_url?: string;
}

interface PayoutResponse {
  id: string;
  withdrawals: Array<{
    id: string;
    address: string;
    currency: string;
    amount: number | string;
    hash?: string;
    status: string;
    extra_id?: string;
    error?: string;
  }>;
}

interface PayoutStatusResponse {
  id: string;
  status: string;
  withdrawals: Array<{
    id: string;
    address: string;
    currency: string;
    amount: number | string;
    hash?: string;
    status: string;
    error?: string;
  }>;
}

interface ValidateAddressResponse {
  isValid?: boolean;
  message?: string;
}

export class NowPaymentsClient {
  private apiKey: string;
  private ipnSecret?: string;
  private email?: string;
  private password?: string;
  private jwtToken: string | null = null;
  private jwtExpiry: number = 0;

  constructor(config: NowPaymentsConfig) {
    this.apiKey = config.apiKey;
    this.ipnSecret = config.ipnSecret;
    this.email = config.email;
    this.password = config.password;
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

  private async authenticatedRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getJwtToken();
    const url = `${NOWPAYMENTS_API_URL}${endpoint}`;
    const headers: Record<string, string> = {
      "x-api-key": this.apiKey,
      "Authorization": `Bearer ${token}`,
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

  private async getJwtToken(): Promise<string> {
    if (!this.email || !this.password) {
      throw new Error("Email et mot de passe NOWPayments requis pour les operations payout");
    }

    const now = Date.now();
    if (this.jwtToken && now < this.jwtExpiry) {
      return this.jwtToken;
    }

    console.log("[NOWPayments] Authenticating for JWT token...");
    const url = `${NOWPAYMENTS_API_URL}/auth`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: this.email, password: this.password }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `NOWPayments auth failed: ${response.status}`);
    }

    const data = await response.json();
    this.jwtToken = data.token;
    this.jwtExpiry = now + 50 * 60 * 1000;
    console.log("[NOWPayments] JWT token obtained successfully");
    return this.jwtToken!;
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

  async createPayout(withdrawals: PayoutWithdrawal[], ipnCallbackUrl?: string): Promise<PayoutResponse> {
    const data: CreatePayoutRequest = { withdrawals };
    if (ipnCallbackUrl) {
      data.ipn_callback_url = ipnCallbackUrl;
    }
    return this.authenticatedRequest<PayoutResponse>("/payout", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getPayoutStatus(payoutId: string): Promise<PayoutStatusResponse> {
    return this.authenticatedRequest<PayoutStatusResponse>(`/payout/${payoutId}`);
  }

  async validateAddress(currency: string, address: string): Promise<ValidateAddressResponse> {
    return this.authenticatedRequest<ValidateAddressResponse>("/payout/validate-address", {
      method: "POST",
      body: JSON.stringify({ currency, address }),
    });
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

// Minimums en XOF pour les paiements crypto
export const CRYPTO_MIN_AMOUNT_XOF = 2000; // Minimum par défaut: 2000 XOF
export const USDT_MIN_AMOUNT_XOF = 8000; // Minimum pour USDT (TRC20 et ERC20): 8000 XOF

export const SUPPORTED_CRYPTOCURRENCIES = [
  { code: "btc", name: "Bitcoin", symbol: "BTC", minAmountXOF: CRYPTO_MIN_AMOUNT_XOF },
  { code: "eth", name: "Ethereum", symbol: "ETH", minAmountXOF: CRYPTO_MIN_AMOUNT_XOF },
  { code: "usdttrc20", name: "Tether (TRC20)", symbol: "USDT", minAmountXOF: USDT_MIN_AMOUNT_XOF },
  { code: "usdterc20", name: "Tether (ERC20)", symbol: "USDT", minAmountXOF: USDT_MIN_AMOUNT_XOF },
  { code: "ltc", name: "Litecoin", symbol: "LTC", minAmountXOF: CRYPTO_MIN_AMOUNT_XOF },
  { code: "xrp", name: "Ripple", symbol: "XRP", minAmountXOF: CRYPTO_MIN_AMOUNT_XOF },
  { code: "trx", name: "Tron", symbol: "TRX", minAmountXOF: CRYPTO_MIN_AMOUNT_XOF },
  { code: "bnbbsc", name: "BNB", symbol: "BNB", minAmountXOF: CRYPTO_MIN_AMOUNT_XOF },
  { code: "sol", name: "Solana", symbol: "SOL", minAmountXOF: CRYPTO_MIN_AMOUNT_XOF },
  { code: "doge", name: "Dogecoin", symbol: "DOGE", minAmountXOF: CRYPTO_MIN_AMOUNT_XOF },
  { code: "matic", name: "Polygon", symbol: "MATIC", minAmountXOF: CRYPTO_MIN_AMOUNT_XOF },
  { code: "ada", name: "Cardano", symbol: "ADA", minAmountXOF: CRYPTO_MIN_AMOUNT_XOF },
];

export function getCryptoMinAmountXOF(code: string): number {
  const crypto = SUPPORTED_CRYPTOCURRENCIES.find((c) => c.code === code);
  return crypto ? crypto.minAmountXOF : CRYPTO_MIN_AMOUNT_XOF;
}

export function getCryptoDisplayName(code: string): string {
  const crypto = SUPPORTED_CRYPTOCURRENCIES.find((c) => c.code === code);
  return crypto ? crypto.name : code.toUpperCase();
}

export function getCryptoSymbol(code: string): string {
  const crypto = SUPPORTED_CRYPTOCURRENCIES.find((c) => c.code === code);
  return crypto ? crypto.symbol : code.toUpperCase();
}
