// Phone number utilities for auto-detection of country and operator
// Based on West African mobile network operator prefixes

export interface DetectedPhone {
  country: string;
  operator: string;
  isValid: boolean;
  detectedOperator?: string;
}

export interface OperatorValidation {
  isValid: boolean;
  detectedOperator: string;
  expectedOperator: string;
  message: string;
}

// Detailed operator patterns by country with specific prefixes
// Format: countryCode -> { operators: { operatorName: [prefix patterns] }, localLength: number }
const OPERATOR_PATTERNS: Record<string, { 
  code: string; 
  localLength: number;
  operators: Record<string, string[]>;
}> = {
  "221": {
    code: "SN",
    localLength: 9,
    operators: {
      // Sénégal - Orange: 77, 78, 76; Free: 76, 78; Expresso: 70; Wave: 78; Wizall: any
      orange: ["77", "78", "76"],
      free: ["76", "78"],
      expresso: ["70"],
      wave: ["78"],
      wizall: ["77", "78", "76", "70"], // Wizall peut fonctionner avec tous
    },
  },
  "229": {
    code: "BJ",
    localLength: 8,
    operators: {
      // Bénin - MTN: 96, 97, 61, 62, 66, 67; Moov: 95, 94, 64, 65, 69
      mtn: ["96", "97", "61", "62", "66", "67"],
      moov: ["95", "94", "64", "65", "69", "90", "91", "60"],
    },
  },
  "228": {
    code: "TG",
    localLength: 8,
    operators: {
      // Togo - Togocel/TMoney: 90, 91, 92, 93; Moov: 99, 98, 79, 70
      tmoney: ["90", "91", "92", "93"],
      moov: ["99", "98", "79", "70"],
    },
  },
  "225": {
    code: "CI",
    localLength: 10,
    operators: {
      // Côte d'Ivoire - Orange: 07, 08, 09; MTN: 05, 04; Moov: 01, 02; Wave: 07
      orange: ["07", "08", "09"],
      mtn: ["05", "04"],
      moov: ["01", "02"],
      wave: ["07", "05"],
    },
  },
  "226": {
    code: "BF",
    localLength: 8,
    operators: {
      // Burkina Faso - Orange: 07, 06, 05; Moov: 70, 71, 72, 54, 55
      orange: ["07", "06", "05"],
      moov: ["70", "71", "72", "54", "55"],
    },
  },
  "223": {
    code: "ML",
    localLength: 8,
    operators: {
      // Mali - Orange: 74, 75, 76, 77, 78, 79, 90, 91; Moov: 65, 66, 67, 68, 69, 73
      orange: ["74", "75", "76", "77", "78", "79", "90", "91"],
      moov: ["65", "66", "67", "68", "69", "73"],
    },
  },
};

// Legacy format for backward compatibility
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

// Clean phone number - remove international prefix and spaces
export function cleanPhoneNumber(phone: string, country: string): string {
  let cleaned = phone.replace(/[\s\-\+\(\)]/g, "");
  
  // Country code mapping
  const countryToCodes: Record<string, string> = {
    "SN": "221",
    "BJ": "229",
    "TG": "228",
    "CI": "225",
    "BF": "226",
    "ML": "223",
  };
  
  const countryCode = countryToCodes[country];
  if (!countryCode) return cleaned;
  
  // Remove country code if present
  if (cleaned.startsWith(countryCode)) {
    cleaned = cleaned.substring(countryCode.length);
  }
  
  return cleaned;
}

// Get local number from full phone number
function getLocalNumber(phone: string, country: string): string {
  return cleanPhoneNumber(phone, country);
}

// Detect operator from local phone number using detailed patterns
function detectOperatorFromLocal(localNumber: string, country: string): string {
  const countryToCode: Record<string, string> = {
    "SN": "221",
    "BJ": "229",
    "TG": "228",
    "CI": "225",
    "BF": "226",
    "ML": "223",
  };
  
  const countryCode = countryToCode[country];
  if (!countryCode) return "";
  
  const patterns = OPERATOR_PATTERNS[countryCode];
  if (!patterns) return "";
  
  // Get first 2 digits as prefix
  const prefix = localNumber.substring(0, 2);
  
  // Find matching operator
  for (const [operator, prefixes] of Object.entries(patterns.operators)) {
    if (prefixes.includes(prefix)) {
      return operator;
    }
  }
  
  return "";
}

// Normalize operator name for comparison (handle variations)
function normalizeOperatorName(operator: string): string {
  const name = operator.toLowerCase().replace(/[_\-\s]/g, "");
  
  // Handle common variations
  if (name.includes("orange")) return "orange";
  if (name.includes("mtn")) return "mtn";
  if (name.includes("moov")) return "moov";
  if (name.includes("wave")) return "wave";
  if (name.includes("free")) return "free";
  if (name.includes("expresso")) return "expresso";
  if (name.includes("wizall")) return "wizall";
  if (name.includes("tmoney") || name.includes("togocel")) return "tmoney";
  
  return name;
}

// Validate that phone number matches the selected operator
export function validatePhoneOperator(
  phoneNumber: string,
  selectedOperator: string,
  country: string
): OperatorValidation {
  const localNumber = getLocalNumber(phoneNumber, country);
  const detectedOperator = detectOperatorFromLocal(localNumber, country);
  const normalizedSelected = normalizeOperatorName(selectedOperator);
  const normalizedDetected = normalizeOperatorName(detectedOperator);
  
  // Map of friendly operator names
  const operatorNames: Record<string, string> = {
    orange: "Orange Money",
    mtn: "MTN Mobile Money",
    moov: "Moov Money",
    wave: "Wave",
    free: "Free Money",
    expresso: "Expresso",
    wizall: "Wizall",
    tmoney: "T-Money",
  };
  
  const detectedName = operatorNames[normalizedDetected] || detectedOperator;
  const expectedName = operatorNames[normalizedSelected] || selectedOperator;
  
  // Check if operator matches
  const isValid = normalizedSelected === normalizedDetected || 
                  // Wizall is flexible with all SN numbers
                  (normalizedSelected === "wizall" && country === "SN") ||
                  // If we couldn't detect, allow it (uncertain)
                  normalizedDetected === "";
  
  if (!detectedOperator) {
    return {
      isValid: true,
      detectedOperator: "",
      expectedOperator: selectedOperator,
      message: "Impossible de vérifier l'opérateur du numéro",
    };
  }
  
  if (isValid) {
    return {
      isValid: true,
      detectedOperator,
      expectedOperator: selectedOperator,
      message: `Numéro ${detectedName} valide`,
    };
  }
  
  return {
    isValid: false,
    detectedOperator,
    expectedOperator: selectedOperator,
    message: `Ce numéro semble appartenir à ${detectedName}, mais vous avez sélectionné ${expectedName}. Veuillez vérifier l'opérateur ou le numéro.`,
  };
}

// Get expected local number length for a country
export function getExpectedPhoneLength(country: string): number {
  const countryToCode: Record<string, string> = {
    "SN": "221",
    "BJ": "229",
    "TG": "228",
    "CI": "225",
    "BF": "226",
    "ML": "223",
  };
  
  const countryCode = countryToCode[country];
  if (!countryCode) return 8;
  
  return OPERATOR_PATTERNS[countryCode]?.localLength || 8;
}
