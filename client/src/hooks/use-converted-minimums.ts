import { useQuery } from "@tanstack/react-query";

interface ConvertedMinimums {
  withdrawalMin: number;
  transferMin: number;
  depositMin: number;
  cryptoMin: number;
  paymentLinkMin: number;
  isLoading: boolean;
}

const BASE_MINIMUMS_XOF = {
  withdrawal: 1000,
  transfer: 500,
  deposit: 100,
  crypto: 500,
  paymentLink: 500,
};

export function useConvertedMinimums(userBalanceCurrency: string): ConvertedMinimums {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/convert-minimums", userBalanceCurrency],
    queryFn: async () => {
      if (userBalanceCurrency === "XOF") {
        return BASE_MINIMUMS_XOF;
      }

      const conversions = await Promise.all([
        fetchConversion(BASE_MINIMUMS_XOF.withdrawal, "XOF", userBalanceCurrency),
        fetchConversion(BASE_MINIMUMS_XOF.transfer, "XOF", userBalanceCurrency),
        fetchConversion(BASE_MINIMUMS_XOF.deposit, "XOF", userBalanceCurrency),
        fetchConversion(BASE_MINIMUMS_XOF.crypto, "XOF", userBalanceCurrency),
        fetchConversion(BASE_MINIMUMS_XOF.paymentLink, "XOF", userBalanceCurrency),
      ]);

      return {
        withdrawal: conversions[0],
        transfer: conversions[1],
        deposit: conversions[2],
        crypto: conversions[3],
        paymentLink: conversions[4],
      };
    },
    staleTime: 1000 * 60 * 60,
    enabled: !!userBalanceCurrency,
  });

  return {
    withdrawalMin: data?.withdrawal ?? BASE_MINIMUMS_XOF.withdrawal,
    transferMin: data?.transfer ?? BASE_MINIMUMS_XOF.transfer,
    depositMin: data?.deposit ?? BASE_MINIMUMS_XOF.deposit,
    cryptoMin: data?.crypto ?? BASE_MINIMUMS_XOF.crypto,
    paymentLinkMin: data?.paymentLink ?? BASE_MINIMUMS_XOF.paymentLink,
    isLoading,
  };
}

async function fetchConversion(amount: number, from: string, to: string): Promise<number> {
  if (from === to) return amount;
  
  try {
    const res = await fetch("/api/convert-currency", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, fromCurrency: from, toCurrency: to }),
    });
    
    if (res.ok) {
      const data = await res.json();
      return Math.round(data.convertedAmount);
    }
  } catch (error) {
    console.error("Conversion error:", error);
  }
  
  return amount;
}
