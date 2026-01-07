/**
 * BKApay Fee Calculation System
 * 
 * UNIVERSAL FEE: 6% for ALL countries and operators
 * 
 * CRITICAL LOGIC:
 * 
 * INCOMING PAYMENTS (deposits, payment links, merchant links, API):
 * - Client pays GROSS amount (e.g., 2000 XOF) to Paydunya
 * - Paydunya validates GROSS amount (SMS confirms 2000)
 * - Transaction records GROSS amount (2000)
 * - BKApay takes 6% fee (120 XOF)
 * - User receives NET amount (1880 XOF)
 * - History displays: "Dépôt de 2000 XOF"
 * - Balance credited: 1880 XOF
 * 
 * OUTGOING PAYMENTS (withdrawals, transfers):
 * - User requests NET amount (e.g., 2000 XOF)
 * - Balance debited: NET + fee (2120 for 6%)
 * - Paydunya receives NET amount (2000)
 * - Transaction records NET amount (2000)
 * - History displays: "Retrait de 2000 XOF"
 */

export function getFeePercentage(country?: string): number {
  // UNIFORM 6% fee for ALL countries and operators
  // Return as whole number (60 = 6%)
  return 60;
}

/**
 * Calculate fees for INCOMING payments (deposits, payment links, etc.)
 * 
 * @param grossAmount - The GROSS amount the client pays (e.g., 2000)
 * @param country - Country code (ignored - 6% for all)
 * @returns {grossAmount: 2000, feeAmount: 120, netAmount: 1880}
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
 * @param grossAmount - The GROSS amount user enters (e.g., 10000)
 * @param country - Country code (ignored - 6% for all)
 * @returns {grossAmount: 10000, feeAmount: 600, amountReceived: 9400, totalDeductedFromBalance: 10000}
 * 
 * NOUVELLE LOGIQUE:
 * - L'utilisateur ecrit 10000 XOF
 * - Les frais (6% = 600) sont soustraits du montant ecrit
 * - L'utilisateur recoit 9400 XOF
 * - Le solde est debite de 10000 XOF (pas 10600)
 * 
 * Usage:
 * - Debit totalDeductedFromBalance from user balance (10000)
 * - Send amountReceived to provider (9400)
 * - Store grossAmount in transaction.amount (10000)
 * - Display grossAmount in transaction history (10000)
 */
/**
 * Calculate fees when CUSTOMER PAYS FEE for incoming payments
 * 
 * @param baseAmount - The amount user wants to receive (e.g., 3500)
 * @param country - Country code (ignored - 6% for all)
 * @returns {baseAmount: 3500, feeAmount: 210, totalForProvider: 3710}
 * 
 * LOGIQUE FRAIS À LA CHARGE DU CLIENT:
 * - L'utilisateur crée un lien de 3500 XOF avec customerPaysFee=true
 * - Les frais sont calculés sur le montant de base: 3500 * 6% = 210 XOF
 * - Le client paie le TOTAL: 3500 + 210 = 3710 XOF
 * - Le fournisseur reçoit 3710 XOF
 * - L'utilisateur reçoit le montant exact: 3500 XOF (sans déduction)
 * 
 * Usage:
 * - Send totalForProvider to payment provider (3710)
 * - Credit baseAmount to user balance (3500)
 * - Store baseAmount as the net amount in transaction
 */
export function calculateCustomerPaysFee(baseAmount: number, country?: string): {
  baseAmount: number;
  feeAmount: number;
  feePercentage: number;
  totalForProvider: number;
} {
  const feePercentage = getFeePercentage(country);
  const feeAmount = Math.floor((baseAmount * feePercentage) / 1000);
  const totalForProvider = baseAmount + feeAmount;

  return {
    baseAmount,
    feeAmount,
    feePercentage,
    totalForProvider,
  };
}

export function calculateOutgoingFee(grossAmount: number, country?: string): {
  grossAmount: number;
  feeAmount: number;
  feePercentage: number;
  amountReceived: number;
  totalDeductedFromBalance: number;
} {
  const feePercentage = getFeePercentage(country);
  const feeAmount = Math.floor((grossAmount * feePercentage) / 1000);
  const amountReceived = grossAmount - feeAmount;
  const totalDeductedFromBalance = grossAmount;

  return {
    grossAmount,
    feeAmount,
    feePercentage,
    amountReceived,
    totalDeductedFromBalance,
  };
}
