export interface AfribaPayOperator {
  code: string;
  name: string;
  requiresOtp: boolean;
  payin: boolean;
  payout: boolean;
}

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
      { code: "tmoney", name: "Togocell", requiresOtp: false, payin: true, payout: true },
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
      { code: "mpesa", name: "Mpesa", requiresOtp: false, payin: true, payout: true },
      { code: "africell", name: "Africell", requiresOtp: false, payin: true, payout: true },
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
