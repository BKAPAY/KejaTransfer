export interface MbiyoPayOperator {
  code: string;
  name: string;
  requiresOtp: boolean;
  requiresRedirect: boolean;
  payin: boolean;
  payout: boolean;
}

export interface MbiyoPayCountry {
  code: string;
  name: string;
  flag: string;
  phoneCode: string;
  phoneDigits: number;
  phoneFormat: string;
  currency: string;
  currencies?: string[];
  operators: MbiyoPayOperator[];
}

export const MBIYOPAY_COUNTRIES: MbiyoPayCountry[] = [
  {
    code: "BJ",
    name: "Bénin",
    flag: "🇧🇯",
    phoneCode: "+229",
    phoneDigits: 10,
    phoneFormat: "01XXXXXXXX",
    currency: "XOF",
    operators: [
      { code: "mtn", name: "MTN Mobile Money", requiresOtp: false, requiresRedirect: false, payin: true, payout: true },
      { code: "moov", name: "Moov Money", requiresOtp: false, requiresRedirect: false, payin: true, payout: true },
      { code: "celtiis", name: "Celtiis", requiresOtp: false, requiresRedirect: false, payin: true, payout: true },
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
      { code: "orange", name: "Orange Money", requiresOtp: true, requiresRedirect: true, payin: true, payout: true },
      { code: "moov", name: "Moov Money", requiresOtp: false, requiresRedirect: false, payin: true, payout: true },
      { code: "coris", name: "Coris Money", requiresOtp: false, requiresRedirect: false, payin: true, payout: true },
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
      { code: "orange", name: "Orange Money", requiresOtp: true, requiresRedirect: true, payin: true, payout: true },
      { code: "mtn", name: "MTN Mobile Money", requiresOtp: false, requiresRedirect: false, payin: true, payout: true },
      { code: "wave", name: "Wave", requiresOtp: false, requiresRedirect: true, payin: true, payout: true },
      { code: "moov", name: "Moov Money", requiresOtp: false, requiresRedirect: false, payin: true, payout: true },
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
      { code: "orange", name: "Orange Money", requiresOtp: true, requiresRedirect: true, payin: true, payout: true },
      { code: "free", name: "Free Money", requiresOtp: false, requiresRedirect: false, payin: true, payout: true },
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
      { code: "moov", name: "Moov Money", requiresOtp: false, requiresRedirect: false, payin: true, payout: true },
      { code: "togocom", name: "TogoCom", requiresOtp: false, requiresRedirect: false, payin: true, payout: true },
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
      { code: "orange", name: "Orange Money", requiresOtp: true, requiresRedirect: true, payin: true, payout: true },
      { code: "moov", name: "Moov Money", requiresOtp: false, requiresRedirect: false, payin: true, payout: true },
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
      { code: "orange", name: "Orange Money", requiresOtp: true, requiresRedirect: true, payin: true, payout: true },
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
      { code: "orange", name: "Orange Money", requiresOtp: false, requiresRedirect: false, payin: true, payout: true },
      { code: "mtn", name: "MTN Mobile Money", requiresOtp: false, requiresRedirect: false, payin: true, payout: true },
    ],
  },
  {
    code: "CG",
    name: "Congo-Brazzaville",
    flag: "🇨🇬",
    phoneCode: "+242",
    phoneDigits: 9,
    phoneFormat: "0XXXXXXXX",
    currency: "XAF",
    operators: [
      { code: "mtn", name: "MTN Mobile Money", requiresOtp: false, requiresRedirect: false, payin: true, payout: true },
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
    currencies: ["CDF", "USD"],
    operators: [
      { code: "mpesa", name: "M-Pesa", requiresOtp: false, requiresRedirect: false, payin: true, payout: true },
      { code: "airtel", name: "Airtel Money", requiresOtp: false, requiresRedirect: false, payin: true, payout: true },
      { code: "orange", name: "Orange Money", requiresOtp: true, requiresRedirect: true, payin: true, payout: true },
      { code: "afrimoney", name: "Afrimoney", requiresOtp: false, requiresRedirect: false, payin: true, payout: true },
    ],
  },
  {
    code: "GM",
    name: "Gambie",
    flag: "🇬🇲",
    phoneCode: "+220",
    phoneDigits: 7,
    phoneFormat: "XXXXXXX",
    currency: "GMD",
    operators: [
      { code: "afrimoney", name: "Afrimoney", requiresOtp: false, requiresRedirect: false, payin: true, payout: true },
      { code: "qmoney", name: "QMoney", requiresOtp: false, requiresRedirect: false, payin: true, payout: true },
      { code: "wave", name: "Wave", requiresOtp: false, requiresRedirect: true, payin: true, payout: true },
    ],
  },
];

export const getMbiyoPayCountryByCode = (code: string): MbiyoPayCountry | undefined => {
  return MBIYOPAY_COUNTRIES.find((c) => c.code === code);
};

export const getMbiyoPayOperatorsForCountry = (countryCode: string): MbiyoPayOperator[] => {
  const country = getMbiyoPayCountryByCode(countryCode);
  return country?.operators || [];
};

export const getMbiyoPayPayinOperators = (countryCode: string): MbiyoPayOperator[] => {
  return getMbiyoPayOperatorsForCountry(countryCode).filter((op) => op.payin);
};

export const getMbiyoPayPayoutOperators = (countryCode: string): MbiyoPayOperator[] => {
  return getMbiyoPayOperatorsForCountry(countryCode).filter((op) => op.payout);
};

export const getAllMbiyoPayCountryCodes = (): string[] => {
  return MBIYOPAY_COUNTRIES.map((c) => c.code);
};

export const getMbiyoPayCurrencyForCountry = (countryCode: string): string => {
  return getMbiyoPayCountryByCode(countryCode)?.currency || "XOF";
};

export const MBIYOPAY_CURRENCY_INFO: Record<string, { symbol: string; name: string }> = {
  XOF: { symbol: "FCFA", name: "Franc CFA (BCEAO)" },
  XAF: { symbol: "FCFA", name: "Franc CFA (BEAC)" },
  GNF: { symbol: "GNF", name: "Franc Guinéen" },
  CDF: { symbol: "FC", name: "Franc Congolais" },
  USD: { symbol: "$", name: "Dollar US" },
  GMD: { symbol: "GMD", name: "Dalasi Gambien" },
};

export const getMbiyoPayCurrenciesForCountry = (countryCode: string): string[] => {
  const country = getMbiyoPayCountryByCode(countryCode);
  if (country?.currencies && country.currencies.length > 0) {
    return country.currencies;
  }
  return [country?.currency || "XOF"];
};

export const hasMultipleCurrencies = (countryCode: string): boolean => {
  const country = getMbiyoPayCountryByCode(countryCode);
  return (country?.currencies?.length || 0) > 1;
};

export const operatorRequiresRedirect = (countryCode: string, operatorCode: string): boolean => {
  const operators = getMbiyoPayOperatorsForCountry(countryCode);
  const operator = operators.find((op) => op.code.toLowerCase() === operatorCode.toLowerCase());
  return operator?.requiresRedirect || false;
};

export const operatorRequiresOtp = (countryCode: string, operatorCode: string): boolean => {
  const operators = getMbiyoPayOperatorsForCountry(countryCode);
  const operator = operators.find((op) => op.code.toLowerCase() === operatorCode.toLowerCase());
  return operator?.requiresOtp || false;
};
