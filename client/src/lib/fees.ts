// Calculate transaction fees - UNIFORM 6% for ALL countries and operators

export function getFeePercentage(country?: string): number {
  // Return as whole number (60 = 6%)
  // UNIFORM 6% fee for all countries including Benin
  return 60; // 6% for all countries
}

export function calculateIncomingFee(grossAmount: number, country?: string): {
  feeAmount: number;
  feePercentage: number;
  netAmount: number;
} {
  const feePercentage = getFeePercentage(country);
  const feeAmount = Math.floor((grossAmount * feePercentage) / 1000); // feePercentage is 30 or 60 (3% or 6%), divide by 1000 to get correct percentage
  const netAmount = grossAmount - feeAmount;

  return {
    feeAmount,
    feePercentage,
    netAmount,
  };
}

export function calculateOutgoingFee(requestedAmount: number, country?: string): {
  feeAmount: number;
  feePercentage: number;
  totalDeductedFromBalance: number;
} {
  const feePercentage = getFeePercentage(country);
  const feeAmount = Math.floor((requestedAmount * feePercentage) / 1000); // feePercentage is 30 or 60 (3% or 6%), divide by 1000 to get correct percentage
  const totalDeductedFromBalance = requestedAmount + feeAmount;

  return {
    feeAmount,
    feePercentage,
    totalDeductedFromBalance,
  };
}
