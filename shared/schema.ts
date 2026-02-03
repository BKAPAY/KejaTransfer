import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session table for connect-pg-simple (Express sessions)
export const sessions = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
});

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  country: text("country"), // User's country: BJ, TG, CI, BF, SN
  balance: integer("balance").notNull().default(0), // Balance in XOF
  kycStatus: text("kyc_status").notNull().default("pending"), // "pending", "submitted", "verified", "rejected"
  kycIdFront: text("kyc_id_front"), // Base64 encoded or URL
  kycIdBack: text("kyc_id_back"), // Base64 encoded or URL
  kycSelfie: text("kyc_selfie"), // Base64 encoded or URL
  kycRejectionReason: text("kyc_rejection_reason"), // Reason for KYC rejection
  withdrawalPhones: text("withdrawal_phones").array().default([]), // Up to 3 withdrawal phone numbers
  securityCode: text("security_code"), // 6-digit security code for transfers/withdrawals
  isAdmin: boolean("is_admin").notNull().default(false),
  isPrimaryAdmin: boolean("is_primary_admin").notNull().default(false), // Super admin that cannot be removed
  suspended: boolean("suspended").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Payment links
export const paymentLinks = pgTable("payment_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  productName: text("product_name").notNull(),
  description: text("description"),
  amount: integer("amount").notNull(), // Amount in XOF
  imageUrl: text("image_url"), // Legacy single image (kept for backward compatibility)
  imageUrls: text("image_urls").array().default([]), // Up to 3 product images
  token: text("token").notNull().unique(), // Unique token for the payment link
  isActive: boolean("is_active").notNull().default(true),
  allowedCountries: text("allowed_countries").array().default([]), // Empty array = all countries allowed
  customerPaysFee: boolean("customer_pays_fee").notNull().default(false), // If true, customer pays the 6% fee
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Merchant links
export const merchantLinks = pgTable("merchant_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  merchantName: text("merchant_name").notNull(),
  token: text("token").notNull().unique(), // Unique token for the merchant link
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// API keys
export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  siteName: text("site_name").notNull().default("Mon Site"), // Nom du site qui sera affiché "Payer à [siteName]"
  publicKey: text("public_key").notNull().unique(),
  privateKey: text("private_key").notNull().unique(),
  callbackUrl: text("callback_url"), // URL to receive payment notifications for auto activation
  callbackSecret: text("callback_secret"), // HMAC secret for signing callbacks
  isActive: boolean("is_active").notNull().default(true),
  allowedCountries: text("allowed_countries").array().default([]), // Empty array = all countries allowed
  customerPaysFee: boolean("customer_pays_fee").notNull().default(false), // If true, customer pays the 6% fee
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Transactions
export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // "deposit", "transfer", "payment_link", "merchant_link", "api_payment"
  amount: integer("amount").notNull(), // Amount in XOF (net amount after fees for incoming, gross for outgoing)
  fee: integer("fee").notNull().default(0), // Fee amount deducted in XOF
  feePercentage: integer("fee_percentage").notNull().default(0), // Fee percentage (30 = 3%, 60 = 6%)
  currency: text("currency").notNull().default("XOF"),
  status: text("status").notNull(), // "completed", "pending", "failed", "cancelled"
  country: text("country"), // "BJ", "TG", "CI", "SN", "BF", "ML"
  operator: text("operator"), // "orange", "mtn", "moov", "wave", "free", "tmoney", "wizall", "expresso"
  customerName: text("customer_name"),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  description: text("description"),
  paydunyaToken: text("paydunya_token"), // Token from Paydunya
  paydunyaReceiptUrl: text("paydunya_receipt_url"),
  metadata: text("metadata"), // JSON string for additional data
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Country/Operator Configuration - Admin control per provider
export const countryOperatorConfig = pgTable("country_operator_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  provider: text("provider").notNull().default("afribapay"), // "afribapay", "paydunya", "fedapay"
  country: text("country").notNull(), // "BJ", "TG", "CI", "SN", "BF", "ML"
  operator: text("operator").notNull(), // "orange", "mtn", "moov", "wave", "free", "tmoney", "wizall", "expresso"
  incomingEnabled: boolean("incoming_enabled").notNull().default(false), // For deposits
  outgoingEnabled: boolean("outgoing_enabled").notNull().default(false), // For withdrawals
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Countries allowed for user registration
export const ALLOWED_REGISTRATION_COUNTRIES = ["BJ", "CI", "SN", "TG", "BF", "CM", "CD", "CG", "ML"] as const;

// Email verification codes
export const verificationCodes = pgTable("verification_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  code: text("code").notNull(),
  type: text("type").notNull(), // "signup" or "password_reset"
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Country configuration with payin/payout status per provider
export const countryStatus = pgTable("country_status", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  provider: text("provider").notNull().default("afribapay"), // "afribapay", "paydunya", "fedapay"
  country: text("country").notNull(), // "BJ", "CI", etc.
  payinEnabled: boolean("payin_enabled").notNull().default(false),
  payoutEnabled: boolean("payout_enabled").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Payment provider configurations (API keys)
export const providerConfigs = pgTable("provider_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  provider: text("provider").notNull().unique(), // "afribapay", "paydunya", "fedapay", "nowpayments"
  isActive: boolean("is_active").notNull().default(false),
  apiKey: text("api_key"), // Main API key
  secretKey: text("secret_key"), // Secret key if needed
  publicKey: text("public_key"), // Public key if needed
  masterKey: text("master_key"), // Master key for Paydunya
  token: text("token"), // Token for Paydunya
  ipnSecret: text("ipn_secret"), // IPN secret for NOWPayments webhooks
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type ProviderConfig = typeof providerConfigs.$inferSelect;

// Cryptocurrency configuration for NOWPayments
export const cryptoCurrencies = pgTable("crypto_currencies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(), // "btc", "eth", "usdt", "ltc", etc.
  name: text("name").notNull(), // "Bitcoin", "Ethereum", etc.
  symbol: text("symbol").notNull(), // "BTC", "ETH", etc.
  isEnabled: boolean("is_enabled").notNull().default(true),
  minAmount: integer("min_amount"), // Minimum payment amount in USD cents
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type CryptoCurrency = typeof cryptoCurrencies.$inferSelect;
export const insertCryptoCurrencySchema = createInsertSchema(cryptoCurrencies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCryptoCurrency = z.infer<typeof insertCryptoCurrencySchema>;

// Fee configuration per provider/country/operator
export const feeConfigs = pgTable("fee_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  provider: text("provider").notNull().default("default"), // "mbiyopay", "fedapay", "afribapay", "paydunya", "default"
  country: text("country").notNull(), // "BJ", "TG", "CI", "SN", "BF", etc.
  operator: text("operator").notNull(), // "orange", "mtn", "moov", "wave", etc.
  incomingFeePercentage: integer("incoming_fee_percentage").notNull().default(60), // 60 = 6%, 40 = 4%, etc.
  outgoingFeePercentage: integer("outgoing_fee_percentage").notNull().default(60), // 60 = 6%, 40 = 4%, etc.
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type FeeConfig = typeof feeConfigs.$inferSelect;
export const insertFeeConfigSchema = createInsertSchema(feeConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertFeeConfig = z.infer<typeof insertFeeConfigSchema>;

export const updateFeeConfigSchema = z.object({
  incomingFeePercentage: z.number().min(0).max(100).optional(),
  outgoingFeePercentage: z.number().min(0).max(100).optional(),
});

// Support settings table - configurable by admin
export const supportSettings = pgTable("support_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  supportEmail: text("support_email").notNull().default("support@bkapay.com"),
  supportPhone: text("support_phone").notNull().default("+229 01 46 44 73 19"),
  whatsappLink: text("whatsapp_link").notNull().default("https://chat.whatsapp.com/DRe55FMRXCt87VxNvjF1EF"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type SupportSettings = typeof supportSettings.$inferSelect;
export const insertSupportSettingsSchema = createInsertSchema(supportSettings).omit({
  id: true,
  updatedAt: true,
});
export type InsertSupportSettings = z.infer<typeof insertSupportSettingsSchema>;

export const updateSupportSettingsSchema = z.object({
  supportEmail: z.string().email("Email invalide").optional(),
  supportPhone: z.string().min(8, "Numéro de téléphone invalide").optional(),
  whatsappLink: z.string().url("Lien WhatsApp invalide").optional(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  balance: true,
  kycStatus: true,
  kycIdFront: true,
  kycIdBack: true,
  kycSelfie: true,
  kycRejectionReason: true,
  withdrawalPhones: true,
  securityCode: true,
  isAdmin: true,
  isPrimaryAdmin: true,
  suspended: true,
  createdAt: true,
});

// Schema for updating user country (for old users who don't have one)
export const updateUserCountrySchema = z.object({
  country: z.enum(["BJ", "TG", "CI", "BF", "SN"], {
    required_error: "Veuillez sélectionner votre pays",
  }),
});

// Schema for managing withdrawal phones
export const updateWithdrawalPhonesSchema = z.object({
  withdrawalPhones: z.array(z.string().regex(/^\d+$/, "Le numéro doit contenir uniquement des chiffres")).max(3, "Maximum 3 numéros autorisés"),
});

// Schema for setting security code
export const setSecurityCodeSchema = z.object({
  securityCode: z.string().length(6, "Le code doit contenir exactement 6 chiffres").regex(/^\d+$/, "Le code doit contenir uniquement des chiffres"),
});

// Schema for updating security code (requires old code)
export const updateSecurityCodeSchema = z.object({
  oldCode: z.string().length(6, "Le code doit contenir exactement 6 chiffres"),
  newCode: z.string().length(6, "Le code doit contenir exactement 6 chiffres").regex(/^\d+$/, "Le code doit contenir uniquement des chiffres"),
});

// Schema for verifying security code
export const verifySecurityCodeSchema = z.object({
  securityCode: z.string().length(6, "Le code doit contenir exactement 6 chiffres"),
});

export const submitKycSchema = z.object({
  kycIdFront: z.string().min(1, "Photo recto requise"),
  kycIdBack: z.string().min(1, "Photo verso requise"),
  kycSelfie: z.string().min(1, "Selfie requis"),
});

export const insertPaymentLinkSchema = createInsertSchema(paymentLinks).omit({
  id: true,
  userId: true,
  token: true,
  createdAt: true,
});

export const updatePaymentLinkSchema = z.object({
  productName: z.string().min(1, "Le nom du produit est requis").optional(),
  description: z.string().optional(),
  amount: z.number().min(1, "Le montant doit être supérieur à 0").optional(),
  imageUrl: z.string().optional(),
  imageUrls: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  allowedCountries: z.array(z.string()).optional(),
  customerPaysFee: z.boolean().optional(),
});

export const insertMerchantLinkSchema = createInsertSchema(merchantLinks).omit({
  id: true,
  userId: true,
  token: true,
  createdAt: true,
}).extend({
  merchantName: z.string()
    .min(3, "Le nom marchand doit contenir au minimum 3 caractères")
    .max(10, "Le nom marchand doit contenir au maximum 10 caractères")
    .regex(/^[A-Z]+$/, "Le nom marchand doit contenir uniquement des lettres majuscules"),
});

export const insertApiKeySchema = createInsertSchema(apiKeys).omit({
  id: true,
  userId: true,
  publicKey: true,
  privateKey: true,
  createdAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

export const insertCountryOperatorConfigSchema = createInsertSchema(countryOperatorConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCountryOperatorConfigSchema = z.object({
  incomingEnabled: z.boolean().optional(),
  outgoingEnabled: z.boolean().optional(),
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertPaymentLink = z.infer<typeof insertPaymentLinkSchema>;
export type PaymentLink = typeof paymentLinks.$inferSelect;

export type InsertMerchantLink = z.infer<typeof insertMerchantLinkSchema>;
export type MerchantLink = typeof merchantLinks.$inferSelect;

export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey = typeof apiKeys.$inferSelect;

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

export type InsertCountryOperatorConfig = z.infer<typeof insertCountryOperatorConfigSchema>;
export type CountryOperatorConfig = typeof countryOperatorConfig.$inferSelect;
export type UpdateCountryOperatorConfig = z.infer<typeof updateCountryOperatorConfigSchema>;

export type CountryStatus = typeof countryStatus.$inferSelect;

// Currency constants
export const CURRENCIES = [
  { code: "XOF", name: "Franc CFA BCEAO", symbol: "Fr", rate: 1 },
  { code: "XAF", name: "Franc CFA BEAC", symbol: "Fr", rate: 1 },
  { code: "CDF", name: "Franc Congolais", symbol: "FC", rate: 0.00036 },
  { code: "GNF", name: "Franc Guinéen", symbol: "FG", rate: 0.00012 },
  { code: "RWF", name: "Franc Rwandais", symbol: "FRw", rate: 0.00074 },
  { code: "USD", name: "Dollar US", symbol: "$", rate: 0.0015 },
  { code: "EUR", name: "Euro", symbol: "€", rate: 0.0014 },
] as const;

export const CURRENCY_CONVERSION_RATES: Record<string, number> = {
  XOF: 1,
  XAF: 1,
  CDF: 0.00036,
  GNF: 0.00012,
  RWF: 0.00074,
  USD: 0.0015,
  EUR: 0.0014,
};

// Country and operator constants
// Countries supported by AfribaPay (14 countries total) - Benin listed first
// All countries support both Payin (collect) and Payout
export const COUNTRIES = [
  { code: "BJ", name: "Bénin", flag: "🇧🇯", phoneCode: "+229", phoneDigits: 10, currency: "XOF" },
  { code: "CI", name: "Côte d'Ivoire", flag: "🇨🇮", phoneCode: "+225", phoneDigits: 10, currency: "XOF" },
  { code: "SN", name: "Sénégal", flag: "🇸🇳", phoneCode: "+221", phoneDigits: 9, currency: "XOF" },
  { code: "BF", name: "Burkina Faso", flag: "🇧🇫", phoneCode: "+226", phoneDigits: 8, currency: "XOF" },
  { code: "TG", name: "Togo", flag: "🇹🇬", phoneCode: "+228", phoneDigits: 8, currency: "XOF" },
  { code: "ML", name: "Mali", flag: "🇲🇱", phoneCode: "+223", phoneDigits: 8, currency: "XOF" },
  { code: "GN", name: "Guinée", flag: "🇬🇳", phoneCode: "+224", phoneDigits: 9, currency: "GNF" },
  { code: "NE", name: "Niger", flag: "🇳🇪", phoneCode: "+227", phoneDigits: 8, currency: "XOF" },
  { code: "CM", name: "Cameroun", flag: "🇨🇲", phoneCode: "+237", phoneDigits: 9, currency: "XAF" },
  { code: "CD", name: "RD Congo", flag: "🇨🇩", phoneCode: "+243", phoneDigits: 9, currency: "CDF" },
  { code: "TD", name: "Tchad", flag: "🇹🇩", phoneCode: "+235", phoneDigits: 8, currency: "XAF" },
  { code: "CG", name: "Congo-Brazzaville", flag: "🇨🇬", phoneCode: "+242", phoneDigits: 9, currency: "XAF" },
  { code: "CF", name: "Centrafrique", flag: "🇨🇫", phoneCode: "+236", phoneDigits: 8, currency: "XAF" },
  { code: "GA", name: "Gabon", flag: "🇬🇦", phoneCode: "+241", phoneDigits: 8, currency: "XAF" },
  { code: "RW", name: "Rwanda", flag: "🇷🇼", phoneCode: "+250", phoneDigits: 9, currency: "RWF" },
  { code: "GM", name: "Gambie", flag: "🇬🇲", phoneCode: "+220", phoneDigits: 7, currency: "GMD" },
] as const;

// Operators by country for AfribaPay (verified from AfribaPay documentation)
// All operators support both payin and payout unless noted
export const OPERATORS = {
  BJ: [
    { code: "moov", name: "Moov Money", requiresOtp: false },
    { code: "mtn", name: "MTN Mobile Money", requiresOtp: false },
    { code: "celtiis", name: "Celtiis", requiresOtp: false },
  ],
  CI: [
    { code: "orange", name: "Orange Money", requiresOtp: true },
    { code: "moov", name: "Moov Money", requiresOtp: false },
    { code: "mtn", name: "MTN Mobile Money", requiresOtp: false },
    { code: "wave", name: "Wave", requiresOtp: false },
  ],
  SN: [
    { code: "orange", name: "Orange Money", requiresOtp: true },
    { code: "free", name: "Free Money", requiresOtp: false },
    { code: "expresso", name: "Expresso", requiresOtp: false },
    { code: "wave", name: "Wave", requiresOtp: false },
  ],
  BF: [
    { code: "orange", name: "Orange Money", requiresOtp: true },
    { code: "moov", name: "Moov Money", requiresOtp: false },
    { code: "wave", name: "Wave", requiresOtp: false },
    { code: "coris", name: "Coris Money", requiresOtp: false },
  ],
  TG: [
    { code: "moov", name: "Moov Money", requiresOtp: false },
    { code: "tmoney", name: "Togocell", requiresOtp: false },
    { code: "togocom", name: "TogoCom (Togocel)", requiresOtp: false },
  ],
  ML: [
    { code: "orange", name: "Orange Money", requiresOtp: false },
    { code: "moov", name: "Moov Money", requiresOtp: false },
  ],
  GN: [
    { code: "orange", name: "Orange Money", requiresOtp: true },
    { code: "mtn", name: "MTN Mobile Money", requiresOtp: false },
  ],
  NE: [
    { code: "airtel", name: "Airtel Money", requiresOtp: false },
  ],
  CM: [
    { code: "orange", name: "Orange Money", requiresOtp: false },
    { code: "mtn", name: "MTN Mobile Money", requiresOtp: false },
    { code: "moov", name: "Moov Money", requiresOtp: false },
  ],
  CD: [
    { code: "orange", name: "Orange Money", requiresOtp: false },
    { code: "airtel", name: "Airtel Money", requiresOtp: false },
    { code: "mpesa", name: "M-Pesa", requiresOtp: false },
    { code: "afrimoney", name: "Afrimoney", requiresOtp: false },
  ],
  TD: [
    { code: "airtel", name: "Airtel Money", requiresOtp: false },
    { code: "moov", name: "Moov Money", requiresOtp: false },
  ],
  CG: [
    { code: "airtel", name: "Airtel Money", requiresOtp: false },
    { code: "mtn", name: "MTN Mobile Money", requiresOtp: false },
  ],
  CF: [
    { code: "orange", name: "Orange Money", requiresOtp: false },
    { code: "telecel", name: "Telecel", requiresOtp: false },
  ],
  GA: [
    { code: "airtel", name: "Airtel Money", requiresOtp: false },
    { code: "moov", name: "Moov Money", requiresOtp: false },
  ],
  RW: [
    { code: "mtn", name: "MTN Mobile Money", requiresOtp: false },
    { code: "airtel", name: "Airtel Money", requiresOtp: false },
  ],
  GM: [
    { code: "afrimoney", name: "Afrimoney", requiresOtp: false },
    { code: "qmoney", name: "QMoney", requiresOtp: false },
    { code: "wave", name: "Wave", requiresOtp: false },
  ],
} as const;

// All countries support both collect (payin) and payout (16 countries including GM)
export const COLLECT_COUNTRIES = ["BJ", "CI", "SN", "BF", "TG", "ML", "GN", "NE", "CM", "CD", "TD", "CG", "CF", "GA", "RW", "GM"] as const;
export const PAYOUT_COUNTRIES = ["BJ", "CI", "SN", "BF", "TG", "ML", "GN", "NE", "CM", "CD", "TD", "CG", "CF", "GA", "RW", "GM"] as const;

// All operators available for collect (payin) by country
export const COLLECT_OPERATORS: Record<string, string[]> = {
  BJ: ["moov", "mtn", "celtiis"],
  CI: ["orange", "moov", "mtn", "wave"],
  SN: ["orange", "free", "expresso", "wave"],
  BF: ["orange", "moov", "wave", "coris"],
  TG: ["moov", "tmoney", "togocom"],
  ML: ["orange", "moov"],
  GN: ["orange", "mtn"],
  NE: ["airtel"],
  CM: ["orange", "mtn", "moov"],
  CD: ["orange", "airtel", "mpesa", "afrimoney"],
  TD: ["airtel", "moov"],
  CG: ["airtel", "mtn"],
  CF: ["orange", "telecel"],
  GA: ["airtel", "moov"],
  RW: ["mtn", "airtel"],
  GM: ["afrimoney", "qmoney", "wave"],
};

// All operators available for payout by country
export const PAYOUT_OPERATORS: Record<string, string[]> = {
  BJ: ["moov", "mtn", "celtiis"],
  CI: ["orange", "moov", "mtn", "wave"],
  SN: ["orange", "free", "expresso", "wave"],
  BF: ["orange", "moov", "wave", "coris"],
  TG: ["moov", "tmoney", "togocom"],
  ML: ["orange", "moov"],
  GN: ["orange", "mtn"],
  NE: ["airtel"],
  CM: ["orange", "mtn", "moov"],
  CD: ["orange", "airtel", "mpesa", "afrimoney"],
  TD: ["airtel", "moov"],
  CG: ["airtel", "mtn"],
  CF: ["orange", "telecel"],
  GA: ["airtel", "moov"],
  RW: ["mtn", "airtel"],
  GM: ["afrimoney", "qmoney", "wave"],
};
