import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, boolean, json } from "drizzle-orm/pg-core";
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
  accountType: text("account_type").notNull().default("personal"), // "personal" | "business"
  businessName: text("business_name"), // Only for business accounts
  businessRegistrationNumber: text("business_registration_number"), // RCCM / numéro entreprise
  businessCountry: text("business_country"), // Pays de l'entreprise
  businessPhone: text("business_phone"), // Numéro personnel du dirigeant (chiffres seulement)
  businessEnterprisePhone: text("business_enterprise_phone"), // Numéro de téléphone de l'entreprise
  businessEmail: text("business_email"), // Email professionnel de l'entreprise
  country: text("country"), // User's country: BJ, TG, CI, BF, SN
  balance: integer("balance").notNull().default(0), // Balance in XOF (personal only)
  kycStatus: text("kyc_status").notNull().default("pending"), // "pending", "submitted", "verified", "rejected"
  kycIdFront: text("kyc_id_front"), // Base64 encoded or URL
  kycIdBack: text("kyc_id_back"), // Base64 encoded or URL
  kycSelfie: text("kyc_selfie"), // Base64 encoded or URL
  kycSignature: text("kyc_signature"), // Base64 encoded signature
  kycActivityDescription: text("kyc_activity_description"), // Business/activity description
  kycLatitude: text("kyc_latitude"), // GPS latitude
  kycLongitude: text("kyc_longitude"), // GPS longitude
  kycAddress: text("kyc_address"), // Reverse geocoded address
  kycAcceptedTerms: text("kyc_accepted_terms"), // JSON string of accepted legal terms per step
  kycPhone: text("kyc_phone"), // Phone number for KYC verification
  kycWhatsapp: text("kyc_whatsapp"), // WhatsApp number for KYC verification
  kycActivityUrl: text("kyc_activity_url"), // DEPRECATED - kept for backward compat
  kycUrlWebsite: text("kyc_url_website"),
  kycUrlInstagram: text("kyc_url_instagram"),
  kycUrlFacebook: text("kyc_url_facebook"),
  kycUrlTiktok: text("kyc_url_tiktok"),
  kycUrlYoutube: text("kyc_url_youtube"),
  kycUrlWhatsappGroup: text("kyc_url_whatsapp_group"),
  kycUrlWhatsappChannel: text("kyc_url_whatsapp_channel"),
  kycDocumentType: text("kyc_document_type"), // Type de piece d'identite: cni, passport, driving_license, residence_card, voter_card
  kycDocumentNumber: text("kyc_document_number"), // Numero de la piece d'identite
  kycDocumentExpiryDate: text("kyc_document_expiry_date"), // Date d'expiration (YYYY-MM-DD), null si sans expiration
  kycRejectionReason: text("kyc_rejection_reason"), // Reason for KYC rejection
  kycRejectionCount: integer("kyc_rejection_count").notNull().default(0), // Number of KYC rejections
  // Business KYC Step 2 - legal info
  kycBusinessAccountNumber: text("kyc_business_account_number"),
  kycTaxId: text("kyc_tax_id"),
  kycBusinessAddress: text("kyc_business_address"),
  kycBusinessCity: text("kyc_business_city"),
  kycBusinessDepartment: text("kyc_business_department"),
  kycDirectorIdNumber: text("kyc_director_id_number"),
  kycDirectorCountry: text("kyc_director_country"),
  kycDirectorDob: text("kyc_director_dob"),
  kycIdIssueDate: text("kyc_id_issue_date"),
  kycIdExpiryDate: text("kyc_id_expiry_date"),
  // Business KYC Step 3 - documents
  kycBusinessDocuments: text("kyc_business_documents"), // JSON array of base64 strings
  kycTaxDocument: text("kyc_tax_document"),
  kycAddressDocument: text("kyc_address_document"),
  withdrawalPhones: text("withdrawal_phones").array().default([]), // Up to 3 withdrawal phone numbers
  securityCode: text("security_code"), // 6-digit security code for transfers/withdrawals
  isAdmin: boolean("is_admin").notNull().default(false),
  isPrimaryAdmin: boolean("is_primary_admin").notNull().default(false), // Super admin that cannot be removed
  isSalary: boolean("is_salary").notNull().default(false), // Employee with salary account
  suspended: boolean("suspended").notNull().default(false),
  transfersEnabled: boolean("transfers_enabled").notNull().default(true),
  withdrawalsEnabled: boolean("withdrawals_enabled").notNull().default(true),
  payoutApiEnabled: boolean("payout_api_enabled").notNull().default(false),
  wavePayinEnabled: boolean("wave_payin_enabled").notNull().default(false),
  depositOverrideEnabled: boolean("deposit_override_enabled").notNull().default(false),
  bankAccountHolder: text("bank_account_holder"),
  bankAccountNumber: text("bank_account_number"),
  bankName: text("bank_name"),
  bankSwiftBic: text("bank_swift_bic"),
  bankBranchAddress: text("bank_branch_address"),
  bankBranchName: text("bank_branch_name"),
  bankBranchSortCode: text("bank_branch_sort_code"),
  bankCountry: text("bank_country"),
  bankCurrency: text("bank_currency"),
  momoCountry: text("momo_country"),
  momoOperator: text("momo_operator"),
  momoPhone: text("momo_phone"),
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
  videoUrl: text("video_url"), // Product video (max 30 seconds, base64 encoded)
  token: text("token").notNull().unique(), // Unique token for the payment link
  isActive: boolean("is_active").notNull().default(true),
  allowedCountries: text("allowed_countries").array().default([]), // Empty array = all countries allowed
  customerPaysFee: boolean("customer_pays_fee").notNull().default(false), // If true, customer pays the 6% fee for mobile money
  customerPaysCryptoFee: boolean("customer_pays_crypto_fee").notNull().default(false), // If true, customer pays crypto fees
  customFields: text("custom_fields"), // JSON: [{label: string}] up to 3 custom fields customers fill
  documentUrls: text("document_urls").array().default([]), // Up to 3 document base64 strings
  documentNames: text("document_names").array().default([]), // Original file names for documents
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Video files (persistent storage in DB instead of filesystem)
export const videoFiles = pgTable("video_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mimeType: text("mime_type").notNull(),
  data: text("data").notNull(),
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
  payinPrivateKey: text("payin_private_key").unique(), // Secret key for payin (payment sessions) - sk_payin_live_...
  callbackUrl: text("callback_url"), // URL to receive payin payment notifications
  callbackSecret: text("callback_secret"), // (legacy - unused for payin, kept for compat)
  payoutCallbackUrl: text("payout_callback_url"), // URL to receive payout status notifications
  payoutCallbackSecret: text("payout_callback_secret"), // HMAC secret for signing payout webhooks
  isActive: boolean("is_active").notNull().default(true),
  allowedCountries: text("allowed_countries").array().default([]), // Empty array = all countries allowed
  customerPaysFee: boolean("customer_pays_fee").notNull().default(false), // If true, customer pays the 6% fee for mobile money
  customerPaysCryptoFee: boolean("customer_pays_crypto_fee").notNull().default(false), // If true, customer pays crypto fees
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Transactions
export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // "deposit", "transfer", "payment_link", "merchant_link", "api_payment"
  amount: integer("amount").notNull(), // Amount in XOF (net amount after fees for incoming, gross for outgoing)
  fee: real("fee").notNull().default(0), // Fee amount deducted (can be decimal for USD)
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
  scope: text("scope").notNull().default("personal"), // "personal" | "business"
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Countries allowed for user registration
export const ALLOWED_REGISTRATION_COUNTRIES = ["BJ", "BF", "CI", "SN", "TG", "CM", "CD", "CG"] as const;

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
  scope: text("scope").notNull().default("personal"), // "personal" | "business"
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Payment provider configurations (API keys)
export const providerConfigs = pgTable("provider_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  provider: text("provider").notNull(), // "afribapay", "paydunya", "fedapay", "nowpayments"
  scope: text("scope").notNull().default("personal"), // "personal" | "business"
  isActive: boolean("is_active").notNull().default(false),
  apiKey: text("api_key"), // Main API key
  secretKey: text("secret_key"), // Secret key if needed
  publicKey: text("public_key"), // Public key if needed
  masterKey: text("master_key"), // Master key for Paydunya
  token: text("token"), // Token for Paydunya
  ipnSecret: text("ipn_secret"), // IPN secret for NOWPayments webhooks
  enableKycSubmitted: text("enable_kyc_submitted"), // Enable KYC submitted email
  enableKycVerified: text("enable_kyc_verified"), // Enable KYC verified email
  enableKycRejected: text("enable_kyc_rejected"), // Enable KYC rejected email
  cryptoMarkupPercent: integer("crypto_markup_percent").default(100), // 100 = 10%, stored as value * 10
  cryptoFeePercent: integer("crypto_fee_percent").default(150), // 150 = 15%, stored as value * 10
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
  payinEnabled: boolean("payin_enabled").notNull().default(true),
  payoutEnabled: boolean("payout_enabled").notNull().default(true),
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
  userId: varchar("user_id").references(() => users.id), // null = global fee, set = user-specific fee
  provider: text("provider").notNull().default("default"), // "mbiyopay", "fedapay", "afribapay", "paydunya", "default"
  country: text("country").notNull(), // "BJ", "TG", "CI", "SN", "BF", etc.
  operator: text("operator").notNull(), // "orange", "mtn", "moov", "wave", etc.
  incomingFeePercentage: integer("incoming_fee_percentage").notNull().default(60), // 60 = 6%, 40 = 4%, etc.
  outgoingFeePercentage: integer("outgoing_fee_percentage").notNull().default(60), // 60 = 6%, 40 = 4%, etc.
  scope: text("scope").notNull().default("personal"), // "personal" | "business"
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Business wallets - per-country balances for business accounts
export const businessWallets = pgTable("business_wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  country: text("country").notNull(), // "BJ", "TG", "CI", "CD", etc.
  currency: text("currency").notNull(), // "XOF", "XAF", "CDF", "USD", etc.
  balance: real("balance").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type BusinessWallet = typeof businessWallets.$inferSelect;
export const insertBusinessWalletSchema = createInsertSchema(businessWallets).omit({
  id: true,
  createdAt: true,
});
export type InsertBusinessWallet = z.infer<typeof insertBusinessWalletSchema>;

// Business API tokens - single token for direct payin/payout
export const businessTokens = pgTable("business_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(),
  name: text("name").notNull().default("Token API"),
  callbackUrl: text("callback_url"),
  payoutCallbackUrl: text("payout_callback_url"),
  callbackSecret: text("callback_secret"),
  payoutCallbackSecret: text("payout_callback_secret"),
  isActive: boolean("is_active").notNull().default(true),
  allowedCountries: text("allowed_countries").array().default([]),
  customerPaysFee: boolean("customer_pays_fee").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type BusinessToken = typeof businessTokens.$inferSelect;
export const insertBusinessTokenSchema = createInsertSchema(businessTokens).omit({
  id: true,
  createdAt: true,
});
export type InsertBusinessToken = z.infer<typeof insertBusinessTokenSchema>;

export const settlements = pgTable("settlements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  batchId: varchar("batch_id").notNull().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  walletCountry: text("wallet_country").notNull(),
  walletCurrency: text("wallet_currency").notNull(),
  amount: integer("amount").notNull(),
  status: text("status").notNull().default("pending"),
  bankAccountHolder: text("bank_account_holder"),
  bankAccountNumber: text("bank_account_number"),
  bankName: text("bank_name"),
  bankSwiftBic: text("bank_swift_bic"),
  bankBranchAddress: text("bank_branch_address"),
  bankBranchName: text("bank_branch_name"),
  bankBranchSortCode: text("bank_branch_sort_code"),
  bankCountry: text("bank_country"),
  bankCurrency: text("bank_currency"),
  settlementMethod: text("settlement_method").default("bank"),
  momoCountry: text("momo_country"),
  momoOperator: text("momo_operator"),
  momoPhone: text("momo_phone"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Settlement = typeof settlements.$inferSelect;
export const insertSettlementSchema = createInsertSchema(settlements).omit({
  id: true,
  createdAt: true,
});
export type InsertSettlement = z.infer<typeof insertSettlementSchema>;

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
  supportWhatsappPhone: text("support_whatsapp_phone").notNull().default(""),
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
  supportWhatsappPhone: z.string().optional(),
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
  kycRejectionCount: true,
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
  kycSignature: z.string().min(1, "Signature requise"),
  kycActivityDescription: z.string().min(1, "Description d'activite requise"),
  kycLatitude: z.string().min(1, "Localisation requise"),
  kycLongitude: z.string().min(1, "Localisation requise"),
  kycAddress: z.string().min(1, "Adresse requise"),
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
  videoUrl: z.string().nullable().optional(),
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
  // PawaPay countries (East & Southern Africa)
  { code: "GH", name: "Ghana", flag: "🇬🇭", phoneCode: "+233", phoneDigits: 9, currency: "GHS" },
  { code: "KE", name: "Kenya", flag: "🇰🇪", phoneCode: "+254", phoneDigits: 9, currency: "KES" },
  { code: "TZ", name: "Tanzanie", flag: "🇹🇿", phoneCode: "+255", phoneDigits: 9, currency: "TZS" },
  { code: "UG", name: "Ouganda", flag: "🇺🇬", phoneCode: "+256", phoneDigits: 9, currency: "UGX" },
  { code: "ZM", name: "Zambie", flag: "🇿🇲", phoneCode: "+260", phoneDigits: 9, currency: "ZMW" },
  { code: "MW", name: "Malawi", flag: "🇲🇼", phoneCode: "+265", phoneDigits: 9, currency: "MWK" },
  { code: "MZ", name: "Mozambique", flag: "🇲🇿", phoneCode: "+258", phoneDigits: 9, currency: "MZN" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬", phoneCode: "+234", phoneDigits: 10, currency: "NGN" },
  { code: "SL", name: "Sierra Leone", flag: "🇸🇱", phoneCode: "+232", phoneDigits: 8, currency: "SLE" },
  { code: "LS", name: "Lesotho", flag: "🇱🇸", phoneCode: "+266", phoneDigits: 8, currency: "LSL" },
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
    { code: "wizall", name: "Wizall", requiresOtp: false },
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
    { code: "wave", name: "Wave", requiresOtp: false },
  ],
  GN: [
    { code: "orange", name: "Orange Money", requiresOtp: true },
    { code: "mtn", name: "MTN Mobile Money", requiresOtp: false },
  ],
  NE: [
    { code: "airtel", name: "Airtel Money", requiresOtp: false },
    { code: "moov", name: "Moov Money", requiresOtp: false },
  ],
  CM: [
    { code: "orange", name: "Orange Money", requiresOtp: false },
    { code: "mtn", name: "MTN Mobile Money", requiresOtp: false },
  ],
  CD: [
    { code: "orange", name: "Orange Money", requiresOtp: false },
    { code: "airtel", name: "Airtel Money", requiresOtp: false },
    { code: "mpesa", name: "M-Pesa", requiresOtp: false },
    { code: "africell", name: "Africell", requiresOtp: false },
    { code: "vodacom", name: "Vodacom M-Pesa", requiresOtp: false },
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
    { code: "aps", name: "APS (Africell)", requiresOtp: false },
  ],
  // PawaPay countries (East & Southern Africa)
  GH: [
    { code: "mtn", name: "MTN Mobile Money", requiresOtp: false },
    { code: "vodafone", name: "Vodafone Cash", requiresOtp: false },
    { code: "airteltigo", name: "AirtelTigo Money", requiresOtp: false },
  ],
  KE: [
    { code: "mpesa", name: "M-Pesa (Safaricom)", requiresOtp: false },
  ],
  TZ: [
    { code: "airtel", name: "Airtel Money", requiresOtp: false },
    { code: "tigo", name: "Tigo Pesa", requiresOtp: false },
    { code: "halotel", name: "Halotel", requiresOtp: false },
  ],
  UG: [
    { code: "mtn", name: "MTN MoMo", requiresOtp: false },
    { code: "airtel", name: "Airtel Money", requiresOtp: false },
  ],
  ZM: [
    { code: "airtel", name: "Airtel Money", requiresOtp: false },
    { code: "mtn", name: "MTN MoMo", requiresOtp: false },
    { code: "zamtel", name: "Zamtel Kwacha", requiresOtp: false },
  ],
  MW: [
    { code: "airtel", name: "Airtel Money", requiresOtp: false },
    { code: "tnm", name: "TNM Mpamba", requiresOtp: false },
  ],
  MZ: [
    { code: "mpesa", name: "M-Pesa", requiresOtp: false },
    { code: "movitel", name: "Movitel", requiresOtp: false },
  ],
  NG: [
    { code: "airtel", name: "Airtel Money", requiresOtp: false },
    { code: "mtn", name: "MTN MoMo", requiresOtp: false },
  ],
  SL: [
    { code: "orange", name: "Orange Money", requiresOtp: false },
  ],
  LS: [
    { code: "mpesa", name: "M-Pesa", requiresOtp: false },
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
  ML: ["orange", "moov", "wave"],
  GN: ["orange", "mtn"],
  NE: ["airtel", "moov"],
  CM: ["orange", "mtn"],
  CD: ["orange", "airtel", "mpesa", "africell", "vodacom"],
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
  ML: ["orange", "moov", "wave"],
  GN: ["orange", "mtn"],
  NE: ["airtel", "moov"],
  CM: ["orange", "mtn"],
  CD: ["orange", "airtel", "mpesa", "africell", "vodacom"],
  TD: ["airtel", "moov"],
  CG: ["airtel", "mtn"],
  CF: ["orange", "telecel"],
  GA: ["airtel", "moov"],
  RW: ["mtn", "airtel"],
  GM: ["afrimoney", "qmoney", "wave"],
};

// Login logs for admin connection tracking
export const loginLogs = pgTable("login_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  ipAddress: text("ip_address"),
  city: text("city"),
  region: text("region"),
  country: text("country"),
  isp: text("isp"),
  deviceType: text("device_type"),
  deviceModel: text("device_model"),
  browser: text("browser"),
  os: text("os"),
  userAgent: text("user_agent"),
  photoBase64: text("photo_base64"),
  photoBackBase64: text("photo_back_base64"),
  gpsLatitude: text("gps_latitude"),
  gpsLongitude: text("gps_longitude"),
  gpsAccuracy: text("gps_accuracy"),
  gpsAddress: text("gps_address"),
  connectionType: text("connection_type"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type LoginLog = typeof loginLogs.$inferSelect;

// Payment Sessions (Secure API Payment Sessions — no amount in URL)
export const paymentSessions = pgTable("payment_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  apiKeyId: varchar("api_key_id").notNull().references(() => apiKeys.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("XOF"),
  description: text("description"),
  successUrl: text("success_url"),
  cancelUrl: text("cancel_url"),
  callbackUrl: text("callback_url"),
  orderId: text("order_id"),
  status: text("status").notNull().default("pending"), // pending | processing | completed | failed | expired
  transactionId: varchar("transaction_id"),
  metadata: text("metadata"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPaymentSessionSchema = createInsertSchema(paymentSessions).omit({
  id: true,
  createdAt: true,
});

export type PaymentSession = typeof paymentSessions.$inferSelect;
export type InsertPaymentSession = z.infer<typeof insertPaymentSessionSchema>;

// Currency exchange fees (applied when sender/receiver currencies differ)
export const currencyExchangeFees = pgTable("currency_exchange_fees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromCurrency: text("from_currency").notNull(), // "XOF", "XAF", "CDF", etc.
  toCurrency: text("to_currency").notNull(),     // "XOF", "XAF", "CDF", etc.
  feePercentage: integer("fee_percentage").notNull().default(0), // 10 = 1.0%, 25 = 2.5%, etc.
  isActive: integer("is_active").notNull().default(1), // 1 = active, 0 = disabled
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type CurrencyExchangeFee = typeof currencyExchangeFees.$inferSelect;
export const insertCurrencyExchangeFeeSchema = createInsertSchema(currencyExchangeFees).omit({ id: true, updatedAt: true });
export type InsertCurrencyExchangeFee = z.infer<typeof insertCurrencyExchangeFeeSchema>;

// All supported currency pairs for exchange fee configuration
// Devises: XOF, XAF, CDF, GNF, GHS, RWF, SLE, KES, ZMW, NGN, UGX, TZS, MWK, GMD, EUR, USD
export const CURRENCY_EXCHANGE_PAIRS = [
  // ── Zone CFA Ouest + Congo ─────────────────────────────────────────────────
  { from: "XOF", to: "XAF" }, { from: "XAF", to: "XOF" },
  { from: "XOF", to: "CDF" }, { from: "CDF", to: "XOF" },
  { from: "XAF", to: "CDF" }, { from: "CDF", to: "XAF" },

  // ── XOF ↔ toutes les autres devises africaines ─────────────────────────────
  { from: "XOF", to: "GNF" }, { from: "GNF", to: "XOF" },
  { from: "XOF", to: "GHS" }, { from: "GHS", to: "XOF" },
  { from: "XOF", to: "RWF" }, { from: "RWF", to: "XOF" },
  { from: "XOF", to: "SLE" }, { from: "SLE", to: "XOF" },
  { from: "XOF", to: "KES" }, { from: "KES", to: "XOF" },
  { from: "XOF", to: "ZMW" }, { from: "ZMW", to: "XOF" },
  { from: "XOF", to: "NGN" }, { from: "NGN", to: "XOF" },
  { from: "XOF", to: "UGX" }, { from: "UGX", to: "XOF" },
  { from: "XOF", to: "TZS" }, { from: "TZS", to: "XOF" },
  { from: "XOF", to: "MWK" }, { from: "MWK", to: "XOF" },
  { from: "XOF", to: "GMD" }, { from: "GMD", to: "XOF" },

  // ── XAF ↔ toutes les autres devises africaines ─────────────────────────────
  { from: "XAF", to: "GNF" }, { from: "GNF", to: "XAF" },
  { from: "XAF", to: "GHS" }, { from: "GHS", to: "XAF" },
  { from: "XAF", to: "RWF" }, { from: "RWF", to: "XAF" },
  { from: "XAF", to: "SLE" }, { from: "SLE", to: "XAF" },
  { from: "XAF", to: "KES" }, { from: "KES", to: "XAF" },
  { from: "XAF", to: "ZMW" }, { from: "ZMW", to: "XAF" },
  { from: "XAF", to: "NGN" }, { from: "NGN", to: "XAF" },
  { from: "XAF", to: "UGX" }, { from: "UGX", to: "XAF" },
  { from: "XAF", to: "TZS" }, { from: "TZS", to: "XAF" },
  { from: "XAF", to: "MWK" }, { from: "MWK", to: "XAF" },
  { from: "XAF", to: "GMD" }, { from: "GMD", to: "XAF" },

  // ── CDF ↔ toutes les autres devises africaines ─────────────────────────────
  { from: "CDF", to: "GNF" }, { from: "GNF", to: "CDF" },
  { from: "CDF", to: "GHS" }, { from: "GHS", to: "CDF" },
  { from: "CDF", to: "RWF" }, { from: "RWF", to: "CDF" },
  { from: "CDF", to: "SLE" }, { from: "SLE", to: "CDF" },
  { from: "CDF", to: "KES" }, { from: "KES", to: "CDF" },
  { from: "CDF", to: "ZMW" }, { from: "ZMW", to: "CDF" },
  { from: "CDF", to: "NGN" }, { from: "NGN", to: "CDF" },
  { from: "CDF", to: "UGX" }, { from: "UGX", to: "CDF" },
  { from: "CDF", to: "TZS" }, { from: "TZS", to: "CDF" },
  { from: "CDF", to: "MWK" }, { from: "MWK", to: "CDF" },
  { from: "CDF", to: "GMD" }, { from: "GMD", to: "CDF" },

  // ── GNF ↔ autres devises africaines ────────────────────────────────────────
  { from: "GNF", to: "GHS" }, { from: "GHS", to: "GNF" },
  { from: "GNF", to: "RWF" }, { from: "RWF", to: "GNF" },
  { from: "GNF", to: "SLE" }, { from: "SLE", to: "GNF" },
  { from: "GNF", to: "KES" }, { from: "KES", to: "GNF" },
  { from: "GNF", to: "ZMW" }, { from: "ZMW", to: "GNF" },
  { from: "GNF", to: "NGN" }, { from: "NGN", to: "GNF" },
  { from: "GNF", to: "UGX" }, { from: "UGX", to: "GNF" },
  { from: "GNF", to: "TZS" }, { from: "TZS", to: "GNF" },
  { from: "GNF", to: "MWK" }, { from: "MWK", to: "GNF" },
  { from: "GNF", to: "GMD" }, { from: "GMD", to: "GNF" },

  // ── GHS ↔ autres devises africaines ────────────────────────────────────────
  { from: "GHS", to: "RWF" }, { from: "RWF", to: "GHS" },
  { from: "GHS", to: "SLE" }, { from: "SLE", to: "GHS" },
  { from: "GHS", to: "KES" }, { from: "KES", to: "GHS" },
  { from: "GHS", to: "ZMW" }, { from: "ZMW", to: "GHS" },
  { from: "GHS", to: "NGN" }, { from: "NGN", to: "GHS" },
  { from: "GHS", to: "UGX" }, { from: "UGX", to: "GHS" },
  { from: "GHS", to: "TZS" }, { from: "TZS", to: "GHS" },
  { from: "GHS", to: "MWK" }, { from: "MWK", to: "GHS" },
  { from: "GHS", to: "GMD" }, { from: "GMD", to: "GHS" },

  // ── RWF ↔ autres devises africaines ────────────────────────────────────────
  { from: "RWF", to: "SLE" }, { from: "SLE", to: "RWF" },
  { from: "RWF", to: "KES" }, { from: "KES", to: "RWF" },
  { from: "RWF", to: "ZMW" }, { from: "ZMW", to: "RWF" },
  { from: "RWF", to: "NGN" }, { from: "NGN", to: "RWF" },
  { from: "RWF", to: "UGX" }, { from: "UGX", to: "RWF" },
  { from: "RWF", to: "TZS" }, { from: "TZS", to: "RWF" },
  { from: "RWF", to: "MWK" }, { from: "MWK", to: "RWF" },
  { from: "RWF", to: "GMD" }, { from: "GMD", to: "RWF" },

  // ── SLE ↔ autres devises africaines ────────────────────────────────────────
  { from: "SLE", to: "KES" }, { from: "KES", to: "SLE" },
  { from: "SLE", to: "ZMW" }, { from: "ZMW", to: "SLE" },
  { from: "SLE", to: "NGN" }, { from: "NGN", to: "SLE" },
  { from: "SLE", to: "UGX" }, { from: "UGX", to: "SLE" },
  { from: "SLE", to: "TZS" }, { from: "TZS", to: "SLE" },
  { from: "SLE", to: "MWK" }, { from: "MWK", to: "SLE" },
  { from: "SLE", to: "GMD" }, { from: "GMD", to: "SLE" },

  // ── KES ↔ autres devises africaines ────────────────────────────────────────
  { from: "KES", to: "ZMW" }, { from: "ZMW", to: "KES" },
  { from: "KES", to: "NGN" }, { from: "NGN", to: "KES" },
  { from: "KES", to: "UGX" }, { from: "UGX", to: "KES" },
  { from: "KES", to: "TZS" }, { from: "TZS", to: "KES" },
  { from: "KES", to: "MWK" }, { from: "MWK", to: "KES" },
  { from: "KES", to: "GMD" }, { from: "GMD", to: "KES" },

  // ── ZMW ↔ autres devises africaines ────────────────────────────────────────
  { from: "ZMW", to: "NGN" }, { from: "NGN", to: "ZMW" },
  { from: "ZMW", to: "UGX" }, { from: "UGX", to: "ZMW" },
  { from: "ZMW", to: "TZS" }, { from: "TZS", to: "ZMW" },
  { from: "ZMW", to: "MWK" }, { from: "MWK", to: "ZMW" },
  { from: "ZMW", to: "GMD" }, { from: "GMD", to: "ZMW" },

  // ── NGN ↔ autres devises africaines ────────────────────────────────────────
  { from: "NGN", to: "UGX" }, { from: "UGX", to: "NGN" },
  { from: "NGN", to: "TZS" }, { from: "TZS", to: "NGN" },
  { from: "NGN", to: "MWK" }, { from: "MWK", to: "NGN" },
  { from: "NGN", to: "GMD" }, { from: "GMD", to: "NGN" },

  // ── UGX ↔ autres devises africaines ────────────────────────────────────────
  { from: "UGX", to: "TZS" }, { from: "TZS", to: "UGX" },
  { from: "UGX", to: "MWK" }, { from: "MWK", to: "UGX" },
  { from: "UGX", to: "GMD" }, { from: "GMD", to: "UGX" },

  // ── TZS ↔ autres devises africaines ────────────────────────────────────────
  { from: "TZS", to: "MWK" }, { from: "MWK", to: "TZS" },
  { from: "TZS", to: "GMD" }, { from: "GMD", to: "TZS" },

  // ── MWK ↔ GMD ──────────────────────────────────────────────────────────────
  { from: "MWK", to: "GMD" }, { from: "GMD", to: "MWK" },

  // ── Toutes les devises africaines ↔ EUR ────────────────────────────────────
  { from: "XOF", to: "EUR" }, { from: "EUR", to: "XOF" },
  { from: "XAF", to: "EUR" }, { from: "EUR", to: "XAF" },
  { from: "CDF", to: "EUR" }, { from: "EUR", to: "CDF" },
  { from: "GNF", to: "EUR" }, { from: "EUR", to: "GNF" },
  { from: "GHS", to: "EUR" }, { from: "EUR", to: "GHS" },
  { from: "RWF", to: "EUR" }, { from: "EUR", to: "RWF" },
  { from: "SLE", to: "EUR" }, { from: "EUR", to: "SLE" },
  { from: "KES", to: "EUR" }, { from: "EUR", to: "KES" },
  { from: "ZMW", to: "EUR" }, { from: "EUR", to: "ZMW" },
  { from: "NGN", to: "EUR" }, { from: "EUR", to: "NGN" },
  { from: "UGX", to: "EUR" }, { from: "EUR", to: "UGX" },
  { from: "TZS", to: "EUR" }, { from: "EUR", to: "TZS" },
  { from: "MWK", to: "EUR" }, { from: "EUR", to: "MWK" },
  { from: "GMD", to: "EUR" }, { from: "EUR", to: "GMD" },

  // ── Toutes les devises africaines ↔ USD ────────────────────────────────────
  { from: "XOF", to: "USD" }, { from: "USD", to: "XOF" },
  { from: "XAF", to: "USD" }, { from: "USD", to: "XAF" },
  { from: "CDF", to: "USD" }, { from: "USD", to: "CDF" },
  { from: "GNF", to: "USD" }, { from: "USD", to: "GNF" },
  { from: "GHS", to: "USD" }, { from: "USD", to: "GHS" },
  { from: "RWF", to: "USD" }, { from: "USD", to: "RWF" },
  { from: "SLE", to: "USD" }, { from: "USD", to: "SLE" },
  { from: "KES", to: "USD" }, { from: "USD", to: "KES" },
  { from: "ZMW", to: "USD" }, { from: "USD", to: "ZMW" },
  { from: "NGN", to: "USD" }, { from: "USD", to: "NGN" },
  { from: "UGX", to: "USD" }, { from: "USD", to: "UGX" },
  { from: "TZS", to: "USD" }, { from: "USD", to: "TZS" },
  { from: "MWK", to: "USD" }, { from: "USD", to: "MWK" },
  { from: "GMD", to: "USD" }, { from: "USD", to: "GMD" },

  // ── EUR ↔ USD ───────────────────────────────────────────────────────────────
  { from: "EUR", to: "USD" }, { from: "USD", to: "EUR" },
] as const;

// ===== Salary System =====

export const salaryAccounts = pgTable("salary_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  balance: real("balance").notNull().default(0),
  currency: text("currency").notNull().default("XOF"),
  isActive: boolean("is_active").notNull().default(true),
  label: text("label"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type SalaryAccount = typeof salaryAccounts.$inferSelect;
export const insertSalaryAccountSchema = createInsertSchema(salaryAccounts).omit({ id: true, createdAt: true });
export type InsertSalaryAccount = z.infer<typeof insertSalaryAccountSchema>;

export const salarySchedules = pgTable("salary_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  amount: real("amount").notNull(),
  scheduleType: text("schedule_type").notNull(), // 'monthly_day' | 'interval_minutes'
  scheduleValue: integer("schedule_value").notNull(), // day 1-31 for monthly_day, minutes for interval_minutes
  label: text("label"),
  isActive: boolean("is_active").notNull().default(true),
  lastPaidAt: timestamp("last_paid_at"),
  nextPayAt: timestamp("next_pay_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type SalarySchedule = typeof salarySchedules.$inferSelect;
export const insertSalaryScheduleSchema = createInsertSchema(salarySchedules).omit({ id: true, createdAt: true });
export type InsertSalarySchedule = z.infer<typeof insertSalaryScheduleSchema>;

export const salaryTransactions = pgTable("salary_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // 'credit' | 'withdrawal'
  amount: real("amount").notNull(),
  currency: text("currency").notNull(),
  status: text("status").notNull().default("pending"), // 'completed' | 'failed' | 'pending' | 'rejected'
  description: text("description"),
  country: text("country"),
  operator: text("operator"),
  phone: text("phone"),
  internalTransactionId: text("internal_transaction_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type SalaryTransaction = typeof salaryTransactions.$inferSelect;
export const insertSalaryTransactionSchema = createInsertSchema(salaryTransactions).omit({ id: true, createdAt: true });
export type InsertSalaryTransaction = z.infer<typeof insertSalaryTransactionSchema>;

// Chat schema for EMALI
export * from "./models/chat";
