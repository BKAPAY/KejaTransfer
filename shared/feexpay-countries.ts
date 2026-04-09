export interface FeeXPayOperator {
  code: string;
  name: string;
  networkKey: string;
  requiresOtp: boolean;
  payin: boolean;
  payout: boolean;
}

export interface FeeXPayCountry {
  code: string;
  name: string;
  flag: string;
  phoneCode: string;
  phoneDigits: number;
  currency: string;
  operators: FeeXPayOperator[];
}

export const FEEXPAY_COUNTRIES: FeeXPayCountry[] = [
  {
    code: "BJ",
    name: "Bénin",
    flag: "🇧🇯",
    phoneCode: "+229",
    phoneDigits: 10,
    currency: "XOF",
    operators: [
      {
        code: "mtn",
        name: "MTN Mobile Money",
        networkKey: "mtn",
        requiresOtp: false,
        payin: true,
        payout: true,
      },
      {
        code: "moov",
        name: "Moov Money",
        networkKey: "moov",
        requiresOtp: false,
        payin: true,
        payout: true,
      },
      {
        code: "celtiis",
        name: "Celtiis Money",
        networkKey: "celtiis_bj",
        requiresOtp: false,
        payin: true,
        payout: true,
      },
      {
        code: "coris",
        name: "Coris Mobile Money",
        networkKey: "coris",
        requiresOtp: true,
        payin: true,
        payout: false,
      },
    ],
  },
  {
    code: "CI",
    name: "Côte d'Ivoire",
    flag: "🇨🇮",
    phoneCode: "+225",
    phoneDigits: 10,
    currency: "XOF",
    operators: [
      {
        code: "mtn",
        name: "MTN Mobile Money",
        networkKey: "mtn_ci",
        requiresOtp: false,
        payin: true,
        payout: true,
      },
    ],
  },
  {
    code: "CM",
    name: "Cameroun",
    flag: "🇨🇲",
    phoneCode: "+237",
    phoneDigits: 9,
    currency: "XAF",
    operators: [
      {
        code: "mtn",
        name: "MTN Mobile Money",
        networkKey: "mtn_cm",
        requiresOtp: false,
        payin: true,
        payout: true,
      },
    ],
  },
  {
    code: "BF",
    name: "Burkina Faso",
    flag: "🇧🇫",
    phoneCode: "+226",
    phoneDigits: 8,
    currency: "XOF",
    operators: [
      {
        code: "orange",
        name: "Orange Money",
        networkKey: "orange_bf",
        requiresOtp: false,
        payin: true,
        payout: true,
      },
      {
        code: "moov",
        name: "Moov Money",
        networkKey: "moov_bf",
        requiresOtp: false,
        payin: true,
        payout: true,
      },
    ],
  },
  {
    code: "SN",
    name: "Sénégal",
    flag: "🇸🇳",
    phoneCode: "+221",
    phoneDigits: 9,
    currency: "XOF",
    operators: [
      {
        code: "orange",
        name: "Orange Money",
        networkKey: "orange_sn",
        requiresOtp: false,
        payin: true,
        payout: true,
      },
      {
        code: "free",
        name: "Free Money",
        networkKey: "free_sn",
        requiresOtp: false,
        payin: true,
        payout: true,
      },
    ],
  },
];

export function getCurrencyForCountry(countryCode: string): string {
  const country = FEEXPAY_COUNTRIES.find(
    (c) => c.code === countryCode.toUpperCase()
  );
  return country?.currency || "XOF";
}

export function getNetworkKey(
  countryCode: string,
  operatorCode: string
): string | null {
  const country = FEEXPAY_COUNTRIES.find(
    (c) => c.code === countryCode.toUpperCase()
  );
  if (!country) return null;
  const operator = country.operators.find(
    (op) => op.code === operatorCode.toLowerCase()
  );
  return operator?.networkKey || null;
}

export function operatorRequiresOtp(
  countryCode: string,
  operatorCode: string
): boolean {
  const country = FEEXPAY_COUNTRIES.find(
    (c) => c.code === countryCode.toUpperCase()
  );
  if (!country) return false;
  const operator = country.operators.find(
    (op) => op.code === operatorCode.toLowerCase()
  );
  return operator?.requiresOtp || false;
}

export function operatorSupportsPayout(
  countryCode: string,
  operatorCode: string
): boolean {
  const country = FEEXPAY_COUNTRIES.find(
    (c) => c.code === countryCode.toUpperCase()
  );
  if (!country) return false;
  const operator = country.operators.find(
    (op) => op.code === operatorCode.toLowerCase()
  );
  return operator?.payout || false;
}

export function formatPhoneForFeeXPay(
  phone: string,
  countryCode: string
): string {
  let sanitized = phone.replace(/\s+/g, "").replace(/[^0-9]/g, "");
  const country = FEEXPAY_COUNTRIES.find(
    (c) => c.code === countryCode.toUpperCase()
  );
  if (!country) return sanitized;
  const dialDigits = country.phoneCode.replace("+", "");
  if (sanitized.startsWith(dialDigits)) {
    return sanitized;
  }
  return dialDigits + sanitized;
}
