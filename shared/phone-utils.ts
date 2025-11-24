// Phone number utilities for auto-detection of country and operator

export interface DetectedPhone {
  country: string;
  operator: string;
  isValid: boolean;
}

// Phone prefixes by country
const COUNTRY_PREFIXES: Record<string, { code: string; operators: Record<string, string[]> }> = {
  "221": {
    code: "SN",
    operators: {
      orange: ["7", "8"],
      free: ["7"],
      expresso: ["7"],
      wave: ["7"],
      wizall: ["7"],
    },
  },
  "229": {
    code: "BJ",
    operators: {
      moov: ["5", "6", "9"],
      mtn: ["6", "7"],
    },
  },
  "228": {
    code: "TG",
    operators: {
      tmoney: ["9"],
      moov: ["5", "6"],
    },
  },
  "225": {
    code: "CI",
    operators: {
      orange: ["0", "1"],
      mtn: ["0", "1"],
      moov: ["5", "6"],
      wave: ["5", "7"],
    },
  },
  "226": {
    code: "BF",
    operators: {
      orange: ["6", "7"],
      moov: ["5", "6"],
    },
  },
  "223": {
    code: "ML",
    operators: {
      orange: ["6", "7", "8"],
      moov: ["6", "7"],
    },
  },
};

// Extract country code from phone number
function extractCountryCode(phone: string): string | null {
  // Remove spaces, dashes, and other common separators
  const cleaned = phone.replace(/[\s\-\+\(\)]/g, "");

  // Try to find country code in the cleaned number
  for (const prefix of Object.keys(COUNTRY_PREFIXES)) {
    if (cleaned.startsWith(prefix)) {
      return prefix;
    }
    // Also try with + prefix
    if (cleaned.startsWith("+" + prefix)) {
      return prefix;
    }
  }

  return null;
}

// Detect operator based on the first digit after country code
function detectOperator(phone: string, countryCode: string): string {
  const cleaned = phone.replace(/[\s\-\+\(\)]/g, "");
  
  // Remove country code prefix
  let remaining = cleaned;
  if (cleaned.includes(countryCode)) {
    remaining = cleaned.split(countryCode)[1] || cleaned;
  }

  // Get first digit
  const firstDigit = remaining[0];

  if (!firstDigit) return "";

  // Find operator based on first digit
  const countryData = COUNTRY_PREFIXES[countryCode];
  if (!countryData) return "";

  for (const [operator, prefixes] of Object.entries(countryData.operators)) {
    if (prefixes.includes(firstDigit)) {
      return operator;
    }
  }

  // Default to first available operator
  return Object.keys(countryData.operators)[0] || "";
}

// Main function to detect country and operator from phone number
export function detectPhoneCountryAndOperator(phoneNumber: string): DetectedPhone {
  const countryCode = extractCountryCode(phoneNumber);

  if (!countryCode) {
    return {
      country: "",
      operator: "",
      isValid: false,
    };
  }

  const countryData = COUNTRY_PREFIXES[countryCode];
  const operator = detectOperator(phoneNumber, countryCode);

  return {
    country: countryData.code,
    operator,
    isValid: !!operator,
  };
}
