export interface PawaPayOperator {
  code: string;
  name: string;
  correspondent: string;
  payin: boolean;
  payout: boolean;
  requiresOtp?: boolean;
  currency?: string;
}

export interface PawaPayCountry {
  code: string;
  iso3: string;
  name: string;
  flag: string;
  phoneCode: string;
  phoneDigits: number;
  phoneFormat: string;
  currency: string;
  currencies?: string[];
  operators: PawaPayOperator[];
}

export const PAWAPAY_COUNTRIES: PawaPayCountry[] = [
  {
    code: "BJ",
    iso3: "BEN",
    name: "Bénin",
    flag: "🇧🇯",
    phoneCode: "+229",
    phoneDigits: 10,
    phoneFormat: "01XXXXXXXX",
    currency: "XOF",
    operators: [
      { code: "mtn", name: "MTN Mobile Money", correspondent: "MTN_MOMO_BEN", payin: true, payout: true },
      { code: "moov", name: "Moov Money", correspondent: "MOOV_BEN", payin: true, payout: true },
    ],
  },
  {
    code: "BF",
    iso3: "BFA",
    name: "Burkina Faso",
    flag: "🇧🇫",
    phoneCode: "+226",
    phoneDigits: 8,
    phoneFormat: "7XXXXXXX",
    currency: "XOF",
    operators: [
      { code: "orange", name: "Orange Money", correspondent: "ORANGE_BFA", payin: true, payout: true, requiresOtp: true },
      { code: "moov", name: "Moov Money", correspondent: "MOOV_BFA", payin: true, payout: true },
    ],
  },
  {
    code: "CM",
    iso3: "CMR",
    name: "Cameroun",
    flag: "🇨🇲",
    phoneCode: "+237",
    phoneDigits: 9,
    phoneFormat: "6XXXXXXXX",
    currency: "XAF",
    operators: [
      { code: "mtn", name: "MTN Mobile Money", correspondent: "MTN_MOMO_CMR", payin: true, payout: true },
      { code: "orange", name: "Orange Money", correspondent: "ORANGE_CMR", payin: true, payout: true },
    ],
  },
  {
    code: "CG",
    iso3: "COG",
    name: "Congo-Brazzaville",
    flag: "🇨🇬",
    phoneCode: "+242",
    phoneDigits: 9,
    phoneFormat: "0XXXXXXXX",
    currency: "XAF",
    operators: [
      { code: "mtn", name: "MTN Mobile Money", correspondent: "MTN_MOMO_COG", payin: true, payout: true },
      { code: "airtel", name: "Airtel Money", correspondent: "AIRTEL_COG", payin: true, payout: true },
    ],
  },
  {
    code: "CD",
    iso3: "COD",
    name: "RD Congo",
    flag: "🇨🇩",
    phoneCode: "+243",
    phoneDigits: 9,
    phoneFormat: "8XXXXXXXX",
    currency: "CDF",
    currencies: ["CDF", "USD"],
    operators: [
      { code: "airtel", name: "Airtel Money", correspondent: "AIRTEL_COD", payin: true, payout: true, currency: "CDF", currencies: ["CDF", "USD"] },
      { code: "orange", name: "Orange Money", correspondent: "ORANGE_COD", payin: true, payout: true, currency: "CDF", currencies: ["CDF", "USD"] },
      { code: "vodacom", name: "Vodacom M-Pesa", correspondent: "VODACOM_MPESA_COD", payin: true, payout: true, currency: "USD", currencies: ["CDF", "USD"] },
    ],
  },
  {
    code: "CI",
    iso3: "CIV",
    name: "Côte d'Ivoire",
    flag: "🇨🇮",
    phoneCode: "+225",
    phoneDigits: 10,
    phoneFormat: "0XXXXXXXXX",
    currency: "XOF",
    operators: [
      { code: "mtn", name: "MTN Mobile Money", correspondent: "MTN_MOMO_CIV", payin: true, payout: true },
      { code: "orange", name: "Orange Money", correspondent: "ORANGE_CIV", payin: true, payout: true, requiresOtp: true },
    ],
  },
  {
    code: "GA",
    iso3: "GAB",
    name: "Gabon",
    flag: "🇬🇦",
    phoneCode: "+241",
    phoneDigits: 7,
    phoneFormat: "0XXXXXX",
    currency: "XAF",
    operators: [
      { code: "airtel", name: "Airtel Money", correspondent: "AIRTEL_GAB", payin: true, payout: true },
    ],
  },
  {
    code: "GH",
    iso3: "GHA",
    name: "Ghana",
    flag: "🇬🇭",
    phoneCode: "+233",
    phoneDigits: 9,
    phoneFormat: "XXXXXXXXX",
    currency: "GHS",
    operators: [
      { code: "mtn", name: "MTN Mobile Money", correspondent: "MTN_MOMO_GHA", payin: true, payout: true },
      { code: "vodafone", name: "Vodafone Cash", correspondent: "VODAFONE_GHA", payin: true, payout: true },
      { code: "airteltigo", name: "AirtelTigo Money", correspondent: "AIRTELTIGO_GHA", payin: true, payout: true },
    ],
  },
  {
    code: "KE",
    iso3: "KEN",
    name: "Kenya",
    flag: "🇰🇪",
    phoneCode: "+254",
    phoneDigits: 9,
    phoneFormat: "7XXXXXXXX",
    currency: "KES",
    operators: [
      { code: "mpesa", name: "M-Pesa (Safaricom)", correspondent: "MPESA_KEN", payin: true, payout: true },
    ],
  },
  {
    code: "LS",
    iso3: "LSO",
    name: "Lesotho",
    flag: "🇱🇸",
    phoneCode: "+266",
    phoneDigits: 8,
    phoneFormat: "XXXXXXXX",
    currency: "LSL",
    operators: [
      { code: "mpesa", name: "M-Pesa", correspondent: "MPESA_LSO", payin: true, payout: true },
    ],
  },
  {
    code: "MW",
    iso3: "MWI",
    name: "Malawi",
    flag: "🇲🇼",
    phoneCode: "+265",
    phoneDigits: 9,
    phoneFormat: "XXXXXXXXX",
    currency: "MWK",
    operators: [
      { code: "airtel", name: "Airtel Money", correspondent: "AIRTEL_MWI", payin: true, payout: true },
      { code: "tnm", name: "TNM Mpamba", correspondent: "TNM_MWI", payin: true, payout: true },
    ],
  },
  {
    code: "MZ",
    iso3: "MOZ",
    name: "Mozambique",
    flag: "🇲🇿",
    phoneCode: "+258",
    phoneDigits: 9,
    phoneFormat: "8XXXXXXXX",
    currency: "MZN",
    operators: [
      { code: "mpesa", name: "M-Pesa", correspondent: "MPESA_MOZ", payin: true, payout: true },
      { code: "movitel", name: "Movitel", correspondent: "MOVITEL_MOZ", payin: true, payout: true },
    ],
  },
  {
    code: "NG",
    iso3: "NGA",
    name: "Nigeria",
    flag: "🇳🇬",
    phoneCode: "+234",
    phoneDigits: 10,
    phoneFormat: "XXXXXXXXXX",
    currency: "NGN",
    operators: [
      { code: "airtel", name: "Airtel Money", correspondent: "AIRTEL_NGA", payin: true, payout: true },
      { code: "mtn", name: "MTN MoMo", correspondent: "MTN_MOMO_NGA", payin: true, payout: true },
    ],
  },
  {
    code: "RW",
    iso3: "RWA",
    name: "Rwanda",
    flag: "🇷🇼",
    phoneCode: "+250",
    phoneDigits: 9,
    phoneFormat: "7XXXXXXXX",
    currency: "RWF",
    operators: [
      { code: "airtel", name: "Airtel Money", correspondent: "AIRTEL_RWA", payin: true, payout: true },
      { code: "mtn", name: "MTN MoMo", correspondent: "MTN_MOMO_RWA", payin: true, payout: true },
    ],
  },
  {
    code: "SN",
    iso3: "SEN",
    name: "Sénégal",
    flag: "🇸🇳",
    phoneCode: "+221",
    phoneDigits: 9,
    phoneFormat: "7XXXXXXXX",
    currency: "XOF",
    operators: [
      { code: "free", name: "Free Money", correspondent: "FREE_SEN", payin: true, payout: true },
      { code: "orange", name: "Orange Money", correspondent: "ORANGE_SEN", payin: true, payout: true },
    ],
  },
  {
    code: "SL",
    iso3: "SLE",
    name: "Sierra Leone",
    flag: "🇸🇱",
    phoneCode: "+232",
    phoneDigits: 8,
    phoneFormat: "XXXXXXXX",
    currency: "SLE",
    operators: [
      { code: "orange", name: "Orange Money", correspondent: "ORANGE_SLE", payin: true, payout: true },
    ],
  },
  {
    code: "TZ",
    iso3: "TZA",
    name: "Tanzanie",
    flag: "🇹🇿",
    phoneCode: "+255",
    phoneDigits: 9,
    phoneFormat: "7XXXXXXXX",
    currency: "TZS",
    operators: [
      { code: "airtel", name: "Airtel Money", correspondent: "AIRTEL_TZA", payin: true, payout: true },
      { code: "tigo", name: "Tigo Pesa", correspondent: "TIGO_TZA", payin: true, payout: true },
      { code: "halotel", name: "Halotel", correspondent: "HALOTEL_TZA", payin: true, payout: true },
    ],
  },
  {
    code: "UG",
    iso3: "UGA",
    name: "Ouganda",
    flag: "🇺🇬",
    phoneCode: "+256",
    phoneDigits: 9,
    phoneFormat: "7XXXXXXXX",
    currency: "UGX",
    operators: [
      { code: "mtn", name: "MTN MoMo", correspondent: "MTN_MOMO_UGA", payin: true, payout: true },
      { code: "airtel", name: "Airtel Money", correspondent: "AIRTEL_OAPI_UGA", payin: true, payout: true },
    ],
  },
  {
    code: "ZM",
    iso3: "ZMB",
    name: "Zambie",
    flag: "🇿🇲",
    phoneCode: "+260",
    phoneDigits: 9,
    phoneFormat: "9XXXXXXXX",
    currency: "ZMW",
    operators: [
      { code: "airtel", name: "Airtel Money", correspondent: "AIRTEL_OAPI_ZMB", payin: true, payout: true },
      { code: "mtn", name: "MTN MoMo", correspondent: "MTN_MOMO_ZMB", payin: true, payout: true },
      { code: "zamtel", name: "Zamtel Kwacha", correspondent: "ZAMTEL_ZMB", payin: true, payout: true },
    ],
  },
];

export function getCurrencyForCountry(countryCode: string): string {
  const country = PAWAPAY_COUNTRIES.find(
    c => c.code.toUpperCase() === countryCode.toUpperCase() || c.iso3.toUpperCase() === countryCode.toUpperCase()
  );
  return country?.currency || "XOF";
}

export function getCurrenciesForCountry(countryCode: string): string[] {
  const country = PAWAPAY_COUNTRIES.find(
    c => c.code.toUpperCase() === countryCode.toUpperCase() || c.iso3.toUpperCase() === countryCode.toUpperCase()
  );
  return country?.currencies || [country?.currency || "XOF"];
}

export function hasMultiplePawaPayCurrencies(countryCode: string): boolean {
  const country = PAWAPAY_COUNTRIES.find(
    c => c.code.toUpperCase() === countryCode.toUpperCase() || c.iso3.toUpperCase() === countryCode.toUpperCase()
  );
  return (country?.currencies?.length || 0) > 1;
}

export function getCurrencyForOperator(countryCode: string, operatorCode: string): string {
  const country = PAWAPAY_COUNTRIES.find(
    c => c.code.toUpperCase() === countryCode.toUpperCase() || c.iso3.toUpperCase() === countryCode.toUpperCase()
  );
  if (!country) return "XOF";
  const op = country.operators.find(o => o.code.toLowerCase() === operatorCode.toLowerCase());
  return op?.currency || country.currency;
}

export function operatorSupportsCurrency(countryCode: string, operatorCode: string, currency: string): boolean {
  const country = PAWAPAY_COUNTRIES.find(
    c => c.code.toUpperCase() === countryCode.toUpperCase() || c.iso3.toUpperCase() === countryCode.toUpperCase()
  );
  if (!country) return false;
  const op = country.operators.find(o => o.code.toLowerCase() === operatorCode.toLowerCase());
  if (!op) return true;
  const opCurrencies = (op as any).currencies as string[] | undefined;
  if (opCurrencies && opCurrencies.length > 0) {
    return opCurrencies.map(c => c.toUpperCase()).includes(currency.toUpperCase());
  }
  return (op.currency || country.currency).toUpperCase() === currency.toUpperCase();
}

export function getCorrespondent(countryCode: string, operatorCode: string): string | null {
  const country = PAWAPAY_COUNTRIES.find(
    c => c.code.toUpperCase() === countryCode.toUpperCase() || c.iso3.toUpperCase() === countryCode.toUpperCase()
  );
  if (!country) return null;
  const op = country.operators.find(o => o.code.toLowerCase() === operatorCode.toLowerCase());
  return op?.correspondent || null;
}

export function getIso3ForCountry(countryCode: string): string | null {
  const country = PAWAPAY_COUNTRIES.find(
    c => c.code.toUpperCase() === countryCode.toUpperCase()
  );
  return country?.iso3 || null;
}

export function getPayinOperatorsForCountry(countryCode: string): PawaPayOperator[] {
  const country = PAWAPAY_COUNTRIES.find(
    c => c.code.toUpperCase() === countryCode.toUpperCase()
  );
  return country?.operators.filter(o => o.payin) || [];
}

export function getPayoutOperatorsForCountry(countryCode: string): PawaPayOperator[] {
  const country = PAWAPAY_COUNTRIES.find(
    c => c.code.toUpperCase() === countryCode.toUpperCase()
  );
  return country?.operators.filter(o => o.payout) || [];
}

export function pawaPayOperatorRequiresOtp(countryCode: string, operatorCode: string): boolean {
  const country = PAWAPAY_COUNTRIES.find(
    c => c.code.toUpperCase() === countryCode.toUpperCase()
  );
  if (!country) return false;
  const op = country.operators.find(o => o.code.toLowerCase() === operatorCode.toLowerCase());
  return op?.requiresOtp === true;
}

export interface PawaPayOtpInstructions {
  ussdCode: string;
  instructions: string;
  hint: string;
}

export function getPawaPayOtpInstructions(countryCode: string): PawaPayOtpInstructions {
  const country = countryCode.toUpperCase();

  const instructions: Record<string, PawaPayOtpInstructions> = {
    BF: {
      ussdCode: "*144*4*6#",
      instructions:
        "Composez *144*4*6# sur votre telephone Orange, entrez votre code secret, puis saisissez le code OTP recu par SMS",
      hint: "Entrez votre code PIN Orange Money quand demande pour generer le code OTP",
    },
    CI: {
      ussdCode: "#144*82#",
      instructions:
        "Composez #144*82# sur votre telephone Orange, selectionnez l'option 2 pour generer votre code de paiement temporaire, puis saisissez ce code",
      hint: "Selectionnez l'option 2 dans le menu pour obtenir le code de paiement a 4 chiffres",
    },
  };

  return (
    instructions[country] || {
      ussdCode: "#144#",
      instructions:
        "Composez #144# sur votre telephone Orange pour generer votre code de paiement OTP, puis saisissez ce code",
      hint: "Suivez les instructions du menu Orange Money pour obtenir votre code de paiement",
    }
  );
}

export function getOperatorCodesForCurrency(countryCode: string, currency: string): string[] {
  const country = PAWAPAY_COUNTRIES.find(
    c => c.code.toUpperCase() === countryCode.toUpperCase() || c.iso3.toUpperCase() === countryCode.toUpperCase()
  );
  if (!country || !country.currencies || country.currencies.length <= 1) return [];
  return country.operators
    .filter(o => {
      if (!o.payin) return false;
      const operatorCurrencies = (o as any).currencies as string[] | undefined;
      if (operatorCurrencies && operatorCurrencies.length > 0) {
        return operatorCurrencies.map(c => c.toUpperCase()).includes(currency.toUpperCase());
      }
      return o.currency?.toUpperCase() === currency.toUpperCase();
    })
    .map(o => o.code);
}

export const PAWAPAY_SUPPORTED_COUNTRIES = PAWAPAY_COUNTRIES.map(c => c.code);
