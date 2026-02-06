import { useQuery } from "@tanstack/react-query";

interface CryptoAvailability {
  payinEnabled: boolean;
  payoutEnabled: boolean;
}

export function useCryptoAvailability(country: string | null | undefined) {
  const { data } = useQuery<CryptoAvailability>({
    queryKey: ["/api/crypto/country-availability", country],
    queryFn: async () => {
      if (!country) return { payinEnabled: false, payoutEnabled: false };
      const res = await fetch(`/api/crypto/country-availability?country=${country}`);
      if (!res.ok) return { payinEnabled: false, payoutEnabled: false };
      return res.json();
    },
    enabled: !!country,
  });

  return {
    cryptoPayinEnabled: data?.payinEnabled ?? false,
    cryptoPayoutEnabled: data?.payoutEnabled ?? false,
  };
}
