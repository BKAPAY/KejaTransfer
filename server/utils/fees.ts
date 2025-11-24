/**
 * BKApay Fee Calculation System
 * 
 * Benin (BJ): 3% transaction fee
 * All other countries: 6% transaction fee
 * 
 * CRITICAL LOGIC:
 * 
 * INCOMING PAYMENTS (deposits, payment links, merchant links, API):
 * - Client pays GROSS amount (e.g., 2000 XOF) to Paydunya
 * - Paydunya validates GROSS amount (SMS confirms 2000)
 * - Transaction records GROSS amount (2000)
 * - User receives NET amount (1940 for Benin 3%)
 * - History displays: "Dépôt de 2000 XOF"
 * - Balance credited: 1940 XOF
 * 
 * OUTGOING PAYMENTS (withdrawals, transfers):
 * - User requests NET amount (e.g., 2000 XOF)
 * - Balance debited: NET + fee (2060 for Benin)
 * - Paydunya receives NET amount (2000)
 * - Transaction records NET amount (2000)
 * - History displays: "Retrait de 2000 XOF"
 */

export function getFeePercentage(country?: string): number {
  // Return as whole number (30 = 3%, 60 = 6%)
  if (country === "BJ") return 30; // 3%
  return 60; // 6% for all other countries
}

/**
 * Calculate fees for INCOMING payments (deposits, payment links, etc.)
 * 
 * @param grossAmount - The GROSS amount the client pays (e.g., 2000)
 * @param country - Country code (BJ = 3%, others = 6%)
 * @returns {grossAmount: 2000, feeAmount: 60, netAmount: 1940}
 * 
 * Usage:
 * - Store grossAmount in transaction.amount
 * - Credit netAmount to user balance
 * - Display grossAmount in transaction history
 */
export function calculateIncomingFee(grossAmount: number, country?: string): {
  grossAmount: number;
  feeAmount: number;
  feePercentage: number;
  netAmount: number;
} {
  const feePercentage = getFeePercentage(country);
  const feeAmount = Math.floor((grossAmount * feePercentage) / 1000);
  const netAmount = grossAmount - feeAmount;

  return {
    grossAmount,
    feeAmount,
    feePercentage,
    netAmount,
  };
}

/**
 * Calculate fees for OUTGOING payments (withdrawals, transfers)
 * 
 * @param netAmount - The NET amount user wants to send (e.g., 2000)
 * @param country - Country code (BJ = 3%, others = 6%)
 * @returns {netAmount: 2000, feeAmount: 60, totalDeductedFromBalance: 2060}
 * 
 * Usage:
 * - Debit totalDeductedFromBalance from user balance (2060)
 * - Send netAmount to Paydunya (2000)
 * - Store netAmount in transaction.amount (2000)
 * - Display netAmount in transaction history (2000)
 */
export function calculateOutgoingFee(netAmount: number, country?: string): {
  netAmount: number;
  feeAmount: number;
  feePercentage: number;
  totalDeductedFromBalance: number;
} {
  const feePercentage = getFeePercentage(country);
  const feeAmount = Math.floor((netAmount * feePercentage) / 1000);
  const totalDeductedFromBalance = netAmount + feeAmount;

  return {
    netAmount,
    feeAmount,
    feePercentage,
    totalDeductedFromBalance,
  };
}
