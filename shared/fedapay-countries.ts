export interface FedaPayOperator {
  code: string;
  name: string;
  requiresOtp: boolean;
  payin: boolean;
  payout: boolean;
}

export interface FedaPayCountry {
  code: string;
  name: string;
  flag: string;
  phoneCode: string;
  phoneDigits: number;
  phoneFormat: string;
  currency: string;
  operators: FedaPayOperator[];
}

export const FEDAPAY_COUNTRIES: FedaPayCountry[] = [
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
      { code: "celtiis", name: "Celtiis", requiresOtp: false, payin: true, payout: true },
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
      { code: "togocom", name: "TogoCom", requiresOtp: false, payin: true, payout: true },
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
      { code: "mtn", name: "MTN Mobile Money", requiresOtp: false, payin: true, payout: true },
      { code: "moov", name: "Moov Money", requiresOtp: false, payin: false, payout: true },
      { code: "wave", name: "Wave", requiresOtp: false, payin: false, payout: true },
      { code: "orange", name: "Orange Money", requiresOtp: false, payin: false, payout: true },
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
      { code: "free", name: "Free Money", requiresOtp: false, payin: true, payout: false },
      { code: "wave", name: "Wave", requiresOtp: false, payin: false, payout: true },
      { code: "orange", name: "Orange Money", requiresOtp: false, payin: false, payout: true },
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
      { code: "moov", name: "Moov Money", requiresOtp: false, payin: false, payout: true },
      { code: "orange", name: "Orange Money", requiresOtp: false, payin: false, payout: true },
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
      { code: "airtel", name: "Airtel Money", requiresOtp: false, payin: true, payout: false },
    ],
  },
];

export const getFedaPayCountryByCode = (code: string): FedaPayCountry | undefined => {
  return FEDAPAY_COUNTRIES.find((c) => c.code === code);
};

export const getFedaPayOperatorsForCountry = (countryCode: string): FedaPayOperator[] => {
  const country = getFedaPayCountryByCode(countryCode);
  return country?.operators || [];
};

export const getFedaPayPayinOperators = (countryCode: string): FedaPayOperator[] => {
  return getFedaPayOperatorsForCountry(countryCode).filter((op) => op.payin);
};

export const getFedaPayPayoutOperators = (countryCode: string): FedaPayOperator[] => {
  return getFedaPayOperatorsForCountry(countryCode).filter((op) => op.payout);
};

export const getAllFedaPayCountryCodes = (): string[] => {
  return FEDAPAY_COUNTRIES.map((c) => c.code);
};
