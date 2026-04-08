export interface AfribaPayOperator {
  code: string;
  name: string;
  requiresOtp: boolean;
  payin: boolean;
  payout: boolean;
  otpInstructions?: string;
  paymentInstructions?: string;
}

export const OTP_USSD_CODES: Record<string, Record<string, string>> = {
  CI: { orange: "#144*82#" },
  BF: { orange: "*144*4*6*montant#" },
  SN: { orange: "#144*391#" },
  GN: { orange: "*144*4*2*1#" },
};

export const OTP_INSTRUCTIONS: Record<string, Record<string, string>> = {
  CI: {
    orange: "Composez le code USSD ci-dessous sur votre telephone Orange Money, generez un code OTP, puis entrez-le ici.\n1. Composez #144*82# sur votre telephone\n2. Choisissez 'Paiement marchand'\n3. Selectionnez 'Generer un code'\n4. Entrez votre code secret Orange Money\n5. Copiez le code OTP recu par SMS et entrez-le ci-dessous",
  },
  BF: {
    orange: "Composez le code USSD ci-dessous sur votre telephone Orange Money, generez un code OTP, puis entrez-le ici.\n1. Composez *144*4*6*montant# sur votre telephone (remplacez 'montant' par le montant)\n2. Entrez votre code secret Orange Money\n3. Copiez le code OTP recu par SMS et entrez-le ci-dessous",
  },
  SN: {
    orange: "Composez le code USSD ci-dessous sur votre telephone Orange Money, generez un code OTP, puis entrez-le ici.\n1. Composez #144*391# sur votre telephone\n2. Entrez votre code PIN Orange Money\n3. Copiez le code OTP recu par SMS et entrez-le ci-dessous",
  },
  GN: {
    orange: "Composez le code USSD ci-dessous sur votre telephone Orange Money, generez un code OTP, puis entrez-le ici.\n1. Composez *144*4*2*1# sur votre telephone\n2. Entrez votre code secret Orange Money\n3. Copiez le code OTP recu par SMS et entrez-le ci-dessous",
  },
};

export const WAVE_INSTRUCTIONS: Record<string, string> = {
  CI: "Vous serez redirige vers Wave pour scanner un QR code. Ouvrez l'application Wave sur votre telephone et scannez le code pour valider le paiement.",
  SN: "Vous serez redirige vers Wave pour scanner un QR code. Ouvrez l'application Wave sur votre telephone et scannez le code pour valider le paiement.",
  BF: "Vous serez redirige vers Wave pour scanner un QR code. Ouvrez l'application Wave sur votre telephone et scannez le code pour valider le paiement.",
  ML: "Vous serez redirige vers Wave pour scanner un QR code. Ouvrez l'application Wave sur votre telephone et scannez le code pour valider le paiement.",
};

export interface AfribaPayCountry {
  code: string;
  name: string;
  flag: string;
  phoneCode: string;
  phoneDigits: number;
  phoneFormat: string;
  currency: string;
  operators: AfribaPayOperator[];
}

export const AFRIBAPAY_COUNTRIES: AfribaPayCountry[] = [
  {
    code: "BJ",
    name: "Bénin",
    flag: "🇧🇯",
    phoneCode: "+229",
    phoneDigits: 10,
    phoneFormat: "01XXXXXXXX",
    currency: "XOF",
    operators: [
      { code: "moov", name: "Moov Money", requiresOtp: false, payin: true, payout: true },
      { code: "mtn", name: "MTN Mobile Money", requiresOtp: false, payin: true, payout: true },
      { code: "celtiis", name: "Celtiis Money", requiresOtp: false, payin: true, payout: true },
    ],
  },
  {
    code: "CI",
    name: "Côte d'Ivoire",
    flag: "🇨🇮",
    phoneCode: "+225",
    phoneDigits: 10,
    phoneFormat: "0XXXXXXXXX",
    currency: "XOF",
    operators: [
      { code: "orange", name: "Orange Money", requiresOtp: true, payin: true, payout: true },
      { code: "moov", name: "Moov Money", requiresOtp: false, payin: true, payout: true },
      { code: "mtn", name: "MTN Mobile Money", requiresOtp: false, payin: true, payout: true },
      { code: "wave", name: "Wave", requiresOtp: false, payin: true, payout: true },
    ],
  },
  {
    code: "SN",
    name: "Sénégal",
    flag: "🇸🇳",
    phoneCode: "+221",
    phoneDigits: 9,
    phoneFormat: "7XXXXXXXX",
    currency: "XOF",
    operators: [
      { code: "orange", name: "Orange Money", requiresOtp: true, payin: true, payout: true },
      { code: "free", name: "Free Money", requiresOtp: false, payin: true, payout: true },
      { code: "expresso", name: "Expresso", requiresOtp: false, payin: true, payout: true },
      { code: "wave", name: "Wave", requiresOtp: false, payin: true, payout: true },
    ],
  },
  {
    code: "BF",
    name: "Burkina Faso",
    flag: "🇧🇫",
    phoneCode: "+226",
    phoneDigits: 8,
    phoneFormat: "7XXXXXXX",
    currency: "XOF",
    operators: [
      { code: "orange", name: "Orange Money", requiresOtp: true, payin: true, payout: true },
      { code: "moov", name: "Moov Money", requiresOtp: false, payin: true, payout: true },
      { code: "wave", name: "Wave", requiresOtp: false, payin: true, payout: true },
    ],
  },
  {
    code: "TG",
    name: "Togo",
    flag: "🇹🇬",
    phoneCode: "+228",
    phoneDigits: 8,
    phoneFormat: "9XXXXXXX",
    currency: "XOF",
    operators: [
      { code: "moov", name: "Moov Money", requiresOtp: false, payin: true, payout: true },
      { code: "tmoney", name: "Togocell (T-Money)", requiresOtp: false, payin: true, payout: true },
      { code: "togocom", name: "Togocom", requiresOtp: false, payin: true, payout: true },
    ],
  },
  {
    code: "ML",
    name: "Mali",
    flag: "🇲🇱",
    phoneCode: "+223",
    phoneDigits: 8,
    phoneFormat: "XXXXXXXX",
    currency: "XOF",
    operators: [
      { code: "orange", name: "Orange Money", requiresOtp: false, payin: true, payout: true },
      { code: "moov", name: "Moov Money", requiresOtp: false, payin: true, payout: true },
      { code: "wave", name: "Wave", requiresOtp: false, payin: true, payout: false },
    ],
  },
  {
    code: "GN",
    name: "Guinée",
    flag: "🇬🇳",
    phoneCode: "+224",
    phoneDigits: 9,
    phoneFormat: "6XXXXXXXX",
    currency: "GNF",
    operators: [
      { code: "orange", name: "Orange Money", requiresOtp: true, payin: true, payout: true },
      { code: "mtn", name: "MTN Mobile Money", requiresOtp: false, payin: true, payout: true },
    ],
  },
  {
    code: "NE",
    name: "Niger",
    flag: "🇳🇪",
    phoneCode: "+227",
    phoneDigits: 8,
    phoneFormat: "8XXXXXXX",
    currency: "XOF",
    operators: [
      { code: "airtel", name: "Airtel Money", requiresOtp: false, payin: true, payout: true },
      { code: "moov", name: "Moov Money", requiresOtp: false, payin: true, payout: true },
    ],
  },
  {
    code: "CM",
    name: "Cameroun",
    flag: "🇨🇲",
    phoneCode: "+237",
    phoneDigits: 9,
    phoneFormat: "6XXXXXXXX",
    currency: "XAF",
    operators: [
      { code: "orange", name: "Orange Money", requiresOtp: false, payin: true, payout: true },
      { code: "mtn", name: "MTN Mobile Money", requiresOtp: false, payin: true, payout: true },
    ],
  },
  {
    code: "CD",
    name: "RD Congo",
    flag: "🇨🇩",
    phoneCode: "+243",
    phoneDigits: 9,
    phoneFormat: "XXXXXXXXX",
    currency: "CDF",
    operators: [
      { code: "orange", name: "Orange Money", requiresOtp: false, payin: true, payout: true },
      { code: "airtel", name: "Airtel Money", requiresOtp: false, payin: true, payout: true },
      { code: "mpesa", name: "M-Pesa", requiresOtp: false, payin: true, payout: true },
      { code: "africell", name: "Africell", requiresOtp: false, payin: true, payout: true },
      { code: "vodacom", name: "Vodacom", requiresOtp: false, payin: true, payout: true },
    ],
  },
  {
    code: "TD",
    name: "Tchad",
    flag: "🇹🇩",
    phoneCode: "+235",
    phoneDigits: 8,
    phoneFormat: "XXXXXXXX",
    currency: "XAF",
    operators: [
      { code: "airtel", name: "Airtel Money", requiresOtp: false, payin: true, payout: true },
      { code: "moov", name: "Moov Money", requiresOtp: false, payin: true, payout: true },
    ],
  },
  {
    code: "CG",
    name: "Congo-Brazzaville",
    flag: "🇨🇬",
    phoneCode: "+242",
    phoneDigits: 9,
    phoneFormat: "XXXXXXXXX",
    currency: "XAF",
    operators: [
      { code: "airtel", name: "Airtel Money", requiresOtp: false, payin: true, payout: true },
      { code: "mtn", name: "MTN Mobile Money", requiresOtp: false, payin: true, payout: true },
    ],
  },
  {
    code: "CF",
    name: "Centrafrique",
    flag: "🇨🇫",
    phoneCode: "+236",
    phoneDigits: 8,
    phoneFormat: "XXXXXXXX",
    currency: "XAF",
    operators: [
      { code: "orange", name: "Orange Money", requiresOtp: false, payin: true, payout: true },
      { code: "telecel", name: "Telecel", requiresOtp: false, payin: true, payout: true },
    ],
  },
  {
    code: "GA",
    name: "Gabon",
    flag: "🇬🇦",
    phoneCode: "+241",
    phoneDigits: 8,
    phoneFormat: "XXXXXXXX",
    currency: "XAF",
    operators: [
      { code: "airtel", name: "Airtel Money", requiresOtp: false, payin: true, payout: true },
      { code: "moov", name: "Moov Money", requiresOtp: false, payin: true, payout: true },
    ],
  },
  {
    code: "RW",
    name: "Rwanda",
    flag: "🇷🇼",
    phoneCode: "+250",
    phoneDigits: 9,
    phoneFormat: "7XXXXXXXX",
    currency: "RWF",
    operators: [
      { code: "mtn", name: "MTN Mobile Money", requiresOtp: false, payin: true, payout: true },
      { code: "airtel", name: "Airtel Money", requiresOtp: false, payin: true, payout: true },
    ],
  },
];

export const getCountryByCode = (code: string): AfribaPayCountry | undefined => {
  return AFRIBAPAY_COUNTRIES.find((c) => c.code === code);
};

export const getOperatorsForCountry = (countryCode: string): AfribaPayOperator[] => {
  const country = getCountryByCode(countryCode);
  return country?.operators || [];
};

export const getPayinOperators = (countryCode: string): AfribaPayOperator[] => {
  return getOperatorsForCountry(countryCode).filter((op) => op.payin);
};

export const getPayoutOperators = (countryCode: string): AfribaPayOperator[] => {
  return getOperatorsForCountry(countryCode).filter((op) => op.payout);
};

export const getAllCountryCodes = (): string[] => {
  return AFRIBAPAY_COUNTRIES.map((c) => c.code);
};

export const getCurrencyForCountry = (countryCode: string): string => {
  return getCountryByCode(countryCode)?.currency || "XOF";
};

export const CURRENCY_INFO: Record<string, { symbol: string; name: string }> = {
  XOF: { symbol: "FCFA", name: "Franc CFA (BCEAO)" },
  XAF: { symbol: "FCFA", name: "Franc CFA (BEAC)" },
  GNF: { symbol: "GNF", name: "Franc Guinéen" },
  CDF: { symbol: "CDF", name: "Franc Congolais" },
  RWF: { symbol: "RWF", name: "Franc Rwandais" },
};

export const getOtpInstructionsForOperator = (countryCode: string, operatorCode: string): string | null => {
  const country = countryCode.toUpperCase();
  const operator = operatorCode.toLowerCase();
  return OTP_INSTRUCTIONS[country]?.[operator] || null;
};

export const getOtpUssdCode = (countryCode: string, operatorCode: string): string | null => {
  const country = countryCode.toUpperCase();
  const operator = operatorCode.toLowerCase();
  return OTP_USSD_CODES[country]?.[operator] || null;
};

export const getWaveInstructions = (countryCode: string): string | null => {
  return WAVE_INSTRUCTIONS[countryCode.toUpperCase()] || null;
};

export const operatorRequiresOtpForCountry = (countryCode: string, operatorCode: string): boolean => {
  const country = getCountryByCode(countryCode.toUpperCase());
  if (!country) return false;
  const operator = country.operators.find(op => op.code === operatorCode.toLowerCase());
  return operator?.requiresOtp || false;
};

export const getPaymentInstructions = (countryCode: string, operatorCode: string): { 
  requiresOtp: boolean; 
  otpInstructions: string | null; 
  waveInstructions: string | null;
  generalInstructions: string;
} => {
  const country = countryCode.toUpperCase();
  const operator = operatorCode.toLowerCase();
  const requiresOtp = operatorRequiresOtpForCountry(country, operator);
  
  if (operator === "wave") {
    return {
      requiresOtp: false,
      otpInstructions: null,
      waveInstructions: getWaveInstructions(country),
      generalInstructions: "Vous recevrez un lien pour valider votre paiement via l'application Wave.",
    };
  }
  
  if (requiresOtp) {
    return {
      requiresOtp: true,
      otpInstructions: getOtpInstructionsForOperator(country, operator),
      waveInstructions: null,
      generalInstructions: "Veuillez generer un code OTP avant de continuer le paiement.",
    };
  }
  
  return {
    requiresOtp: false,
    otpInstructions: null,
    waveInstructions: null,
    generalInstructions: "Vous recevrez une notification sur votre telephone pour valider le paiement.",
  };
};
