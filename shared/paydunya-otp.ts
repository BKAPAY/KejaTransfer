export interface PaydunyaOtpConfig {
  requiresOtp: boolean;
  ussdCode?: string;
  instructions?: string;
  hint?: string;
}

const PAYDUNYA_OTP_CONFIG: Record<string, PaydunyaOtpConfig> = {
  "orange_sn": { requiresOtp: false },
  "free_sn": { requiresOtp: false },
  "expresso_sn": { requiresOtp: false },
  "wave_sn": { requiresOtp: false },
  "wizall_sn": { requiresOtp: false },
  "orange_ml": { requiresOtp: false },
  "moov_ml": { requiresOtp: false },
  "mtn_bj": { requiresOtp: false },
  "moov_bj": { requiresOtp: false },
  "tmoney_tg": { requiresOtp: false },
  "moov_tg": { requiresOtp: false },
  "orange_ci": {
    requiresOtp: true,
    ussdCode: "#144*82#",
    instructions: "Composez #144*82# puis choisissez l'option 2 pour générer votre code de paiement",
    hint: "Sélectionnez l'option 2 dans le menu",
  },
  "mtn_ci": { requiresOtp: false },
  "moov_ci": { requiresOtp: false },
  "wave_ci": { requiresOtp: false },
  "orange_bf": {
    requiresOtp: true,
    ussdCode: "#144*4*6#",
    instructions: "Composez #144*4*6# puis suivez les instructions pour obtenir votre code de paiement",
    hint: "Suivez les instructions à l'écran",
  },
  "moov_bf": { requiresOtp: false },
};

function buildKey(countryCode: string, operatorCode: string): string {
  return `${operatorCode.toLowerCase()}_${countryCode.toLowerCase()}`;
}

export function paydunyaRequiresOtp(countryCode: string, operatorCode: string): boolean {
  const key = buildKey(countryCode, operatorCode);
  return PAYDUNYA_OTP_CONFIG[key]?.requiresOtp || false;
}

export function getPaydunyaOtpConfig(countryCode: string, operatorCode: string): PaydunyaOtpConfig | null {
  const key = buildKey(countryCode, operatorCode);
  return PAYDUNYA_OTP_CONFIG[key] || null;
}
