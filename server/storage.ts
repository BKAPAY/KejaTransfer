import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, desc, or, and, sql, gte, inArray } from "drizzle-orm";
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
  FeeConfig,
  InsertFeeConfig,
  SupportSettings,
  PaymentSession,
  InsertPaymentSession,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { MBIYOPAY_COUNTRIES } from "@shared/mbiyopay-countries";
import { FEDAPAY_COUNTRIES } from "@shared/fedapay-countries";
import { AFRIBAPAY_COUNTRIES } from "@shared/afribapay-countries";
import { PAYDUNYA_COUNTRIES } from "@shared/paydunya-countries";
import { PAWAPAY_COUNTRIES } from "@shared/pawapay-countries";

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
  submitKyc(userId: string, kycData: { kycIdFront: string; kycIdBack: string; kycSelfie: string; kycSignature: string; kycActivityDescription: string; kycLatitude: string; kycLongitude: string; kycAddress: string; kycAcceptedTerms: string }): Promise<User | undefined>;
  updateKycDocument(userId: string, data: Partial<{ kycIdFront: string; kycIdBack: string; kycSelfie: string; kycSignature: string; kycActivityDescription: string; kycLatitude: string; kycLongitude: string; kycAddress: string; kycAcceptedTerms: string }>): Promise<void>;
  approveKyc(userId: string): Promise<User | undefined>;
  rejectKyc(userId: string, reason?: string): Promise<User | undefined>;
  getPendingKycSubmissions(): Promise<User[]>;
  getKycHistory(): Promise<Partial<User>[]>;
  suspendUser(userId: string): Promise<User | undefined>;
  unsuspendUser(userId: string): Promise<User | undefined>;
  updateUserCountry(id: string, country: string): Promise<User | undefined>;
  updateUserWithdrawalPhones(id: string, withdrawalPhones: string[]): Promise<User | undefined>;
  updateUserSecurityCode(id: string, securityCode: string): Promise<User | undefined>;
  updateBusinessProfile(id: string, data: { businessRegistrationNumber?: string; businessCountry?: string; businessPhone?: string; businessEnterprisePhone?: string; businessEmail?: string }): Promise<User | undefined>;
  saveBusinessKycStep2(userId: string, data: {
    kycBusinessAccountNumber?: string; kycTaxId?: string; kycBusinessAddress?: string;
    kycBusinessCity?: string; kycBusinessDepartment?: string; kycDirectorIdNumber?: string;
    kycDirectorCountry?: string; kycDirectorDob?: string; kycIdIssueDate?: string; kycIdExpiryDate?: string;
  }): Promise<User | undefined>;
  uploadBusinessKycDocument(userId: string, type: string, data: string): Promise<void>;
  submitBusinessKyc(userId: string, description: string): Promise<User | undefined>;

  // Payment Links
  getPaymentLinks(userId: string): Promise<PaymentLink[]>;
  getPaymentLinkById(id: string): Promise<PaymentLink | undefined>;
  getPaymentLinkByToken(token: string): Promise<PaymentLink | undefined>;
  createPaymentLink(link: InsertPaymentLink & { userId: string }): Promise<PaymentLink>;
  updatePaymentLink(id: string, userId: string, link: Partial<InsertPaymentLink>): Promise<PaymentLink | undefined>;
  deletePaymentLink(id: string, userId: string): Promise<boolean>;

  // Merchant Links
  getMerchantLinks(userId: string): Promise<MerchantLink[]>;
  getMerchantLinkById(id: string): Promise<MerchantLink | undefined>;
  getMerchantLinkByToken(token: string): Promise<MerchantLink | undefined>;
  getMerchantLinkByName(merchantName: string): Promise<MerchantLink | undefined>;
  createMerchantLink(link: InsertMerchantLink & { userId: string }): Promise<MerchantLink>;
  deleteMerchantLink(id: string, userId: string): Promise<boolean>;

  // API Keys
  getApiKeys(userId: string): Promise<ApiKey[]>;
  getApiKeyById(id: string): Promise<ApiKey | undefined>;
  getApiKeyByPublicKey(publicKey: string): Promise<ApiKey | undefined>;
  getApiKeyByPrivateKey(privateKey: string): Promise<ApiKey | undefined>;
  getApiKeyByPayinPrivateKey(payinPrivateKey: string): Promise<ApiKey | undefined>;
  createApiKey(key: InsertApiKey & { userId: string }): Promise<ApiKey>;
  regenerateApiKeyPayinKey(id: string, userId: string): Promise<ApiKey | undefined>;
  deleteApiKey(id: string, userId: string): Promise<boolean>;
  updateApiKeyCallback(id: string, userId: string, callbackUrl: string | null): Promise<ApiKey | undefined>;
  regenerateApiKeyCallbackSecret(id: string, userId: string): Promise<ApiKey | undefined>;
  updateApiKeyPayoutCallback(id: string, userId: string, payoutCallbackUrl: string | null): Promise<ApiKey | undefined>;
  regenerateApiKeyPayoutSecret(id: string, userId: string): Promise<ApiKey | undefined>;
  updateApiKeySettings(id: string, userId: string, settings: { allowedCountries?: string[]; customerPaysFee?: boolean; customerPaysCryptoFee?: boolean }): Promise<ApiKey | undefined>;

  // Payment Sessions
  createPaymentSession(session: InsertPaymentSession): Promise<PaymentSession>;
  getPaymentSession(id: string): Promise<PaymentSession | undefined>;
  updatePaymentSession(id: string, updates: Partial<Pick<PaymentSession, 'status' | 'transactionId'>>): Promise<PaymentSession | undefined>;
  expireOldPaymentSessions(): Promise<void>;

  // Transactions
  getTransaction(id: string): Promise<Transaction | undefined>;
  getTransactions(userId: string, limit?: number): Promise<Transaction[]>;
  getTransactionByPaydunyaToken(paydunyaToken: string): Promise<Transaction | undefined>;
  getTransactionByFedapayId(fedapayId: number): Promise<Transaction | undefined>;
  getTransactionByAfribaPayId(afribaPayId: string): Promise<Transaction | undefined>;
  getTransactionByOrderId(orderId: string, userId: string): Promise<Transaction | undefined>;
  getRecentApiPaymentByPhoneAmount(userId: string, phone: string, amount: number, secondsAgo: number): Promise<Transaction | undefined>;
  getRecentTransactionsByDescription(userId: string, description: string, since: Date): Promise<Transaction[]>;
  getAllPendingTransactions(): Promise<(Transaction & { user?: User })[]>;
  getAllTransactionsForAdmin(limit?: number): Promise<(Transaction & { user?: User })[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransactionStatus(id: string, status: string, paydunyaData?: any): Promise<Transaction | undefined>;
  updateTransaction(id: string, updates: Partial<Pick<Transaction, 'paydunyaToken' | 'country' | 'operator' | 'status' | 'metadata' | 'paydunyaReceiptUrl'>>): Promise<Transaction | undefined>;
  updateTransactionMetadata(id: string, metadata: string): Promise<Transaction | undefined>;
  atomicMarkRefundedAndCredit(transactionId: string, userId: string, refundAmount: number, source: string): Promise<boolean>;
  finalizeIncomingTransaction(id: string, extras?: { paydunyaReceiptUrl?: string }): Promise<{ transaction: Transaction; credited: boolean } | null>;
  atomicFailAndRefundPayout(transactionId: string, userId: string, refundAmount: number): Promise<boolean>;
  atomicCompleteTransaction(transactionId: string): Promise<boolean>;
  atomicFailTransaction(transactionId: string): Promise<boolean>;
  getUserStats(userId: string): Promise<{
    totalBalance: number;
    totalDeposits: number;
    totalTransfers: number;
    totalWithdrawals: number;
    recentTransactions: Transaction[];
  }>;

  // Country/Operator Config (Multi-Provider)
  getCountryOperatorConfigs(scope?: string): Promise<CountryOperatorConfig[]>;
  getCountryOperatorConfigsByProvider(provider: string, scope?: string): Promise<CountryOperatorConfig[]>;
  getCountryOperatorConfig(provider: string, country: string, operator: string, scope?: string): Promise<CountryOperatorConfig | undefined>;
  updateCountryOperatorConfig(provider: string, country: string, operator: string, config: UpdateCountryOperatorConfig, scope?: string): Promise<CountryOperatorConfig | undefined>;
  disableOperatorForOtherProviders(provider: string, country: string, operator: string, type: "incoming" | "outgoing", scope?: string): Promise<void>;
  disableCountryForOtherProviders(provider: string, country: string, type: "incoming" | "outgoing", scope?: string): Promise<void>;
  initializeCountryOperatorConfigs(): Promise<void>;
  
  // Country Status (Multi-Provider)
  getCountryStatuses(scope?: string): Promise<schema.CountryStatus[]>;
  getCountryStatusesByProvider(provider: string, scope?: string): Promise<schema.CountryStatus[]>;
  getCountryStatus(provider: string, country: string, scope?: string): Promise<schema.CountryStatus | undefined>;
  updateCountryStatus(provider: string, country: string, updates: { payinEnabled?: boolean; payoutEnabled?: boolean }, scope?: string): Promise<schema.CountryStatus | undefined>;
  initializeCountryStatuses(): Promise<void>;
  
  // Business Wallets
  getBusinessWallet(userId: string, country: string, currency: string): Promise<BusinessWallet | undefined>;
  getBusinessWallets(userId: string): Promise<BusinessWallet[]>;
  creditBusinessWallet(userId: string, country: string, currency: string, amount: number): Promise<BusinessWallet>;
  debitBusinessWallet(userId: string, country: string, currency: string, amount: number): Promise<BusinessWallet>;
  getAllBusinessWalletsForAdmin(): Promise<(BusinessWallet & { user: User })[]>;
  adminAdjustBusinessWallet(userId: string, country: string, currency: string, amount: number): Promise<BusinessWallet>;

  // Provider Configs
  getProviderConfigs(scope?: string): Promise<schema.ProviderConfig[]>;
  getProviderConfig(provider: string, scope?: string): Promise<schema.ProviderConfig | undefined>;
  updateProviderConfig(provider: string, updates: Partial<Omit<schema.ProviderConfig, 'id' | 'provider' | 'createdAt'>>, scope?: string): Promise<schema.ProviderConfig | undefined>;
  initializeProviderConfigs(): Promise<void>;
  
  // Diagnostic
  getDiagnosticData(): Promise<{
    users: User[];
    pendingKyc: User[];
    allTransactions: Transaction[];
    stats: { totalUsers: number; verifiedUsers: number; totalDeposits: number; totalWithdrawals: number };
  }>;

  // Verification Codes
  createVerificationCode(email: string, code: string, type: "signup" | "password_reset" | "login"): Promise<void>;
  verifyCode(email: string, code: string, type: "signup" | "password_reset" | "login"): Promise<boolean>;
  markCodeAsUsed(email: string, code: string, type: "signup" | "password_reset" | "login"): Promise<void>;
  cleanupExpiredCodes(): Promise<void>;

  // Crypto Currencies
  getAllCryptoCurrencies(): Promise<schema.CryptoCurrency[]>;
  getPayinEnabledCryptoCurrencies(): Promise<schema.CryptoCurrency[]>;
  getPayoutEnabledCryptoCurrencies(): Promise<schema.CryptoCurrency[]>;
  getCryptoCurrencyByCode(code: string): Promise<schema.CryptoCurrency | undefined>;
  createCryptoCurrency(data: schema.InsertCryptoCurrency): Promise<schema.CryptoCurrency>;
  updateCryptoCurrency(code: string, updates: Partial<schema.InsertCryptoCurrency>): Promise<schema.CryptoCurrency | undefined>;

  // Transactions by metadata
  getTransactionsByMetadataPaymentId(paymentId: string): Promise<Transaction[]>;
  getTransactionsByMetadataPayoutId(payoutId: string): Promise<Transaction[]>;

  // Fee Configuration
  getAllFeeConfigs(): Promise<FeeConfig[]>;
  getFeeConfigsByProvider(provider: string, scope?: string): Promise<FeeConfig[]>;
  getFeeConfig(provider: string, country: string, operator: string, scope?: string): Promise<FeeConfig | undefined>;
  getFeeConfigsByCountry(country: string, scope?: string): Promise<FeeConfig[]>;
  createOrUpdateFeeConfig(config: InsertFeeConfig): Promise<FeeConfig>;
  updateFeeConfig(provider: string, country: string, operator: string, updates: { incomingFeePercentage?: number; outgoingFeePercentage?: number }, scope?: string): Promise<FeeConfig | undefined>;
  initializeFeeConfigs(): Promise<void>;
  ensurePaydunyaFeeConfigs(): Promise<void>;
  ensurePawaPayFeeConfigs(): Promise<void>;

  // Support Settings
  getSupportSettings(): Promise<SupportSettings | undefined>;
  updateSupportSettings(updates: { supportEmail?: string; supportPhone?: string; whatsappLink?: string }): Promise<SupportSettings>;

  // Login Logs
  createLoginLog(data: { userId: string; ipAddress?: string; city?: string; region?: string; country?: string; isp?: string; deviceType?: string; deviceModel?: string; browser?: string; os?: string; userAgent?: string; connectionType?: string }): Promise<schema.LoginLog>;
  updateLoginLog(id: string, data: { photoBase64?: string; photoBackBase64?: string; gpsLatitude?: string; gpsLongitude?: string; gpsAccuracy?: string; gpsAddress?: string; connectionType?: string; city?: string; region?: string; country?: string; isp?: string }): Promise<schema.LoginLog | undefined>;
  getLoginLogsByUserId(userId: string, limit?: number): Promise<schema.LoginLog[]>;
  purgeOldLoginLogs(userId: string, keepCount: number): Promise<number>;

  // Business Users
  getBusinessUsers(): Promise<User[]>;
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

  async submitKyc(userId: string, kycData: { kycIdFront: string; kycIdBack: string; kycSelfie: string; kycSignature: string; kycActivityDescription: string; kycLatitude: string; kycLongitude: string; kycAddress: string; kycAcceptedTerms: string }): Promise<User | undefined> {
    const results = await db
      .update(schema.users)
      .set({
        kycStatus: "submitted",
        kycIdFront: kycData.kycIdFront,
        kycIdBack: kycData.kycIdBack,
        kycSelfie: kycData.kycSelfie,
        kycSignature: kycData.kycSignature,
        kycActivityDescription: kycData.kycActivityDescription,
        kycLatitude: kycData.kycLatitude,
        kycLongitude: kycData.kycLongitude,
        kycAddress: kycData.kycAddress,
        kycAcceptedTerms: kycData.kycAcceptedTerms,
      })
      .where(eq(schema.users.id, userId))
      .returning();
    return results[0];
  }

  async updateKycDocument(userId: string, data: Partial<{ kycIdFront: string; kycIdBack: string; kycSelfie: string; kycSignature: string; kycActivityDescription: string; kycLatitude: string; kycLongitude: string; kycAddress: string; kycAcceptedTerms: string }>): Promise<void> {
    await db
      .update(schema.users)
      .set(data)
      .where(eq(schema.users.id, userId));
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
    const user = await this.getUser(userId);
    if (!user) return undefined;

    const newRejectionCount = (user.kycRejectionCount || 0) + 1;
    const shouldSuspend = newRejectionCount >= 3;

    const results = await db
      .update(schema.users)
      .set({ 
        kycStatus: "rejected",
        kycRejectionReason: reason || null,
        kycRejectionCount: newRejectionCount,
        ...(shouldSuspend ? { suspended: true } : {}),
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

  async getKycHistory(): Promise<Partial<User>[]> {
    // Return all users with KYC submissions WITHOUT loading heavy base64 images
    return db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        kycStatus: schema.users.kycStatus,
        kycRejectionReason: schema.users.kycRejectionReason,
        createdAt: schema.users.createdAt,
        balance: schema.users.balance,
        isAdmin: schema.users.isAdmin,
        suspended: schema.users.suspended,
      })
      .from(schema.users)
      .where(
        or(
          eq(schema.users.kycStatus, "submitted"),
          eq(schema.users.kycStatus, "verified"),
          eq(schema.users.kycStatus, "rejected")
        )
      )
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

  async updateUserCountry(id: string, country: string): Promise<User | undefined> {
    const results = await db
      .update(schema.users)
      .set({ country })
      .where(eq(schema.users.id, id))
      .returning();
    return results[0];
  }

  async updateUserWithdrawalPhones(id: string, withdrawalPhones: string[]): Promise<User | undefined> {
    const results = await db
      .update(schema.users)
      .set({ withdrawalPhones })
      .where(eq(schema.users.id, id))
      .returning();
    return results[0];
  }

  async updateUserSecurityCode(id: string, securityCode: string): Promise<User | undefined> {
    const results = await db
      .update(schema.users)
      .set({ securityCode })
      .where(eq(schema.users.id, id))
      .returning();
    return results[0];
  }

  async updateBusinessProfile(id: string, data: { businessRegistrationNumber?: string; businessCountry?: string; businessPhone?: string; businessEnterprisePhone?: string; businessEmail?: string }): Promise<User | undefined> {
    const results = await db
      .update(schema.users)
      .set(data)
      .where(eq(schema.users.id, id))
      .returning();
    return results[0];
  }

  async saveBusinessKycStep2(userId: string, data: {
    kycBusinessAccountNumber?: string; kycTaxId?: string; kycBusinessAddress?: string;
    kycBusinessCity?: string; kycBusinessDepartment?: string; kycDirectorIdNumber?: string;
    kycDirectorCountry?: string; kycDirectorDob?: string; kycIdIssueDate?: string; kycIdExpiryDate?: string;
  }): Promise<User | undefined> {
    const results = await db
      .update(schema.users)
      .set(data)
      .where(eq(schema.users.id, userId))
      .returning();
    return results[0];
  }

  async uploadBusinessKycDocument(userId: string, type: string, data: string): Promise<void> {
    if (type === "__replace_business__") {
      await db.update(schema.users).set({ kycBusinessDocuments: data }).where(eq(schema.users.id, userId));
      return;
    }
    const fieldMap: Record<string, string> = {
      businessDocuments: "kycBusinessDocuments",
      taxDocument: "kycTaxDocument",
      addressDocument: "kycAddressDocument",
      idFront: "kycIdFront",
      idBack: "kycIdBack",
    };
    const field = fieldMap[type];
    if (!field) throw new Error("Type de document invalide");

    if (type === "businessDocuments") {
      // Append to JSON array
      const user = await this.getUser(userId);
      const existing: string[] = user?.kycBusinessDocuments ? JSON.parse(user.kycBusinessDocuments) : [];
      existing.push(data);
      await db.update(schema.users).set({ kycBusinessDocuments: JSON.stringify(existing) }).where(eq(schema.users.id, userId));
    } else if (type === "__replace_business__") {
      // Replace the entire business documents array (used for deletions)
      await db.update(schema.users).set({ kycBusinessDocuments: data }).where(eq(schema.users.id, userId));
    } else {
      await db.update(schema.users).set({ [field]: data || null } as any).where(eq(schema.users.id, userId));
    }
  }

  async submitBusinessKyc(userId: string, description: string): Promise<User | undefined> {
    const results = await db
      .update(schema.users)
      .set({ kycStatus: "submitted", kycActivityDescription: description })
      .where(eq(schema.users.id, userId))
      .returning();
    return results[0];
  }

  // Payment Links
  async getPaymentLinks(userId: string): Promise<PaymentLink[]> {
    return db.select().from(schema.paymentLinks).where(eq(schema.paymentLinks.userId, userId)).orderBy(desc(schema.paymentLinks.createdAt));
  }

  async getPaymentLinksLight(userId: string): Promise<Omit<PaymentLink, 'imageUrl' | 'imageUrls' | 'videoUrl'>[]> {
    return db.select({
      id: schema.paymentLinks.id,
      userId: schema.paymentLinks.userId,
      productName: schema.paymentLinks.productName,
      description: schema.paymentLinks.description,
      amount: schema.paymentLinks.amount,
      token: schema.paymentLinks.token,
      isActive: schema.paymentLinks.isActive,
      createdAt: schema.paymentLinks.createdAt,
      allowedCountries: schema.paymentLinks.allowedCountries,
      customerPaysFee: schema.paymentLinks.customerPaysFee,
      customerPaysCryptoFee: schema.paymentLinks.customerPaysCryptoFee,
      hasImages: sql<boolean>`(COALESCE(array_length(${schema.paymentLinks.imageUrls}, 1), 0) > 0 OR ${schema.paymentLinks.imageUrl} IS NOT NULL)`.as('hasImages'),
      hasVideo: sql<boolean>`(${schema.paymentLinks.videoUrl} IS NOT NULL AND ${schema.paymentLinks.videoUrl} != '')`.as('hasVideo'),
    }).from(schema.paymentLinks).where(eq(schema.paymentLinks.userId, userId)).orderBy(desc(schema.paymentLinks.createdAt));
  }

  async getPaymentLinkById(id: string): Promise<PaymentLink | undefined> {
    const results = await db.select().from(schema.paymentLinks).where(eq(schema.paymentLinks.id, id)).limit(1);
    return results[0];
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

  async getMerchantLinkById(id: string): Promise<MerchantLink | undefined> {
    const results = await db.select().from(schema.merchantLinks).where(eq(schema.merchantLinks.id, id)).limit(1);
    return results[0];
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

  async getApiKeyById(id: string): Promise<ApiKey | undefined> {
    const results = await db.select().from(schema.apiKeys).where(eq(schema.apiKeys.id, id)).limit(1);
    return results[0];
  }

  async getApiKeyByPublicKey(publicKey: string): Promise<ApiKey | undefined> {
    const results = await db.select().from(schema.apiKeys).where(eq(schema.apiKeys.publicKey, publicKey)).limit(1);
    return results[0];
  }

  async getApiKeyByPrivateKey(privateKey: string): Promise<ApiKey | undefined> {
    const results = await db.select().from(schema.apiKeys).where(eq(schema.apiKeys.privateKey, privateKey)).limit(1);
    return results[0];
  }

  async getApiKeyByPayinPrivateKey(payinPrivateKey: string): Promise<ApiKey | undefined> {
    const results = await db.select().from(schema.apiKeys).where(eq(schema.apiKeys.payinPrivateKey, payinPrivateKey)).limit(1);
    return results[0];
  }

  async createApiKey(key: InsertApiKey & { userId: string }): Promise<ApiKey> {
    const publicKey = `pk_live_${randomUUID()}`;
    const privateKey = `sk_live_${randomUUID()}`;
    const payinPrivateKey = `sk_payin_live_${randomUUID()}`;
    const results = await db.insert(schema.apiKeys).values({ ...key, publicKey, privateKey, payinPrivateKey }).returning();
    return results[0];
  }

  async regenerateApiKeyPayinKey(id: string, userId: string): Promise<ApiKey | undefined> {
    const existing = await db.select().from(schema.apiKeys).where(eq(schema.apiKeys.id, id)).limit(1);
    if (!existing[0] || existing[0].userId !== userId) return undefined;
    const newPayinKey = `sk_payin_live_${randomUUID()}`;
    const results = await db.update(schema.apiKeys).set({ payinPrivateKey: newPayinKey }).where(eq(schema.apiKeys.id, id)).returning();
    return results[0];
  }

  async deleteApiKey(id: string, userId: string): Promise<boolean> {
    const results = await db
      .delete(schema.apiKeys)
      .where(eq(schema.apiKeys.id, id))
      .returning();
    return results.length > 0 && results[0].userId === userId;
  }

  async updateApiKeyCallback(id: string, userId: string, callbackUrl: string | null): Promise<ApiKey | undefined> {
    // Generate new secret if setting a callback URL for the first time
    const existing = await db.select().from(schema.apiKeys)
      .where(eq(schema.apiKeys.id, id))
      .limit(1);
    
    if (!existing[0] || existing[0].userId !== userId) {
      return undefined;
    }

    const updateData: any = { callbackUrl };
    
    // Generate secret if setting callback URL and no secret exists
    if (callbackUrl && !existing[0].callbackSecret) {
      updateData.callbackSecret = `cs_${randomUUID().replace(/-/g, '')}`;
    }
    
    // Clear secret if removing callback URL
    if (!callbackUrl) {
      updateData.callbackSecret = null;
    }

    const results = await db
      .update(schema.apiKeys)
      .set(updateData)
      .where(eq(schema.apiKeys.id, id))
      .returning();
    return results[0];
  }

  async regenerateApiKeyCallbackSecret(id: string, userId: string): Promise<ApiKey | undefined> {
    const existing = await db.select().from(schema.apiKeys)
      .where(eq(schema.apiKeys.id, id))
      .limit(1);
    
    if (!existing[0] || existing[0].userId !== userId) {
      return undefined;
    }

    const newSecret = `cs_${randomUUID().replace(/-/g, '')}`;
    
    const results = await db
      .update(schema.apiKeys)
      .set({ callbackSecret: newSecret })
      .where(eq(schema.apiKeys.id, id))
      .returning();
    return results[0];
  }

  async updateApiKeyPayoutCallback(id: string, userId: string, payoutCallbackUrl: string | null): Promise<ApiKey | undefined> {
    const existing = await db.select().from(schema.apiKeys)
      .where(eq(schema.apiKeys.id, id))
      .limit(1);

    if (!existing[0] || existing[0].userId !== userId) return undefined;

    const updateData: any = { payoutCallbackUrl };

    if (payoutCallbackUrl && !(existing[0] as any).payoutCallbackSecret) {
      updateData.payoutCallbackSecret = `cs_${randomUUID().replace(/-/g, '')}`;
    }
    if (!payoutCallbackUrl) {
      updateData.payoutCallbackSecret = null;
    }

    const results = await db
      .update(schema.apiKeys)
      .set(updateData)
      .where(eq(schema.apiKeys.id, id))
      .returning();
    return results[0];
  }

  async regenerateApiKeyPayoutSecret(id: string, userId: string): Promise<ApiKey | undefined> {
    const existing = await db.select().from(schema.apiKeys)
      .where(eq(schema.apiKeys.id, id))
      .limit(1);

    if (!existing[0] || existing[0].userId !== userId) return undefined;

    const newSecret = `cs_${randomUUID().replace(/-/g, '')}`;

    const results = await db
      .update(schema.apiKeys)
      .set({ payoutCallbackSecret: newSecret } as any)
      .where(eq(schema.apiKeys.id, id))
      .returning();
    return results[0];
  }

  async updateApiKeySettings(id: string, userId: string, settings: { allowedCountries?: string[]; customerPaysFee?: boolean; customerPaysCryptoFee?: boolean }): Promise<ApiKey | undefined> {
    const existing = await db.select().from(schema.apiKeys)
      .where(eq(schema.apiKeys.id, id))
      .limit(1);
    
    if (!existing[0] || existing[0].userId !== userId) {
      return undefined;
    }

    const updateData: any = {};
    if (settings.allowedCountries !== undefined) {
      updateData.allowedCountries = settings.allowedCountries;
    }
    if (settings.customerPaysFee !== undefined) {
      updateData.customerPaysFee = settings.customerPaysFee;
    }
    if (settings.customerPaysCryptoFee !== undefined) {
      updateData.customerPaysCryptoFee = settings.customerPaysCryptoFee;
    }

    if (Object.keys(updateData).length === 0) {
      return existing[0];
    }

    const results = await db
      .update(schema.apiKeys)
      .set(updateData)
      .where(eq(schema.apiKeys.id, id))
      .returning();
    return results[0];
  }

  // Payment Sessions
  async createPaymentSession(session: InsertPaymentSession): Promise<PaymentSession> {
    const results = await db.insert(schema.paymentSessions).values(session).returning();
    return results[0];
  }

  async getPaymentSession(id: string): Promise<PaymentSession | undefined> {
    const results = await db.select().from(schema.paymentSessions).where(eq(schema.paymentSessions.id, id)).limit(1);
    return results[0];
  }

  async updatePaymentSession(id: string, updates: Partial<Pick<PaymentSession, 'status' | 'transactionId'>>): Promise<PaymentSession | undefined> {
    const results = await db
      .update(schema.paymentSessions)
      .set(updates)
      .where(eq(schema.paymentSessions.id, id))
      .returning();
    return results[0];
  }

  async expireOldPaymentSessions(): Promise<void> {
    await db
      .update(schema.paymentSessions)
      .set({ status: "expired" })
      .where(
        and(
          eq(schema.paymentSessions.status, "pending"),
          sql`${schema.paymentSessions.expiresAt} < NOW()`
        )
      );
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

  async getTransactionByPaydunyaToken(paydunyaToken: string): Promise<Transaction | undefined> {
    // Direct SQL query on indexed paydunyaToken column - much more efficient
    const results = await db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.paydunyaToken, paydunyaToken))
      .limit(1);
    return results[0];
  }

  async getTransactionByFedapayId(fedapayId: number): Promise<Transaction | undefined> {
    // Search in metadata for FedaPay transaction ID
    const pendingTransactions = await db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.status, "pending"));
    
    for (const tx of pendingTransactions) {
      if (tx.metadata) {
        try {
          const metadata = JSON.parse(tx.metadata as string);
          if (metadata.fedapayTransactionId === fedapayId || metadata.fedapayPayoutId === fedapayId) {
            return tx;
          }
        } catch {}
      }
    }
    return undefined;
  }

  async getTransactionByAfribaPayId(afribaPayId: string): Promise<Transaction | undefined> {
    // Search in metadata for AfribaPay transaction ID
    const recentTransactions = await db
      .select()
      .from(schema.transactions)
      .orderBy(desc(schema.transactions.createdAt))
      .limit(200);
    
    for (const tx of recentTransactions) {
      if (tx.metadata) {
        try {
          const metadata = JSON.parse(tx.metadata as string);
          if (metadata.afribaPayTransactionId === afribaPayId) {
            return tx;
          }
        } catch {}
      }
    }
    return undefined;
  }

  async getTransactionByOrderId(orderId: string, userId: string): Promise<Transaction | undefined> {
    // Search for transaction with matching orderId in metadata for this user
    const userTransactions = await db
      .select()
      .from(schema.transactions)
      .where(and(
        eq(schema.transactions.userId, userId),
        eq(schema.transactions.type, "api_payment")
      ))
      .orderBy(desc(schema.transactions.createdAt))
      .limit(100);
    
    for (const tx of userTransactions) {
      if (tx.metadata) {
        try {
          const metadata = JSON.parse(tx.metadata);
          if (metadata.orderId === orderId) {
            return tx;
          }
        } catch {}
      }
    }
    return undefined;
  }

  async getRecentApiPaymentByPhoneAmount(userId: string, phone: string, amount: number, secondsAgo: number): Promise<Transaction | undefined> {
    // Find recent api_payment transaction with same phone and amount within the time threshold
    const cutoffTime = new Date(Date.now() - secondsAgo * 1000);
    
    const results = await db
      .select()
      .from(schema.transactions)
      .where(and(
        eq(schema.transactions.userId, userId),
        eq(schema.transactions.type, "api_payment"),
        eq(schema.transactions.customerPhone, phone),
        eq(schema.transactions.amount, amount),
        gte(schema.transactions.createdAt, cutoffTime)
      ))
      .orderBy(desc(schema.transactions.createdAt))
      .limit(1);
    
    return results[0];
  }

  async getRecentTransactionsByDescription(userId: string, description: string, since: Date): Promise<Transaction[]> {
    // Find recent transactions with same description for duplicate detection
    const results = await db
      .select()
      .from(schema.transactions)
      .where(and(
        eq(schema.transactions.userId, userId),
        eq(schema.transactions.description, description),
        gte(schema.transactions.createdAt, since)
      ))
      .orderBy(desc(schema.transactions.createdAt));
    
    return results;
  }

  async getAllPendingTransactions(): Promise<(Transaction & { user?: User })[]> {
    const pendingTransactions = await db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.status, "pending"))
      .orderBy(desc(schema.transactions.createdAt));
    
    // Fetch user info for each transaction
    const transactionsWithUsers = await Promise.all(
      pendingTransactions.map(async (tx) => {
        const user = await this.getUser(tx.userId);
        return { ...tx, user };
      })
    );
    
    return transactionsWithUsers;
  }

  async getAllTransactionsForAdmin(limit: number = 500): Promise<(Transaction & { user?: User })[]> {
    const allTransactions = await db
      .select()
      .from(schema.transactions)
      .orderBy(desc(schema.transactions.createdAt))
      .limit(limit);
    
    // Fetch user info for each transaction
    const transactionsWithUsers = await Promise.all(
      allTransactions.map(async (tx) => {
        const user = await this.getUser(tx.userId);
        return { ...tx, user };
      })
    );
    
    return transactionsWithUsers;
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

  async updateTransaction(id: string, updates: Partial<Pick<Transaction, 'paydunyaToken' | 'country' | 'operator' | 'status' | 'metadata' | 'paydunyaReceiptUrl'>>): Promise<Transaction | undefined> {
    const results = await db
      .update(schema.transactions)
      .set(updates)
      .where(eq(schema.transactions.id, id))
      .returning();
    return results[0];
  }

  async updateTransactionMetadata(id: string, metadata: string): Promise<Transaction | undefined> {
    const results = await db
      .update(schema.transactions)
      .set({ metadata })
      .where(eq(schema.transactions.id, id))
      .returning();
    return results[0];
  }

  async atomicMarkRefundedAndCredit(transactionId: string, userId: string, refundAmount: number, source: string): Promise<boolean> {
    const result = await client.begin(async (tx) => {
      const updated = await tx`
        UPDATE transactions 
        SET metadata = jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                COALESCE(metadata::jsonb, '{}'::jsonb),
                '{refunded}', 'true'::jsonb
              ),
              '{refundedAt}', to_jsonb(now()::text)
            ),
            '{refundedBy}', to_jsonb(${source}::text)
          ),
          '{refundedAmount}', to_jsonb(${refundAmount}::numeric)
        )::text
        WHERE id = ${transactionId}
          AND status IN ('failed', 'expired', 'canceled', 'cancelled')
          AND (metadata IS NULL OR NOT (metadata::jsonb ? 'refunded' AND (metadata::jsonb->>'refunded')::boolean = true))
        RETURNING id
      `;
      
      if (updated.length === 0) {
        return false;
      }

      await tx`
        UPDATE users SET balance = balance + ${refundAmount} WHERE id = ${userId}
      `;
      
      return true;
    });
    
    return result;
  }

  async finalizeIncomingTransaction(id: string, extras?: { paydunyaReceiptUrl?: string }): Promise<{ transaction: Transaction; credited: boolean } | null> {
    const updateData: any = { status: "completed" };
    if (extras?.paydunyaReceiptUrl) {
      updateData.paydunyaReceiptUrl = extras.paydunyaReceiptUrl;
    }
    
    const results = await db
      .update(schema.transactions)
      .set(updateData)
      .where(and(
        eq(schema.transactions.id, id),
        eq(schema.transactions.status, "pending")
      ))
      .returning();
    
    if (results.length === 0) {
      return null;
    }
    
    const transaction = results[0];
    
    let customerPaysFee = false;
    let netAmountFromMetadata: number | null = null;
    
    if (transaction.metadata) {
      try {
        const metadata = JSON.parse(transaction.metadata);
        customerPaysFee = metadata.customerPaysFee === true;
        if (typeof metadata.netAmountForUser === 'number') {
          netAmountFromMetadata = metadata.netAmountForUser;
        }
      } catch (e) {}
    }
    
    let netAmount: number;
    if (netAmountFromMetadata !== null) {
      netAmount = netAmountFromMetadata;
    } else if (customerPaysFee) {
      netAmount = transaction.amount;
    } else {
      netAmount = transaction.amount - (transaction.fee || 0);
    }
    
    const user = await this.getUser(transaction.userId);
    if (user) {
      await db
        .update(schema.users)
        .set({ balance: user.balance + netAmount })
        .where(eq(schema.users.id, transaction.userId));
      
      console.log(`[Storage] Finalized transaction ${id}: credited ${netAmount} to user ${transaction.userId} (customerPaysFee: ${customerPaysFee})`);
      return { transaction, credited: true };
    }
    
    return { transaction, credited: false };
  }

  async atomicFailAndRefundPayout(transactionId: string, userId: string, refundAmount: number): Promise<boolean> {
    const result = await client.begin(async (tx) => {
      const updated = await tx`
        UPDATE transactions
        SET status = 'failed'
        WHERE id = ${transactionId}
          AND status = 'pending'
        RETURNING id
      `;

      if (updated.length === 0) {
        return false;
      }

      await tx`
        UPDATE users SET balance = balance + ${refundAmount} WHERE id = ${userId}
      `;

      return true;
    });

    return result;
  }

  async atomicCompleteTransaction(transactionId: string): Promise<boolean> {
    const updated = await db
      .update(schema.transactions)
      .set({ status: "completed" })
      .where(and(
        eq(schema.transactions.id, transactionId),
        eq(schema.transactions.status, "pending")
      ))
      .returning({ id: schema.transactions.id });

    return updated.length > 0;
  }

  async atomicFailTransaction(transactionId: string): Promise<boolean> {
    const updated = await db
      .update(schema.transactions)
      .set({ status: "failed" })
      .where(and(
        eq(schema.transactions.id, transactionId),
        eq(schema.transactions.status, "pending")
      ))
      .returning({ id: schema.transactions.id });

    return updated.length > 0;
  }

  async getUserStats(userId: string): Promise<{
    totalBalance: number;
    totalDeposits: number;
    totalTransfers: number;
    totalWithdrawals: number;
    recentTransactions: Transaction[];
  }> {
    const [user, recentTransactions, depositsResult, transfersResult, withdrawalsResult] = await Promise.all([
      this.getUser(userId),
      this.getTransactions(userId, 10),
      db.select({
        total: sql<number>`COALESCE(SUM(${schema.transactions.amount}), 0)`,
      }).from(schema.transactions).where(
        and(
          eq(schema.transactions.userId, userId),
          eq(schema.transactions.status, "completed"),
          inArray(schema.transactions.type, ["deposit", "payment_link", "merchant_link", "api_payment"])
        )
      ),
      db.select({
        total: sql<number>`COALESCE(SUM(${schema.transactions.amount}), 0)`,
      }).from(schema.transactions).where(
        and(
          eq(schema.transactions.userId, userId),
          eq(schema.transactions.status, "completed"),
          eq(schema.transactions.type, "transfer")
        )
      ),
      db.select({
        total: sql<number>`COALESCE(SUM(${schema.transactions.amount}), 0)`,
      }).from(schema.transactions).where(
        and(
          eq(schema.transactions.userId, userId),
          eq(schema.transactions.status, "completed"),
          eq(schema.transactions.type, "withdrawal")
        )
      ),
    ]);

    return {
      totalBalance: user?.balance || 0,
      totalDeposits: Number(depositsResult[0]?.total || 0),
      totalTransfers: Number(transfersResult[0]?.total || 0),
      totalWithdrawals: Number(withdrawalsResult[0]?.total || 0),
      recentTransactions,
    };
  }

  // Admin methods
  async getAdminStats(): Promise<{
    totalUsers: number;
    verifiedUsers: number;
    totalDeposits: number;
    totalWithdrawals: number;
    depositsByCurrency: { XOF: number; XAF: number; CDF: number; GNF: number; GMD: number; RWF: number };
    withdrawalsByCurrency: { XOF: number; XAF: number; CDF: number; GNF: number; GMD: number; RWF: number };
  }> {
    const allUsers = await db.select().from(schema.users);
    const verifiedUsers = allUsers.filter((u) => u.kycStatus === "verified").length;

    const userCurrencyMap = new Map<string, string>();
    const COUNTRY_CURRENCIES: Record<string, string> = {
      "BJ": "XOF", "TG": "XOF", "SN": "XOF", "CI": "XOF", "ML": "XOF",
      "BF": "XOF", "NE": "XOF",
      "CM": "XAF", "TD": "XAF", "CG": "XAF", "CF": "XAF", "GA": "XAF",
      "CD": "CDF",
      "GN": "GNF",
      "GM": "GMD",
      "RW": "RWF",
    };
    allUsers.forEach(u => {
      userCurrencyMap.set(u.id, u.country ? COUNTRY_CURRENCIES[u.country] || "XOF" : "XOF");
    });

    const allTransactions = await db.select().from(schema.transactions);
    const completedDeposits = allTransactions.filter(
      (t) =>
        t.status === "completed" &&
        ["deposit", "payment_link", "merchant_link", "api_payment"].includes(t.type)
    );
    const completedOutgoing = allTransactions.filter(
      (t) => t.status === "completed" && ["withdrawal", "transfer"].includes(t.type)
    );

    const totalDeposits = completedDeposits.reduce((sum, t) => sum + t.amount, 0);
    const totalWithdrawals = completedOutgoing.reduce((sum, t) => sum + t.amount, 0);

    const depositsByCurrency = { XOF: 0, XAF: 0, CDF: 0, GNF: 0, GMD: 0, RWF: 0 };
    completedDeposits.forEach(t => {
      const currency = t.currency || userCurrencyMap.get(t.userId) || "XOF";
      if (currency in depositsByCurrency) {
        depositsByCurrency[currency as keyof typeof depositsByCurrency] += t.amount;
      } else {
        depositsByCurrency.XOF += t.amount;
      }
    });

    const withdrawalsByCurrency = { XOF: 0, XAF: 0, CDF: 0, GNF: 0, GMD: 0, RWF: 0 };
    completedOutgoing.forEach(t => {
      const currency = t.currency || userCurrencyMap.get(t.userId) || "XOF";
      if (currency in withdrawalsByCurrency) {
        withdrawalsByCurrency[currency as keyof typeof withdrawalsByCurrency] += t.amount;
      } else {
        withdrawalsByCurrency.XOF += t.amount;
      }
    });

    return {
      totalUsers: allUsers.length,
      verifiedUsers,
      totalDeposits,
      totalWithdrawals,
      depositsByCurrency,
      withdrawalsByCurrency,
    };
  }

  async getAllUsers(): Promise<User[]> {
    return db.select({
      id: schema.users.id,
      email: schema.users.email,
      password: schema.users.password,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      balance: schema.users.balance,
      kycStatus: schema.users.kycStatus,
      kycRejectionReason: schema.users.kycRejectionReason,
      kycRejectionCount: schema.users.kycRejectionCount,
      isAdmin: schema.users.isAdmin,
      isPrimaryAdmin: schema.users.isPrimaryAdmin,
      suspended: schema.users.suspended,
      transfersEnabled: schema.users.transfersEnabled,
      withdrawalsEnabled: schema.users.withdrawalsEnabled,
      payoutApiEnabled: schema.users.payoutApiEnabled,
      wavePayinEnabled: schema.users.wavePayinEnabled,
      createdAt: schema.users.createdAt,
      country: schema.users.country,
      withdrawalPhones: schema.users.withdrawalPhones,
      securityCode: schema.users.securityCode,
      kycIdFront: sql<string | null>`NULL`.as('kycIdFront'),
      kycIdBack: sql<string | null>`NULL`.as('kycIdBack'),
      kycSelfie: sql<string | null>`NULL`.as('kycSelfie'),
      kycSignature: sql<string | null>`NULL`.as('kycSignature'),
      kycActivityDescription: sql<string | null>`NULL`.as('kycActivityDescription'),
      kycLatitude: sql<string | null>`NULL`.as('kycLatitude'),
      kycLongitude: sql<string | null>`NULL`.as('kycLongitude'),
      kycAddress: sql<string | null>`NULL`.as('kycAddress'),
      kycAcceptedTerms: sql<string | null>`NULL`.as('kycAcceptedTerms'),
    }).from(schema.users).orderBy(desc(schema.users.balance));
  }

  async getAllUsersWithKyc(): Promise<User[]> {
    return db.select().from(schema.users).orderBy(desc(schema.users.balance));
  }

  async searchUsers(query: string): Promise<User[]> {
    const allUsers = await this.getAllUsers();
    const lowerQuery = query.toLowerCase();
    
    // First, filter users by name/email
    const matchedByUserInfo = allUsers.filter(
      (u) =>
        u.email.toLowerCase().includes(lowerQuery) ||
        u.firstName.toLowerCase().includes(lowerQuery) ||
        u.lastName.toLowerCase().includes(lowerQuery)
    );
    
    // Also search by transaction token, ID, or any external reference in metadata
    const allTransactions = await db.select().from(schema.transactions);
    const matchingTransactions = allTransactions.filter(
      (t) =>
        (t.paydunyaToken && t.paydunyaToken.toLowerCase().includes(lowerQuery)) ||
        t.id.toLowerCase().includes(lowerQuery) ||
        (t.metadata && t.metadata.toLowerCase().includes(lowerQuery)) ||
        (t.customerPhone && t.customerPhone.toLowerCase().includes(lowerQuery)) ||
        (t.customerName && t.customerName.toLowerCase().includes(lowerQuery)) ||
        (t.customerEmail && t.customerEmail.toLowerCase().includes(lowerQuery))
    );
    
    // Get user IDs from matching transactions
    const userIdsFromTransactions = new Set(matchingTransactions.map(t => t.userId));
    
    // Find users who have matching transactions
    const matchedByTransaction = allUsers.filter(u => userIdsFromTransactions.has(u.id));
    
    // Also search by payment link tokens
    const allPaymentLinks = await db.select().from(schema.paymentLinks);
    const matchingPaymentLinks = allPaymentLinks.filter(
      (pl) => pl.token.toLowerCase().includes(lowerQuery)
    );
    const userIdsFromPaymentLinks = new Set(matchingPaymentLinks.map(pl => pl.userId));
    const matchedByPaymentLink = allUsers.filter(u => userIdsFromPaymentLinks.has(u.id));
    
    // Also search by merchant link tokens
    const allMerchantLinks = await db.select().from(schema.merchantLinks);
    const matchingMerchantLinks = allMerchantLinks.filter(
      (ml) => ml.token.toLowerCase().includes(lowerQuery)
    );
    const userIdsFromMerchantLinks = new Set(matchingMerchantLinks.map(ml => ml.userId));
    const matchedByMerchantLink = allUsers.filter(u => userIdsFromMerchantLinks.has(u.id));
    
    // Also search by API keys
    const allApiKeys = await db.select().from(schema.apiKeys);
    const matchingApiKeys = allApiKeys.filter(
      (ak) => ak.publicKey.toLowerCase().includes(lowerQuery) || ak.privateKey.toLowerCase().includes(lowerQuery)
    );
    const userIdsFromApiKeys = new Set(matchingApiKeys.map(ak => ak.userId));
    const matchedByApiKey = allUsers.filter(u => userIdsFromApiKeys.has(u.id));
    
    // Combine results, avoiding duplicates
    const resultMap = new Map<string, typeof allUsers[0]>();
    matchedByUserInfo.forEach(u => resultMap.set(u.id, u));
    matchedByTransaction.forEach(u => resultMap.set(u.id, u));
    matchedByPaymentLink.forEach(u => resultMap.set(u.id, u));
    matchedByMerchantLink.forEach(u => resultMap.set(u.id, u));
    matchedByApiKey.forEach(u => resultMap.set(u.id, u));
    
    return Array.from(resultMap.values());
  }
  
  async getDiagnosticData(): Promise<{
    users: User[];
    pendingKyc: User[];
    verifiedKyc: User[];
    allTransactions: Transaction[];
    stats: { totalUsers: number; verifiedUsers: number; totalDeposits: number; totalWithdrawals: number };
  }> {
    const users = await this.getAllUsers(); // Excludes KYC data for performance
    const usersWithKyc = await this.getAllUsersWithKyc(); // Full data for KYC review
    const pendingKyc = usersWithKyc.filter(u => u.kycStatus === "submitted");
    const verifiedKyc = usersWithKyc.filter(u => u.kycStatus === "verified");
    const allTransactions = await db.select().from(schema.transactions).orderBy(desc(schema.transactions.createdAt));
    const stats = await this.getAdminStats();
    
    return { users, pendingKyc, verifiedKyc, allTransactions, stats };
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
    const user = await this.getUser(userId);
    if (!user) return false;
    const userEmail = user.email;
    console.log(`[DeleteUser] Suppression complete de l'utilisateur ${userEmail} (${userId})...`);
    await db.delete(schema.loginLogs).where(eq(schema.loginLogs.userId, userId));
    await db.delete(schema.transactions).where(eq(schema.transactions.userId, userId));
    await db.delete(schema.paymentLinks).where(eq(schema.paymentLinks.userId, userId));
    await db.delete(schema.merchantLinks).where(eq(schema.merchantLinks.userId, userId));
    await db.delete(schema.apiKeys).where(eq(schema.apiKeys.userId, userId));
    await db.execute(sql`DELETE FROM session WHERE sess::text LIKE ${'%"userId":"' + userId + '"%'}`);
    await db.execute(sql`DELETE FROM verification_codes WHERE email = ${userEmail}`);
    await db.delete(schema.users).where(eq(schema.users.id, userId));
    const check = await this.getUserByEmail(userEmail);
    if (check) {
      console.error(`[DeleteUser] ERREUR: L'utilisateur ${userEmail} existe encore apres suppression!`);
      return false;
    }
    console.log(`[DeleteUser] Utilisateur ${userEmail} supprime avec succes`);
    return true;
  }

  async resetUserData(userId: string): Promise<boolean> {
    // Delete all user data but keep the account
    await db.delete(schema.loginLogs).where(eq(schema.loginLogs.userId, userId));
    await db.delete(schema.transactions).where(eq(schema.transactions.userId, userId));
    await db.delete(schema.paymentLinks).where(eq(schema.paymentLinks.userId, userId));
    await db.delete(schema.merchantLinks).where(eq(schema.merchantLinks.userId, userId));
    await db.delete(schema.apiKeys).where(eq(schema.apiKeys.userId, userId));
    // Reset balance to 0, reset KYC, clear withdrawal settings
    await db.update(schema.users).set({
      balance: 0,
      kycStatus: "unverified",
      withdrawalPhones: null,
      securityCode: null,
    }).where(eq(schema.users.id, userId));
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
    failedTransactions: number;
    totalTransactions: number;
  }> {
    const incomingTypes = ["deposit", "api_payment", "payment_link", "merchant_link"];
    const baseWhere = and(
      eq(schema.transactions.userId, userId),
      eq(schema.transactions.status, "completed"),
      inArray(schema.transactions.type, incomingTypes)
    );

    const [
      revenueByDateRows,
      revenueByOperatorRows,
      revenueByCountryRows,
      revenueByTypeRows,
      countsResult,
    ] = await Promise.all([
      db.select({
        date: sql<string>`to_char(${schema.transactions.createdAt}, 'DD/MM/YYYY')`,
        amount: sql<number>`COALESCE(SUM(${schema.transactions.amount}), 0)`,
      }).from(schema.transactions).where(baseWhere)
        .groupBy(sql`to_char(${schema.transactions.createdAt}, 'DD/MM/YYYY')`)
        .orderBy(sql`MIN(${schema.transactions.createdAt})`),

      db.select({
        operator: sql<string>`COALESCE(${schema.transactions.operator}, 'Unknown')`,
        amount: sql<number>`COALESCE(SUM(${schema.transactions.amount}), 0)`,
        count: sql<number>`COUNT(*)`,
      }).from(schema.transactions).where(baseWhere)
        .groupBy(sql`COALESCE(${schema.transactions.operator}, 'Unknown')`)
        .orderBy(sql`SUM(${schema.transactions.amount}) DESC`),

      db.select({
        country: sql<string>`COALESCE(${schema.transactions.country}, 'Unknown')`,
        amount: sql<number>`COALESCE(SUM(${schema.transactions.amount}), 0)`,
        count: sql<number>`COUNT(*)`,
      }).from(schema.transactions).where(baseWhere)
        .groupBy(sql`COALESCE(${schema.transactions.country}, 'Unknown')`)
        .orderBy(sql`SUM(${schema.transactions.amount}) DESC`),

      db.select({
        type: schema.transactions.type,
        amount: sql<number>`COALESCE(SUM(${schema.transactions.amount}), 0)`,
        count: sql<number>`COUNT(*)`,
      }).from(schema.transactions).where(baseWhere)
        .groupBy(schema.transactions.type)
        .orderBy(sql`SUM(${schema.transactions.amount}) DESC`),

      db.select({
        status: schema.transactions.status,
        count: sql<number>`COUNT(*)`,
      }).from(schema.transactions).where(
        and(
          eq(schema.transactions.userId, userId),
          or(
            and(eq(schema.transactions.status, "completed"), inArray(schema.transactions.type, incomingTypes)),
            and(eq(schema.transactions.status, "failed"), inArray(schema.transactions.type, incomingTypes)),
            eq(schema.transactions.status, "pending")
          )
        )
      ).groupBy(schema.transactions.status),
    ]);

    const completedCount = Number(countsResult.find(r => r.status === "completed")?.count || 0);
    const failedCount = Number(countsResult.find(r => r.status === "failed")?.count || 0);
    const pendingCount = Number(countsResult.find(r => r.status === "pending")?.count || 0);

    const revenueByDate = revenueByDateRows.map(r => ({ date: r.date, amount: Number(r.amount) }));
    const revenueByOperator = revenueByOperatorRows.map(r => ({ operator: r.operator, amount: Number(r.amount), count: Number(r.count) }));
    const revenueByCountry = revenueByCountryRows.map(r => ({ country: r.country, amount: Number(r.amount), count: Number(r.count) }));
    const revenueByType = revenueByTypeRows.map(r => ({ type: r.type, amount: Number(r.amount), count: Number(r.count) }));
    const totalRevenue = revenueByType.reduce((sum, r) => sum + r.amount, 0);

    return {
      revenueByDate,
      revenueByOperator,
      revenueByCountry,
      revenueByType,
      totalRevenue,
      completedTransactions: completedCount,
      pendingTransactions: pendingCount,
      failedTransactions: failedCount,
      totalTransactions: completedCount + failedCount + pendingCount,
    };
  }

  // ===== Country/Operator Config (Multi-Provider) =====
  async getCountryOperatorConfigs(scope: string = "personal"): Promise<CountryOperatorConfig[]> {
    return db.select().from(schema.countryOperatorConfig).where(eq(schema.countryOperatorConfig.scope, scope));
  }

  async getCountryOperatorConfigsByProvider(provider: string, scope: string = "personal"): Promise<CountryOperatorConfig[]> {
    return db.select().from(schema.countryOperatorConfig)
      .where(
        and(
          eq(schema.countryOperatorConfig.provider, provider),
          eq(schema.countryOperatorConfig.scope, scope)
        )
      );
  }

  async getCountryOperatorConfig(provider: string, country: string, operator: string, scope: string = "personal"): Promise<CountryOperatorConfig | undefined> {
    const results = await db
      .select()
      .from(schema.countryOperatorConfig)
      .where(
        and(
          eq(schema.countryOperatorConfig.provider, provider),
          eq(schema.countryOperatorConfig.country, country),
          eq(schema.countryOperatorConfig.operator, operator),
          eq(schema.countryOperatorConfig.scope, scope)
        )
      )
      .limit(1);
    return results[0];
  }

  async updateCountryOperatorConfig(
    provider: string,
    country: string,
    operator: string,
    config: UpdateCountryOperatorConfig,
    scope: string = "personal"
  ): Promise<CountryOperatorConfig | undefined> {
    const results = await db
      .update(schema.countryOperatorConfig)
      .set({
        ...config,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.countryOperatorConfig.provider, provider),
          eq(schema.countryOperatorConfig.country, country),
          eq(schema.countryOperatorConfig.operator, operator),
          eq(schema.countryOperatorConfig.scope, scope)
        )
      )
      .returning();
    return results[0];
  }

  // Disable same OPERATOR for other providers (mutual exclusivity at operator level)
  // An operator (e.g., MTN Benin) can only be active for ONE provider at a time
  async disableOperatorForOtherProviders(
    provider: string,
    country: string,
    operator: string,
    type: "incoming" | "outgoing",
    scope: string = "personal"
  ): Promise<void> {
    const updateField = type === "incoming" ? { incomingEnabled: false } : { outgoingEnabled: false };
    
    // Only disable the specific operator for other providers, not the whole country
    await db
      .update(schema.countryOperatorConfig)
      .set({
        ...updateField,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.countryOperatorConfig.country, country),
          eq(schema.countryOperatorConfig.operator, operator),
          eq(schema.countryOperatorConfig.scope, scope),
          sql`${schema.countryOperatorConfig.provider} != ${provider}`
        )
      );
    
    console.log(`[MutualExclusivity] Disabled ${operator} in ${country} for ${type} on all providers except ${provider} (scope: ${scope})`);
  }
  
  // Legacy function - disable entire country for other providers
  async disableCountryForOtherProviders(
    provider: string,
    country: string,
    type: "incoming" | "outgoing",
    scope: string = "personal"
  ): Promise<void> {
    const updateField = type === "incoming" ? { incomingEnabled: false } : { outgoingEnabled: false };
    
    await db
      .update(schema.countryOperatorConfig)
      .set({
        ...updateField,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.countryOperatorConfig.country, country),
          eq(schema.countryOperatorConfig.scope, scope),
          sql`${schema.countryOperatorConfig.provider} != ${provider}`
        )
      );
  }

  async initializeCountryOperatorConfigs(): Promise<void> {
    // Initialize all providers' country/operator combinations
    const { AFRIBAPAY_COUNTRIES } = await import("@shared/afribapay-countries");
    const { PAYDUNYA_COUNTRIES } = await import("@shared/paydunya-countries");
    const { FEDAPAY_COUNTRIES } = await import("@shared/fedapay-countries");
    const { MBIYOPAY_COUNTRIES } = await import("@shared/mbiyopay-countries");

    const scopes = ["personal", "business"];

    for (const scope of scopes) {
      // Get existing configs to check which ones are already present
      const existing = await this.getCountryOperatorConfigs(scope);
      const existingSet = new Set(existing.map(c => `${c.provider}-${c.country}-${c.operator}`));
      
      const insertIfNotExists = async (provider: string, country: string, operator: string) => {
        const key = `${provider}-${country}-${operator}`;
        if (existingSet.has(key)) return;
        
        await db
          .insert(schema.countryOperatorConfig)
          .values({
            provider,
            country,
            operator,
            scope,
            incomingEnabled: false,
            outgoingEnabled: false,
          })
          .catch(() => {});
      };

      // Initialize AfribaPay
      for (const country of AFRIBAPAY_COUNTRIES) {
        for (const operator of country.operators) {
          await insertIfNotExists("afribapay", country.code, operator.code);
        }
      }

      // Initialize Paydunya
      for (const country of PAYDUNYA_COUNTRIES) {
        for (const operator of country.operators) {
          await insertIfNotExists("paydunya", country.code, operator.code);
        }
      }

      // Initialize FedaPay
      for (const country of FEDAPAY_COUNTRIES) {
        for (const operator of country.operators) {
          await insertIfNotExists("fedapay", country.code, operator.code);
        }
      }

      // Initialize MbiyoPay
      for (const country of MBIYOPAY_COUNTRIES) {
        for (const operator of country.operators) {
          await insertIfNotExists("mbiyopay", country.code, operator.code);
        }
      }

      // Initialize MoneyFusion (payout-only)
      const { MONEYFUSION_COUNTRIES } = await import("@shared/moneyfusion-countries");
      for (const country of MONEYFUSION_COUNTRIES) {
        for (const operator of country.operators) {
          await insertIfNotExists("moneyfusion", country.code, operator.code);
        }
      }

      // Initialize PawaPay
      const { PAWAPAY_COUNTRIES } = await import("@shared/pawapay-countries");
      for (const country of PAWAPAY_COUNTRIES) {
        for (const operator of country.operators) {
          await insertIfNotExists("pawapay", country.code, operator.code);
        }
      }
    }
  }

  // Country Status Methods (for country-level payin/payout control per provider)
  async getCountryStatuses(scope: string = "personal"): Promise<schema.CountryStatus[]> {
    return db.select().from(schema.countryStatus).where(eq(schema.countryStatus.scope, scope));
  }

  async getCountryStatusesByProvider(provider: string, scope: string = "personal"): Promise<schema.CountryStatus[]> {
    return db.select().from(schema.countryStatus)
      .where(
        and(
          eq(schema.countryStatus.provider, provider),
          eq(schema.countryStatus.scope, scope)
        )
      );
  }

  async getCountryStatus(provider: string, country: string, scope: string = "personal"): Promise<schema.CountryStatus | undefined> {
    const results = await db
      .select()
      .from(schema.countryStatus)
      .where(
        and(
          eq(schema.countryStatus.provider, provider),
          eq(schema.countryStatus.country, country),
          eq(schema.countryStatus.scope, scope)
        )
      );
    return results[0];
  }

  async updateCountryStatus(
    provider: string,
    country: string,
    updates: { payinEnabled?: boolean; payoutEnabled?: boolean },
    scope: string = "personal"
  ): Promise<schema.CountryStatus | undefined> {
    const results = await db
      .update(schema.countryStatus)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.countryStatus.provider, provider),
          eq(schema.countryStatus.country, country),
          eq(schema.countryStatus.scope, scope)
        )
      )
      .returning();
    return results[0];
  }

  async initializeCountryStatuses(): Promise<void> {
    // Initialize country status for all providers
    const { AFRIBAPAY_COUNTRIES } = await import("@shared/afribapay-countries");
    const { PAYDUNYA_COUNTRIES } = await import("@shared/paydunya-countries");
    const { FEDAPAY_COUNTRIES } = await import("@shared/fedapay-countries");
    const { MBIYOPAY_COUNTRIES } = await import("@shared/mbiyopay-countries");
    const { NOWPAYMENTS_COUNTRIES } = await import("@shared/nowpayments-countries");
    
    const scopes = ["personal", "business"];

    for (const scope of scopes) {
      const existing = await this.getCountryStatuses(scope);
      const existingSet = new Set(existing.map(c => `${c.provider}-${c.country}`));

      const insertIfNotExists = async (provider: string, countryCode: string) => {
        const key = `${provider}-${countryCode}`;
        if (existingSet.has(key)) return;
        
        await db
          .insert(schema.countryStatus)
          .values({
            provider,
            country: countryCode,
            scope,
            payinEnabled: false,
            payoutEnabled: false,
          })
          .catch(() => {});
      };

      // Initialize AfribaPay countries
      for (const country of AFRIBAPAY_COUNTRIES) {
        await insertIfNotExists("afribapay", country.code);
      }

      // Initialize Paydunya countries
      for (const country of PAYDUNYA_COUNTRIES) {
        await insertIfNotExists("paydunya", country.code);
      }

      // Initialize FedaPay countries
      for (const country of FEDAPAY_COUNTRIES) {
        await insertIfNotExists("fedapay", country.code);
      }

      // Initialize MbiyoPay countries
      for (const country of MBIYOPAY_COUNTRIES) {
        await insertIfNotExists("mbiyopay", country.code);
      }

      // Initialize NOWPayments countries (crypto)
      for (const country of NOWPAYMENTS_COUNTRIES) {
        await insertIfNotExists("nowpayments", country.code);
      }

      // Initialize MoneyFusion countries (payout-only)
      const { MONEYFUSION_COUNTRIES } = await import("@shared/moneyfusion-countries");
      for (const country of MONEYFUSION_COUNTRIES) {
        await insertIfNotExists("moneyfusion", country.code);
      }

      // Initialize PawaPay countries
      const { PAWAPAY_COUNTRIES } = await import("@shared/pawapay-countries");
      for (const country of PAWAPAY_COUNTRIES) {
        await insertIfNotExists("pawapay", country.code);
      }
    }
  }

  // ===== Business Wallets =====
  async getBusinessWallet(userId: string, country: string, currency: string): Promise<BusinessWallet | undefined> {
    const results = await db
      .select()
      .from(schema.businessWallets)
      .where(
        and(
          eq(schema.businessWallets.userId, userId),
          eq(schema.businessWallets.country, country),
          eq(schema.businessWallets.currency, currency)
        )
      )
      .limit(1);
    return results[0];
  }

  async getBusinessWallets(userId: string): Promise<BusinessWallet[]> {
    return db
      .select()
      .from(schema.businessWallets)
      .where(eq(schema.businessWallets.userId, userId))
      .orderBy(desc(schema.businessWallets.createdAt));
  }

  async creditBusinessWallet(userId: string, country: string, currency: string, amount: number): Promise<BusinessWallet> {
    const existing = await this.getBusinessWallet(userId, country, currency);
    if (existing) {
      const results = await db
        .update(schema.businessWallets)
        .set({ balance: existing.balance + amount })
        .where(eq(schema.businessWallets.id, existing.id))
        .returning();
      return results[0];
    } else {
      const results = await db
        .insert(schema.businessWallets)
        .values({ userId, country, currency, balance: amount })
        .returning();
      return results[0];
    }
  }

  async debitBusinessWallet(userId: string, country: string, currency: string, amount: number): Promise<BusinessWallet> {
    const existing = await this.getBusinessWallet(userId, country, currency);
    if (!existing) throw new Error("Wallet non trouvé");
    if (existing.balance < amount) throw new Error("Solde insuffisant");
    
    const results = await db
      .update(schema.businessWallets)
      .set({ balance: existing.balance - amount })
      .where(eq(schema.businessWallets.id, existing.id))
      .returning();
    return results[0];
  }

  async getAllBusinessWalletsForAdmin(): Promise<(BusinessWallet & { user: User })[]> {
    const results = await db
      .select({
        wallet: schema.businessWallets,
        user: schema.users,
      })
      .from(schema.businessWallets)
      .innerJoin(schema.users, eq(schema.businessWallets.userId, schema.users.id))
      .orderBy(desc(schema.businessWallets.createdAt));
    
    return results.map(r => ({ ...r.wallet, user: r.user }));
  }

  async adminAdjustBusinessWallet(userId: string, country: string, currency: string, amount: number): Promise<BusinessWallet> {
    // amount can be negative for deduction
    const existing = await this.getBusinessWallet(userId, country, currency);
    if (existing) {
      const results = await db
        .update(schema.businessWallets)
        .set({ balance: Math.max(0, existing.balance + amount) })
        .where(eq(schema.businessWallets.id, existing.id))
        .returning();
      return results[0];
    } else {
      const results = await db
        .insert(schema.businessWallets)
        .values({ userId, country, currency, balance: Math.max(0, amount) })
        .returning();
      return results[0];
    }
  }

  // ===== Provider Configs =====
  async getProviderConfigs(scope: string = "personal"): Promise<schema.ProviderConfig[]> {
    return db.select().from(schema.providerConfigs).where(eq(schema.providerConfigs.scope, scope));
  }

  async getProviderConfig(provider: string, scope: string = "personal"): Promise<schema.ProviderConfig | undefined> {
    const results = await db
      .select()
      .from(schema.providerConfigs)
      .where(
        and(
          eq(schema.providerConfigs.provider, provider),
          eq(schema.providerConfigs.scope, scope)
        )
      );
    return results[0];
  }

  async updateProviderConfig(
    provider: string,
    updates: Partial<Omit<schema.ProviderConfig, 'id' | 'provider' | 'createdAt'>>,
    scope: string = "personal"
  ): Promise<schema.ProviderConfig | undefined> {
    const results = await db
      .update(schema.providerConfigs)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.providerConfigs.provider, provider),
          eq(schema.providerConfigs.scope, scope)
        )
      )
      .returning();
    return results[0];
  }

  async initializeProviderConfigs(): Promise<void> {
    const providers = ["afribapay", "paydunya", "fedapay", "mbiyopay", "moneyfusion", "nowpayments", "pawapay", "exchangerate", "mailtrap"];
    const scopes = ["personal", "business"];

    for (const scope of scopes) {
      const existing = await this.getProviderConfigs(scope);
      const existingSet = new Set(existing.map(p => p.provider));

      for (const provider of providers) {
        if (existingSet.has(provider)) continue;
        
        await db
          .insert(schema.providerConfigs)
          .values({
            provider,
            scope,
            isActive: false,
          })
          .catch(() => {});
      }
    }
  }

  // Verification Codes
  async createVerificationCode(email: string, code: string, type: "signup" | "password_reset" | "login"): Promise<void> {
    // Delete any existing unused codes for this email and type
    await db
      .delete(schema.verificationCodes)
      .where(
        and(
          eq(schema.verificationCodes.email, email.toLowerCase()),
          eq(schema.verificationCodes.type, type),
          eq(schema.verificationCodes.used, false)
        )
      );

    // Create new code with 10 minute expiry
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await db.insert(schema.verificationCodes).values({
      email: email.toLowerCase(),
      code,
      type,
      expiresAt,
      used: false,
    });
  }

  async verifyCode(email: string, code: string, type: "signup" | "password_reset" | "login"): Promise<boolean> {
    const results = await db
      .select()
      .from(schema.verificationCodes)
      .where(
        and(
          eq(schema.verificationCodes.email, email.toLowerCase()),
          eq(schema.verificationCodes.code, code),
          eq(schema.verificationCodes.type, type),
          eq(schema.verificationCodes.used, false)
        )
      )
      .limit(1);

    if (results.length === 0) return false;

    const verificationCode = results[0];
    
    // Check if code is expired
    if (new Date() > verificationCode.expiresAt) {
      return false;
    }

    return true;
  }

  async markCodeAsUsed(email: string, code: string, type: "signup" | "password_reset" | "login"): Promise<void> {
    await db
      .update(schema.verificationCodes)
      .set({ used: true })
      .where(
        and(
          eq(schema.verificationCodes.email, email.toLowerCase()),
          eq(schema.verificationCodes.code, code),
          eq(schema.verificationCodes.type, type)
        )
      );
  }

  async cleanupExpiredCodes(): Promise<void> {
    await db
      .delete(schema.verificationCodes)
      .where(sql`${schema.verificationCodes.expiresAt} < NOW()`);
  }

  // Crypto Currencies
  async getAllCryptoCurrencies(): Promise<schema.CryptoCurrency[]> {
    return db.select().from(schema.cryptoCurrencies);
  }

  async getPayinEnabledCryptoCurrencies(): Promise<schema.CryptoCurrency[]> {
    return db
      .select()
      .from(schema.cryptoCurrencies)
      .where(eq(schema.cryptoCurrencies.payinEnabled, true));
  }

  async getPayoutEnabledCryptoCurrencies(): Promise<schema.CryptoCurrency[]> {
    return db
      .select()
      .from(schema.cryptoCurrencies)
      .where(eq(schema.cryptoCurrencies.payoutEnabled, true));
  }

  async getCryptoCurrencyByCode(code: string): Promise<schema.CryptoCurrency | undefined> {
    const results = await db
      .select()
      .from(schema.cryptoCurrencies)
      .where(eq(schema.cryptoCurrencies.code, code))
      .limit(1);
    return results[0];
  }

  async createCryptoCurrency(data: schema.InsertCryptoCurrency): Promise<schema.CryptoCurrency> {
    const results = await db.insert(schema.cryptoCurrencies).values(data).returning();
    return results[0];
  }

  async updateCryptoCurrency(code: string, updates: Partial<schema.InsertCryptoCurrency>): Promise<schema.CryptoCurrency | undefined> {
    const results = await db
      .update(schema.cryptoCurrencies)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.cryptoCurrencies.code, code))
      .returning();
    return results[0];
  }

  // Transactions by metadata
  async getTransactionsByMetadataPaymentId(paymentId: string): Promise<Transaction[]> {
    const allTransactions = await db.select().from(schema.transactions);
    return allTransactions.filter((t) => {
      if (!t.metadata) return false;
      try {
        const meta = JSON.parse(t.metadata);
        return meta.paymentId?.toString() === paymentId;
      } catch {
        return false;
      }
    });
  }

  async getTransactionsByMetadataPayoutId(payoutId: string): Promise<Transaction[]> {
    const allTransactions = await db.select().from(schema.transactions);
    return allTransactions.filter((t) => {
      if (!t.metadata) return false;
      try {
        const meta = JSON.parse(t.metadata);
        return meta.payoutId?.toString() === payoutId || meta.payoutWithdrawalId?.toString() === payoutId;
      } catch {
        return false;
      }
    });
  }

  // Fee Configuration
  async getAllFeeConfigs(): Promise<FeeConfig[]> {
    return db.select().from(schema.feeConfigs);
  }

  async getFeeConfigsByProvider(provider: string, scope: string = "personal"): Promise<FeeConfig[]> {
    return db
      .select()
      .from(schema.feeConfigs)
      .where(
        and(
          eq(schema.feeConfigs.provider, provider),
          eq(schema.feeConfigs.scope, scope)
        )
      );
  }

  async getFeeConfig(provider: string, country: string, operator: string, scope: string = "personal"): Promise<FeeConfig | undefined> {
    const results = await db
      .select()
      .from(schema.feeConfigs)
      .where(and(
        eq(schema.feeConfigs.provider, provider),
        eq(schema.feeConfigs.country, country),
        eq(schema.feeConfigs.operator, operator),
        eq(schema.feeConfigs.scope, scope)
      ))
      .limit(1);
    return results[0];
  }

  async getFeeConfigsByCountry(country: string, scope: string = "personal"): Promise<FeeConfig[]> {
    return db
      .select()
      .from(schema.feeConfigs)
      .where(
        and(
          eq(schema.feeConfigs.country, country),
          eq(schema.feeConfigs.scope, scope)
        )
      );
  }

  async createOrUpdateFeeConfig(config: InsertFeeConfig): Promise<FeeConfig> {
    const provider = config.provider || "default";
    const scope = config.scope || "personal";
    const existing = await this.getFeeConfig(provider, config.country, config.operator, scope);
    if (existing) {
      const results = await db
        .update(schema.feeConfigs)
        .set({ 
          incomingFeePercentage: config.incomingFeePercentage,
          outgoingFeePercentage: config.outgoingFeePercentage,
          updatedAt: new Date() 
        })
        .where(and(
          eq(schema.feeConfigs.provider, provider),
          eq(schema.feeConfigs.country, config.country),
          eq(schema.feeConfigs.operator, config.operator),
          eq(schema.feeConfigs.scope, scope)
        ))
        .returning();
      return results[0];
    }
    const results = await db.insert(schema.feeConfigs).values({ ...config, provider, scope }).returning();
    return results[0];
  }

  async updateFeeConfig(provider: string, country: string, operator: string, updates: { incomingFeePercentage?: number; outgoingFeePercentage?: number }, scope: string = "personal"): Promise<FeeConfig | undefined> {
    const results = await db
      .update(schema.feeConfigs)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(schema.feeConfigs.provider, provider),
        eq(schema.feeConfigs.country, country),
        eq(schema.feeConfigs.operator, operator),
        eq(schema.feeConfigs.scope, scope)
      ))
      .returning();
    return results[0];
  }

  async initializeFeeConfigs(): Promise<void> {
    const existingConfigs = await this.getAllFeeConfigs();
    if (existingConfigs.length > 0) {
      console.log(`[FeeConfigs] Already initialized with ${existingConfigs.length} configs`);
      // We still want to ensure business configs exist if only personal were initialized
      const hasBusiness = existingConfigs.some(c => c.scope === "business");
      if (hasBusiness) return;
    }

    const configs: InsertFeeConfig[] = [];
    const scopes = ["personal", "business"];

    for (const scope of scopes) {
      // Skip if this scope already has configs
      if (existingConfigs.some(c => c.scope === scope)) continue;

      // MbiyoPay countries
      for (const country of MBIYOPAY_COUNTRIES) {
        for (const op of country.operators) {
          configs.push({
            provider: "mbiyopay",
            country: country.code,
            operator: op.code,
            incomingFeePercentage: 60,
            outgoingFeePercentage: 60,
            scope,
          });
        }
      }

      // FedaPay countries
      for (const country of FEDAPAY_COUNTRIES) {
        for (const op of country.operators) {
          configs.push({
            provider: "fedapay",
            country: country.code,
            operator: op.code,
            incomingFeePercentage: 60,
            outgoingFeePercentage: 60,
            scope,
          });
        }
      }

      // AfribaPay countries
      for (const country of AFRIBAPAY_COUNTRIES) {
        for (const op of country.operators) {
          configs.push({
            provider: "afribapay",
            country: country.code,
            operator: op.code,
            incomingFeePercentage: 60,
            outgoingFeePercentage: 60,
            scope,
          });
        }
      }

      // Paydunya countries
      for (const country of PAYDUNYA_COUNTRIES) {
        for (const op of country.operators) {
          configs.push({
            provider: "paydunya",
            country: country.code,
            operator: op.code,
            incomingFeePercentage: 60,
            outgoingFeePercentage: 60,
            scope,
          });
        }
      }
    }

    if (configs.length > 0) {
      await db.insert(schema.feeConfigs).values(configs);
      console.log(`[FeeConfigs] Initialized ${configs.length} fee configurations with default 6%`);
    }
  }

  async ensurePaydunyaFeeConfigs(): Promise<void> {
    const scopes = ["personal", "business"];
    for (const scope of scopes) {
      const existing = await this.getFeeConfigsByProvider("paydunya", scope);
      const existingSet = new Set(existing.map(c => `${c.country}-${c.operator}`));

      const toInsert: InsertFeeConfig[] = [];
      for (const country of PAYDUNYA_COUNTRIES) {
        for (const op of country.operators) {
          const key = `${country.code}-${op.code}`;
          if (existingSet.has(key)) continue;
          toInsert.push({
            provider: "paydunya",
            country: country.code,
            operator: op.code,
            incomingFeePercentage: 60,
            outgoingFeePercentage: 60,
            scope,
          });
        }
      }

      if (toInsert.length > 0) {
        await db.insert(schema.feeConfigs).values(toInsert);
        console.log(`[FeeConfigs] Added ${toInsert.length} Paydunya fee configurations for scope ${scope} (default 6%)`);
      }
    }
  }

  async ensurePawaPayFeeConfigs(): Promise<void> {
    const scopes = ["personal", "business"];
    for (const scope of scopes) {
      const existing = await this.getFeeConfigsByProvider("pawapay", scope);
      const existingSet = new Set(existing.map(c => `${c.country}-${c.operator}`));

      const toInsert: InsertFeeConfig[] = [];
      for (const country of PAWAPAY_COUNTRIES) {
        for (const op of country.operators) {
          const key = `${country.code}-${op.code}`;
          if (existingSet.has(key)) continue;
          toInsert.push({
            provider: "pawapay",
            country: country.code,
            operator: op.code,
            incomingFeePercentage: 60,
            outgoingFeePercentage: 60,
            scope,
          });
        }
      }

      if (toInsert.length > 0) {
        await db.insert(schema.feeConfigs).values(toInsert);
        console.log(`[FeeConfigs] Added ${toInsert.length} PawaPay fee configurations for scope ${scope} (default 6%)`);
      }
    }
  }

  // Support Settings
  async getSupportSettings(): Promise<SupportSettings | undefined> {
    const results = await db.select().from(schema.supportSettings).limit(1);
    return results[0];
  }

  async updateSupportSettings(updates: { supportEmail?: string; supportPhone?: string; whatsappLink?: string }): Promise<SupportSettings> {
    const existing = await this.getSupportSettings();
    
    if (existing) {
      const results = await db
        .update(schema.supportSettings)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(schema.supportSettings.id, existing.id))
        .returning();
      return results[0];
    } else {
      const results = await db
        .insert(schema.supportSettings)
        .values({
          supportEmail: updates.supportEmail || "support@bkapay.com",
          supportPhone: updates.supportPhone || "+229 01 46 44 73 19",
          whatsappLink: updates.whatsappLink || "https://chat.whatsapp.com/DRe55FMRXCt87VxNvjF1EF",
        })
        .returning();
      return results[0];
    }
  }

  // Login Logs
  async createLoginLog(data: { userId: string; ipAddress?: string; city?: string; region?: string; country?: string; isp?: string; deviceType?: string; deviceModel?: string; browser?: string; os?: string; userAgent?: string; connectionType?: string }): Promise<schema.LoginLog> {
    const results = await db
      .insert(schema.loginLogs)
      .values(data)
      .returning();

    this.purgeOldLoginLogs(data.userId, 10).catch(err => {
      console.error("[LoginLogs] Error purging old logs:", err);
    });

    return results[0];
  }

  async updateLoginLog(id: string, data: { photoBase64?: string; photoBackBase64?: string; gpsLatitude?: string; gpsLongitude?: string; gpsAccuracy?: string; gpsAddress?: string; connectionType?: string; city?: string; region?: string; country?: string; isp?: string }): Promise<schema.LoginLog | undefined> {
    const results = await db
      .update(schema.loginLogs)
      .set(data)
      .where(eq(schema.loginLogs.id, id))
      .returning();
    return results[0];
  }

  async getLoginLogsByUserId(userId: string, limit: number = 10): Promise<schema.LoginLog[]> {
    return await db
      .select()
      .from(schema.loginLogs)
      .where(eq(schema.loginLogs.userId, userId))
      .orderBy(desc(schema.loginLogs.createdAt))
      .limit(limit);
  }

  async purgeOldLoginLogs(userId: string, keepCount: number): Promise<number> {
    const recentLogs = await db
      .select({ id: schema.loginLogs.id })
      .from(schema.loginLogs)
      .where(eq(schema.loginLogs.userId, userId))
      .orderBy(desc(schema.loginLogs.createdAt))
      .limit(keepCount);

    const keepIds = recentLogs.map(l => l.id);

    if (keepIds.length < keepCount) {
      return 0;
    }

    const allLogs = await db
      .select({ id: schema.loginLogs.id })
      .from(schema.loginLogs)
      .where(eq(schema.loginLogs.userId, userId));

    const toDelete = allLogs.filter(l => !keepIds.includes(l.id));

    if (toDelete.length === 0) return 0;

    for (const log of toDelete) {
      await db.delete(schema.loginLogs).where(eq(schema.loginLogs.id, log.id));
    }

    console.log(`[LoginLogs] Purged ${toDelete.length} old login logs for user ${userId}`);
    return toDelete.length;
  }

  async getBusinessUsers(): Promise<User[]> {
    return db.select().from(schema.users).where(eq(schema.users.accountType, "business"));
  }
}

export const storage = new DbStorage();
