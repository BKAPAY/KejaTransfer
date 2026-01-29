/**
 * BKApay Fee Calculation System
 * 
 * DYNAMIC FEES: Configurable per country and operator via admin dashboard
 * Default: 6% for ALL countries and operators if not configured
 * 
 * CRITICAL LOGIC:
 * 
 * INCOMING PAYMENTS (deposits, payment links, merchant links, API):
 * - Client pays GROSS amount (e.g., 2000 XOF) to provider
 * - Provider validates GROSS amount (SMS confirms 2000)
 * - Transaction records GROSS amount (2000)
 * - BKApay takes fee (e.g., 6% = 120 XOF)
 * - User receives NET amount (1880 XOF)
 * - History displays: "Dépôt de 2000 XOF"
 * - Balance credited: 1880 XOF
 * 
 * OUTGOING PAYMENTS (withdrawals, transfers):
 * - User requests GROSS amount (e.g., 10000 XOF)
 * - Fee is subtracted from amount (e.g., 6% = 600)
 * - User receives NET amount (9400)
 * - Balance debited: GROSS amount (10000)
 * - History displays: "Retrait de 10000 XOF"
 */

const DEFAULT_FEE_PERCENTAGE = 60; // 6% as default

/**
 * Get fee percentage - returns the value directly
 * Use getFeeFromDatabase for dynamic fees from database
 */
export function getFeePercentage(feeValue?: number): number {
  return feeValue ?? DEFAULT_FEE_PERCENTAGE;
}

/**
 * Get the active provider for a country from country_status table
 * Returns the provider name (lowercase) or 'paydunya' as default
 */
export async function getActiveProviderForCountry(storage: any, country: string): Promise<string> {
  try {
    const countryStatuses = await storage.getCountryStatuses();
    const activeStatus = countryStatuses.find((status: any) => 
      status.country === country.toUpperCase() && 
      status.payinEnabled === true
    );
    
    if (activeStatus && activeStatus.provider) {
      return activeStatus.provider.toLowerCase();
    }
  } catch (error) {
    console.warn(`[FEES] Failed to get active provider for ${country}:`, error);
  }
  return 'paydunya'; // Default fallback
}

/**
 * Get fees for a country/operator, automatically detecting the active provider
 * This is the recommended function to use for all fee calculations
 */
export async function getDynamicFees(
  storage: any,
  country: string,
  operator: string
): Promise<{ incoming: number; outgoing: number; provider: string }> {
  const provider = await getActiveProviderForCountry(storage, country);
  const fees = await getFeeFromDatabase(storage, provider, country, operator);
  return {
    ...fees,
    provider,
  };
}

/**
 * Get fee percentages from database for a specific provider/country/operator
 * Returns incoming and outgoing fee percentages
 */
export async function getFeeFromDatabase(
  storage: any, 
  provider: string,
  country: string, 
  operator: string
): Promise<{ incoming: number; outgoing: number }> {
  try {
    const config = await storage.getFeeConfig(provider.toLowerCase(), country.toUpperCase(), operator.toLowerCase());
    if (config) {
      return {
        incoming: config.incomingFeePercentage ?? DEFAULT_FEE_PERCENTAGE,
        outgoing: config.outgoingFeePercentage ?? DEFAULT_FEE_PERCENTAGE,
      };
    }
  } catch (error) {
    console.warn(`[FEES] Failed to get fee config for ${provider}/${country}/${operator}:`, error);
  }
  return { incoming: DEFAULT_FEE_PERCENTAGE, outgoing: DEFAULT_FEE_PERCENTAGE };
}

/**
 * Calculate fees for INCOMING payments (deposits, payment links, etc.)
 * 
 * @param grossAmount - The GROSS amount the client pays (e.g., 2000)
 * @param feePercentageValue - Fee percentage from database (60 = 6%) or undefined for default
 * @returns {grossAmount: 2000, feeAmount: 120, netAmount: 1880}
 * 
 * Usage:
 * - Store grossAmount in transaction.amount
 * - Credit netAmount to user balance
 * - Display grossAmount in transaction history
 */
export function calculateIncomingFee(grossAmount: number, feePercentageValue?: number): {
  grossAmount: number;
  feeAmount: number;
  feePercentage: number;
  netAmount: number;
} {
  const feePercentage = getFeePercentage(feePercentageValue);
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
 * Calculate fees when CUSTOMER PAYS FEE for incoming payments
 * 
 * @param baseAmount - The amount user wants to receive (e.g., 3500)
 * @param feePercentageValue - Fee percentage from database (60 = 6%) or undefined for default
 * @returns {baseAmount: 3500, feeAmount: 210, totalForProvider: 3710}
 * 
 * LOGIQUE FRAIS À LA CHARGE DU CLIENT:
 * - L'utilisateur crée un lien de 3500 XOF avec customerPaysFee=true
 * - Les frais sont calculés sur le montant de base: 3500 * X% = Y XOF
 * - Le client paie le TOTAL: 3500 + Y = Z XOF
 * - Le fournisseur reçoit Z XOF
 * - L'utilisateur reçoit le montant exact: 3500 XOF (sans déduction)
 * 
 * Usage:
 * - Send totalForProvider to payment provider
 * - Credit baseAmount to user balance
 * - Store baseAmount as the net amount in transaction
 */
export function calculateCustomerPaysFee(baseAmount: number, feePercentageValue?: number): {
  baseAmount: number;
  feeAmount: number;
  feePercentage: number;
  totalForProvider: number;
} {
  const feePercentage = getFeePercentage(feePercentageValue);
  const feeAmount = Math.floor((baseAmount * feePercentage) / 1000);
  const totalForProvider = baseAmount + feeAmount;

  return {
    baseAmount,
    feeAmount,
    feePercentage,
    totalForProvider,
  };
}

/**
 * Calculate fees for OUTGOING payments (withdrawals, transfers)
 * 
 * @param grossAmount - The GROSS amount user enters (e.g., 10000)
 * @param feePercentageValue - Fee percentage from database (60 = 6%) or undefined for default
 * @returns {grossAmount: 10000, feeAmount: 600, amountReceived: 9400, totalDeductedFromBalance: 10000}
 * 
 * LOGIQUE:
 * - L'utilisateur écrit 10000 XOF
 * - Les frais (e.g., 6% = 600) sont soustraits du montant écrit
 * - L'utilisateur reçoit 9400 XOF
 * - Le solde est débité de 10000 XOF (pas 10600)
 * 
 * Usage:
 * - Debit totalDeductedFromBalance from user balance (10000)
 * - Send amountReceived to provider (9400)
 * - Store grossAmount in transaction.amount (10000)
 * - Display grossAmount in transaction history (10000)
 */
export function calculateOutgoingFee(grossAmount: number, feePercentageValue?: number | string): {
  grossAmount: number;
  feeAmount: number;
  feePercentage: number;
  amountReceived: number;
  totalDeductedFromBalance: number;
} {
  // Handle case where country string was passed instead of fee percentage (legacy calls)
  const feePercentage = typeof feePercentageValue === 'string' 
    ? DEFAULT_FEE_PERCENTAGE 
    : getFeePercentage(feePercentageValue);
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
