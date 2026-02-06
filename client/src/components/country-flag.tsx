import { cn } from "@/lib/utils";

const COUNTRY_NAMES: Record<string, string> = {
  BJ: "Benin",
  TG: "Togo",
  CI: "Cote d'Ivoire",
  SN: "Senegal",
  BF: "Burkina Faso",
  GN: "Guinee",
  NE: "Niger",
  ML: "Mali",
  CM: "Cameroun",
  TD: "Tchad",
  CG: "Congo-Brazzaville",
  CF: "Centrafrique",
  GA: "Gabon",
  CD: "RD Congo",
};

export function getCountryName(code: string): string {
  return COUNTRY_NAMES[code] || code;
}

interface CountryFlagProps {
  code: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses: Record<string, string> = {
  xs: "w-4 h-3",
  sm: "w-5 h-4",
  md: "w-6 h-4",
  lg: "w-8 h-6",
  xl: "w-10 h-7",
};

export function CountryFlag({ code, size = "sm", className }: CountryFlagProps) {
  const lowerCode = code.toLowerCase();
  const src = `https://flagcdn.com/w40/${lowerCode}.png`;
  const srcSet = `https://flagcdn.com/w80/${lowerCode}.png 2x`;

  return (
    <img
      src={src}
      srcSet={srcSet}
      alt={COUNTRY_NAMES[code] || code}
      className={cn(sizeClasses[size], "inline-block object-cover rounded-sm", className)}
      loading="lazy"
    />
  );
}
