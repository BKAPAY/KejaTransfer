export interface NowPaymentsCountry {
  code: string;
  name: string;
  flag: string;
  currency: string;
  operators: { code: string; name: string; payin: boolean; payout: boolean }[];
}

export const NOWPAYMENTS_COUNTRIES: NowPaymentsCountry[] = [
  {
    code: "BJ",
    name: "Benin",
    flag: "\u{1F1E7}\u{1F1EF}",
    currency: "XOF",
    operators: [{ code: "crypto", name: "Cryptomonnaie", payin: true, payout: true }],
  },
  {
    code: "CI",
    name: "Cote d'Ivoire",
    flag: "\u{1F1E8}\u{1F1EE}",
    currency: "XOF",
    operators: [{ code: "crypto", name: "Cryptomonnaie", payin: true, payout: true }],
  },
  {
    code: "SN",
    name: "Senegal",
    flag: "\u{1F1F8}\u{1F1F3}",
    currency: "XOF",
    operators: [{ code: "crypto", name: "Cryptomonnaie", payin: true, payout: true }],
  },
  {
    code: "TG",
    name: "Togo",
    flag: "\u{1F1F9}\u{1F1EC}",
    currency: "XOF",
    operators: [{ code: "crypto", name: "Cryptomonnaie", payin: true, payout: true }],
  },
  {
    code: "BF",
    name: "Burkina Faso",
    flag: "\u{1F1E7}\u{1F1EB}",
    currency: "XOF",
    operators: [{ code: "crypto", name: "Cryptomonnaie", payin: true, payout: true }],
  },
  {
    code: "CM",
    name: "Cameroun",
    flag: "\u{1F1E8}\u{1F1F2}",
    currency: "XAF",
    operators: [{ code: "crypto", name: "Cryptomonnaie", payin: true, payout: true }],
  },
  {
    code: "CD",
    name: "RD Congo",
    flag: "\u{1F1E8}\u{1F1E9}",
    currency: "CDF",
    operators: [{ code: "crypto", name: "Cryptomonnaie", payin: true, payout: true }],
  },
  {
    code: "CG",
    name: "Congo-Brazzaville",
    flag: "\u{1F1E8}\u{1F1EC}",
    currency: "XAF",
    operators: [{ code: "crypto", name: "Cryptomonnaie", payin: true, payout: true }],
  },
  {
    code: "ML",
    name: "Mali",
    flag: "\u{1F1F2}\u{1F1F1}",
    currency: "XOF",
    operators: [{ code: "crypto", name: "Cryptomonnaie", payin: true, payout: true }],
  },
];
