import { cn } from "@/lib/utils";

const CRYPTO_LOGOS: Record<string, string> = {
  btc: "/crypto-icons/btc.svg",
  eth: "/crypto-icons/eth.svg",
  usdt: "/crypto-icons/usdt.svg",
  usdttrc20: "/crypto-icons/usdt.svg",
  usdterc20: "/crypto-icons/usdt.svg",
  ltc: "/crypto-icons/ltc.svg",
  xrp: "/crypto-icons/xrp.svg",
  trx: "/crypto-icons/trx.svg",
  bnb: "/crypto-icons/bnb.svg",
  bnbbsc: "/crypto-icons/bnb.svg",
  bnbmainnet: "/crypto-icons/bnb.svg",
  sol: "/crypto-icons/sol.svg",
  doge: "/crypto-icons/doge.svg",
  matic: "/crypto-icons/matic.svg",
  ada: "/crypto-icons/ada.svg",
  dot: "/crypto-icons/dot.svg",
  avax: "/crypto-icons/avax.svg",
  xmr: "/crypto-icons/xmr.svg",
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
