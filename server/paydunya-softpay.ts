/**
 * Paydunya SOFTPAY Integration Module
 * Handles operator-specific OTP-based payment endpoints (NOT QR code)
 * 
 * Documentation: 19 operator-specific SOFTPAY integrations
 * Each operator has its own endpoint and parameter structure
 */

// Operator codes mapping
export type OperatorCode = 
  | "orange_sn" | "free_sn" | "expresso_sn" | "wave_sn" | "wizall_sn"
  | "orange_ml" | "moov_ml" | "mtn_ml"
  | "mtn_bj" | "moov_bj"
  | "tmoney_tg" | "moov_tg"
  | "orange_ci" | "mtn_ci" | "moov_ci" | "wave_ci"
  | "orange_bf" | "moov_bf"
  | "paydunya";

export interface SoftpayOperatorConfig {
  endpoint: string;
  requiresOTP: boolean;
  requiresTwoStep: boolean;
  ussdInstruction?: string;
  parameterMapping: (data: SoftpayPaymentData) => any;
}

export interface SoftpayPaymentData {
  customerName: string;
  customerEmail: string;
  phoneNumber: string;
  invoiceToken: string;
  authorizationCode?: string; // For OTP-based payments
  customerAddress?: string;
  transactionId?: string; // For two-step flows (Wizall)
}

/**
 * Maps operator codes to their SOFTPAY API configurations
 * Based on Paydunya documentation - 19 operator-specific integrations
 */
export const SOFTPAY_OPERATORS: Record<string, SoftpayOperatorConfig> = {
  // SENEGAL OPERATORS
  "orange_sn": {
    endpoint: "/softpay/new-orange-money-senegal",
    requiresOTP: true,
    requiresTwoStep: false,
    ussdInstruction: "Composez #144#391*VOTRE CODE PIN ORANGE MONEY# pour obtenir votre code de paiement",
    parameterMapping: (data) => ({
      customer_name: data.customerName,
      customer_email: data.customerEmail,
      phone_number: data.phoneNumber,
      authorization_code: data.authorizationCode,
      invoice_token: data.invoiceToken,
      api_type: "OTPCODE" // NOT QRCODE - using OTP only
    })
  },

  "free_sn": {
    endpoint: "/softpay/free-money-senegal",
    requiresOTP: false,
    requiresTwoStep: false,
    ussdInstruction: "Après validation, composez #150# sur votre téléphone pour finaliser le paiement",
    parameterMapping: (data) => ({
      customer_name: data.customerName,
      customer_email: data.customerEmail,
      phone_number: data.phoneNumber,
      payment_token: data.invoiceToken
    })
  },

  "expresso_sn": {
    endpoint: "/softpay/expresso-senegal",
    requiresOTP: false,
    requiresTwoStep: false,
    ussdInstruction: "Vous recevrez un SMS de validation. Validez le paiement pour le compléter.",
    parameterMapping: (data) => ({
      expresso_sn_fullName: data.customerName,
      expresso_sn_email: data.customerEmail,
      expresso_sn_phone: data.phoneNumber,
      payment_token: data.invoiceToken
    })
  },

  "wave_sn": {
    endpoint: "/softpay/wave-senegal",
    requiresOTP: false,
    requiresTwoStep: false,
    ussdInstruction: "Vous serez redirigé vers Wave pour compléter le paiement",
    parameterMapping: (data) => ({
      wave_senegal_fullName: data.customerName,
      wave_senegal_email: data.customerEmail,
      wave_senegal_phone: data.phoneNumber,
      wave_senegal_payment_token: data.invoiceToken
    })
  },

  "wizall_sn": {
    endpoint: "/softpay/wizall-money-senegal",
    requiresOTP: true,
    requiresTwoStep: true, // Wizall requires 2-step: request then confirm
    ussdInstruction: "Vous recevrez un code OTP par SMS. Entrez ce code pour confirmer le paiement.",
    parameterMapping: (data) => ({
      customer_name: data.customerName,
      customer_email: data.customerEmail,
      phone_number: data.phoneNumber,
      invoice_token: data.invoiceToken
    })
  },

  // MALI OPERATORS
  "orange_ml": {
    endpoint: "/softpay/orange-money-mali",
    requiresOTP: false,
    requiresTwoStep: false,
    ussdInstruction: "Validez le paiement sur votre téléphone",
    parameterMapping: (data) => ({
      orange_money_mali_customer_fullname: data.customerName,
      orange_money_mali_email: data.customerEmail,
      orange_money_mali_phone_number: data.phoneNumber,
      orange_money_mali_customer_address: data.customerAddress || "Mali",
      payment_token: data.invoiceToken
    })
  },

  "moov_ml": {
    endpoint: "/softpay/moov-mali",
    requiresOTP: false,
    requiresTwoStep: false,
    ussdInstruction: "Finalisez le paiement sur votre téléphone",
    parameterMapping: (data) => ({
      moov_ml_customer_fullname: data.customerName,
      moov_ml_email: data.customerEmail,
      moov_ml_phone_number: data.phoneNumber,
      moov_ml_customer_address: data.customerAddress || "Mali",
      payment_token: data.invoiceToken
    })
  },

  "mtn_ml": {
    endpoint: "/softpay/mtn-mali",
    requiresOTP: false,
    requiresTwoStep: false,
    ussdInstruction: "Vous recevrez un SMS. Validez le paiement après réception.",
    parameterMapping: (data) => ({
      mtn_mali_customer_fullname: data.customerName,
      mtn_mali_email: data.customerEmail,
      mtn_mali_phone_number: data.phoneNumber,
      mtn_mali_wallet_provider: "MTNMALI",
      payment_token: data.invoiceToken
    })
  },

  // BENIN OPERATORS
  "mtn_bj": {
    endpoint: "/softpay/mtn-benin",
    requiresOTP: false,
    requiresTwoStep: false,
    ussdInstruction: "Vous recevrez un SMS. Validez le paiement après réception.",
    parameterMapping: (data) => ({
      mtn_benin_customer_fullname: data.customerName,
      mtn_benin_email: data.customerEmail,
      mtn_benin_phone_number: data.phoneNumber,
      mtn_benin_wallet_provider: "MTNBENIN",
      payment_token: data.invoiceToken
    })
  },

  "moov_bj": {
    endpoint: "/softpay/moov-benin",
    requiresOTP: false,
    requiresTwoStep: false,
    ussdInstruction: "Finalisez le paiement sur votre téléphone",
    parameterMapping: (data) => ({
      moov_benin_customer_fullname: data.customerName,
      moov_benin_email: data.customerEmail,
      moov_benin_phone_number: data.phoneNumber,
      payment_token: data.invoiceToken
    })
  },

  // TOGO OPERATORS
  "tmoney_tg": {
    endpoint: "/softpay/t-money-togo",
    requiresOTP: false,
    requiresTwoStep: false,
    ussdInstruction: "Vous recevrez un SMS. Validez le paiement après réception.",
    parameterMapping: (data) => ({
      name_t_money: data.customerName,
      email_t_money: data.customerEmail,
      phone_t_money: data.phoneNumber,
      payment_token: data.invoiceToken
    })
  },

  "moov_tg": {
    endpoint: "/softpay/moov-togo",
    requiresOTP: false,
    requiresTwoStep: false,
    ussdInstruction: "Finalisez le paiement sur votre téléphone",
    parameterMapping: (data) => ({
      moov_togo_customer_fullname: data.customerName,
      moov_togo_email: data.customerEmail,
      moov_togo_customer_address: data.customerAddress || "Togo",
      moov_togo_phone_number: data.phoneNumber,
      payment_token: data.invoiceToken
    })
  },

  // CÔTE D'IVOIRE OPERATORS
  "orange_ci": {
    endpoint: "/softpay/orange-money-ci",
    requiresOTP: true,
    requiresTwoStep: false,
    ussdInstruction: "Composez #144*82# puis choisissez l'option 2 pour obtenir votre code de paiement",
    parameterMapping: (data) => ({
      orange_money_ci_customer_fullname: data.customerName,
      orange_money_ci_email: data.customerEmail,
      orange_money_ci_phone_number: data.phoneNumber,
      orange_money_ci_otp: data.authorizationCode,
      payment_token: data.invoiceToken
    })
  },

  "mtn_ci": {
    endpoint: "/softpay/mtn-ci",
    requiresOTP: false,
    requiresTwoStep: false,
    ussdInstruction: "Finalisez le paiement sur votre téléphone",
    parameterMapping: (data) => ({
      mtn_ci_customer_fullname: data.customerName,
      mtn_ci_email: data.customerEmail,
      mtn_ci_phone_number: data.phoneNumber,
      mtn_ci_wallet_provider: "MTNCI",
      payment_token: data.invoiceToken
    })
  },

  "moov_ci": {
    endpoint: "/softpay/moov-ci",
    requiresOTP: false,
    requiresTwoStep: false,
    ussdInstruction: "Un popup s'ouvrira automatiquement. Entrez votre code secret dans les 30 secondes.",
    parameterMapping: (data) => ({
      moov_ci_customer_fullname: data.customerName,
      moov_ci_email: data.customerEmail,
      moov_ci_phone_number: data.phoneNumber,
      payment_token: data.invoiceToken
    })
  },

  "wave_ci": {
    endpoint: "/softpay/wave-ci",
    requiresOTP: false,
    requiresTwoStep: false,
    ussdInstruction: "Vous serez redirigé vers Wave pour compléter le paiement",
    parameterMapping: (data) => ({
      wave_ci_fullName: data.customerName,
      wave_ci_email: data.customerEmail,
      wave_ci_phone: data.phoneNumber,
      wave_ci_payment_token: data.invoiceToken
    })
  },

  // BURKINA FASO OPERATORS
  "orange_bf": {
    endpoint: "/softpay/orange-money-burkina",
    requiresOTP: true,
    requiresTwoStep: false,
    ussdInstruction: "Composez *555*6# sur votre téléphone pour obtenir votre code OTP",
    parameterMapping: (data) => ({
      name_bf: data.customerName,
      email_bf: data.customerEmail,
      phone_bf: data.phoneNumber,
      otp_code: data.authorizationCode,
      payment_token: data.invoiceToken
    })
  },

  "moov_bf": {
    endpoint: "/softpay/moov-burkina",
    requiresOTP: false,
    requiresTwoStep: false,
    ussdInstruction: "Composez *555*6# pour finaliser le paiement",
    parameterMapping: (data) => ({
      moov_burkina_faso_fullName: data.customerName,
      moov_burkina_faso_email: data.customerEmail,
      moov_burkina_faso_phone_number: data.phoneNumber,
      moov_burkina_faso_payment_token: data.invoiceToken
    })
  },

  // PAYDUNYA WALLET
  "paydunya": {
    endpoint: "/softpay/paydunya",
    requiresOTP: false,
    requiresTwoStep: false,
    ussdInstruction: "Entrez votre mot de passe Paydunya",
    parameterMapping: (data) => ({
      customer_name: data.customerName,
      customer_email: data.customerEmail,
      phone_phone: data.phoneNumber,
      password: data.authorizationCode, // Paydunya password
      invoice_token: data.invoiceToken
    })
  }
};

/**
 * Get operator configuration key from country and operator codes
 * Converts BKApay operator codes to SOFTPAY operator keys
 */
export function getOperatorKey(operator: string, country: string): string | null {
  const mapping: Record<string, string> = {
    // Senegal
    "orange-sn": "orange_sn",
    "free-sn": "free_sn",
    "expresso-sn": "expresso_sn",
    "wave-sn": "wave_sn",
    "wizall-sn": "wizall_sn",
    
    // Mali
    "orange-ml": "orange_ml",
    "moov-ml": "moov_ml",
    "mtn-ml": "mtn_ml",
    
    // Benin
    "mtn-bj": "mtn_bj",
    "moov-bj": "moov_bj",
    
    // Togo
    "tmoney-tg": "tmoney_tg",
    "moov-tg": "moov_tg",
    
    // Côte d'Ivoire
    "orange-ci": "orange_ci",
    "mtn-ci": "mtn_ci",
    "moov-ci": "moov_ci",
    "wave-ci": "wave_ci",
    
    // Burkina Faso
    "orange-bf": "orange_bf",
    "moov-bf": "moov_bf",
    
    // Paydunya wallet (country-independent, works everywhere)
    "paydunya-sn": "paydunya",
    "paydunya-ml": "paydunya",
    "paydunya-bj": "paydunya",
    "paydunya-tg": "paydunya",
    "paydunya-ci": "paydunya",
    "paydunya-bf": "paydunya",
  };

  const key = `${operator.toLowerCase()}-${country.toLowerCase()}`;
  return mapping[key] || null;
}

/**
 * Check if operator requires OTP code before payment
 */
export function requiresOTP(operatorKey: string): boolean {
  const config = SOFTPAY_OPERATORS[operatorKey];
  return config?.requiresOTP || false;
}

/**
 * Check if operator requires two-step flow (like Wizall)
 */
export function requiresTwoStep(operatorKey: string): boolean {
  const config = SOFTPAY_OPERATORS[operatorKey];
  return config?.requiresTwoStep || false;
}

/**
 * Get USSD instruction for operator
 */
export function getUSSDInstruction(operatorKey: string): string | null {
  const config = SOFTPAY_OPERATORS[operatorKey];
  return config?.ussdInstruction || null;
}
