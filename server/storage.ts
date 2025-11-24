import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, desc } from "drizzle-orm";
import * as schema from "@shared/schema";
import type {
  User,
  InsertUser,
  PaymentLink,
  InsertPaymentLink,
  MerchantLink,
  InsertMerchantLink,
  ApiKey,
  InsertApiKey,
  Transaction,
  InsertTransaction,
  CountryOperatorConfig,
  InsertCountryOperatorConfig,
  UpdateCountryOperatorConfig,
} from "@shared/schema";
import { randomUUID } from "crypto";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client, { schema });

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserBalance(id: string, amount: number): Promise<User | undefined>;
  updateUserPassword(id: string, hashedPassword: string): Promise<User | undefined>;
  submitKyc(userId: string, kycData: { kycIdFront: string; kycIdBack: string; kycSelfie: string }): Promise<User | undefined>;
  approveKyc(userId: string): Promise<User | undefined>;
  rejectKyc(userId: string, reason?: string): Promise<User | undefined>;
  getPendingKycSubmissions(): Promise<User[]>;
  getKycHistory(): Promise<User[]>;
  suspendUser(userId: string): Promise<User | undefined>;
  unsuspendUser(userId: string): Promise<User | undefined>;

  // Payment Links
  getPaymentLinks(userId: string): Promise<PaymentLink[]>;
  getPaymentLinkByToken(token: string): Promise<PaymentLink | undefined>;
  createPaymentLink(link: InsertPaymentLink & { userId: string }): Promise<PaymentLink>;
  updatePaymentLink(id: string, userId: string, link: Partial<InsertPaymentLink>): Promise<PaymentLink | undefined>;
  deletePaymentLink(id: string, userId: string): Promise<boolean>;

  // Merchant Links
  getMerchantLinks(userId: string): Promise<MerchantLink[]>;
  getMerchantLinkByToken(token: string): Promise<MerchantLink | undefined>;
  getMerchantLinkByName(merchantName: string): Promise<MerchantLink | undefined>;
  createMerchantLink(link: InsertMerchantLink & { userId: string }): Promise<MerchantLink>;
  deleteMerchantLink(id: string, userId: string): Promise<boolean>;

  // API Keys
  getApiKeys(userId: string): Promise<ApiKey[]>;
  getApiKeyByPublicKey(publicKey: string): Promise<ApiKey | undefined>;
  getApiKeyByPrivateKey(privateKey: string): Promise<ApiKey | undefined>;
  createApiKey(key: InsertApiKey & { userId: string }): Promise<ApiKey>;
  deleteApiKey(id: string, userId: string): Promise<boolean>;

  // Transactions
  getTransaction(id: string): Promise<Transaction | undefined>;
  getTransactions(userId: string, limit?: number): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransactionStatus(id: string, status: string, paydunyaData?: any): Promise<Transaction | undefined>;
  getUserStats(userId: string): Promise<{
    totalBalance: number;
    totalDeposits: number;
    totalTransfers: number;
    recentTransactions: Transaction[];
  }>;

  // Country/Operator Config
  getCountryOperatorConfigs(): Promise<CountryOperatorConfig[]>;
  getCountryOperatorConfig(country: string, operator: string): Promise<CountryOperatorConfig | undefined>;
  updateCountryOperatorConfig(country: string, operator: string, config: UpdateCountryOperatorConfig): Promise<CountryOperatorConfig | undefined>;
  initializeCountryOperatorConfigs(): Promise<void>;
}

export class DbStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const results = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
    return results[0];
  }

  async getUserById(id: string): Promise<User | undefined> {
    return this.getUser(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const results = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    return results[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const results = await db.insert(schema.users).values(user).returning();
    return results[0];
  }

  async updateUserBalance(id: string, amount: number): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;
    const newBalance = user.balance + amount;
    const results = await db
      .update(schema.users)
      .set({ balance: newBalance })
      .where(eq(schema.users.id, id))
      .returning();
    return results[0];
  }

  async updateUserPassword(id: string, hashedPassword: string): Promise<User | undefined> {
    const results = await db
      .update(schema.users)
      .set({ password: hashedPassword })
      .where(eq(schema.users.id, id))
      .returning();
    return results[0];
  }

  async submitKyc(userId: string, kycData: { kycIdFront: string; kycIdBack: string; kycSelfie: string }): Promise<User | undefined> {
    const results = await db
      .update(schema.users)
      .set({
        kycStatus: "submitted",
        kycIdFront: kycData.kycIdFront,
        kycIdBack: kycData.kycIdBack,
        kycSelfie: kycData.kycSelfie,
      })
      .where(eq(schema.users.id, userId))
      .returning();
    return results[0];
  }

  async approveKyc(userId: string): Promise<User | undefined> {
    const results = await db
      .update(schema.users)
      .set({ kycStatus: "verified" })
      .where(eq(schema.users.id, userId))
      .returning();
    return results[0];
  }

  async rejectKyc(userId: string, reason?: string): Promise<User | undefined> {
    const results = await db
      .update(schema.users)
      .set({ 
        kycStatus: "pending",
        kycRejectionReason: reason || null,
      })
      .where(eq(schema.users.id, userId))
      .returning();
    return results[0];
  }

  async getPendingKycSubmissions(): Promise<User[]> {
    return db
      .select()
      .from(schema.users)
      .where(eq(schema.users.kycStatus, "submitted"))
      .orderBy(desc(schema.users.createdAt));
  }

  async getKycHistory(): Promise<User[]> {
    // Return all users with KYC submissions (submitted, verified, or rejected)
    return db
      .select()
      .from(schema.users)
      .where((c) => {
        // Use raw SQL to check if kycStatus is not 'pending'
        return sql`${c.kycStatus} IN ('submitted', 'verified', 'rejected')`;
      })
      .orderBy(desc(schema.users.createdAt));
  }

  async suspendUser(userId: string): Promise<User | undefined> {
    const results = await db
      .update(schema.users)
      .set({ suspended: true })
      .where(eq(schema.users.id, userId))
      .returning();
    return results[0];
  }

  async unsuspendUser(userId: string): Promise<User | undefined> {
    const results = await db
      .update(schema.users)
      .set({ suspended: false })
      .where(eq(schema.users.id, userId))
      .returning();
    return results[0];
  }

  // Payment Links
  async getPaymentLinks(userId: string): Promise<PaymentLink[]> {
    return db.select().from(schema.paymentLinks).where(eq(schema.paymentLinks.userId, userId)).orderBy(desc(schema.paymentLinks.createdAt));
  }

  async getPaymentLinkByToken(token: string): Promise<PaymentLink | undefined> {
    const results = await db.select().from(schema.paymentLinks).where(eq(schema.paymentLinks.token, token)).limit(1);
    return results[0];
  }

  async createPaymentLink(link: InsertPaymentLink & { userId: string }): Promise<PaymentLink> {
    // Generate a short token (8 random hex chars)
    const token = randomUUID().replace(/-/g, '').substring(0, 8);
    const results = await db.insert(schema.paymentLinks).values({ ...link, token }).returning();
    return results[0];
  }

  async updatePaymentLink(id: string, userId: string, link: Partial<InsertPaymentLink>): Promise<PaymentLink | undefined> {
    const existing = await db.select().from(schema.paymentLinks).where(eq(schema.paymentLinks.id, id)).limit(1);
    if (existing.length === 0 || existing[0].userId !== userId) {
      return undefined;
    }
    const results = await db
      .update(schema.paymentLinks)
      .set(link)
      .where(eq(schema.paymentLinks.id, id))
      .returning();
    return results[0];
  }

  async deletePaymentLink(id: string, userId: string): Promise<boolean> {
    const results = await db
      .delete(schema.paymentLinks)
      .where(eq(schema.paymentLinks.id, id))
      .returning();
    return results.length > 0 && results[0].userId === userId;
  }

  // Merchant Links
  async getMerchantLinks(userId: string): Promise<MerchantLink[]> {
    return db.select().from(schema.merchantLinks).where(eq(schema.merchantLinks.userId, userId)).orderBy(desc(schema.merchantLinks.createdAt));
  }

  async getMerchantLinkByToken(token: string): Promise<MerchantLink | undefined> {
    const results = await db.select().from(schema.merchantLinks).where(eq(schema.merchantLinks.token, token)).limit(1);
    return results[0];
  }

  async getMerchantLinkByName(merchantName: string): Promise<MerchantLink | undefined> {
    const results = await db.select().from(schema.merchantLinks).where(eq(schema.merchantLinks.merchantName, merchantName)).limit(1);
    return results[0];
  }

  async createMerchantLink(link: InsertMerchantLink & { userId: string }): Promise<MerchantLink> {
    const token = randomUUID().replace(/-/g, '').substring(0, 8);
    const results = await db.insert(schema.merchantLinks).values({ ...link, token }).returning();
    return results[0];
  }

  async deleteMerchantLink(id: string, userId: string): Promise<boolean> {
    const results = await db
      .delete(schema.merchantLinks)
      .where(eq(schema.merchantLinks.id, id))
      .returning();
    return results.length > 0 && results[0].userId === userId;
  }

  // API Keys
  async getApiKeys(userId: string): Promise<ApiKey[]> {
    return db.select().from(schema.apiKeys).where(eq(schema.apiKeys.userId, userId)).orderBy(desc(schema.apiKeys.createdAt));
  }

  async getApiKeyByPublicKey(publicKey: string): Promise<ApiKey | undefined> {
    const results = await db.select().from(schema.apiKeys).where(eq(schema.apiKeys.publicKey, publicKey)).limit(1);
    return results[0];
  }

  async getApiKeyByPrivateKey(privateKey: string): Promise<ApiKey | undefined> {
    const results = await db.select().from(schema.apiKeys).where(eq(schema.apiKeys.privateKey, privateKey)).limit(1);
    return results[0];
  }

  async createApiKey(key: InsertApiKey & { userId: string }): Promise<ApiKey> {
    const publicKey = `pk_live_${randomUUID()}`;
    const privateKey = `sk_live_${randomUUID()}`;
    const results = await db.insert(schema.apiKeys).values({ ...key, publicKey, privateKey }).returning();
    return results[0];
  }

  async deleteApiKey(id: string, userId: string): Promise<boolean> {
    const results = await db
      .delete(schema.apiKeys)
      .where(eq(schema.apiKeys.id, id))
      .returning();
    return results.length > 0 && results[0].userId === userId;
  }

  // Transactions
  async getTransaction(id: string): Promise<Transaction | undefined> {
    const results = await db.select().from(schema.transactions).where(eq(schema.transactions.id, id)).limit(1);
    return results[0];
  }

  async getTransactions(userId: string, limit: number = 50): Promise<Transaction[]> {
    return db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.userId, userId))
      .orderBy(desc(schema.transactions.createdAt))
      .limit(limit);
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const results = await db.insert(schema.transactions).values(transaction).returning();
    return results[0];
  }

  async updateTransactionStatus(id: string, status: string, paydunyaData?: any): Promise<Transaction | undefined> {
    const updateData: any = { status };
    if (paydunyaData?.paydunyaToken) {
      updateData.paydunyaToken = paydunyaData.paydunyaToken;
    }
    if (paydunyaData?.paydunyaReceiptUrl) {
      updateData.paydunyaReceiptUrl = paydunyaData.paydunyaReceiptUrl;
    }
    const results = await db
      .update(schema.transactions)
      .set(updateData)
      .where(eq(schema.transactions.id, id))
      .returning();
    return results[0];
  }

  async getUserStats(userId: string): Promise<{
    totalBalance: number;
    totalDeposits: number;
    totalTransfers: number;
    recentTransactions: Transaction[];
  }> {
    const user = await this.getUser(userId);
    const transactions = await this.getTransactions(userId, 100);

    const completed = transactions.filter((t) => t.status === "completed");
    const deposits = completed.filter((t) => ["deposit", "payment_link", "merchant_link", "api_payment"].includes(t.type));
    const transfers = completed.filter((t) => t.type === "transfer");

    const totalDeposits = deposits.reduce((sum, t) => sum + t.amount, 0);
    const totalTransfers = transfers.reduce((sum, t) => sum + t.amount, 0);

    return {
      totalBalance: user?.balance || 0,
      totalDeposits,
      totalTransfers,
      recentTransactions: transactions.slice(0, 10),
    };
  }

  // Admin methods
  async getAdminStats(): Promise<{
    totalUsers: number;
    verifiedUsers: number;
    totalDeposits: number;
    totalTransfers: number;
  }> {
    const allUsers = await db.select().from(schema.users);
    const verifiedUsers = allUsers.filter((u) => u.kycStatus === "verified").length;

    const allTransactions = await db.select().from(schema.transactions);
    const completedDeposits = allTransactions.filter(
      (t) =>
        t.status === "completed" &&
        ["deposit", "payment_link", "merchant_link", "api_payment"].includes(t.type)
    );
    const completedTransfers = allTransactions.filter((t) => t.status === "completed" && t.type === "transfer");

    const totalDeposits = completedDeposits.reduce((sum, t) => sum + t.amount, 0);
    const totalTransfers = completedTransfers.reduce((sum, t) => sum + t.amount, 0);

    return {
      totalUsers: allUsers.length,
      verifiedUsers,
      totalDeposits,
      totalTransfers,
    };
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(schema.users).orderBy(desc(schema.users.createdAt));
  }

  async searchUsers(query: string): Promise<User[]> {
    const allUsers = await this.getAllUsers();
    const lowerQuery = query.toLowerCase();
    return allUsers.filter(
      (u) =>
        u.email.toLowerCase().includes(lowerQuery) ||
        u.firstName.toLowerCase().includes(lowerQuery) ||
        u.lastName.toLowerCase().includes(lowerQuery)
    );
  }

  async promoteToAdmin(userId: string): Promise<User | undefined> {
    const results = await db
      .update(schema.users)
      .set({ isAdmin: true })
      .where(eq(schema.users.id, userId))
      .returning();
    return results[0];
  }

  async removeAdminPrivilege(userId: string): Promise<User | undefined> {
    const results = await db
      .update(schema.users)
      .set({ isAdmin: false })
      .where(eq(schema.users.id, userId))
      .returning();
    return results[0];
  }

  async deleteUser(userId: string): Promise<boolean> {
    const result = await db.delete(schema.users).where(eq(schema.users.id, userId));
    return true;
  }

  async addFundsToUser(userId: string, amount: number): Promise<User | undefined> {
    return this.updateUserBalance(userId, amount);
  }

  async subtractFundsFromUser(userId: string, amount: number): Promise<User | undefined> {
    return this.updateUserBalance(userId, -amount);
  }

  async getAnalytics(userId: string): Promise<{
    revenueByDate: { date: string; amount: number }[];
    revenueByOperator: { operator: string; amount: number; count: number }[];
    revenueByCountry: { country: string; amount: number; count: number }[];
    revenueByType: { type: string; amount: number; count: number }[];
    totalRevenue: number;
    completedTransactions: number;
    pendingTransactions: number;
  }> {
    const transactions = await this.getTransactions(userId, 500);
    const completed = transactions.filter((t) => t.status === "completed");

    // Revenue by date
    const revenueByDateMap = new Map<string, number>();
    completed.forEach((t) => {
      const date = new Date(t.createdAt).toLocaleDateString("fr-FR");
      revenueByDateMap.set(date, (revenueByDateMap.get(date) || 0) + t.amount);
    });
    const revenueByDate = Array.from(revenueByDateMap.entries())
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Revenue by operator
    const revenueByOperatorMap = new Map<string, { amount: number; count: number }>();
    completed.forEach((t) => {
      const op = t.operator || "Unknown";
      const current = revenueByOperatorMap.get(op) || { amount: 0, count: 0 };
      revenueByOperatorMap.set(op, {
        amount: current.amount + t.amount,
        count: current.count + 1,
      });
    });
    const revenueByOperator = Array.from(revenueByOperatorMap.entries())
      .map(([operator, { amount, count }]) => ({ operator, amount, count }))
      .sort((a, b) => b.amount - a.amount);

    // Revenue by country
    const revenueByCountryMap = new Map<string, { amount: number; count: number }>();
    completed.forEach((t) => {
      const country = t.country || "Unknown";
      const current = revenueByCountryMap.get(country) || { amount: 0, count: 0 };
      revenueByCountryMap.set(country, {
        amount: current.amount + t.amount,
        count: current.count + 1,
      });
    });
    const revenueByCountry = Array.from(revenueByCountryMap.entries())
      .map(([country, { amount, count }]) => ({ country, amount, count }))
      .sort((a, b) => b.amount - a.amount);

    // Revenue by type
    const revenueByTypeMap = new Map<string, { amount: number; count: number }>();
    completed.forEach((t) => {
      const current = revenueByTypeMap.get(t.type) || { amount: 0, count: 0 };
      revenueByTypeMap.set(t.type, {
        amount: current.amount + t.amount,
        count: current.count + 1,
      });
    });
    const revenueByType = Array.from(revenueByTypeMap.entries())
      .map(([type, { amount, count }]) => ({ type, amount, count }))
      .sort((a, b) => b.amount - a.amount);

    const totalRevenue = completed.reduce((sum, t) => sum + t.amount, 0);
    const pendingTransactions = transactions.filter((t) => t.status === "pending").length;

    return {
      revenueByDate,
      revenueByOperator,
      revenueByCountry,
      revenueByType,
      totalRevenue,
      completedTransactions: completed.length,
      pendingTransactions,
    };
  }

  // ===== Country/Operator Config =====
  async getCountryOperatorConfigs(): Promise<CountryOperatorConfig[]> {
    return db.select().from(schema.countryOperatorConfig);
  }

  async getCountryOperatorConfig(country: string, operator: string): Promise<CountryOperatorConfig | undefined> {
    const results = await db
      .select()
      .from(schema.countryOperatorConfig)
      .where(
        (c) =>
          c.country === country && c.operator === operator
      )
      .limit(1);
    return results[0];
  }

  async updateCountryOperatorConfig(
    country: string,
    operator: string,
    config: UpdateCountryOperatorConfig
  ): Promise<CountryOperatorConfig | undefined> {
    const result = await db
      .update(schema.countryOperatorConfig)
      .set({
        ...config,
        updatedAt: new Date(),
      })
      .where((c) => c.country === country && c.operator === operator)
      .returning()
      .get();
    return result;
  }

  async initializeCountryOperatorConfigs(): Promise<void> {
    const existing = await this.getCountryOperatorConfigs();
    if (existing.length > 0) return;

    // Initialize all country/operator combinations as enabled
    const countries = ["BJ", "TG", "CI", "SN", "BF", "ML"];
    const operators: Record<string, string[]> = {
      BJ: ["mtn", "moov"],
      TG: ["tmoney", "moov"],
      CI: ["orange", "mtn", "moov", "wave"],
      SN: ["orange", "free", "expresso", "wave", "wizall"],
      BF: ["orange", "moov"],
      ML: ["orange", "moov"],
    };

    for (const country of countries) {
      for (const operator of operators[country] || []) {
        await db
          .insert(schema.countryOperatorConfig)
          .values({
            country,
            operator,
            incomingEnabled: true,
            outgoingEnabled: true,
          })
          .catch(() => {}); // Ignore duplicates
      }
    }
  }
}

export const storage = new DbStorage();
