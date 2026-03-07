export interface PaydunyaOperator {
  code: string;
  name: string;
  requiresOtp: boolean;
  payin: boolean;
  payout: boolean;
}

export interface PaydunyaCountry {
  code: string;
  name: string;
  flag: string;
  phoneCode: string;
  phoneDigits: number;
  phoneFormat: string;
  currency: string;
  operators: PaydunyaOperator[];
}

export const PAYDUNYA_COUNTRIES: PaydunyaCountry[] = [
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
      { code: "expresso", name: "Expresso", requiresOtp: false, payin: true, payout: false },
      { code: "wave", name: "Wave", requiresOtp: false, payin: true, payout: true },
      { code: "wizall", name: "Wizall", requiresOtp: false, payin: true, payout: false },
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
    code: "BJ",
    name: "Bénin",
    flag: "🇧🇯",
    phoneCode: "+229",
    phoneDigits: 10,
    phoneFormat: "01XXXXXXXX",
    currency: "XOF",
    operators: [
      { code: "mtn", name: "MTN Mobile Money", requiresOtp: false, payin: true, payout: true },
      { code: "moov", name: "Moov Money", requiresOtp: false, payin: true, payout: true },
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
      { code: "tmoney", name: "T-Money", requiresOtp: false, payin: true, payout: true },
      { code: "moov", name: "Moov Money", requiresOtp: false, payin: true, payout: true },
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
      { code: "mtn", name: "MTN Mobile Money", requiresOtp: false, payin: true, payout: true },
      { code: "moov", name: "Moov Money", requiresOtp: false, payin: true, payout: true },
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
    code: "CM",
    name: "Cameroun",
    flag: "🇨🇲",
    phoneCode: "+237",
    phoneDigits: 9,
    phoneFormat: "6XXXXXXXX",
    currency: "XAF",
    operators: [
      { code: "mtn", name: "MTN Mobile Money", requiresOtp: false, payin: true, payout: true },
    ],
  },
];

export const getPaydunyaCountryByCode = (code: string): PaydunyaCountry | undefined => {
  return PAYDUNYA_COUNTRIES.find((c) => c.code === code);
};

export const getPaydunyaOperatorsForCountry = (countryCode: string): PaydunyaOperator[] => {
  const country = getPaydunyaCountryByCode(countryCode);
  return country?.operators || [];
};

export const getPaydunyaPayinOperators = (countryCode: string): PaydunyaOperator[] => {
  return getPaydunyaOperatorsForCountry(countryCode).filter((op) => op.payin);
};

export const getPaydunyaPayoutOperators = (countryCode: string): PaydunyaOperator[] => {
  return getPaydunyaOperatorsForCountry(countryCode).filter((op) => op.payout);
};

export const getAllPaydunyaCountryCodes = (): string[] => {
  return PAYDUNYA_COUNTRIES.map((c) => c.code);
};
