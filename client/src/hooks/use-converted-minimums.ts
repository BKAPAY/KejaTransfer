import { useQuery } from "@tanstack/react-query";

interface ConvertedMinimums {
  withdrawalMin: number;
  transferMin: number;
  depositMin: number;
  cryptoMin: number;
  cryptoWithdrawalMin: number;
  cryptoTransferMin: number;
  paymentLinkMin: number;
  isLoading: boolean;
}

const BASE_MINIMUMS_XOF = {
  withdrawal: 1000,
  transfer: 500,
  deposit: 100,
  crypto: 500,
  cryptoWithdrawal: 15000,
  cryptoTransfer: 15000,
  paymentLink: 500,
};

const BASE_MINIMUMS_CDF = {
  withdrawal: 1000,
  transfer: 2000,
  deposit: 400,
  crypto: 2000,
  cryptoWithdrawal: 61500,
  cryptoTransfer: 61500,
  paymentLink: 2000,
};

export function useConvertedMinimums(userBalanceCurrency: string): ConvertedMinimums {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/convert-minimums", userBalanceCurrency],
    queryFn: async () => {
      // XOF and XAF have the same value (1:1 rate)
      if (userBalanceCurrency === "XOF" || userBalanceCurrency === "XAF") {
        return BASE_MINIMUMS_XOF;
      }
      
      if (userBalanceCurrency === "CDF") {
        return BASE_MINIMUMS_CDF;
      }

      const conversions = await Promise.all([
        fetchConversion(BASE_MINIMUMS_XOF.withdrawal, "XOF", userBalanceCurrency),
        fetchConversion(BASE_MINIMUMS_XOF.transfer, "XOF", userBalanceCurrency),
        fetchConversion(BASE_MINIMUMS_XOF.deposit, "XOF", userBalanceCurrency),
        fetchConversion(BASE_MINIMUMS_XOF.crypto, "XOF", userBalanceCurrency),
        fetchConversion(BASE_MINIMUMS_XOF.cryptoWithdrawal, "XOF", userBalanceCurrency),
        fetchConversion(BASE_MINIMUMS_XOF.cryptoTransfer, "XOF", userBalanceCurrency),
        fetchConversion(BASE_MINIMUMS_XOF.paymentLink, "XOF", userBalanceCurrency),
      ]);

      return {
        withdrawal: conversions[0],
        transfer: conversions[1],
        deposit: conversions[2],
        crypto: conversions[3],
        cryptoWithdrawal: conversions[4],
        cryptoTransfer: conversions[5],
        paymentLink: conversions[6],
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
    cryptoWithdrawalMin: data?.cryptoWithdrawal ?? BASE_MINIMUMS_XOF.cryptoWithdrawal,
    cryptoTransferMin: data?.cryptoTransfer ?? BASE_MINIMUMS_XOF.cryptoTransfer,
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
