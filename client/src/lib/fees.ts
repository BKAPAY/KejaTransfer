// Dynamic fee calculation - fetches from database via API

const DEFAULT_FEE_PERCENTAGE = 60; // 6% as default

// Cache for fee percentages to avoid too many API calls
const feeCache: Map<string, { incoming: number; outgoing: number; timestamp: number }> = new Map();
const CACHE_TTL = 60000; // 1 minute cache

export async function fetchFeeConfig(country: string, operator: string): Promise<{ incoming: number; outgoing: number }> {
  const cacheKey = `${country.toUpperCase()}-${operator.toLowerCase()}`;
  const cached = feeCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { incoming: cached.incoming, outgoing: cached.outgoing };
  }

  try {
    const response = await fetch(`/api/fees/${country}/${operator}`);
    if (response.ok) {
      const data = await response.json();
      const result = {
        incoming: data.incomingFeePercentage ?? DEFAULT_FEE_PERCENTAGE,
        outgoing: data.outgoingFeePercentage ?? DEFAULT_FEE_PERCENTAGE,
      };
      feeCache.set(cacheKey, { ...result, timestamp: Date.now() });
      return result;
    }
  } catch (error) {
    console.warn('Failed to fetch fee config, using default:', error);
  }

  return { incoming: DEFAULT_FEE_PERCENTAGE, outgoing: DEFAULT_FEE_PERCENTAGE };
}

// Synchronous version using cached values or default
export function getFeePercentage(country?: string, operator?: string): number {
  if (country && operator) {
    const cacheKey = `${country.toUpperCase()}-${operator.toLowerCase()}`;
    const cached = feeCache.get(cacheKey);
    if (cached) {
      return cached.incoming;
    }
  }
  return DEFAULT_FEE_PERCENTAGE;
}

export function getOutgoingFeePercentage(country?: string, operator?: string): number {
  if (country && operator) {
    const cacheKey = `${country.toUpperCase()}-${operator.toLowerCase()}`;
    const cached = feeCache.get(cacheKey);
    if (cached) {
      return cached.outgoing;
    }
  }
  return DEFAULT_FEE_PERCENTAGE;
}

export function calculateIncomingFee(grossAmount: number, feePercentageValue?: number): {
  feeAmount: number;
  feePercentage: number;
  netAmount: number;
} {
  const feePercentage = feePercentageValue ?? DEFAULT_FEE_PERCENTAGE;
  const feeAmount = Math.floor((grossAmount * feePercentage) / 1000);
  const netAmount = grossAmount - feeAmount;

  return {
    feeAmount,
    feePercentage,
    netAmount,
  };
}

export function calculateOutgoingFee(requestedAmount: number, feePercentageValue?: number): {
  feeAmount: number;
  feePercentage: number;
  totalDeductedFromBalance: number;
  amountReceived: number;
} {
  const feePercentage = feePercentageValue ?? DEFAULT_FEE_PERCENTAGE;
  const feeAmount = Math.floor((requestedAmount * feePercentage) / 1000);
  const totalDeductedFromBalance = requestedAmount;
  const amountReceived = requestedAmount - feeAmount;

  return {
    feeAmount,
    feePercentage,
    totalDeductedFromBalance,
    amountReceived,
  };
}

// Format fee percentage for display (e.g., 60 -> "6%")
export function formatFeePercentage(value: number): string {
  return `${(value / 10).toFixed(1).replace(/\.0$/, '')}%`;
}
