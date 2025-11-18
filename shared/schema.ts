import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  balance: integer("balance").notNull().default(0), // Balance in XOF
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
  publicKey: text("public_key").notNull().unique(),
  privateKey: text("private_key").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Transactions
export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // "deposit", "transfer", "payment_link", "merchant_link", "api_payment"
  amount: integer("amount").notNull(), // Amount in XOF
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

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  balance: true,
  createdAt: true,
});

export const insertPaymentLinkSchema = createInsertSchema(paymentLinks).omit({
  id: true,
  userId: true,
  token: true,
  createdAt: true,
});

export const insertMerchantLinkSchema = createInsertSchema(merchantLinks).omit({
  id: true,
  userId: true,
  token: true,
  createdAt: true,
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

// Country and operator constants
export const COUNTRIES = [
  { code: "BJ", name: "Bénin", flag: "🇧🇯" },
  { code: "TG", name: "Togo", flag: "🇹🇬" },
  { code: "CI", name: "Côte d'Ivoire", flag: "🇨🇮" },
  { code: "SN", name: "Sénégal", flag: "🇸🇳" },
  { code: "BF", name: "Burkina Faso", flag: "🇧🇫" },
  { code: "ML", name: "Mali", flag: "🇲🇱" },
] as const;

export const OPERATORS = {
  SN: [
    { code: "orange", name: "Orange Money" },
    { code: "free", name: "Free Money" },
    { code: "expresso", name: "Expresso" },
    { code: "wave", name: "Wave" },
    { code: "wizall", name: "Wizall" },
  ],
  CI: [
    { code: "orange", name: "Orange Money" },
    { code: "mtn", name: "MTN" },
    { code: "moov", name: "Moov" },
    { code: "wave", name: "Wave" },
  ],
  BF: [
    { code: "orange", name: "Orange Money" },
    { code: "moov", name: "Moov" },
  ],
  BJ: [
    { code: "moov", name: "Moov" },
    { code: "mtn", name: "MTN" },
  ],
  TG: [
    { code: "tmoney", name: "T-Money" },
    { code: "moov", name: "Moov" },
  ],
  ML: [
    { code: "orange", name: "Orange Money" },
    { code: "moov", name: "Moov" },
  ],
} as const;
