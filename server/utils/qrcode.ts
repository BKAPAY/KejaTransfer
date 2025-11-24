// QR Code generation utilities for Paydunya SoftPay integration
export function generateQRCodeData(checkoutUrl: string): string {
  return checkoutUrl;
}

export function getPaydunyaSoftPayOperator(operator: string, country: string): string {
  const operatorMap: Record<string, Record<string, string>> = {
    SN: { orange: "om_sn", wave: "wave_sn", free: "free_sn", expresso: "expresso_sn", wizall: "wizall_sn" },
    CI: { orange: "om_ci", mtn: "mtn_ci", moov: "moov_ci", wave: "wave_ci" },
    BF: { orange: "om_bf", moov: "moov_bf" },
    BJ: { moov: "moov_bj", mtn: "mtn_bj" },
    TG: { tmoney: "tmoney_tg", moov: "moov_tg" },
    ML: { orange: "om_ml", moov: "moov_ml" },
  };
  return operatorMap[country]?.[operator] || operator;
}
