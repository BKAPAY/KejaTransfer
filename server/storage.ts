import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, desc, or, and, sql, gte, lte, inArray, ne, isNull, isNotNull } from "drizzle-orm";
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
  BusinessWallet,
  InsertBusinessWallet,
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
  submitKyc(userId: string, kycData: { kycIdFront: string; kycIdBack: string; kycSelfie: string; kycSignature: string; kycActivityDescription: string; kycLatitude: string; kycLongitude: string; kycAddress: string; kycAcceptedTerms: string; kycPhone?: string; kycWhatsapp?: string; kycActivityUrl?: string; kycUrlWebsite?: string; kycUrlInstagram?: string; kycUrlFacebook?: string; kycUrlTiktok?: string; kycUrlYoutube?: string; kycUrlWhatsappGroup?: string; kycUrlWhatsappChannel?: string; kycDocumentType?: string; kycDocumentNumber?: string; kycDocumentExpiryDate?: string }): Promise<User | undefined>;
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
  resetUserSecurityCode(id: string): Promise<User | undefined>;
  updateBusinessProfile(id: string, data: { businessRegistrationNumber?: string; businessCountry?: string; businessPhone?: string; businessEnterprisePhone?: string; businessEmail?: string }): Promise<User | undefined>;
  adminUpdateUserProfile(id: string, data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    country?: string;
    businessName?: string | null;
    businessRegistrationNumber?: string | null;
    businessCountry?: string | null;
    businessPhone?: string | null;
    businessEnterprisePhone?: string | null;
    businessEmail?: string | null;
  }): Promise<User | undefined>;
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
  updateMerchantLinkName(id: string, merchantName: string): Promise<MerchantLink | undefined>;
  updateMerchantLink(id: string, updates: { customerPaysFee?: boolean; customerPaysCryptoFee?: boolean; minAmount?: number | null; minAmountCurrency?: string }): Promise<MerchantLink | undefined>;
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
  updatePayoutApiStatus(userId: string, enabled: boolean): Promise<User | undefined>;

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
  getTransactionByFeeXPayReference(reference: string): Promise<Transaction | undefined>;
  getTransactionByOrderId(orderId: string, userId: string): Promise<Transaction | undefined>;
  getRecentApiPaymentByPhoneAmount(userId: string, phone: string, amount: number, secondsAgo: number): Promise<Transaction | undefined>;
  getRecentTransactionsByDescription(userId: string, description: string, since: Date): Promise<Transaction[]>;
  getAllPendingTransactions(): Promise<(Transaction & { user?: User })[]>;
  getAllTransactionsForAdmin(limit?: number): Promise<(Transaction & { user?: User })[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransactionStatus(id: string, status: string, paydunyaData?: any): Promise<Transaction | undefined>;
  updateTransaction(id: string, updates: Partial<Pick<Transaction, 'paydunyaToken' | 'country' | 'operator' | 'status' | 'metadata' | 'paydunyaReceiptUrl' | 'type' | 'description'>>): Promise<Transaction | undefined>;
  updateTransactionMetadata(id: string, metadata: string): Promise<Transaction | undefined>;
  atomicMarkRefundedAndCredit(transactionId: string, userId: string, refundAmount: number, source: string): Promise<boolean>;
  atomicFailAndRefundBusinessWallet(transactionId: string, userId: string, country: string, currency: string, refundAmount: number, source: string): Promise<boolean>;
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
  
  // Business Admin Stats
  getBusinessAdminStats(): Promise<{
    totalUsers: number;
    verifiedUsers: number;
    totalDeposits: number;
    totalWithdrawals: number;
    depositsByCurrency: Record<string, number>;
    withdrawalsByCurrency: Record<string, number>;
  }>;

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

  // Business Tokens
  createBusinessToken(data: { userId: string; token: string; name: string }): Promise<schema.BusinessToken>;
  getBusinessTokenByToken(token: string): Promise<schema.BusinessToken | undefined>;
  getBusinessTokenById(id: string): Promise<schema.BusinessToken | undefined>;
  getBusinessTokensByUserId(userId: string): Promise<schema.BusinessToken[]>;
  updateBusinessToken(id: string, userId: string, updates: Partial<Pick<schema.BusinessToken, 'name' | 'callbackUrl' | 'payoutCallbackUrl' | 'callbackSecret' | 'payoutCallbackSecret' | 'isActive' | 'allowedCountries' | 'customerPaysFee'>>): Promise<schema.BusinessToken | undefined>;
  deleteBusinessToken(id: string, userId: string): Promise<boolean>;
  regenerateBusinessToken(id: string, userId: string): Promise<schema.BusinessToken | undefined>;

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
  getTransactionsByMetadata(key: string, value: string): Promise<Transaction[]>;

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
  ensureFeeXPayFeeConfigs(): Promise<void>;
  ensureMoneyFusionFeeConfigs(): Promise<void>;
  // User-specific fee configs
  getUserFeeConfigs(userId: string): Promise<FeeConfig[]>;
  getUserFeeConfig(userId: string, provider: string, country: string, operator: string): Promise<FeeConfig | undefined>;
  upsertUserFeeConfig(userId: string, provider: string, country: string, operator: string, incomingFeePercentage: number, outgoingFeePercentage: number): Promise<FeeConfig>;
  deleteUserFeeConfig(userId: string, provider: string, country: string, operator: string): Promise<void>;

  // Currency Exchange Fees
  getAllCurrencyExchangeFees(): Promise<schema.CurrencyExchangeFee[]>;
  getCurrencyExchangeFee(fromCurrency: string, toCurrency: string): Promise<schema.CurrencyExchangeFee | undefined>;
  upsertCurrencyExchangeFee(fromCurrency: string, toCurrency: string, feePercentage: number, isActive?: number): Promise<schema.CurrencyExchangeFee>;
  initializeCurrencyExchangeFees(): Promise<void>;

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

  // Light user (no KYC images) for auth/me and login
  getUserLight(id: string): Promise<User | undefined>;
  getUserByEmailLight(email: string): Promise<User | undefined>;
  getUserKycDocuments(id: string): Promise<{
    kycIdFront: string | null;
    kycIdBack: string | null;
    kycSelfie: string | null;
    kycSignature: string | null;
    kycBusinessDocuments: string | null;
    kycTaxDocument: string | null;
    kycAddressDocument: string | null;
  } | undefined>;

  // Search
  searchUsers(query: string): Promise<User[]>;
  searchBusinessUsers(query: string): Promise<User[]>;

  // Salary
  getSalaryAccount(userId: string): Promise<schema.SalaryAccount | undefined>;
  createSalaryAccount(userId: string, currency: string, label?: string): Promise<schema.SalaryAccount>;
  updateSalaryAccount(userId: string, updates: Partial<Pick<schema.SalaryAccount, 'isActive' | 'label' | 'currency'>>): Promise<schema.SalaryAccount | undefined>;
  creditSalaryBalance(userId: string, amount: number): Promise<schema.SalaryAccount | undefined>;
  debitSalaryBalance(userId: string, amount: number): Promise<schema.SalaryAccount | undefined>;
  getSalarySchedules(userId: string): Promise<schema.SalarySchedule[]>;
  createSalarySchedule(data: schema.InsertSalarySchedule): Promise<schema.SalarySchedule>;
  updateSalarySchedule(id: string, updates: Partial<schema.InsertSalarySchedule> & { nextPayAt?: Date | null; lastPaidAt?: Date | null }): Promise<schema.SalarySchedule | undefined>;
  deleteSalarySchedule(id: string): Promise<boolean>;
  getAllActiveSalarySchedulesDue(): Promise<(schema.SalarySchedule & { user?: User })[]>;
  createSalaryTransaction(data: schema.InsertSalaryTransaction): Promise<schema.SalaryTransaction>;
  getSalaryTransactions(userId: string, limit?: number): Promise<schema.SalaryTransaction[]>;
  updateSalaryTransactionByInternalId(internalTransactionId: string, status: string): Promise<void>;
  getAllSalaryAccountsForAdmin(): Promise<(schema.SalaryAccount & { user?: User })[]>;
  updateUserSalaryFlag(userId: string, isSalary: boolean): Promise<void>;
  deleteSalaryAccountCompletely(userId: string): Promise<void>;

  // Shops
  getShopById(id: string): Promise<schema.Shop | undefined>;
  getShopByUserId(userId: string): Promise<schema.Shop | undefined>;
  getShopBySlug(slug: string): Promise<schema.Shop | undefined>;
  getShopByCustomDomain(domain: string): Promise<schema.Shop | undefined>;
  createShop(data: schema.InsertShop): Promise<schema.Shop>;
  updateShop(id: string, updates: Partial<schema.InsertShop>): Promise<schema.Shop | undefined>;
  deleteShop(id: string): Promise<void>;

  // Shop categories
  getShopCategories(shopId: string): Promise<schema.ShopCategory[]>;
  createShopCategory(data: schema.InsertShopCategory): Promise<schema.ShopCategory>;
  updateShopCategory(id: string, updates: Partial<schema.InsertShopCategory>): Promise<schema.ShopCategory | undefined>;
  deleteShopCategory(id: string): Promise<void>;

  // Shop products
  getShopProducts(shopId: string): Promise<schema.ShopProduct[]>;
  getShopProduct(id: string): Promise<schema.ShopProduct | undefined>;
  createShopProduct(data: schema.InsertShopProduct): Promise<schema.ShopProduct>;
  updateShopProduct(id: string, updates: Partial<schema.InsertShopProduct>): Promise<schema.ShopProduct | undefined>;
  deleteShopProduct(id: string): Promise<void>;

  // Shop orders
  getShopOrders(shopId: string): Promise<schema.ShopOrder[]>;
  getShopOrder(id: string): Promise<schema.ShopOrder | undefined>;
  createShopOrder(data: schema.InsertShopOrder): Promise<schema.ShopOrder>;
  updateShopOrder(id: string, updates: Partial<schema.InsertShopOrder>): Promise<schema.ShopOrder | undefined>;
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

  private lightUserSelect() {
    return {
      id: schema.users.id,
      email: schema.users.email,
      password: schema.users.password,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      accountType: schema.users.accountType,
      businessName: schema.users.businessName,
      businessRegistrationNumber: schema.users.businessRegistrationNumber,
      businessCountry: schema.users.businessCountry,
      businessPhone: schema.users.businessPhone,
      businessEnterprisePhone: schema.users.businessEnterprisePhone,
      businessEmail: schema.users.businessEmail,
      country: schema.users.country,
      balance: schema.users.balance,
      kycStatus: schema.users.kycStatus,
      kycPhone: schema.users.kycPhone,
      kycWhatsapp: schema.users.kycWhatsapp,
      kycActivityUrl: schema.users.kycActivityUrl,
      kycUrlWebsite: schema.users.kycUrlWebsite,
      kycUrlInstagram: schema.users.kycUrlInstagram,
      kycUrlFacebook: schema.users.kycUrlFacebook,
      kycUrlTiktok: schema.users.kycUrlTiktok,
      kycUrlYoutube: schema.users.kycUrlYoutube,
      kycUrlWhatsappGroup: schema.users.kycUrlWhatsappGroup,
      kycUrlWhatsappChannel: schema.users.kycUrlWhatsappChannel,
      kycRejectionReason: schema.users.kycRejectionReason,
      kycRejectionCount: schema.users.kycRejectionCount,
      kycBusinessAccountNumber: schema.users.kycBusinessAccountNumber,
      kycTaxId: schema.users.kycTaxId,
      kycBusinessAddress: schema.users.kycBusinessAddress,
      kycBusinessCity: schema.users.kycBusinessCity,
      kycBusinessDepartment: schema.users.kycBusinessDepartment,
      kycDirectorIdNumber: schema.users.kycDirectorIdNumber,
      kycDirectorCountry: schema.users.kycDirectorCountry,
      kycDirectorDob: schema.users.kycDirectorDob,
      kycIdIssueDate: schema.users.kycIdIssueDate,
      kycIdExpiryDate: schema.users.kycIdExpiryDate,
      kycAddress: schema.users.kycAddress,
      kycLatitude: schema.users.kycLatitude,
      kycLongitude: schema.users.kycLongitude,
      kycActivityDescription: schema.users.kycActivityDescription,
      kycAcceptedTerms: schema.users.kycAcceptedTerms,
      withdrawalPhones: schema.users.withdrawalPhones,
      securityCode: schema.users.securityCode,
      isAdmin: schema.users.isAdmin,
      isPrimaryAdmin: schema.users.isPrimaryAdmin,
      isSalary: schema.users.isSalary,
      suspended: schema.users.suspended,
      transfersEnabled: schema.users.transfersEnabled,
      withdrawalsEnabled: schema.users.withdrawalsEnabled,
      payoutApiEnabled: schema.users.payoutApiEnabled,
      wavePayinEnabled: schema.users.wavePayinEnabled,
      depositOverrideEnabled: schema.users.depositOverrideEnabled,
      bankAccountHolder: schema.users.bankAccountHolder,
      bankAccountNumber: schema.users.bankAccountNumber,
      bankName: schema.users.bankName,
      bankSwiftBic: schema.users.bankSwiftBic,
      bankBranchAddress: schema.users.bankBranchAddress,
      bankBranchName: schema.users.bankBranchName,
      bankBranchSortCode: schema.users.bankBranchSortCode,
      bankCountry: schema.users.bankCountry,
      bankCurrency: schema.users.bankCurrency,
      momoCountry: schema.users.momoCountry,
      momoOperator: schema.users.momoOperator,
      momoPhone: schema.users.momoPhone,
      createdAt: schema.users.createdAt,
      // Large KYC image/document fields replaced with NULL to avoid large data transfer
      kycIdFront: sql<string | null>`NULL`.as('kycIdFront'),
      kycIdBack: sql<string | null>`NULL`.as('kycIdBack'),
      kycSelfie: sql<string | null>`NULL`.as('kycSelfie'),
      kycSignature: sql<string | null>`NULL`.as('kycSignature'),
      kycBusinessDocuments: sql<string | null>`NULL`.as('kycBusinessDocuments'),
      kycTaxDocument: sql<string | null>`NULL`.as('kycTaxDocument'),
      kycAddressDocument: sql<string | null>`NULL`.as('kycAddressDocument'),
    };
  }

  async getUserLight(id: string): Promise<User | undefined> {
    const results = await db.select(this.lightUserSelect()).from(schema.users).where(eq(schema.users.id, id)).limit(1);
    return results[0] as User | undefined;
  }

  async getUserByEmailLight(email: string): Promise<User | undefined> {
    const results = await db.select(this.lightUserSelect()).from(schema.users).where(eq(schema.users.email, email)).limit(1);
    return results[0] as User | undefined;
  }

  async getUserKycDocuments(id: string): Promise<{
    kycIdFront: string | null;
    kycIdBack: string | null;
    kycSelfie: string | null;
    kycSignature: string | null;
    kycBusinessDocuments: string | null;
    kycTaxDocument: string | null;
    kycAddressDocument: string | null;
  } | undefined> {
    const results = await db.select({
      kycIdFront: schema.users.kycIdFront,
      kycIdBack: schema.users.kycIdBack,
      kycSelfie: schema.users.kycSelfie,
      kycSignature: schema.users.kycSignature,
      kycBusinessDocuments: schema.users.kycBusinessDocuments,
      kycTaxDocument: schema.users.kycTaxDocument,
      kycAddressDocument: schema.users.kycAddressDocument,
    }).from(schema.users).where(eq(schema.users.id, id)).limit(1);
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

  async submitKyc(userId: string, kycData: { kycIdFront: string; kycIdBack: string; kycSelfie: string; kycSignature: string; kycActivityDescription: string; kycLatitude: string; kycLongitude: string; kycAddress: string; kycAcceptedTerms: string; kycPhone?: string; kycWhatsapp?: string; kycActivityUrl?: string; kycUrlWebsite?: string; kycUrlInstagram?: string; kycUrlFacebook?: string; kycUrlTiktok?: string; kycUrlYoutube?: string; kycUrlWhatsappGroup?: string; kycUrlWhatsappChannel?: string; kycDocumentType?: string; kycDocumentNumber?: string; kycDocumentExpiryDate?: string }): Promise<User | undefined> {
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
        kycPhone: kycData.kycPhone || null,
        kycWhatsapp: kycData.kycWhatsapp || null,
        kycActivityUrl: kycData.kycActivityUrl || null,
        kycUrlWebsite: kycData.kycUrlWebsite || null,
        kycUrlInstagram: kycData.kycUrlInstagram || null,
        kycUrlFacebook: kycData.kycUrlFacebook || null,
        kycUrlTiktok: kycData.kycUrlTiktok || null,
        kycUrlYoutube: kycData.kycUrlYoutube || null,
        kycUrlWhatsappGroup: kycData.kycUrlWhatsappGroup || null,
        kycUrlWhatsappChannel: kycData.kycUrlWhatsappChannel || null,
        kycDocumentType: kycData.kycDocumentType || null,
        kycDocumentNumber: kycData.kycDocumentNumber || null,
        kycDocumentExpiryDate: kycData.kycDocumentExpiryDate || null,
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

    const results = await db
      .update(schema.users)
      .set({ 
        kycStatus: "rejected",
        kycRejectionReason: reason || null,
        kycRejectionCount: newRejectionCount,
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
        and(
          or(isNull(schema.users.accountType), ne(schema.users.accountType, "business")),
          or(
            eq(schema.users.kycStatus, "submitted"),
            eq(schema.users.kycStatus, "verified"),
            eq(schema.users.kycStatus, "rejected")
          )
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

  async resetUserSecurityCode(id: string): Promise<User | undefined> {
    const results = await db
      .update(schema.users)
      .set({ securityCode: null })
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

  async adminUpdateUserProfile(id: string, data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    country?: string;
    businessName?: string | null;
    businessRegistrationNumber?: string | null;
    businessCountry?: string | null;
    businessPhone?: string | null;
    businessEnterprisePhone?: string | null;
    businessEmail?: string | null;
  }): Promise<User | undefined> {
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) cleaned[k] = v;
    }
    if (Object.keys(cleaned).length === 0) {
      return await this.getUser(id);
    }
    const results = await db
      .update(schema.users)
      .set(cleaned)
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

  async updateMerchantLinkName(id: string, merchantName: string): Promise<MerchantLink | undefined> {
    const results = await db.update(schema.merchantLinks)
      .set({ merchantName })
      .where(eq(schema.merchantLinks.id, id))
      .returning();
    return results[0];
  }

  async updateMerchantLink(id: string, updates: { customerPaysFee?: boolean; customerPaysCryptoFee?: boolean; minAmount?: number | null; minAmountCurrency?: string }): Promise<MerchantLink | undefined> {
    const results = await db.update(schema.merchantLinks)
      .set(updates)
      .where(eq(schema.merchantLinks.id, id))
      .returning();
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
    const callbackSecret = `cs_${randomUUID().replace(/-/g, '')}`;
    const payoutCallbackSecret = `cs_${randomUUID().replace(/-/g, '')}`;
    const results = await db.insert(schema.apiKeys).values({ ...key, publicKey, privateKey, payinPrivateKey, callbackSecret, payoutCallbackSecret: payoutCallbackSecret as any }).returning();
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
    // Verify ownership before deleting
    const existing = await db.select({ id: schema.apiKeys.id })
      .from(schema.apiKeys)
      .where(and(eq(schema.apiKeys.id, id), eq(schema.apiKeys.userId, userId)))
      .limit(1);
    if (existing.length === 0) return false;

    // Transaction atomique pour respecter les contraintes FK dans le bon ordre
    await db.transaction(async (tx) => {
      // 1. Délier les boutiques qui référencent cette clé
      await tx.update(schema.shops)
        .set({ apiKeyId: null })
        .where(eq(schema.shops.apiKeyId, id));
      // 2. Supprimer les sessions de paiement dépendantes
      await tx.delete(schema.paymentSessions).where(eq(schema.paymentSessions.apiKeyId, id));
      // 3. Supprimer la clé
      await tx.delete(schema.apiKeys).where(eq(schema.apiKeys.id, id));
    });

    return true;
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
    
    // Generate secret if no secret exists yet (should not happen for new keys, but handle legacy)
    if (!existing[0].callbackSecret) {
      updateData.callbackSecret = `cs_${randomUUID().replace(/-/g, '')}`;
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

    // Generate payout secret if no secret exists yet (legacy keys)
    if (!(existing[0] as any).payoutCallbackSecret) {
      updateData.payoutCallbackSecret = `cs_${randomUUID().replace(/-/g, '')}`;
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

  async updatePayoutApiStatus(userId: string, enabled: boolean): Promise<User | undefined> {
    const results = await db
      .update(schema.users)
      .set({ payoutApiEnabled: enabled })
      .where(eq(schema.users.id, userId))
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

  async getTransactions(userId: string, limit?: number): Promise<Transaction[]> {
    const query = db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.userId, userId))
      .orderBy(desc(schema.transactions.createdAt));
    if (limit !== undefined) return query.limit(limit);
    return query;
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
    const fedapayIdStr = String(fedapayId);
    const results = await db
      .select()
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.status, "pending"),
          sql`(metadata::text LIKE ${'%"fedapayTransactionId":' + fedapayIdStr + '%'} OR metadata::text LIKE ${'%"fedapayPayoutId":' + fedapayIdStr + '%'})`
        )
      )
      .limit(1);
    
    if (results.length > 0) return results[0];

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

  async getTransactionByFeeXPayReference(reference: string): Promise<Transaction | undefined> {
    const recentTransactions = await db
      .select()
      .from(schema.transactions)
      .orderBy(desc(schema.transactions.createdAt))
      .limit(200);

    for (const tx of recentTransactions) {
      if (tx.metadata) {
        try {
          const metadata = JSON.parse(tx.metadata as string);
          if (metadata.feeXPayReference === reference) {
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
    // Auto-sync salary transaction if linked
    if (status === "completed" || status === "failed" || status === "rejected") {
      try {
        await this.updateSalaryTransactionByInternalId(id, status);
      } catch (_) {}
    }
    return results[0];
  }

  async updateTransaction(id: string, updates: Partial<Pick<Transaction, 'paydunyaToken' | 'country' | 'operator' | 'status' | 'metadata' | 'paydunyaReceiptUrl' | 'type' | 'description'>>): Promise<Transaction | undefined> {
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
    const txRow = await db
      .select()
      .from(schema.transactions)
      .where(and(
        eq(schema.transactions.id, id),
        eq(schema.transactions.status, "pending")
      ))
      .limit(1);

    if (txRow.length === 0) {
      return null;
    }

    const pendingTx = txRow[0];

    let customerPaysFee = false;
    let netAmountFromMetadata: number | null = null;
    let isBusiness = false;
    let businessCountry: string | null = null;
    let businessCurrency: string | null = null;
    let providerCurrencyFromMetadata: string | null = null;

    if (pendingTx.metadata) {
      try {
        const metadata = JSON.parse(pendingTx.metadata);
        customerPaysFee = metadata.customerPaysFee === true;
        if (typeof metadata.netAmountForUser === 'number') {
          netAmountFromMetadata = metadata.netAmountForUser;
        }
        if (metadata.providerCurrency) {
          providerCurrencyFromMetadata = metadata.providerCurrency;
        }
        if (metadata.scope === "business") {
          isBusiness = true;
          businessCountry = metadata.country || pendingTx.country;
          businessCurrency = metadata.balanceCurrency || metadata.providerCurrency || pendingTx.currency;
        }
      } catch (e) {}
    }

    let netAmount: number;
    if (netAmountFromMetadata !== null) {
      netAmount = netAmountFromMetadata;
    } else if (customerPaysFee) {
      netAmount = pendingTx.amount;
    } else {
      netAmount = pendingTx.amount - (pendingTx.fee || 0);
    }

    // ===== Currency Exchange Fee (personal accounts only) =====
    // If the payment currency differs from the user's balance currency,
    // deduct the exchange fee silently before crediting the balance.
    // IMPORTANT: Use providerCurrency from metadata (the payer's actual currency, e.g. XAF),
    // NOT pendingTx.currency which is stored in the owner's balance currency (e.g. XOF).
    // SKIP if netAmountFromMetadata is set: the exchange fee was already deducted at initiation.
    if (!isBusiness && netAmountFromMetadata === null) {
      try {
        const { COUNTRIES } = await import("@shared/schema");
        const userRows = await db.select({ country: schema.users.country }).from(schema.users).where(eq(schema.users.id, pendingTx.userId)).limit(1);
        const userCountry = userRows[0]?.country;
        const userCurrency = userCountry ? (COUNTRIES.find((c: any) => c.code === userCountry)?.currency || "XOF") : "XOF";
        const paymentCurrency = (providerCurrencyFromMetadata || pendingTx.currency || "").toUpperCase();

        if (paymentCurrency && paymentCurrency !== userCurrency) {
          const exchangeFeeRows = await db
            .select()
            .from(schema.currencyExchangeFees)
            .where(
              and(
                or(
                  and(
                    eq(schema.currencyExchangeFees.fromCurrency, paymentCurrency),
                    eq(schema.currencyExchangeFees.toCurrency, userCurrency),
                  ),
                  and(
                    eq(schema.currencyExchangeFees.fromCurrency, userCurrency),
                    eq(schema.currencyExchangeFees.toCurrency, paymentCurrency),
                  )
                ),
                eq(schema.currencyExchangeFees.isActive, 1)
              )
            )
            .limit(1);

          if (exchangeFeeRows.length > 0 && exchangeFeeRows[0].feePercentage > 0) {
            const exchangeFeeAmount = Math.floor((netAmount * exchangeFeeRows[0].feePercentage) / 1000);
            const netAfterExchange = netAmount - exchangeFeeAmount;
            console.log(`[Storage] Exchange fee applied: ${paymentCurrency}→${userCurrency} (${exchangeFeeRows[0].feePercentage / 10}%) = -${exchangeFeeAmount} ${userCurrency} | Net: ${netAmount} → ${netAfterExchange}`);
            netAmount = netAfterExchange;
          }
        }
      } catch (exchangeErr) {
        console.error(`[Storage] Exchange fee lookup failed for tx ${id}:`, exchangeErr);
        // Do not block finalization - proceed without exchange fee deduction
      }
    }

    const receiptUrl = extras?.paydunyaReceiptUrl ?? null;

    if (isBusiness) {
      if (!businessCountry || !businessCurrency) {
        console.error(`[Storage] CRITICAL: Business transaction ${id} missing wallet coordinates (country=${businessCountry}, currency=${businessCurrency}) - NOT crediting personal balance`);
        const result = await client.begin(async (tx) => {
          let updated: any[];
          if (receiptUrl) {
            updated = await tx`UPDATE transactions SET status = 'completed', paydunya_receipt_url = ${receiptUrl} WHERE id = ${id} AND status = 'pending' RETURNING *`;
          } else {
            updated = await tx`UPDATE transactions SET status = 'completed' WHERE id = ${id} AND status = 'pending' RETURNING *`;
          }
          return updated.length > 0 ? { transaction: updated[0] as unknown as Transaction, credited: false } : null;
        });
        return result;
      }

      const result = await client.begin(async (tx) => {
        let updated: any[];
        if (receiptUrl) {
          updated = await tx`UPDATE transactions SET status = 'completed', paydunya_receipt_url = ${receiptUrl} WHERE id = ${id} AND status = 'pending' RETURNING *`;
        } else {
          updated = await tx`UPDATE transactions SET status = 'completed' WHERE id = ${id} AND status = 'pending' RETURNING *`;
        }
        if (updated.length === 0) return null;

        await tx`
          INSERT INTO business_wallets (id, user_id, country, currency, balance, created_at)
          VALUES (gen_random_uuid(), ${pendingTx.userId}, ${businessCountry}, ${businessCurrency}, ${netAmount}, now())
          ON CONFLICT (user_id, country, currency)
          DO UPDATE SET balance = business_wallets.balance + ${netAmount}
        `;

        return { transaction: updated[0] as unknown as Transaction, credited: true };
      });

      if (result?.credited) {
        console.log(`[Storage] Finalized business transaction ${id}: credited ${netAmount} ${businessCurrency} to business wallet ${businessCountry} for user ${pendingTx.userId} (customerPaysFee: ${customerPaysFee})`);
      }
      return result;
    }

    const result = await client.begin(async (tx) => {
      let updated: any[];
      if (receiptUrl) {
        updated = await tx`UPDATE transactions SET status = 'completed', paydunya_receipt_url = ${receiptUrl} WHERE id = ${id} AND status = 'pending' RETURNING *`;
      } else {
        updated = await tx`UPDATE transactions SET status = 'completed' WHERE id = ${id} AND status = 'pending' RETURNING *`;
      }
      if (updated.length === 0) return null;

      const userUpdated = await tx`UPDATE users SET balance = balance + ${netAmount} WHERE id = ${pendingTx.userId} RETURNING id`;

      return {
        transaction: updated[0] as unknown as Transaction,
        credited: userUpdated.length > 0,
      };
    });

    if (result?.credited) {
      console.log(`[Storage] Finalized transaction ${id}: credited ${netAmount} to user ${pendingTx.userId} (customerPaysFee: ${customerPaysFee})`);
    }
    return result;
  }

  async atomicFailAndRefundBusinessWallet(transactionId: string, userId: string, country: string, currency: string, refundAmount: number, source: string): Promise<boolean> {
    const result = await client.begin(async (tx) => {
      const updated = await tx`
        UPDATE transactions
        SET status = 'failed',
            metadata = jsonb_set(
              jsonb_set(
                jsonb_set(
                  COALESCE(metadata::jsonb, '{}'::jsonb),
                  '{refunded}', 'true'::jsonb
                ),
                '{refundedAt}', to_jsonb(now()::text)
              ),
              '{refundedAmount}', to_jsonb(${refundAmount}::numeric)
            )::text
        WHERE id = ${transactionId}
          AND status = 'pending'
        RETURNING id
      `;

      if (updated.length === 0) {
        return false;
      }

      await tx`
        INSERT INTO business_wallets (id, user_id, country, currency, balance, created_at)
        VALUES (gen_random_uuid(), ${userId}, ${country}, ${currency}, ${refundAmount}, now())
        ON CONFLICT (user_id, country, currency)
        DO UPDATE SET balance = business_wallets.balance + ${refundAmount}
      `;

      return true;
    });

    if (result) {
      console.log(`[Storage] atomicFailAndRefundBusinessWallet: refunded ${refundAmount} ${currency} to business wallet ${country} for user ${userId} (tx: ${transactionId}, source: ${source})`);
    }
    return result;
  }

  async atomicFailAndRefundPayout(transactionId: string, userId: string, refundAmount: number): Promise<boolean> {
    const result = await client.begin(async (tx) => {
      const updated = await tx`
        UPDATE transactions
        SET status = 'failed',
            metadata = jsonb_set(
              jsonb_set(
                jsonb_set(
                  COALESCE(metadata::jsonb, '{}'::jsonb),
                  '{refunded}', 'true'::jsonb
                ),
                '{refundedAt}', to_jsonb(now()::text)
              ),
              '{refundedAmount}', to_jsonb(${refundAmount}::numeric)
            )::text
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
      totalBalance: Math.max(0, user?.balance || 0),
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
    const personalFilter = or(isNull(schema.users.accountType), eq(schema.users.accountType, "personal"));

    const [userCountsResult] = await db.select({
      total: sql<number>`COUNT(*)`,
      verified: sql<number>`COUNT(*) FILTER (WHERE ${schema.users.kycStatus} = 'verified')`,
    }).from(schema.users).where(personalFilter!);

    const totalUsers = Number(userCountsResult?.total || 0);
    const verifiedUsers = Number(userCountsResult?.verified || 0);

    const depositTypes = ["deposit", "payment_link", "merchant_link", "api_payment"];
    const withdrawalTypes = ["withdrawal", "transfer"];

    const depositResult = await db.select({
      currency: sql<string>`COALESCE(${schema.transactions.currency}, 'XOF')`,
      total: sql<number>`COALESCE(SUM(${schema.transactions.amount}), 0)`,
    }).from(schema.transactions)
      .innerJoin(schema.users, eq(schema.transactions.userId, schema.users.id))
      .where(and(
        personalFilter!,
        eq(schema.transactions.status, "completed"),
        inArray(schema.transactions.type, depositTypes)
      ))
      .groupBy(sql`COALESCE(${schema.transactions.currency}, 'XOF')`);

    const withdrawalResult = await db.select({
      currency: sql<string>`COALESCE(${schema.transactions.currency}, 'XOF')`,
      total: sql<number>`COALESCE(SUM(${schema.transactions.amount}), 0)`,
    }).from(schema.transactions)
      .innerJoin(schema.users, eq(schema.transactions.userId, schema.users.id))
      .where(and(
        personalFilter!,
        eq(schema.transactions.status, "completed"),
        inArray(schema.transactions.type, withdrawalTypes)
      ))
      .groupBy(sql`COALESCE(${schema.transactions.currency}, 'XOF')`);

    const depositsByCurrency = { XOF: 0, XAF: 0, CDF: 0, GNF: 0, GMD: 0, RWF: 0 };
    let totalDeposits = 0;
    for (const row of depositResult) {
      const currency = String(row.currency) as keyof typeof depositsByCurrency;
      const amount = Number(row.total || 0);
      if (currency in depositsByCurrency) {
        depositsByCurrency[currency] += amount;
      } else {
        depositsByCurrency.XOF += amount;
      }
      totalDeposits += amount;
    }

    const withdrawalsByCurrency = { XOF: 0, XAF: 0, CDF: 0, GNF: 0, GMD: 0, RWF: 0 };
    let totalWithdrawals = 0;
    for (const row of withdrawalResult) {
      const currency = String(row.currency) as keyof typeof withdrawalsByCurrency;
      const amount = Number(row.total || 0);
      if (currency in withdrawalsByCurrency) {
        withdrawalsByCurrency[currency] += amount;
      } else {
        withdrawalsByCurrency.XOF += amount;
      }
      totalWithdrawals += amount;
    }

    return {
      totalUsers,
      verifiedUsers,
      totalDeposits,
      totalWithdrawals,
      depositsByCurrency,
      withdrawalsByCurrency,
    };
  }

  async getBusinessAdminStats(): Promise<{
    totalUsers: number;
    verifiedUsers: number;
    totalDeposits: number;
    totalWithdrawals: number;
    depositsByCurrency: Record<string, number>;
    withdrawalsByCurrency: Record<string, number>;
  }> {
    const businessFilter = eq(schema.users.accountType, "business");

    const [userCountsResult] = await db.select({
      total: sql<number>`COUNT(*)`,
      verified: sql<number>`COUNT(*) FILTER (WHERE ${schema.users.kycStatus} = 'verified')`,
    }).from(schema.users).where(businessFilter);

    const totalUsers = Number(userCountsResult?.total || 0);
    const verifiedUsers = Number(userCountsResult?.verified || 0);

    const depositTypes = ["deposit", "payment_link", "merchant_link", "api_payment"];
    const withdrawalTypes = ["withdrawal", "transfer", "payout"];

    const depositResult = await db.select({
      currency: sql<string>`COALESCE(${schema.transactions.currency}, 'XOF')`,
      total: sql<number>`COALESCE(SUM(${schema.transactions.amount}), 0)`,
    }).from(schema.transactions)
      .innerJoin(schema.users, eq(schema.transactions.userId, schema.users.id))
      .where(and(
        businessFilter,
        eq(schema.transactions.status, "completed"),
        inArray(schema.transactions.type, depositTypes)
      ))
      .groupBy(sql`COALESCE(${schema.transactions.currency}, 'XOF')`);

    const withdrawalResult = await db.select({
      currency: sql<string>`COALESCE(${schema.transactions.currency}, 'XOF')`,
      total: sql<number>`COALESCE(SUM(${schema.transactions.amount}), 0)`,
    }).from(schema.transactions)
      .innerJoin(schema.users, eq(schema.transactions.userId, schema.users.id))
      .where(and(
        businessFilter,
        eq(schema.transactions.status, "completed"),
        inArray(schema.transactions.type, withdrawalTypes)
      ))
      .groupBy(sql`COALESCE(${schema.transactions.currency}, 'XOF')`);

    const depositsByCurrency: Record<string, number> = {};
    let totalDeposits = 0;
    for (const row of depositResult) {
      const currency = String(row.currency);
      const amount = Number(row.total || 0);
      depositsByCurrency[currency] = amount;
      totalDeposits += amount;
    }

    const withdrawalsByCurrency: Record<string, number> = {};
    let totalWithdrawals = 0;
    for (const row of withdrawalResult) {
      const currency = String(row.currency);
      const amount = Number(row.total || 0);
      withdrawalsByCurrency[currency] = amount;
      totalWithdrawals += amount;
    }

    return {
      totalUsers,
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
      depositOverrideEnabled: schema.users.depositOverrideEnabled,
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
    }).from(schema.users)
      .where(or(isNull(schema.users.accountType), ne(schema.users.accountType, "business")))
      .orderBy(desc(schema.users.balance));
  }

  async getAllUsersForBroadcast(): Promise<User[]> {
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
      depositOverrideEnabled: schema.users.depositOverrideEnabled,
      createdAt: schema.users.createdAt,
      country: schema.users.country,
      withdrawalPhones: schema.users.withdrawalPhones,
      securityCode: schema.users.securityCode,
      accountType: schema.users.accountType,
      kycIdFront: sql<string | null>`NULL`.as('kycIdFront'),
      kycIdBack: sql<string | null>`NULL`.as('kycIdBack'),
      kycSelfie: sql<string | null>`NULL`.as('kycSelfie'),
      kycSignature: sql<string | null>`NULL`.as('kycSignature'),
      kycActivityDescription: sql<string | null>`NULL`.as('kycActivityDescription'),
      kycLatitude: sql<string | null>`NULL`.as('kycLatitude'),
      kycLongitude: sql<string | null>`NULL`.as('kycLongitude'),
      kycAddress: sql<string | null>`NULL`.as('kycAddress'),
      kycAcceptedTerms: sql<string | null>`NULL`.as('kycAcceptedTerms'),
    }).from(schema.users)
      .orderBy(desc(schema.users.balance));
  }

  async getAllUsersWithKyc(): Promise<User[]> {
    return db.select().from(schema.users)
      .where(or(isNull(schema.users.accountType), ne(schema.users.accountType, "business")))
      .orderBy(desc(schema.users.balance));
  }

  async searchUsers(query: string): Promise<User[]> {
    const like = `%${query}%`;

    const [byUserInfo, txRows, plRows, mlRows, akRows] = await Promise.all([
      db.select().from(schema.users).where(
        or(
          sql`LOWER(${schema.users.email}) LIKE LOWER(${like})`,
          sql`LOWER(${schema.users.firstName}) LIKE LOWER(${like})`,
          sql`LOWER(${schema.users.lastName}) LIKE LOWER(${like})`
        )
      ),
      db.select({ userId: schema.transactions.userId }).from(schema.transactions).where(
        or(
          sql`LOWER(${schema.transactions.id}) LIKE LOWER(${like})`,
          sql`LOWER(${schema.transactions.paydunyaToken}) LIKE LOWER(${like})`,
          sql`LOWER(${schema.transactions.customerPhone}) LIKE LOWER(${like})`,
          sql`LOWER(${schema.transactions.customerName}) LIKE LOWER(${like})`,
          sql`LOWER(${schema.transactions.customerEmail}) LIKE LOWER(${like})`,
          sql`LOWER(${schema.transactions.metadata}) LIKE LOWER(${like})`
        )
      ),
      db.select({ userId: schema.paymentLinks.userId }).from(schema.paymentLinks).where(
        sql`LOWER(${schema.paymentLinks.token}) LIKE LOWER(${like})`
      ),
      db.select({ userId: schema.merchantLinks.userId }).from(schema.merchantLinks).where(
        sql`LOWER(${schema.merchantLinks.token}) LIKE LOWER(${like})`
      ),
      db.select({ userId: schema.apiKeys.userId }).from(schema.apiKeys).where(
        or(
          sql`LOWER(${schema.apiKeys.publicKey}) LIKE LOWER(${like})`,
          sql`LOWER(${schema.apiKeys.privateKey}) LIKE LOWER(${like})`
        )
      ),
    ]);

    const extraIds = new Set<string>([
      ...txRows.map(r => r.userId),
      ...plRows.map(r => r.userId),
      ...mlRows.map(r => r.userId),
      ...akRows.map(r => r.userId),
    ]);

    let byIds: User[] = [];
    if (extraIds.size > 0) {
      byIds = await db.select().from(schema.users).where(
        inArray(schema.users.id, Array.from(extraIds))
      );
    }

    const resultMap = new Map<string, User>();
    byUserInfo.forEach(u => resultMap.set(u.id, u));
    byIds.forEach(u => resultMap.set(u.id, u));
    return Array.from(resultMap.values());
  }

  async searchBusinessUsers(query: string): Promise<User[]> {
    const like = `%${query}%`;

    const [byUserInfo, txRows, plRows, mlRows, akRows] = await Promise.all([
      db.select().from(schema.users).where(
        and(
          eq(schema.users.accountType, "business"),
          or(
            sql`LOWER(${schema.users.email}) LIKE LOWER(${like})`,
            sql`LOWER(${schema.users.firstName}) LIKE LOWER(${like})`,
            sql`LOWER(${schema.users.lastName}) LIKE LOWER(${like})`,
            sql`LOWER(${schema.users.businessName}) LIKE LOWER(${like})`
          )
        )
      ),
      db.select({ userId: schema.transactions.userId }).from(schema.transactions).where(
        or(
          sql`LOWER(${schema.transactions.id}) LIKE LOWER(${like})`,
          sql`LOWER(${schema.transactions.paydunyaToken}) LIKE LOWER(${like})`,
          sql`LOWER(${schema.transactions.customerPhone}) LIKE LOWER(${like})`,
          sql`LOWER(${schema.transactions.customerName}) LIKE LOWER(${like})`,
          sql`LOWER(${schema.transactions.customerEmail}) LIKE LOWER(${like})`,
          sql`LOWER(${schema.transactions.metadata}) LIKE LOWER(${like})`
        )
      ),
      db.select({ userId: schema.paymentLinks.userId }).from(schema.paymentLinks).where(
        sql`LOWER(${schema.paymentLinks.token}) LIKE LOWER(${like})`
      ),
      db.select({ userId: schema.merchantLinks.userId }).from(schema.merchantLinks).where(
        sql`LOWER(${schema.merchantLinks.token}) LIKE LOWER(${like})`
      ),
      db.select({ userId: schema.apiKeys.userId }).from(schema.apiKeys).where(
        or(
          sql`LOWER(${schema.apiKeys.publicKey}) LIKE LOWER(${like})`,
          sql`LOWER(${schema.apiKeys.privateKey}) LIKE LOWER(${like})`
        )
      ),
    ]);

    const extraIds = new Set<string>([
      ...txRows.map(r => r.userId),
      ...plRows.map(r => r.userId),
      ...mlRows.map(r => r.userId),
      ...akRows.map(r => r.userId),
    ]);

    let byIds: User[] = [];
    if (extraIds.size > 0) {
      byIds = await db.select().from(schema.users).where(
        and(
          eq(schema.users.accountType, "business"),
          inArray(schema.users.id, Array.from(extraIds))
        )
      );
    }

    const resultMap = new Map<string, User>();
    byUserInfo.forEach(u => resultMap.set(u.id, u));
    byIds.forEach(u => resultMap.set(u.id, u));
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
    await db.delete(schema.paymentSessions).where(eq(schema.paymentSessions.userId, userId));
    await db.delete(schema.settlements).where(eq(schema.settlements.userId, userId));
    await db.delete(schema.businessWallets).where(eq(schema.businessWallets.userId, userId));
    await db.delete(schema.businessTokens).where(eq(schema.businessTokens.userId, userId));
    await db.delete(schema.transactions).where(eq(schema.transactions.userId, userId));
    await db.delete(schema.paymentLinks).where(eq(schema.paymentLinks.userId, userId));
    await db.delete(schema.merchantLinks).where(eq(schema.merchantLinks.userId, userId));
    await db.delete(schema.apiKeys).where(eq(schema.apiKeys.userId, userId));
    await db.delete(schema.feeConfigs).where(eq(schema.feeConfigs.userId, userId));
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

      // Initialize FeeXPay
      const { FEEXPAY_COUNTRIES } = await import("@shared/feexpay-countries");
      for (const country of FEEXPAY_COUNTRIES) {
        for (const operator of country.operators) {
          await insertIfNotExists("feexpay", country.code, operator.code);
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

      // Initialize FeeXPay countries
      const { FEEXPAY_COUNTRIES } = await import("@shared/feexpay-countries");
      for (const country of FEEXPAY_COUNTRIES) {
        await insertIfNotExists("feexpay", country.code);
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
    const providers = ["afribapay", "paydunya", "fedapay", "mbiyopay", "moneyfusion", "nowpayments", "pawapay", "exchangerate", "mailtrap", "feexpay"];
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

  // Business Tokens
  async createBusinessToken(data: { userId: string; token: string; name: string }): Promise<schema.BusinessToken> {
    const [token] = await db.insert(schema.businessTokens).values({
      userId: data.userId,
      token: data.token,
      name: data.name,
      callbackSecret: `bks_${randomUUID().replace(/-/g, '')}`,
      payoutCallbackSecret: `bkps_${randomUUID().replace(/-/g, '')}`,
    }).returning();
    return token;
  }

  async getBusinessTokenByToken(tokenStr: string): Promise<schema.BusinessToken | undefined> {
    const [token] = await db.select().from(schema.businessTokens).where(eq(schema.businessTokens.token, tokenStr));
    return token;
  }

  async getBusinessTokenById(id: string): Promise<schema.BusinessToken | undefined> {
    const [token] = await db.select().from(schema.businessTokens).where(eq(schema.businessTokens.id, id));
    return token;
  }

  async getBusinessTokensByUserId(userId: string): Promise<schema.BusinessToken[]> {
    return db.select().from(schema.businessTokens).where(eq(schema.businessTokens.userId, userId));
  }

  async updateBusinessToken(id: string, userId: string, updates: Partial<Pick<schema.BusinessToken, 'name' | 'callbackUrl' | 'payoutCallbackUrl' | 'callbackSecret' | 'payoutCallbackSecret' | 'isActive' | 'allowedCountries' | 'customerPaysFee'>>): Promise<schema.BusinessToken | undefined> {
    const [token] = await db.update(schema.businessTokens)
      .set(updates)
      .where(and(eq(schema.businessTokens.id, id), eq(schema.businessTokens.userId, userId)))
      .returning();
    return token;
  }

  async deleteBusinessToken(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(schema.businessTokens)
      .where(and(eq(schema.businessTokens.id, id), eq(schema.businessTokens.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async regenerateBusinessToken(id: string, userId: string): Promise<schema.BusinessToken | undefined> {
    const newToken = `bt_live_${randomUUID().replace(/-/g, '')}`;
    const [token] = await db.update(schema.businessTokens)
      .set({ token: newToken })
      .where(and(eq(schema.businessTokens.id, id), eq(schema.businessTokens.userId, userId)))
      .returning();
    return token;
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
    return db.select().from(schema.transactions)
      .where(sql`metadata::text LIKE ${'%"paymentId":"' + paymentId + '"%'} OR metadata::text LIKE ${'%"paymentId":' + paymentId + '%'}`);
  }

  async getTransactionsByMetadataPayoutId(payoutId: string): Promise<Transaction[]> {
    return db.select().from(schema.transactions)
      .where(sql`metadata::text LIKE ${'%"payoutId":"' + payoutId + '"%'} OR metadata::text LIKE ${'%"payoutId":' + payoutId + '%'} OR metadata::text LIKE ${'%"payoutWithdrawalId":"' + payoutId + '"%'} OR metadata::text LIKE ${'%"payoutWithdrawalId":' + payoutId + '%'}`);
  }

  async getTransactionsByMetadata(key: string, value: string): Promise<Transaction[]> {
    return db.select().from(schema.transactions)
      .where(sql`metadata::text LIKE ${'%"' + key + '":"' + value + '"%'} OR metadata::text LIKE ${'%"' + key + '":' + value + '%'}`);
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
        eq(schema.feeConfigs.provider, provider.toLowerCase()),
        eq(schema.feeConfigs.country, country.toUpperCase()),
        eq(schema.feeConfigs.operator, operator.toLowerCase()),
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
    const provider = (config.provider || "default").toLowerCase();
    const country = config.country.toUpperCase();
    const operator = config.operator.toLowerCase();
    const scope = config.scope || "personal";
    const existing = await this.getFeeConfig(provider, country, operator, scope);
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
          eq(schema.feeConfigs.country, country),
          eq(schema.feeConfigs.operator, operator),
          eq(schema.feeConfigs.scope, scope)
        ))
        .returning();
      return results[0];
    }
    const results = await db.insert(schema.feeConfigs).values({ ...config, provider, country, operator, scope }).returning();
    return results[0];
  }

  async updateFeeConfig(provider: string, country: string, operator: string, updates: { incomingFeePercentage?: number; outgoingFeePercentage?: number }, scope: string = "personal"): Promise<FeeConfig | undefined> {
    const results = await db
      .update(schema.feeConfigs)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(schema.feeConfigs.provider, provider.toLowerCase()),
        eq(schema.feeConfigs.country, country.toUpperCase()),
        eq(schema.feeConfigs.operator, operator.toLowerCase()),
        eq(schema.feeConfigs.scope, scope)
      ))
      .returning();
    return results[0];
  }

  async getUserFeeConfigs(userId: string): Promise<FeeConfig[]> {
    return db.select().from(schema.feeConfigs).where(eq(schema.feeConfigs.userId, userId));
  }

  async getUserFeeConfig(userId: string, provider: string, country: string, operator: string): Promise<FeeConfig | undefined> {
    const p = provider.toLowerCase();
    const c = country.toUpperCase();
    const o = operator.toLowerCase();
    const results = await db.select().from(schema.feeConfigs).where(and(
      eq(schema.feeConfigs.userId, userId),
      eq(schema.feeConfigs.provider, p),
      eq(schema.feeConfigs.country, c),
      eq(schema.feeConfigs.operator, o),
    )).limit(1);
    return results[0];
  }

  async upsertUserFeeConfig(userId: string, provider: string, country: string, operator: string, incomingFeePercentage: number, outgoingFeePercentage: number): Promise<FeeConfig> {
    const p = provider.toLowerCase();
    const c = country.toUpperCase();
    const o = operator.toLowerCase();
    const existing = await this.getUserFeeConfig(userId, p, c, o);
    if (existing) {
      const results = await db.update(schema.feeConfigs)
        .set({ incomingFeePercentage, outgoingFeePercentage, updatedAt: new Date() })
        .where(and(
          eq(schema.feeConfigs.userId, userId),
          eq(schema.feeConfigs.provider, p),
          eq(schema.feeConfigs.country, c),
          eq(schema.feeConfigs.operator, o),
        ))
        .returning();
      return results[0];
    }
    const results = await db.insert(schema.feeConfigs).values({
      userId, provider: p, country: c, operator: o, incomingFeePercentage, outgoingFeePercentage, scope: "business",
    }).returning();
    return results[0];
  }

  async deleteUserFeeConfig(userId: string, provider: string, country: string, operator: string): Promise<void> {
    await db.delete(schema.feeConfigs).where(and(
      eq(schema.feeConfigs.userId, userId),
      eq(schema.feeConfigs.provider, provider.toLowerCase()),
      eq(schema.feeConfigs.country, country.toUpperCase()),
      eq(schema.feeConfigs.operator, operator.toLowerCase()),
    ));
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

  async ensureFeeXPayFeeConfigs(): Promise<void> {
    const { FEEXPAY_COUNTRIES } = await import("@shared/feexpay-countries");
    const scopes = ["personal", "business"];
    for (const scope of scopes) {
      const existing = await this.getFeeConfigsByProvider("feexpay", scope);
      const existingSet = new Set(existing.map(c => `${c.country}-${c.operator}`));

      const toInsert: InsertFeeConfig[] = [];
      for (const country of FEEXPAY_COUNTRIES) {
        for (const op of country.operators) {
          const key = `${country.code}-${op.code}`;
          if (existingSet.has(key)) continue;
          toInsert.push({
            provider: "feexpay",
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
        console.log(`[FeeConfigs] Added ${toInsert.length} FeeXPay fee configurations for scope ${scope} (default 6%)`);
      }
    }
  }

  async ensureMoneyFusionFeeConfigs(): Promise<void> {
    const { MONEYFUSION_COUNTRIES } = await import("@shared/moneyfusion-countries");
    const scopes = ["personal", "business"];
    for (const scope of scopes) {
      const existing = await this.getFeeConfigsByProvider("moneyfusion", scope);
      const existingSet = new Set(existing.map(c => `${c.country}-${c.operator}`));

      const toInsert: InsertFeeConfig[] = [];
      for (const country of MONEYFUSION_COUNTRIES) {
        for (const op of country.operators) {
          const key = `${country.code}-${op.code}`;
          if (existingSet.has(key)) continue;
          toInsert.push({
            provider: "moneyfusion",
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
        console.log(`[FeeConfigs] Added ${toInsert.length} MoneyFusion fee configurations for scope ${scope} (default 6%)`);
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
      depositOverrideEnabled: schema.users.depositOverrideEnabled,
      createdAt: schema.users.createdAt,
      country: schema.users.country,
      withdrawalPhones: schema.users.withdrawalPhones,
      securityCode: schema.users.securityCode,
      accountType: schema.users.accountType,
      businessName: schema.users.businessName,
      bankAccountHolder: schema.users.bankAccountHolder,
      bankAccountNumber: schema.users.bankAccountNumber,
      bankName: schema.users.bankName,
      bankSwiftBic: schema.users.bankSwiftBic,
      bankBranchName: schema.users.bankBranchName,
      bankBranchSortCode: schema.users.bankBranchSortCode,
      bankBranchAddress: schema.users.bankBranchAddress,
      bankCountry: schema.users.bankCountry,
      bankCurrency: schema.users.bankCurrency,
      momoCountry: schema.users.momoCountry,
      momoOperator: schema.users.momoOperator,
      momoPhone: schema.users.momoPhone,
      kycIdFront: sql<string | null>`NULL`.as('kycIdFront'),
      kycIdBack: sql<string | null>`NULL`.as('kycIdBack'),
      kycSelfie: sql<string | null>`NULL`.as('kycSelfie'),
      kycSignature: sql<string | null>`NULL`.as('kycSignature'),
      kycActivityDescription: sql<string | null>`NULL`.as('kycActivityDescription'),
      kycLatitude: sql<string | null>`NULL`.as('kycLatitude'),
      kycLongitude: sql<string | null>`NULL`.as('kycLongitude'),
      kycAddress: sql<string | null>`NULL`.as('kycAddress'),
      kycAcceptedTerms: sql<string | null>`NULL`.as('kycAcceptedTerms'),
    }).from(schema.users)
      .where(eq(schema.users.accountType, "business"))
      .orderBy(desc(schema.users.createdAt));
  }

  // ===== Currency Exchange Fees =====
  async getAllCurrencyExchangeFees(): Promise<schema.CurrencyExchangeFee[]> {
    return db.select().from(schema.currencyExchangeFees).orderBy(
      schema.currencyExchangeFees.fromCurrency,
      schema.currencyExchangeFees.toCurrency
    );
  }

  async getCurrencyExchangeFee(fromCurrency: string, toCurrency: string): Promise<schema.CurrencyExchangeFee | undefined> {
    const results = await db.select().from(schema.currencyExchangeFees).where(
      and(
        eq(schema.currencyExchangeFees.fromCurrency, fromCurrency),
        eq(schema.currencyExchangeFees.toCurrency, toCurrency)
      )
    );
    return results[0];
  }

  async upsertCurrencyExchangeFee(fromCurrency: string, toCurrency: string, feePercentage: number, isActive: number = 1): Promise<schema.CurrencyExchangeFee> {
    const existing = await this.getCurrencyExchangeFee(fromCurrency, toCurrency);
    if (existing) {
      const updated = await db
        .update(schema.currencyExchangeFees)
        .set({ feePercentage, isActive, updatedAt: new Date() })
        .where(
          and(
            eq(schema.currencyExchangeFees.fromCurrency, fromCurrency),
            eq(schema.currencyExchangeFees.toCurrency, toCurrency)
          )
        )
        .returning();
      return updated[0];
    } else {
      const created = await db
        .insert(schema.currencyExchangeFees)
        .values({ fromCurrency, toCurrency, feePercentage, isActive })
        .returning();
      return created[0];
    }
  }

  async initializeCurrencyExchangeFees(): Promise<void> {
    const { CURRENCY_EXCHANGE_PAIRS } = await import("@shared/schema");
    for (const pair of CURRENCY_EXCHANGE_PAIRS) {
      const existing = await this.getCurrencyExchangeFee(pair.from, pair.to);
      if (!existing) {
        await db.insert(schema.currencyExchangeFees).values({
          fromCurrency: pair.from,
          toCurrency: pair.to,
          feePercentage: 0,
          isActive: 1,
        });
      }
    }
  }

  // ===== Salary =====
  async getSalaryAccount(userId: string): Promise<schema.SalaryAccount | undefined> {
    const results = await db.select().from(schema.salaryAccounts).where(eq(schema.salaryAccounts.userId, userId));
    return results[0];
  }

  async createSalaryAccount(userId: string, currency: string, label?: string): Promise<schema.SalaryAccount> {
    const existing = await this.getSalaryAccount(userId);
    if (existing) {
      const updated = await db.update(schema.salaryAccounts)
        .set({ isActive: true, currency, ...(label !== undefined ? { label } : {}) })
        .where(eq(schema.salaryAccounts.userId, userId))
        .returning();
      return updated[0];
    }
    const created = await db.insert(schema.salaryAccounts)
      .values({ userId, currency, balance: 0, isActive: true, ...(label ? { label } : {}) })
      .returning();
    return created[0];
  }

  async updateSalaryAccount(userId: string, updates: Partial<Pick<schema.SalaryAccount, 'isActive' | 'label' | 'currency'>>): Promise<schema.SalaryAccount | undefined> {
    const updated = await db.update(schema.salaryAccounts)
      .set(updates)
      .where(eq(schema.salaryAccounts.userId, userId))
      .returning();
    return updated[0];
  }

  async creditSalaryBalance(userId: string, amount: number): Promise<schema.SalaryAccount | undefined> {
    const updated = await db.update(schema.salaryAccounts)
      .set({ balance: sql`${schema.salaryAccounts.balance} + ${amount}` })
      .where(eq(schema.salaryAccounts.userId, userId))
      .returning();
    return updated[0];
  }

  async debitSalaryBalance(userId: string, amount: number): Promise<schema.SalaryAccount | undefined> {
    const updated = await db.update(schema.salaryAccounts)
      .set({ balance: sql`GREATEST(${schema.salaryAccounts.balance} - ${amount}, 0)` })
      .where(eq(schema.salaryAccounts.userId, userId))
      .returning();
    return updated[0];
  }

  async getSalarySchedules(userId: string): Promise<schema.SalarySchedule[]> {
    return db.select().from(schema.salarySchedules)
      .where(eq(schema.salarySchedules.userId, userId))
      .orderBy(desc(schema.salarySchedules.createdAt));
  }

  async createSalarySchedule(data: schema.InsertSalarySchedule): Promise<schema.SalarySchedule> {
    const created = await db.insert(schema.salarySchedules).values(data).returning();
    return created[0];
  }

  async updateSalarySchedule(id: string, updates: Partial<schema.InsertSalarySchedule> & { nextPayAt?: Date | null; lastPaidAt?: Date | null }): Promise<schema.SalarySchedule | undefined> {
    const updated = await db.update(schema.salarySchedules)
      .set(updates as any)
      .where(eq(schema.salarySchedules.id, id))
      .returning();
    return updated[0];
  }

  async deleteSalarySchedule(id: string): Promise<boolean> {
    const deleted = await db.delete(schema.salarySchedules).where(eq(schema.salarySchedules.id, id)).returning();
    return deleted.length > 0;
  }

  async deleteSalaryAccountCompletely(userId: string): Promise<void> {
    await db.delete(schema.salaryTransactions).where(eq(schema.salaryTransactions.userId, userId));
    await db.delete(schema.salarySchedules).where(eq(schema.salarySchedules.userId, userId));
    await db.delete(schema.salaryAccounts).where(eq(schema.salaryAccounts.userId, userId));
  }

  async getAllActiveSalarySchedulesDue(): Promise<(schema.SalarySchedule & { user?: User })[]> {
    const now = new Date();
    const schedules = await db.select().from(schema.salarySchedules)
      .where(and(
        eq(schema.salarySchedules.isActive, true),
        isNotNull(schema.salarySchedules.nextPayAt),
        lte(schema.salarySchedules.nextPayAt, now)
      ));
    const result: (schema.SalarySchedule & { user?: User })[] = [];
    for (const s of schedules) {
      const user = await this.getUser(s.userId);
      result.push({ ...s, user });
    }
    return result;
  }

  async createSalaryTransaction(data: schema.InsertSalaryTransaction): Promise<schema.SalaryTransaction> {
    const created = await db.insert(schema.salaryTransactions).values(data).returning();
    return created[0];
  }

  async getSalaryTransactions(userId: string, limit: number = 50): Promise<schema.SalaryTransaction[]> {
    return db.select().from(schema.salaryTransactions)
      .where(eq(schema.salaryTransactions.userId, userId))
      .orderBy(desc(schema.salaryTransactions.createdAt))
      .limit(limit);
  }

  async updateSalaryTransactionByInternalId(internalTransactionId: string, status: string): Promise<void> {
    const finalStatus = status === "completed" ? "completed" : "rejected";
    // Atomic conditional update: only transition from 'pending'. Returns rows updated.
    const updated = await db.update(schema.salaryTransactions)
      .set({ status: finalStatus })
      .where(and(
        eq(schema.salaryTransactions.internalTransactionId, internalTransactionId),
        eq(schema.salaryTransactions.status, "pending")
      ))
      .returning();
    if (!updated.length) return; // déjà transitionné — ne pas re-rembourser
    const salaryTx = updated[0];
    if (finalStatus === "rejected") {
      await db.update(schema.salaryAccounts)
        .set({ balance: sql`${schema.salaryAccounts.balance} + ${salaryTx.amount}` })
        .where(eq(schema.salaryAccounts.userId, salaryTx.userId));
    }
  }

  async getAllSalaryAccountsForAdmin(): Promise<(schema.SalaryAccount & { user?: User })[]> {
    const accounts = await db.select().from(schema.salaryAccounts)
      .where(eq(schema.salaryAccounts.isActive, true))
      .orderBy(desc(schema.salaryAccounts.createdAt));
    const result: (schema.SalaryAccount & { user?: User })[] = [];
    for (const acc of accounts) {
      const user = await this.getUser(acc.userId);
      result.push({ ...acc, user });
    }
    return result;
  }

  async updateUserSalaryFlag(userId: string, isSalary: boolean): Promise<void> {
    await db.update(schema.users)
      .set({ isSalary })
      .where(eq(schema.users.id, userId));
  }

  // ─── SHOPS ──────────────────────────────────────────────────────────────────

  async getShopById(id: string): Promise<schema.Shop | undefined> {
    const rows = await db.select().from(schema.shops).where(eq(schema.shops.id, id)).limit(1);
    return rows[0];
  }

  async getShopByUserId(userId: string): Promise<schema.Shop | undefined> {
    const rows = await db.select().from(schema.shops).where(eq(schema.shops.userId, userId)).limit(1);
    return rows[0];
  }

  async getShopBySlug(slug: string): Promise<schema.Shop | undefined> {
    const rows = await db.select().from(schema.shops).where(eq(schema.shops.slug, slug)).limit(1);
    return rows[0];
  }

  async getShopByCustomDomain(domain: string): Promise<schema.Shop | undefined> {
    const rows = await db.select().from(schema.shops)
      .where(eq(schema.shops.customDomain, domain.toLowerCase()))
      .limit(1);
    return rows[0];
  }

  async createShop(data: schema.InsertShop): Promise<schema.Shop> {
    const rows = await db.insert(schema.shops).values(data).returning();
    return rows[0];
  }

  async updateShop(id: string, updates: Partial<schema.InsertShop>): Promise<schema.Shop | undefined> {
    const rows = await db.update(schema.shops)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.shops.id, id))
      .returning();
    return rows[0];
  }

  async deleteShop(id: string): Promise<void> {
    await db.delete(schema.shops).where(eq(schema.shops.id, id));
  }

  async getShopCategories(shopId: string): Promise<schema.ShopCategory[]> {
    return db.select().from(schema.shopCategories)
      .where(eq(schema.shopCategories.shopId, shopId))
      .orderBy(schema.shopCategories.sortOrder);
  }

  async createShopCategory(data: schema.InsertShopCategory): Promise<schema.ShopCategory> {
    const rows = await db.insert(schema.shopCategories).values(data).returning();
    return rows[0];
  }

  async updateShopCategory(id: string, updates: Partial<schema.InsertShopCategory>): Promise<schema.ShopCategory | undefined> {
    const rows = await db.update(schema.shopCategories)
      .set(updates)
      .where(eq(schema.shopCategories.id, id))
      .returning();
    return rows[0];
  }

  async deleteShopCategory(id: string): Promise<void> {
    await db.delete(schema.shopCategories).where(eq(schema.shopCategories.id, id));
  }

  async getShopProducts(shopId: string): Promise<schema.ShopProduct[]> {
    return db.select().from(schema.shopProducts)
      .where(eq(schema.shopProducts.shopId, shopId))
      .orderBy(schema.shopProducts.sortOrder, desc(schema.shopProducts.createdAt));
  }

  async getShopProduct(id: string): Promise<schema.ShopProduct | undefined> {
    const rows = await db.select().from(schema.shopProducts).where(eq(schema.shopProducts.id, id)).limit(1);
    return rows[0];
  }

  async createShopProduct(data: schema.InsertShopProduct): Promise<schema.ShopProduct> {
    const rows = await db.insert(schema.shopProducts).values(data).returning();
    return rows[0];
  }

  async updateShopProduct(id: string, updates: Partial<schema.InsertShopProduct>): Promise<schema.ShopProduct | undefined> {
    const rows = await db.update(schema.shopProducts)
      .set(updates)
      .where(eq(schema.shopProducts.id, id))
      .returning();
    return rows[0];
  }

  async deleteShopProduct(id: string): Promise<void> {
    await db.delete(schema.shopProducts).where(eq(schema.shopProducts.id, id));
  }

  async getShopOrders(shopId: string): Promise<schema.ShopOrder[]> {
    return db.select().from(schema.shopOrders)
      .where(eq(schema.shopOrders.shopId, shopId))
      .orderBy(desc(schema.shopOrders.createdAt));
  }

  async getShopOrder(id: string): Promise<schema.ShopOrder | undefined> {
    const rows = await db.select().from(schema.shopOrders).where(eq(schema.shopOrders.id, id)).limit(1);
    return rows[0];
  }

  async createShopOrder(data: schema.InsertShopOrder): Promise<schema.ShopOrder> {
    const rows = await db.insert(schema.shopOrders).values(data).returning();
    return rows[0];
  }

  async updateShopOrder(id: string, updates: Partial<schema.InsertShopOrder>): Promise<schema.ShopOrder | undefined> {
    const rows = await db.update(schema.shopOrders)
      .set(updates)
      .where(eq(schema.shopOrders.id, id))
      .returning();
    return rows[0];
  }

  async expireOldShopOrders(): Promise<number> {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000);
    const rows = await db.update(schema.shopOrders)
      .set({ status: "cancelled" })
      .where(and(
        eq(schema.shopOrders.status, "pending"),
        lte(schema.shopOrders.createdAt, cutoff)
      ))
      .returning();
    return rows.length;
  }
}

export const storage = new DbStorage();
