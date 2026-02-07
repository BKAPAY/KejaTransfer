import { cn } from "@/lib/utils";

interface CardBrandIconProps {
  brand: "visa" | "mastercard";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeMap = {
  xs: { width: 24, height: 16 },
  sm: { width: 32, height: 20 },
  md: { width: 40, height: 26 },
  lg: { width: 52, height: 34 },
  xl: { width: 64, height: 42 },
};

function VisaLogo({ width, height }: { width: number; height: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 750 471" xmlns="http://www.w3.org/2000/svg">
      <rect width="750" height="471" rx="40" fill="#1A1F71" />
      <path d="M278.2 334.2h-60.6l37.9-233.9h60.6L278.2 334.2z" fill="#fff"/>
      <path d="M524.3 105.1c-12-4.5-30.8-9.3-54.3-9.3-59.8 0-101.9 31.8-102.2 77.3-.3 33.7 30 52.4 52.9 63.6 23.5 11.5 31.4 18.8 31.3 29.1-.2 15.7-18.8 22.9-36.1 22.9-24.1 0-36.9-3.5-56.7-12.2l-7.8-3.7-8.5 52.4c14.1 6.5 40.1 12.2 67.1 12.5 63.6 0 104.9-31.4 105.3-80.1.2-26.7-15.9-47-50.8-63.7-21.1-10.8-34.1-18.1-34-29.1 0-9.7 11-20.1 34.6-20.1 19.8-.3 34.1 4.2 45.2 8.9l5.4 2.7 8.2-51.2z" fill="#fff"/>
      <path d="M661.6 100.3h-46.8c-14.5 0-25.4 4.2-31.8 19.5L487.5 334.2h63.6s10.4-28.8 12.7-35.2h77.7c1.8 8.2 7.4 35.2 7.4 35.2H706L661.6 100.3zm-74.6 180.3c5-13.5 24.3-65.6 24.3-65.6-.4.6 5-13.7 8.1-22.6l4.1 20.4s11.7 56.4 14.1 67.8h-50.6z" fill="#fff"/>
      <path d="M232.8 100.3L173.5 261l-6.4-32.7c-11-37.4-45.3-78-83.6-98.3l54.2 204h64l95.1-234h-64z" fill="#fff"/>
      <path d="M120.3 100.3H24.6l-.8 4.6c75.9 19.4 126.2 66.3 147 122.6L149 121.2c-3.4-14.9-14.2-19.4-28.7-20.9z" fill="#F9A533"/>
    </svg>
  );
}

function MastercardLogo({ width, height }: { width: number; height: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 750 471" xmlns="http://www.w3.org/2000/svg">
      <rect width="750" height="471" rx="40" fill="#252525" />
      <circle cx="300" cy="236" r="150" fill="#EB001B" />
      <circle cx="450" cy="236" r="150" fill="#F79E1B" />
      <path d="M375 121.7c37.5 29.3 61.5 75.1 61.5 126.3s-24 97-61.5 126.3c-37.5-29.3-61.5-75.1-61.5-126.3s24-97 61.5-126.3z" fill="#FF5F00" />
    </svg>
  );
}

export function CardBrandIcon({ brand, size = "md", className }: CardBrandIconProps) {
  const dimensions = sizeMap[size];

  return (
    <div className={cn("inline-flex items-center justify-center", className)} data-testid={`card-icon-${brand}`}>
      {brand === "visa" ? (
        <VisaLogo width={dimensions.width} height={dimensions.height} />
      ) : (
        <MastercardLogo width={dimensions.width} height={dimensions.height} />
      )}
    </div>
  );
}
