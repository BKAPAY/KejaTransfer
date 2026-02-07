import { cn } from "@/lib/utils";

const CRYPTO_LOGOS: Record<string, string> = {
  btc: "https://cryptologos.cc/logos/bitcoin-btc-logo.svg",
  eth: "https://cryptologos.cc/logos/ethereum-eth-logo.svg",
  usdt: "https://cryptologos.cc/logos/tether-usdt-logo.svg",
  usdttrc20: "https://cryptologos.cc/logos/tether-usdt-logo.svg",
  usdterc20: "https://cryptologos.cc/logos/tether-usdt-logo.svg",
  ltc: "https://cryptologos.cc/logos/litecoin-ltc-logo.svg",
  xrp: "https://cryptologos.cc/logos/xrp-xrp-logo.svg",
  trx: "https://cryptologos.cc/logos/tron-trx-logo.svg",
  bnb: "https://cryptologos.cc/logos/bnb-bnb-logo.svg",
  bnbbsc: "https://cryptologos.cc/logos/bnb-bnb-logo.svg",
  bnbmainnet: "https://cryptologos.cc/logos/bnb-bnb-logo.svg",
  sol: "https://cryptologos.cc/logos/solana-sol-logo.svg",
  doge: "https://cryptologos.cc/logos/dogecoin-doge-logo.svg",
  matic: "https://cryptologos.cc/logos/polygon-matic-logo.svg",
  ada: "https://cryptologos.cc/logos/cardano-ada-logo.svg",
  dot: "https://cryptologos.cc/logos/polkadot-new-dot-logo.svg",
  avax: "https://cryptologos.cc/logos/avalanche-avax-logo.svg",
  xmr: "https://cryptologos.cc/logos/monero-xmr-logo.svg",
};

const CRYPTO_COLORS: Record<string, string> = {
  btc: "#F7931A",
  eth: "#627EEA",
  usdt: "#26A17B",
  usdttrc20: "#26A17B",
  usdterc20: "#26A17B",
  ltc: "#345D9D",
  xrp: "#23292F",
  trx: "#FF0013",
  bnb: "#F0B90B",
  bnbbsc: "#F0B90B",
  bnbmainnet: "#F0B90B",
  sol: "#9945FF",
  doge: "#C2A633",
  matic: "#8247E5",
  ada: "#0033AD",
  dot: "#E6007A",
  avax: "#E84142",
  xmr: "#FF6600",
};

interface CryptoIconProps {
  code: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeMap = {
  xs: "w-4 h-4",
  sm: "w-5 h-5",
  md: "w-7 h-7",
  lg: "w-9 h-9",
  xl: "w-12 h-12",
};

export function CryptoIcon({ code, size = "md", className }: CryptoIconProps) {
  const logoUrl = CRYPTO_LOGOS[code.toLowerCase()];
  const sizeClass = sizeMap[size];

  if (!logoUrl) {
    return (
      <div
        className={cn(
          sizeClass,
          "rounded-full bg-muted flex items-center justify-center text-[8px] font-bold text-muted-foreground",
          className
        )}
        data-testid={`crypto-icon-${code}`}
      >
        {code.slice(0, 3).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={code.toUpperCase()}
      className={cn(sizeClass, "object-contain", className)}
      data-testid={`crypto-icon-${code}`}
      loading="lazy"
    />
  );
}

export { CRYPTO_LOGOS, CRYPTO_COLORS };
