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
  balance: integer("balance").notNull().default(0), // Balance in XOF
  kycStatus: text("kyc_status").notNull().default("pending"), // "pending", "submitted", "verified", "rejected"
  kycIdFront: text("kyc_id_front"), // Base64 encoded or URL
  kycIdBack: text("kyc_id_back"), // Base64 encoded or URL
  kycSelfie: text("kyc_selfie"), // Base64 encoded or URL
  kycRejectionReason: text("kyc_rejection_reason"), // Reason for KYC rejection
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
  imageUrl: text("image_url"),
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

// Country/Operator Configuration - Admin control
export const countryOperatorConfig = pgTable("country_operator_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  country: text("country").notNull(), // "BJ", "TG", "CI", "SN", "BF", "ML"
  operator: text("operator").notNull(), // "orange", "mtn", "moov", "wave", "free", "tmoney", "wizall", "expresso"
  incomingEnabled: boolean("incoming_enabled").notNull().default(true), // For deposits
  outgoingEnabled: boolean("outgoing_enabled").notNull().default(true), // For withdrawals
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  balance: true,
  kycStatus: true,
  kycIdFront: true,
  kycIdBack: true,
  kycSelfie: true,
  createdAt: true,
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

// Currency constants
export const CURRENCIES = [
  { code: "XOF", name: "Franc CFA", symbol: "Fr", rate: 1 },
  { code: "USD", name: "Dollar US", symbol: "$", rate: 0.0015 },
  { code: "EUR", name: "Euro", symbol: "€", rate: 0.0015 },
] as const;

export const CURRENCY_CONVERSION_RATES: Record<string, number> = {
  XOF: 1,
  USD: 0.0015,
  EUR: 0.0014,
};

// Country and operator constants
// Countries supported by FedaPay (7 countries total)
// Collect (incoming): BJ, TG, CI, SN, GN, NE
// Payout (outgoing): BJ, TG, CI, SN, BF, GN
export const COUNTRIES = [
  { code: "BJ", name: "Benin", flag: "BJ" },
  { code: "TG", name: "Togo", flag: "TG" },
  { code: "CI", name: "Cote d'Ivoire", flag: "CI" },
  { code: "SN", name: "Senegal", flag: "SN" },
  { code: "BF", name: "Burkina Faso", flag: "BF" },
  { code: "GN", name: "Guinee", flag: "GN" },
  { code: "NE", name: "Niger", flag: "NE" },
] as const;

// Operators by country for FedaPay
// Codes are simple operator names (mtn, moov, etc.) - backend combines with country
// Collect = incoming payments (deposits, payment links)
// Payout = outgoing payments (withdrawals)
export const OPERATORS = {
  // Benin - Collect: MTN, Moov, Celtiis | Payout: MTN, Moov, Celtiis
  BJ: [
    { code: "mtn", name: "MTN Mobile Money" },
    { code: "moov", name: "Moov Money" },
    { code: "celtiis", name: "Celtiis" },
  ],
  // Togo - Collect: Moov, TogoCom | Payout: Moov, TogoCom
  TG: [
    { code: "togocom", name: "TogoCom (TMoney)" },
    { code: "moov", name: "Moov Money" },
  ],
  // Cote d'Ivoire - Collect: MTN | Payout: MTN, Moov, Wave, Orange
  CI: [
    { code: "mtn", name: "MTN Mobile Money" },
    { code: "moov", name: "Moov Money" },
    { code: "wave", name: "Wave" },
    { code: "orange", name: "Orange Money" },
  ],
  // Senegal - Collect: Free | Payout: Wave, Orange
  SN: [
    { code: "free", name: "Free Money" },
    { code: "wave", name: "Wave" },
    { code: "orange", name: "Orange Money" },
  ],
  // Burkina Faso - Collect: None | Payout: Moov, Orange
  BF: [
    { code: "moov", name: "Moov Money" },
    { code: "orange", name: "Orange Money" },
  ],
  // Guinee - Collect: MTN | Payout: MTN
  GN: [
    { code: "mtn", name: "MTN Mobile Money" },
  ],
  // Niger - Collect: Airtel | Payout: None
  NE: [
    { code: "airtel", name: "Airtel Money" },
  ],
} as const;

// Countries that support collect (deposits/incoming payments) via FedaPay
export const COLLECT_COUNTRIES = ["BJ", "TG", "CI", "SN", "GN", "NE"] as const;

// Countries that support payout (withdrawals/outgoing payments) via FedaPay
export const PAYOUT_COUNTRIES = ["BJ", "TG", "CI", "SN", "BF", "GN"] as const;

// Operators available for collect by country
export const COLLECT_OPERATORS: Record<string, string[]> = {
  BJ: ["mtn", "moov", "celtiis"],
  TG: ["moov", "togocom"],
  CI: ["mtn"],
  SN: ["free"],
  GN: ["mtn"],
  NE: ["airtel"],
};

// Operators available for payout by country
export const PAYOUT_OPERATORS: Record<string, string[]> = {
  BJ: ["mtn", "moov", "celtiis"],
  TG: ["moov", "togocom"],
  CI: ["mtn", "moov", "wave", "orange"],
  SN: ["wave", "orange"],
  BF: ["moov", "orange"],
  GN: ["mtn"],
};
