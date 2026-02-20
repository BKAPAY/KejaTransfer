export interface MoneyFusionOperator {
  code: string;
  name: string;
  withdrawMode: string;
  payin: false;
  payout: boolean;
}

export interface MoneyFusionCountry {
  code: string;
  name: string;
  countryCode: string;
  currency: string;
  operators: MoneyFusionOperator[];
}

export const MONEYFUSION_COUNTRIES: MoneyFusionCountry[] = [
  {
    code: "CI",
    name: "Cote d'Ivoire",
    countryCode: "ci",
    currency: "XOF",
    operators: [
      { code: "orange", name: "Orange Money", withdrawMode: "orange-money-ci", payin: false, payout: true },
      { code: "mtn", name: "MTN Mobile Money", withdrawMode: "mtn-ci", payin: false, payout: true },
      { code: "moov", name: "Moov Money", withdrawMode: "moov-ci", payin: false, payout: true },
      { code: "wave", name: "Wave", withdrawMode: "wave-ci", payin: false, payout: true },
    ],
  },
  {
    code: "SN",
    name: "Senegal",
    countryCode: "sn",
    currency: "XOF",
    operators: [
      { code: "orange", name: "Orange Money", withdrawMode: "orange-money-senegal", payin: false, payout: true },
      { code: "free", name: "Free Money", withdrawMode: "free-money-senegal", payin: false, payout: true },
      { code: "wave", name: "Wave", withdrawMode: "wave-senegal", payin: false, payout: true },
      { code: "expresso", name: "Expresso", withdrawMode: "expresso-senegal", payin: false, payout: true },
    ],
  },
  {
    code: "BF",
    name: "Burkina Faso",
    countryCode: "bf",
    currency: "XOF",
    operators: [
      { code: "orange", name: "Orange Money", withdrawMode: "orange-money-burkina", payin: false, payout: true },
      { code: "moov", name: "Moov Money", withdrawMode: "moov-burkina-faso", payin: false, payout: true },
    ],
  },
  {
    code: "BJ",
    name: "Benin",
    countryCode: "bj",
    currency: "XOF",
    operators: [
      { code: "mtn", name: "MTN Mobile Money", withdrawMode: "mtn-benin", payin: false, payout: true },
      { code: "moov", name: "Moov Money", withdrawMode: "moov-benin", payin: false, payout: true },
    ],
  },
  {
    code: "TG",
    name: "Togo",
    countryCode: "tg",
    currency: "XOF",
    operators: [
      { code: "togocom", name: "T-Money", withdrawMode: "t-money-togo", payin: false, payout: true },
      { code: "moov", name: "Moov Money", withdrawMode: "moov-togo", payin: false, payout: true },
    ],
  },
  {
    code: "ML",
    name: "Mali",
    countryCode: "ml",
    currency: "XOF",
    operators: [
      { code: "orange", name: "Orange Money", withdrawMode: "orange-money-mali", payin: false, payout: true },
    ],
  },
  {
    code: "CG",
    name: "Congo-Brazzaville",
    countryCode: "cg",
    currency: "XAF",
    operators: [
      { code: "mtn", name: "MTN Mobile Money", withdrawMode: "mtn-cg", payin: false, payout: true },
    ],
  },
  {
    code: "CM",
    name: "Cameroun",
    countryCode: "cm",
    currency: "XAF",
    operators: [
      { code: "orange", name: "Orange Money", withdrawMode: "orange-money-cm", payin: false, payout: true },
      { code: "mtn", name: "MTN Mobile Money", withdrawMode: "mtn-cm", payin: false, payout: true },
    ],
  },
  {
    code: "CD",
    name: "RD Congo",
    countryCode: "cd",
    currency: "CDF",
    operators: [
      { code: "airtel", name: "Airtel Money", withdrawMode: "airtel-money-cd", payin: false, payout: true },
    ],
  },
  {
    code: "GA",
    name: "Gabon",
    countryCode: "ga",
    currency: "XAF",
    operators: [
      { code: "airtel", name: "Airtel Money", withdrawMode: "airtel-money-ga", payin: false, payout: true },
    ],
  },
  {
    code: "GN",
    name: "Guinee Conakry",
    countryCode: "gn",
    currency: "GNF",
    operators: [
      { code: "orange", name: "Orange Money", withdrawMode: "orange-gn", payin: false, payout: true },
      { code: "mtn", name: "MTN Mobile Money", withdrawMode: "mtn-gn", payin: false, payout: true },
    ],
  },
  {
    code: "GM",
    name: "Gambie",
    countryCode: "gm",
    currency: "GMD",
    operators: [
      { code: "orange", name: "Orange Money", withdrawMode: "orange-gm", payin: false, payout: true },
    ],
  },
  {
    code: "GH",
    name: "Ghana",
    countryCode: "gh",
    currency: "GHS",
    operators: [
      { code: "airtel", name: "Airtel Money", withdrawMode: "airtel-money-gh", payin: false, payout: true },
      { code: "mtn", name: "MTN Mobile Money", withdrawMode: "mtn-gh", payin: false, payout: true },
      { code: "vodafone", name: "Vodafone Cash", withdrawMode: "vodafone-gh", payin: false, payout: true },
    ],
  },
  {
    code: "GW",
    name: "Guinee-Bissau",
    countryCode: "gw",
    currency: "XOF",
    operators: [
      { code: "mtn", name: "MTN Mobile Money", withdrawMode: "mtn-gw", payin: false, payout: true },
    ],
  },
  {
    code: "KE",
    name: "Kenya",
    countryCode: "ke",
    currency: "KES",
    operators: [
      { code: "mpesa", name: "M-Pesa", withdrawMode: "m-pesa-ke", payin: false, payout: true },
    ],
  },
  {
    code: "MR",
    name: "Mauritanie",
    countryCode: "mr",
    currency: "MRU",
    operators: [
      { code: "bankily", name: "Bankily", withdrawMode: "bankily-mr", payin: false, payout: true },
    ],
  },
  {
    code: "NE",
    name: "Niger",
    countryCode: "ne",
    currency: "XOF",
    operators: [
      { code: "airtel", name: "Airtel Money", withdrawMode: "airtel-money-ne", payin: false, payout: true },
      { code: "mtn", name: "MTN Mobile Money", withdrawMode: "mtn-ne", payin: false, payout: true },
    ],
  },
  {
    code: "UG",
    name: "Ouganda",
    countryCode: "ug",
    currency: "UGX",
    operators: [
      { code: "mtn", name: "MTN Mobile Money", withdrawMode: "mtn-ug", payin: false, payout: true },
    ],
  },
  {
    code: "CF",
    name: "Centrafrique",
    countryCode: "cf",
    currency: "XAF",
    operators: [
      { code: "orange", name: "Orange Money", withdrawMode: "orange-cf", payin: false, payout: true },
    ],
  },
  {
    code: "RW",
    name: "Rwanda",
    countryCode: "rw",
    currency: "RWF",
    operators: [
      { code: "mtn", name: "MTN Mobile Money", withdrawMode: "mtn-rw", payin: false, payout: true },
    ],
  },
  {
    code: "SL",
    name: "Sierra Leone",
    countryCode: "sl",
    currency: "SLE",
    operators: [
      { code: "africell", name: "Africell", withdrawMode: "africell-sl", payin: false, payout: true },
      { code: "orange", name: "Orange Money", withdrawMode: "orange-sl", payin: false, payout: true },
    ],
  },
  {
    code: "TZ",
    name: "Tanzanie",
    countryCode: "tz",
    currency: "TZS",
    operators: [
      { code: "airtel", name: "Airtel Money", withdrawMode: "airtel-money-tz", payin: false, payout: true },
      { code: "mpesa", name: "M-Pesa", withdrawMode: "m-pesa-tz", payin: false, payout: true },
      { code: "tigo", name: "Tigo Pesa", withdrawMode: "tigo-tz", payin: false, payout: true },
    ],
  },
  {
    code: "TD",
    name: "Tchad",
    countryCode: "td",
    currency: "XAF",
    operators: [
      { code: "airtel", name: "Airtel Money", withdrawMode: "airtel-money-td", payin: false, payout: true },
      { code: "moov", name: "Moov Money", withdrawMode: "moov-td", payin: false, payout: true },
    ],
  },
  {
    code: "ET",
    name: "Ethiopie",
    countryCode: "et",
    currency: "ETB",
    operators: [
      { code: "safaricom", name: "Safaricom", withdrawMode: "safaricom-et", payin: false, payout: true },
    ],
  },
];

export const MONEYFUSION_SUPPORTED_COUNTRIES = MONEYFUSION_COUNTRIES.map(c => c.countryCode);

export const MONEYFUSION_COUNTRY_CURRENCIES: Record<string, string> = {};
MONEYFUSION_COUNTRIES.forEach(c => {
  MONEYFUSION_COUNTRY_CURRENCIES[c.countryCode] = c.currency;
});

export function getMoneyFusionWithdrawMode(countryCode: string, operatorCode: string): string | null {
  const country = MONEYFUSION_COUNTRIES.find(c => c.countryCode === countryCode.toLowerCase() || c.code === countryCode.toUpperCase());
  if (!country) return null;
  const operator = country.operators.find(o => o.code === operatorCode.toLowerCase());
  if (!operator) return null;
  return operator.withdrawMode;
}

export function isMoneyFusionSupported(countryCode: string, operatorCode: string): boolean {
  return getMoneyFusionWithdrawMode(countryCode, operatorCode) !== null;
}

export function getMoneyFusionCurrency(countryCode: string): string {
  return MONEYFUSION_COUNTRY_CURRENCIES[countryCode.toLowerCase()] || "XOF";
}
