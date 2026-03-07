/**
 * Paydunya SOFTPAY Integration Module
 * Handles operator-specific OTP-based payment endpoints (NOT QR code)
 * 
 * Documentation: 19 operator-specific SOFTPAY integrations
 * Each operator has its own endpoint and parameter structure
 */

// Email générique pour protéger la confidentialité des clients
// Les emails des clients ne sont JAMAIS envoyés aux fournisseurs de paiement
const BKAPAY_GENERIC_EMAIL = "noreply@bkapay.com";

// Operator codes mapping
export type OperatorCode = 
  | "orange_sn" | "free_sn" | "expresso_sn" | "wave_sn" | "wizall_sn"
  | "orange_ml" | "moov_ml"
  | "mtn_bj" | "moov_bj"
  | "tmoney_tg" | "moov_tg"
  | "orange_ci" | "mtn_ci" | "moov_ci" | "wave_ci"
  | "orange_bf" | "moov_bf"
  | "mtn_cm"
  | "paydunya";

export interface SoftpayOperatorConfig {
  endpoint: string;
  requiresOTP: boolean;
  requiresTwoStep: boolean;
  requiresRedirect?: boolean; // For Wave and similar operators that return redirect URL
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
    requiresOTP: false,
    requiresTwoStep: false,
    requiresRedirect: true,
    ussdInstruction: "Scannez le QR Code ou cliquez sur le lien pour payer avec Orange Money",
    parameterMapping: (data) => ({
      customer_name: data.customerName,
      customer_email: BKAPAY_GENERIC_EMAIL,
      phone_number: data.phoneNumber,
      invoice_token: data.invoiceToken
    })
  },

  "free_sn": {
    endpoint: "/softpay/free-money-senegal",
    requiresOTP: false,
    requiresTwoStep: false,
    requiresRedirect: true,
    ussdInstruction: "Scannez le QR Code ou cliquez sur le lien pour payer avec Free Money",
    parameterMapping: (data) => ({
      customer_name: data.customerName,
      customer_email: BKAPAY_GENERIC_EMAIL,
      phone_number: data.phoneNumber,
      payment_token: data.invoiceToken
    })
  },

  "expresso_sn": {
    endpoint: "/softpay/expresso-senegal",
    requiresOTP: false,
    requiresTwoStep: false,
    requiresRedirect: true,
    ussdInstruction: "Scannez le QR Code ou cliquez sur le lien pour payer avec Expresso",
    parameterMapping: (data) => ({
      expresso_sn_fullName: data.customerName,
      expresso_sn_email: BKAPAY_GENERIC_EMAIL,
      expresso_sn_phone: data.phoneNumber,
      payment_token: data.invoiceToken
    })
  },

  "wave_sn": {
    endpoint: "/softpay/wave-senegal",
    requiresOTP: false,
    requiresTwoStep: false,
    requiresRedirect: true,
    ussdInstruction: "Cliquez sur le bouton pour aller à Wave et compléter le paiement",
    parameterMapping: (data) => ({
      wave_senegal_fullName: data.customerName,
      wave_senegal_email: BKAPAY_GENERIC_EMAIL,
      wave_senegal_phone: data.phoneNumber,
      wave_senegal_payment_token: data.invoiceToken
    })
  },

  "wizall_sn": {
    endpoint: "/softpay/wizall-money-senegal",
    requiresOTP: false,
    requiresTwoStep: false,
    requiresRedirect: true,
    ussdInstruction: "Scannez le QR Code ou cliquez sur le lien pour payer avec Wizall",
    parameterMapping: (data) => ({
      customer_name: data.customerName,
      customer_email: BKAPAY_GENERIC_EMAIL,
      phone_number: data.phoneNumber,
      invoice_token: data.invoiceToken
    })
  },

  // MALI OPERATORS
  // Orange Money Mali - Push notification
  "orange_ml": {
    endpoint: "/softpay/orange-money-mali",
    requiresOTP: false,
    requiresTwoStep: false,
    requiresRedirect: false,
    ussdInstruction: "Vous recevrez une notification sur votre téléphone. Validez le paiement en entrant votre code secret.",
    parameterMapping: (data) => ({
      orange_money_mali_customer_fullname: data.customerName,
      orange_money_mali_email: BKAPAY_GENERIC_EMAIL,
      orange_money_mali_phone_number: data.phoneNumber,
      orange_money_mali_customer_address: data.customerAddress || "Mali",
      payment_token: data.invoiceToken
    })
  },

  // Moov Mali - Push notification
  "moov_ml": {
    endpoint: "/softpay/moov-mali",
    requiresOTP: false,
    requiresTwoStep: false,
    requiresRedirect: false,
    ussdInstruction: "Vous recevrez une notification sur votre téléphone. Validez le paiement en entrant votre code secret.",
    parameterMapping: (data) => ({
      moov_ml_customer_fullname: data.customerName,
      moov_ml_email: BKAPAY_GENERIC_EMAIL,
      moov_ml_phone_number: data.phoneNumber,
      moov_ml_customer_address: data.customerAddress || "Mali",
      payment_token: data.invoiceToken
    })
  },

  // NOTE: MTN Mali n'existe PAS dans Paydunya (vérifié documentation officielle)
  // Seuls Orange Money et Moov sont supportés au Mali

  // BENIN OPERATORS
  // MTN Bénin - Push notification + SMS de validation
  "mtn_bj": {
    endpoint: "/softpay/mtn-benin",
    requiresOTP: false,
    requiresTwoStep: false,
    requiresRedirect: false,
    ussdInstruction: "Vous recevrez un SMS de validation. Confirmez le paiement sur votre téléphone.",
    parameterMapping: (data) => ({
      mtn_benin_customer_fullname: data.customerName,
      mtn_benin_email: BKAPAY_GENERIC_EMAIL,
      mtn_benin_phone_number: data.phoneNumber,
      mtn_benin_wallet_provider: "MTNBENIN",
      payment_token: data.invoiceToken
    })
  },

  // Moov Bénin - Push notification
  "moov_bj": {
    endpoint: "/softpay/moov-benin",
    requiresOTP: false,
    requiresTwoStep: false,
    requiresRedirect: false,
    ussdInstruction: "Vous recevrez une notification sur votre téléphone. Validez le paiement en entrant votre code secret.",
    parameterMapping: (data) => ({
      moov_benin_customer_fullname: data.customerName,
      moov_benin_email: BKAPAY_GENERIC_EMAIL,
      moov_benin_phone_number: data.phoneNumber,
      payment_token: data.invoiceToken
    })
  },

  // TOGO OPERATORS
  // T-Money Togo - SMS de validation
  "tmoney_tg": {
    endpoint: "/softpay/t-money-togo",
    requiresOTP: false,
    requiresTwoStep: false,
    requiresRedirect: false,
    ussdInstruction: "Vous recevrez un SMS de validation. Confirmez le paiement sur votre téléphone.",
    parameterMapping: (data) => ({
      name_t_money: data.customerName,
      email_t_money: BKAPAY_GENERIC_EMAIL,
      phone_t_money: data.phoneNumber,
      payment_token: data.invoiceToken
    })
  },

  // Moov Togo - Push notification
  "moov_tg": {
    endpoint: "/softpay/moov-togo",
    requiresOTP: false,
    requiresTwoStep: false,
    requiresRedirect: false,
    ussdInstruction: "Vous recevrez une notification sur votre téléphone. Validez le paiement en entrant votre code secret.",
    parameterMapping: (data) => ({
      moov_togo_customer_fullname: data.customerName,
      moov_togo_email: BKAPAY_GENERIC_EMAIL,
      moov_togo_customer_address: data.customerAddress || "Togo",
      moov_togo_phone_number: data.phoneNumber,
      payment_token: data.invoiceToken
    })
  },

  // CÔTE D'IVOIRE OPERATORS
  // Orange Money CI nécessite un OTP généré via #144*82# option 2
  "orange_ci": {
    endpoint: "/softpay/orange-money-ci",
    requiresOTP: true,
    requiresTwoStep: false,
    requiresRedirect: false,
    ussdInstruction: "Composez #144*82# puis choisissez l'option 2 pour obtenir votre code de paiement",
    parameterMapping: (data) => ({
      orange_money_ci_customer_fullname: data.customerName,
      orange_money_ci_email: BKAPAY_GENERIC_EMAIL,
      orange_money_ci_phone_number: data.phoneNumber,
      orange_money_ci_otp: data.authorizationCode,
      payment_token: data.invoiceToken
    })
  },

  // MTN CI - Push notification au téléphone
  "mtn_ci": {
    endpoint: "/softpay/mtn-ci",
    requiresOTP: false,
    requiresTwoStep: false,
    requiresRedirect: false,
    ussdInstruction: "Vous recevrez une notification sur votre téléphone. Validez le paiement en entrant votre code secret.",
    parameterMapping: (data) => ({
      mtn_ci_customer_fullname: data.customerName,
      mtn_ci_email: BKAPAY_GENERIC_EMAIL,
      mtn_ci_phone_number: data.phoneNumber,
      mtn_ci_wallet_provider: "MTNCI",
      payment_token: data.invoiceToken
    })
  },

  // Moov CI - Push notification automatique
  "moov_ci": {
    endpoint: "/softpay/moov-ci",
    requiresOTP: false,
    requiresTwoStep: false,
    requiresRedirect: false,
    ussdInstruction: "Un popup s'ouvrira automatiquement sur votre téléphone. Entrez votre code secret dans les 30 secondes.",
    parameterMapping: (data) => ({
      moov_ci_customer_fullname: data.customerName,
      moov_ci_email: BKAPAY_GENERIC_EMAIL,
      moov_ci_phone_number: data.phoneNumber,
      payment_token: data.invoiceToken
    })
  },

  // Wave CI - Redirection vers Wave
  "wave_ci": {
    endpoint: "/softpay/wave-ci",
    requiresOTP: false,
    requiresTwoStep: false,
    requiresRedirect: true,
    ussdInstruction: "Vous serez redirigé vers Wave pour compléter le paiement",
    parameterMapping: (data) => ({
      wave_ci_fullName: data.customerName,
      wave_ci_email: BKAPAY_GENERIC_EMAIL,
      wave_ci_phone: data.phoneNumber,
      wave_ci_payment_token: data.invoiceToken
    })
  },

  // BURKINA FASO OPERATORS
  // Orange Money BF nécessite un OTP généré via *144*4*6*MONTANT#
  "orange_bf": {
    endpoint: "/softpay/orange-money-burkina",
    requiresOTP: true,
    requiresTwoStep: false,
    requiresRedirect: false,
    ussdInstruction: "Composez *144*4*6*MONTANT# pour obtenir votre code OTP",
    parameterMapping: (data) => ({
      name_bf: data.customerName,
      email_bf: BKAPAY_GENERIC_EMAIL,
      phone_bf: data.phoneNumber,
      otp_code: data.authorizationCode,
      payment_token: data.invoiceToken
    })
  },

  // Moov BF - Compose *555*6# pour valider
  "moov_bf": {
    endpoint: "/softpay/moov-burkina",
    requiresOTP: false,
    requiresTwoStep: false,
    requiresRedirect: false,
    ussdInstruction: "Composez *555*6# puis entrez votre code secret pour finaliser le paiement",
    parameterMapping: (data) => ({
      moov_burkina_faso_fullName: data.customerName,
      moov_burkina_faso_email: BKAPAY_GENERIC_EMAIL,
      moov_burkina_faso_phone_number: data.phoneNumber,
      moov_burkina_faso_payment_token: data.invoiceToken
    })
  },

  // CAMEROUN OPERATORS
  // MTN Cameroun - Push notification + SMS de validation
  "mtn_cm": {
    endpoint: "/softpay/mtn-cameroun",
    requiresOTP: false,
    requiresTwoStep: false,
    requiresRedirect: false,
    ussdInstruction: "Vous recevrez un SMS de validation. Confirmez le paiement sur votre telephone.",
    parameterMapping: (data) => ({
      mtn_cameroun_customer_fullname: data.customerName,
      mtn_cameroun_email: BKAPAY_GENERIC_EMAIL,
      mtn_cameroun_phone_number: data.phoneNumber,
      mtn_cameroun_wallet_provider: "MTNCAMEROUN",
      payment_token: data.invoiceToken
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
      customer_email: BKAPAY_GENERIC_EMAIL,
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
    
    // Mali (seulement Orange et Moov - pas de MTN au Mali selon Paydunya)
    "orange-ml": "orange_ml",
    "moov-ml": "moov_ml",
    
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
    
    // Cameroun
    "mtn-cm": "mtn_cm",
    
    // Paydunya wallet (country-independent, works everywhere)
    "paydunya-sn": "paydunya",
    "paydunya-ml": "paydunya",
    "paydunya-bj": "paydunya",
    "paydunya-tg": "paydunya",
    "paydunya-ci": "paydunya",
    "paydunya-bf": "paydunya",
    "paydunya-cm": "paydunya",
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

/**
 * Check if operator requires redirect (Wave, etc)
 */
export function requiresRedirect(operatorKey: string): boolean {
  const config = SOFTPAY_OPERATORS[operatorKey];
  return config?.requiresRedirect || false;
}
