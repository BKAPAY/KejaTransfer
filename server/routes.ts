import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { registerOgRoutes } from "./og-middleware";
import { storage } from "./storage";
import session from "express-session";
import connectPg from "connect-pg-simple";
import pg from "pg";
import bcrypt from "bcrypt";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { insertUserSchema, insertPaymentLinkSchema, insertMerchantLinkSchema, insertApiKeySchema } from "@shared/schema";
import { validatePhoneOperator } from "@shared/phone-utils";
import { randomUUID } from "crypto";
import { calculateIncomingFee, calculateOutgoingFee, calculateOutgoingFeeFromNet, calculateCustomerPaysFee, getFeeFromDatabase, getDynamicFees, getDynamicOutgoingFees, getActiveProviderForCountry, getActivePayoutProviderForCountry, getIncomingExchangeFee, getOutgoingExchangeFee } from "./utils/fees";
import { trySendPaymentCallback } from "./utils/callback";
import { recordLoginLog } from "./utils/login-tracker";
import { 
  SOFTPAY_OPERATORS, 
  getOperatorKey, 
  requiresOTP, 
  requiresTwoStep, 
  getUSSDInstruction,
  type SoftpayPaymentData 
} from "./paydunya-softpay";
import {
  handleFedaPayDeposit,
  handleFedaPayWithdrawal,
  handleFedaPayTransfer,
  handlePaymentLinkPayment,
  handleMerchantLinkPayment,
  handleApiPayment,
  handleFedaPayWebhook,
} from "./fedapay-routes";
import {
  FEDAPAY_SUPPORTED_COUNTRIES_COLLECT,
  FEDAPAY_SUPPORTED_COUNTRIES_PAYOUT,
  getCollectOperatorsForCountry,
  getPayoutOperatorsForCountry,
  getTransactionStatus,
} from "./fedapay";
import {
  convertCurrency,
  convertXofToGnf,
  getCurrencyForCountry,
  needsCurrencyConversion,
} from "./currency-converter";
import {
  handleMbiyoPayDeposit,
  handleMbiyoPayWithdrawal,
  handleMbiyoPayTransfer,
  handleMbiyoPayPaymentLink,
  handleMbiyoPayMerchantLink,
  handleMbiyoPayApiPayment,
  handleMbiyoPayWebhook,
  handleMbiyoPayResendWebhook,
  pollMbiyoPayTransaction,
} from "./mbiyopay-routes";
import {
  handlePawaPayDeposit,
  handlePawaPayWithdrawal,
  handlePawaPayTransfer,
  handlePawaPayWebhook,
  pollPawaPayTransaction,
} from "./pawapay-routes";
import { safeRefundOutgoingTransaction, sendApiPayoutCallback, sendBusinessWebhookCallback } from "./payment-polling";
import {
  MBIYOPAY_SUPPORTED_COUNTRIES,
  MBIYOPAY_OPERATORS,
  mbiyoPayOperatorRequiresOtp,
  getMbiyoPayOtpInstructions,
} from "./mbiyopay";
import {
  generateVerificationCode,
  sendVerificationEmail,
  isEmailServiceConfigured,
  isEmailSendingEnabled,
  clearEmailConfigCache,
  testEmailConnection,
  EmailType,
  sendPaymentDocumentsEmail,
} from "./email-service";
import nowpaymentsRoutes from "./nowpayments-routes";
import { SUPPORTED_CRYPTOCURRENCIES } from "./nowpayments";
import afribaPayRoutes from "./afribapay-routes";
import {
  handleAfribaPayDeposit,
  handleAfribaPayWithdrawal,
  handleAfribaPayTransfer,
  handleAfribaPayPaymentLink,
  handleAfribaPayMerchantLink,
  handleAfribaPayApiPayment,
} from "./afribapay-routes";
import {
  createAfribaPayPayin,
  createAfribaPayPayout,
  getAfribaPayTransaction,
  verifyAfribaPayPayment,
  operatorRequiresOtp,
  getOtpInstructions,
  mapAfribaPayStatus,
  getAfribaPayConfig,
} from "./afribapay";
import {
  handleMoneyFusionWithdrawal,
  handleMoneyFusionTransfer,
} from "./moneyfusion-routes";
import {
  handleFeeXPayDeposit,
  handleFeeXPayWithdrawal,
  handleFeeXPayTransfer,
} from "./feexpay-routes";
import { mapFeeXPayStatus } from "./feexpay";
import { FEEXPAY_COUNTRIES } from "@shared/feexpay-countries";
import {
  validateMoneyFusionWebhook,
  isMoneyFusionPayoutCompleted,
  isMoneyFusionPayoutFailed,
} from "./moneyfusion";
import { AFRIBAPAY_COUNTRIES, getCurrencyForCountry as getAfribaCurrency, getPaymentInstructions as getAfribaPaymentInstructions } from "@shared/afribapay-countries";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    loginLogId?: string;
    loginVerified?: boolean;
  }
}

const authCache = new Map<string, { user: any; timestamp: number }>();
const AUTH_CACHE_TTL = 10000;

async function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Non authentifié" });
  }
  
  const cached = authCache.get(req.session.userId);
  const now = Date.now();
  let user;
  
  if (cached && (now - cached.timestamp) < AUTH_CACHE_TTL) {
    user = cached.user;
  } else {
    user = await storage.getUser(req.session.userId);
    if (user) {
      authCache.set(req.session.userId, { user, timestamp: now });
    }
  }
  
  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: "Non authentifié" });
  }
  
  if (user.suspended) {
    authCache.delete(req.session.userId);
    req.session.destroy(() => {});
    return res.status(403).json({ error: "Votre compte a été suspendu. Veuillez contacter le support." });
  }

  if (req.session.loginVerified !== true) {
    return res.status(403).json({ error: "Vérification de connexion requise", code: "LOGIN_VERIFY_REQUIRED" });
  }
  
  next();
}

function clearAuthCache(userId?: string) {
  if (userId) {
    authCache.delete(userId);
  } else {
    authCache.clear();
  }
}

async function requireAdmin(req: Request, res: Response, next: Function) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Non authentifié" });
  }
  
  const cached = authCache.get(req.session.userId);
  const now = Date.now();
  let user;
  
  if (cached && (now - cached.timestamp) < AUTH_CACHE_TTL) {
    user = cached.user;
  } else {
    user = await storage.getUser(req.session.userId);
    if (user) {
      authCache.set(req.session.userId, { user, timestamp: now });
    }
  }
  
  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: "Non authentifié" });
  }
  
  if (user.suspended) {
    authCache.delete(req.session.userId);
    req.session.destroy(() => {});
    return res.status(403).json({ error: "Votre compte a été suspendu. Veuillez contacter le support." });
  }
  
  if (!user.isAdmin) {
    return res.status(403).json({ error: "Accès administrateur requis" });
  }
  next();
}

// Middleware pour vérifier l'authentification par clé API
async function requireApiKey(req: Request, res: Response, next: Function) {
  try {
    // Chercher la clé API dans les headers ou dans le body
    let publicKey = req.headers.authorization?.replace("Bearer ", "");
    
    if (!publicKey && typeof req.body === "object") {
      publicKey = req.body.publicKey;
    }

    if (!publicKey) {
      return res.status(401).json({ 
        error: "Clé API requise",
        details: "Veuillez fournir votre clé API publique dans le header Authorization ou dans le body" 
      });
    }

    // Vérifier que la clé existe et est active
    const apiKey = await storage.getApiKeyByPublicKey(publicKey);
    if (!apiKey || !apiKey.isActive) {
      return res.status(401).json({ 
        error: "Clé API invalide ou désactivée" 
      });
    }

    // Vérifier si le propriétaire de la clé API est suspendu
    const apiKeyOwner = await storage.getUser(apiKey.userId);
    if (apiKeyOwner?.suspended) {
      return res.status(403).json({ 
        error: "Ce service est temporairement indisponible" 
      });
    }

    // Ajouter les informations de clé API à la requête
    (req as any).apiKey = apiKey;
    (req as any).userId = apiKey.userId;
    
    next();
  } catch (error: any) {
    res.status(500).json({ error: "Erreur lors de la vérification de la clé API" });
  }
}

import { 
  callPaydunyaAPI, 
  callPaydunyaAPIGet, 
  callPaydunyaAPIv2,
  getPaydunyaConfig,
  getNowPaymentsConfig,
  isProviderActive
} from "./provider-config";

console.log("[Paydunya] Using dynamic configuration from database");

const PAYDUNYA_API_URL = "https://app.paydunya.com/api/v1";
const PAYDUNYA_API_URL_V2 = "https://app.paydunya.com/api/v2";

async function callPaydunyaAPIv2Get(endpoint: string) {
  const config = await getPaydunyaConfig();
  if (!config) {
    throw new Error("Paydunya n'est pas configure. Veuillez configurer les cles API dans l'interface administrateur.");
  }
  
  try {
    const url = `${PAYDUNYA_API_URL_V2}${endpoint}`;
    console.log(`[Paydunya APIv2 GET] Calling: ${url}`);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "PAYDUNYA-MASTER-KEY": config.masterKey,
        "PAYDUNYA-PRIVATE-KEY": config.privateKey,
        "PAYDUNYA-TOKEN": config.token,
      },
    });

    const responseText = await response.text();
    console.log(`[Paydunya APIv2 GET] Response Status: ${response.status}, Text: ${responseText.substring(0, 500)}`);

    try {
      const result = JSON.parse(responseText);
      return result;
    } catch (e) {
      console.error(`[Paydunya APIv2 GET] Received non-JSON response:`, responseText.substring(0, 500));
      throw new Error(`Paydunya API error: ${responseText.substring(0, 200)}`);
    }
  } catch (error) {
    console.error(`[Paydunya APIv2 GET Error] ${endpoint}:`, error);
    throw error;
  }
}

// Sanitize message helper (strip HTML, cap length, fallback to generic)
function sanitizePaymentMessage(msg: string | undefined, fallback: string = "Erreur de paiement"): string {
  if (!msg) return fallback;
  // Strip HTML tags
  const withoutHtml = msg.replace(/<[^>]*>/g, "");
  // Cap length at 200 chars
  const capped = withoutHtml.substring(0, 200);
  // Return sanitized or fallback
  return capped.trim() || fallback;
}

async function confirmWizallPayment(
  authorizationCode: string,
  phoneNumber: string,
  transactionId: string
): Promise<{ success: boolean; message: string; data?: any }> {
  const paydunyaConfig = await getPaydunyaConfig();
  if (!paydunyaConfig) {
    return { success: false, message: "Paydunya n'est pas configure" };
  }
  
  try {
    const confirmResponse = await fetch(`${PAYDUNYA_API_URL}/softpay/wizall-money-senegal/confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "PAYDUNYA-MASTER-KEY": paydunyaConfig.masterKey,
        "PAYDUNYA-PRIVATE-KEY": paydunyaConfig.privateKey,
        "PAYDUNYA-TOKEN": paydunyaConfig.token,
      },
      body: JSON.stringify({
        authorization_code: authorizationCode,
        phone_number: phoneNumber,
        transaction_id: transactionId,
      }),
    });

    // Gracefully handle non-JSON responses
    const contentType = confirmResponse.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const textBody = await confirmResponse.text();
      console.error("[WIZALL CONFIRM] Non-JSON response:", textBody.substring(0, 200));
      return {
        success: false,
        message: sanitizePaymentMessage(undefined, "Erreur serveur Wizall"),
      };
    }

    let confirmResult;
    try {
      confirmResult = await confirmResponse.json();
    } catch (parseError) {
      console.error("[WIZALL CONFIRM] JSON parse error:", parseError);
      return {
        success: false,
        message: sanitizePaymentMessage(undefined, "Réponse invalide du serveur Wizall"),
      };
    }

    if (confirmResult.success) {
      return {
        success: true,
        message: sanitizePaymentMessage(confirmResult.message, "Paiement Wizall confirmé"),
        data: confirmResult.data,
      };
    } else {
      return {
        success: false,
        message: sanitizePaymentMessage(confirmResult.message, "Erreur confirmation Wizall"),
        data: confirmResult.data,
      };
    }
  } catch (error) {
    console.error("[WIZALL CONFIRM] Error:", error);
    return {
      success: false,
      message: sanitizePaymentMessage(undefined, "Erreur de connexion au service Wizall"),
    };
  }
}

async function callPaydunyaSoftpay(
  operator: string,
  country: string,
  paymentData: SoftpayPaymentData
): Promise<{ success: boolean; message: string; data?: any; fees?: number; currency?: string; url?: string; omUrl?: string; maxitUrl?: string; transactionId?: string }> {
  const paydunyaConfig = await getPaydunyaConfig();
  if (!paydunyaConfig) {
    return { success: false, message: "Paydunya n'est pas configure. Veuillez configurer les cles API." };
  }
  
  try {
    const operatorKey = getOperatorKey(operator, country);
    if (!operatorKey) {
      return {
        success: false,
        message: `Operateur non supporte pour ce pays`,
      };
    }

    const config = SOFTPAY_OPERATORS[operatorKey];
    if (!config) {
      return {
        success: false,
        message: `Configuration introuvable pour cet operateur`,
      };
    }

    const requestData = config.parameterMapping(paymentData);

    console.log(`[SOFTPAY] Calling ${config.endpoint} for ${operatorKey} - phone: ${paymentData.phoneNumber?.slice(-4) || 'N/A'}`);

    const response = await fetch(`${PAYDUNYA_API_URL}${config.endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "PAYDUNYA-MASTER-KEY": paydunyaConfig.masterKey,
        "PAYDUNYA-PRIVATE-KEY": paydunyaConfig.privateKey,
        "PAYDUNYA-TOKEN": paydunyaConfig.token,
      },
      body: JSON.stringify(requestData),
    });

    // Gracefully handle non-JSON responses
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const textBody = await response.text();
      console.error(`[SOFTPAY] Non-JSON response from ${config.endpoint}:`, textBody.substring(0, 200));
      return {
        success: false,
        message: "Erreur serveur de paiement",
      };
    }

    let result;
    try {
      result = await response.json();
    } catch (parseError) {
      console.error(`[SOFTPAY] JSON parse error for ${config.endpoint}:`, parseError);
      return {
        success: false,
        message: "Réponse invalide du serveur de paiement",
      };
    }

    // Log response status without exposing full result (may contain sensitive data)
    console.log(`[SOFTPAY] ${config.endpoint} - Status: ${response.status}, success: ${result.success ?? result.response_code}`);

    // Normalize Paydunya response format to standard format
    // Paydunya returns: {success: true/false, message: "...", data: {...}, fees: 100, currency: "XOF"}
    // OR: {response_code: "00", response_text: "...", ...}
    
    // Extract TransactionID from multiple possible locations in Paydunya response
    const extractTransactionId = (result: any): string | undefined => {
      return (
        result.TransactionID ||
        result.transactionid ||
        result.transaction_id ||
        result.data?.TransactionID ||
        result.data?.transactionid ||
        result.data?.transaction_id
      );
    };

    if (result.success === true) {
      // Already in correct format
      // Orange Money SN returns other_url.om_url and other_url.maxit_url as deep links
      const omUrl = result.other_url?.om_url || undefined;
      const maxitUrl = result.other_url?.maxit_url || undefined;
      return {
        success: true,
        message: result.message || "Paiement initié avec succès",
        data: result.data,
        fees: result.fees,
        currency: result.currency,
        url: result.url,
        omUrl,
        maxitUrl,
        transactionId: extractTransactionId(result),
      };
    } else if (result.success === false) {
      return {
        success: false,
        message: result.message || "Erreur lors du paiement",
        data: result.data,
      };
    } else if (result.response_code === "00") {
      // Old format - convert to new format
      return {
        success: true,
        message: result.response_text || result.message || "Paiement initié avec succès",
        data: result.data,
        fees: result.fees,
        currency: result.currency,
        transactionId: extractTransactionId(result),
      };
    } else {
      // Error response
      return {
        success: false,
        message: result.response_text || result.message || "Erreur lors du paiement",
        data: result.data,
      };
    }
  } catch (error) {
    console.error(`[SOFTPAY Error] ${operator}-${country}:`, error);
    return {
      success: false,
      message: "Erreur de connexion au service de paiement",
    };
  }
}

const platformSettingsCache: Record<string, { value: any; expiry: number }> = {};
const SETTINGS_CACHE_TTL = 30_000;

function getCachedSetting(key: string): any | undefined {
  const entry = platformSettingsCache[key];
  if (entry && Date.now() < entry.expiry) return entry.value;
  return undefined;
}

function setCachedSetting(key: string, value: any): void {
  platformSettingsCache[key] = { value, expiry: Date.now() + SETTINGS_CACHE_TTL };
}

function invalidateCachedSetting(key: string): void {
  delete platformSettingsCache[key];
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Open Graph social media preview routes (must be before Vite/SPA handler)
  registerOgRoutes(app);

  // Configure session - SESSION_SECRET doit être défini dans les variables d'environnement
  if (!process.env.SESSION_SECRET) {
    console.error("ERREUR: SESSION_SECRET doit être configuré dans les variables d'environnement");
  }

  // Enable trust proxy for production (behind reverse proxy)
  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  // Configure PostgreSQL session store
  const PgStore = connectPg(session);
  const pgPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });

  app.use(
    session({
      store: new PgStore({
        pool: pgPool,
        tableName: "session", // Table will be created automatically
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET!,
      resave: false,
      saveUninitialized: false,
      rolling: true, // Reset expiration on each request (activity extends session)
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days - session expires after 7 days of inactivity
      },
    })
  );

  // ===== Business Routes =====
  app.get("/api/business/wallets", requireAuth, async (req: Request, res: Response) => {
    try {
      const wallets = await storage.getBusinessWallets(req.session.userId!);
      res.json(wallets);
    } catch (error: any) {
      console.error("Get business wallets error:", error);
      res.status(500).json({ error: "Une erreur est survenue lors de la récupération des portefeuilles" });
    }
  });

  app.put("/api/business/profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        businessRegistrationNumber: z.string().optional(),
        businessCountry: z.string().optional(),
        businessPhone: z.string().optional(),
        businessEnterprisePhone: z.string().optional(),
        businessEmail: z.string().email("Email invalide").optional().or(z.literal("")),
      });
      const data = schema.parse(req.body);
      const updated = await storage.updateBusinessProfile(req.session.userId!, data);
      if (!updated) return res.status(404).json({ error: "Utilisateur non trouvé" });
      res.json({ success: true, user: updated });
    } catch (error: any) {
      console.error("Update business profile error:", error);
      res.status(400).json({ error: error.message || "Erreur lors de la mise à jour du profil" });
    }
  });

  // ===== Bank Account Routes =====
  app.post("/api/business/bank-account", requireAuth, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        bankAccountHolder: z.string().min(1),
        bankAccountNumber: z.string().min(1),
        bankName: z.string().min(1),
        bankSwiftBic: z.string().optional().default(""),
        bankBranchAddress: z.string().optional().default(""),
        bankBranchName: z.string().optional().default(""),
        bankBranchSortCode: z.string().optional().default(""),
        bankCountry: z.string().optional().default(""),
        bankCurrency: z.string().optional().default(""),
      });
      const data = schema.parse(req.body);
      const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
      await pool.query(`
        UPDATE users SET
          bank_account_holder = $1,
          bank_account_number = $2,
          bank_name = $3,
          bank_swift_bic = $4,
          bank_branch_address = $5,
          bank_branch_name = $6,
          bank_branch_sort_code = $7,
          bank_country = $8,
          bank_currency = $9
        WHERE id = $10
      `, [
        data.bankAccountHolder, data.bankAccountNumber, data.bankName,
        data.bankSwiftBic, data.bankBranchAddress, data.bankBranchName,
        data.bankBranchSortCode, data.bankCountry, data.bankCurrency,
        req.session.userId
      ]);
      await pool.end();
      res.json({ success: true });
    } catch (error: any) {
      console.error("Save bank account error:", error);
      res.status(400).json({ error: error.message || "Erreur lors de la sauvegarde" });
    }
  });

  // ===== Settlement Routes =====
  app.get("/api/business/settlements", requireAuth, async (req: Request, res: Response) => {
    try {
      const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
      const result = await pool.query(
        `SELECT * FROM settlements WHERE user_id = $1 ORDER BY created_at DESC`,
        [req.session.userId]
      );
      await pool.end();
      res.json(result.rows.map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        walletCountry: r.wallet_country,
        walletCurrency: r.wallet_currency,
        amount: r.amount,
        status: r.status,
        bankAccountHolder: r.bank_account_holder,
        bankAccountNumber: r.bank_account_number,
        bankName: r.bank_name,
        bankSwiftBic: r.bank_swift_bic,
        bankBranchAddress: r.bank_branch_address,
        bankBranchName: r.bank_branch_name,
        bankBranchSortCode: r.bank_branch_sort_code,
        bankCountry: r.bank_country,
        bankCurrency: r.bank_currency,
        createdAt: r.created_at,
      })));
    } catch (error: any) {
      console.error("Get settlements error:", error);
      res.status(500).json({ error: "Erreur" });
    }
  });

  app.post("/api/business/settlements", requireAuth, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        walletCountry: z.string().min(1),
        walletCurrency: z.string().min(1),
        amount: z.number().min(1),
      });
      const data = schema.parse(req.body);

      const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const userResult = await client.query(`SELECT * FROM users WHERE id = $1`, [req.session.userId]);
        const user = userResult.rows[0];
        if (!user) { await client.query('ROLLBACK'); client.release(); await pool.end(); return res.status(404).json({ error: "Utilisateur non trouvé" }); }
        if (!user.bank_account_number || !user.bank_name) {
          await client.query('ROLLBACK'); client.release(); await pool.end();
          return res.status(400).json({ error: "Veuillez d'abord configurer votre compte bancaire" });
        }

        const walletResult = await client.query(
          `SELECT * FROM business_wallets WHERE user_id = $1 AND country = $2 AND currency = $3 FOR UPDATE`,
          [req.session.userId, data.walletCountry, data.walletCurrency]
        );
        const wallet = walletResult.rows[0];
        if (!wallet || wallet.balance < data.amount) {
          await client.query('ROLLBACK'); client.release(); await pool.end();
          return res.status(400).json({ error: "Solde insuffisant" });
        }

        await client.query(
          `UPDATE business_wallets SET balance = balance - $1 WHERE id = $2`,
          [data.amount, wallet.id]
        );

        await client.query(
          `INSERT INTO settlements (user_id, wallet_country, wallet_currency, amount, status,
           bank_account_holder, bank_account_number, bank_name, bank_swift_bic,
           bank_branch_address, bank_branch_name, bank_branch_sort_code, bank_country, bank_currency)
           VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            req.session.userId, data.walletCountry, data.walletCurrency, data.amount,
            user.bank_account_holder, user.bank_account_number, user.bank_name,
            user.bank_swift_bic, user.bank_branch_address, user.bank_branch_name,
            user.bank_branch_sort_code, user.bank_country, user.bank_currency
          ]
        );

        await client.query('COMMIT');
        client.release();
        await pool.end();
        res.json({ success: true });
      } catch (txError) {
        await client.query('ROLLBACK');
        client.release();
        await pool.end();
        throw txError;
      }
    } catch (error: any) {
      console.error("Create settlement error:", error);
      res.status(400).json({ error: error.message || "Erreur" });
    }
  });

  // ===== Admin Settlement Routes =====
  app.get("/api/admin/settlements", requireAdmin, async (req: Request, res: Response) => {
    try {
      const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
      const result = await pool.query(`
        SELECT s.*, u.first_name, u.last_name, u.business_name, u.email
        FROM settlements s
        JOIN users u ON s.user_id = u.id
        ORDER BY s.created_at DESC
      `);
      await pool.end();
      res.json(result.rows.map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        walletCountry: r.wallet_country,
        walletCurrency: r.wallet_currency,
        amount: r.amount,
        status: r.status,
        bankAccountHolder: r.bank_account_holder,
        bankAccountNumber: r.bank_account_number,
        bankName: r.bank_name,
        bankSwiftBic: r.bank_swift_bic,
        bankBranchAddress: r.bank_branch_address,
        bankBranchName: r.bank_branch_name,
        bankBranchSortCode: r.bank_branch_sort_code,
        bankCountry: r.bank_country,
        bankCurrency: r.bank_currency,
        createdAt: r.created_at,
        userName: r.business_name || `${r.first_name} ${r.last_name}`,
        userEmail: r.email,
      })));
    } catch (error: any) {
      console.error("Admin get settlements error:", error);
      res.status(500).json({ error: "Erreur" });
    }
  });

  app.post("/api/admin/settlements/:id/complete", requireAdmin, async (req: Request, res: Response) => {
    try {
      const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
      const result = await pool.query(`UPDATE settlements SET status = 'completed' WHERE id = $1`, [req.params.id]);
      await pool.end();
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Règlement non trouvé" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Complete settlement error:", error);
      res.status(500).json({ error: "Erreur" });
    }
  });

  app.get("/api/admin/settlements/pending-count", requireAdmin, async (req: Request, res: Response) => {
    try {
      const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
      const result = await pool.query(`SELECT COUNT(*) as count FROM settlements WHERE status = 'pending'`);
      await pool.end();
      res.json({ count: parseInt(result.rows[0].count) });
    } catch (error: any) {
      res.json({ count: 0 });
    }
  });

  // ===== Admin Business Routes =====
  app.get("/api/admin/business/users", requireAdmin, async (req: Request, res: Response) => {
    try {
      const users = await storage.getBusinessUsers();
      res.json(users);
    } catch (error: any) {
      console.error("Get business users error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.get("/api/admin/business/search", requireAdmin, async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;
      if (!query || query.length === 0) return res.json([]);
      const results = await storage.searchBusinessUsers(query);
      res.json(results);
    } catch (error: any) {
      console.error("Business search error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.get("/api/admin/business/users/:id/transactions", requireAdmin, async (req: Request, res: Response) => {
    try {
      const transactions = await storage.getTransactions(req.params.id);
      res.json(transactions);
    } catch (error: any) {
      console.error("Get business user transactions error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.post("/api/admin/business/users/:id/wallet/deposit", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { country, currency, amount } = req.body;
      if (!country || !currency || typeof amount !== "number" || amount <= 0) {
        return res.status(400).json({ error: "Données invalides" });
      }
      const wallet = await storage.creditBusinessWallet(req.params.id, country, currency, amount);
      res.json(wallet);
    } catch (error: any) {
      console.error("Deposit business wallet error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.post("/api/admin/business/users/:id/wallet/withdraw", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { country, currency, amount } = req.body;
      if (!country || !currency || typeof amount !== "number" || amount <= 0) {
        return res.status(400).json({ error: "Données invalides" });
      }
      const wallet = await storage.debitBusinessWallet(req.params.id, country, currency, amount);
      res.json(wallet);
    } catch (error: any) {
      console.error("Withdraw business wallet error:", error);
      res.status(500).json({ error: error.message || "Une erreur est survenue" });
    }
  });

  app.delete("/api/admin/business/users/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) return res.status(404).json({ error: "Utilisateur non trouvé" });
      if (user.isPrimaryAdmin) return res.status(403).json({ error: "Impossible de supprimer l'administrateur principal" });
      
      // Just suspend instead of hard delete for history
      await storage.suspendUser(req.params.id);
      res.json({ success: true, message: "Utilisateur suspendu avec succès" });
    } catch (error: any) {
      console.error("Delete business user error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.post("/api/admin/business/users/:id/payout-toggle", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { enabled } = req.body;
      const updatedUser = await storage.updatePayoutApiStatus(req.params.id, enabled);
      
      if (!updatedUser) return res.status(404).json({ error: "Utilisateur non trouvé" });
      res.json(updatedUser);
    } catch (error: any) {
      console.error("Toggle payout error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.get("/api/admin/business/provider-configs", requireAdmin, async (req: Request, res: Response) => {
    try {
      const configs = await storage.getProviderConfigs("business");
      const masked = configs.map(c => ({
        ...c,
        apiKey: c.apiKey ? `${c.apiKey.slice(0, 8)}...${c.apiKey.slice(-4)}` : null,
        secretKey: c.secretKey ? `${c.secretKey.slice(0, 8)}...${c.secretKey.slice(-4)}` : null,
        publicKey: c.publicKey ? `${c.publicKey.slice(0, 8)}...${c.publicKey.slice(-4)}` : null,
        masterKey: c.masterKey ? `${c.masterKey.slice(0, 8)}...${c.masterKey.slice(-4)}` : null,
        token: c.token ? `${c.token.slice(0, 8)}...${c.token.slice(-4)}` : null,
        ipnSecret: c.ipnSecret ? `${c.ipnSecret.slice(0, 8)}...${c.ipnSecret.slice(-4)}` : null,
      }));
      res.json(masked);
    } catch (error: any) {
      console.error("Get business provider configs error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.put("/api/admin/business/provider-configs/:provider", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { provider } = req.params;
      const { isActive, apiKey, secretKey, publicKey, masterKey, token, ipnSecret } = req.body;
      const updates: any = { updatedAt: new Date() };
      if (typeof isActive === "boolean") updates.isActive = isActive;
      if (apiKey !== undefined) updates.apiKey = apiKey || null;
      if (secretKey !== undefined) updates.secretKey = secretKey || null;
      if (publicKey !== undefined) updates.publicKey = publicKey || null;
      if (masterKey !== undefined) updates.masterKey = masterKey || null;
      if (token !== undefined) updates.token = token || null;
      if (ipnSecret !== undefined) updates.ipnSecret = ipnSecret || null;

      const config = await storage.updateProviderConfig(provider, updates, "business");
      if (!config) return res.status(404).json({ error: "Fournisseur non trouvé" });
      res.json(config);
    } catch (error: any) {
      console.error("Update business provider config error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.get("/api/admin/business/fee-configs", requireAdmin, async (req: Request, res: Response) => {
    try {
      const configs = await storage.getAllFeeConfigs();
      res.json(configs.filter(c => c.scope === "business"));
    } catch (error: any) {
      console.error("Get business fee configs error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.put("/api/admin/business/fee-configs/:provider/:country/:operator", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { provider, country, operator } = req.params;
      const { incomingFeePercentage, outgoingFeePercentage } = req.body;

      if (incomingFeePercentage !== undefined && (incomingFeePercentage < 0 || incomingFeePercentage > 1000)) {
        return res.status(400).json({ error: "Le pourcentage des frais entrants doit etre entre 0 et 100" });
      }
      if (outgoingFeePercentage !== undefined && (outgoingFeePercentage < 0 || outgoingFeePercentage > 1000)) {
        return res.status(400).json({ error: "Le pourcentage des frais sortants doit etre entre 0 et 100" });
      }

      let config = await storage.getFeeConfig(provider, country, operator, "business");
      if (!config) {
        // Config doesn't exist yet — create it with defaults for missing fields
        config = await storage.createOrUpdateFeeConfig({
          provider,
          country,
          operator,
          incomingFeePercentage: incomingFeePercentage ?? 60,
          outgoingFeePercentage: outgoingFeePercentage ?? 60,
          scope: "business",
        });
      } else {
        // Config exists — only update the provided field, leave the other unchanged
        config = await storage.updateFeeConfig(provider, country, operator, {
          incomingFeePercentage,
          outgoingFeePercentage,
        }, "business");
      }

      res.json(config);
    } catch (error: any) {
      console.error("Update business fee config error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // ===== User-specific fee configs (admin) =====
  app.get("/api/admin/users/:userId/fee-configs", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId: targetUserId } = req.params;
      const configs = await storage.getUserFeeConfigs(targetUserId);
      res.json(configs);
    } catch (error: any) {
      console.error("Get user fee configs error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.put("/api/admin/users/:userId/fee-configs/:provider/:country/:operator", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId: targetUserId, provider, country, operator } = req.params;
      const { incomingFeePercentage, outgoingFeePercentage } = req.body;

      if (incomingFeePercentage !== undefined && (incomingFeePercentage < 0 || incomingFeePercentage > 1000)) {
        return res.status(400).json({ error: "Pourcentage invalide (0-100)" });
      }
      if (outgoingFeePercentage !== undefined && (outgoingFeePercentage < 0 || outgoingFeePercentage > 1000)) {
        return res.status(400).json({ error: "Pourcentage invalide (0-100)" });
      }

      const existing = await storage.getUserFeeConfig(targetUserId, provider, country, operator);
      const currentIn = existing?.incomingFeePercentage ?? 60;
      const currentOut = existing?.outgoingFeePercentage ?? 60;

      const config = await storage.upsertUserFeeConfig(
        targetUserId, provider, country, operator,
        incomingFeePercentage ?? currentIn,
        outgoingFeePercentage ?? currentOut
      );
      res.json(config);
    } catch (error: any) {
      console.error("Upsert user fee config error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.delete("/api/admin/users/:userId/fee-configs/:provider/:country/:operator", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId: targetUserId, provider, country, operator } = req.params;
      await storage.deleteUserFeeConfig(targetUserId, provider, country, operator);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete user fee config error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.get("/api/admin/business/country-operator", requireAdmin, async (req: Request, res: Response) => {
    try {
      const configs = await storage.getCountryOperatorConfigs("business");
      res.json(configs);
    } catch (error: any) {
      console.error("Get business country operator configs error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.put("/api/admin/business/country-operator/:provider/:country/:operator", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { provider, country, operator } = req.params;
      const { incomingEnabled, outgoingEnabled } = req.body;
      if (incomingEnabled) {
        await storage.disableOperatorForOtherProviders(provider, country, operator, "incoming", "business");
      }
      if (outgoingEnabled) {
        await storage.disableOperatorForOtherProviders(provider, country, operator, "outgoing", "business");
      }
      const config = await storage.updateCountryOperatorConfig(provider, country, operator, {
        incomingEnabled,
        outgoingEnabled
      }, "business");
      if (!config) return res.status(404).json({ error: "Config non trouvée" });
      res.json(config);
    } catch (error: any) {
      console.error("Update business country operator config error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.get("/api/admin/business/country-status", requireAdmin, async (req: Request, res: Response) => {
    try {
      const statuses = await storage.getCountryStatuses("business");
      res.json(statuses);
    } catch (error: any) {
      console.error("Get business country statuses error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.put("/api/admin/business/country-status/:provider/:country", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { provider, country } = req.params;
      const { payinEnabled, payoutEnabled } = req.body;
      if (payinEnabled) {
        await storage.disableCountryForOtherProviders(provider, country, "incoming", "business");
      }
      if (payoutEnabled) {
        await storage.disableCountryForOtherProviders(provider, country, "outgoing", "business");
      }
      const status = await storage.updateCountryStatus(provider, country, {
        payinEnabled,
        payoutEnabled,
      }, "business");
      if (!status) return res.status(404).json({ error: "Pays non trouvé" });
      res.json(status);
    } catch (error: any) {
      console.error("Update business country status error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // Disabled business wallet countries (global setting)
  app.get("/api/admin/business/disabled-wallet-countries", requireAdmin, async (req: Request, res: Response) => {
    try {
      const result = await pgPool.query(
        "SELECT value FROM platform_settings WHERE key = 'disabled_business_wallet_countries'"
      );
      const disabled: string[] = result.rows[0] ? JSON.parse(result.rows[0].value) : [];
      res.json({ disabled });
    } catch {
      res.json({ disabled: [] });
    }
  });

  app.put("/api/admin/business/disabled-wallet-countries", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { disabled } = req.body as { disabled: string[] };
      if (!Array.isArray(disabled)) return res.status(400).json({ error: "Format invalide" });
      await pgPool.query(
        "INSERT INTO platform_settings (key, value, updated_at) VALUES ('disabled_business_wallet_countries', $1, NOW()) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()",
        [JSON.stringify(disabled)]
      );
      invalidateCachedSetting('disabled_business_wallet_countries');
      res.json({ success: true, disabled });
    } catch (error: any) {
      res.status(500).json({ error: "Erreur lors de la mise à jour" });
    }
  });

  // Public endpoint for business users to check disabled wallet countries
  app.get("/api/business/wallet-country-settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const result = await pgPool.query(
        "SELECT value FROM platform_settings WHERE key = 'disabled_business_wallet_countries'"
      );
      const disabled: string[] = result.rows[0] ? JSON.parse(result.rows[0].value) : [];
      res.json({ disabled });
    } catch {
      res.json({ disabled: [] });
    }
  });

  app.get("/api/business/fee-rates", requireAuth, async (req: Request, res: Response) => {
    try {
      const sessionUserId = req.session?.userId;
      const operatorConfigs = await storage.getCountryOperatorConfigs("business");
      const activeConfigs = operatorConfigs.filter(c => c.incomingEnabled || c.outgoingEnabled);
      const allFeeConfigs = await storage.getAllFeeConfigs();
      // Load user-specific overrides for the authenticated user
      const userFeeConfigs = sessionUserId ? await storage.getUserFeeConfigs(sessionUserId) : [];
      const DEFAULT_FEE = 60;

      const result = activeConfigs.map(cfg => {
        // 1. Check user-specific fee first
        const userMatch = userFeeConfigs.find(
          f => f.provider === cfg.provider && f.country === cfg.country && f.operator === cfg.operator
        ) || userFeeConfigs.find(
          f => f.country === cfg.country && f.operator === cfg.operator
        );
        if (userMatch) {
          return {
            country: cfg.country,
            operator: cfg.operator,
            provider: cfg.provider,
            incomingEnabled: cfg.incomingEnabled,
            outgoingEnabled: cfg.outgoingEnabled,
            incomingFeePercentage: userMatch.incomingFeePercentage,
            outgoingFeePercentage: userMatch.outgoingFeePercentage,
            isCustom: true,
          };
        }
        // 2. Fall back to global fee — priority: business scope > personal scope
        const feeMatch = allFeeConfigs.find(
          f => f.provider === cfg.provider && f.country === cfg.country && f.operator === cfg.operator && f.scope === "business" && !f.userId
        ) || allFeeConfigs.find(
          f => f.country === cfg.country && f.operator === cfg.operator && f.scope === "business" && !f.userId
        ) || allFeeConfigs.find(
          f => f.provider === cfg.provider && f.country === cfg.country && f.operator === cfg.operator && f.scope === "personal" && !f.userId
        ) || allFeeConfigs.find(
          f => f.country === cfg.country && f.operator === cfg.operator && f.scope === "personal" && !f.userId
        );
        return {
          country: cfg.country,
          operator: cfg.operator,
          provider: cfg.provider,
          incomingEnabled: cfg.incomingEnabled,
          outgoingEnabled: cfg.outgoingEnabled,
          incomingFeePercentage: feeMatch ? feeMatch.incomingFeePercentage : DEFAULT_FEE,
          outgoingFeePercentage: feeMatch ? feeMatch.outgoingFeePercentage : DEFAULT_FEE,
          isCustom: false,
        };
      });

      res.json(result);
    } catch (error: any) {
      console.error("Business fee rates error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.get("/api/admin/business/stats", requireAdmin, async (req: Request, res: Response) => {
    try {
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      const stats = await storage.getBusinessAdminStats();
      res.json(stats);
    } catch (error: any) {
      console.error("Business admin stats error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.get("/api/admin/business/country-stats", requireAdmin, async (req: Request, res: Response) => {
    try {
      const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
      const walletResult = await pool.query(`
        SELECT country, currency, SUM(balance) as total_balance, COUNT(*) as wallet_count
        FROM business_wallets
        GROUP BY country, currency
        ORDER BY country
      `);
      const incomingResult = await pool.query(`
        SELECT t.country, COUNT(*) as count, SUM(t.amount) as total
        FROM transactions t
        JOIN users u ON t.user_id = u.id
        WHERE u.account_type = 'business'
        AND t.status = 'completed'
        AND t.type IN ('deposit', 'payment_link', 'merchant_link', 'api_payment')
        GROUP BY t.country
      `);
      const outgoingResult = await pool.query(`
        SELECT t.country, COUNT(*) as count, SUM(t.amount) as total
        FROM transactions t
        JOIN users u ON t.user_id = u.id
        WHERE u.account_type = 'business'
        AND t.status = 'completed'
        AND t.type IN ('transfer', 'withdrawal', 'api_payout')
        GROUP BY t.country
      `);
      await pool.end();

      const entries: Record<string, any> = {};
      for (const r of walletResult.rows) {
        const key = `${r.country}-${r.currency}`;
        if (!entries[key]) entries[key] = { country: r.country, currency: r.currency, balance: 0, walletCount: 0, incomingCount: 0, incomingTotal: 0, outgoingCount: 0, outgoingTotal: 0 };
        entries[key].balance += parseInt(r.total_balance) || 0;
        entries[key].walletCount += parseInt(r.wallet_count) || 0;
      }
      for (const r of incomingResult.rows) {
        const existing = Object.values(entries).find((e: any) => e.country === r.country);
        if (existing) {
          existing.incomingCount = parseInt(r.count) || 0;
          existing.incomingTotal = parseInt(r.total) || 0;
        } else {
          const key = `${r.country}-XOF`;
          entries[key] = { country: r.country, currency: "XOF", balance: 0, walletCount: 0, incomingCount: parseInt(r.count) || 0, incomingTotal: parseInt(r.total) || 0, outgoingCount: 0, outgoingTotal: 0 };
        }
      }
      for (const r of outgoingResult.rows) {
        const existing = Object.values(entries).find((e: any) => e.country === r.country);
        if (existing) {
          existing.outgoingCount = parseInt(r.count) || 0;
          existing.outgoingTotal = parseInt(r.total) || 0;
        } else {
          const key = `${r.country}-XOF`;
          if (!entries[key]) entries[key] = { country: r.country, currency: "XOF", balance: 0, walletCount: 0, incomingCount: 0, incomingTotal: 0, outgoingCount: 0, outgoingTotal: 0 };
          entries[key].outgoingCount = parseInt(r.count) || 0;
          entries[key].outgoingTotal = parseInt(r.total) || 0;
        }
      }

      res.json(Object.values(entries));
    } catch (error: any) {
      console.error("Country stats error:", error);
      res.status(500).json({ error: "Erreur" });
    }
  });

  // ===== Simple Rate Limiting for Auth Endpoints =====
  const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
  const temporarySuspensions = new Map<string, number>(); // email -> suspension end timestamp
  const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
  const MAX_LOGIN_ATTEMPTS = 5; // Max attempts per window
  const MAX_CODE_REQUESTS = 4; // 1 initial + 3 resends = 4 total (triggers 3h suspension after 3 resends)
  const SUSPENSION_DURATION = 3 * 60 * 60 * 1000; // 3 hours suspension

  function checkTemporarySuspension(email: string): { suspended: boolean; remainingTime?: string } {
    const suspendedUntil = temporarySuspensions.get(email.toLowerCase());
    if (!suspendedUntil) return { suspended: false };
    
    const now = Date.now();
    if (now >= suspendedUntil) {
      temporarySuspensions.delete(email.toLowerCase());
      return { suspended: false };
    }
    
    const remaining = suspendedUntil - now;
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
    
    let timeString = "";
    if (hours > 0) timeString += `${hours}h `;
    if (minutes > 0) timeString += `${minutes}min `;
    if (seconds > 0 && hours === 0) timeString += `${seconds}s`;
    
    return { suspended: true, remainingTime: timeString.trim() };
  }

  function applyTemporarySuspension(email: string): void {
    const suspendUntil = Date.now() + SUSPENSION_DURATION;
    temporarySuspensions.set(email.toLowerCase(), suspendUntil);
  }

  function clearTemporarySuspension(email: string): void {
    temporarySuspensions.delete(email.toLowerCase());
    loginAttempts.delete(`code:${email.toLowerCase()}`);
    loginAttempts.delete(`login:${email.toLowerCase()}`);
  }

  function checkRateLimit(key: string, maxAttempts: number): { allowed: boolean; remainingTime?: number; shouldSuspend?: boolean; currentCount?: number } {
    const now = Date.now();
    const record = loginAttempts.get(key);
    
    if (!record) {
      loginAttempts.set(key, { count: 1, lastAttempt: now });
      return { allowed: true, currentCount: 1 };
    }
    
    // Reset if window has passed
    if (now - record.lastAttempt > RATE_LIMIT_WINDOW) {
      loginAttempts.set(key, { count: 1, lastAttempt: now });
      return { allowed: true, currentCount: 1 };
    }
    
    // Increment counter first
    record.count++;
    record.lastAttempt = now;
    
    // Check if limit exceeded (suspend on the 3rd attempt for code requests)
    if (record.count > maxAttempts) {
      const remainingTime = Math.ceil((RATE_LIMIT_WINDOW - (now - record.lastAttempt)) / 1000 / 60);
      // For code requests, trigger suspension after max attempts exceeded
      const shouldSuspend = key.startsWith("code:");
      return { allowed: false, remainingTime, shouldSuspend, currentCount: record.count };
    }
    
    // Check if this is the last allowed attempt (for code requests, trigger suspension exactly on max)
    if (key.startsWith("code:") && record.count === maxAttempts) {
      // This is the 3rd code request - allow it but mark for suspension after
      return { allowed: true, shouldSuspend: true, currentCount: record.count };
    }
    
    return { allowed: true, currentCount: record.count };
  }

  function resetRateLimit(key: string): void {
    loginAttempts.delete(key);
  }

  // Cleanup old rate limit entries and expired suspensions every 5 minutes
  setInterval(() => {
    const now = Date.now();
    loginAttempts.forEach((record, key) => {
      if (now - record.lastAttempt > RATE_LIMIT_WINDOW) {
        loginAttempts.delete(key);
      }
    });
    temporarySuspensions.forEach((suspendedUntil, email) => {
      if (now >= suspendedUntil) {
        temporarySuspensions.delete(email);
      }
    });
  }, 5 * 60 * 1000);

  // ===== NOWPayments Routes =====
  app.use(nowpaymentsRoutes);
  app.use("/api/afribapay", afribaPayRoutes);

  // ===== IP Geolocation Route =====
  // Detect country from IP address for auto-selecting country on payment pages
  app.get("/api/detect-country", async (req: Request, res: Response) => {
    try {
      // Get client IP from various headers (for reverse proxy support)
      const clientIP = 
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        (req.headers["x-real-ip"] as string) ||
        req.socket.remoteAddress ||
        "";
      
      // List of supported country codes (all countries on the platform)
      const SUPPORTED_COUNTRIES = [
        "BJ", "CI", "SN", "BF", "TG", "ML", "GN", "NE",
        "CM", "CD", "TD", "CG", "CF", "GA", "RW", "GM",
        "GH", "KE", "TZ", "UG", "ZM", "MW", "MZ", "NG", "SL", "LS"
      ];
      
      // Use ip-api.com (free, no API key required for non-commercial use)
      const response = await fetch(`https://ip-api.com/json/${clientIP}?fields=countryCode,status`);
      
      if (!response.ok) {
        return res.json({ country: null, detected: false });
      }
      
      const data = await response.json();
      
      if (data.status === "success" && data.countryCode) {
        const countryCode = data.countryCode;
        
        // Check if the detected country is in our supported list
        if (SUPPORTED_COUNTRIES.includes(countryCode)) {
          console.log(`[GeoIP] Detected country ${countryCode} for IP ${clientIP}`);
          return res.json({ country: countryCode, detected: true });
        } else {
          console.log(`[GeoIP] Country ${countryCode} not supported for IP ${clientIP}`);
          return res.json({ country: null, detected: false, detectedCountry: countryCode });
        }
      }
      
      return res.json({ country: null, detected: false });
    } catch (error) {
      console.error("[GeoIP] Error detecting country:", error);
      return res.json({ country: null, detected: false });
    }
  });

  // ===== Auth Routes =====
  
  // Step 1: Send verification code for signup
  app.post("/api/auth/signup/send-code", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      
      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email requis" });
      }

      // Check if email sending is enabled for signup
      const emailEnabled = await isEmailSendingEnabled("signup");
      if (!emailEnabled) {
        // If email sending is disabled, allow signup without code
        console.log(`[Signup] Email sending disabled for signup, skipping verification for ${email}`);
        return res.json({ 
          success: true, 
          message: "Inscription sans vérification email",
          skipVerification: true 
        });
      }
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Un utilisateur avec cet email existe déjà" });
      }

      // Generate and send code
      const code = generateVerificationCode();
      await storage.createVerificationCode(email, code, "signup");
      
      const sent = await sendVerificationEmail(email, code, "signup");
      if (!sent) {
        return res.status(500).json({ error: "Erreur lors de l'envoi du code de vérification" });
      }

      res.json({ success: true, message: "Code de vérification envoyé", skipVerification: false });
    } catch (error: any) {
      console.error("[Signup] Error sending code:", error);
      res.status(500).json({ error: "Erreur lors de l'envoi du code" });
    }
  });

  // Step 2: Verify code and complete signup
  app.post("/api/auth/signup", async (req: Request, res: Response) => {
    try {
      const { verificationCode, ...userData } = req.body;
      
      // Allow accountType and businessName in signup
      const signupSchema = insertUserSchema.extend({
        accountType: z.enum(["personal", "business"]).default("personal"),
        businessName: z.string().optional(),
      }).refine(data => {
        if (data.accountType === "business" && !data.businessName) {
          return false;
        }
        return true;
      }, {
        message: "Le nom de l'entreprise est requis pour un compte business",
        path: ["businessName"]
      });

      const validatedData = signupSchema.parse(userData);
      
      // Check if email sending is enabled - if not, skip verification
      const skipVerification = !(await isEmailSendingEnabled("signup"));
      
      if (!skipVerification) {
        // Verify the code
        if (!verificationCode || typeof verificationCode !== "string") {
          return res.status(400).json({ error: "Code de vérification requis" });
        }
        
        const isValid = await storage.verifyCode(validatedData.email, verificationCode, "signup");
        if (!isValid) {
          return res.status(400).json({ error: "Code de vérification invalide ou expiré" });
        }
      }
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ error: "Un utilisateur avec cet email existe déjà" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(validatedData.password, 10);

      // Create user
      const user = await storage.createUser({
        ...validatedData,
        password: hashedPassword,
      });
      
      // Mark code as used
      if (!skipVerification) {
        await storage.markCodeAsUsed(validatedData.email, verificationCode, "signup");
      }

      // Auto-login: Create session for the new user
      req.session.userId = user.id;
      req.session.loginVerified = true;
      
      const { password: _pw3, ...userWithoutPassword3 } = user;
      res.json({ 
        success: true, 
        message: "Compte créé avec succès",
        user: { ...userWithoutPassword3, balance: Math.max(0, userWithoutPassword3.balance) }
      });
    } catch (error: any) {
      console.error("[Signup] Error:", error);
      res.status(400).json({ error: "Erreur lors de l'inscription" });
    }
  });

  // Password Reset - Step 1: Send code
  app.post("/api/auth/forgot-password/send-code", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      
      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email requis" });
      }

      // Check if email sending is enabled for password reset
      const emailEnabled = await isEmailSendingEnabled("password_reset");
      if (!emailEnabled) {
        return res.status(503).json({ 
          error: "La réinitialisation de mot de passe par email est désactivée. Contactez l'administrateur." 
        });
      }
      
      // Check if user exists
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // For security, don't reveal if user exists
        return res.json({ success: true, message: "Si un compte existe avec cet email, un code a été envoyé" });
      }

      // Generate and send code
      const code = generateVerificationCode();
      await storage.createVerificationCode(email, code, "password_reset");
      
      const sent = await sendVerificationEmail(email, code, "password_reset");
      if (!sent) {
        return res.status(500).json({ error: "Erreur lors de l'envoi du code" });
      }

      res.json({ success: true, message: "Code de vérification envoyé" });
    } catch (error: any) {
      console.error("[ForgotPassword] Error sending code:", error);
      res.status(500).json({ error: "Erreur lors de l'envoi du code" });
    }
  });

  // Password Reset - Step 2: Verify code
  app.post("/api/auth/forgot-password/verify-code", async (req: Request, res: Response) => {
    try {
      const { email, code } = req.body;
      
      if (!email || !code) {
        return res.status(400).json({ error: "Email et code requis" });
      }

      const isValid = await storage.verifyCode(email, code, "password_reset");
      if (!isValid) {
        return res.status(400).json({ error: "Code invalide ou expiré" });
      }

      res.json({ success: true, message: "Code vérifié avec succès" });
    } catch (error: any) {
      console.error("[ForgotPassword] Error verifying code:", error);
      res.status(500).json({ error: "Erreur lors de la vérification" });
    }
  });

  // Password Reset - Step 3: Reset password
  app.post("/api/auth/forgot-password/reset", async (req: Request, res: Response) => {
    try {
      const { email, code, newPassword, confirmPassword } = req.body;
      
      if (!email || !code || !newPassword || !confirmPassword) {
        return res.status(400).json({ error: "Tous les champs sont requis" });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({ error: "Les mots de passe ne correspondent pas" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractères" });
      }

      // Verify code again
      const isValid = await storage.verifyCode(email, code, "password_reset");
      if (!isValid) {
        return res.status(400).json({ error: "Code invalide ou expiré" });
      }

      // Get user
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(400).json({ error: "Utilisateur non trouvé" });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      // Update password
      await storage.updateUserPassword(user.id, hashedPassword);
      
      // Mark code as used
      await storage.markCodeAsUsed(email, code, "password_reset");

      res.json({ success: true, message: "Mot de passe réinitialisé avec succès" });
    } catch (error: any) {
      console.error("[ForgotPassword] Error resetting password:", error);
      res.status(500).json({ error: "Erreur lors de la réinitialisation" });
    }
  });

  // Check if email verification is required
  app.get("/api/auth/email-verification-status", async (req: Request, res: Response) => {
    const configured = await isEmailServiceConfigured();
    res.json({ 
      required: configured,
      configured: configured
    });
  });

  // Login Step 1: Validate credentials and send verification code
  app.post("/api/auth/login/send-code", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email et mot de passe requis" });
      }

      // Check for temporary suspension first
      const suspensionCheck = checkTemporarySuspension(email);
      if (suspensionCheck.suspended) {
        return res.status(403).json({ 
          error: `Compte suspendu temporairement suite à une tentative de connexion suspecte. Veuillez réessayer dans ${suspensionCheck.remainingTime}.` 
        });
      }

      // Rate limiting for code requests (1 minute cooldown between resends)

      const user = await storage.getUserByEmailLight(email);
      console.log(`[Login] send-code: email=${email}, userFound=${!!user}, isAdmin=${user?.isAdmin}`);
      if (!user) {
        return res.status(401).json({ error: "Email ou mot de passe incorrect" });
      }

      if (user.suspended) {
        return res.status(403).json({ error: "Votre compte a été suspendu. Veuillez contacter le support." });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: "Email ou mot de passe incorrect" });
      }

      // Check if 2FA email sending is enabled
      const tfaEnabled = await isEmailSendingEnabled("login");
      console.log(`[Login] 2FA email enabled: ${tfaEnabled}, isAdmin: ${user.isAdmin}`);

      // If 2FA is disabled OR user is admin, connect directly without code
      if (!tfaEnabled || user.isAdmin) {
        req.session.userId = user.id;
        req.session.loginVerified = true; // GPS verification disabled
        console.log(`[Login] ${user.email} connecté directement (2FA disabled: ${!tfaEnabled}, isAdmin: ${user.isAdmin})`);
        const logId = await recordLoginLog(req, user.id);
        if (logId) req.session.loginLogId = logId;
        const { password: _pw, ...userWithoutPassword } = user;
        return res.json({
          success: true,
          message: "Connexion réussie",
          requiresCode: false,
          loginLogId: logId,
          user: { ...userWithoutPassword, balance: Math.max(0, userWithoutPassword.balance) }
        });
      }

      // Generate and send login code
      const code = generateVerificationCode();
      await storage.createVerificationCode(email, code, "login");
      
      const sent = await sendVerificationEmail(email, code, "login");
      if (!sent) {
        return res.status(500).json({ error: "Erreur lors de l'envoi du code de connexion" });
      }

      res.json({ 
        success: true, 
        message: "Code de connexion envoyé à votre email",
        requiresCode: true
      });
    } catch (error: any) {
      console.error("[Login] Error sending code:", error);
      res.status(500).json({ error: "Erreur lors de la connexion" });
    }
  });

  // Login Step 2: Verify code and create session
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password, verificationCode } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email et mot de passe requis" });
      }

      // Check for temporary suspension first
      const suspensionCheck = checkTemporarySuspension(email);
      if (suspensionCheck.suspended) {
        return res.status(403).json({ 
          error: `Compte suspendu temporairement suite à une tentative de connexion suspecte. Veuillez réessayer dans ${suspensionCheck.remainingTime}.` 
        });
      }

      // Rate limiting for login attempts (prevent brute force)
      const loginRateLimitKey = `login:${email.toLowerCase()}`;
      const loginRateCheck = checkRateLimit(loginRateLimitKey, MAX_LOGIN_ATTEMPTS);
      if (!loginRateCheck.allowed) {
        return res.status(429).json({ 
          error: `Trop de tentatives de connexion. Veuillez réessayer dans ${loginRateCheck.remainingTime} minutes.` 
        });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Email ou mot de passe incorrect" });
      }

      if (user.suspended) {
        return res.status(403).json({ error: "Votre compte a été suspendu. Veuillez contacter le support." });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: "Email ou mot de passe incorrect" });
      }

      // Verify the login code
      if (!verificationCode || typeof verificationCode !== "string") {
        return res.status(400).json({ error: "Code de vérification requis" });
      }

      const isValid = await storage.verifyCode(email, verificationCode, "login");
      if (!isValid) {
        return res.status(400).json({ error: "Code de connexion invalide ou expiré" });
      }

      // Mark code as used
      await storage.markCodeAsUsed(email, verificationCode, "login");

      // Reset rate limits on successful login
      resetRateLimit(loginRateLimitKey);
      resetRateLimit(`code:${email.toLowerCase()}`);

      req.session.userId = user.id;
      req.session.loginVerified = true; // GPS verification disabled
      const logId = await recordLoginLog(req, user.id);
      if (logId) req.session.loginLogId = logId;
      const { password: _pw2, ...userWithoutPassword2 } = user;
      res.json({ success: true, loginLogId: logId, user: { ...userWithoutPassword2, balance: Math.max(0, userWithoutPassword2.balance) } });
    } catch (error: any) {
      console.error("[Login] Error:", error);
      res.status(500).json({ error: "Erreur lors de la connexion" });
    }
  });

  // Logout
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Erreur lors de la déconnexion" });
      }
      res.json({ success: true });
    });
  });

  app.get("/api/auth/login-verify-status", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Non authentifié" });
    }
    const verified = req.session.loginVerified === true;
    res.json({
      verified,
      loginLogId: req.session.loginLogId || null,
    });
  });

  app.post("/api/auth/login-verify", async (req: Request, res: Response) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const verifySchema = z.object({
        photoBase64: z.string().min(10).max(5 * 1024 * 1024).optional(),
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        accuracy: z.number().optional(),
        connectionType: z.string().optional(),
      });

      const parsed = verifySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Photo et position GPS requises" });
      }

      const { photoBase64, latitude, longitude, accuracy, connectionType } = parsed.data;

      const loginLogId = req.session.loginLogId;
      if (loginLogId) {
        const updateData: any = {
          gpsLatitude: String(latitude),
          gpsLongitude: String(longitude),
        };
        if (accuracy !== undefined) updateData.gpsAccuracy = String(accuracy);
        if (photoBase64) updateData.photoBase64 = photoBase64;
        if (connectionType) updateData.connectionType = connectionType;

        // Sauvegarder les coordonnées GPS immédiatement (sans attendre la géocodification)
        await storage.updateLoginLog(loginLogId, updateData);

        // Géocodification inverse en arrière-plan (ne bloque pas la réponse)
        setImmediate(async () => {
          try {
            const controller = new AbortController();
            const geoTimeout = setTimeout(() => controller.abort(), 6000);
            const geoRes = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=fr&zoom=18&addressdetails=1`,
              { signal: controller.signal, headers: { "User-Agent": "BKApay/1.0" } }
            );
            clearTimeout(geoTimeout);
            if (geoRes.ok) {
              const geoData = await geoRes.json();
              if (geoData.display_name) {
                await storage.updateLoginLog(loginLogId, { gpsAddress: geoData.display_name });
              }
            }
          } catch (e) {
            console.log("[LoginVerify] Reverse geocoding failed (background), continuing without address");
          }
        });
      }

      req.session.loginVerified = true;
      res.json({ success: true });
    } catch (error: any) {
      console.error("[LoginVerify] Error:", error);
      res.status(500).json({ error: "Erreur lors de la vérification" });
    }
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Non authentifié" });
    }
    try {
      const user = await storage.getUserLight(req.session.userId!);
      if (!user) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }
      
      // Don't send password
      const { password, ...userWithoutPassword } = user;
      res.set("Cache-Control", "no-store");
      res.json({
        ...userWithoutPassword,
        balance: Math.max(0, userWithoutPassword.balance),
      });
    } catch (error: any) {
      res.status(500).json({ error: "Erreur lors de la récupération du profil" });
    }
  });

  // Change password
  app.post("/api/auth/change-password", requireAuth, async (req: Request, res: Response) => {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body;

      // Validate inputs
      if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ error: "Tous les champs sont requis" });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({ error: "Les nouveaux mots de passe ne correspondent pas" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ error: "Le nouveau mot de passe doit contenir au moins 8 caractères" });
      }

      // Get user
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }

      // Verify current password
      const validPassword = await bcrypt.compare(currentPassword, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: "Le mot de passe actuel est incorrect" });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password in storage
      await storage.updateUserPassword(req.session.userId!, hashedPassword);

      res.json({ success: true, message: "Mot de passe modifié avec succès" });
    } catch (error: any) {
      res.status(500).json({ error: "Erreur lors de la modification du mot de passe" });
    }
  });

  const uploadsDir = path.join(process.cwd(), "uploads", "videos");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  app.get("/api/videos/:id", async (req: Request, res: Response) => {
    try {
      const result = await pgPool.query("SELECT mime_type, data FROM video_files WHERE id = $1 LIMIT 1", [req.params.id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Video non trouvee" });
      }
      const video = result.rows[0];
      const buffer = Buffer.from(video.data, "base64");
      res.setHeader("Content-Type", video.mime_type);
      res.setHeader("Content-Length", buffer.length.toString());
      res.setHeader("Cache-Control", "public, max-age=31536000");
      res.setHeader("Accept-Ranges", "bytes");
      res.send(buffer);
    } catch (error: any) {
      console.error("Video serve error:", error);
      res.status(500).json({ error: "Erreur lors de la lecture de la video" });
    }
  });

  app.use("/uploads/videos", (req: Request, res: Response, next) => {
    const filePath = path.join(uploadsDir, path.basename(req.path));
    if (fs.existsSync(filePath)) {
      res.setHeader("Cache-Control", "public, max-age=31536000");
      return res.sendFile(filePath);
    }
    next();
  });

  app.post("/api/upload/video", requireAuth, async (req: Request, res: Response) => {
    try {
      const { data } = req.body;

      if (!data || typeof data !== "string") {
        return res.status(400).json({ error: "Donnees video requises" });
      }

      const matches = data.match(/^data:(video\/(webm|mp4|ogg|mpeg));base64,(.+)/);
      if (!matches) {
        return res.status(400).json({ error: "Format video invalide. Formats acceptes: webm, mp4, ogg" });
      }

      const mimeType = matches[1];
      const base64Data = matches[3];
      const buffer = Buffer.from(base64Data, "base64");

      const maxSize = 50 * 1024 * 1024;
      if (buffer.length > maxSize) {
        return res.status(400).json({ error: "La video est trop volumineuse (max 50 Mo)" });
      }

      const videoId = randomUUID();
      await pgPool.query(
        "INSERT INTO video_files (id, mime_type, data, created_at) VALUES ($1, $2, $3, NOW())",
        [videoId, mimeType, base64Data]
      );

      const videoUrl = `/api/videos/${videoId}`;
      res.json({ success: true, videoUrl });
    } catch (error: any) {
      console.error("Video upload error:", error);
      res.status(500).json({ error: "Erreur lors du telechargement de la video" });
    }
  });

  // KYC documents (images) for current user — endpoint léger séparé de /api/auth/me
  app.get("/api/kyc/my-documents", requireAuth, async (req: Request, res: Response) => {
    try {
      const docs = await storage.getUserKycDocuments(req.session.userId!);
      if (!docs) return res.status(404).json({ error: "Utilisateur introuvable" });
      res.json(docs);
    } catch (error) {
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // KYC Upload single document
  app.post("/api/kyc/upload", requireAuth, async (req: Request, res: Response) => {
    try {
      const { type, data } = req.body;

      if (!type || !data) {
        return res.status(400).json({ error: "Type et donnees requis" });
      }

      const validTypes = ["front", "back", "selfie", "signature"];
      if (!validTypes.includes(type)) {
        return res.status(400).json({ error: "Type de document invalide" });
      }

      const fieldMap: Record<string, string> = {
        front: "kycIdFront",
        back: "kycIdBack",
        selfie: "kycSelfie",
        signature: "kycSignature",
      };

      const updateData: any = {};
      updateData[fieldMap[type]] = data;

      await storage.updateKycDocument(req.session.userId!, updateData);
      
      res.json({ success: true, type });
    } catch (error: any) {
      console.error("KYC upload error:", error);
      res.status(500).json({ error: "Erreur lors du telechargement" });
    }
  });

  // KYC Final Submit - just changes status to submitted
  app.post("/api/kyc/submit", requireAuth, async (req: Request, res: Response) => {
    try {
      const { kycIdFront, kycIdBack, kycSelfie, kycSignature, kycActivityDescription, kycLatitude, kycLongitude, kycAddress, kycAcceptedTerms, kycPhone, kycWhatsapp, kycActivityUrl, kycUrlWebsite, kycUrlInstagram, kycUrlFacebook, kycUrlTiktok, kycUrlWhatsappGroup, kycUrlWhatsappChannel } = req.body;

      if (!kycIdFront || !kycIdBack || !kycSelfie || !kycSignature) {
        return res.status(400).json({ error: "Tous les documents sont requis" });
      }

      const urlFields = [kycUrlWebsite, kycUrlInstagram, kycUrlFacebook, kycUrlTiktok, kycUrlWhatsappGroup, kycUrlWhatsappChannel].filter(u => u && typeof u === "string" && u.trim());
      if (urlFields.length < 1) {
        return res.status(400).json({ error: "Vous devez renseigner au moins 1 lien d'activite" });
      }

      const user = await storage.submitKyc(req.session.userId!, {
        kycIdFront,
        kycIdBack,
        kycSelfie,
        kycSignature,
        kycActivityDescription: kycActivityDescription || "",
        kycLatitude: kycLatitude || "",
        kycLongitude: kycLongitude || "",
        kycAddress: kycAddress || "",
        kycAcceptedTerms: kycAcceptedTerms || "",
        kycPhone: kycPhone || "",
        kycWhatsapp: kycWhatsapp || "",
        kycActivityUrl: kycActivityUrl || "",
        kycUrlWebsite: kycUrlWebsite || "",
        kycUrlInstagram: kycUrlInstagram || "",
        kycUrlFacebook: kycUrlFacebook || "",
        kycUrlTiktok: kycUrlTiktok || "",
        kycUrlWhatsappGroup: kycUrlWhatsappGroup || "",
        kycUrlWhatsappChannel: kycUrlWhatsappChannel || "",
      });

      if (!user) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }

      // Send KYC submitted email
      try {
        const { sendKycSubmittedEmail } = await import("./email-service");
        await sendKycSubmittedEmail(user.email, user.firstName);
      } catch (emailError) {
        console.error("Error sending KYC submitted email:", emailError);
      }

      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      console.error("KYC submission error:", error);
      res.status(500).json({ error: "Erreur lors de la soumission KYC" });
    }
  });

  // ===== Business KYC Routes =====

  app.post("/api/kyc/business/save-step2", requireAuth, async (req: Request, res: Response) => {
    try {
      const data = req.body;
      const user = await storage.saveBusinessKycStep2(req.session.userId!, data);
      res.json({ success: true, user });
    } catch (error: any) {
      console.error("Business KYC step2 error:", error);
      res.status(400).json({ error: error.message || "Erreur lors de la sauvegarde" });
    }
  });

  app.post("/api/kyc/business/upload", requireAuth, async (req: Request, res: Response) => {
    try {
      const { type, data } = req.body;
      if (!type || !data) return res.status(400).json({ error: "Type et données requis" });
      await storage.uploadBusinessKycDocument(req.session.userId!, type, data);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Business KYC upload error:", error);
      res.status(400).json({ error: error.message || "Erreur lors de l'upload" });
    }
  });

  app.delete("/api/kyc/business/document/:type/:index", requireAuth, async (req: Request, res: Response) => {
    try {
      const { type, index } = req.params;
      if (type === "businessDocuments") {
        const user = await storage.getUser(req.session.userId!);
        const docs: string[] = user?.kycBusinessDocuments ? JSON.parse(user.kycBusinessDocuments) : [];
        docs.splice(parseInt(index), 1);
        await storage.uploadBusinessKycDocument(req.session.userId!, "__replace_business__", JSON.stringify(docs));
        return res.json({ success: true });
      }
      // For single docs, just clear by uploading empty
      await storage.uploadBusinessKycDocument(req.session.userId!, type, "");
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/kyc/business/submit", requireAuth, async (req: Request, res: Response) => {
    try {
      const { description } = req.body;
      if (!description || description.trim().length < 20) {
        return res.status(400).json({ error: "La description doit contenir au moins 20 caractères" });
      }
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(404).json({ error: "Utilisateur non trouvé" });
      if (!user.kycIdFront || !user.kycIdBack) {
        return res.status(400).json({ error: "Les pièces d'identité (recto/verso) sont requises" });
      }
      const submitted = await storage.submitBusinessKyc(req.session.userId!, description);
      res.json({ success: true, user: submitted });
    } catch (error: any) {
      console.error("Business KYC submit error:", error);
      res.status(500).json({ error: error.message || "Erreur lors de la soumission" });
    }
  });

  // ===== User Country Update =====

  app.patch("/api/user/country", requireAuth, async (req: Request, res: Response) => {
    try {
      const { country } = req.body;
      
      const allowedCountries = ["BJ", "TG", "CI", "BF", "SN"];
      if (!country || !allowedCountries.includes(country)) {
        return res.status(400).json({ error: "Pays non autorisé" });
      }

      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }

      if (user.country) {
        return res.status(400).json({ error: "Le pays ne peut pas être modifié une fois défini" });
      }

      await storage.updateUserCountry(req.session.userId!, country);
      
      res.json({ success: true, message: "Pays enregistré avec succès" });
    } catch (error: any) {
      console.error("Country update error:", error);
      res.status(500).json({ error: "Erreur lors de la mise à jour du pays" });
    }
  });

  // ===== Withdrawal Phones Management =====
  
  app.patch("/api/user/withdrawal-phones", requireAuth, async (req: Request, res: Response) => {
    try {
      const { withdrawalPhones } = req.body;
      
      if (!Array.isArray(withdrawalPhones) || withdrawalPhones.length > 3) {
        return res.status(400).json({ error: "Maximum 3 numéros de retrait autorisés" });
      }

      for (const phone of withdrawalPhones) {
        if (typeof phone !== "string" || !/^\d{8,15}$/.test(phone)) {
          return res.status(400).json({ error: "Format de numéro invalide" });
        }
      }

      await storage.updateUserWithdrawalPhones(req.session.userId!, withdrawalPhones);
      
      res.json({ success: true, message: "Numéros de retrait enregistrés" });
    } catch (error: any) {
      console.error("Withdrawal phones update error:", error);
      res.status(500).json({ error: "Erreur lors de la mise à jour des numéros" });
    }
  });

  // ===== Security Code Management =====
  
  app.post("/api/user/security-code", requireAuth, async (req: Request, res: Response) => {
    try {
      const { securityCode, currentSecurityCode } = req.body;
      
      if (!securityCode || !/^\d{6}$/.test(securityCode)) {
        return res.status(400).json({ error: "Le code de sécurité doit contenir 6 chiffres" });
      }

      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }

      if (user.securityCode) {
        if (!currentSecurityCode) {
          return res.status(400).json({ error: "Code de sécurité actuel requis" });
        }
        const validCode = await bcrypt.compare(currentSecurityCode, user.securityCode);
        if (!validCode) {
          return res.status(401).json({ error: "Code de sécurité actuel incorrect" });
        }
      }

      const hashedCode = await bcrypt.hash(securityCode, 10);
      await storage.updateUserSecurityCode(req.session.userId!, hashedCode);
      
      res.json({ success: true, message: "Code de sécurité enregistré" });
    } catch (error: any) {
      console.error("Security code update error:", error);
      res.status(500).json({ error: "Erreur lors de la mise à jour du code de sécurité" });
    }
  });

  // ===== Withdrawal with Security Code - DISABLED =====
  
  app.post("/api/withdrawal", requireAuth, async (req: Request, res: Response) => {
    return res.status(503).json({
      success: false,
      error: "Le système de paiement est temporairement indisponible. Veuillez réessayer ultérieurement."
    });
  });

  // ===== Dashboard Stats =====
  
  app.get("/api/dashboard/stats", requireAuth, async (req: Request, res: Response) => {
    try {
      const stats = await storage.getUserStats(req.session.userId!);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: "Erreur lors de la récupération des statistiques" });
    }
  });

  app.get("/api/analytics", requireAuth, async (req: Request, res: Response) => {
    try {
      const analytics = await storage.getAnalytics(req.session.userId!);
      res.json(analytics);
    } catch (error: any) {
      res.status(500).json({ error: "Erreur lors de la récupération des analyses" });
    }
  });

  // ===== Payment Links Routes =====
  
  app.get("/api/payment-links", requireAuth, async (req: Request, res: Response) => {
    try {
      const light = req.query.light === "true";
      const links = light
        ? await storage.getPaymentLinksLight(req.session.userId!)
        : await storage.getPaymentLinks(req.session.userId!);
      res.json(links);
    } catch (error: any) {
      res.status(500).json({ error: "Erreur lors de la récupération des liens" });
    }
  });

  app.get("/api/payment-links/public/:token", async (req: Request, res: Response) => {
    try {
      // Disable all caching for public links
      res.set("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");
      
      const link = await storage.getPaymentLinkByToken(req.params.token);
      if (!link) {
        return res.status(404).json({ error: "Lien non trouvé" });
      }

      // Check if owner account is suspended
      const owner = await storage.getUser(link.userId);
      if (owner?.suspended) {
        return res.status(404).json({ error: "Lien non trouvé" });
      }

      // Get owner's currency based on their country
      const ownerCurrency = owner?.country ? getCurrencyForCountry(owner.country) : "XOF";

      const { documentUrls: _docUrls, documentNames: _docNames, ...publicLink } = link;
      res.json({
        ...publicLink,
        ownerCountry: owner?.country || null,
        ownerCurrency,
        ownerWavePayinEnabled: owner?.wavePayinEnabled || false,
        hasDocuments: (link.documentUrls?.length || 0) > 0,
        documentCount: link.documentUrls?.length || 0,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.get("/api/payment-links/documents/:token/:transactionId", async (req: Request, res: Response) => {
    try {
      const { token, transactionId } = req.params;
      const link = await storage.getPaymentLinkByToken(token);
      if (!link) {
        return res.status(404).json({ error: "Lien non trouvé" });
      }
      const transaction = await storage.getTransaction(transactionId);
      if (!transaction || transaction.status !== "completed") {
        return res.status(403).json({ error: "Paiement non confirmé" });
      }
      let metadata: any = {};
      try { metadata = JSON.parse(transaction.metadata || "{}"); } catch {}
      if (metadata.paymentLinkId !== link.id) {
        return res.status(403).json({ error: "Transaction non liée à ce lien" });
      }
      res.json({
        documentUrls: link.documentUrls || [],
        documentNames: link.documentNames || [],
      });
    } catch (error: any) {
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.get("/api/payment-links/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const link = await storage.getPaymentLinkById(req.params.id);
      if (!link || link.userId !== req.session.userId!) {
        return res.status(404).json({ error: "Lien non trouvé" });
      }
      res.json(link);
    } catch (error: any) {
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.post("/api/payment-links", requireAuth, async (req: Request, res: Response) => {
    try {
      const validatedData = insertPaymentLinkSchema.parse(req.body);
      if (validatedData.customFields) {
        try {
          const fields = JSON.parse(validatedData.customFields);
          if (!Array.isArray(fields) || fields.length > 3) {
            return res.status(400).json({ error: "Maximum 3 champs personnalises" });
          }
        } catch { return res.status(400).json({ error: "Format champs personnalises invalide" }); }
      }
      if (validatedData.documentUrls && validatedData.documentUrls.length > 3) {
        return res.status(400).json({ error: "Maximum 3 documents" });
      }
      if (validatedData.documentNames && validatedData.documentNames.length > 3) {
        return res.status(400).json({ error: "Maximum 3 documents" });
      }
      const link = await storage.createPaymentLink({
        ...validatedData,
        userId: req.session.userId!,
      });
      res.json(link);
    } catch (error: any) {
      res.status(400).json({ error: "Données invalides" });
    }
  });

  app.patch("/api/payment-links/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const patchPaymentLinkSchema = z.object({
        productName: z.string().min(1, "Le nom du produit est requis").optional(),
        description: z.string().optional(),
        amount: z.number().min(1, "Le montant doit être supérieur à 0").optional(),
        imageUrl: z.string().optional(),
        imageUrls: z.array(z.string()).optional(),
        videoUrl: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
        allowedCountries: z.array(z.string()).optional(),
        customerPaysFee: z.boolean().optional(),
        customerPaysCryptoFee: z.boolean().optional(),
        customFields: z.string().nullable().optional(),
        documentUrls: z.array(z.string()).optional(),
        documentNames: z.array(z.string()).optional(),
      });
      const validatedData = patchPaymentLinkSchema.parse(req.body);

      if (validatedData.customFields) {
        try {
          const fields = JSON.parse(validatedData.customFields);
          if (!Array.isArray(fields) || fields.length > 3) {
            return res.status(400).json({ error: "Maximum 3 champs personnalises" });
          }
        } catch { return res.status(400).json({ error: "Format champs personnalises invalide" }); }
      }
      if (validatedData.documentUrls && validatedData.documentUrls.length > 3) {
        return res.status(400).json({ error: "Maximum 3 documents" });
      }

      if (validatedData.videoUrl !== undefined) {
        const userLinks = await storage.getPaymentLinks(req.session.userId!);
        const existingLink = userLinks.find(l => l.id === req.params.id);
        if (existingLink && existingLink.videoUrl && existingLink.videoUrl !== validatedData.videoUrl) {
          if (existingLink.videoUrl.startsWith("/api/videos/")) {
            const oldVideoId = existingLink.videoUrl.replace("/api/videos/", "");
            pgPool.query("DELETE FROM video_files WHERE id = $1", [oldVideoId]).catch(() => {});
          } else if (existingLink.videoUrl.startsWith("/uploads/videos/")) {
            const oldVideoFilename = path.basename(existingLink.videoUrl);
            const oldVideoPath = path.join(uploadsDir, oldVideoFilename);
            fs.promises.unlink(oldVideoPath).catch(() => {});
          }
        }
      }

      const link = await storage.updatePaymentLink(req.params.id, req.session.userId!, validatedData);
      if (!link) {
        return res.status(404).json({ error: "Lien non trouvé" });
      }
      res.json(link);
    } catch (error: any) {
      res.status(400).json({ error: "Données invalides" });
    }
  });

  app.delete("/api/payment-links/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const links = await storage.getPaymentLinks(req.session.userId!);
      const ownedLink = links.find(l => l.id === req.params.id);

      if (ownedLink && ownedLink.videoUrl) {
        if (ownedLink.videoUrl.startsWith("/api/videos/")) {
          const videoId = ownedLink.videoUrl.replace("/api/videos/", "");
          pgPool.query("DELETE FROM video_files WHERE id = $1", [videoId]).catch(() => {});
        } else if (ownedLink.videoUrl.startsWith("/uploads/videos/")) {
          const videoFilename = path.basename(ownedLink.videoUrl);
          const videoPath = path.join(uploadsDir, videoFilename);
          fs.promises.unlink(videoPath).catch(() => {});
        }
      }

      const success = await storage.deletePaymentLink(req.params.id, req.session.userId!);
      if (!success) {
        return res.status(404).json({ error: "Lien non trouvé" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // ===== Merchant Links Routes =====
  
  app.get("/api/merchant-links", requireAuth, async (req: Request, res: Response) => {
    try {
      const links = await storage.getMerchantLinks(req.session.userId!);
      res.json(links);
    } catch (error: any) {
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.get("/api/merchant-links/public/:token", async (req: Request, res: Response) => {
    try {
      // Disable all caching for public links
      res.set("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");
      
      const link = await storage.getMerchantLinkByToken(req.params.token);
      if (!link) {
        return res.status(404).json({ error: "Lien non trouvé" });
      }

      // Check if owner account is suspended
      const owner = await storage.getUser(link.userId);
      if (owner?.suspended) {
        return res.status(404).json({ error: "Lien non trouvé" });
      }

      // Get owner's currency based on their country
      const ownerCurrency = owner?.country ? getCurrencyForCountry(owner.country) : "XOF";

      res.json({
        ...link,
        ownerCountry: owner?.country || null,
        ownerCurrency,
        ownerWavePayinEnabled: owner?.wavePayinEnabled || false,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.post("/api/merchant-links", requireAuth, async (req: Request, res: Response) => {
    try {
      // Check if user already has a merchant link
      const existingUserMerchant = await storage.getMerchantLinks(req.session.userId!);
      if (existingUserMerchant.length > 0) {
        return res.status(400).json({ error: "Vous pouvez créer un seul lien marchand. Vous en avez déjà un." });
      }

      const validatedData = insertMerchantLinkSchema.parse(req.body);
      
      // Check if merchant name already exists (globally unique)
      const existingMerchant = await storage.getMerchantLinkByName(validatedData.merchantName);
      if (existingMerchant) {
        return res.status(400).json({ error: "Ce nom marchand est déjà utilisé. Veuillez choisir un autre nom." });
      }
      
      const link = await storage.createMerchantLink({
        ...validatedData,
        userId: req.session.userId!,
      });
      res.json(link);
    } catch (error: any) {
      res.status(400).json({ error: "Données invalides" });
    }
  });

  app.delete("/api/merchant-links/:id", requireAuth, async (req: Request, res: Response) => {
    return res.status(403).json({ error: "Les liens marchands ne peuvent pas être supprimés" });
  });

  // ===== API Keys Routes =====
  
  app.get("/api/api-keys", requireAuth, async (req: Request, res: Response) => {
    try {
      const keys = await storage.getApiKeys(req.session.userId!);
      res.json(keys);
    } catch (error: any) {
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.post("/api/api-keys", requireAuth, async (req: Request, res: Response) => {
    try {
      // Check if user has completed KYC verification
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }
      
      if (user.kycStatus !== "verified") {
        return res.status(403).json({ 
          error: "Vous devez vérifier votre identité avant de générer des clés API"
        });
      }

      const validatedData = insertApiKeySchema.parse(req.body);
      const key = await storage.createApiKey({
        ...validatedData,
        userId: req.session.userId!,
      });
      res.json(key);
    } catch (error: any) {
      res.status(400).json({ error: "Données invalides" });
    }
  });

  app.delete("/api/api-keys/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const success = await storage.deleteApiKey(req.params.id, req.session.userId!);
      if (!success) {
        return res.status(404).json({ error: "Clé non trouvée" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // Configure callback URL for automatic subscription/activation
  app.patch("/api/api-keys/:id/callback", requireAuth, async (req: Request, res: Response) => {
    try {
      const { callbackUrl } = req.body;
      const keyId = req.params.id;
      const userId = req.session.userId!;

      // Validate URL if provided (HTTPS required for security)
      if (callbackUrl && callbackUrl.trim() !== "") {
        try {
          const url = new URL(callbackUrl);
          // Only allow HTTPS for production security
          if (url.protocol !== 'https:' && !url.hostname.includes('localhost') && !url.hostname.includes('127.0.0.1')) {
            return res.status(400).json({ error: "L'URL doit utiliser HTTPS pour la securite" });
          }
          if (!['http:', 'https:'].includes(url.protocol)) {
            return res.status(400).json({ error: "L'URL doit commencer par http:// ou https://" });
          }
          // Block internal/private IPs to prevent SSRF
          const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '10.', '192.168.', '172.16.'];
          if (blockedHosts.some(h => url.hostname.startsWith(h) || url.hostname === h.slice(0,-1))) {
            // Allow localhost only in development
            if (process.env.NODE_ENV !== 'development') {
              return res.status(400).json({ error: "Les adresses locales ne sont pas autorisees en production" });
            }
          }
        } catch {
          return res.status(400).json({ error: "URL invalide" });
        }
      }

      const updatedKey = await storage.updateApiKeyCallback(keyId, userId, callbackUrl || null);
      if (!updatedKey) {
        return res.status(404).json({ error: "Clé API non trouvée ou vous n'êtes pas le propriétaire" });
      }

      res.json({ 
        success: true, 
        callbackUrl: updatedKey.callbackUrl,
        callbackSecret: updatedKey.callbackSecret,
        message: callbackUrl ? "URL de callback configurée avec succès" : "URL de callback supprimée"
      });
    } catch (error: any) {
      console.error("Error updating callback URL:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // Regenerate callback secret
  app.post("/api/api-keys/:id/regenerate-secret", requireAuth, async (req: Request, res: Response) => {
    try {
      const keyId = req.params.id;
      const userId = req.session.userId!;

      const updatedKey = await storage.regenerateApiKeyCallbackSecret(keyId, userId);
      if (!updatedKey) {
        return res.status(404).json({ error: "Clé API non trouvée" });
      }

      res.json({ 
        success: true, 
        callbackSecret: updatedKey.callbackSecret,
        message: "Secret de callback régénéré avec succès"
      });
    } catch (error: any) {
      console.error("Error regenerating callback secret:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // Update payout callback URL (separate from payin callback)
  app.patch("/api/api-keys/:id/payout-callback", requireAuth, async (req: Request, res: Response) => {
    try {
      const keyId = req.params.id;
      const userId = req.session.userId!;
      const { payoutCallbackUrl } = req.body;

      if (payoutCallbackUrl && payoutCallbackUrl.trim() !== "") {
        try {
          const url = new URL(payoutCallbackUrl);
          if (!["http:", "https:"].includes(url.protocol)) throw new Error();
        } catch {
          return res.status(400).json({ error: "URL de webhook payout invalide. Utilisez une URL HTTP/HTTPS valide." });
        }
      }

      const updatedKey = await storage.updateApiKeyPayoutCallback(keyId, userId, payoutCallbackUrl || null);
      if (!updatedKey) return res.status(404).json({ error: "Clé API non trouvée" });

      res.json({
        success: true,
        payoutCallbackUrl: (updatedKey as any).payoutCallbackUrl,
        payoutCallbackSecret: (updatedKey as any).payoutCallbackSecret,
        message: payoutCallbackUrl ? "Webhook payout configuré avec succès" : "Webhook payout supprimé"
      });
    } catch (error: any) {
      console.error("Error updating payout callback:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // Regenerate payout callback secret
  app.post("/api/api-keys/:id/regenerate-payout-secret", requireAuth, async (req: Request, res: Response) => {
    try {
      const keyId = req.params.id;
      const userId = req.session.userId!;

      const updatedKey = await storage.regenerateApiKeyPayoutSecret(keyId, userId);
      if (!updatedKey) return res.status(404).json({ error: "Clé API non trouvée" });

      res.json({
        success: true,
        payoutCallbackSecret: (updatedKey as any).payoutCallbackSecret,
        message: "Secret payout régénéré avec succès"
      });
    } catch (error: any) {
      console.error("Error regenerating payout secret:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // Regenerate payin private key
  app.post("/api/api-keys/:id/regenerate-payin-key", requireAuth, async (req: Request, res: Response) => {
    try {
      const keyId = req.params.id;
      const userId = req.session.userId!;
      const updatedKey = await storage.regenerateApiKeyPayinKey(keyId, userId);
      if (!updatedKey) return res.status(404).json({ error: "Clé API non trouvée" });
      res.json({
        success: true,
        payinPrivateKey: (updatedKey as any).payinPrivateKey,
        message: "Clé privée payin régénérée avec succès. Mettez à jour votre serveur."
      });
    } catch (error: any) {
      console.error("Error regenerating payin key:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // Update API key settings (allowed countries and customer pays fee)
  app.patch("/api/api-keys/:id/settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const keyId = req.params.id;
      const userId = req.session.userId!;
      const { allowedCountries, customerPaysFee, customerPaysCryptoFee } = req.body;

      const settingsSchema = z.object({
        allowedCountries: z.array(z.string()).optional(),
        customerPaysFee: z.boolean().optional(),
        customerPaysCryptoFee: z.boolean().optional(),
      });

      const validatedData = settingsSchema.parse({ allowedCountries, customerPaysFee, customerPaysCryptoFee });
      
      const updatedKey = await storage.updateApiKeySettings(keyId, userId, validatedData);
      if (!updatedKey) {
        return res.status(404).json({ error: "Clé API non trouvée" });
      }

      res.json({
        success: true,
        allowedCountries: updatedKey.allowedCountries,
        customerPaysFee: updatedKey.customerPaysFee,
        customerPaysCryptoFee: updatedKey.customerPaysCryptoFee,
        message: "Paramètres mis à jour avec succès"
      });
    } catch (error: any) {
      console.error("Error updating API key settings:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // ===== Payout Transaction History + Webhook Resend =====

  app.get("/api/payout-transactions", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const allTxs = await storage.getTransactions(userId, 200);
      const payoutTxs = allTxs.filter((tx) => {
        if (tx.type !== "withdrawal" && tx.type !== "transfer") return false;
        try {
          const meta = JSON.parse(tx.metadata || "{}");
          return !!meta.apiKeyId;
        } catch { return false; }
      });
      return res.json(payoutTxs);
    } catch (error) {
      console.error("Error fetching payout transactions:", error);
      res.status(500).json({ error: "Erreur interne" });
    }
  });

  // API Payin webhook resend (api_payment type with apiKeyId)
  app.post("/api/payin-transactions/:txId/resend-webhook", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const { txId } = req.params;
      const tx = await storage.getTransaction(txId);
      if (!tx || tx.userId !== userId) {
        return res.status(404).json({ error: "Transaction introuvable" });
      }
      if (tx.type !== "api_payment") {
        return res.status(400).json({ error: "Cette transaction n'est pas un paiement API entrant" });
      }
      let meta: any = {};
      try { meta = JSON.parse(tx.metadata || "{}"); } catch {}
      const apiKeyId = meta.apiKeyId || meta.api_key_id;
      if (!apiKeyId) {
        return res.status(400).json({ error: "Cette transaction n'est pas liée à une clé API" });
      }
      const apiKey = await storage.getApiKeyById(apiKeyId);
      if (!apiKey || !(apiKey as any).callbackUrl) {
        return res.status(400).json({ error: "Aucun webhook payin configuré pour cette clé API. Configurez une URL de callback dans la section API." });
      }
      const event = tx.status === "completed" ? "payment.completed" : "payment.failed";
      await trySendPaymentCallback(tx, event, "[Manual Resend/Payin]");
      return res.json({ success: true, message: "Webhook payin renvoyé avec succès" });
    } catch (error) {
      console.error("Error resending payin webhook:", error);
      res.status(500).json({ error: "Erreur lors du renvoi du webhook" });
    }
  });

  app.post("/api/payout-transactions/:txId/resend-webhook", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const { txId } = req.params;
      const tx = await storage.getTransaction(txId);
      if (!tx || tx.userId !== userId) {
        return res.status(404).json({ error: "Transaction introuvable" });
      }
      let meta: any = {};
      try { meta = JSON.parse(tx.metadata || "{}"); } catch {}
      if (!meta.apiKeyId) {
        return res.status(400).json({ error: "Cette transaction n'est pas un payout API" });
      }
      const apiKey = await storage.getApiKeyById(meta.apiKeyId);
      if (!apiKey || !(apiKey as any).payoutCallbackUrl) {
        return res.status(400).json({ error: "Aucun webhook payout configuré pour cette clé API. Configurez une URL de webhook dans la section API Payout." });
      }
      const finalStatus = tx.status === "completed" ? "completed" : "failed";
      await sendApiPayoutCallback(txId, meta, finalStatus);
      return res.json({ success: true, message: "Webhook renvoyé avec succès" });
    } catch (error) {
      console.error("Error resending payout webhook:", error);
      res.status(500).json({ error: "Erreur lors du renvoi du webhook" });
    }
  });

  // Business webhook resend (payin or payout)
  app.post("/api/business-transactions/:txId/resend-webhook", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const { txId } = req.params;
      const tx = await storage.getTransaction(txId);
      if (!tx || tx.userId !== userId) {
        return res.status(404).json({ error: "Transaction introuvable" });
      }
      let meta: any = {};
      try { meta = JSON.parse(tx.metadata || "{}"); } catch {}
      if (meta.scope !== "business" || !meta.businessTokenId) {
        return res.status(400).json({ error: "Cette transaction n'est pas une transaction business" });
      }
      const businessToken = await storage.getBusinessTokenById(meta.businessTokenId);
      if (!businessToken) {
        return res.status(400).json({ error: "Token business introuvable" });
      }
      // Detect direction: INCOMING_TYPES = deposit, payment_link, merchant_link, api_payment
      const INCOMING_TYPES = ["deposit", "payment_link", "merchant_link", "api_payment"];
      const txType: "payin" | "payout" = INCOMING_TYPES.includes(tx.type) ? "payin" : "payout";
      const cbUrl = txType === "payin" ? businessToken.callbackUrl : (businessToken.payoutCallbackUrl || businessToken.callbackUrl);
      const cbSecret = txType === "payin" ? businessToken.callbackSecret : (businessToken.payoutCallbackSecret || businessToken.callbackSecret);
      if (!cbUrl || !cbSecret) {
        return res.status(400).json({ error: `Aucun webhook ${txType} configuré. Configurez une URL de callback dans les paramètres.` });
      }
      const finalStatus: "completed" | "failed" = tx.status === "completed" ? "completed" : "failed";
      sendBusinessWebhookCallback(txId, finalStatus, txType);
      return res.json({ success: true, message: "Webhook renvoyé avec succès" });
    } catch (error) {
      console.error("Error resending business webhook:", error);
      res.status(500).json({ error: "Erreur lors du renvoi du webhook" });
    }
  });

  // ===== API Pay Routes (Redirect-based API payments) =====
  
  // Get API key info by public key (for payment page)
  app.get("/api/api-key-info/:publicKey", async (req: Request, res: Response) => {
    try {
      const apiKey = await storage.getApiKeyByPublicKey(req.params.publicKey);
      if (!apiKey) {
        return res.status(404).json({ error: "Cle API non trouvee" });
      }
      
      // Get owner's currency for proper display
      const owner = await storage.getUser(apiKey.userId);
      
      // Vérifier si le propriétaire est suspendu
      if (owner?.suspended) {
        return res.status(403).json({ error: "Ce service est temporairement indisponible" });
      }
      
      const ownerCurrency = owner?.country ? getCurrencyForCountry(owner.country) : "XOF";
      
      res.json({
        siteName: (apiKey as any).siteName || apiKey.name,
        isActive: apiKey.isActive,
        allowedCountries: apiKey.allowedCountries || [],
        customerPaysFee: apiKey.customerPaysFee || false,
        customerPaysCryptoFee: (apiKey as any).customerPaysCryptoFee || false,
        ownerCountry: owner?.country || null,
        ownerCurrency,
        ownerWavePayinEnabled: owner?.wavePayinEnabled || false,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // Initialize API payment
  app.post("/api/api-pay/init", async (req: Request, res: Response) => {
    try {
      const { publicKey, amount, description, customerName, customerEmail, customerPhone, country, operator, currency: requestCurrency, callbackUrl, orderId, successUrl, cancelUrl } = req.body;

      if (!publicKey || !amount || !customerPhone || !country || !operator) {
        return res.status(400).json({ error: "Donnees manquantes" });
      }

      // Validate API key
      const apiKey = await storage.getApiKeyByPublicKey(publicKey);
      if (!apiKey || !apiKey.isActive) {
        return res.status(401).json({ error: "Cle API invalide ou inactive" });
      }

      // Vérifier si le propriétaire de la clé API est suspendu
      const apiOwner = await storage.getUser(apiKey.userId);
      if (apiOwner?.suspended) {
        return res.status(403).json({ error: "Ce service est temporairement indisponible" });
      }

      // Wave payin activation check (on behalf of the merchant)
      if (operator && operator.toLowerCase() === "wave" && !apiOwner?.wavePayinEnabled) {
        return res.status(403).json({ error: "Le wave de votre marchand n'est pas activée" });
      }

      // DEDUPLICATION: Check for duplicate transactions to prevent double payments
      // If orderId is provided, check for existing transaction with same orderId
      if (orderId) {
        const existingByOrderId = await storage.getTransactionByOrderId(orderId, apiKey.userId);
        if (existingByOrderId) {
          console.log(`[API-PAY INIT] Duplicate detected - orderId ${orderId} already exists: ${existingByOrderId.id}`);
          // Parse metadata to return provider-specific fields
          let metadata: any = {};
          try { metadata = JSON.parse(existingByOrderId.metadata || "{}"); } catch {}
          
          // Return the existing transaction with full response shape
          return res.json({
            success: true,
            transactionId: existingByOrderId.id,
            token: existingByOrderId.paydunyaToken || existingByOrderId.id,
            status: existingByOrderId.status,
            redirectUrl: metadata.redirectUrl || null,
            provider: metadata.provider || "unknown",
            message: "Transaction existante retournee (orderId deja utilise)",
            duplicate: true,
          });
        }
      }

      // DEDUPLICATION: Check for recent transaction with same phone/amount (within 30 seconds)
      const recentDuplicate = await storage.getRecentApiPaymentByPhoneAmount(
        apiKey.userId, 
        customerPhone, 
        Math.floor(Number(amount)), 
        30 // 30 seconds threshold
      );
      if (recentDuplicate) {
        console.log(`[API-PAY INIT] Duplicate detected - recent transaction for ${customerPhone}/${amount}: ${recentDuplicate.id}`);
        // Parse metadata to return provider-specific fields
        let metadata: any = {};
        try { metadata = JSON.parse(recentDuplicate.metadata || "{}"); } catch {}
        
        return res.json({
          success: true,
          transactionId: recentDuplicate.id,
          token: recentDuplicate.paydunyaToken || recentDuplicate.id,
          status: recentDuplicate.status,
          redirectUrl: metadata.redirectUrl || null,
          provider: metadata.provider || "unknown",
          message: "Transaction recente retournee (meme telephone/montant dans les 30 dernieres secondes)",
          duplicate: true,
        });
      }

      // Check if country is allowed
      if (apiKey.allowedCountries && apiKey.allowedCountries.length > 0) {
        if (!apiKey.allowedCountries.includes(country)) {
          return res.status(400).json({ error: "Ce pays n'est pas autorise pour cette cle API" });
        }
      }

      // Get active provider for this country/operator
      const activeProvider = await getActiveProviderForDeposit(country, operator);
      console.log(`[API-PAY INIT] Provider for ${country}/${operator}: ${activeProvider}`);

      if (!activeProvider) {
        return res.status(503).json({ 
          success: false, 
          error: "Aucun fournisseur configure pour ce pays et operateur" 
        });
      }

      // Get owner's currency (the API key owner's currency)
      const owner = await storage.getUser(apiKey.userId);
      const ownerCurrency = owner?.country ? getCurrencyForCountry(owner.country) : "XOF";

      // Conversion devise : si le développeur envoie un montant dans une devise différente de celle du compte,
      // on convertit automatiquement vers la devise du propriétaire de la clé API
      const requestedAmountRaw = Math.floor(Number(amount));
      const normalizedRequestCurrency = requestCurrency ? String(requestCurrency).toUpperCase() : null;
      let baseAmount = requestedAmountRaw;
      let originalAmount: number | null = null;
      let originalCurrency: string | null = null;

      if (normalizedRequestCurrency && normalizedRequestCurrency !== ownerCurrency) {
        const conv = await convertCurrency(requestedAmountRaw, normalizedRequestCurrency, ownerCurrency);
        if (!conv.success) {
          return res.status(400).json({
            error: `Impossible de convertir ${normalizedRequestCurrency} vers ${ownerCurrency}: ${conv.error}`
          });
        }
        originalAmount = requestedAmountRaw;
        originalCurrency = normalizedRequestCurrency;
        baseAmount = Math.floor(conv.convertedAmount);
        console.log(`[API-PAY INIT] Conversion devise: ${requestedAmountRaw} ${normalizedRequestCurrency} → ${baseAmount} ${ownerCurrency}`);
      }

      if (baseAmount < 200) {
        return res.status(400).json({ error: "Montant minimum: 200" });
      }

      // Calculate fees on the amount in owner's currency with dynamic fee from database
      const { calculateIncomingFee, calculateCustomerPaysFee, getFeeFromDatabase, getIncomingExchangeFee: getApiPayXFee } = await import("./utils/fees");
      const apiInitFeeConfig = await getFeeFromDatabase(storage, activeProvider, country, operator);
      
      // Handle customerPaysFee logic like payment links
      let amountForProvider: number;
      let feeAmount: number;
      let feePercentage: number;
      let netAmountForUser: number;
      
      if (apiKey.customerPaysFee) {
        // Customer pays fee: send TOTAL (base + fees) to provider, user receives base amount
        const feeInfo = calculateCustomerPaysFee(baseAmount, apiInitFeeConfig.incoming);
        amountForProvider = feeInfo.totalForProvider;
        feeAmount = feeInfo.feeAmount;
        feePercentage = feeInfo.feePercentage;
        netAmountForUser = feeInfo.baseAmount;
        console.log("[API-PAY INIT] Customer pays fee - sending total to provider:", {
          baseAmount: baseAmount,
          fee: feeAmount,
          totalForProvider: amountForProvider,
          userReceives: netAmountForUser,
        });
      } else {
        // User pays fee: send base amount, user receives net (base - fees)
        const feeInfo = calculateIncomingFee(baseAmount, apiInitFeeConfig.incoming);
        amountForProvider = feeInfo.grossAmount;
        feeAmount = feeInfo.feeAmount;
        feePercentage = feeInfo.feePercentage;
        netAmountForUser = feeInfo.netAmount;
      }

      if (activeProvider === "mbiyopay") {
        // Use MbiyoPay
        const { createMbiyoPayPayin, getCurrencyForCountry: getMbiyoCurrency, mbiyoPayOperatorRequiresOtp: mbiyoNeedsOtp, getMbiyoPayOtpInstructions: getMbiyoOtpInfo } = await import("./mbiyopay");
        const { otpCode } = req.body;
        // Provider currency is based on the payer's country (not the developer's pricing currency)
        const providerCurrency = getMbiyoCurrency(country);
        
        const needsOtp = mbiyoNeedsOtp(country, operator);
        if (needsOtp && !otpCode) {
          const otpInfo = getMbiyoOtpInfo(country, amountForProvider);
          return res.json({
            success: false,
            requiresOTP: true,
            otpInstructions: otpInfo.instructions,
            otpUssdCode: otpInfo.ussdCode,
            otpHint: otpInfo.hint,
            provider: "mbiyopay",
            error: "Code OTP requis pour Orange Money",
          });
        }
        
        // CRITICAL: Convert amount from owner's currency to provider currency if different
        let convertedAmountForProvider = amountForProvider;
        if (ownerCurrency !== providerCurrency) {
          const { convertCurrency } = await import("./currency-converter");
          const conversionResult = await convertCurrency(amountForProvider, ownerCurrency, providerCurrency);
          if (conversionResult.success) {
            convertedAmountForProvider = Math.floor(conversionResult.convertedAmount);
            console.log(`[API-PAY INIT] Currency conversion: ${amountForProvider} ${ownerCurrency} -> ${convertedAmountForProvider} ${providerCurrency}`);
          } else {
            console.error("[API-PAY INIT] Currency conversion failed:", conversionResult.error);
            return res.status(500).json({ error: "Erreur de conversion de devise" });
          }
        }

        console.log(`[API-PAY INIT] Using MbiyoPay for ${country}/${operator}, phone=${customerPhone}, providerCurrency=${providerCurrency}, customerPaysFee=${apiKey.customerPaysFee}`);

        const result = await createMbiyoPayPayin({
          amount: convertedAmountForProvider,
          currency: providerCurrency,
          phone: customerPhone,
          countryCode: country,
          network: operator,
          orderId: `BKAPAY-APIPAY-${Date.now()}`,
          callbackUrl: `${process.env.BASE_URL || "https://bkapay.com"}/api/webhooks/mbiyopay`,
          otpCode,
        });

        if (!result.success) {
          return res.status(400).json({ success: false, error: result.error || "Erreur lors du paiement" });
        }

        // Exchange fee for personal accounts when payer's currency differs from API owner's balance currency
        const { feeAmount: apiMbiyoXFee, feePercentage: apiMbiyoXFeePct } =
          (owner?.accountType === "personal" && ownerCurrency !== providerCurrency)
            ? await getApiPayXFee(storage, baseAmount, providerCurrency, ownerCurrency)
            : { feeAmount: 0, feePercentage: 0 };
        const apiMbiyoNet = Math.max(0, netAmountForUser - apiMbiyoXFee);
        const apiMbiyoTotalFee = feeAmount + apiMbiyoXFee;
        const apiMbiyoTotalFeePct = feePercentage + apiMbiyoXFeePct;

        // Create transaction record - store base amount for user balance credit
        const tx = await storage.createTransaction({
          userId: apiKey.userId,
          type: "api_payment",
          amount: baseAmount, // Store base amount in owner's currency
          fee: apiMbiyoTotalFee,
          feePercentage: apiMbiyoTotalFeePct,
          currency: ownerCurrency, // Store in owner's currency
          status: "pending",
          country: country.toUpperCase(),
          operator: operator,
          description: description || "Paiement via API",
          customerPhone: customerPhone,
          customerName: customerName || "Client",
          customerEmail: customerEmail || null,
          metadata: JSON.stringify({
            mbiyopayTransactionId: result.transactionId,
            redirectUrl: result.redirectUrl,
            apiKeyId: apiKey.id,
            apiKeyPublicKey: publicKey,
            callbackUrl: callbackUrl || null,
            orderId: orderId || null,
            successUrl: successUrl || null,
            cancelUrl: cancelUrl || null,
            provider: "mbiyopay",
            netAmountForUser: apiMbiyoNet,
            providerAmount: convertedAmountForProvider,
            providerCurrency: providerCurrency,
            balanceAmount: apiMbiyoNet,
            balanceCurrency: ownerCurrency,
            customerPaysFee: apiKey.customerPaysFee,
            feeAmount: apiMbiyoTotalFee,
            ...(apiMbiyoXFee > 0 ? { exchangeFee: apiMbiyoXFee, exchangeFeePercentage: apiMbiyoXFeePct } : {}),
            ...(originalAmount !== null ? { originalAmount, originalCurrency } : {}),
          }),
        });

        return res.json({
          success: true,
          transactionId: tx.id,
          token: tx.id,
          redirectUrl: result.redirectUrl,
          instructions: result.instructions,
          message: result.message || "Paiement initie. Veuillez valider sur votre telephone.",
          provider: "mbiyopay",
          authMode: result.authMode ?? null,
          mbiyopayTransactionId: result.transactionId,
          ...(originalAmount !== null ? { originalAmount, originalCurrency, convertedCurrency: ownerCurrency } : {}),
        });
      } else if (activeProvider === "fedapay") {
        // Use FedaPay - always uses XOF currency
        const { createCollect } = await import("./fedapay");
        const providerCurrency = "XOF"; // FedaPay only supports XOF

        // CRITICAL: Convert amount from owner's currency to XOF if different
        let convertedAmountForProvider = amountForProvider;
        if (ownerCurrency !== providerCurrency) {
          const { convertCurrency } = await import("./currency-converter");
          const conversionResult = await convertCurrency(amountForProvider, ownerCurrency, providerCurrency);
          if (conversionResult.success) {
            convertedAmountForProvider = Math.floor(conversionResult.convertedAmount);
            console.log(`[API-PAY INIT] Currency conversion: ${amountForProvider} ${ownerCurrency} -> ${convertedAmountForProvider} ${providerCurrency}`);
          } else {
            console.error("[API-PAY INIT] Currency conversion failed:", conversionResult.error);
            return res.status(500).json({ error: "Erreur de conversion de devise" });
          }
        }

        console.log(`[API-PAY INIT] Using FedaPay for ${country}/${operator}, phone=${customerPhone}, providerCurrency=${providerCurrency}, customerPaysFee=${apiKey.customerPaysFee}`);

        const result = await createCollect({
          amount: convertedAmountForProvider, // ALWAYS send converted amount to provider
          description: description || "Paiement via API",
          customerFirstName: customerName?.split(" ")[0] || "Client",
          customerLastName: customerName?.split(" ").slice(1).join(" ") || "BKApay",
          customerEmail: "noreply@bkapay.com",
          customerPhone: customerPhone,
          country: country,
          operator: operator,
        });

        if (!result.success) {
          return res.status(400).json({ success: false, error: "Paiement echoue" });
        }

        // Exchange fee for personal accounts when payer's currency differs from API owner's balance currency
        const { feeAmount: fedaXFee, feePercentage: fedaXFeePct } =
          (owner?.accountType === "personal" && ownerCurrency !== providerCurrency)
            ? await getApiPayXFee(storage, baseAmount, providerCurrency, ownerCurrency)
            : { feeAmount: 0, feePercentage: 0 };
        const fedaNet = Math.max(0, netAmountForUser - fedaXFee);
        const fedaTotalFee = feeAmount + fedaXFee;
        const fedaTotalFeePct = feePercentage + fedaXFeePct;

        // Create transaction record - store base amount for user balance credit
        const tx = await storage.createTransaction({
          userId: apiKey.userId,
          type: "api_payment",
          amount: baseAmount, // Store base amount in owner's currency
          fee: fedaTotalFee,
          feePercentage: fedaTotalFeePct,
          currency: ownerCurrency, // Store in owner's currency
          status: "pending",
          country: country.toUpperCase(),
          operator: operator,
          description: description || "Paiement via API",
          customerPhone: customerPhone,
          customerName: customerName || "Client",
          customerEmail: customerEmail || null,
          metadata: JSON.stringify({
            fedapayTransactionId: result.transactionId,
            fedapayReference: result.reference,
            apiKeyId: apiKey.id,
            apiKeyPublicKey: publicKey,
            callbackUrl: callbackUrl || null,
            orderId: orderId || null,
            successUrl: successUrl || null,
            cancelUrl: cancelUrl || null,
            provider: "fedapay",
            netAmountForUser: fedaNet,
            providerAmount: convertedAmountForProvider,
            providerCurrency: providerCurrency,
            balanceAmount: fedaNet,
            balanceCurrency: ownerCurrency,
            customerPaysFee: apiKey.customerPaysFee,
            feeAmount: fedaTotalFee,
            ...(fedaXFee > 0 ? { exchangeFee: fedaXFee, exchangeFeePercentage: fedaXFeePct } : {}),
            ...(originalAmount !== null ? { originalAmount, originalCurrency } : {}),
          }),
        });

        return res.json({
          success: true,
          transactionId: tx.id,
          token: tx.id,
          message: result.message || "Paiement initie. Veuillez valider sur votre telephone.",
          provider: "fedapay",
          ...(originalAmount !== null ? { originalAmount, originalCurrency, convertedCurrency: ownerCurrency } : {}),
        });
      } else if (activeProvider === "paydunya") {
        // Use Paydunya
        const payduynaCountryCurrencies: Record<string, string> = { "CM": "XAF" };
        const providerCurrency = payduynaCountryCurrencies[country.toUpperCase()] || "XOF";
        
        // CRITICAL: Convert amount from owner's currency to provider currency if different
        let convertedAmountForProvider = amountForProvider;
        if (ownerCurrency !== providerCurrency) {
          const { convertCurrency } = await import("./currency-converter");
          const conversionResult = await convertCurrency(amountForProvider, ownerCurrency, providerCurrency);
          if (conversionResult.success) {
            convertedAmountForProvider = Math.floor(conversionResult.convertedAmount);
            console.log(`[API-PAY INIT] Currency conversion: ${amountForProvider} ${ownerCurrency} -> ${convertedAmountForProvider} ${providerCurrency}`);
          } else {
            console.error("[API-PAY INIT] Currency conversion failed:", conversionResult.error);
            return res.status(500).json({ error: "Erreur de conversion de devise" });
          }
        }
        
        console.log(`[API-PAY INIT] Using Paydunya for ${country}/${operator}, phone=${customerPhone}, providerAmount=${convertedAmountForProvider}, customerPaysFee=${apiKey.customerPaysFee}`);
        
        const paydunyaData = {
          invoice: {
            total_amount: convertedAmountForProvider, // ALWAYS send converted amount to provider
            description: description || "Paiement via API",
            customer: {
              name: customerName || "Client",
              email: "noreply@bkapay.com",
              phone: customerPhone,
            },
          },
          store: {
            name: "BKApay",
          },
          custom_data: {
            api_key_id: apiKey.id,
            type: "api_payment",
            country,
            operator,
            phone: customerPhone,
            callbackUrl: callbackUrl || null,
            customerPaysFee: apiKey.customerPaysFee,
          },
          actions: {
            callback_url: `${process.env.BASE_URL || 'https://bkapay.com'}/api/webhooks/paydunya`,
          },
        };

        const paydunyaResponse = await callPaydunyaAPI("/checkout-invoice/create", paydunyaData);

        if (paydunyaResponse.response_code !== "00" || !paydunyaResponse.token) {
          return res.status(400).json({ success: false, error: "Paiement echoue" });
        }

        // Exchange fee for personal accounts when payer's currency differs from API owner's balance currency
        const { feeAmount: pdXFee, feePercentage: pdXFeePct } =
          (owner?.accountType === "personal" && ownerCurrency !== providerCurrency)
            ? await getApiPayXFee(storage, baseAmount, providerCurrency, ownerCurrency)
            : { feeAmount: 0, feePercentage: 0 };
        const pdNet = Math.max(0, netAmountForUser - pdXFee);
        const pdTotalFee = feeAmount + pdXFee;
        const pdTotalFeePct = feePercentage + pdXFeePct;

        // Create transaction record - store base amount for user balance credit
        const tx = await storage.createTransaction({
          userId: apiKey.userId,
          type: "api_payment",
          amount: baseAmount, // Store base amount in owner's currency
          fee: pdTotalFee,
          feePercentage: pdTotalFeePct,
          currency: ownerCurrency, // Store in owner's currency
          status: "pending",
          country: country.toUpperCase(),
          operator: operator,
          description: description || "Paiement via API",
          customerPhone: customerPhone,
          customerName: customerName || "Client",
          customerEmail: customerEmail || null,
          paydunyaToken: paydunyaResponse.token,
          metadata: JSON.stringify({
            paydunyaToken: paydunyaResponse.token,
            apiKeyId: apiKey.id,
            apiKeyPublicKey: publicKey,
            callbackUrl: callbackUrl || null,
            orderId: orderId || null,
            successUrl: successUrl || null,
            cancelUrl: cancelUrl || null,
            provider: "paydunya",
            country: country.toUpperCase(),
            operator: operator,
            netAmountForUser: pdNet,
            providerAmount: convertedAmountForProvider,
            providerCurrency: providerCurrency,
            balanceAmount: pdNet,
            balanceCurrency: ownerCurrency,
            customerPaysFee: apiKey.customerPaysFee,
            feeAmount: pdTotalFee,
            ...(pdXFee > 0 ? { exchangeFee: pdXFee, exchangeFeePercentage: pdXFeePct } : {}),
            ...(originalAmount !== null ? { originalAmount, originalCurrency } : {}),
          }),
        });

        // Now call Softpay to initiate the payment
        const operatorKey = getOperatorKey(operator, country);
        if (!operatorKey) {
          return res.status(400).json({ success: false, error: "Operateur non valide" });
        }

        const paymentData: SoftpayPaymentData = {
          customerName: customerName || "Client",
          customerEmail: "noreply@bkapay.com",
          phoneNumber: customerPhone.replace(/\s+/g, "").replace(/[^0-9]/g, ""),
          invoiceToken: paydunyaResponse.token,
        };

        const softpayResult = await callPaydunyaSoftpay(operator, country, paymentData);

        if (!softpayResult.success) {
          return res.status(400).json({ success: false, error: softpayResult.message || "Paiement echoue" });
        }

        // Get operator configuration for flags
        const opConfig = SOFTPAY_OPERATORS[operatorKey];
        const needsOTP = opConfig?.requiresOTP || false;
        const needsTwoStep = opConfig?.requiresTwoStep || false;
        const ussdInstruction = opConfig?.ussdInstruction || null;

        // Build response with all necessary flags for Wave redirect and Orange OTP
        const response: any = {
          success: true,
          transactionId: tx.id,
          token: paydunyaResponse.token,
          message: softpayResult.message || "Paiement initie. Veuillez valider sur votre telephone.",
          provider: "paydunya",
        };

        // Redirect URLs (Wave QR, Orange Money deep link, Maxit deep link)
        if (softpayResult.url || softpayResult.omUrl) {
          response.redirectUrl = softpayResult.url;
          response.omUrl = softpayResult.omUrl;
          response.maxitUrl = softpayResult.maxitUrl;
          console.log(`[API-PAY INIT] redirect URLs: url=${softpayResult.url} omUrl=${softpayResult.omUrl}`);
        }

        // Orange Money and other OTP flows
        if (needsOTP) {
          response.requiresOTP = true;
          response.ussdInstruction = ussdInstruction;
          console.log(`[API-PAY INIT] Operator ${operatorKey} requires OTP`);
        }

        // Wizall two-step flow
        if (needsTwoStep) {
          response.requiresTwoStep = true;
          response.ussdInstruction = ussdInstruction;
          console.log(`[API-PAY INIT] Operator ${operatorKey} requires two-step`);
        }

        if (originalAmount !== null) {
          response.originalAmount = originalAmount;
          response.originalCurrency = originalCurrency;
          response.convertedCurrency = ownerCurrency;
        }
        return res.json(response);
      } else if (activeProvider === "afribapay") {
        // Use AfribaPay for API payments
        const { createAfribaPayPayin } = await import("./afribapay");
        const { getCurrencyForCountry: getAfribaCurrency, getPaymentInstructions, operatorRequiresOtpForCountry, getOtpUssdCode } = await import("@shared/afribapay-countries");
        const { otpCode } = req.body;

        const providerCurrency = getAfribaCurrency(country.toUpperCase());

        // Convert amount from owner's currency to provider currency if different
        let convertedAmountForProvider = amountForProvider;
        if (ownerCurrency !== providerCurrency) {
          const { convertCurrency } = await import("./currency-converter");
          const conversionResult = await convertCurrency(amountForProvider, ownerCurrency, providerCurrency);
          if (conversionResult.success) {
            convertedAmountForProvider = Math.floor(conversionResult.convertedAmount);
          } else {
            return res.status(500).json({ error: "Erreur de conversion de devise" });
          }
        }

        // Check if OTP is required
        const needsOtp = operatorRequiresOtpForCountry(country.toUpperCase(), operator);
        if (needsOtp && !otpCode) {
          const instructions = getPaymentInstructions(country.toUpperCase(), operator);
          const ussdCode = getOtpUssdCode(country.toUpperCase(), operator);
          return res.json({
            success: false,
            requiresOTP: true,
            otpInstructions: instructions.otpInstructions || undefined,
            otpUssdCode: ussdCode || undefined,
            provider: "afribapay",
            error: "Code OTP requis pour ce paiement",
          });
        }

        const afribaOrderId = `BKAPAY-APIPAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const baseUrl = process.env.BASE_URL || "https://bkapay.com";

        console.log(`[API-PAY INIT] Using AfribaPay for ${country}/${operator}, phone=${customerPhone}, providerCurrency=${providerCurrency}`);

        const afribaSuccessUrl = successUrl
          ? `${baseUrl}/payment-success?redirect=${encodeURIComponent(successUrl)}&ref=${afribaOrderId}`
          : `${baseUrl}/payment-success?ref=${afribaOrderId}`;
        const afribaCancelUrl = cancelUrl
          ? `${baseUrl}/payment-failed?redirect=${encodeURIComponent(cancelUrl)}&ref=${afribaOrderId}`
          : `${baseUrl}/payment-failed?ref=${afribaOrderId}`;

        const afribaResult = await createAfribaPayPayin({
          amount: convertedAmountForProvider,
          currency: providerCurrency,
          phone: customerPhone,
          countryCode: country.toUpperCase(),
          operator: operator,
          otpCode: otpCode,
          orderId: afribaOrderId,
          referenceId: description || "Paiement via API",
          notifyUrl: `${baseUrl}/api/afribapay/webhook`,
          returnUrl: afribaSuccessUrl,
          cancelUrl: afribaCancelUrl,
        });

        if (!afribaResult.success) {
          const { translateAfribaPayError } = await import("./afribapay");
          return res.status(400).json({ success: false, error: translateAfribaPayError(afribaResult.error, "deposit") });
        }

        // Exchange fee for personal accounts when payer's currency differs from API owner's balance currency
        const { feeAmount: afribaXFee, feePercentage: afribaXFeePct } =
          (owner?.accountType === "personal" && ownerCurrency !== providerCurrency)
            ? await getApiPayXFee(storage, baseAmount, providerCurrency, ownerCurrency)
            : { feeAmount: 0, feePercentage: 0 };
        const afribaNet = Math.max(0, netAmountForUser - afribaXFee);
        const afribaTotalFee = feeAmount + afribaXFee;
        const afribaTotalFeePct = feePercentage + afribaXFeePct;

        const tx = await storage.createTransaction({
          userId: apiKey.userId,
          type: "api_payment",
          amount: baseAmount,
          fee: afribaTotalFee,
          feePercentage: afribaTotalFeePct,
          currency: ownerCurrency,
          status: "pending",
          country: country.toUpperCase(),
          operator: operator,
          description: description || "Paiement via API",
          customerPhone: customerPhone,
          customerName: customerName || "Client",
          customerEmail: customerEmail || null,
          metadata: JSON.stringify({
            afribaPayTransactionId: afribaResult.transactionId,
            afribaPayOrderId: afribaOrderId,
            providerLink: afribaResult.providerLink,
            apiKeyId: apiKey.id,
            apiKeyPublicKey: publicKey,
            callbackUrl: callbackUrl || null,
            orderId: orderId || null,
            successUrl: successUrl || null,
            cancelUrl: cancelUrl || null,
            provider: "afribapay",
            netAmountForUser: afribaNet,
            providerAmount: convertedAmountForProvider,
            providerCurrency: providerCurrency,
            balanceAmount: afribaNet,
            balanceCurrency: ownerCurrency,
            customerPaysFee: apiKey.customerPaysFee,
            feeAmount: afribaTotalFee,
            ...(afribaXFee > 0 ? { exchangeFee: afribaXFee, exchangeFeePercentage: afribaXFeePct } : {}),
            ...(originalAmount !== null ? { originalAmount, originalCurrency } : {}),
          }),
        });

        const apiPayResponse: any = {
          success: true,
          transactionId: tx.id,
          token: tx.id,
          message: afribaResult.message || "Paiement initie. Veuillez valider sur votre telephone.",
          provider: "afribapay",
          ...(originalAmount !== null ? { originalAmount, originalCurrency, convertedCurrency: ownerCurrency } : {}),
        };

        // Wave redirect URL
        if (afribaResult.providerLink) {
          apiPayResponse.redirectUrl = afribaResult.providerLink;
        }

        return res.json(apiPayResponse);
      } else if (activeProvider === "pawapay") {
        // Use PawaPay for API payments
        const { createPawaPayDeposit } = await import("./pawapay");
        const { getCurrencyForOperator: getPawaPayCurrencyForOp, pawaPayOperatorRequiresOtp: pawaRequiresOtp, getPawaPayOtpInstructions: pawaOtpInfo } = await import("@shared/pawapay-countries");

        const { otpCode: apiPayOtpCode } = req.body;

        const needsOtp = pawaRequiresOtp(country.toUpperCase(), operator);
        if (needsOtp && !apiPayOtpCode) {
          const otpInfo = pawaOtpInfo(country.toUpperCase());
          return res.json({
            success: false,
            requiresOTP: true,
            otpInstructions: otpInfo.instructions,
            otpUssdCode: otpInfo.ussdCode,
            otpHint: otpInfo.hint,
            provider: "pawapay",
            error: "Code OTP Orange Money requis pour ce paiement",
          });
        }

        const providerCurrency = getPawaPayCurrencyForOp(country.toUpperCase(), operator);

        let convertedAmountForProvider = amountForProvider;
        if (ownerCurrency !== providerCurrency) {
          const { convertCurrency } = await import("./currency-converter");
          const conv = await convertCurrency(amountForProvider, ownerCurrency, providerCurrency);
          if (conv.success) {
            const { roundForCurrency } = await import("./pawapay");
            convertedAmountForProvider = roundForCurrency(conv.convertedAmount, providerCurrency);
          } else {
            return res.status(500).json({ error: "Erreur de conversion de devise" });
          }
        }

        const externalId = randomUUID();

        const pawaResult = await createPawaPayDeposit({
          amount: convertedAmountForProvider,
          currency: providerCurrency,
          country: country.toUpperCase(),
          operator: operator,
          phone: customerPhone,
          description: description || "Paiement API BKApay",
          externalId,
          preAuthorisationCode: apiPayOtpCode,
        });

        if (!pawaResult.success) {
          return res.status(400).json({ success: false, error: pawaResult.error || "Paiement non effectué. Veuillez réessayer." });
        }

        // Exchange fee for personal accounts when payer's currency differs from API owner's balance currency
        const { feeAmount: pawaXFee, feePercentage: pawaXFeePct } =
          (owner?.accountType === "personal" && ownerCurrency !== providerCurrency)
            ? await getApiPayXFee(storage, baseAmount, providerCurrency, ownerCurrency)
            : { feeAmount: 0, feePercentage: 0 };
        const pawaNet = Math.max(0, netAmountForUser - pawaXFee);
        const pawaTotalFee = feeAmount + pawaXFee;
        const pawaTotalFeePct = feePercentage + pawaXFeePct;

        const tx = await storage.createTransaction({
          userId: apiKey.userId,
          type: "api_payment",
          amount: baseAmount,
          fee: pawaTotalFee,
          feePercentage: pawaTotalFeePct,
          currency: ownerCurrency,
          status: "pending",
          country: country.toUpperCase(),
          operator: operator,
          description: description || "Paiement via API",
          customerPhone: customerPhone,
          customerName: customerName || "Client",
          customerEmail: customerEmail || null,
          metadata: JSON.stringify({
            pawaPayDepositId: pawaResult.depositId || externalId,
            apiKeyId: apiKey.id,
            apiKeyPublicKey: publicKey,
            callbackUrl: callbackUrl || null,
            orderId: orderId || null,
            successUrl: successUrl || null,
            cancelUrl: cancelUrl || null,
            provider: "pawapay",
            netAmountForUser: pawaNet,
            providerAmount: convertedAmountForProvider,
            providerCurrency: providerCurrency,
            balanceAmount: pawaNet,
            balanceCurrency: ownerCurrency,
            customerPaysFee: apiKey.customerPaysFee,
            feeAmount: pawaTotalFee,
            ...(pawaXFee > 0 ? { exchangeFee: pawaXFee, exchangeFeePercentage: pawaXFeePct } : {}),
            ...(originalAmount !== null ? { originalAmount, originalCurrency } : {}),
          }),
        });

        return res.json({
          success: true,
          transactionId: tx.id,
          token: tx.id,
          message: pawaResult.message || "Paiement initie. Veuillez valider sur votre telephone.",
          provider: "pawapay",
          ...(originalAmount !== null ? { originalAmount, originalCurrency, convertedCurrency: ownerCurrency } : {}),
        });
      } else if (activeProvider === "feexpay") {
        // Use FeeXPay for API payments
        const { getFeeXPayConfig, createFeeXPayPayin, translateFeeXPayError: feeXPayTranslateErr } = await import("./feexpay");
        const { getNetworkKey: feexNetworkKey, formatPhoneForFeeXPay: feexFormatPhone, getCurrencyForCountry: feexCurrency, operatorRequiresOtp: feexNeedsOtp } = await import("@shared/feexpay-countries");
        const { otpCode: fxOtpCode } = req.body;

        const feexConfig = await getFeeXPayConfig();
        if (!feexConfig) {
          return res.status(503).json({ success: false, error: "FeeXPay non configure" });
        }

        const feexNeedsOtpVal = feexNeedsOtp(country.toUpperCase(), operator);
        if (feexNeedsOtpVal && !fxOtpCode) {
          return res.json({ success: false, requiresOTP: true, otpInstructions: "Composez le code USSD pour obtenir votre OTP puis entrez-le ici.", provider: "feexpay", error: "Code OTP requis pour ce paiement" });
        }

        const feexProviderCurrency = feexCurrency(country.toUpperCase());
        let feexConvertedAmount = amountForProvider;
        if (ownerCurrency !== feexProviderCurrency) {
          const { convertCurrency } = await import("./currency-converter");
          const conv = await convertCurrency(amountForProvider, ownerCurrency, feexProviderCurrency);
          if (conv.success) feexConvertedAmount = Math.floor(conv.convertedAmount);
          else return res.status(500).json({ error: "Erreur de conversion de devise" });
        }

        const feexNetKey = feexNetworkKey(country.toUpperCase(), operator);
        if (!feexNetKey) return res.status(400).json({ success: false, error: "Reseau non supporte" });
        const feexPhone = feexFormatPhone(customerPhone, country.toUpperCase());

        const feexResult = await createFeeXPayPayin(feexConfig, {
          networkKey: feexNetKey, shopId: feexConfig.shopId,
          amount: feexConvertedAmount, phoneNumber: feexPhone, otpCode: fxOtpCode,
          callbackUrl: `${process.env.BASE_URL || "https://bkapay.com"}/api/webhooks/feexpay`,
        });

        if (!feexResult.success) {
          return res.status(400).json({ success: false, error: feeXPayTranslateErr(feexResult.error, "deposit") });
        }

        // Exchange fee for personal accounts when payer's currency differs from API owner's balance currency
        const { feeAmount: feexXFee, feePercentage: feexXFeePct } =
          (owner?.accountType === "personal" && ownerCurrency !== feexProviderCurrency)
            ? await getApiPayXFee(storage, baseAmount, feexProviderCurrency, ownerCurrency)
            : { feeAmount: 0, feePercentage: 0 };
        const feexNet = Math.max(0, netAmountForUser - feexXFee);
        const feexTotalFee = feeAmount + feexXFee;
        const feexTotalFeePct = feePercentage + feexXFeePct;

        const tx = await storage.createTransaction({
          userId: apiKey.userId, type: "api_payment", amount: baseAmount,
          fee: feexTotalFee, feePercentage: feexTotalFeePct, currency: ownerCurrency, status: "pending",
          country: country.toUpperCase(), operator,
          description: description || "Paiement via API",
          customerPhone, customerName: customerName || "Client", customerEmail: customerEmail || null,
          metadata: JSON.stringify({
            feeXPayReference: feexResult.reference,
            apiKeyId: apiKey.id, apiKeyPublicKey: publicKey,
            callbackUrl: callbackUrl || null, orderId: orderId || null,
            successUrl: successUrl || null, cancelUrl: cancelUrl || null,
            provider: "feexpay", netAmountForUser: feexNet, providerAmount: feexConvertedAmount,
            providerCurrency: feexProviderCurrency, balanceAmount: feexNet,
            balanceCurrency: ownerCurrency, customerPaysFee: apiKey.customerPaysFee, feeAmount: feexTotalFee,
            ...(feexXFee > 0 ? { exchangeFee: feexXFee, exchangeFeePercentage: feexXFeePct } : {}),
            ...(originalAmount !== null ? { originalAmount, originalCurrency } : {}),
          }),
        });

        return res.json({
          success: true, transactionId: tx.id, token: tx.id,
          message: feexResult.message || "Paiement initie. Validez sur votre telephone.", provider: "feexpay",
          ...(feexResult.redirectUrl ? { redirectUrl: feexResult.redirectUrl } : {}),
          ...(originalAmount !== null ? { originalAmount, originalCurrency, convertedCurrency: ownerCurrency } : {}),
        });
      } else {
        return res.status(503).json({ 
          success: false, 
          error: "Fournisseur non supporte pour ce mode de paiement" 
        });
      }
    } catch (error: any) {
      console.error("[API-PAY INIT] Error:", error);
      return res.status(500).json({ error: "Erreur lors de l'initialisation du paiement" });
    }
  });

  // Confirm API payment with OTP
  app.post("/api/api-pay/confirm", async (req: Request, res: Response) => {
    try {
      const { transactionId, token, authorizationCode, country, operator, customerPhone, customerName, customerEmail, wizallTransactionId } = req.body;

      // Get transaction by ID or token
      let transaction = null;
      if (transactionId) {
        transaction = await storage.getTransaction(transactionId);
      } else if (token) {
        transaction = await storage.getTransactionByPaydunyaToken(token);
      }
      
      if (!transaction) {
        return res.status(404).json({ error: "Transaction non trouvee" });
      }

      if (transaction.status !== "pending") {
        return res.status(400).json({ error: "Cette transaction n'est plus en attente" });
      }

      // Get metadata
      let metadata: any = {};
      if (transaction.metadata) {
        try {
          metadata = JSON.parse(transaction.metadata as string);
        } catch (e) {}
      }

      // Get operator key
      const txCountry = country || transaction.country || "SN";
      const txOperator = operator || transaction.operator || "orange";
      const operatorKey = metadata.operatorKey || getOperatorKey(txOperator, txCountry);

      if (!operatorKey) {
        return res.status(400).json({ error: "Operateur non valide" });
      }

      // Get phone from transaction
      const phone = (customerPhone || transaction.customerPhone || "").replace(/\s+/g, "").replace(/[^0-9]/g, "");

      // Check if this is Wizall two-step flow
      const isTwoStep = requiresTwoStep(operatorKey);

      if (isTwoStep && txOperator.toLowerCase() === "wizall" && txCountry.toUpperCase() === "SN") {
        // WIZALL TWO-STEP FLOW
        console.log("[API-PAY WIZALL] Processing Wizall payment");

        if (!authorizationCode && !wizallTransactionId) {
          // First step: initiate Wizall payment
          // Note: customerEmail is NOT sent to providers - use generic email for privacy
          const paymentData: SoftpayPaymentData = {
            customerName: customerName || transaction.customerName || "",
            customerEmail: "noreply@bkapay.com", // Privacy: never send real customer emails to providers
            phoneNumber: phone,
            invoiceToken: transaction.paydunyaToken!,
          };

          const softpayResult = await callPaydunyaSoftpay(txOperator, txCountry, paymentData);
          console.log("[API-PAY WIZALL] Init result:", softpayResult);

          if (softpayResult.success) {
            // Update metadata with Wizall transactionId
            const newMetadata = { ...metadata, wizallTransactionId: softpayResult.transactionId };
            await storage.updateTransactionMetadata(transaction.id, JSON.stringify(newMetadata));

            // Sanitize message
            let msg = softpayResult.message || "Un code OTP vous a ete envoye par SMS";
            msg = msg.replace(/<[^>]*>/g, "").replace(/[^\w\s.,!?'-]/g, "").substring(0, 200);

            return res.json({
              success: true,
              requiresOTP: true,
              wizallTransactionId: softpayResult.transactionId,
              message: msg,
            });
          } else {
            return res.status(400).json({
              error: softpayResult.message || "Erreur lors de l'initialisation Wizall",
            });
          }
        } else {
          // Second step: confirm with OTP
          const wizTxId = wizallTransactionId || metadata.wizallTransactionId;
          if (!wizTxId) {
            return res.status(502).json({ error: "Transaction Wizall non initiee. Veuillez recommencer." });
          }

          const confirmResult = await confirmWizallPayment(authorizationCode!, phone, wizTxId);

          if (confirmResult.success) {
            return res.json({
              success: true,
              message: confirmResult.message,
              transactionId: transaction.id,
            });
          } else {
            return res.status(400).json({
              error: confirmResult.message || "Erreur lors de la confirmation Wizall",
            });
          }
        }
      }

      // Standard OTP flow (Orange, etc.)
      if (!authorizationCode) {
        return res.status(400).json({ error: "Code OTP requis" });
      }

      // Call SOFTPAY OTP confirm
      // Note: Use generic email for privacy - never send real customer emails to providers
      const confirmData = {
        invoice_token: transaction.paydunyaToken,
        payment_token: operatorKey,
        phone_number: phone,
        otp_code: authorizationCode,
        customer_name: customerName || transaction.customerName,
        customer_email: "noreply@bkapay.com", // Privacy: never send real customer emails to providers
      };

      const confirmResult = await callPaydunyaAPI("/softpay/v2/otp-confirm", confirmData);

      if (confirmResult.response_code !== "00") {
        let errorMsg = "Code OTP invalide ou expire";
        if (confirmResult.response_text) {
          errorMsg = confirmResult.response_text
            .replace(/<[^>]*>/g, "")
            .replace(/[^\w\s.,!?-]/g, "")
            .substring(0, 200);
        }
        return res.status(400).json({ error: errorMsg });
      }

      res.json({
        success: true,
        message: "Paiement en cours de verification",
        transactionId: transaction.id,
      });
    } catch (error: any) {
      console.error("API Pay confirm error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // ===== Payment Sessions v1 - Secure API Payment (no amount in URL) =====

  // POST /api/v1/payment-sessions — Create a payment session (requires secret key)
  app.post("/api/v1/payment-sessions", async (req: Request, res: Response) => {
    try {
      let secretKey = req.headers.authorization?.replace(/^Bearer\s+/i, "").trim();
      if (!secretKey) secretKey = req.body.private_key;

      if (!secretKey || !secretKey.startsWith("sk_")) {
        return res.status(401).json({
          success: false,
          error: { code: "INVALID_API_KEY", message: "Clé API secrète invalide. Utilisez: Authorization: Bearer sk_payin_live_..." }
        });
      }

      // Try payin private key first (sk_payin_live_...), then fallback to legacy payout key (sk_live_...)
      let apiKey = await storage.getApiKeyByPayinPrivateKey(secretKey);
      if (!apiKey) {
        apiKey = await storage.getApiKeyByPrivateKey(secretKey);
      }
      if (!apiKey || !apiKey.isActive) {
        return res.status(401).json({
          success: false,
          error: { code: "INVALID_API_KEY", message: "Clé API invalide ou désactivée" }
        });
      }

      const owner = await storage.getUser(apiKey.userId);
      if (!owner || owner.suspended) {
        return res.status(403).json({
          success: false,
          error: { code: "ACCOUNT_SUSPENDED", message: "Ce service est temporairement indisponible" }
        });
      }

      const { amount, currency, description, success_url, cancel_url, callback_url, order_id, expires_in } = req.body;

      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        return res.status(400).json({
          success: false,
          error: { code: "INVALID_AMOUNT", message: "Montant invalide (doit être un nombre positif)" }
        });
      }

      // Devise du compte propriétaire de la clé API
      const ownerCurrency = owner.country ? getCurrencyForCountry(owner.country) : "XOF";
      const requestedAmountRaw = Math.floor(Number(amount));
      const normalizedSessionCurrency = currency ? String(currency).toUpperCase() : ownerCurrency;

      // Convertir vers la devise du compte si la devise du développeur diffère
      let sessionAmount = requestedAmountRaw;
      let sessionMetadataExtra: string | null = null;

      if (normalizedSessionCurrency !== ownerCurrency) {
        const { convertCurrency: convertForSession } = await import("./currency-converter");
        const conv = await convertForSession(requestedAmountRaw, normalizedSessionCurrency, ownerCurrency);
        if (!conv.success) {
          return res.status(400).json({
            success: false,
            error: { code: "CURRENCY_CONVERSION_FAILED", message: `Impossible de convertir ${normalizedSessionCurrency} vers ${ownerCurrency}: ${conv.error}` }
          });
        }
        sessionAmount = Math.floor(conv.convertedAmount);
        sessionMetadataExtra = JSON.stringify({ originalAmount: requestedAmountRaw, originalCurrency: normalizedSessionCurrency });
        console.log(`[SESSIONS CREATE] Conversion devise: ${requestedAmountRaw} ${normalizedSessionCurrency} → ${sessionAmount} ${ownerCurrency}`);
      }

      if (sessionAmount < 200) {
        return res.status(400).json({
          success: false,
          error: { code: "INVALID_AMOUNT", message: "Montant invalide. Minimum équivalent à 200 dans la devise du compte" }
        });
      }

      const expiresInSeconds = Math.max(1800, Math.min(Number(expires_in) || 3600, 86400));
      const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

      const session = await storage.createPaymentSession({
        apiKeyId: apiKey.id,
        userId: apiKey.userId,
        amount: sessionAmount,
        currency: ownerCurrency,
        description: description || null,
        successUrl: success_url || null,
        cancelUrl: cancel_url || null,
        callbackUrl: callback_url || apiKey.callbackUrl || null,
        orderId: order_id || null,
        status: "pending",
        transactionId: null,
        metadata: sessionMetadataExtra,
        expiresAt,
      });

      const baseUrl = process.env.BASE_URL || "https://bkapay.com";

      return res.json({
        success: true,
        session_id: session.id,
        payment_url: `${baseUrl}/checkout/${session.id}`,
        expires_at: expiresAt.toISOString(),
        amount: session.amount,
        currency: session.currency,
        ...(normalizedSessionCurrency !== ownerCurrency ? {
          original_amount: requestedAmountRaw,
          original_currency: normalizedSessionCurrency,
        } : {}),
      });
    } catch (error: any) {
      console.error("[Payment Session Create] Error:", error);
      return res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: "Erreur lors de la création de la session" } });
    }
  });

  // GET /api/v1/payment-sessions/:id — Get session info (limited fields for checkout page)
  app.get("/api/v1/payment-sessions/:id", async (req: Request, res: Response) => {
    try {
      const session = await storage.getPaymentSession(req.params.id);
      if (!session) {
        return res.status(404).json({ success: false, error: "Session introuvable" });
      }

      if (session.status === "expired" || new Date() > session.expiresAt) {
        if (session.status === "pending") {
          await storage.updatePaymentSession(session.id, { status: "expired" });
        }
        return res.json({ success: false, status: "expired", error: "Cette session de paiement a expiré" });
      }

      if (session.status === "completed") {
        return res.json({ success: true, status: "completed", amount: session.amount, currency: session.currency });
      }

      const apiKey = await storage.getApiKeyById(session.apiKeyId);
      const merchant = apiKey?.siteName || "BKApay";

      return res.json({
        success: true,
        session_id: session.id,
        status: session.status,
        amount: session.amount,
        currency: session.currency,
        description: session.description,
        merchant,
        success_url: session.successUrl,
        cancel_url: session.cancelUrl,
        expires_at: session.expiresAt.toISOString(),
        api_key_id: session.apiKeyId,
        customerPaysCryptoFee: (apiKey as any)?.customerPaysCryptoFee || false,
        customerPaysFee: apiKey?.customerPaysFee || false,
      });
    } catch (error: any) {
      console.error("[Payment Session Get] Error:", error);
      return res.status(500).json({ success: false, error: "Erreur serveur" });
    }
  });

  // POST /api/v1/payment-sessions/:id/pay — Initiate payment for a session
  app.post("/api/v1/payment-sessions/:id/pay", async (req: Request, res: Response) => {
    try {
      const session = await storage.getPaymentSession(req.params.id);
      if (!session) {
        return res.status(404).json({ success: false, error: "Session introuvable" });
      }

      if (session.status === "expired" || new Date() > session.expiresAt) {
        return res.status(400).json({ success: false, error: "Cette session de paiement a expiré" });
      }

      if (session.status === "completed") {
        return res.status(400).json({ success: false, error: "Cette session a déjà été payée" });
      }

      if (session.status === "processing" || session.status === "failed") {
        console.log(`[SESSION PAY] Allowing retry for session ${session.id} (status: ${session.status})`);
        await storage.updatePaymentSession(session.id, { status: "pending" });
      }

      const apiKey = await storage.getApiKeyById(session.apiKeyId);
      if (!apiKey || !apiKey.isActive) {
        return res.status(400).json({ success: false, error: "Clé API invalide" });
      }

      const owner = await storage.getUser(apiKey.userId);
      if (!owner || owner.suspended) {
        return res.status(403).json({ success: false, error: "Service temporairement indisponible" });
      }

      const { country, operator, customerPhone, customerName, customerEmail, otpCode } = req.body;

      if (!country || !operator || !customerPhone) {
        return res.status(400).json({ success: false, error: "Pays, opérateur et téléphone requis" });
      }

      if (operator.toLowerCase() === "wave" && !owner.wavePayinEnabled) {
        return res.status(403).json({ success: false, error: "Le wave de votre marchand n'est pas activée" });
      }

      if (apiKey.allowedCountries && apiKey.allowedCountries.length > 0 && !apiKey.allowedCountries.includes(country)) {
        return res.status(400).json({ success: false, error: "Ce pays n'est pas autorisé pour cette clé API" });
      }

      const activeProvider = await getActiveProviderForDeposit(country, operator);
      console.log(`[SESSION PAY] Provider for ${country}/${operator}: ${activeProvider}, sessionId: ${session.id}`);

      if (!activeProvider) {
        return res.status(503).json({ success: false, error: "Aucun fournisseur configuré pour ce pays et opérateur" });
      }

      const ownerCurrency = owner.country ? getCurrencyForCountry(owner.country) : "XOF";
      const { calculateIncomingFee, calculateCustomerPaysFee, getFeeFromDatabase, getIncomingExchangeFee: getSessionXFee } = await import("./utils/fees");
      const feeConfig = await getFeeFromDatabase(storage, activeProvider, country, operator);

      let amountForProvider: number;
      let feeAmount: number;
      let feePercentage: number;
      let netAmountForUser: number;

      if (apiKey.customerPaysFee) {
        const feeInfo = calculateCustomerPaysFee(session.amount, feeConfig.incoming);
        amountForProvider = feeInfo.totalForProvider;
        feeAmount = feeInfo.feeAmount;
        feePercentage = feeInfo.feePercentage;
        netAmountForUser = feeInfo.baseAmount;
      } else {
        const feeInfo = calculateIncomingFee(session.amount, feeConfig.incoming);
        amountForProvider = feeInfo.grossAmount;
        feeAmount = feeInfo.feeAmount;
        feePercentage = feeInfo.feePercentage;
        netAmountForUser = feeInfo.netAmount;
      }

      // Mark session as processing
      await storage.updatePaymentSession(session.id, { status: "processing" });

      if (activeProvider === "pawapay") {
        const { createPawaPayDeposit } = await import("./pawapay");
        const { getCurrencyForOperator: getPawaPayCurrencyForOp, pawaPayOperatorRequiresOtp: pawaRequiresOtp, getPawaPayOtpInstructions: pawaOtpInfo } = await import("@shared/pawapay-countries");

        const needsOtp = pawaRequiresOtp(country.toUpperCase(), operator);
        if (needsOtp && !otpCode) {
          await storage.updatePaymentSession(session.id, { status: "pending" });
          const otpInfo = pawaOtpInfo(country.toUpperCase());
          return res.json({
            success: false,
            requiresOTP: true,
            otpInstructions: otpInfo.instructions,
            otpUssdCode: otpInfo.ussdCode,
            otpHint: otpInfo.hint,
            provider: "pawapay",
            error: "Code OTP Orange Money requis",
          });
        }

        const providerCurrency = getPawaPayCurrencyForOp(country.toUpperCase(), operator);

        // Frais d'échange entrant pour comptes personnels si la devise du payeur diffère de celle du marchand
        const { feeAmount: sessXFeePawa, feePercentage: sessXFeePawaPct } =
          (owner.accountType === "personal" && ownerCurrency !== providerCurrency)
            ? await getSessionXFee(storage, netAmountForUser, providerCurrency, ownerCurrency)
            : { feeAmount: 0, feePercentage: 0 };
        if (sessXFeePawa > 0) {
          netAmountForUser = Math.max(0, netAmountForUser - sessXFeePawa);
          feeAmount += sessXFeePawa;
          feePercentage += sessXFeePawaPct;
          console.log(`[SESSION PAY PawaPay] Frais échange ${providerCurrency}→${ownerCurrency}: -${sessXFeePawa} (${sessXFeePawaPct / 10}%)`);
        }

        let convertedAmount = amountForProvider;
        if (ownerCurrency !== providerCurrency) {
          const { convertCurrency } = await import("./currency-converter");
          const conv = await convertCurrency(amountForProvider, ownerCurrency, providerCurrency);
          if (conv.success) {
            const { roundForCurrency } = await import("./pawapay");
            convertedAmount = roundForCurrency(conv.convertedAmount, providerCurrency);
          } else {
            await storage.updatePaymentSession(session.id, { status: "pending" });
            return res.status(500).json({ success: false, error: "Erreur de conversion de devise" });
          }
        }

        const pawaResult = await createPawaPayDeposit({
          amount: convertedAmount,
          currency: providerCurrency,
          country: country.toUpperCase(),
          operator,
          phone: customerPhone,
          description: session.description || "Paiement BKApay",
          externalId: randomUUID(),
          preAuthorisationCode: otpCode,
        });

        if (!pawaResult.success) {
          await storage.updatePaymentSession(session.id, { status: "pending" });
          return res.status(400).json({ success: false, error: pawaResult.error || "Paiement non effectué. Veuillez réessayer." });
        }

        const tx = await storage.createTransaction({
          userId: apiKey.userId,
          type: "api_payment",
          amount: session.amount,
          fee: feeAmount,
          feePercentage,
          currency: ownerCurrency,
          status: "pending",
          country: country.toUpperCase(),
          operator,
          description: session.description || "Paiement API BKApay",
          customerPhone,
          customerName: customerName || "Client",
          customerEmail: customerEmail || null,
          metadata: JSON.stringify({
            pawaPayDepositId: pawaResult.depositId,
            provider: "pawapay",
            paymentProvider: "pawapay",
            sessionId: session.id,
            apiKeyId: apiKey.id,
            successUrl: session.successUrl,
            cancelUrl: session.cancelUrl,
            callbackUrl: session.callbackUrl,
            orderId: session.orderId,
            netAmountForUser,
            balanceAmount: netAmountForUser,
            balanceCurrency: ownerCurrency,
            providerAmount: convertedAmount,
            providerCurrency,
            ...(sessXFeePawa > 0 ? { exchangeFee: sessXFeePawa, exchangeFeePercentage: sessXFeePawaPct } : {}),
          }),
        });

        await storage.updatePaymentSession(session.id, { transactionId: tx.id });

        return res.json({
          success: true,
          transactionId: tx.id,
          message: pawaResult.message || "Paiement initié. Validez sur votre téléphone.",
          provider: "pawapay",
        });

      } else if (activeProvider === "fedapay") {
        const { handleApiPayment } = await import("./fedapay");
        const result = await handleApiPayment(
          apiKey, session.amount, session.description || "Paiement via API",
          customerName || "Client", "noreply@bkapay.com", customerPhone, country, operator
        );

        if (!result.success) {
          await storage.updatePaymentSession(session.id, { status: "pending" });
          return res.status(400).json({ success: false, error: result.error });
        }

        // Frais d'échange entrant pour comptes personnels (FedaPay utilise toujours XOF)
        const fedaSessionProvCurr = "XOF";
        const { feeAmount: sessXFeeFeda, feePercentage: sessXFedaPct } =
          (owner.accountType === "personal" && ownerCurrency !== fedaSessionProvCurr)
            ? await getSessionXFee(storage, netAmountForUser, fedaSessionProvCurr, ownerCurrency)
            : { feeAmount: 0, feePercentage: 0 };
        if (sessXFeeFeda > 0) {
          netAmountForUser = Math.max(0, netAmountForUser - sessXFeeFeda);
          feeAmount += sessXFeeFeda;
          feePercentage += sessXFedaPct;
        }

        const tx = await storage.createTransaction({
          userId: apiKey.userId, type: "api_payment", amount: session.amount,
          fee: feeAmount, feePercentage, currency: ownerCurrency, status: "pending",
          country: country.toUpperCase(), operator,
          description: session.description || "Paiement API",
          customerPhone, customerName: customerName || "Client", customerEmail: customerEmail || null,
          metadata: JSON.stringify({
            sessionId: session.id, apiKeyId: apiKey.id,
            successUrl: session.successUrl, cancelUrl: session.cancelUrl,
            callbackUrl: session.callbackUrl, orderId: session.orderId,
            fedapayTransactionId: result.transactionId,
            netAmountForUser, balanceAmount: netAmountForUser, balanceCurrency: ownerCurrency,
            providerCurrency: fedaSessionProvCurr,
            ...(sessXFeeFeda > 0 ? { exchangeFee: sessXFeeFeda, exchangeFeePercentage: sessXFedaPct } : {}),
          }),
        });

        await storage.updatePaymentSession(session.id, { transactionId: tx.id });
        return res.json({ success: true, transactionId: tx.id, message: result.message, provider: "fedapay" });

      } else if (activeProvider === "paydunya") {
        const paydunyaData = {
          invoice: {
            total_amount: Math.floor(amountForProvider),
            description: session.description || "Paiement API BKApay",
            customer: { name: customerName || "Client", email: "noreply@bkapay.com", phone: customerPhone },
          },
          store: { name: "BKApay" },
          custom_data: { session_id: session.id, type: "api_payment", country, operator, phone: customerPhone },
          actions: { callback_url: `${process.env.BASE_URL || "https://bkapay.com"}/api/webhooks/paydunya` },
        };

        const paydunyaResp = await callPaydunyaAPI("/checkout-invoice/create", paydunyaData);
        if (paydunyaResp.response_code !== "00" || !paydunyaResp.token) {
          await storage.updatePaymentSession(session.id, { status: "pending" });
          return res.status(400).json({ success: false, error: paydunyaResp.response_text || "Erreur lors de la création de la facture" });
        }

        // Frais d'échange entrant pour comptes personnels (Paydunya — XAF pour CM, XOF sinon)
        const pdSessionProvCurr = (country.toUpperCase() === "CM") ? "XAF" : "XOF";
        const { feeAmount: sessXFeePd, feePercentage: sessXFeePdPct } =
          (owner.accountType === "personal" && ownerCurrency !== pdSessionProvCurr)
            ? await getSessionXFee(storage, netAmountForUser, pdSessionProvCurr, ownerCurrency)
            : { feeAmount: 0, feePercentage: 0 };
        if (sessXFeePd > 0) {
          netAmountForUser = Math.max(0, netAmountForUser - sessXFeePd);
          feeAmount += sessXFeePd;
          feePercentage += sessXFeePdPct;
        }

        const tx = await storage.createTransaction({
          userId: apiKey.userId, type: "api_payment", amount: session.amount,
          fee: feeAmount, feePercentage, currency: ownerCurrency, status: "pending",
          country: country.toUpperCase(), operator,
          description: session.description || "Paiement API",
          customerPhone, customerName: customerName || "Client", customerEmail: customerEmail || null,
          paydunyaToken: paydunyaResp.token,
          metadata: JSON.stringify({
            sessionId: session.id, apiKeyId: apiKey.id,
            successUrl: session.successUrl, cancelUrl: session.cancelUrl,
            callbackUrl: session.callbackUrl, orderId: session.orderId,
            netAmountForUser, balanceAmount: netAmountForUser, balanceCurrency: ownerCurrency,
            providerCurrency: pdSessionProvCurr,
            ...(sessXFeePd > 0 ? { exchangeFee: sessXFeePd, exchangeFeePercentage: sessXFeePdPct } : {}),
          }),
        });

        await storage.updatePaymentSession(session.id, { transactionId: tx.id });

        
        const opKey = getOperatorKey(operator, country);
        if (opKey && !requiresOTP(opKey) && !requiresTwoStep(opKey)) {
          const softpayResult = await callPaydunyaSoftpay(operator, country, {
            customerName: customerName || "Client", customerEmail: "noreply@bkapay.com",
            phoneNumber: customerPhone, invoiceToken: paydunyaResp.token,
          } as SoftpayPaymentData);
          if (softpayResult.success) {
            return res.json({ success: true, transactionId: tx.id, token: paydunyaResp.token, message: softpayResult.message, redirectUrl: softpayResult.url || null, omUrl: softpayResult.omUrl, maxitUrl: softpayResult.maxitUrl, provider: "paydunya" });
          }
          return res.status(400).json({ success: false, error: softpayResult.message || "Erreur de paiement" });
        }
        return res.json({ success: true, transactionId: tx.id, token: paydunyaResp.token, provider: "paydunya" });

      } else if (activeProvider === "mbiyopay") {
        const { createMbiyoPayPayin, getCurrencyForCountry: getMbiyoCurrency, mbiyoPayOperatorRequiresOtp: mbiyoNeedsOtp, getMbiyoPayOtpInstructions: getMbiyoOtpInfo } = await import("./mbiyopay");
        const providerCurrency = getMbiyoCurrency(country);
        const needsOtp = mbiyoNeedsOtp(country, operator);
        if (needsOtp && !otpCode) {
          await storage.updatePaymentSession(session.id, { status: "pending" });
          const otpInfo = getMbiyoOtpInfo(country, session.amount);
          return res.json({ success: false, requiresOTP: true, otpInstructions: otpInfo.instructions, otpUssdCode: otpInfo.ussdCode, otpHint: otpInfo.hint, provider: "mbiyopay", error: "Code OTP requis" });
        }

        // Frais d'échange entrant pour comptes personnels si la devise du payeur diffère de celle du marchand
        const { feeAmount: sessXFeeMbiy, feePercentage: sessXFeeMbiyPct } =
          (owner.accountType === "personal" && ownerCurrency !== providerCurrency)
            ? await getSessionXFee(storage, netAmountForUser, providerCurrency, ownerCurrency)
            : { feeAmount: 0, feePercentage: 0 };
        if (sessXFeeMbiy > 0) {
          netAmountForUser = Math.max(0, netAmountForUser - sessXFeeMbiy);
          feeAmount += sessXFeeMbiy;
          feePercentage += sessXFeeMbiyPct;
          console.log(`[SESSION PAY MbiyoPay] Frais échange ${providerCurrency}→${ownerCurrency}: -${sessXFeeMbiy} (${sessXFeeMbiyPct / 10}%)`);
        }

        let convertedAmount = amountForProvider;
        if (ownerCurrency !== providerCurrency) {
          const { convertCurrency } = await import("./currency-converter");
          const conv = await convertCurrency(amountForProvider, ownerCurrency, providerCurrency);
          if (conv.success) convertedAmount = Math.floor(conv.convertedAmount);
        }
        const result = await createMbiyoPayPayin({ amount: convertedAmount, currency: providerCurrency, phone: customerPhone, countryCode: country, network: operator, orderId: `BKAPAY-SESSION-${Date.now()}`, callbackUrl: `${process.env.BASE_URL || "https://bkapay.com"}/api/webhooks/mbiyopay`, otpCode });
        if (!result.success) {
          await storage.updatePaymentSession(session.id, { status: "pending" });
          return res.status(400).json({ success: false, error: result.error || "Erreur de paiement" });
        }
        const tx = await storage.createTransaction({
          userId: apiKey.userId, type: "api_payment", amount: session.amount,
          fee: feeAmount, feePercentage, currency: ownerCurrency, status: "pending",
          country: country.toUpperCase(), operator,
          description: session.description || "Paiement API", customerPhone,
          customerName: customerName || "Client", customerEmail: customerEmail || null,
          metadata: JSON.stringify({
            sessionId: session.id, apiKeyId: apiKey.id, successUrl: session.successUrl,
            cancelUrl: session.cancelUrl, callbackUrl: session.callbackUrl, orderId: session.orderId,
            provider: "mbiyopay", mbiyopayTransactionId: result.transactionId,
            netAmountForUser, balanceAmount: netAmountForUser, balanceCurrency: ownerCurrency,
            providerAmount: convertedAmount, providerCurrency,
            ...(sessXFeeMbiy > 0 ? { exchangeFee: sessXFeeMbiy, exchangeFeePercentage: sessXFeeMbiyPct } : {}),
          }),
        });
        await storage.updatePaymentSession(session.id, { transactionId: tx.id });
        return res.json({ success: true, transactionId: tx.id, redirectUrl: result.redirectUrl, instructions: result.instructions, message: result.message || "Paiement initié", provider: "mbiyopay" });

      } else if (activeProvider === "afribapay") {
        const { handleAfribaPayApiPayment } = await import("./afribapay");
        const result = await handleAfribaPayApiPayment(apiKey, amountForProvider, session.description || "Paiement API", customerName || "Client", "noreply@bkapay.com", customerPhone, country, operator, otpCode);
        if (result.requiresOtp) {
          await storage.updatePaymentSession(session.id, { status: "pending" });
          return res.status(400).json({ success: false, error: result.error, requiresOTP: true, otpInstructions: result.otpInstructions });
        }
        if (!result.success) {
          await storage.updatePaymentSession(session.id, { status: "pending" });
          return res.status(400).json({ success: false, error: result.error });
        }
        // Frais d'échange entrant pour comptes personnels (AfribaPay — devise selon le pays)
        const { getCurrencyForCountry: getAfribaSessionCurr } = await import("@shared/afribapay-countries");
        const afribaSessionProvCurr = getAfribaSessionCurr(country.toUpperCase());
        const { feeAmount: sessXFeeAfriba, feePercentage: sessXFeeAfrPct } =
          (owner.accountType === "personal" && ownerCurrency !== afribaSessionProvCurr)
            ? await getSessionXFee(storage, netAmountForUser, afribaSessionProvCurr, ownerCurrency)
            : { feeAmount: 0, feePercentage: 0 };
        if (sessXFeeAfriba > 0) {
          netAmountForUser = Math.max(0, netAmountForUser - sessXFeeAfriba);
          feeAmount += sessXFeeAfriba;
          feePercentage += sessXFeeAfrPct;
        }
        const tx = await storage.createTransaction({
          userId: apiKey.userId, type: "api_payment", amount: session.amount,
          fee: feeAmount, feePercentage, currency: ownerCurrency, status: "pending",
          country: country.toUpperCase(), operator, description: session.description || "Paiement API",
          customerPhone, customerName: customerName || "Client", customerEmail: customerEmail || null,
          metadata: JSON.stringify({
            sessionId: session.id, apiKeyId: apiKey.id, successUrl: session.successUrl,
            cancelUrl: session.cancelUrl, callbackUrl: session.callbackUrl, orderId: session.orderId,
            provider: "afribapay", afribaPayTransactionId: result.afribaPayTransactionId,
            netAmountForUser, balanceAmount: netAmountForUser, balanceCurrency: ownerCurrency,
            providerCurrency: afribaSessionProvCurr,
            ...(sessXFeeAfriba > 0 ? { exchangeFee: sessXFeeAfriba, exchangeFeePercentage: sessXFeeAfrPct } : {}),
          }),
        });
        await storage.updatePaymentSession(session.id, { transactionId: tx.id });
        return res.json({ success: true, transactionId: tx.id, redirectUrl: result.providerLink, message: result.message || "Paiement initié", provider: "afribapay" });

      } else if (activeProvider === "feexpay") {
        const { getFeeXPayConfig: feexGetConfig, createFeeXPayPayin: feexPayin, translateFeeXPayError: feexTransErr } = await import("./feexpay");
        const { getNetworkKey: sessFeexNet, formatPhoneForFeeXPay: sessFeexPhone, getCurrencyForCountry: sessFeexCurrency, operatorRequiresOtp: sessFeexNeedsOtp } = await import("@shared/feexpay-countries");

        const feexConf = await feexGetConfig();
        if (!feexConf) {
          await storage.updatePaymentSession(session.id, { status: "pending" });
          return res.status(503).json({ success: false, error: "FeeXPay non configure" });
        }

        if (sessFeexNeedsOtp(country.toUpperCase(), operator) && !otpCode) {
          await storage.updatePaymentSession(session.id, { status: "pending" });
          return res.status(400).json({ success: false, requiresOTP: true, otpInstructions: "Composez le code USSD pour obtenir votre OTP.", provider: "feexpay", error: "Code OTP requis" });
        }

        const sessFeexCurr = sessFeexCurrency(country.toUpperCase());

        // Frais d'échange entrant pour comptes personnels si la devise du payeur diffère de celle du marchand
        const { feeAmount: sessXFeeFeex, feePercentage: sessXFeeFeexPct } =
          (owner.accountType === "personal" && ownerCurrency !== sessFeexCurr)
            ? await getSessionXFee(storage, netAmountForUser, sessFeexCurr, ownerCurrency)
            : { feeAmount: 0, feePercentage: 0 };
        if (sessXFeeFeex > 0) {
          netAmountForUser = Math.max(0, netAmountForUser - sessXFeeFeex);
          feeAmount += sessXFeeFeex;
          feePercentage += sessXFeeFeexPct;
          console.log(`[SESSION PAY FeeXPay] Frais échange ${sessFeexCurr}→${ownerCurrency}: -${sessXFeeFeex} (${sessXFeeFeexPct / 10}%)`);
        }

        let sessFeexAmount = amountForProvider;
        if (ownerCurrency !== sessFeexCurr) {
          const { convertCurrency } = await import("./currency-converter");
          const conv = await convertCurrency(amountForProvider, ownerCurrency, sessFeexCurr);
          if (conv.success) sessFeexAmount = Math.floor(conv.convertedAmount);
          else {
            await storage.updatePaymentSession(session.id, { status: "pending" });
            return res.status(500).json({ success: false, error: "Erreur de conversion" });
          }
        }

        const sessFeexNetKey = sessFeexNet(country.toUpperCase(), operator);
        if (!sessFeexNetKey) {
          await storage.updatePaymentSession(session.id, { status: "pending" });
          return res.status(400).json({ success: false, error: "Reseau non supporte" });
        }

        const sessFeexRes = await feexPayin(feexConf, {
          networkKey: sessFeexNetKey, shopId: feexConf.shopId,
          amount: sessFeexAmount, phoneNumber: sessFeexPhone(customerPhone, country.toUpperCase()), otpCode,
          callbackUrl: `${process.env.BASE_URL || "https://bkapay.com"}/api/webhooks/feexpay`,
        });

        if (!sessFeexRes.success) {
          await storage.updatePaymentSession(session.id, { status: "pending" });
          return res.status(400).json({ success: false, error: feexTransErr(sessFeexRes.error, "deposit") });
        }

        const tx = await storage.createTransaction({
          userId: apiKey.userId, type: "api_payment", amount: session.amount,
          fee: feeAmount, feePercentage, currency: ownerCurrency, status: "pending",
          country: country.toUpperCase(), operator, description: session.description || "Paiement API",
          customerPhone, customerName: customerName || "Client", customerEmail: customerEmail || null,
          metadata: JSON.stringify({
            feeXPayReference: sessFeexRes.reference, provider: "feexpay",
            sessionId: session.id, apiKeyId: apiKey.id,
            successUrl: session.successUrl, cancelUrl: session.cancelUrl,
            callbackUrl: session.callbackUrl, orderId: session.orderId,
            netAmountForUser, balanceAmount: netAmountForUser, balanceCurrency: ownerCurrency,
            providerAmount: sessFeexAmount, providerCurrency: sessFeexCurr,
            ...(sessXFeeFeex > 0 ? { exchangeFee: sessXFeeFeex, exchangeFeePercentage: sessXFeeFeexPct } : {}),
          }),
        });

        await storage.updatePaymentSession(session.id, { transactionId: tx.id });
        return res.json({
          success: true, transactionId: tx.id,
          message: sessFeexRes.message || "Paiement initié. Validez sur votre téléphone.", provider: "feexpay",
          ...(sessFeexRes.redirectUrl ? { redirectUrl: sessFeexRes.redirectUrl } : {}),
        });

      } else {
        await storage.updatePaymentSession(session.id, { status: "pending" });
        return res.status(503).json({ success: false, error: "Fournisseur de paiement non supporté" });
      }
    } catch (error: any) {
      console.error("[SESSION PAY] Error:", error);
      try { await storage.updatePaymentSession(req.params.id, { status: "pending" }); } catch {}
      return res.status(500).json({ success: false, error: "Erreur lors du paiement" });
    }
  });

  async function sendSessionCallback(session: any, status: string, tx?: any) {
    if (!session.callbackUrl) return;
    try {
      const payload: any = {
        event: status === "completed" ? "payment.completed" : "payment.failed",
        session_id: session.id,
        status,
        amount: session.amount,
        currency: session.currency,
        order_id: session.orderId || null,
      };
      if (tx) {
        payload.transaction_id = tx.id;
        payload.customer_phone = tx.customerPhone || null;
        payload.customer_name = tx.customerName || null;
        payload.customer_email = tx.customerEmail || null;
      }
      console.log(`[SESSION CALLBACK] Sending ${status} callback to ${session.callbackUrl}`);
      const resp = await fetch(session.callbackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });
      console.log(`[SESSION CALLBACK] Response: ${resp.status}`);
    } catch (err: any) {
      console.error(`[SESSION CALLBACK] Error sending callback:`, err.message);
    }
  }

  // GET /api/v1/payment-sessions/:id/status — Check session payment status
  app.get("/api/v1/payment-sessions/:id/status", async (req: Request, res: Response) => {
    try {
      const session = await storage.getPaymentSession(req.params.id);
      if (!session) return res.status(404).json({ success: false, error: "Session introuvable" });

      if (session.status === "completed") return res.json({ success: true, status: "completed" });
      if (session.status === "failed") return res.json({ success: false, status: "failed" });
      if (session.status === "expired" || new Date() > session.expiresAt) return res.json({ success: false, status: "expired" });

      if (session.transactionId) {
        const tx = await storage.getTransaction(session.transactionId);
        if (tx?.status === "completed") {
          const wasProcessing = session.status !== "completed";
          await storage.updatePaymentSession(session.id, { status: "completed" });
          if (wasProcessing) sendSessionCallback(session, "completed", tx).catch(() => {});
          return res.json({ success: true, status: "completed" });
        }
        if (tx?.status === "failed") {
          const wasProcessing = session.status !== "failed";
          await storage.updatePaymentSession(session.id, { status: "failed" });
          if (wasProcessing) sendSessionCallback(session, "failed", tx).catch(() => {});
          return res.json({ success: false, status: "failed" });
        }
      }

      return res.json({ success: true, status: session.status });
    } catch (error: any) {
      console.error("[SESSION STATUS] Error:", error);
      return res.status(500).json({ success: false, error: "Erreur serveur" });
    }
  });

  // ===== API Payout v1 - Mobile Money Payout via API key =====
  app.post("/api/v1/payout", async (req: Request, res: Response) => {
    try {
      // 1. Extract private key from Authorization header or body
      let privateKey = req.headers.authorization?.replace(/^Bearer\s+/i, "").trim();
      if (!privateKey) privateKey = req.body.privateKey;

      if (!privateKey || !privateKey.startsWith("sk_")) {
        return res.status(401).json({
          success: false,
          error: { code: "INVALID_API_KEY", message: "Clé API privée invalide ou manquante. Utilisez: Authorization: Bearer sk_live_..." }
        });
      }

      // 2. Validate API key
      const apiKey = await storage.getApiKeyByPrivateKey(privateKey);
      if (!apiKey || !apiKey.isActive) {
        return res.status(401).json({
          success: false,
          error: { code: "INVALID_API_KEY", message: "Clé API invalide ou désactivée" }
        });
      }

      // 3. Get account owner
      const user = await storage.getUser(apiKey.userId);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: { code: "INVALID_API_KEY", message: "Compte associé introuvable" }
        });
      }

      // 4. Account status checks
      if (user.suspended) {
        return res.status(403).json({
          success: false,
          error: { code: "ACCOUNT_SUSPENDED", message: "Ce compte a été suspendu. Contactez le support." }
        });
      }

      if (user.kycStatus !== "verified") {
        return res.status(403).json({
          success: false,
          error: { code: "ACCOUNT_NOT_VERIFIED", message: "Votre compte n'est pas encore vérifié (KYC). Complétez la vérification d'identité pour activer le payout API." }
        });
      }

      if (!(user as any).payoutApiEnabled) {
        return res.status(403).json({
          success: false,
          error: { code: "PAYOUT_NOT_ACTIVATED", message: "Le payout API n'est pas activé sur votre compte. Contactez le support pour l'activer." }
        });
      }

      // 5. Validate required parameters
      const { phone, operator, country, amount, currency, reference } = req.body;

      if (!phone || !operator || !country || !amount) {
        return res.status(400).json({
          success: false,
          error: { code: "INVALID_PARAMETERS", message: "Les champs phone, operator, country et amount sont obligatoires" }
        });
      }

      const parsedAmount = Number(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({
          success: false,
          error: { code: "INVALID_PARAMETERS", message: "Le montant doit être un nombre positif" }
        });
      }

      const PAYOUT_MIN_AMOUNT = 500;
      if (parsedAmount < PAYOUT_MIN_AMOUNT) {
        return res.status(400).json({
          success: false,
          error: {
            code: "AMOUNT_TOO_LOW",
            message: `Le montant minimum est de ${PAYOUT_MIN_AMOUNT} ${currency || "XOF"}. Valeur reçue: ${parsedAmount}`
          }
        });
      }

      const requestedAmount = Math.floor(parsedAmount);
      const countryCode = String(country).toUpperCase();

      // 6. Normalize operator: lowercase, strip country suffix, strip common suffixes
      let normalizedOperator = String(operator).toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/-[a-z]{2}$/i, "")      // strip -sn, -ci, -cd, -cm, etc.
        .replace(/[-_]money$/i, "")       // orange-money → orange
        .replace(/[-_]mobile$/i, "")      // mtn-mobile → mtn
        .replace(/[-_]cash$/i, "");       // moov-cash → moov
      if (normalizedOperator === "t-money" || normalizedOperator === "tmoney" || normalizedOperator === "togocel") normalizedOperator = "tmoney";
      if (normalizedOperator === "m-pesa" || normalizedOperator === "mpesa") normalizedOperator = "vodacom";

      // 7. Strip international prefix from phone number
      const countryPhoneMap: Record<string, { code: string; digits: number[] }> = {
        "SN": { code: "221", digits: [9] }, "CI": { code: "225", digits: [10] },
        "BF": { code: "226", digits: [8] }, "BJ": { code: "229", digits: [8, 9, 10] },
        "TG": { code: "228", digits: [8] }, "ML": { code: "223", digits: [8] },
        "GN": { code: "224", digits: [9] }, "CM": { code: "237", digits: [9] },
        "CD": { code: "243", digits: [9] }, "CG": { code: "242", digits: [9] },
        "RW": { code: "250", digits: [9] }, "GA": { code: "241", digits: [8] },
        "MG": { code: "261", digits: [9] }, "GM": { code: "220", digits: [7] },
      };

      let rawPhone = String(phone).replace(/[\s\-\.]+/g, "");
      if (!/^\+?\d+$/.test(rawPhone)) {
        return res.status(400).json({
          success: false,
          error: { code: "INVALID_PHONE", message: "Numéro de téléphone invalide. Utilisez le format international: +221XXXXXXXXX" }
        });
      }

      let localPhone = rawPhone;
      const pInfo = countryPhoneMap[countryCode];
      if (pInfo) {
        if (localPhone.startsWith("+")) localPhone = localPhone.substring(1);
        if (localPhone.startsWith("00")) localPhone = localPhone.substring(2);
        if (localPhone.startsWith(pInfo.code)) {
          const withoutCode = localPhone.substring(pInfo.code.length);
          if (pInfo.digits.includes(withoutCode.length)) localPhone = withoutCode;
        }
      }

      // 8. Find active provider for this country/operator
      const activeProvider = await getActiveProviderForWithdrawal(countryCode, normalizedOperator);
      if (!activeProvider) {
        // Try to determine if country is fully unavailable vs operator
        const [allCsConfigs] = await Promise.all([storage.getCountryStatuses()]);
        const countryHasAny = allCsConfigs.some(cs => cs.country.toUpperCase() === countryCode && cs.payoutEnabled);
        if (!countryHasAny) {
          return res.status(400).json({
            success: false,
            error: { code: "COUNTRY_UNAVAILABLE", message: `Le pays ${countryCode} n'est pas disponible pour le payout` }
          });
        }
        return res.status(400).json({
          success: false,
          error: { code: "OPERATOR_UNAVAILABLE", message: `L'opérateur ${operator} n'est pas disponible pour le payout en ${countryCode}` }
        });
      }

      // 9. Determine currencies
      const userCurrency = user.country ? getCurrencyForCountry(user.country) : "XOF";
      const requestedCurrency = currency ? String(currency).toUpperCase() : getCurrencyForCountry(countryCode);

      // 10. Convert requested amount to user's balance currency if different
      let amountInUserCurrency = requestedAmount;
      if (requestedCurrency !== userCurrency) {
        const { convertCurrency } = await import("./currency-converter");
        const conv = await convertCurrency(requestedAmount, requestedCurrency, userCurrency);
        if (!conv.success) {
          return res.status(400).json({
            success: false,
            error: { code: "CURRENCY_CONVERSION_FAILED", message: `Impossible de convertir ${requestedCurrency} → ${userCurrency}` }
          });
        }
        amountInUserCurrency = Math.floor(conv.convertedAmount);
      }

      // 11. Pre-check balance using netMode: recipient gets exact amount, fees added on top
      const feeConfig = await getFeeFromDatabase(storage, activeProvider, countryCode, normalizedOperator);
      const feeInfo = calculateOutgoingFeeFromNet(amountInUserCurrency, feeConfig.outgoing);

      // Exchange fee for personal accounts when payout currency differs from balance currency
      let payoutDestCurrency = requestedCurrency || getCurrencyForCountry(countryCode);
      if (!requestedCurrency && activeProvider === "pawapay") {
        try {
          const { getCurrencyForOperator: getOpCurrPayout } = await import("@shared/pawapay-countries");
          const opCurrPayout = getOpCurrPayout(countryCode, normalizedOperator);
          if (opCurrPayout) payoutDestCurrency = opCurrPayout;
        } catch (_) {}
      }
      const xFeeApiPayout = await getOutgoingExchangeFee(storage, userCurrency, payoutDestCurrency, amountInUserCurrency, user.accountType || "personal");
      const apiPayoutExchangeFee = xFeeApiPayout.feeAmount;
      if (apiPayoutExchangeFee > 0) {
        console.log(`[API Payout] Exchange fee ${userCurrency}→${payoutDestCurrency} (${xFeeApiPayout.feePercentage / 10}%) = ${apiPayoutExchangeFee} ${userCurrency}`);
      }

      if (user.balance < feeInfo.totalDeductedFromBalance + apiPayoutExchangeFee) {
        return res.status(400).json({
          success: false,
          error: { code: "INSUFFICIENT_FUNDS", message: `Solde insuffisant sur votre compte BKApay` }
        });
      }

      // 12. Route to the appropriate provider handler (netMode=true: recipient gets exact amount)
      // crossCurrencyOverride: when developer specified a different currency than merchant's,
      // pass the original requestedAmount directly to the provider to avoid double-conversion rounding
      const crossCurrencyOverride = requestedCurrency !== userCurrency ? requestedAmount : undefined;

      let result: { success: boolean; transactionId?: string; error?: string; message?: string; status?: string };

      if (activeProvider === "fedapay") {
        // FedaPay is XOF-only; cross-currency handled by conversion upstream
        result = await handleFedaPayWithdrawal(apiKey.userId, user, amountInUserCurrency, countryCode, normalizedOperator, localPhone, userCurrency, true);
      } else if (activeProvider === "mbiyopay") {
        result = await handleMbiyoPayWithdrawal(apiKey.userId, user, amountInUserCurrency, countryCode, normalizedOperator, localPhone, userCurrency, requestedCurrency, true, crossCurrencyOverride);
      } else if (activeProvider === "moneyfusion") {
        result = await handleMoneyFusionWithdrawal(apiKey.userId, user, amountInUserCurrency, countryCode, normalizedOperator, localPhone, userCurrency, true, crossCurrencyOverride);
      } else if (activeProvider === "pawapay") {
        result = await handlePawaPayWithdrawal(apiKey.userId, user, amountInUserCurrency, countryCode, normalizedOperator, localPhone, userCurrency, requestedCurrency, true, crossCurrencyOverride);
      } else if (activeProvider === "paydunya") {
        // Paydunya inline payout — netMode: send exact amountInUserCurrency to provider, add fee on top
        result = await (async () => {
          const countryWithdrawModes: Record<string, Record<string, string>> = {
            "SN": { "orange": "orange-money-senegal", "free": "free-money-senegal", "expresso": "expresso-senegal", "wave": "wave-senegal", "wizall": "wizall-senegal" },
            "CI": { "orange": "orange-money-ci", "mtn": "mtn-ci", "moov": "moov-ci", "wave": "wave-ci" },
            "BF": { "orange": "orange-money-burkina", "moov": "moov-burkina-faso" },
            "BJ": { "moov": "moov-benin", "mtn": "mtn-benin" },
            "TG": { "tmoney": "t-money-togo", "moov": "moov-togo" },
            "ML": { "orange": "orange-money-mali", "moov": "moov-mali" },
            "CM": { "mtn": "mtn-cameroun" },
          };
          const withdrawMode = countryWithdrawModes[countryCode]?.[normalizedOperator];
          if (!withdrawMode) {
            return { success: false, error: "Opérateur non supporté via ce fournisseur" };
          }
          const payduynaCountryCurrencies3486: Record<string, string> = { "CM": "XAF" };
          const providerCurrency = payduynaCountryCurrencies3486[countryCode] || "XOF";
          // netMode: send the exact requested amount to the provider
          // crossCurrencyOverride: use original requested amount to avoid double-conversion
          let amountForProvider = crossCurrencyOverride ?? amountInUserCurrency;
          if (!crossCurrencyOverride && userCurrency !== providerCurrency) {
            const { convertCurrency } = await import("./currency-converter");
            const conv = await convertCurrency(amountInUserCurrency, userCurrency, providerCurrency);
            if (conv.success) amountForProvider = Math.floor(conv.convertedAmount);
          }
          // Debit immediately and create pending transaction — dispatch to provider in 5s
          await storage.updateUserBalance(apiKey.userId, -(feeInfo.totalDeductedFromBalance + apiPayoutExchangeFee));
          const tx = await storage.createTransaction({
            userId: apiKey.userId, type: "withdrawal",
            amount: amountInUserCurrency, fee: feeInfo.feeAmount,
            feePercentage: feeInfo.feePercentage, currency: userCurrency,
            status: "pending", country: countryCode, operator: normalizedOperator,
            customerPhone: localPhone,
            description: `Payout API ${amountInUserCurrency} ${userCurrency}`,
            metadata: JSON.stringify({
              provider: "paydunya", apiKeyId: apiKey.id, reference,
              phone: localPhone,
              deductedFromBalance: feeInfo.totalDeductedFromBalance + apiPayoutExchangeFee,
              providerAmount: amountForProvider, providerCurrency,
              netMode: true,
            }),
          });
          const callbackBaseUrl = process.env.BASE_URL || "https://bkapay.com";
          const txId = tx.id;
          const userId = apiKey.userId;
          setTimeout(async () => {
            try {
              const getInvoiceResp = await callPaydunyaAPIv2("/disburse/get-invoice", {
                account_alias: localPhone, amount: amountForProvider,
                withdraw_mode: withdrawMode, callback_url: `${callbackBaseUrl}/api/webhooks/paydunya-disburse`,
              });
              if (getInvoiceResp.response_code !== "00" || !getInvoiceResp.disburse_token) {
                console.error(`[API Payout PAYDUNYA] Get-invoice failed for ${txId} - refunding`);
                await safeRefundOutgoingTransaction(txId, userId, {}, "apipayout-paydunya-get-invoice-failed");
                const meta = JSON.parse((await storage.getTransaction(txId))?.metadata || "{}");
                await sendApiPayoutCallback(txId, meta, "failed");
                return;
              }
              const disburseId = `apipayout-${userId.substring(0, 8)}-${Date.now()}`;
              const submitResp = await callPaydunyaAPIv2("/disburse/submit-invoice", {
                disburse_invoice: getInvoiceResp.disburse_token, disburse_id: disburseId,
              });
              if (submitResp.response_code !== "00") {
                console.error(`[API Payout PAYDUNYA] Submit-invoice failed for ${txId} - refunding`);
                await safeRefundOutgoingTransaction(txId, userId, {}, "apipayout-paydunya-submit-failed");
                const meta = JSON.parse((await storage.getTransaction(txId))?.metadata || "{}");
                await sendApiPayoutCallback(txId, meta, "failed");
                return;
              }
              await storage.updateTransactionMetadata(txId, JSON.stringify({
                provider: "paydunya", apiKeyId: apiKey.id, reference, phone: localPhone,
                paydunyaTransactionId: submitResp.transaction_id, disburseId,
                deductedFromBalance: feeInfo.totalDeductedFromBalance + apiPayoutExchangeFee,
                providerAmount: amountForProvider, providerCurrency, netMode: true,
              }));
              await storage.updateTransaction(txId, { paydunyaToken: getInvoiceResp.disburse_token });
              await storage.updateTransactionStatus(txId, "completed");
              console.log(`[API Payout PAYDUNYA] ✅ tx ${txId} COMPLETED`);
              const meta = JSON.parse((await storage.getTransaction(txId))?.metadata || "{}");
              await sendApiPayoutCallback(txId, meta, "completed");
            } catch (dispatchErr) {
              console.error(`[API Payout PAYDUNYA] Dispatch error for ${txId}:`, dispatchErr);
              await safeRefundOutgoingTransaction(txId, userId, {}, "apipayout-paydunya-dispatch-error");
              const meta = JSON.parse((await storage.getTransaction(txId))?.metadata || "{}");
              await sendApiPayoutCallback(txId, meta, "failed");
            }
          }, 5000);
          return { success: true, transactionId: tx.id, status: "pending", message: "Payout initié avec succès" };
        })();
      } else {
        return res.status(400).json({
          success: false,
          error: { code: "OPERATOR_UNAVAILABLE", message: "Aucun fournisseur disponible pour cette opération" }
        });
      }

      // 13. Update transaction metadata with API key reference (always, even on failure)
      if (result.transactionId) {
        try {
          const tx = await storage.getTransaction(result.transactionId);
          if (tx && tx.metadata) {
            const meta = JSON.parse(tx.metadata);
            meta.apiKeyId = apiKey.id;
            meta.apiKeyPublicKey = apiKey.publicKey;
            if (reference) meta.reference = reference;
            await storage.updateTransactionMetadata(result.transactionId, JSON.stringify(meta));
          }
        } catch (e) {}
      }

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: { code: "TRANSACTION_FAILED", message: "La transaction a échoué. Vérifiez le numéro, l'opérateur et réessayez." }
        });
      }

      // Apply exchange fee for non-Paydunya providers (Paydunya already includes it in its inline deduction)
      if (activeProvider !== "paydunya" && apiPayoutExchangeFee > 0) {
        await storage.updateUserBalance(apiKey.userId, -apiPayoutExchangeFee);
        console.log(`[API Payout ${activeProvider}] Exchange fee deducted: ${apiPayoutExchangeFee} ${userCurrency}`);
        // Store exchange fee in metadata so safeRefundOutgoingTransaction can include it in refund
        if (result.transactionId) {
          try {
            const txForXFee = await storage.getTransaction(result.transactionId);
            if (txForXFee) {
              const xFeeMeta = txForXFee.metadata ? JSON.parse(txForXFee.metadata) : {};
              xFeeMeta.exchangeFee = (xFeeMeta.exchangeFee || 0) + apiPayoutExchangeFee;
              xFeeMeta.exchangeFeePercentage = xFeeApiPayout.feePercentage;
              xFeeMeta.exchangeFeeFrom = userCurrency;
              xFeeMeta.exchangeFeeTo = payoutDestCurrency;
              await storage.updateTransactionMetadata(result.transactionId, JSON.stringify(xFeeMeta));
            }
          } catch (_) { /* best effort */ }
        }
      }

      // 14. Send async callback webhook with retry logic for final statuses.
      // For synchronous providers (Paydunya) that complete immediately, we call
      // sendApiPayoutCallback directly — it retries up to 10 minutes if needed.
      // For async providers (PawaPay, MbiyoPay, MoneyFusion, FedaPay), the polling
      // loop / provider webhook handler will call sendApiPayoutCallback when finalized.
      if (result.transactionId) {
        setImmediate(async () => {
          try {
            const tx = await storage.getTransaction(result.transactionId!);
            if (!tx) return;
            const meta = JSON.parse(tx.metadata || "{}");
            if (tx.status === "completed") {
              await sendApiPayoutCallback(tx.id, meta, "completed");
            } else if (tx.status === "failed") {
              await sendApiPayoutCallback(tx.id, meta, "failed");
            }
            // For "pending" status: sendApiPayoutCallback will be called later
            // by the polling loop or provider webhook handler when finalized.
          } catch (e) {
            console.error("[API Payout] Callback error:", e);
          }
        });
      }

      const finalStatus = (result as any).status || "pending";
      return res.json({
        success: true,
        transactionId: result.transactionId,
        status: finalStatus,
        message: result.message || (finalStatus === "completed" ? "Payout effectué avec succès" : "Payout initié avec succès"),
        recipientAmount: amountInUserCurrency,
        currency: userCurrency,
      });

    } catch (error: any) {
      console.error("[API Payout] Unhandled error:", error);
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Une erreur interne est survenue" }
      });
    }
  });

  // ===== API Payout Status — for developers using /api/v1/payout =====
  app.get("/api/v1/payout/:id/status", async (req: Request, res: Response) => {
    try {
      let privateKey = req.headers.authorization?.replace(/^Bearer\s+/i, "").trim();
      if (!privateKey || !privateKey.startsWith("sk_")) {
        return res.status(401).json({
          success: false,
          error: { code: "INVALID_API_KEY", message: "Clé API privée invalide ou manquante. Utilisez: Authorization: Bearer sk_live_..." }
        });
      }
      const apiKey = await storage.getApiKeyByPrivateKey(privateKey);
      if (!apiKey || !apiKey.isActive) {
        return res.status(401).json({
          success: false,
          error: { code: "INVALID_API_KEY", message: "Clé API invalide ou désactivée" }
        });
      }
      const tx = await storage.getTransaction(req.params.id);
      if (!tx || tx.userId !== apiKey.userId) {
        return res.status(404).json({
          success: false,
          error: { code: "TRANSACTION_NOT_FOUND", message: "Transaction introuvable ou accès refusé" }
        });
      }
      const meta = JSON.parse(tx.metadata || "{}");
      return res.json({
        success: true,
        transactionId: tx.id,
        status: tx.status,
        amount: tx.amount,
        currency: tx.currency,
        country: tx.country,
        operator: tx.operator,
        recipientPhone: meta.phone || tx.customerPhone,
        reference: meta.reference || null,
        provider: meta.provider || meta.paymentProvider || null,
        createdAt: tx.createdAt,
        completedAt: tx.status !== "pending" ? tx.updatedAt : null,
      });
    } catch (error: any) {
      console.error("[API Payout Status] Error:", error);
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Erreur interne du serveur" }
      });
    }
  });

  // ===== Inline Payment Status (public, safe for external callers) =====
  app.get("/api/inline-pay/status/:id", async (req: Request, res: Response) => {
    try {
      const transaction = await storage.getTransaction(req.params.id);
      if (!transaction) {
        return res.status(404).json({ error: "Transaction non trouvee" });
      }

      // Return only safe public fields
      res.json({
        transactionId: transaction.id,
        status: transaction.status,
        amount: transaction.amount,
        currency: transaction.currency || "XOF",
        description: transaction.description || "",
        createdAt: transaction.createdAt,
      });
    } catch (error: any) {
      console.error("Inline pay status error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Developer polling endpoint — check API payment status by transactionId
  // Authentication: publicKey must match the API key that created the transaction
  app.get("/api/pay/status/:transactionId", async (req: Request, res: Response) => {
    try {
      const { transactionId } = req.params;
      const publicKey = req.query.publicKey as string | undefined;

      const transaction = await storage.getTransaction(transactionId);
      if (!transaction || transaction.type !== "api_payment") {
        return res.status(404).json({ error: "Transaction introuvable" });
      }

      let meta: any = {};
      try { meta = JSON.parse(transaction.metadata || "{}"); } catch {}

      if (publicKey) {
        if (meta.apiKeyPublicKey && meta.apiKeyPublicKey !== publicKey) {
          return res.status(403).json({ error: "Acces refuse" });
        }
      }

      return res.json({
        transactionId: transaction.id,
        status: transaction.status,
        amount: transaction.amount,
        fee: transaction.fee || 0,
        netAmount: transaction.amount - (transaction.fee || 0),
        currency: transaction.currency || "XOF",
        country: transaction.country || undefined,
        operator: transaction.operator || undefined,
        customerPhone: transaction.customerPhone || undefined,
        customerName: transaction.customerName || undefined,
        description: transaction.description || undefined,
        externalReference: meta.orderId || undefined,
        createdAt: transaction.createdAt,
      });
    } catch (error: any) {
      console.error("[PayStatus] Error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Get transaction status (for polling) - checks FedaPay or Paydunya if pending
  app.get("/api/transactions/:id/status", async (req: Request, res: Response) => {
    try {
      const transaction = await storage.getTransaction(req.params.id);
      if (!transaction) {
        return res.status(404).json({ error: "Transaction non trouvee" });
      }

      // If transaction is pending, check with payment provider
      if (transaction.status === "pending") {
        let metadata: any = {};
        try {
          metadata = JSON.parse(transaction.metadata || "{}");
        } catch {}

        // Check FedaPay if we have a FedaPay transaction ID
        if (metadata.fedapayTransactionId) {
          try {
            const fedapayStatus = await getTransactionStatus(metadata.fedapayTransactionId);
            console.log(`[TransactionStatus] FedaPay check for ${transaction.id}:`, fedapayStatus);

            if (fedapayStatus.status === "approved" || fedapayStatus.status === "transferred") {
              const result = await storage.finalizeIncomingTransaction(transaction.id, {});
              console.log(`[TransactionStatus] FedaPay CONFIRMED - finalized: ${result ? 'new' : 'already processed'}`);
              if (result && transaction.type === "payment_link" && transaction.customerEmail && metadata.paymentLinkId) {
                try {
                  const pl = await storage.getPaymentLinkById(metadata.paymentLinkId);
                  if (pl?.documentUrls?.length && pl.documentNames?.length) {
                    sendPaymentDocumentsEmail(transaction.customerEmail, transaction.customerName || "Client", pl.productName, pl.documentNames, pl.documentUrls).catch(() => {});
                  }
                } catch {}
              }
              return res.json({ 
                status: "completed",
                message: "Paiement confirme"
              });
            } else if (fedapayStatus.status === "declined" || fedapayStatus.status === "canceled" || fedapayStatus.status === "refunded") {
              await storage.updateTransactionStatus(transaction.id, "failed");
              return res.json({ 
                status: "failed",
                message: "Paiement echoue ou annule"
              });
            }
          } catch (checkError) {
            console.log(`[TransactionStatus] Error checking FedaPay for ${transaction.id}:`, checkError);
          }
        }

        // Check MbiyoPay if we have a MbiyoPay transaction ID
        if (metadata.mbiyopayTransactionId && metadata.provider === "mbiyopay") {
          try {
            const mbiyoStatus = await pollMbiyoPayTransaction(metadata.mbiyopayTransactionId);
            console.log(`[TransactionStatus] MbiyoPay check for ${transaction.id}:`, mbiyoStatus);

            if (mbiyoStatus.completed && mbiyoStatus.status === "completed") {
              if (transaction.type === "deposit" || transaction.type === "payment_link" || transaction.type === "merchant_link" || transaction.type === "api_payment") {
                const result = await storage.finalizeIncomingTransaction(transaction.id, {});
                console.log(`[TransactionStatus] MbiyoPay CONFIRMED - finalized: ${result ? 'new' : 'already processed'}`);
                if (result && transaction.type === "payment_link" && transaction.customerEmail && metadata.paymentLinkId) {
                  try {
                    const pl = await storage.getPaymentLinkById(metadata.paymentLinkId);
                    if (pl?.documentUrls?.length && pl.documentNames?.length) {
                      sendPaymentDocumentsEmail(transaction.customerEmail, transaction.customerName || "Client", pl.productName, pl.documentNames, pl.documentUrls).catch(() => {});
                    }
                  } catch {}
                }
              } else {
                await storage.updateTransactionStatus(transaction.id, "completed");
              }
              return res.json({ 
                status: "completed",
                message: "Paiement confirme"
              });
            } else if (mbiyoStatus.completed && mbiyoStatus.status === "failed") {
              const MBIYOPAY_FAILED_GRACE_PERIOD_MS = 60 * 1000;
              const startTime = metadata.startTime || new Date(transaction.createdAt).getTime();
              const txAge = Date.now() - startTime;
              if (txAge < MBIYOPAY_FAILED_GRACE_PERIOD_MS) {
                console.log(`[TransactionStatus] MbiyoPay shows "failed" but transaction ${transaction.id} too recent (${Math.round(txAge/1000)}s) - returning pending`);
                return res.json({ 
                  status: "pending",
                  message: "Paiement en cours de verification"
                });
              }
              if (transaction.type === "withdrawal" || transaction.type === "transfer") {
                await safeRefundOutgoingTransaction(transaction.id, transaction.userId, metadata, "status-check-mbiyopay-failed");
              }
              await storage.updateTransactionStatus(transaction.id, "failed");
              return res.json({ 
                status: "failed",
                message: "Paiement echoue ou annule"
              });
            }
          } catch (checkError) {
            console.log(`[TransactionStatus] Error checking MbiyoPay for ${transaction.id}:`, checkError);
          }
        }

        // Check PawaPay if we have a PawaPay deposit/payout ID
        if ((metadata.pawaPayDepositId || metadata.pawaPayPayoutId) && metadata.provider === "pawapay") {
          try {
            await pollPawaPayTransaction(transaction.id);
            const updatedTx = await storage.getTransaction(transaction.id);
            if (updatedTx?.status === "completed") {
              return res.json({ status: "completed", message: "Paiement confirme" });
            } else if (updatedTx?.status === "failed") {
              return res.json({ status: "failed", message: "Paiement echoue ou annule" });
            }
          } catch (checkError) {
            console.log(`[TransactionStatus] Error checking PawaPay for ${transaction.id}:`, checkError);
          }
        }

        // Check AfribaPay if we have an AfribaPay transaction ID
        if (metadata.afribaPayTransactionId && metadata.provider === "afribapay") {
          try {
            const { getAfribaPayTransaction, mapAfribaPayStatus } = await import("./afribapay");
            const afribaStatus = await getAfribaPayTransaction(metadata.afribaPayTransactionId);
            console.log(`[TransactionStatus] AfribaPay check for ${transaction.id}: raw status = ${afribaStatus.status}`);

            if (afribaStatus.success) {
              const mappedStatus = mapAfribaPayStatus(afribaStatus.status || "");

              if (mappedStatus === "completed") {
                // Validation multi-critères avant tout crédit
                const { validateAfribaPayFingerprint } = await import("./afribapay");
                const fingerprint = validateAfribaPayFingerprint(afribaStatus, metadata, transaction);
                fingerprint.warnings.forEach(w => console.warn(`[TransactionStatus] ⚠️ AfribaPay fingerprint warning (${transaction.id}): ${w}`));
                if (!fingerprint.valid) {
                  console.error(`[TransactionStatus] 🚨 Fingerprint INVALIDE AfribaPay ${transaction.id}: ${fingerprint.reason} - CREDIT BLOQUE`);
                  await storage.updateTransactionStatus(transaction.id, "failed");
                  return res.json({ status: "failed", message: "Paiement non valide - anomalie detectee" });
                }

                const isIncoming = transaction.type === "deposit" || transaction.type === "payment_link" || transaction.type === "merchant_link" || transaction.type === "api_payment";
                if (isIncoming) {
                  const result = await storage.finalizeIncomingTransaction(transaction.id, {});
                  console.log(`[TransactionStatus] AfribaPay CONFIRMED (fingerprint OK) - finalized: ${result ? 'new' : 'already processed'}`);
                  if (result) {
                    const updatedTx = await storage.getTransaction(transaction.id);
                    if (updatedTx) {
                      trySendPaymentCallback(updatedTx, 'payment.completed', '[TransactionStatus/AfribaPay]');
                    }
                    if (transaction.type === "payment_link" && transaction.customerEmail && metadata.paymentLinkId) {
                      try {
                        const pl = await storage.getPaymentLinkById(metadata.paymentLinkId);
                        if (pl?.documentUrls?.length && pl.documentNames?.length) {
                          sendPaymentDocumentsEmail(transaction.customerEmail, transaction.customerName || "Client", pl.productName, pl.documentNames, pl.documentUrls).catch(() => {});
                        }
                      } catch {}
                    }
                  }
                } else {
                  await storage.updateTransactionStatus(transaction.id, "completed");
                }
                return res.json({ status: "completed", message: "Paiement confirme" });
              } else if (mappedStatus === "failed") {
                const isOutgoing = transaction.type === "withdrawal" || transaction.type === "transfer";
                if (isOutgoing) {
                  await safeRefundOutgoingTransaction(transaction.id, transaction.userId, metadata, "status-check-afribapay-failed");
                }
                await storage.updateTransactionStatus(transaction.id, "failed");
                if (!isOutgoing) {
                  const failedTx = await storage.getTransaction(transaction.id);
                  if (failedTx) trySendPaymentCallback(failedTx, 'payment.failed', '[TransactionStatus/AfribaPay]');
                }
                return res.json({ status: "failed", message: "Paiement echoue ou annule" });
              }
              // Still pending - continue
            }
          } catch (checkError) {
            console.log(`[TransactionStatus] Error checking AfribaPay for ${transaction.id}:`, checkError);
          }
        }

        // Check FeeXPay if we have a FeeXPay reference
        if (metadata.feeXPayReference) {
          try {
            const { getFeeXPayConfig, checkFeeXPayTransactionStatus, mapFeeXPayStatus: mapFeexStatus } = await import("./feexpay");
            const feexConfig = await getFeeXPayConfig();
            if (feexConfig) {
              const feexStatusResult = await checkFeeXPayTransactionStatus(feexConfig, metadata.feeXPayReference);
              console.log(`[TransactionStatus] FeeXPay check for ${transaction.id}: raw=${feexStatusResult.status}, mapped=${feexStatusResult.mappedStatus}`);

              if (feexStatusResult.success && feexStatusResult.mappedStatus === "completed") {
                const isIncoming = transaction.type === "deposit" || transaction.type === "payment_link" || transaction.type === "merchant_link" || transaction.type === "api_payment";
                if (isIncoming) {
                  const result = await storage.finalizeIncomingTransaction(transaction.id, {});
                  console.log(`[TransactionStatus] FeeXPay CONFIRMED - finalized: ${result ? 'new' : 'already processed'}`);
                  if (result) {
                    const updatedTx = await storage.getTransaction(transaction.id);
                    if (updatedTx) {
                      trySendPaymentCallback(updatedTx, 'payment.completed', '[TransactionStatus/FeeXPay]');
                    }
                    if (transaction.type === "payment_link" && transaction.customerEmail && metadata.paymentLinkId) {
                      try {
                        const pl = await storage.getPaymentLinkById(metadata.paymentLinkId);
                        if (pl?.documentUrls?.length && pl.documentNames?.length) {
                          sendPaymentDocumentsEmail(transaction.customerEmail, transaction.customerName || "Client", pl.productName, pl.documentNames, pl.documentUrls).catch(() => {});
                        }
                      } catch {}
                    }
                  }
                } else {
                  await storage.updateTransactionStatus(transaction.id, "completed");
                }
                return res.json({ status: "completed", message: "Paiement confirme" });
              } else if (feexStatusResult.success && feexStatusResult.mappedStatus === "failed") {
                const isOutgoing = transaction.type === "withdrawal" || transaction.type === "transfer";
                if (isOutgoing) {
                  await safeRefundOutgoingTransaction(transaction.id, transaction.userId, metadata, "status-check-feexpay-failed");
                }
                await storage.updateTransactionStatus(transaction.id, "failed");
                if (!isOutgoing) {
                  const failedTx = await storage.getTransaction(transaction.id);
                  if (failedTx) trySendPaymentCallback(failedTx, 'payment.failed', '[TransactionStatus/FeeXPay]');
                }
                return res.json({ status: "failed", message: "Paiement echoue ou annule" });
              }
            }
          } catch (checkError) {
            console.log(`[TransactionStatus] Error checking FeeXPay for ${transaction.id}:`, checkError);
          }
        }

        // Fallback: Check Paydunya if we have a Paydunya token
        if (transaction.paydunyaToken) {
          try {
            const paydunyaResponse = await fetch(
              `https://app.paydunya.com/api/v1/checkout-invoice/confirm/${transaction.paydunyaToken}`,
              {
                method: "GET",
                headers: {
                  "Content-Type": "application/json",
                  "PAYDUNYA-MASTER-KEY": process.env.PAYDUNYA_MASTER_KEY || "",
                  "PAYDUNYA-PRIVATE-KEY": process.env.PAYDUNYA_PRIVATE_KEY || "",
                  "PAYDUNYA-TOKEN": process.env.PAYDUNYA_TOKEN || "",
                },
              }
            );

            if (paydunyaResponse.ok) {
              const data = await paydunyaResponse.json();
              const paymentStatus = data.status || data.invoice?.status;
              const hasValidInvoice = data.invoice && typeof data.invoice === "object";

              if (data.response_code === "00" && hasValidInvoice && paymentStatus === "completed") {
                const result = await storage.finalizeIncomingTransaction(transaction.id, {
                  paydunyaReceiptUrl: data.invoice?.receipt_url || `https://paydunya.com/receipt/${transaction.paydunyaToken}`,
                });
                console.log(`[TransactionStatus] Paydunya CONFIRMED - finalized: ${result ? 'new' : 'already processed'}`);
                if (result && transaction.type === "payment_link" && transaction.customerEmail && metadata.paymentLinkId) {
                  try {
                    const pl = await storage.getPaymentLinkById(metadata.paymentLinkId);
                    if (pl?.documentUrls?.length && pl.documentNames?.length) {
                      sendPaymentDocumentsEmail(transaction.customerEmail, transaction.customerName || "Client", pl.productName, pl.documentNames, pl.documentUrls).catch(() => {});
                    }
                  } catch {}
                }
                return res.json({ 
                  status: "completed",
                  message: "Paiement confirme"
                });
              } else if (paymentStatus === "cancelled" || paymentStatus === "canceled" || paymentStatus === "failed") {
                await storage.updateTransactionStatus(transaction.id, "failed");
                return res.json({ 
                  status: "failed",
                  message: "Paiement echoue ou annule"
                });
              }
            }
          } catch (checkError) {
            console.log(`[TransactionStatus] Error checking Paydunya for ${transaction.id}:`, checkError);
          }
        }
      }

      // Refresh transaction from database to get latest status
      const freshTransaction = await storage.getTransaction(req.params.id);
      res.json({ status: freshTransaction?.status || transaction.status });
    } catch (error: any) {
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // ===== Transactions Routes =====

  function sanitizeTransactionForUser(transaction: any) {
    const sanitized = { ...transaction };
    if (sanitized.metadata) {
      try {
        const meta = typeof sanitized.metadata === 'string' ? JSON.parse(sanitized.metadata) : { ...sanitized.metadata };
        delete meta.provider;
        delete meta.nowpaymentsId;
        delete meta.fedapayTransactionId;
        delete meta.wizallTransactionId;
        delete meta.afribapayId;
        delete meta.payoutId;
        delete meta.payoutWithdrawalId;
        delete meta.payoutBatchId;
        sanitized.metadata = JSON.stringify(meta);
      } catch {}
    }
    return sanitized;
  }
  
  app.get("/api/transactions", requireAuth, async (req: Request, res: Response) => {
    try {
      const transactions = await storage.getTransactions(req.session.userId!);
      const sanitized = transactions.map(sanitizeTransactionForUser);
      res.json(sanitized);
    } catch (error: any) {
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // Get transaction by ID (PUBLIC - no auth required for payment status page)
  app.get("/api/transactions/:id", async (req: Request, res: Response) => {
    try {
      const transaction = await storage.getTransaction(req.params.id);
      if (!transaction) {
        return res.status(404).json({ error: "Transaction non trouvée" });
      }
      res.json(sanitizeTransactionForUser(transaction));
    } catch (error: any) {
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // ===== PSR Endpoint (for Paydunya SDK) =====
  // GET endpoint that returns token for PSR (Paiement Sans Redirection)
  app.get("/api/paydunya-api", async (req: Request, res: Response) => {
    try {
      const ref = req.query.ref as string;
      if (!ref) {
        return res.status(400).json({ error: "Référence de transaction requise" });
      }

      // Find transaction by ID
      const transaction = await storage.getTransaction(ref);
      if (!transaction) {
        return res.status(404).json({ error: "Transaction non trouvée" });
      }

      // Get metadata (contains paydunyaToken)
      let metadata: any = {};
      if (transaction.metadata) {
        metadata = JSON.parse(transaction.metadata);
      }

      if (!metadata.paydunyaToken) {
        return res.status(400).json({ error: "Jeton non disponible" });
      }

      const response: any = {
        success: true,
        token: metadata.paydunyaToken,
      };

      const paydunyaConfig = await getPaydunyaConfig();
      if (paydunyaConfig?.publicKey?.includes("test")) {
        response.mode = "test";
      }

      res.json(response);
    } catch (error: any) {
      console.error("Paydunya API endpoint error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // ===== Payment Processing Routes =====
  
  // Process payment link payment - USSD VERSION
  app.post("/api/payments/process/:token", async (req: Request, res: Response) => {
    try {
      const { customerName, customerEmail, customerPhone, country, operator, customFieldResponses } = req.body;
      const { token } = req.params;

      console.log("[PAYMENT_LINK] Received request with:", {
        customerName,
        customerEmail,
        customerPhone,
        country,
        operator,
      });

      // Get payment link
      const paymentLink = await storage.getPaymentLinkByToken(token);
      if (!paymentLink || !paymentLink.isActive) {
        return res.status(404).json({ error: "Lien de paiement non trouvé ou inactif" });
      }

      // Check if user account is suspended
      const owner = await storage.getUser(paymentLink.userId);
      if (owner?.suspended) {
        return res.status(404).json({ error: "Ce lien n'existe pas ou a été supprimé" });
      }

      // Wave payin activation check (on behalf of the merchant)
      if (operator && operator.toLowerCase() === "wave" && !owner?.wavePayinEnabled) {
        return res.status(403).json({ success: false, error: "Le wave de votre marchand n'est pas activée" });
      }

      // Get owner's currency and payer's currency
      const ownerCurrency = owner?.country ? getCurrencyForCountry(owner.country) : "XOF";
      const payerCurrency = getCurrencyForCountry(country) || "XOF";
      const payduynaCountryCurrencies4002: Record<string, string> = { "CM": "XAF" };
      const providerCurrency = payduynaCountryCurrencies4002[country.toUpperCase()] || "XOF";

      // Calculate amount to send to provider based on customerPaysFee setting
      let amountForProvider: number;
      let feeAmount: number;
      let feePercentage: number;
      let netAmountForUser: number;
      let baseAmountInOwnerCurrency = paymentLink.amount;
      
      // Get dynamic fee configuration from database (auto-detect active provider)
      const feeConfig = await getDynamicFees(storage, country, operator);
      
      if (paymentLink.customerPaysFee) {
        // Customer pays fee: send TOTAL (base + fees) to provider, user receives base amount
        const feeInfo = calculateCustomerPaysFee(paymentLink.amount, feeConfig.incoming);
        amountForProvider = feeInfo.totalForProvider;
        feeAmount = feeInfo.feeAmount;
        feePercentage = feeInfo.feePercentage;
        netAmountForUser = feeInfo.baseAmount;
        console.log("[PAYMENT_LINK] Customer pays fee - sending total to provider:", {
          baseAmount: paymentLink.amount,
          fee: feeAmount,
          totalForProvider: amountForProvider,
          userReceives: netAmountForUser,
        });
      } else {
        // User pays fee: send base amount, user receives net (base - fees)
        const feeInfo = calculateIncomingFee(paymentLink.amount, feeConfig.incoming);
        amountForProvider = feeInfo.grossAmount;
        feeAmount = feeInfo.feeAmount;
        feePercentage = feeInfo.feePercentage;
        netAmountForUser = feeInfo.netAmount;
      }

      // Exchange fee when payer's currency differs from merchant's balance currency (personal accounts only)
      if (providerCurrency !== ownerCurrency) {
        const { feeAmount: xFee, feePercentage: xFeePct } =
          await getIncomingExchangeFee(storage, paymentLink.amount, providerCurrency, ownerCurrency, owner?.accountType);
        if (xFee > 0) {
          netAmountForUser = Math.max(0, netAmountForUser - xFee);
          feeAmount += xFee;
          feePercentage += xFeePct;
        }
      }

      // CRITICAL: Convert amount to provider currency (XOF) if owner's currency is different
      let convertedAmountForProvider = amountForProvider;
      if (ownerCurrency !== providerCurrency) {
        const { convertCurrency } = await import("./currency-converter");
        const conversionResult = await convertCurrency(amountForProvider, ownerCurrency, providerCurrency);
        if (conversionResult.success) {
          convertedAmountForProvider = Math.floor(conversionResult.convertedAmount);
          console.log(`[PAYMENT_LINK] Currency conversion: ${amountForProvider} ${ownerCurrency} -> ${convertedAmountForProvider} ${providerCurrency}`);
        } else {
          console.error("[PAYMENT_LINK] Currency conversion failed:", conversionResult.error);
          return res.status(500).json({ error: "Erreur de conversion de devise" });
        }
      }

      // Call Paydunya API to create checkout invoice with customer info
      // Note: Use generic email for privacy - never send real customer emails to providers
      const paydunyaData = {
        invoice: {
          total_amount: convertedAmountForProvider, // ALWAYS send converted amount to provider
          description: `Paiement - ${paymentLink.productName}`,
          customer: {
            name: customerName || "Client",
            email: "noreply@bkapay.com", // Privacy: never send real customer emails to providers
            phone: customerPhone,
          },
        },
        store: {
          name: "BKApay",
          tagline: "Plateforme de paiement mobile money",
        },
        custom_data: {
          type: "payment_link",
          user_id: paymentLink.userId,
          customer_name: customerName,
          customer_email: "noreply@bkapay.com", // Privacy: never send real customer emails to providers
          customer_phone: customerPhone,
          country,
          operator,
          customerPaysFee: paymentLink.customerPaysFee,
        },
        actions: {
          callback_url: `${process.env.BASE_URL || 'https://bkapay.com'}/api/webhooks/paydunya`,
        },
      };

      console.log("[PAYMENT_LINK] Creating invoice with data:", paydunyaData);

      const paydunyaResponse = await callPaydunyaAPI("/checkout-invoice/create", paydunyaData);

      if (paydunyaResponse.response_code === "00") {
        // Create transaction - store in owner's currency for balance credit
        const transactionId = randomUUID();
        await storage.createTransaction({
          userId: paymentLink.userId,
          type: "payment_link",
          amount: baseAmountInOwnerCurrency, // Store base amount in owner's currency for balance
          fee: feeAmount,
          feePercentage: feePercentage,
          currency: ownerCurrency, // Store in owner's currency
          status: "pending",
          country,
          operator,
          description: `Paiement - ${paymentLink.productName}`,
          customerName,
          customerEmail,
          customerPhone,
          paydunyaToken: paydunyaResponse.token, // Store in dedicated column
          metadata: JSON.stringify({
            paymentLinkId: paymentLink.id,
            customerPaysFee: paymentLink.customerPaysFee,
            baseAmount: paymentLink.amount,
            netAmountForUser: netAmountForUser,
            providerAmount: convertedAmountForProvider,
            providerCurrency: providerCurrency,
            balanceAmount: netAmountForUser,
            balanceCurrency: ownerCurrency,
            ...(customFieldResponses ? { customFieldResponses } : {}),
          }),
        });

        // Return token for SOFTPAY polling (same as deposits)
        res.json({
          success: true,
          transactionId: transactionId,
          token: paydunyaResponse.token,
        });
      } else {
        res.status(400).json({ 
          error: "Erreur lors de l'initiation du paiement" 
        });
      }
    } catch (error: any) {
      console.error("Payment processing error:", error);
      res.status(500).json({ error: "Erreur lors du traitement du paiement" });
    }
  });

  // Process merchant link payment - USSD VERSION
  app.post("/api/merchant-payments/process/:token", async (req: Request, res: Response) => {
    try {
      const { amount, customerName, customerEmail, customerPhone, country, operator } = req.body;
      const { token } = req.params;

      console.log("[MERCHANT_LINK] Received request with:", {
        amount,
        customerName,
        customerEmail,
        customerPhone,
        country,
        operator,
      });

      // Get merchant link
      const merchantLink = await storage.getMerchantLinkByToken(token);
      if (!merchantLink || !merchantLink.isActive) {
        return res.status(404).json({ error: "Lien marchand non trouvé ou inactif" });
      }

      // Check if user account is suspended
      const owner = await storage.getUser(merchantLink.userId);
      if (owner?.suspended) {
        return res.status(404).json({ error: "Ce lien n'existe pas ou a été supprimé" });
      }

      // Wave payin activation check (on behalf of the merchant)
      if (operator && operator.toLowerCase() === "wave" && !owner?.wavePayinEnabled) {
        return res.status(403).json({ success: false, error: "Le wave de votre marchand n'est pas activée" });
      }

      // Get owner's currency and provider currency
      const ownerCurrency = owner?.country ? getCurrencyForCountry(owner.country) : "XOF";
      const payduynaCountryCurrencies4166: Record<string, string> = { "CM": "XAF" };
      const providerCurrency = payduynaCountryCurrencies4166[country?.toUpperCase()] || "XOF";
      const baseAmountInOwnerCurrency = Math.floor(amount);

      // CRITICAL: Convert amount to provider currency (XOF) if owner's currency is different
      let convertedAmountForProvider = baseAmountInOwnerCurrency;
      if (ownerCurrency !== providerCurrency) {
        const { convertCurrency } = await import("./currency-converter");
        const conversionResult = await convertCurrency(baseAmountInOwnerCurrency, ownerCurrency, providerCurrency);
        if (conversionResult.success) {
          convertedAmountForProvider = Math.floor(conversionResult.convertedAmount);
          console.log(`[MERCHANT_LINK] Currency conversion: ${baseAmountInOwnerCurrency} ${ownerCurrency} -> ${convertedAmountForProvider} ${providerCurrency}`);
        } else {
          console.error("[MERCHANT_LINK] Currency conversion failed:", conversionResult.error);
          return res.status(500).json({ error: "Erreur de conversion de devise" });
        }
      }

      // Call Paydunya API with customer info
      // Note: Use generic email for privacy - never send real customer emails to providers
      const paydunyaData = {
        invoice: {
          total_amount: convertedAmountForProvider, // ALWAYS send converted amount to provider
          description: `Paiement marchand - ${merchantLink.merchantName}`,
          customer: {
            name: customerName || "Client",
            email: "noreply@bkapay.com", // Privacy: never send real customer emails to providers
            phone: customerPhone,
          },
        },
        store: {
          name: merchantLink.merchantName,
        },
        custom_data: {
          type: "merchant_link",
          merchant_user_id: merchantLink.userId,
          merchant_name: merchantLink.merchantName,
          customer_name: customerName,
          customer_email: "noreply@bkapay.com", // Privacy: never send real customer emails to providers
          customer_phone: customerPhone,
          country,
          operator,
        },
        actions: {
          callback_url: `${process.env.BASE_URL || 'https://bkapay.com'}/api/webhooks/paydunya`,
        },
      };

      console.log("[MERCHANT_LINK] Creating invoice with data:", paydunyaData);

      const paydunyaResponse = await callPaydunyaAPI("/checkout-invoice/create", paydunyaData);

      if (paydunyaResponse.response_code === "00") {
        // Calculate fees for INCOMING payment with dynamic fee from database (auto-detect active provider)
        const feeConfig = await getDynamicFees(storage, country, operator);
        const feeInfo = calculateIncomingFee(baseAmountInOwnerCurrency, feeConfig.incoming);

        // Exchange fee when payer's currency differs from merchant's balance currency (personal accounts only)
        const { feeAmount: mlXFee, feePercentage: mlXFeePct } =
          await getIncomingExchangeFee(storage, baseAmountInOwnerCurrency, providerCurrency, ownerCurrency, owner?.accountType);
        const mlNetAmountForUser = Math.max(0, feeInfo.netAmount - mlXFee);
        const mlTotalFee = feeInfo.feeAmount + mlXFee;
        const mlTotalFeePct = feeInfo.feePercentage + mlXFeePct;
        
        // Create transaction - store in owner's currency for balance credit
        const transactionId = randomUUID();
        await storage.createTransaction({
          userId: merchantLink.userId,
          type: "merchant_link",
          amount: baseAmountInOwnerCurrency, // Store in owner's currency for balance
          fee: mlTotalFee,
          feePercentage: mlTotalFeePct,
          currency: ownerCurrency, // Store in owner's currency
          status: "pending",
          country,
          operator,
          description: `Paiement marchand - ${merchantLink.merchantName}`,
          customerName,
          customerEmail,
          customerPhone,
          paydunyaToken: paydunyaResponse.token, // Store in dedicated column
          metadata: JSON.stringify({
            merchantLinkId: merchantLink.id,
            netAmountForUser: mlNetAmountForUser,
            providerAmount: convertedAmountForProvider,
            providerCurrency: providerCurrency,
            balanceAmount: mlNetAmountForUser,
            balanceCurrency: ownerCurrency,
            ...(mlXFee > 0 ? { exchangeFee: mlXFee, exchangeFeePercentage: mlXFeePct } : {}),
          }),
        });

        // Return token for SOFTPAY polling (same as deposits)
        res.json({
          success: true,
          transactionId: transactionId,
          token: paydunyaResponse.token,
        });
      } else {
        res.status(400).json({ 
          error: "Erreur lors de l'initiation du paiement" 
        });
      }
    } catch (error: any) {
      console.error("Merchant payment processing error:", error);
      res.status(500).json({ error: "Erreur lors du traitement du paiement" });
    }
  });

  // ===== Deposit Routes - DISABLED =====
  app.post("/api/deposits", requireAuth, async (req: Request, res: Response) => {
    return res.status(503).json({
      success: false,
      error: "Le système de paiement est temporairement indisponible. Veuillez réessayer ultérieurement."
    });
  });

  // ===== SOFTPAY Routes (OTP-Based Operator-Specific Endpoints) =====
  
  // Step 1: Initialize SOFTPAY Payment - Create invoice and return token + USSD instructions
  app.post("/api/softpay/init-payment", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.suspended) {
        return res.status(403).json({ error: "Votre compte a été suspendu. Veuillez contacter le support." });
      }

      // Check deposit enabled (global + per-user override)
      const depositSetting = await pgPool.query("SELECT value FROM platform_settings WHERE key = 'deposit_enabled'");
      const depositGlobalEnabled = depositSetting.rows.length === 0 || depositSetting.rows[0].value === 'true';
      if (!depositGlobalEnabled && !user?.depositOverrideEnabled) {
        return res.status(403).json({ error: "Les dépôts sont temporairement désactivés. Veuillez contacter le support." });
      }

      const { amount, description, country, operator, phone, customerName, customerEmail } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Montant invalide" });
      }

      if (!country || !operator || !phone) {
        return res.status(400).json({ error: "Pays, opérateur et numéro de téléphone requis" });
      }

      // Wave payin activation check
      if (operator.toLowerCase() === "wave" && !user?.wavePayinEnabled) {
        return res.status(403).json({ error: "Pour faire les opérations Via wave, contacter le support pour l'activer" });
      }

      // Create Paydunya invoice to get token
      // Include customer info in invoice for pre-filling payment page
      // Note: Use generic email for privacy - never send real customer emails to providers
      const effectiveCustomerName = customerName || `${user!.firstName} ${user!.lastName}`;
      
      const paydunyaData = {
        invoice: {
          total_amount: Math.floor(amount),
          description: description || `Dépôt de ${amount} ${({ "CM": "XAF" } as Record<string,string>)[country?.toUpperCase()] || "XOF"}`,
          customer: {
            name: effectiveCustomerName,
            email: "noreply@bkapay.com",
            phone: phone,
          },
        },
        store: {
          name: "BKApay",
        },
        custom_data: {
          user_id: req.session.userId!,
          type: "deposit",
          country,
          operator,
          phone,
        },
        actions: {
          callback_url: `${process.env.BASE_URL || 'https://bkapay.com'}/api/webhooks/paydunya`,
        },
      };

      console.log("[SOFTPAY INIT] Creating invoice:", paydunyaData);

      const paydunyaResponse = await callPaydunyaAPI("/checkout-invoice/create", paydunyaData);

      if (paydunyaResponse.response_code === "00" && paydunyaResponse.token) {
        // Calculate fees for INCOMING payment with dynamic fee from database (auto-detect active provider)
        const grossAmount = Math.floor(amount);
        const depositFeeConfig = await getDynamicFees(storage, country, operator);
        const feeInfo = calculateIncomingFee(grossAmount, depositFeeConfig.incoming);
        
        // Create transaction with GROSS amount (what client pays)
        const transactionId = randomUUID();
        await storage.createTransaction({
          userId: req.session.userId!,
          type: "deposit",
          amount: feeInfo.grossAmount,
          fee: feeInfo.feeAmount,
          feePercentage: feeInfo.feePercentage,
          currency: ({ "CM": "XAF" } as Record<string,string>)[country?.toUpperCase()] || "XOF",
          status: "pending",
          country,
          operator,
          description: description || `Dépôt de ${grossAmount} ${({ "CM": "XAF" } as Record<string,string>)[country?.toUpperCase()] || "XOF"}`,
          paydunyaToken: paydunyaResponse.token,
          metadata: JSON.stringify({
            phone,
            customerName: effectiveCustomerName,
          }),
        });

        // Get operator configuration for USSD instructions
        const operatorKey = getOperatorKey(operator, country);
        const ussdInstruction = operatorKey ? getUSSDInstruction(operatorKey) : null;
        const needsOTP = operatorKey ? requiresOTP(operatorKey) : false;
        const twoStep = operatorKey ? requiresTwoStep(operatorKey) : false;

        // CRITICAL FIX: For operators that DO NOT require OTP, call SOFTPAY endpoint immediately!
        // This triggers the SMS to be sent to the customer's phone
        if (!needsOTP && !twoStep && operatorKey) {
          console.log(`[SOFTPAY INIT] Operator ${operatorKey} does NOT require OTP - calling SOFTPAY endpoint immediately`);
          
          // Note: Use generic email for privacy - never send real customer emails to providers
          const paymentData: SoftpayPaymentData = {
            customerName: effectiveCustomerName,
            customerEmail: "noreply@bkapay.com", // Privacy: never send real customer emails to providers
            phoneNumber: phone,
            invoiceToken: paydunyaResponse.token,
          };

          const softpayResult = await callPaydunyaSoftpay(operator, country, paymentData);
          
          console.log(`[SOFTPAY INIT] SOFTPAY result for ${operatorKey}:`, softpayResult);

          if (softpayResult.success) {
            // For redirect-based operators (Wave, Orange SN, etc.), return redirect URL(s)
            if (softpayResult.url || softpayResult.omUrl) {
              return res.json({
                success: true,
                transactionId,
                token: paydunyaResponse.token,
                ussdInstruction: softpayResult.message,
                requiresOTP: false,
                requiresTwoStep: false,
                redirectUrl: softpayResult.url,
                omUrl: softpayResult.omUrl,     // Orange Money SN deep link
                maxitUrl: softpayResult.maxitUrl, // Maxit app deep link
              });
            }

            // Payment initiated - customer should receive SMS
            return res.json({
              success: true,
              transactionId,
              token: paydunyaResponse.token,
              ussdInstruction: softpayResult.message || ussdInstruction,
              requiresOTP: false,
              requiresTwoStep: false,
              message: softpayResult.message,
            });
          } else {
            // SOFTPAY call failed - return error
            console.error(`[SOFTPAY INIT] SOFTPAY call failed:`, softpayResult.message);
            return res.status(400).json({
              error: softpayResult.message || "Erreur lors de l'envoi du paiement",
            });
          }
        }

        // For operators that require OTP, just return the token and wait for confirm step
        res.json({
          success: true,
          transactionId,
          token: paydunyaResponse.token,
          ussdInstruction,
          requiresOTP: needsOTP,
          requiresTwoStep: twoStep,
        });
      } else {
        console.error("[SOFTPAY INIT] Error response:", paydunyaResponse);
        res.status(400).json({
          error: "Erreur lors de la création de la facture",
        });
      }
    } catch (error: any) {
      console.error("[SOFTPAY INIT] Error:", error);
      res.status(500).json({ error: "Erreur lors de l'initialisation du paiement" });
    }
  });

  // Step 2: Confirm SOFTPAY Payment - Call operator-specific endpoint with OTP
  app.post("/api/softpay/confirm-payment", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.suspended) {
        return res.status(403).json({ error: "Votre compte a été suspendu. Veuillez contacter le support." });
      }

      const { token, authorizationCode, country, operator, phone, customerName, customerEmail } = req.body;

      if (!token || !country || !operator || !phone) {
        return res.status(400).json({ error: "Informations de paiement incomplètes" });
      }

      // Get transaction by token
      const transaction = await storage.getTransactionByPaydunyaToken(token);
      if (!transaction) {
        return res.status(404).json({ error: "Transaction non trouvée" });
      }

      // Parse metadata to get customer info and Wizall transactionId if exists
      let metadata: any = {};
      if (transaction.metadata) {
        metadata = JSON.parse(transaction.metadata);
      }

      // Check if this is Wizall two-step flow
      const operatorKey = getOperatorKey(operator, country);
      const isTwoStep = operatorKey ? requiresTwoStep(operatorKey) : false;

      if (isTwoStep && operator.toLowerCase() === "wizall" && country.toUpperCase() === "SN") {
        // WIZALL TWO-STEP: Call /wizall-money-senegal/confirm endpoint
        console.log("[SOFTPAY WIZALL CONFIRM] Confirming Wizall payment with OTP");

        if (!metadata.wizallTransactionId) {
          return res.status(400).json({ error: "Transaction Wizall non initiée. Veuillez réessayer." });
        }

        // Call Wizall confirm helper
        const confirmResult = await confirmWizallPayment(authorizationCode!, phone, metadata.wizallTransactionId);

        if (confirmResult.success) {
          res.json({
            success: true,
            message: confirmResult.message,
            transactionId: transaction.id,
          });
        } else {
          res.status(400).json({
            error: confirmResult.message,
          });
        }
      } else {
        // STANDARD FLOW: Call operator-specific SOFTPAY endpoint
        // Note: Use generic email for privacy - never send real customer emails to providers
        const paymentData: SoftpayPaymentData = {
          customerName: customerName || metadata.customerName || `${user!.firstName} ${user!.lastName}`,
          customerEmail: "noreply@bkapay.com", // Privacy: never send real customer emails to providers
          phoneNumber: phone,
          invoiceToken: token,
          authorizationCode,
        };

        console.log("[SOFTPAY CONFIRM] Calling SOFTPAY endpoint for:", operator, country);

        const softpayResult = await callPaydunyaSoftpay(operator, country, paymentData);

        if (softpayResult.success) {
          // For Wizall first step, store the TransactionID in metadata
          if (softpayResult.transactionId && isTwoStep) {
            // Update transaction metadata with Wizall TransactionID
            const updatedMetadata = {
              ...metadata,
              wizallTransactionId: softpayResult.transactionId,
            };
            await storage.updateTransactionStatus(transaction.id, "pending", {
              metadata: JSON.stringify(updatedMetadata),
            });

            // Return message asking for OTP
            res.json({
              success: true,
              message: "Code OTP envoyé. Veuillez entrer le code reçu par SMS.",
              transactionId: transaction.id,
              requiresOTP: true,
              wizallTransactionId: softpayResult.transactionId,
            });
          } else {
            // Payment initiated successfully - webhook will confirm
            res.json({
              success: true,
              message: softpayResult.message,
              transactionId: transaction.id,
              fees: softpayResult.fees,
              currency: softpayResult.currency,
              redirectUrl: softpayResult.url, // For Wave/Orange SN operators
              omUrl: softpayResult.omUrl,
              maxitUrl: softpayResult.maxitUrl,
            });
          }
        } else {
          res.status(400).json({
            error: softpayResult.message || "Erreur lors du paiement",
          });
        }
      }
    } catch (error: any) {
      console.error("[SOFTPAY CONFIRM] Error:", error);
      res.status(500).json({ error: "Erreur lors de la confirmation du paiement" });
    }
  });

  // SOFTPAY for Payment Links - Initialize payment
  app.post("/api/payments/softpay-init/:token", async (req: Request, res: Response) => {
    try {
      const { customerName, customerEmail, customerPhone, country, operator } = req.body;
      const { token } = req.params;

      if (!country || !operator || !customerPhone) {
        return res.status(400).json({ error: "Pays, opérateur et numéro de téléphone requis" });
      }

      // Get payment link
      const paymentLink = await storage.getPaymentLinkByToken(token);
      if (!paymentLink || !paymentLink.isActive) {
        return res.status(404).json({ error: "Lien de paiement non trouvé ou inactif" });
      }

      // Check if user account is suspended
      const owner = await storage.getUser(paymentLink.userId);
      if (owner?.suspended) {
        return res.status(404).json({ error: "Ce lien n'existe pas ou a été supprimé" });
      }

      // Wave payin activation check (on behalf of the merchant)
      if (operator && operator.toLowerCase() === "wave" && !owner?.wavePayinEnabled) {
        return res.status(403).json({ success: false, error: "Le wave de votre marchand n'est pas activée" });
      }

      // Create Paydunya invoice with customer info
      const paydunyaData = {
        invoice: {
          total_amount: paymentLink.amount,
          description: `Paiement - ${paymentLink.productName}`,
          customer: {
            name: customerName || "Client",
            email: customerEmail || "",
            phone: customerPhone,
          },
        },
        store: {
          name: "BKApay",
        },
        custom_data: {
          type: "payment_link",
          user_id: paymentLink.userId,
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone,
          country,
          operator,
        },
        actions: {
          callback_url: `${process.env.BASE_URL || 'http://localhost:5000'}/api/webhooks/paydunya`,
        },
      };

      const paydunyaResponse = await callPaydunyaAPI("/checkout-invoice/create", paydunyaData);

      if (paydunyaResponse.response_code === "00" && paydunyaResponse.token) {
        // Calculate fees for INCOMING payment with dynamic fee from database (auto-detect active provider)
        const grossAmount = paymentLink.amount;
        const linkFeeConfig = await getDynamicFees(storage, country, operator);
        const feeInfo = calculateIncomingFee(grossAmount, linkFeeConfig.incoming);
        
        // Create transaction
        const transactionId = randomUUID();
        await storage.createTransaction({
          userId: paymentLink.userId,
          type: "payment_link",
          amount: feeInfo.grossAmount,
          fee: feeInfo.feeAmount,
          feePercentage: feeInfo.feePercentage,
          currency: ({ "CM": "XAF" } as Record<string,string>)[country?.toUpperCase()] || "XOF",
          status: "pending",
          country,
          operator,
          description: `Paiement - ${paymentLink.productName}`,
          customerName,
          customerEmail,
          customerPhone,
          paydunyaToken: paydunyaResponse.token,
          metadata: JSON.stringify({
            paymentLinkId: paymentLink.id,
          }),
        });

        // Get operator configuration for USSD instructions
        const operatorKey = getOperatorKey(operator, country);
        const ussdInstruction = operatorKey ? getUSSDInstruction(operatorKey) : null;
        const needsOTP = operatorKey ? requiresOTP(operatorKey) : false;
        const twoStep = operatorKey ? requiresTwoStep(operatorKey) : false;

        res.json({
          success: true,
          transactionId,
          token: paydunyaResponse.token,
          ussdInstruction,
          requiresOTP: needsOTP,
          requiresTwoStep: twoStep,
        });
      } else {
        res.status(400).json({ error: "Erreur lors de la création de la facture" });
      }
    } catch (error: any) {
      console.error("[PAYMENT_LINK SOFTPAY INIT] Error:", error);
      res.status(500).json({ error: "Erreur lors de l'initialisation du paiement" });
    }
  });

  // SOFTPAY for Payment Links - Confirm payment with OTP
  app.post("/api/payments/softpay-confirm", async (req: Request, res: Response) => {
    try {
      const { token, authorizationCode, country, operator, customerPhone, customerName, customerEmail } = req.body;

      if (!token || !country || !operator || !customerPhone) {
        return res.status(400).json({ error: "Informations de paiement incomplètes" });
      }

      // Get transaction by token
      const transaction = await storage.getTransactionByPaydunyaToken(token);
      if (!transaction) {
        return res.status(404).json({ error: "Transaction non trouvée" });
      }

      // Parse metadata for Wizall transactionId
      let metadata: any = {};
      if (transaction.metadata) {
        metadata = JSON.parse(transaction.metadata);
      }

      // Check if this is Wizall two-step flow
      const operatorKey = getOperatorKey(operator, country);
      const isTwoStep = operatorKey ? requiresTwoStep(operatorKey) : false;

      if (isTwoStep && operator.toLowerCase() === "wizall" && country.toUpperCase() === "SN") {
        // WIZALL TWO-STEP: Call /wizall-money-senegal/confirm endpoint
        if (!metadata.wizallTransactionId) {
          return res.status(400).json({ error: "Transaction Wizall non initiée" });
        }

        // Call Wizall confirm helper
        const confirmResult = await confirmWizallPayment(authorizationCode!, customerPhone, metadata.wizallTransactionId);

        if (confirmResult.success) {
          res.json({
            success: true,
            message: confirmResult.message,
            transactionId: transaction.id,
          });
        } else {
          res.status(400).json({
            error: confirmResult.message,
          });
        }
      } else {
        // STANDARD FLOW
        // Note: Use generic email for privacy - never send real customer emails to providers
        const paymentData: SoftpayPaymentData = {
          customerName: customerName || transaction.customerName || "Client",
          customerEmail: "noreply@bkapay.com", // Privacy: never send real customer emails to providers
          phoneNumber: customerPhone,
          invoiceToken: token,
          authorizationCode,
        };

        const softpayResult = await callPaydunyaSoftpay(operator, country, paymentData);

        if (softpayResult.success) {
          // CRITICAL: For two-step flows, transactionId MUST be present
          if (isTwoStep && !softpayResult.transactionId) {
            return res.status(502).json({
              error: "Erreur serveur: TransactionID manquant pour paiement two-step",
            });
          }

          // For Wizall first step, store TransactionID
          if (softpayResult.transactionId && isTwoStep) {
            const updatedMetadata = {
              ...metadata,
              wizallTransactionId: softpayResult.transactionId,
            };
            await storage.updateTransactionStatus(transaction.id, "pending", {
              metadata: JSON.stringify(updatedMetadata),
            });

            res.json({
              success: true,
              message: "Code OTP envoyé par SMS",
              transactionId: transaction.id,
              requiresOTP: true,
              wizallTransactionId: softpayResult.transactionId,
            });
          } else {
            res.json({
              success: true,
              message: softpayResult.message,
              transactionId: transaction.id,
              fees: softpayResult.fees,
              currency: softpayResult.currency,
              redirectUrl: softpayResult.url,
              omUrl: softpayResult.omUrl,
              maxitUrl: softpayResult.maxitUrl,
            });
          }
        } else {
          res.status(400).json({
            error: softpayResult.message || "Erreur lors du paiement",
          });
        }
      }
    } catch (error: any) {
      console.error("[PAYMENT_LINK SOFTPAY CONFIRM] Error:", error);
      res.status(500).json({ error: "Erreur lors de la confirmation du paiement" });
    }
  });

  // Payment Links - Initialize payment - DISABLED
  app.post("/api/payment-links/softpay-init/:token", async (req: Request, res: Response) => {
    return res.status(503).json({
      success: false,
      error: "Le système de paiement est temporairement indisponible. Veuillez réessayer ultérieurement."
    });
  });

  // SOFTPAY for Payment Links - Confirm payment
  app.post("/api/payment-links/softpay-confirm", async (req: Request, res: Response) => {
    try {
      const { transactionId, token, authorizationCode, country, operator, customerPhone, customerName, customerEmail } = req.body;

      if (!transactionId || !token || !country || !operator || !customerPhone) {
        return res.status(400).json({ error: "Informations de paiement incomplètes" });
      }

      // Get transaction by ID
      const transaction = await storage.getTransaction(transactionId);
      if (!transaction) {
        return res.status(404).json({ error: "Transaction non trouvée" });
      }

      // Parse metadata for Wizall transactionId
      let metadata: any = {};
      if (transaction.metadata) {
        metadata = JSON.parse(transaction.metadata);
      }

      // Check if this is Wizall two-step flow
      const operatorKey = getOperatorKey(operator, country);
      const isTwoStep = operatorKey ? requiresTwoStep(operatorKey) : false;

      if (isTwoStep && operator.toLowerCase() === "wizall" && country.toUpperCase() === "SN") {
        // WIZALL TWO-STEP: Call /wizall-money-senegal/confirm endpoint
        if (!metadata.wizallTransactionId) {
          return res.status(400).json({ error: "Transaction Wizall non initiée" });
        }

        // Call Wizall confirm helper
        const confirmResult = await confirmWizallPayment(authorizationCode!, customerPhone, metadata.wizallTransactionId);

        if (confirmResult.success) {
          res.json({
            success: true,
            message: confirmResult.message,
            transactionId: transaction.id,
          });
        } else {
          res.status(400).json({
            error: confirmResult.message,
          });
        }
      } else {
        // STANDARD FLOW
        // Note: Use generic email for privacy - never send real customer emails to providers
        const paymentData: SoftpayPaymentData = {
          customerName: customerName || transaction.customerName || "Client",
          customerEmail: "noreply@bkapay.com", // Privacy: never send real customer emails to providers
          phoneNumber: customerPhone,
          invoiceToken: token,
          authorizationCode,
        };

        const softpayResult = await callPaydunyaSoftpay(operator, country, paymentData);

        if (softpayResult.success) {
          // CRITICAL: For two-step flows, transactionId MUST be present
          if (isTwoStep && !softpayResult.transactionId) {
            return res.status(502).json({
              error: "Erreur serveur: TransactionID manquant pour paiement two-step",
            });
          }

          // For Wizall first step, store TransactionID
          if (softpayResult.transactionId && isTwoStep) {
            const updatedMetadata = {
              ...metadata,
              wizallTransactionId: softpayResult.transactionId,
            };
            await storage.updateTransactionStatus(transaction.id, "pending", {
              metadata: JSON.stringify(updatedMetadata),
            });

            res.json({
              success: true,
              message: "Code OTP envoyé par SMS",
              transactionId: transaction.id,
              requiresOTP: true,
              wizallTransactionId: softpayResult.transactionId,
            });
          } else {
            res.json({
              success: true,
              message: softpayResult.message,
              transactionId: transaction.id,
              fees: softpayResult.fees,
              currency: softpayResult.currency,
              redirectUrl: softpayResult.url,
              omUrl: softpayResult.omUrl,
              maxitUrl: softpayResult.maxitUrl,
            });
          }
        } else {
          res.status(400).json({
            error: softpayResult.message || "Erreur lors du paiement",
          });
        }
      }
    } catch (error: any) {
      console.error("[PAYMENT_LINK SOFTPAY CONFIRM] Error:", error);
      res.status(500).json({ error: "Erreur lors de la confirmation du paiement" });
    }
  });

  // Merchant Links - Initialize payment - DISABLED
  app.post("/api/merchant-links/softpay-init/:token", async (req: Request, res: Response) => {
    return res.status(503).json({
      success: false,
      error: "Le système de paiement est temporairement indisponible. Veuillez réessayer ultérieurement."
    });
  });

  // SOFTPAY for Merchant Links - Confirm payment
  app.post("/api/merchant-links/softpay-confirm", async (req: Request, res: Response) => {
    try {
      const { transactionId, token, authorizationCode, country, operator, customerPhone, customerName, customerEmail } = req.body;

      if (!transactionId || !token || !country || !operator || !customerPhone) {
        return res.status(400).json({ error: "Informations de paiement incomplètes" });
      }

      // Get transaction by ID
      const transaction = await storage.getTransaction(transactionId);
      if (!transaction) {
        return res.status(404).json({ error: "Transaction non trouvée" });
      }

      // Parse metadata for Wizall transactionId
      let metadata: any = {};
      if (transaction.metadata) {
        metadata = JSON.parse(transaction.metadata);
      }

      // Check if this is Wizall two-step flow
      const operatorKey = getOperatorKey(operator, country);
      const isTwoStep = operatorKey ? requiresTwoStep(operatorKey) : false;

      if (isTwoStep && operator.toLowerCase() === "wizall" && country.toUpperCase() === "SN") {
        // WIZALL TWO-STEP: Call /wizall-money-senegal/confirm endpoint
        if (!metadata.wizallTransactionId) {
          return res.status(400).json({ error: "Transaction Wizall non initiée" });
        }

        // Call Wizall confirm helper
        const confirmResult = await confirmWizallPayment(authorizationCode!, customerPhone, metadata.wizallTransactionId);

        if (confirmResult.success) {
          res.json({
            success: true,
            message: confirmResult.message,
            transactionId: transaction.id,
          });
        } else {
          res.status(400).json({
            error: confirmResult.message,
          });
        }
      } else {
        // STANDARD FLOW
        // Note: Use generic email for privacy - never send real customer emails to providers
        const paymentData: SoftpayPaymentData = {
          customerName: customerName || transaction.customerName || "Client",
          customerEmail: "noreply@bkapay.com", // Privacy: never send real customer emails to providers
          phoneNumber: customerPhone,
          invoiceToken: token,
          authorizationCode,
        };

        const softpayResult = await callPaydunyaSoftpay(operator, country, paymentData);

        if (softpayResult.success) {
          // CRITICAL: For two-step flows, transactionId MUST be present
          if (isTwoStep && !softpayResult.transactionId) {
            return res.status(502).json({
              error: "Erreur serveur: TransactionID manquant pour paiement two-step",
            });
          }

          // For Wizall first step, store TransactionID
          if (softpayResult.transactionId && isTwoStep) {
            const updatedMetadata = {
              ...metadata,
              wizallTransactionId: softpayResult.transactionId,
            };
            await storage.updateTransactionStatus(transaction.id, "pending", {
              metadata: JSON.stringify(updatedMetadata),
            });

            res.json({
              success: true,
              message: "Code OTP envoyé par SMS",
              transactionId: transaction.id,
              requiresOTP: true,
              wizallTransactionId: softpayResult.transactionId,
            });
          } else {
            res.json({
              success: true,
              message: softpayResult.message,
              transactionId: transaction.id,
              fees: softpayResult.fees,
              currency: softpayResult.currency,
              redirectUrl: softpayResult.url,
              omUrl: softpayResult.omUrl,
              maxitUrl: softpayResult.maxitUrl,
            });
          }
        } else {
          res.status(400).json({
            error: softpayResult.message || "Erreur lors du paiement",
          });
        }
      }
    } catch (error: any) {
      console.error("[MERCHANT_LINK SOFTPAY CONFIRM] Error:", error);
      res.status(500).json({ error: "Erreur lors de la confirmation du paiement" });
    }
  });

  // Verify Payment - Polling endpoint (supports both FedaPay and Paydunya)
  // CRITICAL SECURITY: Only mark transactions complete after STRICT validation
  app.post("/api/softpay/verify-payment", async (req: Request, res: Response) => {
    try {
      const { invoiceToken, transactionId } = req.body;
      
      console.log("[VERIFY] Request received:", { invoiceToken, transactionId });

      // Check by transactionId first (FedaPay or DB status check)
      const txId = transactionId || invoiceToken; // Both might contain the BKApay transaction ID
      if (txId) {
        const transaction = await storage.getTransaction(txId);
        console.log("[VERIFY] Transaction lookup:", { txId, found: !!transaction, status: transaction?.status });
        
        if (transaction) {
          let metadata: any = {};
          try {
            metadata = JSON.parse(transaction.metadata || "{}");
          } catch (e) {}
          
          console.log("[VERIFY] Transaction metadata:", { fedapayTransactionId: metadata.fedapayTransactionId });

          // If it's a FedaPay transaction, verify via FedaPay API
          if (metadata.fedapayTransactionId) {
            console.log("[VERIFY] Checking FedaPay transaction:", txId, "fedapayId:", metadata.fedapayTransactionId);
            
            const fedapayStatus = await getTransactionStatus(metadata.fedapayTransactionId);
            console.log("[VERIFY] FedaPay status:", fedapayStatus.status);

            if (fedapayStatus.status === "approved" || fedapayStatus.status === "transferred") {
              if (transaction.status === "pending") {
                const result = await storage.finalizeIncomingTransaction(transaction.id, {});
                console.log("[VERIFY] FedaPay transaction finalized:", result ? "success" : "already processed");
                if (result && transaction.type === "payment_link" && transaction.customerEmail) {
                  try {
                    const txMeta = JSON.parse(transaction.metadata as string || "{}");
                    if (txMeta.paymentLinkId) {
                      const pl = await storage.getPaymentLinkById(txMeta.paymentLinkId);
                      if (pl?.documentUrls?.length && pl.documentNames?.length) {
                        sendPaymentDocumentsEmail(transaction.customerEmail, transaction.customerName || "Client", pl.productName, pl.documentNames, pl.documentUrls).catch(() => {});
                      }
                    }
                  } catch {}
                }
              }
              return res.json({ status: "completed", response_code: "00" });
            } else if (fedapayStatus.status === "declined" || fedapayStatus.status === "canceled" || fedapayStatus.status === "refunded") {
              if (transaction.status === "pending") {
                await storage.updateTransactionStatus(transaction.id, "failed");
              }
              return res.json({ status: "failed", response_code: "05" });
            } else {
              // Check transaction status in DB (might have been updated by polling)
              if (transaction.status === "completed") {
                return res.json({ status: "completed", response_code: "00" });
              } else if (transaction.status === "failed") {
                return res.json({ status: "failed", response_code: "05" });
              }
              return res.json({ status: "pending", response_code: "01" });
            }
          }
          
          // Check DB status for non-FedaPay transactions (pending in DB)
          if (transaction.status === "completed") {
            return res.json({ status: "completed", response_code: "00" });
          } else if (transaction.status === "failed") {
            return res.json({ status: "failed", response_code: "05" });
          }
          
          // Transaction exists but is still pending and has no FedaPay ID
          // Return pending (no need to check Paydunya with a BKApay UUID)
          console.log("[VERIFY] Transaction pending, no FedaPay ID, returning pending");
          return res.json({ status: "pending", response_code: "01" });
        }
      }

      // Fallback to Paydunya verification only for actual Paydunya tokens
      // Paydunya tokens are NOT UUIDs, they are different format
      if (!invoiceToken || invoiceToken.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        console.log("[VERIFY] No valid Paydunya token, returning pending");
        return res.json({ status: "pending", response_code: "01" });
      }

      console.log("[SOFTPAY VERIFY] Checking payment status for Paydunya token:", invoiceToken);

      // Call Paydunya checkout-invoice/confirm API (GET request)
      const paydunyaResponse = await callPaydunyaAPIGet("/checkout-invoice/confirm/" + invoiceToken);

      console.log("[SOFTPAY VERIFY] Paydunya response:", JSON.stringify(paydunyaResponse));

      const hasValidInvoice = paydunyaResponse.invoice && typeof paydunyaResponse.invoice === 'object';
      const paymentStatus = paydunyaResponse.status || paydunyaResponse.invoice?.status;
      const responseText = paydunyaResponse.response_text || '';
      
      console.log("[SOFTPAY VERIFY] Validation:", {
        hasValidInvoice,
        rootStatus: paydunyaResponse.status,
        invoiceStatus: paydunyaResponse.invoice?.status,
        paymentStatus,
        responseCode: paydunyaResponse.response_code,
        responseText: responseText.substring(0, 100),
      });
      
      if (paydunyaResponse.response_code === "00" && hasValidInvoice && paymentStatus === "completed") {
        const transaction = await storage.getTransactionByPaydunyaToken(invoiceToken);
        
        if (transaction) {
          console.log("[SOFTPAY VERIFY] CONFIRMED by Paydunya - finalizing transaction:", {
            transactionId: transaction.id,
            paydunyaStatus: paymentStatus,
            paydunyaAmount: paydunyaResponse.invoice?.total_amount,
          });
          
          const result = await storage.finalizeIncomingTransaction(transaction.id, {
            paydunyaReceiptUrl: paydunyaResponse.invoice?.receipt_url || `https://paydunya.com/receipt/${invoiceToken}`,
          });
          
          if (result) {
            console.log("[SOFTPAY VERIFY] Transaction finalized successfully:", {
              transactionId: transaction.id,
              credited: result.credited,
            });
            if (transaction.type === "payment_link" && transaction.customerEmail) {
              try {
                const txMeta = JSON.parse(transaction.metadata as string || "{}");
                if (txMeta.paymentLinkId) {
                  const pl = await storage.getPaymentLinkById(txMeta.paymentLinkId);
                  if (pl?.documentUrls?.length && pl.documentNames?.length) {
                    sendPaymentDocumentsEmail(transaction.customerEmail, transaction.customerName || "Client", pl.productName, pl.documentNames, pl.documentUrls).catch(() => {});
                  }
                }
              } catch {}
            }
          } else {
            console.log("[SOFTPAY VERIFY] Transaction already processed:", transaction.id);
          }
        }
        
        res.json({
          status: "completed",
          response_code: "00",
        });
      } else if (paymentStatus === "canceled" || paymentStatus === "cancelled" || 
                 paymentStatus === "fail" || paymentStatus === "failed") {
        const transaction = await storage.getTransactionByPaydunyaToken(invoiceToken);
        if (transaction && transaction.status === "pending") {
          await storage.updateTransactionStatus(transaction.id, "failed");
          console.log("[SOFTPAY VERIFY] Transaction marked as failed:", {
            transactionId: transaction.id,
            paydunyaStatus: paymentStatus,
          });
        }
        
        res.json({
          status: "failed",
          response_code: "05",
        });
      } else {
        console.log("[SOFTPAY VERIFY] Payment still pending or awaiting confirmation:", {
          paymentStatus,
          hasValidInvoice,
          responseCode: paydunyaResponse.response_code,
        });
        
        res.json({
          status: "pending",
          response_code: "01",
        });
      }
    } catch (error: any) {
      console.error("[SOFTPAY VERIFY] Error:", error);
      res.json({
        status: "pending",
        response_code: "01",
      });
    }
  });

  // ===== Paydunya Webhook Routes =====
  // SECURITY: Helper function to verify payment status directly with Paydunya API
  async function verifyPaydunyaPaymentStatus(token: string): Promise<{ verified: boolean; status?: string; receiptUrl?: string; amount?: number }> {
    try {
      const config = await getPaydunyaConfig();
      if (!config) {
        console.error("[SECURITY] Paydunya config not found for verification");
        return { verified: false };
      }
      
      const response = await fetch(`https://app.paydunya.com/api/v1/checkout-invoice/confirm/${token}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "PAYDUNYA-MASTER-KEY": config.masterKey,
          "PAYDUNYA-PRIVATE-KEY": config.privateKey,
          "PAYDUNYA-TOKEN": config.token,
        },
      });

      if (!response.ok) {
        console.error(`[SECURITY] Paydunya API returned status ${response.status} for token ${token}`);
        return { verified: false };
      }

      const data = await response.json();
      const invoiceStatus = data.status || data.invoice?.status;
      const isCompleted = data.response_code === "00" && invoiceStatus === "completed";
      
      console.log(`[SECURITY] Paydunya API verification for token ${token}:`, {
        responseCode: data.response_code,
        status: invoiceStatus,
        verified: isCompleted
      });
      
      return {
        verified: isCompleted,
        status: invoiceStatus,
        receiptUrl: data.invoice?.receipt_url,
        amount: data.invoice?.total_amount
      };
    } catch (error) {
      console.error(`[SECURITY] Error verifying Paydunya payment:`, error);
      return { verified: false };
    }
  }

  app.post("/api/webhooks/paydunya", async (req: Request, res: Response) => {
    try {
      const { token, status, custom_data, data } = req.body;
      const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

      console.log("[WEBHOOK] Paydunya webhook received:", { token: token || data?.token, status: status || data?.status, ip: clientIP });

      // Handle PSR format (data.status) or direct format (status)
      const webhookToken = token || data?.token;
      const webhookStatus = status || data?.status;
      const webhookCustomData = custom_data || data?.custom_data;
      const webhookAmount = data?.amount;
      const receiptUrl = data?.receipt_url;

      if (!webhookToken) {
        console.warn(`[SECURITY] Webhook without token from IP: ${clientIP}`);
        return res.status(400).json({ error: "Token manquant" });
      }

      // Normalize user_id from various custom_data formats
      const userId = webhookCustomData?.user_id || webhookCustomData?.merchant_user_id;

      // Search for transaction by token - use efficient global lookup
      let transaction = await storage.getTransactionByPaydunyaToken(webhookToken);
      
      if (transaction) {
        console.log("[WEBHOOK] Transaction found:", { 
          id: transaction.id, 
          type: transaction.type,
          userId: transaction.userId 
        });
      }

      // Transaction should always exist now (created as pending before Paydunya call)
      if (!transaction) {
        console.warn(`[SECURITY] Webhook for unknown token from IP ${clientIP}: ${webhookToken}`);
        return res.status(200).json({ success: true, message: "Transaction not found, but webhook acknowledged" });
      }

      // SECURITY: ALWAYS verify with Paydunya API before crediting - NEVER trust webhook status alone
      if (webhookStatus === "completed" || webhookStatus === "approved") {
        console.log(`[SECURITY] Verifying payment with Paydunya API for transaction ${transaction.id}...`);
        
        const verification = await verifyPaydunyaPaymentStatus(webhookToken);
        
        if (!verification.verified) {
          console.error(`[SECURITY] ⚠️ PAYMENT VERIFICATION FAILED for transaction ${transaction.id}`);
          console.error(`[SECURITY] Webhook claimed status: ${webhookStatus}, but API verification failed`);
          console.error(`[SECURITY] API returned status: ${verification.status}, IP: ${clientIP}`);
          // Do NOT credit - let polling handle it if payment is real
          return res.json({ success: true, message: "Webhook received, verification pending" });
        }
        
        console.log(`[SECURITY] ✅ Payment VERIFIED by Paydunya API for transaction ${transaction.id}`);
        
        const result = await storage.finalizeIncomingTransaction(transaction.id, {
          paydunyaReceiptUrl: verification.receiptUrl || receiptUrl || `https://paydunya.com/receipt/${webhookToken}`,
        });
        
        if (result) {
          console.log("[WEBHOOK] Transaction finalized:", { 
            transactionId: transaction.id, 
            credited: result.credited,
            netAmount: result.transaction.amount - (result.transaction.fee || 0)
          });
          
          trySendPaymentCallback(result.transaction, 'payment.completed', '[WEBHOOK/Paydunya]');
          setImmediate(() => sendBusinessWebhookCallback(transaction.id, "completed", "payin"));
          
          if (transaction.type === "payment_link" && transaction.customerEmail) {
            try {
              const meta = JSON.parse(transaction.metadata || "{}");
              if (meta.paymentLinkId) {
                const pl = await storage.getPaymentLinkById(meta.paymentLinkId);
                if (pl?.documentUrls?.length && pl.documentNames?.length) {
                  sendPaymentDocumentsEmail(transaction.customerEmail, transaction.customerName || "Client", pl.productName, pl.documentNames, pl.documentUrls).catch(() => {});
                }
              }
            } catch {}
          }
        } else {
          console.log("[WEBHOOK] Transaction already processed (not pending):", { transactionId: transaction.id });
        }
      } else if (webhookStatus === "failed" || webhookStatus === "cancelled") {
        await storage.updateTransactionStatus(transaction.id, "failed");
        console.log("[WEBHOOK] Transaction marked as failed:", { transactionId: transaction.id });
        
        const failedTx = await storage.getTransaction(transaction.id);
        if (failedTx) {
          trySendPaymentCallback(failedTx, 'payment.failed', '[WEBHOOK/Paydunya]');
        }
        setImmediate(() => sendBusinessWebhookCallback(transaction.id, "failed", "payin"));
      }

      res.json({ success: true, message: "Webhook traité" });
    } catch (error: any) {
      console.error("[WEBHOOK] Paydunya webhook error:", error);
      // Return 200 to Paydunya so it doesn't retry
      res.status(200).json({ success: true, message: "Webhook received, but processing error" });
    }
  });

  // ===== Webhook Route - DISABLED =====
  app.post("/api/webhooks/fedapay", (req: Request, res: Response) => {
    return res.status(503).json({
      success: false,
      error: "Service temporairement indisponible"
    });
  });

  // ===== MbiyoPay Webhook =====
  app.post("/api/webhooks/mbiyopay", handleMbiyoPayWebhook);
  
  // Admin endpoint to resend MbiyoPay webhook for stuck transactions
  app.post("/api/admin/mbiyopay/resend-webhook", handleMbiyoPayResendWebhook);

  // MbiyoPay Finalize: complete a PIN-based payment (QMoney, APS in Gambia)
  app.post("/api/mbiyopay/finalize/:mbiyopayTransactionId", async (req: Request, res: Response) => {
    if (!req.session.userId) return res.status(401).json({ error: "Non autorise" });
    const { mbiyopayTransactionId } = req.params;
    const { otp, transactionId } = req.body;
    if (!otp || !mbiyopayTransactionId) {
      return res.status(400).json({ success: false, error: "Code OTP et identifiant de transaction requis" });
    }
    try {
      const { finalizeMbiyoPayPayin } = await import("./mbiyopay");
      const result = await finalizeMbiyoPayPayin(mbiyopayTransactionId, otp);
      if (result.success) {
        return res.json({ success: true, message: result.message || "Code soumis. En attente de confirmation." });
      }
      return res.status(400).json({ success: false, error: result.error });
    } catch (err: any) {
      console.error("[MbiyoPay Finalize Route] Error:", err);
      return res.status(500).json({ success: false, error: "Erreur lors de la finalisation du paiement" });
    }
  });

  // Endpoint public (sans auth) pour finaliser un paiement MbiyoPay PIN depuis les pages publiques (pay, merchant, api-pay)
  app.post("/api/mbiyopay/finalize-public/:mbiyopayTransactionId", async (req: Request, res: Response) => {
    const { mbiyopayTransactionId } = req.params;
    const { pinCode } = req.body;
    if (!pinCode || !mbiyopayTransactionId) {
      return res.status(400).json({ success: false, error: "Code PIN et identifiant de transaction requis" });
    }
    try {
      const { finalizeMbiyoPayPayin } = await import("./mbiyopay");
      const result = await finalizeMbiyoPayPayin(mbiyopayTransactionId, pinCode);
      if (result.success) {
        return res.json({ success: true, message: result.message || "Code PIN soumis. En attente de confirmation." });
      }
      return res.status(400).json({ success: false, error: result.error });
    } catch (err: any) {
      console.error("[MbiyoPay Finalize Public] Error:", err);
      return res.status(500).json({ success: false, error: "Erreur lors de la finalisation du paiement" });
    }
  });

  // ===== PawaPay Webhook =====
  app.post("/api/webhooks/pawapay", handlePawaPayWebhook);

  // ===== FeeXPay Webhook =====
  app.post("/api/webhooks/feexpay", async (req: Request, res: Response) => {
    try {
      console.log("[FeeXPay Webhook] Received:", JSON.stringify(req.body).slice(0, 500));

      const payload = req.body;
      const reference = payload?.reference || payload?.id || payload?.transactionId;
      const status = payload?.status;

      if (!reference || !status) {
        console.warn("[FeeXPay Webhook] Missing reference or status:", payload);
        return res.status(200).json({ received: true });
      }

      const mappedStatus = mapFeeXPayStatus(status);

      const tx = await storage.getTransactionByFeeXPayReference(reference);
      if (!tx) {
        console.warn("[FeeXPay Webhook] No transaction found for reference:", reference);
        return res.status(200).json({ received: true });
      }

      if (tx.status === "completed" || tx.status === "failed") {
        console.log(`[FeeXPay Webhook] Transaction ${tx.id} already in final state (${tx.status}) - ignoring duplicate`);
        return res.status(200).json({ received: true });
      }

      if (mappedStatus === "completed") {
        const isIncoming = tx.type === "deposit" || tx.type === "payment_link" || tx.type === "merchant_link" || tx.type === "api_payment";
        if (isIncoming) {
          const result = await storage.finalizeIncomingTransaction(tx.id, {});
          if (result) {
            console.log(`[FeeXPay Webhook] ✅ Deposit ${tx.id} finalized - credited=${result.credited}`);
            const updatedTx = await storage.getTransaction(tx.id);
            if (updatedTx) {
              trySendPaymentCallback(updatedTx, 'payment.completed', '[FeeXPay Webhook]');
            }
            setImmediate(() => sendBusinessWebhookCallback(tx.id, "completed", "payin"));
          } else {
            console.log(`[FeeXPay Webhook] Transaction ${tx.id} already finalized (race condition) - skipping`);
          }
        } else {
          await storage.updateTransactionStatus(tx.id, "completed");
          console.log(`[FeeXPay Webhook] ✅ ${tx.type} ${tx.id} COMPLETED`);
          const outMeta = tx.metadata ? JSON.parse(tx.metadata) : {};
          setImmediate(() => sendApiPayoutCallback(tx.id, outMeta, "completed"));
          setImmediate(() => sendBusinessWebhookCallback(tx.id, "completed", "payout"));
        }
      } else if (mappedStatus === "failed") {
        const isOutgoing = tx.type === "withdrawal" || tx.type === "transfer";
        if (isOutgoing) {
          const meta = tx.metadata ? JSON.parse(tx.metadata) : {};
          const { safeRefundOutgoingTransaction } = await import("./payment-polling");
          const refunded = await safeRefundOutgoingTransaction(tx.id, tx.userId, meta, "webhook-feexpay-failed");
          console.log(`[FeeXPay Webhook] ❌ ${tx.type} ${tx.id} FAILED - refund ${refunded ? 'processed' : 'skipped (already handled)'}`);
          setImmediate(() => sendApiPayoutCallback(tx.id, meta, "failed"));
          setImmediate(() => sendBusinessWebhookCallback(tx.id, "failed", "payout"));
        } else {
          await storage.updateTransactionStatus(tx.id, "failed");
          console.log(`[FeeXPay Webhook] ❌ Deposit ${tx.id} FAILED`);
          const failedTx = await storage.getTransaction(tx.id);
          if (failedTx) trySendPaymentCallback(failedTx, 'payment.failed', '[FeeXPay Webhook]');
          setImmediate(() => sendBusinessWebhookCallback(tx.id, "failed", "payin"));
        }
      } else {
        console.log(`[FeeXPay Webhook] Transaction ${tx.id} status: ${status} -> mapped: ${mappedStatus} (still pending)`);
      }

      return res.status(200).json({ received: true });
    } catch (error) {
      console.error("[FeeXPay Webhook] Error:", error);
      return res.status(200).json({ received: true });
    }
  });

  // Admin diagnostic endpoint to check MbiyoPay merchant account status
  app.get("/api/admin/mbiyopay/diagnostic", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Non authentifie" });
    const user = await storage.getUser(req.session.userId);
    if (!user?.isAdmin) return res.status(403).json({ error: "Non autorise" });

    const { checkMbiyoPayMerchantStatus } = await import("./mbiyopay");
    const result = await checkMbiyoPayMerchantStatus();
    res.json(result);
  });

  // ===== MoneyFusion Payout Webhook =====
  app.post("/api/webhooks/moneyfusion/payout", async (req: Request, res: Response) => {
    try {
      console.log("[MoneyFusion Webhook] Received:", JSON.stringify(req.body));

      const mfConfig = await storage.getProviderConfig("moneyfusion");
      if (mfConfig?.ipnSecret) {
        const webhookSignature = req.headers["x-moneyfusion-signature"] || req.headers["moneyfusion-signature"];
        if (webhookSignature && webhookSignature !== mfConfig.ipnSecret) {
          console.error("[MoneyFusion Webhook] Signature mismatch - rejecting");
          return res.status(403).json({ error: "Invalid signature" });
        }
      }

      const payload = validateMoneyFusionWebhook(req.body);
      if (!payload) {
        console.error("[MoneyFusion Webhook] Invalid payload");
        return res.status(400).json({ error: "Invalid webhook payload" });
      }

      const { event, tokenPay, montant, createdAt } = payload;
      console.log(`[MoneyFusion Webhook] Event: ${event}, tokenPay: ${tokenPay}, montant: ${montant}`);

      const allPending = await storage.getAllPendingTransactions();
      let matchedTx = null;

      for (const tx of allPending) {
        if (!tx.metadata) continue;
        try {
          const meta = JSON.parse(tx.metadata);
          if (meta.paymentProvider === "moneyfusion" && meta.moneyFusionTokenPay === tokenPay) {
            matchedTx = tx;
            break;
          }
        } catch (e) {}
      }

      if (!matchedTx) {
        console.log(`[MoneyFusion Webhook] No matching transaction for tokenPay: ${tokenPay}`);
        return res.json({ received: true, matched: false });
      }

      console.log(`[MoneyFusion Webhook] Matched transaction: ${matchedTx.id}, type: ${matchedTx.type}`);

      let meta: any = {};
      try { meta = JSON.parse(matchedTx.metadata || "{}"); } catch (e) {}

      if (isMoneyFusionPayoutCompleted(event)) {
        const providerAmount = meta.providerAmount || 0;
        if (montant && providerAmount && montant !== providerAmount) {
          console.error(`[MoneyFusion Webhook] AMOUNT MISMATCH: webhook=${montant}, expected=${providerAmount} for tx ${matchedTx.id} - REJECTING`);
          return res.status(400).json({ received: true, matched: true, error: "amount_mismatch" });
        }

        if (createdAt) {
          const webhookTime = new Date(createdAt).getTime();
          const txStartTime = meta.startTime || new Date(matchedTx.createdAt).getTime();
          if (webhookTime < txStartTime - 60000) {
            console.error(`[MoneyFusion Webhook] TIME MISMATCH: webhook createdAt=${createdAt} is before transaction start for tx ${matchedTx.id}`);
            return res.json({ received: true, matched: true, warning: "time_mismatch" });
          }
        }

        await storage.updateTransactionStatus(matchedTx.id, "completed");
        console.log(`[MoneyFusion Webhook] Transaction ${matchedTx.id} marked as COMPLETED`);
        setImmediate(() => sendApiPayoutCallback(matchedTx.id, meta, "completed"));
        setImmediate(() => sendBusinessWebhookCallback(matchedTx.id, "completed", "payout"));
      } else if (isMoneyFusionPayoutFailed(event)) {
        await safeRefundOutgoingTransaction(matchedTx.id, matchedTx.userId, meta, "webhook-moneyfusion-failed");
        await storage.updateTransactionStatus(matchedTx.id, "failed");
        console.log(`[MoneyFusion Webhook] Transaction ${matchedTx.id} marked as FAILED`);
        setImmediate(() => sendApiPayoutCallback(matchedTx.id, meta, "failed"));
        setImmediate(() => sendBusinessWebhookCallback(matchedTx.id, "failed", "payout"));
      }

      return res.json({ received: true, matched: true, processed: true });
    } catch (error) {
      console.error("[MoneyFusion Webhook] Error:", error);
      return res.status(500).json({ error: "Webhook processing error" });
    }
  });

  // ===== Currency Conversion Route =====
  app.post("/api/convert-currency", async (req: Request, res: Response) => {
    try {
      const { amount, fromCurrency, toCurrency } = req.body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Montant invalide" });
      }
      
      const from = fromCurrency || "XOF";
      const to = toCurrency || "GNF";
      
      const result = await convertCurrency(amount, from, to);
      
      if (result.success) {
        res.json({
          success: true,
          originalAmount: result.originalAmount,
          originalCurrency: result.originalCurrency,
          convertedAmount: result.convertedAmount,
          targetCurrency: result.targetCurrency,
          conversionRate: result.conversionRate,
        });
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (error: any) {
      console.error("[Currency Conversion] Error:", error);
      res.status(500).json({ error: "Erreur lors de la conversion" });
    }
  });

  app.get("/api/currency-for-country/:countryCode", (req: Request, res: Response) => {
    const { countryCode } = req.params;
    const currency = getCurrencyForCountry(countryCode);
    const needsConversion = needsCurrencyConversion(countryCode);
    res.json({ currency, needsConversion });
  });

  // ===== Payment Routes - Multi-Provider System =====
  // Helper function to determine active provider for a country/operator
  async function getActiveProviderForDeposit(country: string, operator: string): Promise<string | null> {
    const [configs, countryStatuses, providerConfigs] = await Promise.all([
      storage.getCountryOperatorConfigs(),
      storage.getCountryStatuses(),
      storage.getProviderConfigs(),
    ]);
    
    // First check which providers are globally active
    const activeProviders = new Set(
      providerConfigs.filter(p => p.isActive).map(p => p.provider)
    );
    
    // Find operators that are enabled for incoming for this country
    const enabledConfigs = configs.filter(c => 
      c.country.toUpperCase() === country.toUpperCase() &&
      c.operator.toLowerCase() === operator.toLowerCase() &&
      c.incomingEnabled &&
      activeProviders.has(c.provider)
    );
    
    // Also check country-level status
    const enabledCountries = countryStatuses.filter(cs =>
      cs.country.toUpperCase() === country.toUpperCase() &&
      cs.payinEnabled &&
      activeProviders.has(cs.provider)
    );
    
    // Find provider that has both operator-level and country-level enabled
    for (const config of enabledConfigs) {
      const hasCountryLevel = enabledCountries.some(c => c.provider === config.provider);
      if (hasCountryLevel) {
        return config.provider;
      }
    }
    
    // If only operator-level is configured, use that
    if (enabledConfigs.length > 0) {
      return enabledConfigs[0].provider;
    }
    
    return null;
  }

  async function getActiveProviderForWithdrawal(country: string, operator: string): Promise<string | null> {
    const [configs, countryStatuses, providerConfigs] = await Promise.all([
      storage.getCountryOperatorConfigs(),
      storage.getCountryStatuses(),
      storage.getProviderConfigs(),
    ]);
    
    const activeProviders = new Set(
      providerConfigs.filter(p => p.isActive).map(p => p.provider)
    );
    
    const enabledConfigs = configs.filter(c => 
      c.country.toUpperCase() === country.toUpperCase() &&
      c.operator.toLowerCase() === operator.toLowerCase() &&
      c.outgoingEnabled &&
      activeProviders.has(c.provider)
    );
    
    const enabledCountries = countryStatuses.filter(cs =>
      cs.country.toUpperCase() === country.toUpperCase() &&
      cs.payoutEnabled &&
      activeProviders.has(cs.provider)
    );
    
    for (const config of enabledConfigs) {
      const hasCountryLevel = enabledCountries.some(c => c.provider === config.provider);
      if (hasCountryLevel) {
        return config.provider;
      }
    }
    
    if (enabledConfigs.length > 0) {
      return enabledConfigs[0].provider;
    }
    
    return null;
  }
  
  async function getBusinessActiveProviderForDeposit(country: string, operator: string): Promise<string | null> {
    const [configs, countryStatuses, providerConfigs] = await Promise.all([
      storage.getCountryOperatorConfigs("business"),
      storage.getCountryStatuses("business"),
      storage.getProviderConfigs("business"),
    ]);
    const activeProviders = new Set(providerConfigs.filter(p => p.isActive).map(p => p.provider));
    const enabledConfigs = configs.filter(c =>
      c.country.toUpperCase() === country.toUpperCase() &&
      c.operator.toLowerCase() === operator.toLowerCase() &&
      c.incomingEnabled &&
      activeProviders.has(c.provider)
    );
    const enabledCountries = countryStatuses.filter(cs =>
      cs.country.toUpperCase() === country.toUpperCase() &&
      cs.payinEnabled &&
      activeProviders.has(cs.provider)
    );
    for (const config of enabledConfigs) {
      if (enabledCountries.some(c => c.provider === config.provider)) return config.provider;
    }
    if (enabledConfigs.length > 0) return enabledConfigs[0].provider;
    return null;
  }

  async function getBusinessActiveProviderForWithdrawal(country: string, operator: string): Promise<string | null> {
    const [configs, countryStatuses, providerConfigs] = await Promise.all([
      storage.getCountryOperatorConfigs("business"),
      storage.getCountryStatuses("business"),
      storage.getProviderConfigs("business"),
    ]);
    const activeProviders = new Set(providerConfigs.filter(p => p.isActive).map(p => p.provider));
    const enabledConfigs = configs.filter(c =>
      c.country.toUpperCase() === country.toUpperCase() &&
      c.operator.toLowerCase() === operator.toLowerCase() &&
      c.outgoingEnabled &&
      activeProviders.has(c.provider)
    );
    const enabledCountries = countryStatuses.filter(cs =>
      cs.country.toUpperCase() === country.toUpperCase() &&
      cs.payoutEnabled &&
      activeProviders.has(cs.provider)
    );
    for (const config of enabledConfigs) {
      if (enabledCountries.some(c => c.provider === config.provider)) return config.provider;
    }
    if (enabledConfigs.length > 0) return enabledConfigs[0].provider;
    return null;
  }

  // ===== Business API Direct Payin =====
  app.post("/api/v1/business/payin", async (req: Request, res: Response) => {
    try {
      let tokenStr = req.headers.authorization?.replace(/^Bearer\s+/i, "").trim();
      if (!tokenStr || !tokenStr.startsWith("bt_")) {
        return res.status(401).json({ success: false, error: { code: "INVALID_TOKEN", message: "Token API invalide. Utilisez: Authorization: Bearer bt_live_..." } });
      }

      const businessToken = await storage.getBusinessTokenByToken(tokenStr);
      if (!businessToken || !businessToken.isActive) {
        return res.status(401).json({ success: false, error: { code: "INVALID_TOKEN", message: "Token API invalide ou désactivé" } });
      }

      const user = await storage.getUser(businessToken.userId);
      if (!user || user.accountType !== "business") {
        return res.status(401).json({ success: false, error: { code: "INVALID_ACCOUNT", message: "Compte entreprise introuvable" } });
      }
      if (user.suspended) {
        return res.status(403).json({ success: false, error: { code: "ACCOUNT_SUSPENDED", message: "Ce compte a été suspendu" } });
      }
      if (user.kycStatus !== "verified") {
        return res.status(403).json({ success: false, error: { code: "ACCOUNT_NOT_VERIFIED", message: "KYC non vérifié" } });
      }

      const { phone, operator, country, amount, currency, description, orderId, callbackUrl } = req.body;
      if (!phone || !operator || !country || !amount) {
        return res.status(400).json({ success: false, error: { code: "INVALID_PARAMETERS", message: "Les champs phone, operator, country et amount sont obligatoires" } });
      }

      const parsedAmount = Number(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ success: false, error: { code: "INVALID_PARAMETERS", message: "Le montant doit être un nombre positif" } });
      }

      const countryCode = String(country).toUpperCase();
      const requestedAmount = Math.floor(parsedAmount);
      let normalizedOperator = String(operator).toLowerCase()
        .replace(/\s+/g, "-").replace(/-[a-z]{2}$/i, "")
        .replace(/[-_]money$/i, "").replace(/[-_]mobile$/i, "").replace(/[-_]cash$/i, "");

      if (normalizedOperator === "t-money" || normalizedOperator === "tmoney" || normalizedOperator === "togocel") normalizedOperator = "tmoney";
      if (normalizedOperator === "m-pesa" || normalizedOperator === "mpesa") normalizedOperator = "vodacom";

      const countryPhoneMap: Record<string, { code: string; digits: number[] }> = {
        "SN": { code: "221", digits: [9] }, "CI": { code: "225", digits: [10] },
        "BF": { code: "226", digits: [8] }, "BJ": { code: "229", digits: [8, 9, 10] },
        "TG": { code: "228", digits: [8] }, "CM": { code: "237", digits: [9] },
        "CD": { code: "243", digits: [9] }, "CG": { code: "242", digits: [9] },
        "GA": { code: "241", digits: [8] }, "ZM": { code: "260", digits: [9] },
        "UG": { code: "256", digits: [9] },
      };

      let rawPhone = String(phone).replace(/[\s\-\.]+/g, "");
      let localPhone = rawPhone;
      const pInfo = countryPhoneMap[countryCode];
      if (pInfo) {
        if (localPhone.startsWith("+")) localPhone = localPhone.substring(1);
        if (localPhone.startsWith("00")) localPhone = localPhone.substring(2);
        if (localPhone.startsWith(pInfo.code)) {
          const withoutCode = localPhone.substring(pInfo.code.length);
          if (pInfo.digits.includes(withoutCode.length)) localPhone = withoutCode;
        }
      }

      if (businessToken.allowedCountries && businessToken.allowedCountries.length > 0) {
        if (!businessToken.allowedCountries.includes(countryCode)) {
          return res.status(400).json({ success: false, error: { code: "COUNTRY_NOT_ALLOWED", message: `Ce pays n'est pas autorisé pour ce token` } });
        }
      }

      const activeProvider = await getBusinessActiveProviderForDeposit(countryCode, normalizedOperator);
      if (!activeProvider) {
        return res.status(400).json({ success: false, error: { code: "OPERATOR_UNAVAILABLE", message: `L'opérateur ${operator} n'est pas disponible pour ce pays` } });
      }

      const COUNTRY_CURRENCIES: Record<string, string> = {
        "BJ": "XOF", "TG": "XOF", "SN": "XOF", "CI": "XOF", "BF": "XOF",
        "CM": "XAF", "GA": "XAF", "CG": "XAF",
        "CD": "CDF", "ZM": "ZMW", "UG": "UGX",
      };
      const requestedCurrency = currency ? String(currency).toUpperCase() : (COUNTRY_CURRENCIES[countryCode] || "XOF");

      const feeConfig = await getFeeFromDatabase(storage, activeProvider, countryCode, normalizedOperator, "business", user.id);
      const customerPaysFee = businessToken.customerPaysFee ?? false;
      const feeInfo = calculateIncomingFee(requestedAmount, feeConfig.incoming);
      const netAmountForUser = customerPaysFee ? requestedAmount : feeInfo.netAmount;
      const txFeeAmount = customerPaysFee ? 0 : feeInfo.feeAmount;
      const txFeePercentage = customerPaysFee ? 0 : feeInfo.feePercentage;

      const txDescription = description || `Payin API ${requestedAmount} ${requestedCurrency}`;

      let result: { success: boolean; transactionId?: string; error?: string; message?: string; requiresOTP?: boolean; otpInstructions?: string; otpUssdCode?: string; otpHint?: string };

      if (activeProvider === "pawapay") {
        const { otpCode } = req.body;
        result = await handlePawaPayDeposit(
          user.id, user, requestedAmount, countryCode, normalizedOperator, localPhone,
          requestedCurrency, requestedAmount, requestedCurrency, otpCode,
          { transactionType: "api_payment", transactionDescription: txDescription, customerPaysFee, extraMetadata: { businessTokenId: businessToken.id, orderId, scope: "business" } }
        );
      } else if (activeProvider === "afribapay") {
        const { otpCode } = req.body;
        const { handleAfribaPayDeposit } = await import("./afribapay-routes");
        result = await handleAfribaPayDeposit(
          user.id, user, requestedAmount, countryCode, normalizedOperator, localPhone, otpCode,
          requestedCurrency, requestedAmount, requestedCurrency
        );
      } else if (activeProvider === "fedapay") {
        const { handleFedaPayDeposit } = await import("./fedapay-routes");
        result = await handleFedaPayDeposit(user.id, user, requestedAmount, countryCode, normalizedOperator, localPhone, requestedCurrency, requestedAmount, requestedCurrency);
      } else if (activeProvider === "mbiyopay") {
        const { handleMbiyoPayDeposit } = await import("./mbiyopay-routes");
        result = await handleMbiyoPayDeposit(user.id, user, requestedAmount, countryCode, normalizedOperator, localPhone, requestedCurrency, requestedAmount, requestedCurrency);
      } else if (activeProvider === "feexpay") {
        const { otpCode } = req.body;
        const { handleFeeXPayDeposit } = await import("./feexpay-routes");
        result = await handleFeeXPayDeposit(
          user.id, user, requestedAmount, countryCode, normalizedOperator, localPhone, otpCode,
          requestedCurrency, requestedAmount, requestedCurrency,
          {
            transactionType: "api_payment",
            transactionDescription: txDescription,
            customerPaysFee,
            extraMetadata: { scope: "business", businessTokenId: businessToken.id, orderId: orderId || null },
          }
        );
      } else if (activeProvider === "paydunya") {
        const paydunyaData = {
          invoice: {
            total_amount: requestedAmount,
            description: txDescription,
            customer: {
              name: "Client",
              email: "noreply@bkapay.com",
              phone: localPhone,
            },
          },
          store: { name: "BKApay" },
          custom_data: {
            type: "api_payment",
            country: countryCode,
            operator: normalizedOperator,
            phone: localPhone,
            scope: "business",
            businessTokenId: businessToken.id,
            orderId: orderId || null,
          },
          actions: {
            callback_url: `${process.env.BASE_URL || 'https://bkapay.com'}/api/webhooks/paydunya`,
          },
        };

        const paydunyaResponse = await callPaydunyaAPI("/checkout-invoice/create", paydunyaData);

        if (paydunyaResponse.response_code !== "00" || !paydunyaResponse.token) {
          result = { success: false, error: "Impossible d'initier le paiement" };
        } else {
          const tx = await storage.createTransaction({
            userId: user.id,
            type: "api_payment",
            amount: requestedAmount,
            fee: txFeeAmount,
            feePercentage: txFeePercentage,
            currency: requestedCurrency,
            status: "pending",
            country: countryCode,
            operator: normalizedOperator,
            description: txDescription,
            customerPhone: localPhone,
            paydunyaToken: paydunyaResponse.token,
            metadata: JSON.stringify({
              paydunyaToken: paydunyaResponse.token,
              provider: "paydunya",
              country: countryCode,
              operator: normalizedOperator,
              netAmountForUser,
              businessTokenId: businessToken.id,
              orderId: orderId || null,
              scope: "business",
              customerPaysFee,
              feeAmount: txFeeAmount,
            }),
          });

          const operatorKey = getOperatorKey(normalizedOperator, countryCode);
          if (operatorKey) {
            const paymentData: SoftpayPaymentData = {
              customerName: "Client",
              customerEmail: "noreply@bkapay.com",
              phoneNumber: localPhone.replace(/\s+/g, "").replace(/[^0-9]/g, ""),
              invoiceToken: paydunyaResponse.token,
            };

            const softpayResult = await callPaydunyaSoftpay(normalizedOperator, countryCode, paymentData);

            if (softpayResult.success) {
              const opConfig = SOFTPAY_OPERATORS[operatorKey];
              const needsOTP = opConfig?.requiresOTP || false;

              if (needsOTP) {
                result = {
                  success: true,
                  transactionId: tx.id,
                  requiresOTP: true,
                  otpInstructions: opConfig?.ussdInstruction || undefined,
                  message: "Veuillez valider le paiement sur votre téléphone.",
                };
              } else {
                result = {
                  success: true,
                  transactionId: tx.id,
                  message: softpayResult.message || "Paiement initié. Veuillez valider sur votre téléphone.",
                };
              }
            } else {
              result = { success: true, transactionId: tx.id, message: "Paiement initié. Veuillez valider sur votre téléphone." };
            }
          } else {
            result = { success: true, transactionId: tx.id, message: "Paiement initié. Veuillez valider sur votre téléphone." };
          }
        }
      } else {
        result = { success: false, error: "Service de paiement temporairement indisponible" };
      }

      const providerNames = ["pawapay", "paydunya", "fedapay", "mbiyopay", "moneyfusion", "afribapay", "feexpay", "PawaPay", "Paydunya", "FedaPay", "MbiyoPay", "MoneyFusion", "AfribaPay", "FeeXPay"];
      const sanitizeBusinessError = (msg: string | undefined): string => {
        if (!msg) return "La transaction a échoué";
        let sanitized = msg;
        for (const name of providerNames) {
          sanitized = sanitized.replace(new RegExp(name, "gi"), "BKApay");
        }
        return sanitized;
      };

      if (result.requiresOTP) {
        return res.status(200).json({
          success: false,
          requiresOTP: true,
          otpInstructions: result.otpInstructions,
          otpUssdCode: result.otpUssdCode,
          otpHint: result.otpHint,
          error: sanitizeBusinessError(result.error),
        });
      }

      if (!result.success) {
        return res.status(400).json({ success: false, error: { code: "TRANSACTION_FAILED", message: sanitizeBusinessError(result.error) } });
      }

      if (result.transactionId) {
        try {
          const tx = await storage.getTransaction(result.transactionId);
          if (tx && tx.metadata) {
            const meta = JSON.parse(tx.metadata);
            meta.businessTokenId = businessToken.id;
            meta.scope = "business";
            if (orderId) meta.orderId = orderId;
            await storage.updateTransactionMetadata(result.transactionId, JSON.stringify(meta));
          }
        } catch (e) {}
      }

      const cbUrl = callbackUrl || businessToken.callbackUrl;
      const cbSecret = businessToken.callbackSecret;
      if (result.transactionId && cbUrl && cbSecret) {
        setImmediate(async () => {
          try {
            const tx = await storage.getTransaction(result.transactionId!);
            if (!tx) return;
            const payinEvent = tx.status === "completed" ? "business.payin.completed" : tx.status === "failed" ? "business.payin.failed" : "business.payin.initiated";
            const payload = {
              event: payinEvent,
              transactionId: tx.id,
              orderId: orderId || undefined,
              amount: requestedAmount,
              currency: requestedCurrency,
              status: tx.status,
              country: countryCode,
              operator: normalizedOperator,
              phone: localPhone,
              timestamp: new Date().toISOString(),
            };
            const payloadStr = JSON.stringify(payload);
            const signature = require("crypto").createHmac("sha256", cbSecret).update(payloadStr).digest("hex");
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 10000);
            await fetch(cbUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-BKApay-Signature": signature, "X-BKApay-Event": payinEvent },
              body: payloadStr,
              signal: controller.signal,
            }).finally(() => clearTimeout(tid));
          } catch (e) { console.error("[Business Payin] Callback error:", e); }
        });
      }

      const responsePayload: Record<string, unknown> = {
        success: true,
        transactionId: result.transactionId,
        status: "pending",
        message: result.message || "Payin initié avec succès. Le client doit valider sur son téléphone.",
        amount: requestedAmount,
        currency: requestedCurrency,
      };

      // Expose redirectUrl and authMode for providers that require a redirect (e.g. MbiyoPay PIN)
      if ((result as any).redirectUrl) responsePayload.redirectUrl = (result as any).redirectUrl;
      if ((result as any).authMode) responsePayload.authMode = (result as any).authMode;
      if ((result as any).instructions) responsePayload.instructions = (result as any).instructions;

      return res.json(responsePayload);
    } catch (error: any) {
      console.error("[Business Payin] Error:", error);
      res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Une erreur interne est survenue" } });
    }
  });

  // ===== Business API Direct Payout =====
  app.post("/api/v1/business/payout", async (req: Request, res: Response) => {
    try {
      let tokenStr = req.headers.authorization?.replace(/^Bearer\s+/i, "").trim();
      if (!tokenStr || !tokenStr.startsWith("bt_")) {
        return res.status(401).json({ success: false, error: { code: "INVALID_TOKEN", message: "Token API invalide. Utilisez: Authorization: Bearer bt_live_..." } });
      }

      const businessToken = await storage.getBusinessTokenByToken(tokenStr);
      if (!businessToken || !businessToken.isActive) {
        return res.status(401).json({ success: false, error: { code: "INVALID_TOKEN", message: "Token API invalide ou désactivé" } });
      }

      const user = await storage.getUser(businessToken.userId);
      if (!user || user.accountType !== "business") {
        return res.status(401).json({ success: false, error: { code: "INVALID_ACCOUNT", message: "Compte entreprise introuvable" } });
      }
      if (user.suspended) {
        return res.status(403).json({ success: false, error: { code: "ACCOUNT_SUSPENDED", message: "Ce compte a été suspendu" } });
      }
      if (user.kycStatus !== "verified") {
        return res.status(403).json({ success: false, error: { code: "ACCOUNT_NOT_VERIFIED", message: "KYC non vérifié" } });
      }
      if (!user.payoutApiEnabled) {
        return res.status(403).json({ success: false, error: { code: "PAYOUT_NOT_ACTIVATED", message: "Le payout API n'est pas activé" } });
      }

      const { phone, operator, country, amount, currency, description, reference } = req.body;
      if (!phone || !operator || !country || !amount) {
        return res.status(400).json({ success: false, error: { code: "INVALID_PARAMETERS", message: "Les champs phone, operator, country et amount sont obligatoires" } });
      }

      const parsedAmount = Number(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ success: false, error: { code: "INVALID_PARAMETERS", message: "Le montant doit être un nombre positif" } });
      }

      const PAYOUT_MIN_AMOUNT = 500;
      if (parsedAmount < PAYOUT_MIN_AMOUNT) {
        return res.status(400).json({ success: false, error: { code: "AMOUNT_TOO_LOW", message: `Le montant minimum est de ${PAYOUT_MIN_AMOUNT}` } });
      }

      const requestedAmount = Math.floor(parsedAmount);
      const countryCode = String(country).toUpperCase();
      let normalizedOperator = String(operator).toLowerCase()
        .replace(/\s+/g, "-").replace(/-[a-z]{2}$/i, "")
        .replace(/[-_]money$/i, "").replace(/[-_]mobile$/i, "").replace(/[-_]cash$/i, "");
      if (normalizedOperator === "t-money" || normalizedOperator === "tmoney" || normalizedOperator === "togocel") normalizedOperator = "tmoney";
      if (normalizedOperator === "m-pesa" || normalizedOperator === "mpesa") normalizedOperator = "vodacom";

      const countryPhoneMap: Record<string, { code: string; digits: number[] }> = {
        "SN": { code: "221", digits: [9] }, "CI": { code: "225", digits: [10] },
        "BF": { code: "226", digits: [8] }, "BJ": { code: "229", digits: [8, 9, 10] },
        "TG": { code: "228", digits: [8] }, "CM": { code: "237", digits: [9] },
        "CD": { code: "243", digits: [9] }, "CG": { code: "242", digits: [9] },
        "GA": { code: "241", digits: [8] }, "ZM": { code: "260", digits: [9] },
        "UG": { code: "256", digits: [9] },
      };

      let rawPhone = String(phone).replace(/[\s\-\.]+/g, "");
      let localPhone = rawPhone;
      const pInfo = countryPhoneMap[countryCode];
      if (pInfo) {
        if (localPhone.startsWith("+")) localPhone = localPhone.substring(1);
        if (localPhone.startsWith("00")) localPhone = localPhone.substring(2);
        if (localPhone.startsWith(pInfo.code)) {
          const withoutCode = localPhone.substring(pInfo.code.length);
          if (pInfo.digits.includes(withoutCode.length)) localPhone = withoutCode;
        }
      }

      if (businessToken.allowedCountries && businessToken.allowedCountries.length > 0) {
        if (!businessToken.allowedCountries.includes(countryCode)) {
          return res.status(400).json({ success: false, error: { code: "COUNTRY_NOT_ALLOWED", message: `Ce pays n'est pas autorisé pour ce token` } });
        }
      }

      const activeProvider = await getBusinessActiveProviderForWithdrawal(countryCode, normalizedOperator);
      if (!activeProvider) {
        return res.status(400).json({ success: false, error: { code: "OPERATOR_UNAVAILABLE", message: `L'opérateur ${operator} n'est pas disponible pour le payout dans ce pays` } });
      }

      const COUNTRY_CURRENCIES: Record<string, string> = {
        "BJ": "XOF", "TG": "XOF", "SN": "XOF", "CI": "XOF", "BF": "XOF",
        "CM": "XAF", "GA": "XAF", "CG": "XAF",
        "CD": "CDF", "ZM": "ZMW", "UG": "UGX",
      };
      const requestedCurrency = currency ? String(currency).toUpperCase() : (COUNTRY_CURRENCIES[countryCode] || "XOF");

      const wallet = await storage.getBusinessWallet(user.id, countryCode, requestedCurrency);
      const walletBalance = wallet?.balance || 0;

      const feeConfig = await getFeeFromDatabase(storage, activeProvider, countryCode, normalizedOperator, "business", user.id);
      const feeInfo = calculateOutgoingFeeFromNet(requestedAmount, feeConfig.outgoing);

      if (walletBalance < feeInfo.totalDeductedFromBalance) {
        return res.status(400).json({ success: false, error: { code: "INSUFFICIENT_FUNDS", message: `Solde insuffisant dans le wallet ${countryCode} (${requestedCurrency})` } });
      }

      await storage.debitBusinessWallet(user.id, countryCode, requestedCurrency, feeInfo.totalDeductedFromBalance);

      let result: { success: boolean; transactionId?: string; error?: string; message?: string };

      if (activeProvider === "pawapay") {
        result = await handlePawaPayWithdrawal(user.id, user, requestedAmount, countryCode, normalizedOperator, localPhone, requestedCurrency, requestedCurrency, true, undefined, true);
      } else if (activeProvider === "fedapay") {
        result = await handleFedaPayWithdrawal(user.id, user, requestedAmount, countryCode, normalizedOperator, localPhone, requestedCurrency, true, true);
      } else if (activeProvider === "mbiyopay") {
        result = await handleMbiyoPayWithdrawal(user.id, user, requestedAmount, countryCode, normalizedOperator, localPhone, requestedCurrency, requestedCurrency, true, undefined, true);
      } else if (activeProvider === "moneyfusion") {
        result = await handleMoneyFusionWithdrawal(user.id, user, requestedAmount, countryCode, normalizedOperator, localPhone, requestedCurrency, true, undefined, true);
      } else if (activeProvider === "feexpay") {
        const { handleFeeXPayWithdrawal } = await import("./feexpay-routes");
        result = await handleFeeXPayWithdrawal(user.id, user, requestedAmount, countryCode, normalizedOperator, localPhone, requestedCurrency, true, undefined, true);
      } else if (activeProvider === "paydunya") {
        const countryWithdrawModes: Record<string, Record<string, string>> = {
          "SN": { "orange": "orange-money-senegal", "free": "free-money-senegal", "wave": "wave-senegal" },
          "CI": { "orange": "orange-money-ci", "mtn": "mtn-ci", "moov": "moov-ci" },
          "BF": { "orange": "orange-money-burkina", "moov": "moov-burkina-faso" },
          "BJ": { "moov": "moov-benin", "mtn": "mtn-benin" },
          "TG": { "tmoney": "t-money-togo", "moov": "moov-togo" },
          "CM": { "mtn": "mtn-cameroun" },
        };
        const withdrawMode = countryWithdrawModes[countryCode]?.[normalizedOperator];
        if (!withdrawMode) {
          result = { success: false, error: "Cet opérateur n'est pas disponible pour le payout dans ce pays" };
        } else {
          // Create transaction in pending state and dispatch to provider in 5s
          const bizTx = await storage.createTransaction({
            userId: user.id, type: "withdrawal",
            amount: requestedAmount, fee: feeInfo.feeAmount,
            feePercentage: feeInfo.feePercentage, currency: requestedCurrency,
            status: "pending", country: countryCode, operator: normalizedOperator,
            customerPhone: localPhone,
            description: description || `Business Payout ${requestedAmount} ${requestedCurrency}`,
            metadata: JSON.stringify({
              provider: "paydunya", businessTokenId: businessToken.id, reference,
              scope: "business", netMode: true,
              deductedFromBalance: feeInfo.totalDeductedFromBalance,
            }),
          });
          const bizTxId = bizTx.id;
          const bizUserId = user.id;
          const callbackBaseUrl = process.env.BASE_URL || "https://bkapay.com";
          setTimeout(async () => {
            try {
              const getInvoiceResp = await callPaydunyaAPIv2("/disburse/get-invoice", {
                account_alias: localPhone, amount: requestedAmount,
                withdraw_mode: withdrawMode, callback_url: `${callbackBaseUrl}/api/webhooks/paydunya-disburse`,
              });
              if (getInvoiceResp.response_code !== "00" || !getInvoiceResp.disburse_token) {
                console.error(`[BIZ Payout PAYDUNYA] Get-invoice failed for ${bizTxId} - refunding business wallet`);
                await storage.atomicFailAndRefundBusinessWallet(bizTxId, bizUserId, countryCode, requestedCurrency, feeInfo.totalDeductedFromBalance, "biz-paydunya-get-invoice-failed");
                return;
              }
              const disburseId = `biz-payout-${bizUserId.substring(0, 8)}-${Date.now()}`;
              const submitResp = await callPaydunyaAPIv2("/disburse/submit-invoice", {
                disburse_invoice: getInvoiceResp.disburse_token, disburse_id: disburseId,
              });
              if (submitResp.response_code !== "00") {
                console.error(`[BIZ Payout PAYDUNYA] Submit-invoice failed for ${bizTxId} - refunding business wallet`);
                await storage.atomicFailAndRefundBusinessWallet(bizTxId, bizUserId, countryCode, requestedCurrency, feeInfo.totalDeductedFromBalance, "biz-paydunya-submit-failed");
                return;
              }
              await storage.updateTransactionMetadata(bizTxId, JSON.stringify({
                provider: "paydunya", businessTokenId: businessToken.id, reference, scope: "business",
                paydunyaTransactionId: submitResp.transaction_id, disburseId, netMode: true,
                deductedFromBalance: feeInfo.totalDeductedFromBalance,
              }));
              await storage.updateTransaction(bizTxId, { paydunyaToken: getInvoiceResp.disburse_token });
              await storage.updateTransactionStatus(bizTxId, "completed");
              console.log(`[BIZ Payout PAYDUNYA] ✅ tx ${bizTxId} COMPLETED`);
            } catch (dispatchErr) {
              console.error(`[BIZ Payout PAYDUNYA] Dispatch error for ${bizTxId}:`, dispatchErr);
              await storage.atomicFailAndRefundBusinessWallet(bizTxId, bizUserId, countryCode, requestedCurrency, feeInfo.totalDeductedFromBalance, "biz-paydunya-dispatch-error");
            }
          }, 5000);
          result = { success: true, transactionId: bizTxId, message: "Payout initié avec succès" };
        }
      } else {
        result = { success: false, error: "Service de payout temporairement indisponible" };
      }

      if (!result.success) {
        await storage.creditBusinessWallet(user.id, countryCode, requestedCurrency, feeInfo.totalDeductedFromBalance);
      }

      const providerNames = ["pawapay", "paydunya", "fedapay", "mbiyopay", "moneyfusion", "afribapay", "feexpay", "PawaPay", "Paydunya", "FedaPay", "MbiyoPay", "MoneyFusion", "AfribaPay", "FeeXPay"];
      const sanitizePayoutError = (msg: string | undefined): string => {
        if (!msg) return "La transaction a échoué";
        let sanitized = msg;
        for (const name of providerNames) {
          sanitized = sanitized.replace(new RegExp(name, "gi"), "BKApay");
        }
        return sanitized;
      };

      if (!result.success) {
        return res.status(400).json({ success: false, error: { code: "TRANSACTION_FAILED", message: sanitizePayoutError(result.error) } });
      }

      if (result.transactionId) {
        try {
          const tx = await storage.getTransaction(result.transactionId);
          if (tx && tx.metadata) {
            const meta = JSON.parse(tx.metadata);
            meta.businessTokenId = businessToken.id;
            meta.scope = "business";
            if (reference) meta.reference = reference;
            await storage.updateTransactionMetadata(result.transactionId, JSON.stringify(meta));
          }
        } catch (e) {}
      }

      const payoutCbUrl = businessToken.payoutCallbackUrl;
      const payoutCbSecret = businessToken.payoutCallbackSecret;
      if (result.transactionId && payoutCbUrl && payoutCbSecret) {
        setImmediate(async () => {
          try {
            const tx = await storage.getTransaction(result.transactionId!);
            if (!tx) return;
            const payoutEvent = tx.status === "completed" ? "business.payout.completed" : tx.status === "failed" ? "business.payout.failed" : "business.payout.pending";
            const payload = {
              event: payoutEvent,
              transactionId: tx.id,
              reference: reference || undefined,
              amount: requestedAmount,
              currency: requestedCurrency,
              status: tx.status,
              country: countryCode,
              operator: normalizedOperator,
              phone: localPhone,
              timestamp: new Date().toISOString(),
            };
            const payloadStr = JSON.stringify(payload);
            const signature = require("crypto").createHmac("sha256", payoutCbSecret).update(payloadStr).digest("hex");
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 10000);
            await fetch(payoutCbUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-BKApay-Signature": signature, "X-BKApay-Event": payoutEvent },
              body: payloadStr,
              signal: controller.signal,
            }).finally(() => clearTimeout(tid));
          } catch (e) { console.error("[Business Payout] Callback error:", e); }
        });
      }

      return res.json({
        success: true,
        transactionId: result.transactionId,
        status: "pending",
        message: result.message || "Payout initié avec succès",
        amount: requestedAmount,
        currency: requestedCurrency,
      });
    } catch (error: any) {
      console.error("[Business Payout] Error:", error);
      try {
        if (requestedAmount && countryCode && requestedCurrency && feeInfo) {
          await storage.creditBusinessWallet(user.id, countryCode, requestedCurrency, feeInfo.totalDeductedFromBalance);
          console.log(`[Business Payout] Refunded ${feeInfo.totalDeductedFromBalance} ${requestedCurrency} to business wallet after exception`);
        }
      } catch (refundErr) {
        console.error("[Business Payout] CRITICAL: Failed to refund business wallet after exception:", refundErr);
      }
      res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Une erreur interne est survenue" } });
    }
  });

  // ===== Business API Status Checks =====
  app.get("/api/v1/business/payin/:id/status", async (req: Request, res: Response) => {
    try {
      let tokenStr = req.headers.authorization?.replace(/^Bearer\s+/i, "").trim();
      if (!tokenStr || !tokenStr.startsWith("bt_")) {
        return res.status(401).json({ success: false, error: "Token API invalide" });
      }
      const businessToken = await storage.getBusinessTokenByToken(tokenStr);
      if (!businessToken || !businessToken.isActive) {
        return res.status(401).json({ success: false, error: "Token invalide" });
      }
      const tx = await storage.getTransaction(req.params.id);
      if (!tx || tx.userId !== businessToken.userId) {
        return res.status(404).json({ success: false, error: "Transaction non trouvée" });
      }
      return res.json({
        success: true,
        transactionId: tx.id,
        status: tx.status,
        amount: tx.amount,
        currency: tx.currency,
        country: tx.country,
        operator: tx.operator,
        createdAt: tx.createdAt,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: "Erreur interne" });
    }
  });

  app.get("/api/v1/business/payout/:id/status", async (req: Request, res: Response) => {
    try {
      let tokenStr = req.headers.authorization?.replace(/^Bearer\s+/i, "").trim();
      if (!tokenStr || !tokenStr.startsWith("bt_")) {
        return res.status(401).json({ success: false, error: "Token API invalide" });
      }
      const businessToken = await storage.getBusinessTokenByToken(tokenStr);
      if (!businessToken || !businessToken.isActive) {
        return res.status(401).json({ success: false, error: "Token invalide" });
      }
      const tx = await storage.getTransaction(req.params.id);
      if (!tx || tx.userId !== businessToken.userId) {
        return res.status(404).json({ success: false, error: "Transaction non trouvée" });
      }
      return res.json({
        success: true,
        transactionId: tx.id,
        status: tx.status,
        amount: tx.amount,
        currency: tx.currency,
        country: tx.country,
        operator: tx.operator,
        createdAt: tx.createdAt,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: "Erreur interne" });
    }
  });

  // ===== Business Token Management Routes =====
  app.get("/api/business/tokens", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.accountType !== "business") {
        return res.status(403).json({ error: "Compte entreprise requis" });
      }
      const tokens = await storage.getBusinessTokensByUserId(user.id);
      res.json(tokens);
    } catch (error: any) {
      res.status(500).json({ error: "Erreur interne" });
    }
  });

  app.post("/api/business/tokens", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.accountType !== "business") {
        return res.status(403).json({ error: "Compte entreprise requis" });
      }
      const existing = await storage.getBusinessTokensByUserId(user.id);
      if (existing.length >= 3) {
        return res.status(400).json({ error: "Maximum 3 tokens autorisés" });
      }
      const tokenStr = `bt_live_${randomUUID().replace(/-/g, '')}`;
      const name = req.body.name || "Token API";
      const token = await storage.createBusinessToken({ userId: user.id, token: tokenStr, name });
      res.json(token);
    } catch (error: any) {
      console.error("[Business Token Create] Error:", error?.message || error);
      res.status(500).json({ error: "Erreur interne" });
    }
  });

  app.put("/api/business/tokens/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.accountType !== "business") {
        return res.status(403).json({ error: "Compte entreprise requis" });
      }
      const { name, callbackUrl, payoutCallbackUrl, allowedCountries, customerPaysFee } = req.body;
      const token = await storage.updateBusinessToken(req.params.id, user.id, {
        ...(name !== undefined && { name }),
        ...(callbackUrl !== undefined && { callbackUrl }),
        ...(payoutCallbackUrl !== undefined && { payoutCallbackUrl }),
        ...(allowedCountries !== undefined && { allowedCountries }),
        ...(customerPaysFee !== undefined && { customerPaysFee }),
      });
      if (!token) return res.status(404).json({ error: "Token non trouvé" });
      res.json(token);
    } catch (error: any) {
      res.status(500).json({ error: "Erreur interne" });
    }
  });

  app.post("/api/business/tokens/:id/regenerate", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.accountType !== "business") {
        return res.status(403).json({ error: "Compte entreprise requis" });
      }
      const token = await storage.regenerateBusinessToken(req.params.id, user.id);
      if (!token) return res.status(404).json({ error: "Token non trouvé" });
      res.json(token);
    } catch (error: any) {
      res.status(500).json({ error: "Erreur interne" });
    }
  });

  app.delete("/api/business/tokens/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.accountType !== "business") {
        return res.status(403).json({ error: "Compte entreprise requis" });
      }
      const deleted = await storage.deleteBusinessToken(req.params.id, user.id);
      if (!deleted) return res.status(404).json({ error: "Token non trouvé" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Erreur interne" });
    }
  });

  app.post("/api/business/tokens/:id/regenerate-callback-secret", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.accountType !== "business") {
        return res.status(403).json({ error: "Compte entreprise requis" });
      }
      const newSecret = `bks_${randomUUID().replace(/-/g, '')}`;
      const token = await storage.updateBusinessToken(req.params.id, user.id, { callbackSecret: newSecret });
      if (!token) return res.status(404).json({ error: "Token non trouvé" });
      res.json(token);
    } catch (error: any) {
      res.status(500).json({ error: "Erreur interne" });
    }
  });

  app.post("/api/business/tokens/:id/regenerate-payout-secret", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.accountType !== "business") {
        return res.status(403).json({ error: "Compte entreprise requis" });
      }
      const newSecret = `bkps_${randomUUID().replace(/-/g, '')}`;
      const token = await storage.updateBusinessToken(req.params.id, user.id, { payoutCallbackSecret: newSecret });
      if (!token) return res.status(404).json({ error: "Token non trouvé" });
      res.json(token);
    } catch (error: any) {
      res.status(500).json({ error: "Erreur interne" });
    }
  });

  // Deposit Route - Multi-Provider
  app.post("/api/fedapay/deposit", requireAuth, async (req: Request, res: Response) => {
    try {
      const { amount, country, operator, phone, currency, originalAmount, originalCurrency } = req.body;
      const user = await storage.getUser(req.session.userId!);
      
      // Use converted amount for provider, original amount for balance credit
      const providerAmount = Math.floor(amount);
      const balanceAmount = originalAmount ? Math.floor(originalAmount) : providerAmount;
      const providerCurrency = currency || "XOF";
      const userCurrency = originalCurrency || providerCurrency;

      if (!user) {
        return res.status(404).json({ success: false, error: "Utilisateur non trouve" });
      }

      if (user.suspended) {
        return res.status(403).json({ success: false, error: "Votre compte a ete suspendu" });
      }

      // Check deposit enabled (global + per-user override)
      const depositSetting = await pgPool.query("SELECT value FROM platform_settings WHERE key = 'deposit_enabled'");
      const depositGlobalEnabled = depositSetting.rows.length === 0 || depositSetting.rows[0].value === 'true';
      if (!depositGlobalEnabled && !user.depositOverrideEnabled) {
        return res.status(403).json({ success: false, error: "Les depots sont temporairement desactives. Veuillez contacter le support." });
      }

      if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, error: "Montant invalide" });
      }

      if (!country || !operator || !phone) {
        return res.status(400).json({ success: false, error: "Pays, operateur et telephone requis" });
      }

      // Wave payin activation check
      if (operator.toLowerCase() === "wave" && !user?.wavePayinEnabled) {
        return res.status(403).json({ success: false, error: "Pour faire les opérations Via wave, contacter le support pour l'activer" });
      }

      // Determine which provider to use based on configuration
      const activeProvider = await getActiveProviderForDeposit(country, operator);
      
      if (!activeProvider) {
        console.log(`[DEPOSIT] No active provider found for ${country}/${operator}`);
        return res.status(503).json({ 
          success: false, 
          error: "Aucun fournisseur de paiement n'est configure pour ce pays et operateur. Veuillez contacter l'administrateur." 
        });
      }

      console.log(`[DEPOSIT] Using provider: ${activeProvider} for ${country}/${operator}`);

      if (activeProvider === "fedapay") {
        // Use FedaPay - pass converted amount and original amount
        const result = await handleFedaPayDeposit(
          req.session.userId!,
          user,
          providerAmount,
          country,
          operator,
          phone,
          providerCurrency,
          balanceAmount,
          userCurrency
        );

        if (result.success) {
          return res.json({
            success: true,
            transactionId: result.transactionId,
            message: result.message || "Demande de paiement envoyee. Veuillez valider sur votre telephone.",
          });
        } else {
          return res.status(400).json({ success: false, error: result.error });
        }
      } else if (activeProvider === "paydunya") {
        // Use Paydunya SOFTPAY
        console.log(`[DEPOSIT] Using Paydunya SOFTPAY for ${country}/${operator}`);
        
        const effectiveCustomerName = `${user.firstName} ${user.lastName}`;
        
        const payduynaDepositCurrencies: Record<string, string> = { "CM": "XAF" };
        const depositProviderCurrency = payduynaDepositCurrencies[country.toUpperCase()] || "XOF";
        
        const paydunyaData = {
          invoice: {
            total_amount: Math.floor(amount),
            description: `Depot de ${amount} ${depositProviderCurrency}`,
            customer: {
              name: effectiveCustomerName,
              email: "noreply@bkapay.com",
              phone: phone,
            },
          },
          store: {
            name: "BKApay",
          },
          custom_data: {
            user_id: req.session.userId!,
            type: "deposit",
            country,
            operator,
            phone,
          },
          actions: {
            callback_url: `${process.env.BASE_URL || 'https://bkapay.com'}/api/webhooks/paydunya`,
          },
        };

        console.log("[DEPOSIT PAYDUNYA] Creating invoice:", paydunyaData);

        const paydunyaResponse = await callPaydunyaAPI("/checkout-invoice/create", paydunyaData);

        if (paydunyaResponse.response_code === "00" && paydunyaResponse.token) {
          // Calculer les frais sur le montant en devise utilisateur (balanceAmount)
          const depositBalanceAmt = balanceAmount || Math.floor(amount);
          const depositPaydunyaFeeConfig = await getDynamicFees(storage, country, operator);
          const feeInfo = calculateIncomingFee(depositBalanceAmt, depositPaydunyaFeeConfig.incoming);

          // Frais d'échange si devise fournisseur ≠ devise utilisateur (comptes personnels uniquement)
          const { feeAmount: depXFee, feePercentage: depXFeePct } =
            await getIncomingExchangeFee(storage, depositBalanceAmt, depositProviderCurrency, userCurrency, user?.accountType);
          const depNetAmountForUser = Math.max(0, feeInfo.netAmount - depXFee);
          const depTotalFee = feeInfo.feeAmount + depXFee;
          const depTotalFeePct = feeInfo.feePercentage + depXFeePct;

          const transactionId = randomUUID();
          await storage.createTransaction({
            userId: req.session.userId!,
            type: "deposit",
            amount: feeInfo.grossAmount,
            fee: depTotalFee,
            feePercentage: depTotalFeePct,
            currency: userCurrency,
            status: "pending",
            country,
            operator,
            description: `Depot de ${Math.floor(amount)} ${depositProviderCurrency}`,
            paydunyaToken: paydunyaResponse.token,
            metadata: JSON.stringify({
              phone,
              customerName: effectiveCustomerName,
              provider: "paydunya",
              providerCurrency: depositProviderCurrency,
              providerAmount: Math.floor(amount),
              netAmountForUser: depNetAmountForUser,
              balanceAmount: depNetAmountForUser,
              balanceCurrency: userCurrency,
              ...(depXFee > 0 ? { exchangeFee: depXFee, exchangeFeePercentage: depXFeePct } : {}),
            }),
          });

          const operatorKey = getOperatorKey(operator, country);
          const ussdInstruction = operatorKey ? getUSSDInstruction(operatorKey) : null;
          const needsOTP = operatorKey ? requiresOTP(operatorKey) : false;
          const twoStep = operatorKey ? requiresTwoStep(operatorKey) : false;

          if (!needsOTP && !twoStep && operatorKey) {
            console.log(`[DEPOSIT PAYDUNYA] Operator ${operatorKey} does NOT require OTP - calling SOFTPAY immediately`);
            
            const paymentData: SoftpayPaymentData = {
              customerName: effectiveCustomerName,
              customerEmail: "noreply@bkapay.com",
              phoneNumber: phone,
              invoiceToken: paydunyaResponse.token,
            };

            const softpayResult = await callPaydunyaSoftpay(operator, country, paymentData);
            
            console.log(`[DEPOSIT PAYDUNYA] SOFTPAY result:`, softpayResult);

            if (softpayResult.success) {
              if (softpayResult.url || softpayResult.omUrl) {
                return res.json({
                  success: true,
                  transactionId,
                  token: paydunyaResponse.token,
                  message: softpayResult.message,
                  redirectUrl: softpayResult.url,
                  omUrl: softpayResult.omUrl,       // Orange Money SN deep link
                  maxitUrl: softpayResult.maxitUrl, // Maxit app deep link
                  provider: "paydunya",
                });
              }

              return res.json({
                success: true,
                transactionId,
                token: paydunyaResponse.token,
                message: softpayResult.message || ussdInstruction || "Validez le paiement sur votre telephone",
                provider: "paydunya",
              });
            } else {
              console.error(`[DEPOSIT PAYDUNYA] SOFTPAY call failed:`, softpayResult.message);
              return res.status(400).json({ 
                success: false, 
                error: softpayResult.message || "Erreur lors du paiement SOFTPAY" 
              });
            }
          }

          return res.json({
            success: true,
            transactionId,
            token: paydunyaResponse.token,
            ussdInstruction,
            requiresOTP: needsOTP,
            requiresTwoStep: twoStep,
            message: ussdInstruction || "Suivez les instructions pour valider le paiement",
            provider: "paydunya",
          });
        } else {
          console.error("[DEPOSIT PAYDUNYA] Invoice creation failed:", paydunyaResponse);
          return res.status(400).json({ 
            success: false, 
            error: paydunyaResponse.response_text || "Erreur lors de la creation de la facture" 
          });
        }
      } else if (activeProvider === "mbiyopay") {
        // Use MbiyoPay - pass converted amount and original amount
        console.log(`[DEPOSIT] Using MbiyoPay for ${country}/${operator}`);
        const { otpCode } = req.body;
        
        const needsOtp = mbiyoPayOperatorRequiresOtp(country, operator);
        if (needsOtp && !otpCode) {
          const otpInfo = getMbiyoPayOtpInstructions(country, providerAmount);
          return res.json({
            success: false,
            requiresOTP: true,
            otpInstructions: otpInfo.instructions,
            otpUssdCode: otpInfo.ussdCode,
            otpHint: otpInfo.hint,
            provider: "mbiyopay",
            error: "Code OTP requis pour Orange Money",
          });
        }
        
        const result = await handleMbiyoPayDeposit(
          req.session.userId!,
          user,
          providerAmount,
          country,
          operator,
          phone,
          providerCurrency,
          balanceAmount,
          userCurrency,
          otpCode
        );

        if (result.success) {
          return res.json({
            success: true,
            transactionId: result.transactionId,
            mbiyopayTransactionId: result.mbiyopayTransactionId,
            redirectUrl: result.redirectUrl,
            instructions: result.instructions,
            authMode: result.authMode ?? null,
            message: result.message || "Demande de paiement envoyee. Veuillez valider sur votre telephone.",
            provider: "mbiyopay",
          });
        } else {
          return res.status(400).json({ success: false, error: result.error });
        }
      } else if (activeProvider === "afribapay") {
        // Use AfribaPay for deposit
        console.log(`[DEPOSIT] Using AfribaPay for ${country}/${operator}`);
        const { otpCode } = req.body;
        
        const result = await handleAfribaPayDeposit(
          req.session.userId!,
          user,
          providerAmount,
          country,
          operator,
          phone,
          otpCode,
          providerCurrency,
          balanceAmount,
          userCurrency
        );

        if (result.requiresOtp) {
          const { getOtpUssdCode } = await import("@shared/afribapay-countries");
          return res.status(400).json({
            success: false,
            error: result.error,
            requiresOTP: true,
            otpInstructions: result.otpInstructions,
            otpUssdCode: getOtpUssdCode(country, operator) || undefined,
          });
        }

        if (result.success) {
          return res.json({
            success: true,
            transactionId: result.transactionId,
            redirectUrl: result.providerLink,
            message: result.message || "Paiement initie avec succes",
            provider: "afribapay",
          });
        } else {
          return res.status(400).json({ success: false, error: result.error });
        }
      } else if (activeProvider === "pawapay") {
        // Use PawaPay for deposit
        console.log(`[DEPOSIT] Using PawaPay for ${country}/${operator}`);
        const { otpCode } = req.body;
        const result = await handlePawaPayDeposit(
          req.session.userId!,
          user,
          providerAmount,
          country,
          operator,
          phone,
          providerCurrency,
          balanceAmount,
          userCurrency,
          otpCode
        );
        if (result.requiresOTP) {
          return res.json({
            success: false,
            requiresOTP: true,
            otpInstructions: result.otpInstructions,
            otpUssdCode: result.otpUssdCode,
            otpHint: result.otpHint,
            provider: "pawapay",
            error: result.error,
          });
        }
        if (result.success) {
          return res.json({
            success: true,
            transactionId: result.transactionId,
            message: result.message || "Demande de depot initiee. Validez sur votre telephone.",
            provider: "pawapay",
          });
        } else {
          return res.status(400).json({ success: false, error: result.error });
        }
      } else if (activeProvider === "feexpay") {
        // Use FeeXPay for deposit
        console.log(`[DEPOSIT] Using FeeXPay for ${country}/${operator}`);
        const { otpCode } = req.body;
        const result = await handleFeeXPayDeposit(
          req.session.userId!,
          user,
          providerAmount,
          country,
          operator,
          phone,
          otpCode,
          providerCurrency,
          balanceAmount,
          userCurrency
        );
        if (result.requiresOtp) {
          return res.json({
            success: false,
            error: result.error,
            requiresOTP: true,
            otpInstructions: result.otpInstructions,
            provider: "feexpay",
          });
        }
        if (result.success) {
          const response: Record<string, unknown> = {
            success: true,
            transactionId: result.transactionId,
            message: result.message || "Paiement initie avec succes. Validez sur votre telephone.",
            provider: "feexpay",
          };
          if (result.redirectUrl) {
            response.redirectUrl = result.redirectUrl;
          }
          return res.json(response);
        } else {
          return res.status(400).json({ success: false, error: result.error });
        }
      } else {
        return res.status(503).json({ 
          success: false, 
          error: "Fournisseur de paiement non supporte" 
        });
      }
    } catch (error: any) {
      console.error("[DEPOSIT] Error:", error);
      return res.status(500).json({ success: false, error: "Erreur lors du depot" });
    }
  });

  // Transfer/Withdrawal Route - Multi-Provider
  app.post("/api/fedapay/withdrawal", requireAuth, async (req: Request, res: Response) => {
    try {
      const { amount, country, operator, phone, type, securityCode, originalAmount, originalCurrency, targetCurrency: reqTargetCurrency } = req.body;
      const user = await storage.getUser(req.session.userId!);

      if (!user) {
        return res.status(404).json({ success: false, error: "Utilisateur non trouve" });
      }

      if (user.suspended) {
        return res.status(403).json({ success: false, error: "Votre compte a ete suspendu" });
      }

      if (type === "transfer" && user.transfersEnabled === false) {
        return res.status(403).json({ success: false, error: "Les transferts sont désactivés pour votre compte. Veuillez contacter le support." });
      }

      if (type !== "transfer" && user.withdrawalsEnabled === false) {
        return res.status(403).json({ success: false, error: "Les retraits sont désactivés pour votre compte. Veuillez contacter le support." });
      }

      if (user.kycStatus !== "verified") {
        return res.status(403).json({ success: false, error: "Verification KYC requise" });
      }

      // Validate security code for withdrawals (not transfers)
      if (type !== "transfer") {
        if (!securityCode) {
          return res.status(400).json({ success: false, error: "Code de securite requis" });
        }
        if (!user.securityCode) {
          return res.status(400).json({ success: false, error: "Code de securite non configure" });
        }
        const bcrypt = await import("bcrypt");
        const isValidCode = await bcrypt.compare(securityCode, user.securityCode);
        if (!isValidCode) {
          return res.status(400).json({ success: false, error: "Code de securite incorrect" });
        }
      }

      if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, error: "Montant invalide" });
      }

      // Get user's currency for minimum validation
      const userCurrencyForMin = user.country ? getCurrencyForCountry(user.country) : "XOF";
      
      // For cross-currency transfers, use originalAmount (in user's currency) for minimum validation
      // The 'amount' field may contain the converted amount for the provider
      const amountForValidation = originalAmount && originalCurrency === userCurrencyForMin 
        ? originalAmount 
        : amount;
      
      // Minimum amounts - special case for RDC (CD) with fixed CDF minimums
      const isTransferType = type === "transfer";
      let minAmountInUserCurrency: number;
      
      if (user.country === "CD") {
        // RDC users: fixed minimums in CDF
        minAmountInUserCurrency = isTransferType ? 2000 : 1000; // 2000 CDF transfer, 1000 CDF withdrawal
      } else {
        // Other users: minimums in XOF (500 transfer, 1000 withdrawal)
        minAmountInUserCurrency = isTransferType ? 500 : 1000;
      }
      
      console.log(`[WITHDRAWAL] User ${user.country}, amount=${amount}, originalAmount=${originalAmount}, amountForValidation=${amountForValidation}, min=${minAmountInUserCurrency}, type=${type}, isTransfer=${isTransferType}`);
      
      if (amountForValidation < minAmountInUserCurrency) {
        console.log(`[WITHDRAWAL] Amount ${amountForValidation} < minimum ${minAmountInUserCurrency} - rejecting`);
        return res.status(400).json({ 
          success: false, 
          error: `Montant minimum: ${minAmountInUserCurrency.toLocaleString("fr-FR")} ${userCurrencyForMin}` 
        });
      }

      if (!country || !operator || !phone) {
        return res.status(400).json({ success: false, error: "Pays, operateur et telephone requis" });
      }

      // Determine which provider to use
      const activeProvider = await getActiveProviderForWithdrawal(country, operator);
      
      if (!activeProvider) {
        console.log(`[WITHDRAWAL] No active provider found for ${country}/${operator}`);
        return res.status(503).json({ 
          success: false, 
          error: "Aucun fournisseur n'est configure pour les retraits vers ce pays et operateur" 
        });
      }

      // Get dynamic fees from database for the active provider
      const feeConfig = await getFeeFromDatabase(storage, activeProvider, country, operator);
      
      // Calculate fees with dynamic percentage
      const feeInfo = calculateOutgoingFee(Math.floor(amount), feeConfig.outgoing);

      const isTransfer = type === "transfer";

      // Calculer les frais d'échange AVANT baseRequired pour déterminer le modèle de frais
      const userCurrencyPre = user.country ? getCurrencyForCountry(user.country) : "XOF";
      let destCurrencyPre = reqTargetCurrency || getCurrencyForCountry(country?.toUpperCase() || "");
      if (!reqTargetCurrency && activeProvider === "pawapay") {
        try {
          const { getCurrencyForOperator: getOpCurrency } = await import("@shared/pawapay-countries");
          const pawaOpCurrency = getOpCurrency(country?.toUpperCase() || "", operator);
          if (pawaOpCurrency) destCurrencyPre = pawaOpCurrency;
        } catch (_) {}
      }
      const exchangeFeeResult = await getOutgoingExchangeFee(storage, userCurrencyPre, destCurrencyPre, Math.floor(amount), user.accountType || "personal");
      const preExchangeFee = exchangeFeeResult.feeAmount;
      console.log(`[WITHDRAWAL] Exchange fee calc: ${userCurrencyPre}→${destCurrencyPre}, amount=${Math.floor(amount)}, accountType=${user.accountType}, fee=${preExchangeFee}, pct=${exchangeFeeResult.feePercentage}`);

      // Modèle "frais par-dessus" (cumulatif) pour :
      //   - Tous les TRANSFERTS (type="transfer")
      //   - Les RETRAITS inter-devises (preExchangeFee > 0) : les deux frais s'additionnent
      // Modèle classique pour les RETRAITS en même devise : frais déduits du montant reçu
      const useFeeOnTopModel = isTransfer || preExchangeFee > 0;
      const baseRequired = useFeeOnTopModel
        ? (Math.floor(amount) + feeInfo.feeAmount)
        : feeInfo.totalDeductedFromBalance;

      const requiredBalance = baseRequired + preExchangeFee;

      // Check balance avec le bon montant selon le type
      if (user.balance < requiredBalance) {
        return res.status(400).json({ 
          success: false, 
          error: "Solde insuffisant" 
        });
      }

      // Get user's balance currency and target currency for provider
      const userCurrency = user.country ? getCurrencyForCountry(user.country) : "XOF";
      const targetCurrency = reqTargetCurrency || userCurrency;
      
      console.log(`[WITHDRAWAL] Using provider: ${activeProvider} for ${country}/${operator}, userCurrency=${userCurrency}, targetCurrency=${targetCurrency}`);

      if (activeProvider === "fedapay") {
        // Use FedaPay - pass user's currency for conversion
        const result = useFeeOnTopModel
          ? await handleFedaPayTransfer(req.session.userId!, user, amount, country, operator, phone, userCurrency)
          : await handleFedaPayWithdrawal(req.session.userId!, user, amount, country, operator, phone, userCurrency);

        if (result.success) {
          if (preExchangeFee > 0) {
            await storage.updateUserBalance(req.session.userId!, -preExchangeFee);
            console.log(`[TRANSFER fedapay] Exchange fee deducted: ${preExchangeFee} ${userCurrencyPre} (${userCurrencyPre}→${destCurrencyPre})`);
            if (result.transactionId) {
              try {
                const txToUpdate = await storage.getTransaction(result.transactionId);
                if (txToUpdate) {
                  const existingMeta = txToUpdate.metadata ? JSON.parse(txToUpdate.metadata) : {};
                  await storage.updateTransactionMetadata(result.transactionId, JSON.stringify({
                    ...existingMeta,
                    exchangeFee: preExchangeFee,
                    exchangeFeePercentage: exchangeFeeResult.feePercentage,
                    exchangeFeeFrom: userCurrencyPre,
                    exchangeFeeTo: destCurrencyPre,
                  }));
                }
              } catch (_) { /* best effort */ }
            }
          }
          // Si retrait inter-devises traité avec le handler Transfer, recorriger le type en DB
          if (!isTransfer && result.transactionId) {
            try {
              await storage.updateTransaction(result.transactionId, {
                type: "withdrawal",
                description: `Retrait de ${Math.floor(amount)} ${userCurrency}`,
              });
            } catch (_) { /* best effort */ }
          }
          return res.json({
            success: true,
            transactionId: result.transactionId,
            message: result.message,
          });
        } else {
          return res.status(400).json({ success: false, error: result.error });
        }
      } else if (activeProvider === "paydunya") {
        // Use Paydunya Disburse API for withdrawals/transfers
        console.log(`[WITHDRAWAL] Using Paydunya Disburse for ${country}/${operator}`);

        // Map operator to Paydunya withdraw_mode
        const withdrawModeMap: Record<string, string> = {
          "orange-sn": "orange-money-senegal", "free-sn": "free-money-senegal", "expresso-sn": "expresso-senegal",
          "wave-sn": "wave-senegal", "wizall-sn": "wizall-senegal",
          "orange-ci": "orange-money-ci", "mtn-ci": "mtn-ci", "moov-ci": "moov-ci", "wave-ci": "wave-ci",
          "orange-bf": "orange-money-burkina", "moov-bf": "moov-burkina-faso",
          "moov-bj": "moov-benin", "mtn-bj": "mtn-benin",
          "tmoney-tg": "t-money-togo", "moov-tg": "moov-togo",
          "orange-ml": "orange-money-mali", "moov-ml": "moov-mali",
          "mtn-cm": "mtn-cameroun",
        };

        const withdrawMode = withdrawModeMap[`${operator}-${country.toLowerCase()}`];
        if (!withdrawMode) {
          return res.status(400).json({ success: false, error: "Operateur non supporte pour les retraits Paydunya" });
        }

        // Clean phone number (remove country prefix)
        let cleanPhone = phone.replace(/[\s\-\.]+/g, "");
        if (!/^\+?\d+$/.test(cleanPhone)) {
          return res.status(400).json({ success: false, error: "Numero de telephone invalide" });
        }

        const countryPhoneInfo: Record<string, { code: string, localLength: number[] }> = {
          "SN": { code: "221", localLength: [9] }, "CI": { code: "225", localLength: [10] },
          "BF": { code: "226", localLength: [8] }, "BJ": { code: "229", localLength: [8, 10] },
          "TG": { code: "228", localLength: [8] }, "ML": { code: "223", localLength: [8] },
          "CM": { code: "237", localLength: [9] },
        };

        const phoneInfo = countryPhoneInfo[country.toUpperCase()];
        if (phoneInfo) {
          const prefixes = [`+${phoneInfo.code}`, `00${phoneInfo.code}`];
          for (const prefix of prefixes) {
            if (cleanPhone.startsWith(prefix)) {
              cleanPhone = cleanPhone.substring(prefix.length);
              break;
            }
          }
          if (cleanPhone.startsWith(phoneInfo.code)) {
            const withoutCode = cleanPhone.substring(phoneInfo.code.length);
            if (phoneInfo.localLength.includes(withoutCode.length)) {
              cleanPhone = withoutCode;
            }
          }
        }

        const callbackUrl = `${process.env.BASE_URL || 'https://bkapay.com'}/api/webhooks/paydunya-disburse`;

        // Logique différente pour transfert vs retrait
        // TRANSFERT: L'utilisateur écrit 1000 → débité 1060 → fournisseur reçoit 1000 → destinataire reçoit 1000
        // RETRAIT: L'utilisateur écrit 1000 → débité 1000 → fournisseur reçoit 940 → utilisateur reçoit 940
        const payduynaCountryCurrencies6021: Record<string, string> = { "CM": "XAF" };
        const providerCurrency = payduynaCountryCurrencies6021[country.toUpperCase()] || "XOF";
        const amountInUserCurrency = useFeeOnTopModel ? Math.floor(amount) : feeInfo.amountReceived;
        const baseAmountToDebit = useFeeOnTopModel ? (Math.floor(amount) + feeInfo.feeAmount) : feeInfo.totalDeductedFromBalance;

        // Utilise preExchangeFee (bidirectionnel, calculé ligne ~8103 via getOutgoingExchangeFee)
        const outgoingExchangeFeeForFedapay = preExchangeFee;
        const amountToDebit = baseAmountToDebit + outgoingExchangeFeeForFedapay;

        // CRITICAL: Convert amount from user's currency to provider currency if different
        let amountForProvider = amountInUserCurrency;
        if (userCurrency !== providerCurrency) {
          const { convertCurrency } = await import("./currency-converter");
          const conversionResult = await convertCurrency(amountInUserCurrency, userCurrency, providerCurrency);
          if (conversionResult.success) {
            amountForProvider = Math.floor(conversionResult.convertedAmount);
            console.log(`[WITHDRAWAL PAYDUNYA] Currency conversion: ${amountInUserCurrency} ${userCurrency} -> ${amountForProvider} ${providerCurrency}`);
          } else {
            console.error("[WITHDRAWAL PAYDUNYA] Currency conversion failed:", conversionResult.error);
            return res.status(500).json({ success: false, error: "Erreur de conversion de devise" });
          }
        }

        // Step 1: Deduct balance and create transaction in pending state immediately
        await storage.updateUserBalance(req.session.userId!, -amountToDebit);
        const tx = await storage.createTransaction({
          userId: req.session.userId!,
          type: isTransfer ? "transfer" : "withdrawal",
          amount: Math.floor(amount),
          fee: feeInfo.feeAmount,
          feePercentage: feeInfo.feePercentage,
          currency: userCurrency,
          status: "pending",
          country,
          operator,
          customerPhone: cleanPhone,
          description: isTransfer
            ? `Transfert de ${Math.floor(amount)} ${userCurrency} (envoye: ${amountForProvider} ${providerCurrency})`
            : `Retrait de ${Math.floor(amount)} ${userCurrency} (recu: ${amountForProvider} ${providerCurrency})`,
          metadata: JSON.stringify({
            provider: "paydunya",
            providerAmount: amountForProvider,
            providerCurrency: providerCurrency,
            balanceAmount: Math.floor(amount),
            balanceCurrency: userCurrency,
            amountDebitedFromBalance: amountToDebit,
            deductedFromBalance: amountToDebit,
            ...(outgoingExchangeFeeForFedapay > 0 ? { outgoingExchangeFee: outgoingExchangeFeeForFedapay, outgoingExchangeFeeCurrency: userCurrency } : {}),
          }),
        });

        console.log(`[${isTransfer ? 'TRANSFER' : 'WITHDRAWAL'} PAYDUNYA] Pending tx ${tx.id} created, balance deducted: ${amountToDebit} ${userCurrency} - dispatching to provider in 5s`);

        // Step 2: Send to Paydunya 5s after debit (ensures funds are secured before dispatch)
        setTimeout(async () => {
          try {
            const getInvoiceData = {
              account_alias: cleanPhone,
              amount: amountForProvider,
              withdraw_mode: withdrawMode,
              callback_url: callbackUrl,
            };
            console.log(`[${isTransfer ? 'TRANSFER' : 'WITHDRAWAL'} PAYDUNYA] Dispatching to provider for tx ${tx.id}:`, getInvoiceData);
            const getInvoiceResponse = await callPaydunyaAPIv2("/disburse/get-invoice", getInvoiceData);
            console.log(`[${isTransfer ? 'TRANSFER' : 'WITHDRAWAL'} PAYDUNYA] Get-invoice response for ${tx.id}:`, getInvoiceResponse);

            if (getInvoiceResponse.response_code !== "00" || !getInvoiceResponse.disburse_token) {
              console.error(`[${isTransfer ? 'TRANSFER' : 'WITHDRAWAL'} PAYDUNYA] Get-invoice failed for ${tx.id} - refunding`);
              await safeRefundOutgoingTransaction(tx.id, req.session.userId!, {}, "paydunya-get-invoice-failed");
              await sendBusinessWebhookCallback(tx.id, "failed", "payout");
              return;
            }

            const disburseId = `${type || 'withdrawal'}-${user.id.substring(0, 8)}-${Date.now()}`;
            const submitData = { disburse_invoice: getInvoiceResponse.disburse_token, disburse_id: disburseId };
            console.log(`[${isTransfer ? 'TRANSFER' : 'WITHDRAWAL'} PAYDUNYA] Submitting invoice for ${tx.id}:`, submitData);
            const submitResponse = await callPaydunyaAPIv2("/disburse/submit-invoice", submitData);
            console.log(`[${isTransfer ? 'TRANSFER' : 'WITHDRAWAL'} PAYDUNYA] Submit response for ${tx.id}:`, submitResponse);

            if (submitResponse.response_code === "00") {
              // Update transaction with provider token + mark completed (Paydunya is synchronous)
              await storage.updateTransactionMetadata(tx.id, JSON.stringify({
                provider: "paydunya",
                paydunyaTransactionId: submitResponse.transaction_id,
                disburseId,
                providerAmount: amountForProvider,
                providerCurrency,
                balanceAmount: Math.floor(amount),
                balanceCurrency: userCurrency,
                amountDebitedFromBalance: amountToDebit,
                deductedFromBalance: amountToDebit,
                ...(outgoingExchangeFeeForFedapay > 0 ? { outgoingExchangeFee: outgoingExchangeFeeForFedapay, outgoingExchangeFeeCurrency: userCurrency } : {}),
              }));
              await storage.updateTransaction(tx.id, { paydunyaToken: getInvoiceResponse.disburse_token });
              await storage.updateTransactionStatus(tx.id, "completed");
              console.log(`[${isTransfer ? 'TRANSFER' : 'WITHDRAWAL'} PAYDUNYA] ✅ tx ${tx.id} COMPLETED`);
              await sendBusinessWebhookCallback(tx.id, "completed", "payout");
            } else {
              console.error(`[${isTransfer ? 'TRANSFER' : 'WITHDRAWAL'} PAYDUNYA] Submit-invoice failed for ${tx.id} - refunding:`, submitResponse);
              await safeRefundOutgoingTransaction(tx.id, req.session.userId!, {}, "paydunya-submit-failed");
              await sendBusinessWebhookCallback(tx.id, "failed", "payout");
            }
          } catch (dispatchErr) {
            console.error(`[${isTransfer ? 'TRANSFER' : 'WITHDRAWAL'} PAYDUNYA] Dispatch error for ${tx.id}:`, dispatchErr);
            await safeRefundOutgoingTransaction(tx.id, req.session.userId!, {}, "paydunya-dispatch-error");
            await sendBusinessWebhookCallback(tx.id, "failed", "payout");
          }
        }, 5000);

        return res.json({
          success: true,
          transactionId: tx.id,
          message: isTransfer ? "Transfert initié avec succès" : "Retrait initié avec succès",
          totalDeducted: amountToDebit,
          status: "pending",
        });
      } else if (activeProvider === "mbiyopay") {
        // Use MbiyoPay for withdrawals/transfers - pass user's balance currency and target currency
        console.log(`[WITHDRAWAL] Using MbiyoPay for ${country}/${operator}, userCurrency=${userCurrency}, targetCurrency=${targetCurrency}`);
        
        const result = useFeeOnTopModel
          ? await handleMbiyoPayTransfer(req.session.userId!, user, amount, country, operator, phone, userCurrency, targetCurrency)
          : await handleMbiyoPayWithdrawal(req.session.userId!, user, amount, country, operator, phone, userCurrency, targetCurrency);

        if (result.success) {
          if (preExchangeFee > 0) {
            await storage.updateUserBalance(req.session.userId!, -preExchangeFee);
            console.log(`[TRANSFER mbiyopay] Exchange fee deducted: ${preExchangeFee} ${userCurrencyPre} (${userCurrencyPre}→${destCurrencyPre})`);
            if (result.transactionId) {
              try {
                const txToUpdate = await storage.getTransaction(result.transactionId);
                if (txToUpdate) {
                  const existingMeta = txToUpdate.metadata ? JSON.parse(txToUpdate.metadata) : {};
                  await storage.updateTransactionMetadata(result.transactionId, JSON.stringify({
                    ...existingMeta,
                    exchangeFee: preExchangeFee,
                    exchangeFeePercentage: exchangeFeeResult.feePercentage,
                    exchangeFeeFrom: userCurrencyPre,
                    exchangeFeeTo: destCurrencyPre,
                  }));
                }
              } catch (_) { /* best effort */ }
            }
          }
          if (!isTransfer && result.transactionId) {
            try {
              await storage.updateTransaction(result.transactionId, {
                type: "withdrawal",
                description: `Retrait de ${Math.floor(amount)} ${userCurrency}`,
              });
            } catch (_) { /* best effort */ }
          }
          return res.json({
            success: true,
            transactionId: result.transactionId,
            message: result.message || (isTransfer ? "Transfert effectue avec succes" : "Retrait effectue avec succes"),
            provider: "mbiyopay",
          });
        } else {
          return res.status(400).json({ success: false, error: result.error });
        }
      } else if (activeProvider === "afribapay") {
        // Use AfribaPay for withdrawals/transfers
        console.log(`[WITHDRAWAL] Using AfribaPay for ${country}/${operator}, userCurrency=${userCurrency}`);
        
        const result = useFeeOnTopModel
          ? await handleAfribaPayTransfer(req.session.userId!, user, amount, country, operator, phone, userCurrency)
          : await handleAfribaPayWithdrawal(req.session.userId!, user, amount, country, operator, phone, userCurrency);

        if (result.success) {
          if (preExchangeFee > 0) {
            await storage.updateUserBalance(req.session.userId!, -preExchangeFee);
            console.log(`[TRANSFER afribapay] Exchange fee deducted: ${preExchangeFee} ${userCurrencyPre} (${userCurrencyPre}→${destCurrencyPre})`);
            if (result.transactionId) {
              try {
                const txToUpdate = await storage.getTransaction(result.transactionId);
                if (txToUpdate) {
                  const existingMeta = txToUpdate.metadata ? JSON.parse(txToUpdate.metadata) : {};
                  await storage.updateTransactionMetadata(result.transactionId, JSON.stringify({
                    ...existingMeta,
                    exchangeFee: preExchangeFee,
                    exchangeFeePercentage: exchangeFeeResult.feePercentage,
                    exchangeFeeFrom: userCurrencyPre,
                    exchangeFeeTo: destCurrencyPre,
                  }));
                }
              } catch (_) { /* best effort */ }
            }
          }
          if (!isTransfer && result.transactionId) {
            try {
              await storage.updateTransaction(result.transactionId, {
                type: "withdrawal",
                description: `Retrait de ${Math.floor(amount)} ${userCurrency}`,
              });
            } catch (_) { /* best effort */ }
          }
          return res.json({
            success: true,
            transactionId: result.transactionId,
            message: result.message || (isTransfer ? "Transfert en cours de traitement" : "Retrait en cours de traitement"),
            provider: "afribapay",
          });
        } else {
          return res.status(400).json({ success: false, error: result.error });
        }
      } else if (activeProvider === "moneyfusion") {
        console.log(`[WITHDRAWAL] Using MoneyFusion for ${country}/${operator}, userCurrency=${userCurrency}`);
        
        const result = useFeeOnTopModel
          ? await handleMoneyFusionTransfer(req.session.userId!, user, amount, country, operator, phone, userCurrency)
          : await handleMoneyFusionWithdrawal(req.session.userId!, user, amount, country, operator, phone, userCurrency);

        if (result.success) {
          if (preExchangeFee > 0) {
            await storage.updateUserBalance(req.session.userId!, -preExchangeFee);
            console.log(`[TRANSFER moneyfusion] Exchange fee deducted: ${preExchangeFee} ${userCurrencyPre} (${userCurrencyPre}→${destCurrencyPre})`);
            if (result.transactionId) {
              try {
                const txToUpdate = await storage.getTransaction(result.transactionId);
                if (txToUpdate) {
                  const existingMeta = txToUpdate.metadata ? JSON.parse(txToUpdate.metadata) : {};
                  await storage.updateTransactionMetadata(result.transactionId, JSON.stringify({
                    ...existingMeta,
                    exchangeFee: preExchangeFee,
                    exchangeFeePercentage: exchangeFeeResult.feePercentage,
                    exchangeFeeFrom: userCurrencyPre,
                    exchangeFeeTo: destCurrencyPre,
                  }));
                }
              } catch (_) { /* best effort */ }
            }
          }
          if (!isTransfer && result.transactionId) {
            try {
              await storage.updateTransaction(result.transactionId, {
                type: "withdrawal",
                description: `Retrait de ${Math.floor(amount)} ${userCurrency}`,
              });
            } catch (_) { /* best effort */ }
          }
          return res.json({
            success: true,
            transactionId: result.transactionId,
            message: result.message || (isTransfer ? "Transfert en cours de traitement" : "Retrait en cours de traitement"),
          });
        } else {
          return res.status(400).json({ success: false, error: result.error });
        }
      } else if (activeProvider === "pawapay") {
        console.log(`[WITHDRAWAL] Using PawaPay for ${country}/${operator}, userCurrency=${userCurrency}`);

        const result = useFeeOnTopModel
          ? await handlePawaPayTransfer(req.session.userId!, user, amount, country, operator, phone, userCurrency, targetCurrency)
          : await handlePawaPayWithdrawal(req.session.userId!, user, amount, country, operator, phone, userCurrency, targetCurrency);

        if (result.success) {
          if (preExchangeFee > 0) {
            await storage.updateUserBalance(req.session.userId!, -preExchangeFee);
            console.log(`[TRANSFER pawapay] Exchange fee deducted: ${preExchangeFee} ${userCurrencyPre} (${userCurrencyPre}→${destCurrencyPre})`);
            // Add exchange fee to transaction metadata for visibility in history
            if (result.transactionId) {
              try {
                const txToUpdate = await storage.getTransaction(result.transactionId);
                if (txToUpdate) {
                  const existingMeta = txToUpdate.metadata ? JSON.parse(txToUpdate.metadata) : {};
                  await storage.updateTransactionMetadata(result.transactionId, JSON.stringify({
                    ...existingMeta,
                    exchangeFee: preExchangeFee,
                    exchangeFeePercentage: Math.round((preExchangeFee / Math.floor(amount)) * 1000),
                    exchangeFeeFrom: userCurrencyPre,
                    exchangeFeeTo: destCurrencyPre,
                    totalDebited: (existingMeta.totalDebited || (Math.floor(amount) + (existingMeta.fee || 0))) + preExchangeFee,
                  }));
                }
              } catch (_) { /* best effort */ }
            }
          }
          if (!isTransfer && result.transactionId) {
            try {
              await storage.updateTransaction(result.transactionId, {
                type: "withdrawal",
                description: `Retrait de ${Math.floor(amount)} ${userCurrency}`,
              });
            } catch (_) { /* best effort */ }
          }
          return res.json({
            success: true,
            transactionId: result.transactionId,
            message: result.message || (isTransfer ? "Transfert en cours de traitement." : "Retrait en cours de traitement."),
            provider: "pawapay",
          });
        } else {
          return res.status(400).json({ success: false, error: result.error });
        }
      } else if (activeProvider === "feexpay") {
        console.log(`[WITHDRAWAL] Using FeeXPay for ${country}/${operator}, userCurrency=${userCurrency}`);

        const result = useFeeOnTopModel
          ? await handleFeeXPayTransfer(req.session.userId!, user, amount, country, operator, phone, userCurrency)
          : await handleFeeXPayWithdrawal(req.session.userId!, user, amount, country, operator, phone, userCurrency);

        if (result.success) {
          if (preExchangeFee > 0) {
            await storage.updateUserBalance(req.session.userId!, -preExchangeFee);
            console.log(`[TRANSFER feexpay] Exchange fee deducted: ${preExchangeFee} ${userCurrencyPre} (${userCurrencyPre}→${destCurrencyPre})`);
            if (result.transactionId) {
              try {
                const txToUpdate = await storage.getTransaction(result.transactionId);
                if (txToUpdate) {
                  const existingMeta = txToUpdate.metadata ? JSON.parse(txToUpdate.metadata) : {};
                  await storage.updateTransactionMetadata(result.transactionId, JSON.stringify({
                    ...existingMeta,
                    exchangeFee: preExchangeFee,
                    exchangeFeePercentage: exchangeFeeResult.feePercentage,
                    exchangeFeeFrom: userCurrencyPre,
                    exchangeFeeTo: destCurrencyPre,
                  }));
                }
              } catch (_) { /* best effort */ }
            }
          }
          if (!isTransfer && result.transactionId) {
            try {
              await storage.updateTransaction(result.transactionId, {
                type: "withdrawal",
                description: `Retrait de ${Math.floor(amount)} ${userCurrency}`,
              });
            } catch (_) { /* best effort */ }
          }
          return res.json({
            success: true,
            transactionId: result.transactionId,
            message: result.message || (isTransfer ? "Transfert en cours de traitement." : "Retrait en cours de traitement."),
            provider: "feexpay",
          });
        } else {
          return res.status(400).json({ success: false, error: result.error });
        }
      } else {
        return res.status(503).json({ 
          success: false, 
          error: "Fournisseur de paiement non supporte" 
        });
      }
    } catch (error: any) {
      console.error("[WITHDRAWAL] Error:", error);
      const errorMsg = req.body?.type === "transfer" ? "Transfert echoue" : "Retrait echoue";
      return res.status(500).json({ success: false, error: errorMsg });
    }
  });

  // Payment Link Route - Multi-Provider
  app.post("/api/fedapay/payment-link/:token", async (req: Request, res: Response) => {
    try {
      const { customerName, customerEmail, customerPhone, country, operator, currency, customFieldResponses, otpCode } = req.body;
      const { token } = req.params;

      const paymentLink = await storage.getPaymentLinkByToken(token);
      if (!paymentLink || !paymentLink.isActive) {
        return res.status(404).json({ success: false, error: "Lien de paiement non trouve ou inactif" });
      }

      const owner = await storage.getUser(paymentLink.userId);
      if (owner?.suspended) {
        return res.status(404).json({ success: false, error: "Ce lien n'existe pas" });
      }

      // Wave payin activation check (on behalf of the merchant)
      if (operator && operator.toLowerCase() === "wave" && !owner?.wavePayinEnabled) {
        return res.status(403).json({ success: false, error: "Le wave de votre marchand n'est pas activée" });
      }

      // Get owner's currency and payer's currency for cross-currency conversion
      // IMPORTANT: Use currency from request if provided (for multi-currency countries like RDC)
      const ownerCurrency = owner?.country ? getCurrencyForCountry(owner.country) : "XOF";
      const payerCurrency = currency || getCurrencyForCountry(country);
      
      // Convert amount if currencies are different
      let amountInPayerCurrency = paymentLink.amount;
      let conversionRate = 1;
      let conversionApplied = false;
      
      if (ownerCurrency !== payerCurrency) {
        const conversionResult = await convertCurrency(paymentLink.amount, ownerCurrency, payerCurrency);
        if (conversionResult.success) {
          amountInPayerCurrency = conversionResult.convertedAmount;
          conversionRate = conversionResult.conversionRate;
          conversionApplied = true;
          console.log(`[PAYMENT_LINK] Currency conversion: ${paymentLink.amount} ${ownerCurrency} -> ${amountInPayerCurrency} ${payerCurrency} (rate: ${conversionRate})`);
        } else {
          console.error(`[PAYMENT_LINK] Currency conversion failed: ${conversionResult.error}`);
          return res.status(400).json({ success: false, error: "Erreur de conversion de devise" });
        }
      }

      const activeProvider = await getActiveProviderForDeposit(country, operator);
      
      if (!activeProvider) {
        return res.status(503).json({ 
          success: false, 
          error: "Aucun fournisseur configure pour ce pays et operateur" 
        });
      }

      if (activeProvider === "fedapay") {
        // Pass converted amount and owner currency to handler
        const paymentLinkWithCurrency = { ...paymentLink, ownerCurrency };
        const result = await handlePaymentLinkPayment(
          paymentLinkWithCurrency,
          customerName || "Client",
          customerEmail || null, // Real email saved in database
          customerPhone,
          country,
          operator,
          amountInPayerCurrency, // converted amount for provider
          payerCurrency, // provider's currency
          customFieldResponses || undefined,
          owner?.accountType
        );

        if (result.success) {
          return res.json({
            success: true,
            transactionId: result.transactionId,
            message: result.message,
          });
        } else {
          return res.status(400).json({ success: false, error: result.error });
        }
      } else if (activeProvider === "paydunya") {
        // Use Paydunya SOFTPAY for payment links
        console.log(`[PAYMENT_LINK] Using Paydunya SOFTPAY for ${country}/${operator}`);
        
        const effectiveCustomerName = customerName || "Client";
        
        // CRITICAL: Calculate fees on OWNER's amount (paymentLink.amount in owner's currency)
        // NOT on the converted payer amount. This ensures netAmountForUser is in owner's currency.
        let feeAmount: number;
        let feePercentage: number;
        let netAmountForUser: number;
        
        // Get dynamic fee configuration from database (auto-detect active provider)
        const apiLinkFeeConfig = await getDynamicFees(storage, country, operator);
        
        if (paymentLink.customerPaysFee) {
          const feeInfo = calculateCustomerPaysFee(paymentLink.amount, apiLinkFeeConfig.incoming);
          feeAmount = feeInfo.feeAmount;
          feePercentage = feeInfo.feePercentage;
          netAmountForUser = paymentLink.amount; // User receives full base amount in their currency
        } else {
          const feeInfo = calculateIncomingFee(paymentLink.amount, apiLinkFeeConfig.incoming);
          feeAmount = feeInfo.feeAmount;
          feePercentage = feeInfo.feePercentage;
          netAmountForUser = feeInfo.netAmount; // User receives base - fee in their currency
        }

        // Exchange fee when payer's currency differs from merchant's balance currency (personal accounts only)
        if (conversionApplied) {
          const { feeAmount: xFee, feePercentage: xFeePct } =
            await getIncomingExchangeFee(storage, paymentLink.amount, payerCurrency, ownerCurrency, owner?.accountType);
          if (xFee > 0) {
            netAmountForUser = Math.max(0, netAmountForUser - xFee);
            feeAmount += xFee;
            feePercentage += xFeePct;
          }
        }
        
        // Calculate provider amount in payer's currency
        // If customerPaysFee: provider collects converted(baseAmount + fee)
        // If user pays fee: provider collects converted(baseAmount)
        let amountForProvider: number;
        if (conversionApplied) {
          if (paymentLink.customerPaysFee) {
            // Convert total (base + fee) to payer's currency
            const totalInOwnerCurrency = paymentLink.amount + feeAmount;
            const totalConversion = await convertCurrency(totalInOwnerCurrency, ownerCurrency, payerCurrency);
            amountForProvider = totalConversion.success ? Math.floor(totalConversion.convertedAmount) : Math.floor(amountInPayerCurrency * (1 + (apiLinkFeeConfig.incoming / 1000)));
          } else {
            amountForProvider = Math.floor(amountInPayerCurrency); // Just the base amount converted
          }
        } else {
          if (paymentLink.customerPaysFee) {
            const feeInfo = calculateCustomerPaysFee(paymentLink.amount, apiLinkFeeConfig.incoming);
            amountForProvider = feeInfo.totalForProvider;
          } else {
            amountForProvider = paymentLink.amount;
          }
        }
        
        console.log(`[PAYMENT_LINK] Paydunya fees: baseAmount=${paymentLink.amount} ${ownerCurrency}, netForUser=${netAmountForUser} ${ownerCurrency}, providerAmount=${amountForProvider} ${payerCurrency}, customerPaysFee=${paymentLink.customerPaysFee}`);
        
        const paydunyaData = {
          invoice: {
            total_amount: Math.floor(amountForProvider),
            description: paymentLink.description || `Paiement de ${paymentLink.amount} ${ownerCurrency}`,
            customer: {
              name: effectiveCustomerName,
              email: "noreply@bkapay.com",
              phone: customerPhone,
            },
          },
          store: {
            name: "BKApay",
          },
          custom_data: {
            user_id: paymentLink.userId,
            payment_link_id: paymentLink.id,
            type: "payment_link",
            country,
            operator,
            phone: customerPhone,
            customerPaysFee: paymentLink.customerPaysFee,
          },
          actions: {
            callback_url: `${process.env.BASE_URL || 'https://bkapay.com'}/api/webhooks/paydunya`,
          },
        };

        const paydunyaResponse = await callPaydunyaAPI("/checkout-invoice/create", paydunyaData);

        if (paydunyaResponse.response_code === "00" && paydunyaResponse.token) {
          const transactionId = randomUUID();
          await storage.createTransaction({
            userId: paymentLink.userId,
            type: "payment_link",
            amount: paymentLink.amount, // Store in OWNER's currency
            fee: feeAmount,
            feePercentage: feePercentage,
            currency: ownerCurrency, // Owner's currency for correct balance credit
            status: "pending",
            country,
            operator,
            description: paymentLink.description || `Paiement via lien`,
            customerName: effectiveCustomerName,
            customerEmail: customerEmail || null,
            customerPhone: customerPhone || null,
            paydunyaToken: paydunyaResponse.token,
            metadata: JSON.stringify({
              phone: customerPhone,
              customerName: effectiveCustomerName,
              provider: "paydunya",
              paymentLinkId: paymentLink.id,
              customerPaysFee: paymentLink.customerPaysFee,
              originalAmount: paymentLink.amount,
              originalCurrency: ownerCurrency,
              providerAmount: amountForProvider,
              providerCurrency: payerCurrency,
              convertedAmount: amountInPayerCurrency,
              conversionRate: conversionRate,
              conversionApplied: conversionApplied,
              netAmountForUser: netAmountForUser, // In OWNER's currency
              balanceAmount: netAmountForUser,
              balanceCurrency: ownerCurrency,
              ...(customFieldResponses ? { customFieldResponses } : {}),
            }),
          });

          const operatorKey = getOperatorKey(operator, country);
          const needsOTP = operatorKey ? requiresOTP(operatorKey) : false;
          const twoStep = operatorKey ? requiresTwoStep(operatorKey) : false;

          if (!needsOTP && !twoStep && operatorKey) {
            const paymentData: SoftpayPaymentData = {
              customerName: effectiveCustomerName,
              customerEmail: "noreply@bkapay.com",
              phoneNumber: customerPhone,
              invoiceToken: paydunyaResponse.token,
            };

            const softpayResult = await callPaydunyaSoftpay(operator, country, paymentData);

            if (softpayResult.success) {
              return res.json({
                success: true,
                transactionId,
                token: paydunyaResponse.token,
                message: softpayResult.message || "Validez le paiement sur votre telephone",
                redirectUrl: softpayResult.url,
                omUrl: softpayResult.omUrl,
                maxitUrl: softpayResult.maxitUrl,
                provider: "paydunya",
              });
            } else {
              return res.status(400).json({ 
                success: false, 
                error: softpayResult.message || "Erreur lors du paiement" 
              });
            }
          }

          return res.json({
            success: true,
            transactionId,
            token: paydunyaResponse.token,
            message: "Suivez les instructions pour valider le paiement",
            provider: "paydunya",
          });
        } else {
          return res.status(400).json({ 
            success: false, 
            error: paydunyaResponse.response_text || "Erreur lors de la creation de la facture" 
          });
        }
      } else if (activeProvider === "mbiyopay") {
        // Use MbiyoPay for payment links with cross-currency support
        console.log(`[PAYMENT_LINK] Using MbiyoPay for ${country}/${operator}`);
        const { otpCode } = req.body;
        
        const needsOtp = mbiyoPayOperatorRequiresOtp(country, operator);
        if (needsOtp && !otpCode) {
          const otpInfo = getMbiyoPayOtpInstructions(country, amountForProvider);
          return res.json({
            success: false,
            requiresOTP: true,
            otpInstructions: otpInfo.instructions,
            otpUssdCode: otpInfo.ussdCode,
            otpHint: otpInfo.hint,
            provider: "mbiyopay",
            error: "Code OTP requis pour Orange Money",
          });
        }
        
        const result = await handleMbiyoPayPaymentLink(
          paymentLink,
          customerPhone,
          customerName || "Client",
          customerEmail || "",
          operator,
          country,
          amountInPayerCurrency,
          payerCurrency,
          ownerCurrency,
          otpCode,
          owner?.accountType,
          customFieldResponses || undefined
        );

        if (result.success) {
          return res.json({
            success: true,
            transactionId: result.transactionId,
            mbiyopayTransactionId: result.mbiyopayTransactionId,
            redirectUrl: result.redirectUrl,
            instructions: result.instructions,
            message: result.message || "Demande de paiement envoyee",
            provider: "mbiyopay",
            authMode: result.authMode ?? null,
          });
        } else {
          return res.status(400).json({ success: false, error: result.error });
        }
      } else if (activeProvider === "afribapay") {
        // Use AfribaPay for payment links
        console.log(`[PAYMENT_LINK] Using AfribaPay for ${country}/${operator}`);
        const { otpCode } = req.body;
        
        const result = await handleAfribaPayPaymentLink(
          paymentLink,
          amountInPayerCurrency,
          customerPhone,
          country,
          operator,
          otpCode,
          customerName || "Client",
          customerEmail || null,
          customFieldResponses || undefined,
          paymentLink.customerPaysFee ?? false
        );

        if (result.requiresOtp) {
          const { getOtpUssdCode } = await import("@shared/afribapay-countries");
          return res.status(400).json({
            success: false,
            error: result.error,
            requiresOTP: true,
            otpInstructions: result.otpInstructions,
            otpUssdCode: getOtpUssdCode(country, operator) || undefined,
          });
        }

        if (result.success) {
          return res.json({
            success: true,
            transactionId: result.transactionId,
            redirectUrl: result.providerLink,
            message: result.message || "Paiement initie avec succes",
            provider: "afribapay",
          });
        } else {
          return res.status(400).json({ success: false, error: result.error });
        }
      } else if (activeProvider === "pawapay") {
        console.log(`[PAYMENT_LINK] Using PawaPay for ${country}/${operator}`);
        const { otpCode } = req.body;
        const result = await handlePawaPayDeposit(
          paymentLink.userId,
          owner!,
          amountInPayerCurrency,
          country,
          operator,
          customerPhone,
          payerCurrency,
          ownerCurrency !== payerCurrency ? paymentLink.amount : undefined,
          ownerCurrency !== payerCurrency ? ownerCurrency : undefined,
          otpCode,
          {
            transactionType: "payment_link",
            transactionDescription: `Paiement - ${paymentLink.productName}`,
            customerName: customerName || undefined,
            customerEmail: customerEmail || undefined,
            customerPaysFee: paymentLink.customerPaysFee ?? false,
            extraMetadata: { paymentLinkId: paymentLink.id, ...(customFieldResponses ? { customFieldResponses } : {}) },
          }
        );
        if (result.requiresOTP) {
          return res.json({
            success: false,
            requiresOTP: true,
            otpInstructions: result.otpInstructions,
            otpUssdCode: result.otpUssdCode,
            otpHint: result.otpHint,
            provider: "pawapay",
            error: result.error,
          });
        }
        if (result.success) {
          return res.json({
            success: true,
            transactionId: result.transactionId,
            message: result.message || "Paiement initié. Validez sur votre téléphone.",
            provider: "pawapay",
          });
        } else {
          return res.status(400).json({ success: false, error: result.error });
        }
      } else if (activeProvider === "feexpay") {
        console.log(`[PAYMENT_LINK] Using FeeXPay for ${country}/${operator}`);
        const effectiveCustomerName = customerName || "Client";
        const result = await handleFeeXPayDeposit(
          paymentLink.userId,
          owner!,
          Math.floor(amountInPayerCurrency),
          country,
          operator,
          customerPhone,
          otpCode,
          payerCurrency,
          paymentLink.amount,
          ownerCurrency,
          {
            transactionType: "payment_link",
            transactionDescription: paymentLink.description || `Paiement - ${paymentLink.productName}`,
            customerName: effectiveCustomerName,
            customerEmail: customerEmail || undefined,
            customerPaysFee: paymentLink.customerPaysFee ?? false,
            extraMetadata: {
              paymentLinkId: paymentLink.id,
              providerCurrency: payerCurrency,
              conversionRate,
              conversionApplied,
              ...(customFieldResponses ? { customFieldResponses } : {}),
            },
          }
        );
        if (result.requiresOtp) {
          return res.json({
            success: false,
            requiresOTP: true,
            otpInstructions: result.otpInstructions,
            provider: "feexpay",
            error: result.error,
          });
        }
        if (result.success) {
          return res.json({
            success: true,
            transactionId: result.transactionId,
            message: result.message || "Paiement initie. Validez sur votre telephone.",
            provider: "feexpay",
            ...(result.redirectUrl ? { redirectUrl: result.redirectUrl } : {}),
          });
        } else {
          return res.status(400).json({ success: false, error: result.error });
        }
      } else {
        return res.status(503).json({
          success: false,
          error: "Fournisseur de paiement non supporte",
        });
      }
    } catch (error: any) {
      console.error("[PAYMENT_LINK_FEDAPAY] Error:", error);
      return res.status(500).json({ success: false, error: "Erreur lors du paiement" });
    }
  });

  // Merchant Link Route - Multi-Provider
  app.post("/api/fedapay/merchant-link/:token", async (req: Request, res: Response) => {
    try {
      const { customerName, customerEmail, customerPhone, amount, country, operator, currency, originalAmount, originalCurrency, otpCode } = req.body;
      const { token } = req.params;

      const merchantLink = await storage.getMerchantLinkByToken(token);
      if (!merchantLink || !merchantLink.isActive) {
        return res.status(404).json({ success: false, error: "Lien marchand non trouve ou inactif" });
      }

      const owner = await storage.getUser(merchantLink.userId);
      if (owner?.suspended) {
        return res.status(404).json({ success: false, error: "Ce lien n'existe pas" });
      }

      // Wave payin activation check (on behalf of the merchant)
      if (operator && operator.toLowerCase() === "wave" && !owner?.wavePayinEnabled) {
        return res.status(403).json({ success: false, error: "Le wave de votre marchand n'est pas activée" });
      }
      
      // Get owner's currency for balance credit
      // IMPORTANT: Use currency from request if provided (for multi-currency countries like RDC)
      const ownerCurrency = owner?.country ? getCurrencyForCountry(owner.country) : "XOF";
      const payerCurrency = currency || getCurrencyForCountry(country);

      const activeProvider = await getActiveProviderForDeposit(country, operator);
      
      if (!activeProvider) {
        return res.status(503).json({ 
          success: false, 
          error: "Aucun fournisseur configure pour ce pays et operateur" 
        });
      }

      if (activeProvider === "fedapay") {
        // Pass original amount and currency for balance operations
        const result = await handleMerchantLinkPayment(
          merchantLink,
          amount, // converted amount for provider
          customerName || "Client",
          customerEmail || null,
          customerPhone,
          country,
          operator,
          originalAmount || amount, // original amount for balance credit
          originalCurrency || ownerCurrency, // owner's currency
          owner?.accountType
        );

        if (result.success) {
          return res.json({
            success: true,
            transactionId: result.transactionId,
            message: result.message,
          });
        } else {
          return res.status(400).json({ success: false, error: result.error });
        }
      } else if (activeProvider === "paydunya") {
        // Use Paydunya SOFTPAY for merchant links
        console.log(`[MERCHANT_LINK] Using Paydunya SOFTPAY for ${country}/${operator}`);
        
        const effectiveCustomerName = customerName || "Client";
        const payduynaMLCurrencies: Record<string, string> = { "CM": "XAF" };
        const providerCurrency = payduynaMLCurrencies[country?.toUpperCase()] || "XOF";
        
        // CRITICAL: Calculate base amount in owner's currency for balance credit
        const baseAmountInOwnerCurrency = originalAmount ? Math.floor(originalAmount) : Math.floor(amount);
        
        // Convert amount to provider currency if needed
        let convertedAmountForProvider = Math.floor(amount);
        if (ownerCurrency !== providerCurrency && !originalAmount) {
          const { convertCurrency: convertCurrencyFn } = await import("./currency-converter");
          const conversionResult = await convertCurrencyFn(baseAmountInOwnerCurrency, ownerCurrency, providerCurrency);
          if (conversionResult.success) {
            convertedAmountForProvider = Math.floor(conversionResult.convertedAmount);
          }
        }
        
        const paydunyaData = {
          invoice: {
            total_amount: convertedAmountForProvider,
            description: `Paiement ${merchantLink.merchantName} - ${baseAmountInOwnerCurrency} ${ownerCurrency}`,
            customer: {
              name: effectiveCustomerName,
              email: "noreply@bkapay.com",
              phone: customerPhone,
            },
          },
          store: {
            name: "BKApay",
          },
          custom_data: {
            user_id: merchantLink.userId,
            merchant_link_id: merchantLink.id,
            type: "merchant_link",
            country,
            operator,
            phone: customerPhone,
          },
          actions: {
            callback_url: `${process.env.BASE_URL || 'https://bkapay.com'}/api/webhooks/paydunya`,
          },
        };

        const paydunyaResponse = await callPaydunyaAPI("/checkout-invoice/create", paydunyaData);

        if (paydunyaResponse.response_code === "00" && paydunyaResponse.token) {
          // Calculate fees on the OWNER's currency amount (not the provider XOF amount)
          const merchantPaydunyaFeeConfig = await getDynamicFees(storage, country, operator);
          const feeInfo = calculateIncomingFee(baseAmountInOwnerCurrency, merchantPaydunyaFeeConfig.incoming);

          // Exchange fee when payer's currency differs from merchant's balance currency (personal accounts only)
          const { feeAmount: mlXFee2, feePercentage: mlXFeePct2 } =
            await getIncomingExchangeFee(storage, baseAmountInOwnerCurrency, providerCurrency, ownerCurrency, owner?.accountType);
          const mlNet2 = Math.max(0, feeInfo.netAmount - mlXFee2);
          const mlFee2 = feeInfo.feeAmount + mlXFee2;
          const mlFeePct2 = feeInfo.feePercentage + mlXFeePct2;
          
          const transactionId = randomUUID();
          await storage.createTransaction({
            userId: merchantLink.userId,
            type: "merchant_link",
            amount: baseAmountInOwnerCurrency,
            fee: mlFee2,
            feePercentage: mlFeePct2,
            currency: ownerCurrency,
            status: "pending",
            country,
            operator,
            description: `Paiement ${merchantLink.merchantName}`,
            customerName: effectiveCustomerName,
            customerEmail: customerEmail || null,
            customerPhone: customerPhone || null,
            paydunyaToken: paydunyaResponse.token,
            metadata: JSON.stringify({
              phone: customerPhone,
              customerName: effectiveCustomerName,
              provider: "paydunya",
              merchantLinkId: merchantLink.id,
              netAmountForUser: mlNet2,
              providerAmount: convertedAmountForProvider,
              providerCurrency: providerCurrency,
              balanceAmount: mlNet2,
              balanceCurrency: ownerCurrency,
              ...(mlXFee2 > 0 ? { exchangeFee: mlXFee2, exchangeFeePercentage: mlXFeePct2 } : {}),
            }),
          });

          const operatorKey = getOperatorKey(operator, country);
          const needsOTP = operatorKey ? requiresOTP(operatorKey) : false;
          const twoStep = operatorKey ? requiresTwoStep(operatorKey) : false;

          if (!needsOTP && !twoStep && operatorKey) {
            const paymentData: SoftpayPaymentData = {
              customerName: effectiveCustomerName,
              customerEmail: "noreply@bkapay.com",
              phoneNumber: customerPhone,
              invoiceToken: paydunyaResponse.token,
            };

            const softpayResult = await callPaydunyaSoftpay(operator, country, paymentData);

            if (softpayResult.success) {
              return res.json({
                success: true,
                transactionId,
                token: paydunyaResponse.token,
                message: softpayResult.message || "Validez le paiement sur votre telephone",
                redirectUrl: softpayResult.url,
                omUrl: softpayResult.omUrl,
                maxitUrl: softpayResult.maxitUrl,
                provider: "paydunya",
              });
            } else {
              return res.status(400).json({ 
                success: false, 
                error: softpayResult.message || "Erreur lors du paiement" 
              });
            }
          }

          return res.json({
            success: true,
            transactionId,
            token: paydunyaResponse.token,
            message: "Suivez les instructions pour valider le paiement",
            provider: "paydunya",
          });
        } else {
          return res.status(400).json({ 
            success: false, 
            error: paydunyaResponse.response_text || "Erreur lors de la creation de la facture" 
          });
        }
      } else if (activeProvider === "mbiyopay") {
        // Use MbiyoPay for merchant links with cross-currency support
        console.log(`[MERCHANT_LINK] Using MbiyoPay for ${country}/${operator} with currency ${payerCurrency}`);
        const { otpCode } = req.body;
        
        const needsOtp = mbiyoPayOperatorRequiresOtp(country, operator);
        if (needsOtp && !otpCode) {
          const otpInfo = getMbiyoPayOtpInstructions(country, amount);
          return res.json({
            success: false,
            requiresOTP: true,
            otpInstructions: otpInfo.instructions,
            otpUssdCode: otpInfo.ussdCode,
            otpHint: otpInfo.hint,
            provider: "mbiyopay",
            error: "Code OTP requis pour Orange Money",
          });
        }
        
        const result = await handleMbiyoPayMerchantLink(
          merchantLink,
          amount,
          customerPhone,
          customerName || "Client",
          customerEmail || "",
          operator,
          country,
          originalAmount || amount,
          originalCurrency || ownerCurrency,
          payerCurrency,
          otpCode,
          owner?.accountType
        );

        if (result.success) {
          return res.json({
            success: true,
            transactionId: result.transactionId,
            mbiyopayTransactionId: result.mbiyopayTransactionId,
            redirectUrl: result.redirectUrl,
            instructions: result.instructions,
            message: result.message || "Demande de paiement envoyee",
            provider: "mbiyopay",
            authMode: result.authMode ?? null,
          });
        } else {
          return res.status(400).json({ success: false, error: result.error });
        }
      } else if (activeProvider === "afribapay") {
        // Use AfribaPay for merchant links
        console.log(`[MERCHANT_LINK] Using AfribaPay for ${country}/${operator}`);
        const { otpCode } = req.body;
        
        const result = await handleAfribaPayMerchantLink(
          merchantLink,
          amount,
          customerPhone,
          country,
          operator,
          otpCode,
          customerName || "Client",
          customerEmail || null
        );

        if (result.requiresOtp) {
          const { getOtpUssdCode } = await import("@shared/afribapay-countries");
          return res.status(400).json({
            success: false,
            error: result.error,
            requiresOTP: true,
            otpInstructions: result.otpInstructions,
            otpUssdCode: getOtpUssdCode(country, operator) || undefined,
          });
        }

        if (result.success) {
          return res.json({
            success: true,
            transactionId: result.transactionId,
            redirectUrl: result.providerLink,
            message: result.message || "Paiement initie avec succes",
            provider: "afribapay",
          });
        } else {
          return res.status(400).json({ success: false, error: result.error });
        }
      } else if (activeProvider === "pawapay") {
        console.log(`[MERCHANT_LINK] Using PawaPay for ${country}/${operator}`);
        const { otpCode } = req.body;
        const result = await handlePawaPayDeposit(
          merchantLink.userId,
          owner!,
          amount,
          country,
          operator,
          customerPhone,
          payerCurrency,
          ownerCurrency !== payerCurrency ? (originalAmount || undefined) : undefined,
          ownerCurrency !== payerCurrency ? ownerCurrency : undefined,
          otpCode,
          {
            transactionType: "merchant_link",
            transactionDescription: `Paiement marchand - ${merchantLink.merchantName}`,
            customerName: customerName || undefined,
            customerEmail: customerEmail || undefined,
            extraMetadata: { merchantLinkId: merchantLink.id },
          }
        );
        if (result.requiresOTP) {
          return res.json({
            success: false,
            requiresOTP: true,
            otpInstructions: result.otpInstructions,
            otpUssdCode: result.otpUssdCode,
            otpHint: result.otpHint,
            provider: "pawapay",
            error: result.error,
          });
        }
        if (result.success) {
          return res.json({
            success: true,
            transactionId: result.transactionId,
            message: result.message || "Paiement initié. Validez sur votre téléphone.",
            provider: "pawapay",
          });
        } else {
          return res.status(400).json({ success: false, error: result.error });
        }
      } else if (activeProvider === "feexpay") {
        console.log(`[MERCHANT_LINK] Using FeeXPay for ${country}/${operator}`);
        const mlOwnerCurrency = ownerCurrency;
        const mlPayerCurrency = payerCurrency;
        const mlOriginalAmount = originalAmount ? Math.floor(originalAmount) : Math.floor(amount);
        const mlOriginalCurrency = originalCurrency || mlOwnerCurrency;
        const result = await handleFeeXPayDeposit(
          merchantLink.userId,
          owner!,
          Math.floor(amount),
          country,
          operator,
          customerPhone,
          otpCode,
          mlPayerCurrency,
          mlOriginalAmount,
          mlOriginalCurrency,
          {
            transactionType: "merchant_link",
            transactionDescription: `Paiement ${merchantLink.merchantName}`,
            customerName: customerName || "Client",
            customerEmail: customerEmail || undefined,
            extraMetadata: { merchantLinkId: merchantLink.id },
          }
        );
        if (result.requiresOtp) {
          return res.json({
            success: false,
            requiresOTP: true,
            otpInstructions: result.otpInstructions,
            provider: "feexpay",
            error: result.error,
          });
        }
        if (result.success) {
          return res.json({
            success: true,
            transactionId: result.transactionId,
            message: result.message || "Paiement initie. Validez sur votre telephone.",
            provider: "feexpay",
            ...(result.redirectUrl ? { redirectUrl: result.redirectUrl } : {}),
          });
        } else {
          return res.status(400).json({ success: false, error: result.error });
        }
      } else {
        return res.status(503).json({
          success: false,
          error: "Fournisseur de paiement non supporte",
        });
      }
    } catch (error: any) {
      console.error("[MERCHANT_LINK_FEDAPAY] Error:", error);
      return res.status(500).json({ success: false, error: "Erreur lors du paiement" });
    }
  });

  // API Payment Route - Multi-Provider
  app.post("/api/fedapay/api-payment", requireApiKey, async (req: Request, res: Response) => {
    try {
      const { transactionId, country, operator, customerPhone, customerName, currency } = req.body;

      if (!transactionId) {
        return res.status(400).json({ success: false, error: "Transaction ID requis" });
      }

      const transaction = await storage.getTransaction(transactionId);
      if (!transaction) {
        return res.status(404).json({ success: false, error: "Transaction non trouvee" });
      }

      // Get API key from request
      const apiKey = (req as any).apiKey;
      if (!apiKey) {
        return res.status(401).json({ success: false, error: "Cle API non valide" });
      }

      // Wave payin activation check (on behalf of the API merchant)
      if (operator && operator.toLowerCase() === "wave") {
        const apiOwnerForWave = await storage.getUser(apiKey.userId);
        if (!apiOwnerForWave?.wavePayinEnabled) {
          return res.status(403).json({ success: false, error: "Le wave de votre marchand n'est pas activée" });
        }
      }

      const activeProvider = await getActiveProviderForDeposit(country, operator);
      
      if (!activeProvider) {
        return res.status(503).json({ 
          success: false, 
          error: "Aucun fournisseur configure pour ce pays et operateur" 
        });
      }

      if (activeProvider === "fedapay") {
        // handleApiPayment(apiKey, amount, description, customerName, customerEmail, customerPhone, country, operator)
        const result = await handleApiPayment(
          apiKey,
          transaction.amount,
          transaction.description || "Paiement via API",
          customerName || transaction.customerName || "Client",
          "noreply@bkapay.com", // Privacy: never send real customer emails to providers
          customerPhone || transaction.customerPhone || "",
          country,
          operator
        );

        if (result.success) {
          return res.json({
            success: true,
            transactionId: result.transactionId || transaction.id,
            message: result.message,
          });
        } else {
          return res.status(400).json({ success: false, error: result.error });
        }
      } else if (activeProvider === "paydunya") {
        // Use Paydunya SOFTPAY for API payments
        console.log(`[API_PAYMENT] Using Paydunya SOFTPAY for ${country}/${operator}`);
        
        const effectiveCustomerName = customerName || transaction.customerName || "Client";
        const effectivePhone = customerPhone || transaction.customerPhone || "";
        
        const paydunyaData = {
          invoice: {
            total_amount: Math.floor(transaction.amount),
            description: transaction.description || `Paiement API de ${transaction.amount} ${transaction.currency || "XOF"}`,
            customer: {
              name: effectiveCustomerName,
              email: "noreply@bkapay.com",
              phone: effectivePhone,
            },
          },
          store: {
            name: "BKApay",
          },
          custom_data: {
            user_id: apiKey.userId,
            original_transaction_id: transaction.id,
            type: "api_payment",
            country,
            operator,
            phone: effectivePhone,
          },
          actions: {
            callback_url: `${process.env.BASE_URL || 'https://bkapay.com'}/api/webhooks/paydunya`,
          },
        };

        const paydunyaResponse = await callPaydunyaAPI("/checkout-invoice/create", paydunyaData);

        if (paydunyaResponse.response_code === "00" && paydunyaResponse.token) {
          // Update the existing transaction with Paydunya token
          await storage.updateTransaction(transaction.id, {
            paydunyaToken: paydunyaResponse.token,
            country,
            operator,
          });

          const operatorKey = getOperatorKey(operator, country);
          const needsOTP = operatorKey ? requiresOTP(operatorKey) : false;
          const twoStep = operatorKey ? requiresTwoStep(operatorKey) : false;

          if (!needsOTP && !twoStep && operatorKey) {
            const paymentData: SoftpayPaymentData = {
              customerName: effectiveCustomerName,
              customerEmail: "noreply@bkapay.com",
              phoneNumber: effectivePhone,
              invoiceToken: paydunyaResponse.token,
            };

            const softpayResult = await callPaydunyaSoftpay(operator, country, paymentData);

            if (softpayResult.success) {
              return res.json({
                success: true,
                transactionId: transaction.id,
                token: paydunyaResponse.token,
                message: softpayResult.message || "Validez le paiement sur votre telephone",
                redirectUrl: softpayResult.url,
                omUrl: softpayResult.omUrl,
                maxitUrl: softpayResult.maxitUrl,
                provider: "paydunya",
              });
            } else {
              return res.status(400).json({ 
                success: false, 
                error: softpayResult.message || "Erreur lors du paiement" 
              });
            }
          }

          return res.json({
            success: true,
            transactionId: transaction.id,
            token: paydunyaResponse.token,
            message: "Suivez les instructions pour valider le paiement",
            provider: "paydunya",
          });
        } else {
          return res.status(400).json({ 
            success: false, 
            error: paydunyaResponse.response_text || "Erreur lors de la creation de la facture" 
          });
        }
      } else if (activeProvider === "mbiyopay") {
        // Use MbiyoPay for API payments
        console.log(`[API_PAYMENT] Using MbiyoPay for ${country}/${operator}`);
        const { otpCode } = req.body;
        
        const needsOtp = mbiyoPayOperatorRequiresOtp(country, operator);
        if (needsOtp && !otpCode) {
          const otpInfo = getMbiyoPayOtpInstructions(country, transaction.amount);
          return res.json({
            success: false,
            requiresOTP: true,
            otpInstructions: otpInfo.instructions,
            otpUssdCode: otpInfo.ussdCode,
            otpHint: otpInfo.hint,
            provider: "mbiyopay",
            error: "Code OTP requis pour Orange Money",
          });
        }
        
        const result = await handleMbiyoPayApiPayment(
          apiKey,
          transaction.amount,
          transaction.description || "Paiement via API",
          customerName || transaction.customerName || "Client",
          transaction.customerEmail || "",
          customerPhone || transaction.customerPhone || "",
          country,
          operator,
          undefined,
          otpCode
        );

        if (result.success) {
          await storage.updateTransaction(transaction.id, {
            country,
            operator,
            metadata: JSON.stringify({
              ...JSON.parse(transaction.metadata || "{}"),
              provider: "mbiyopay",
              mbiyopayTransactionId: result.mbiyopayTransactionId,
            }),
          });

          return res.json({
            success: true,
            transactionId: transaction.id,
            redirectUrl: result.redirectUrl,
            instructions: result.instructions,
            message: result.message || "Demande de paiement envoyee",
            provider: "mbiyopay",
          });
        } else {
          return res.status(400).json({ success: false, error: result.error });
        }
      } else if (activeProvider === "afribapay") {
        // Use AfribaPay for API payments
        console.log(`[API_PAYMENT] Using AfribaPay for ${country}/${operator}`);
        const { otpCode } = req.body;
        
        const result = await handleAfribaPayApiPayment(
          apiKey,
          transaction.amount,
          transaction.description || "Paiement via API",
          customerName || transaction.customerName || "Client",
          "noreply@bkapay.com",
          customerPhone || transaction.customerPhone || "",
          country,
          operator,
          otpCode
        );

        if (result.requiresOtp) {
          const { getOtpUssdCode } = await import("@shared/afribapay-countries");
          return res.status(400).json({
            success: false,
            error: result.error,
            requiresOTP: true,
            otpInstructions: result.otpInstructions,
            otpUssdCode: getOtpUssdCode(country, operator) || undefined,
          });
        }

        if (result.success) {
          await storage.updateTransaction(transaction.id, {
            country,
            operator,
            metadata: JSON.stringify({
              ...JSON.parse(transaction.metadata || "{}"),
              provider: "afribapay",
              afribaPayTransactionId: result.afribaPayTransactionId,
            }),
          });

          return res.json({
            success: true,
            transactionId: transaction.id,
            redirectUrl: result.providerLink,
            message: result.message || "Paiement initie avec succes",
            provider: "afribapay",
          });
        } else {
          return res.status(400).json({ success: false, error: result.error });
        }
      } else if (activeProvider === "pawapay") {
        console.log(`[API_PAYMENT] Using PawaPay for ${country}/${operator}`);
        const { otpCode } = req.body;
        const { createPawaPayDeposit } = await import("./pawapay");
        const { getCurrencyForOperator: getPawaPayCurrencyForOp, pawaPayOperatorRequiresOtp: pawaRequiresOtp, getPawaPayOtpInstructions: pawaOtpInfo } = await import("@shared/pawapay-countries");

        const effectivePhone = customerPhone || transaction.customerPhone || "";
        const needsOtp = pawaRequiresOtp(country.toUpperCase(), operator);
        if (needsOtp && !otpCode) {
          const otpInfo = pawaOtpInfo(country.toUpperCase());
          return res.json({
            success: false,
            requiresOTP: true,
            otpInstructions: otpInfo.instructions,
            otpUssdCode: otpInfo.ussdCode,
            otpHint: otpInfo.hint,
            provider: "pawapay",
            error: "Code OTP Orange Money requis pour ce paiement",
          });
        }

        const providerCurrency = currency || getPawaPayCurrencyForOp(country.toUpperCase(), operator);
        const pawaResult = await createPawaPayDeposit({
          amount: transaction.amount,
          currency: providerCurrency,
          country: country.toUpperCase(),
          operator,
          phone: effectivePhone,
          description: transaction.description || "Paiement API BKApay",
          externalId: randomUUID(),
          preAuthorisationCode: otpCode,
        });

        if (!pawaResult.success) {
          return res.status(400).json({ success: false, error: pawaResult.error || "Paiement non effectué. Veuillez réessayer." });
        }

        const existingMeta = JSON.parse(transaction.metadata || "{}");
        await storage.updateTransaction(transaction.id, {
          country,
          operator,
          metadata: JSON.stringify({
            ...existingMeta,
            pawaPayDepositId: pawaResult.depositId,
            provider: "pawapay",
            customerPhone: effectivePhone,
          }),
        });

        return res.json({
          success: true,
          transactionId: transaction.id,
          message: pawaResult.message || "Paiement initié. Validez sur votre téléphone.",
          provider: "pawapay",
        });
      } else if (activeProvider === "feexpay") {
        console.log(`[API_PAYMENT] Using FeeXPay for ${country}/${operator}`);
        const { getFeeXPayConfig: fxExecConf, createFeeXPayPayin: fxExecPayin, translateFeeXPayError: fxExecErr } = await import("./feexpay");
        const { getNetworkKey: fxExecNet, formatPhoneForFeeXPay: fxExecPhone, getCurrencyForCountry: fxExecCurr, operatorRequiresOtp: fxExecOtp } = await import("@shared/feexpay-countries");
        const { otpCode: fxExecOtpCode } = req.body;

        const fxExecConfig = await fxExecConf();
        if (!fxExecConfig) return res.status(503).json({ success: false, error: "FeeXPay non configure" });

        if (fxExecOtp(country.toUpperCase(), operator) && !fxExecOtpCode) {
          return res.json({ success: false, requiresOTP: true, otpInstructions: "Composez le code USSD pour obtenir votre OTP.", provider: "feexpay", error: "Code OTP requis" });
        }

        const fxExecNetKey = fxExecNet(country.toUpperCase(), operator);
        if (!fxExecNetKey) return res.status(400).json({ success: false, error: "Reseau non supporte" });

        const effectivePhone = customerPhone || transaction.customerPhone || "";
        const fxExecResult = await fxExecPayin(fxExecConfig, {
          networkKey: fxExecNetKey, shopId: fxExecConfig.shopId,
          amount: transaction.amount,
          phoneNumber: fxExecPhone(effectivePhone, country.toUpperCase()),
          otpCode: fxExecOtpCode,
          callbackUrl: process.env.BASE_URL ? `${process.env.BASE_URL}/api/webhooks/feexpay` : undefined,
        });

        if (!fxExecResult.success) {
          return res.status(400).json({ success: false, error: fxExecErr(fxExecResult.error, "deposit") });
        }

        const existingMeta = JSON.parse(transaction.metadata || "{}");
        await storage.updateTransaction(transaction.id, {
          country, operator,
          metadata: JSON.stringify({ ...existingMeta, feeXPayReference: fxExecResult.reference, provider: "feexpay" }),
        });

        return res.json({ success: true, transactionId: transaction.id, message: fxExecResult.message || "Paiement initie. Validez sur votre telephone.", provider: "feexpay" });
      } else {
        return res.status(503).json({
          success: false,
          error: "Fournisseur de paiement non supporte",
        });
      }
    } catch (error: any) {
      console.error("[API_PAYMENT_FEDAPAY] Error:", error);
      return res.status(500).json({ success: false, error: "Erreur lors du paiement" });
    }
  });

  // Config Endpoint - Returns enabled countries/operators across all providers
  app.get("/api/fedapay/config", async (req: Request, res: Response) => {
    const { FEDAPAY_COUNTRIES } = await import("@shared/fedapay-countries");
    
    const collectCountries = FEDAPAY_COUNTRIES.map(c => ({
      code: c.code,
      operators: c.operators.filter(op => op.payin).map(op => ({ code: op.code, name: op.name })),
    }));
    
    const payoutCountries = FEDAPAY_COUNTRIES.map(c => ({
      code: c.code,
      operators: c.operators.filter(op => op.payout).map(op => ({ code: op.code, name: op.name })),
    }));

    res.json({
      collect: collectCountries,
      payout: payoutCountries,
    });
  });

  // ===== Withdrawal Routes (Paydunya Disburse API v2) =====
  // Documentation: https://developers.paydunya.com/doc/EN/api_deboursement
  app.post("/api/withdrawals", requireAuth, async (req: Request, res: Response) => {
    try {
      const { amount, phone, country, operator } = req.body;
      const user = await storage.getUser(req.session.userId!);

      if (!user) {
        return res.status(404).json({ error: "Retrait échoué" });
      }

      if (user.suspended) {
        return res.status(403).json({ error: "Retrait échoué" });
      }

      if (user.withdrawalsEnabled === false) {
        return res.status(403).json({ error: "Les retraits sont désactivés pour votre compte. Veuillez contacter le support." });
      }

      // Check KYC verification for withdrawals
      if (user.kycStatus !== "verified") {
        return res.status(403).json({ 
          error: "Retrait échoué"
        });
      }

      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Retrait échoué" });
      }

      const minAmount = 1000;
      if (amount < minAmount) {
        return res.status(400).json({ error: "Retrait échoué" });
      }

      if (!phone || !country || !operator) {
        return res.status(400).json({ error: "Retrait échoué" });
      }

      // Get dynamic fees from database (auto-detect active payout provider)
      const feeConfig = await getDynamicOutgoingFees(storage, country, operator);
      
      // Calculate fees with dynamic percentage
      const feeInfo = calculateOutgoingFee(Math.floor(amount), feeConfig.outgoing);

      // Calculate outgoing exchange fee for personal accounts when currencies differ
      const userCurrencyForTransfer = user.country ? getCurrencyForCountry(user.country) : "XOF";
      let destCurrencyForTransfer = getCurrencyForCountry(country?.toUpperCase() || "");
      const withdrawalProvider = await getActiveProviderForWithdrawal(country?.toUpperCase() || "", operator);
      if (withdrawalProvider === "pawapay") {
        try {
          const { getCurrencyForOperator: getOpCurrW } = await import("@shared/pawapay-countries");
          const opCurrW = getOpCurrW(country?.toUpperCase() || "", operator);
          if (opCurrW) destCurrencyForTransfer = opCurrW;
        } catch (_) {}
      }
      const xFeeWeb = await getOutgoingExchangeFee(storage, userCurrencyForTransfer, destCurrencyForTransfer, Math.floor(amount), user.accountType || "personal");
      const outgoingExchangeFeeAmount = xFeeWeb.feeAmount;
      if (outgoingExchangeFeeAmount > 0) {
        console.log(`[Withdrawal] Outgoing exchange fee ${userCurrencyForTransfer}→${destCurrencyForTransfer} (${xFeeWeb.feePercentage / 10}%) = +${outgoingExchangeFeeAmount} ${userCurrencyForTransfer}`);
      }

      // Frais cumulatifs : fraisTransaction + fraisEchange (tous deux sur le solde de l'expéditeur)
      // Le fournisseur reçoit le montant complet (Math.floor(amount)), le destinataire reçoit le montant complet
      const totalToDeduct = feeInfo.totalDeductedFromBalance + feeInfo.feeAmount + outgoingExchangeFeeAmount;

      if (user.balance < totalToDeduct) {
        return res.status(400).json({ 
          error: "Retrait échoué"
        });
      }

      // Map operator to Paydunya withdraw_mode (exact values from documentation)
      const withdrawModeMap: Record<string, string> = {
        // Senegal
        "orange-sn": "orange-money-senegal",
        "free-sn": "free-money-senegal",
        "expresso-sn": "expresso-senegal",
        "wave-sn": "wave-senegal",
        "wizall-sn": "wizall-senegal",
        // Ivory Coast
        "orange-ci": "orange-money-ci",
        "mtn-ci": "mtn-ci",
        "moov-ci": "moov-ci",
        "wave-ci": "wave-ci",
        // Burkina Faso
        "orange-bf": "orange-money-burkina",
        "moov-bf": "moov-burkina-faso",
        // Benin
        "moov-bj": "moov-benin",
        "mtn-bj": "mtn-benin",
        // Togo
        "tmoney-tg": "t-money-togo",
        "moov-tg": "moov-togo",
        // Mali
        "orange-ml": "orange-money-mali",
        "moov-ml": "moov-mali",
        // Cameroun
        "mtn-cm": "mtn-cameroun",
      };

      const withdrawMode = withdrawModeMap[`${operator}-${country.toLowerCase()}`];
      if (!withdrawMode) {
        return res.status(400).json({ error: "Retrait échoué" });
      }

      // IMPORTANT: Paydunya requires phone WITHOUT country code prefix
      // Example: "771234567" for Senegal, "96123456" for Benin
      // The phone should be the local subscriber number only
      
      // Step 1: Remove only whitespace, dashes, dots (keep digits and +)
      let cleanPhone = phone.replace(/[\s\-\.]+/g, "");
      
      // Step 2: Validate format - must be digits only (with optional + at start)
      if (!/^\+?\d+$/.test(cleanPhone)) {
        return res.status(400).json({ error: "Retrait échoué" });
      }
      
      // Step 3: Country-specific phone info (code and expected local length)
      const countryPhoneInfo: Record<string, { code: string, localLength: number[] }> = {
        "SN": { code: "221", localLength: [9] },      // Senegal: 9 digits (77XXXXXXX)
        "CI": { code: "225", localLength: [10] },     // Ivory Coast: 10 digits
        "BF": { code: "226", localLength: [8] },      // Burkina: 8 digits
        "BJ": { code: "229", localLength: [8, 10] },  // Benin: 8 or 10 digits (with leading 0)
        "TG": { code: "228", localLength: [8] },      // Togo: 8 digits
        "ML": { code: "223", localLength: [8] },      // Mali: 8 digits
        "CM": { code: "237", localLength: [9] },      // Cameroun: 9 digits (6XXXXXXXX)
      };
      
      const phoneInfo = countryPhoneInfo[country.toUpperCase()];
      if (!phoneInfo) {
        return res.status(400).json({ error: "Retrait échoué" });
      }
      
      // Step 4: Strip international prefix if present
      // Order matters: check +CODE first, then 00CODE, then just CODE at start
      const internationalPrefixes = [
        `+${phoneInfo.code}`,
        `00${phoneInfo.code}`,
      ];
      
      for (const prefix of internationalPrefixes) {
        if (cleanPhone.startsWith(prefix)) {
          cleanPhone = cleanPhone.substring(prefix.length);
          break;
        }
      }
      
      // Also handle case where user just typed the country code without + or 00
      // But only if the resulting number would be valid length
      if (cleanPhone.startsWith(phoneInfo.code)) {
        const withoutCode = cleanPhone.substring(phoneInfo.code.length);
        if (phoneInfo.localLength.includes(withoutCode.length)) {
          cleanPhone = withoutCode;
        }
      }
      
      // Step 5: Validate local number length
      if (!phoneInfo.localLength.includes(cleanPhone.length)) {
        return res.status(400).json({ 
          error: "Retrait échoué"
        });
      }

      // Step 6: Validate phone number matches selected operator
      // This prevents users from selecting wrong operator (e.g., Moov but using MTN number)
      const operatorValidation = validatePhoneOperator(cleanPhone, operator, country);
      console.log(`[Withdrawal] Operator validation:`, operatorValidation);
      
      if (!operatorValidation.isValid) {
        console.log(`[Withdrawal] Operator mismatch: expected ${operatorValidation.expectedOperator}, detected ${operatorValidation.detectedOperator}`);
        return res.status(400).json({ 
          error: operatorValidation.message
        });
      }

      console.log(`[Withdrawal] Original phone: ${phone}, Cleaned phone: ${cleanPhone}, Country: ${country}, Operator: ${operator}`);

      const callbackUrl = process.env.BASE_URL
        ? `${process.env.BASE_URL}/api/webhooks/paydunya-disburse`
        : "https://bkapay.com/api/webhooks/paydunya-disburse";

      const txCurrency = ({ "CM": "XAF" } as Record<string,string>)[country?.toUpperCase()] || "XOF";

      // Step 1: Deduct balance and create pending transaction immediately
      await storage.updateUserBalance(req.session.userId!, -totalToDeduct);
      const legacyTx = await storage.createTransaction({
        userId: req.session.userId!,
        type: "withdrawal",
        amount: Math.floor(amount),
        fee: feeInfo.feeAmount,
        feePercentage: feeInfo.feePercentage,
        currency: txCurrency,
        status: "pending",
        country,
        operator,
        customerPhone: cleanPhone,
        description: `Retrait de ${amount} ${txCurrency} vers ${cleanPhone}`,
        metadata: JSON.stringify({
          provider: "paydunya",
          deductedFromBalance: totalToDeduct,
          ...(outgoingExchangeFeeAmount > 0 ? { outgoingExchangeFee: outgoingExchangeFeeAmount, outgoingExchangeFeeCurrency: userCurrencyForTransfer } : {}),
        }),
      });

      console.log(`[Withdrawal] Pending tx ${legacyTx.id} created, balance deducted: ${totalToDeduct} - dispatching to Paydunya in 5s`);

      res.json({
        success: true,
        message: "Retrait initié avec succès",
        totalDeducted: totalToDeduct,
        amountSent: Math.floor(amount),
        fee: feeInfo.feeAmount,
      });

      // Step 2: Dispatch to Paydunya 5s after securing the funds
      setTimeout(async () => {
        try {
          const getInvoiceData = { account_alias: cleanPhone, amount: Math.floor(amount), withdraw_mode: withdrawMode, callback_url: callbackUrl };
          console.log(`[Withdrawal] Dispatching to Paydunya for tx ${legacyTx.id}:`, getInvoiceData);
          const getInvoiceResponse = await callPaydunyaAPIv2("/disburse/get-invoice", getInvoiceData);
          console.log(`[Withdrawal] Get-invoice response for ${legacyTx.id}:`, getInvoiceResponse);

          if (getInvoiceResponse.response_code !== "00" || !getInvoiceResponse.disburse_token) {
            console.error(`[Withdrawal] Get-invoice failed for ${legacyTx.id} - refunding`);
            await safeRefundOutgoingTransaction(legacyTx.id, req.session.userId!, {}, "legacy-paydunya-get-invoice-failed");
            return;
          }

          const legacyDisburseId = `withdrawal-${user.id.substring(0, 8)}-${Date.now()}`;
          const submitResponse = await callPaydunyaAPIv2("/disburse/submit-invoice", {
            disburse_invoice: getInvoiceResponse.disburse_token, disburse_id: legacyDisburseId,
          });
          console.log(`[Withdrawal] Submit response for ${legacyTx.id}:`, submitResponse);

          if (submitResponse.response_code === "00") {
            await storage.updateTransactionMetadata(legacyTx.id, JSON.stringify({
              provider: "paydunya",
              paydunyaTransactionId: submitResponse.transaction_id,
              disburseId: legacyDisburseId,
              deductedFromBalance: totalToDeduct,
              ...(outgoingExchangeFeeAmount > 0 ? { outgoingExchangeFee: outgoingExchangeFeeAmount, outgoingExchangeFeeCurrency: userCurrencyForTransfer } : {}),
            }));
            await storage.updateTransaction(legacyTx.id, { paydunyaToken: getInvoiceResponse.disburse_token });
            await storage.updateTransactionStatus(legacyTx.id, "completed");
            console.log(`[Withdrawal] ✅ tx ${legacyTx.id} COMPLETED`);
          } else {
            console.error(`[Withdrawal] Submit-invoice failed for ${legacyTx.id} - refunding`);
            await safeRefundOutgoingTransaction(legacyTx.id, req.session.userId!, {}, "legacy-paydunya-submit-failed");
          }
        } catch (dispatchErr) {
          console.error(`[Withdrawal] Dispatch error for ${legacyTx.id}:`, dispatchErr);
          await safeRefundOutgoingTransaction(legacyTx.id, req.session.userId!, {}, "legacy-paydunya-dispatch-error");
        }
      }, 5000);
    } catch (error: any) {
      console.error("[Withdrawal] Error:", error);
      res.status(500).json({ error: "Retrait échoué" });
    }
  });

  // ===== API Key Payment Route (Public) =====
  // Allow developers to integrate payments using their API key
  app.post("/api/payments/create", async (req: Request, res: Response) => {
    try {
      const { publicKey, amount, description, customerName, customerEmail, customerPhone, country, operator, callbackUrl } = req.body;

      if (!publicKey) {
        return res.status(400).json({ error: "Clé API publique requise" });
      }

      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Montant invalide" });
      }

      // Validate required parameters for fee calculation
      const validCountries = ["BJ", "TG", "CI", "SN", "BF", "ML"];
      const paymentCountry = country || "SN"; // Default to Senegal if not specified
      
      if (!validCountries.includes(paymentCountry)) {
        return res.status(400).json({ 
          error: "Pays invalide" 
        });
      }

      // Get API key and its owner
      const apiKey = await storage.getApiKeyByPublicKey(publicKey);
      if (!apiKey || !apiKey.isActive) {
        return res.status(401).json({ error: "Clé API invalide ou inactive" });
      }

      // Check if user account is suspended
      const apiOwner = await storage.getUser(apiKey.userId);
      if (apiOwner?.suspended) {
        return res.status(401).json({ error: "Clé API invalide ou inactive" });
      }

      // Wave payin activation check (on behalf of the merchant)
      if (operator && operator.toLowerCase() === "wave" && !apiOwner?.wavePayinEnabled) {
        return res.status(403).json({ error: "Le wave de votre marchand n'est pas activée" });
      }

      // ANTI-DUPLICATE: Check for existing transaction with same description in last 5 minutes
      // This prevents double payments when clients click multiple times
      if (description) {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const existingTransactions = await storage.getRecentTransactionsByDescription(
          apiKey.userId,
          description,
          fiveMinutesAgo
        );
        
        if (existingTransactions && existingTransactions.length > 0) {
          const existingTx = existingTransactions[0];
          console.log(`[API_PAYMENT] Duplicate detected - description: "${description}", existing transaction: ${existingTx.id}`);
          
          // Return the existing transaction instead of creating a new one
          return res.json({
            success: true,
            transactionId: existingTx.id,
            message: "Transaction existante retournee (doublon detecte)",
            duplicate: true,
            paymentUrl: existingTx.paydunyaReceiptUrl || null,
          });
        }
      }

      // Calculate fees for INCOMING payment with dynamic fee from database (auto-detect active provider)
      const grossAmount = Math.floor(amount);
      const apiFeeConfig = await getDynamicFees(storage, paymentCountry, operator || "wave");
      const feeInfo = calculateIncomingFee(grossAmount, apiFeeConfig.incoming);
      
      // Call Paydunya API to create checkout invoice with customer info
      const paydunyaData = {
        invoice: {
          total_amount: grossAmount,
          description: description || "Paiement via API BKApay",
          customer: {
            name: customerName || "Client",
            email: customerEmail || "",
            phone: customerPhone || "",
          },
        },
        store: {
          name: "BKApay",
          tagline: "Plateforme de paiement mobile money",
        },
        custom_data: {
          type: "api_payment",
          user_id: apiKey.userId,
          customer_name: customerName,
          customer_email: customerEmail,
          api_key_id: apiKey.id,
          country: paymentCountry,
          operator: operator || "wave",
        },
        actions: {
          callback_url: `${process.env.BASE_URL || 'http://localhost:5000'}/api/webhooks/paydunya`,
        },
      };

      const paydunyaResponse = await callPaydunyaAPI("/checkout-invoice/create", paydunyaData);

      if (paydunyaResponse.response_code === "00") {
        // Create pending transaction BEFORE returning to client
        // This ensures webhook can always find the transaction by token
        const transactionId = randomUUID();
        await storage.createTransaction({
          userId: apiKey.userId,
          type: "api_payment",
          amount: feeInfo.grossAmount,
          fee: feeInfo.feeAmount,
          feePercentage: feeInfo.feePercentage,
          currency: ({ "CM": "XAF" } as Record<string,string>)[paymentCountry?.toUpperCase()] || "XOF",
          status: "pending",
          country: paymentCountry,
          operator: operator || "wave",
          customerName,
          customerEmail,
          description: description || "Paiement via API BKApay",
          paydunyaToken: paydunyaResponse.token, // Store in dedicated column
          metadata: JSON.stringify({
            api_key_id: apiKey.id,
            apiKeyPublicKey: publicKey,
            callbackUrl: callbackUrl || null,
            provider: "paydunya",
          }),
        });
        
        // Get operator configuration for USSD instructions
        const operatorKey = getOperatorKey(operator || "wave", paymentCountry);
        const ussdInstruction = operatorKey ? getUSSDInstruction(operatorKey) : null;
        const needsOTP = operatorKey ? requiresOTP(operatorKey) : false;
        const twoStep = operatorKey ? requiresTwoStep(operatorKey) : false;

        res.json({
          success: true,
          transactionId,
          token: paydunyaResponse.token,
          redirectUrl: paydunyaResponse.response_text,
          ussdInstruction,
          requiresOTP: needsOTP,
          requiresTwoStep: twoStep,
        });
      } else {
        res.status(400).json({ 
          error: "Erreur lors de l'initiation du paiement" 
        });
      }
    } catch (error: any) {
      console.error("API payment processing error:", error);
      res.status(500).json({ error: "Erreur lors du traitement du paiement" });
    }
  });

  // SOFTPAY for API Gateway - Confirm payment with OTP
  app.post("/api/payments/confirm-softpay", async (req: Request, res: Response) => {
    try {
      const { publicKey, token, authorizationCode, country, operator, customerPhone, customerName, customerEmail } = req.body;

      if (!publicKey) {
        return res.status(400).json({ error: "Clé API publique requise" });
      }

      if (!token || !country || !operator || !customerPhone) {
        return res.status(400).json({ error: "Informations de paiement incomplètes" });
      }

      // Validate API key
      const apiKey = await storage.getApiKeyByPublicKey(publicKey);
      if (!apiKey || !apiKey.isActive) {
        return res.status(401).json({ error: "Clé API invalide ou inactive" });
      }

      // Get transaction by token
      const transaction = await storage.getTransactionByPaydunyaToken(token);
      if (!transaction) {
        return res.status(404).json({ error: "Transaction non trouvée" });
      }

      // Verify transaction belongs to API key owner
      if (transaction.userId !== apiKey.userId) {
        return res.status(403).json({ error: "Transaction non autorisée" });
      }

      // Parse metadata for Wizall transactionId
      let metadata: any = {};
      if (transaction.metadata) {
        metadata = JSON.parse(transaction.metadata);
      }

      // Check if this is Wizall two-step flow
      const operatorKey = getOperatorKey(operator, country);
      const isTwoStep = operatorKey ? requiresTwoStep(operatorKey) : false;

      if (isTwoStep && operator.toLowerCase() === "wizall" && country.toUpperCase() === "SN") {
        // WIZALL TWO-STEP: Call /wizall-money-senegal/confirm endpoint
        if (!metadata.wizallTransactionId) {
          return res.status(400).json({ error: "Transaction Wizall non initiée" });
        }

        // Call Wizall confirm helper
        const confirmResult = await confirmWizallPayment(authorizationCode!, customerPhone, metadata.wizallTransactionId);

        if (confirmResult.success) {
          res.json({
            success: true,
            message: confirmResult.message,
            transactionId: transaction.id,
          });
        } else {
          res.status(400).json({
            error: confirmResult.message,
          });
        }
      } else {
        // STANDARD FLOW
        // Note: Use generic email for privacy - never send real customer emails to providers
        const paymentData: SoftpayPaymentData = {
          customerName: customerName || transaction.customerName || "Client",
          customerEmail: "noreply@bkapay.com", // Privacy: never send real customer emails to providers
          phoneNumber: customerPhone,
          invoiceToken: token,
          authorizationCode,
        };

        // Call operator-specific SOFTPAY endpoint
        const softpayResult = await callPaydunyaSoftpay(operator, country, paymentData);

        if (softpayResult.success) {
          // CRITICAL: For two-step flows, transactionId MUST be present
          if (isTwoStep && !softpayResult.transactionId) {
            return res.status(502).json({
              error: "Erreur serveur: TransactionID manquant pour paiement two-step",
            });
          }

          // For Wizall first step, store TransactionID
          if (softpayResult.transactionId && isTwoStep) {
            const updatedMetadata = {
              ...metadata,
              wizallTransactionId: softpayResult.transactionId,
            };
            await storage.updateTransactionStatus(transaction.id, "pending", {
              metadata: JSON.stringify(updatedMetadata),
            });

            res.json({
              success: true,
              message: "Code OTP envoyé par SMS",
              transactionId: transaction.id,
              requiresOTP: true,
              wizallTransactionId: softpayResult.transactionId,
            });
          } else {
            res.json({
              success: true,
              message: softpayResult.message,
              transactionId: transaction.id,
              fees: softpayResult.fees,
              currency: softpayResult.currency,
              redirectUrl: softpayResult.url,
              omUrl: softpayResult.omUrl,
              maxitUrl: softpayResult.maxitUrl,
            });
          }
        } else {
          res.status(400).json({
            error: softpayResult.message || "Erreur lors du paiement",
          });
        }
      }
    } catch (error: any) {
      console.error("[API SOFTPAY CONFIRM] Error:", error);
      res.status(500).json({ error: "Erreur lors de la confirmation du paiement" });
    }
  });

  // ===== API Payment Submit Route =====
  // Called from the payment form page when user selects country/operator
  app.post("/api/payments/submit", async (req: Request, res: Response) => {
    try {
      const { transactionId, country, operator, currency } = req.body;

      if (!transactionId) {
        return res.status(400).json({ error: "Transaction ID requis" });
      }

      // Get transaction
      const transaction = await storage.getTransaction(transactionId);

      if (!transaction) {
        return res.status(404).json({ error: "Transaction non trouvee" });
      }

      // Parse metadata to get API key info
      let metadata: any = {};
      try {
        metadata = JSON.parse(transaction.metadata || "{}");
      } catch {}

      const customerName = transaction.customerName || "Client";
      const customerPhone = transaction.customerPhone || "";

      // Get active provider for this country/operator
      const activeProvider = await getActiveProviderForDeposit(country, operator);
      console.log(`[PAYMENT_SUBMIT] Provider for ${country}/${operator}: ${activeProvider}`);

      if (!activeProvider) {
        return res.status(503).json({ 
          success: false, 
          error: "Aucun fournisseur configure pour ce pays et operateur" 
        });
      }

      if (activeProvider === "mbiyopay") {
        // Use MbiyoPay for payment
        console.log(`[PAYMENT_SUBMIT] Using MbiyoPay for ${country}/${operator}, phone=${customerPhone}`);
        const { createMbiyoPayPayin, getCurrencyForCountry, mbiyoPayOperatorRequiresOtp: mbiyoNeedsOtp, getMbiyoPayOtpInstructions: getMbiyoOtpInfo } = await import("./mbiyopay");
        const { calculateIncomingFee, getFeeFromDatabase } = await import("./utils/fees");
        const { otpCode } = req.body;
        
        const needsOtp = mbiyoNeedsOtp(country, operator);
        if (needsOtp && !otpCode) {
          const otpInfo = getMbiyoOtpInfo(country, transaction.amount);
          return res.json({
            success: false,
            requiresOTP: true,
            otpInstructions: otpInfo.instructions,
            otpUssdCode: otpInfo.ussdCode,
            otpHint: otpInfo.hint,
            provider: "mbiyopay",
            error: "Code OTP requis pour Orange Money",
          });
        }
        
        const grossAmount = transaction.amount;
        const mbiyoSubmitFeeConfig = await getFeeFromDatabase(storage, "mbiyopay", country, operator);
        const feeInfo = calculateIncomingFee(grossAmount, mbiyoSubmitFeeConfig.incoming);
        const txCurrency = currency || getCurrencyForCountry(country);

        const result = await createMbiyoPayPayin({
          amount: grossAmount,
          currency: txCurrency,
          phone: customerPhone,
          countryCode: country,
          network: operator,
          orderId: `BKAPAY-API-${transactionId}-${Date.now()}`,
          callbackUrl: `${process.env.BASE_URL || "https://bkapay.com"}/api/webhooks/mbiyopay`,
          otpCode,
        });

        if (result.success && result.transactionId) {
          // Update transaction metadata with MbiyoPay info
          const updatedMetadata = JSON.stringify({
            ...metadata,
            mbiyopayTransactionId: result.transactionId,
            redirectUrl: result.redirectUrl,
            country,
            operator,
            provider: "mbiyopay",
          });

          await storage.updateTransactionMetadata(transactionId, updatedMetadata);

          res.json({
            success: true,
            transactionId: transactionId,
            redirectUrl: result.redirectUrl,
            instructions: result.instructions,
            message: result.message || "Paiement initie. Veuillez valider sur votre telephone.",
            provider: "mbiyopay",
          });
        } else {
          await storage.updateTransactionStatus(transactionId, "failed");
          res.json({
            success: false,
            transactionId: transactionId,
            error: result.error || "Erreur lors de l'initiation du paiement",
          });
        }
      } else if (activeProvider === "fedapay") {
        // Use FedaPay to initiate payment
        const nameParts = customerName.split(" ");
        const firstName = nameParts[0] || "Client";
        const lastName = nameParts.slice(1).join(" ") || "Client";
        
        const { createCollect } = await import("./fedapay");
        const result = await createCollect({
          amount: transaction.amount,
          description: transaction.description || "Paiement via BKApay",
          customerFirstName: firstName,
          customerLastName: lastName,
          customerEmail: "noreply@bkapay.com",
          customerPhone: customerPhone,
          country: country,
          operator: operator,
          callbackUrl: `${process.env.BASE_URL || "https://bkapay.com"}/api/webhooks/fedapay`,
        });

        if (result.success && result.transactionId) {
          const updatedMetadata = JSON.stringify({
            ...metadata,
            fedapayTransactionId: result.transactionId,
            fedapayReference: result.reference,
            country,
            operator,
            provider: "fedapay",
          });

          await storage.updateTransactionMetadata(transactionId, updatedMetadata);

          res.json({
            success: true,
            transactionId: transactionId,
            message: result.message,
            provider: "fedapay",
          });
        } else {
          await storage.updateTransactionStatus(transactionId, "failed");
          res.json({
            success: false,
            transactionId: transactionId,
            error: result.error || "Erreur lors de l'initiation du paiement",
          });
        }
      } else {
        return res.status(503).json({ 
          success: false, 
          error: "Fournisseur de paiement non supporte" 
        });
      }
    } catch (error: any) {
      console.error("Payment submission error:", error);
      res.status(500).json({ error: "Erreur lors de la soumission du paiement" });
    }
  });

  // ===== Withdrawal Request Route (for API developers) =====
  // Developers can create withdrawal requests from their client's site
  app.post("/api/withdrawals/create", async (req: Request, res: Response) => {
    try {
      const { privateKey, amount, country, operator, phone } = req.body;

      if (!privateKey) {
        return res.status(400).json({ error: "Retrait échoué" });
      }

      if (!amount || amount < 500) {
        return res.status(400).json({ error: "Retrait échoué" });
      }

      // Validate private key and get its owner
      const apiKey = await storage.getApiKeyByPrivateKey(privateKey);
      if (!apiKey || !apiKey.isActive) {
        return res.status(401).json({ error: "Retrait échoué" });
      }

      // Get the developer's balance
      const user = await storage.getUserById(apiKey.userId);
      if (!user || user.balance < amount) {
        return res.status(400).json({ error: "Retrait échoué" });
      }

      res.json({
        success: true,
        message: "Retrait initialisé. Consultez votre historique pour le statut.",
      });
    } catch (error: any) {
      console.error("Withdrawal creation error:", error);
      res.status(500).json({ error: "Retrait échoué" });
    }
  });

  // Admin routes - with no-cache headers to ensure fresh data
  app.get("/api/admin/stats", requireAdmin, async (req: Request, res: Response) => {
    try {
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      const stats = await storage.getAdminStats();
      console.log("[Admin Stats] Fetched:", JSON.stringify(stats));
      res.json(stats);
    } catch (error: any) {
      console.error("Admin stats error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.get("/api/admin/users", requireAdmin, async (req: Request, res: Response) => {
    try {
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      const users = await storage.getAllUsers();
      console.log("[Admin Users] Fetched", users.length, "users from database");
      res.json(users);
    } catch (error: any) {
      console.error("Admin users error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.get("/api/admin/users-all", requireAdmin, async (req: Request, res: Response) => {
    try {
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      const users = await storage.getAllUsersForBroadcast();
      res.json(users);
    } catch (error: any) {
      console.error("Admin users-all error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.get("/api/admin/search", requireAdmin, async (req: Request, res: Response) => {
    try {
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      const query = req.query.q as string;
      if (!query || query.length === 0) {
        return res.json([]);
      }
      const results = await storage.searchUsers(query);
      res.json(results);
    } catch (error: any) {
      console.error("Admin search error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // Force sync endpoint - returns all data in one call like the diagnostic
  app.get("/api/admin/force-sync", requireAdmin, async (req: Request, res: Response) => {
    try {
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      const users = await storage.getAllUsers();
      const stats = await storage.getAdminStats();
      
      console.log("[Force Sync] Fetched", users.length, "users and stats from database");
      
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        users: users,
        stats: stats,
        message: `Synchronisation réussie. ${users.length} utilisateur(s) chargé(s).`
      });
    } catch (error: any) {
      console.error("Force sync error:", error);
      res.status(500).json({ 
        success: false,
        error: "Erreur de synchronisation",
        message: error.message 
      });
    }
  });

  // Database diagnostic endpoint for admin
  app.get("/api/admin/database-diagnostic", requireAdmin, async (req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      const stats = await storage.getAdminStats();
      
      const diagnostic = {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "unknown",
        database: {
          connected: true,
          usersCount: users.length,
          usersDetails: users.map(u => ({
            id: u.id,
            email: u.email,
            firstName: u.firstName,
            lastName: u.lastName,
            isAdmin: u.isAdmin,
            kycStatus: u.kycStatus,
            createdAt: u.createdAt
          }))
        },
        stats: stats,
        message: `Base de données connectée. ${users.length} utilisateur(s) trouvé(s).`
      };
      
      console.log("[Diagnostic] Database check:", diagnostic.message);
      res.json(diagnostic);
    } catch (error: any) {
      console.error("Database diagnostic error:", error);
      res.status(500).json({
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "unknown",
        database: {
          connected: false,
          error: error.message
        },
        message: "Erreur de connexion à la base de données"
      });
    }
  });

  // Advanced diagnostic endpoint with full data
  app.get("/api/admin/diagnostic-advanced", requireAdmin, async (req: Request, res: Response) => {
    try {
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      const diagnosticData = await storage.getDiagnosticData();
      
      console.log("[Advanced Diagnostic] Fetched", diagnosticData.users.length, "users,", 
                  diagnosticData.pendingKyc.length, "pending KYC,",
                  diagnosticData.verifiedKyc.length, "verified KYC,",
                  diagnosticData.allTransactions.length, "transactions");
      
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "unknown",
        users: diagnosticData.users.map(u => ({
          id: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          balance: u.balance,
          kycStatus: u.kycStatus,
          isAdmin: u.isAdmin,
          isPrimaryAdmin: u.isPrimaryAdmin,
          suspended: u.suspended,
          createdAt: u.createdAt
        })),
        pendingKyc: diagnosticData.pendingKyc.map(u => ({
          id: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          kycStatus: u.kycStatus,
          kycIdFront: u.kycIdFront,
          kycIdBack: u.kycIdBack,
          kycSelfie: u.kycSelfie,
          createdAt: u.createdAt
        })),
        verifiedKyc: diagnosticData.verifiedKyc.map(u => ({
          id: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          kycStatus: u.kycStatus,
          kycIdFront: u.kycIdFront,
          kycIdBack: u.kycIdBack,
          kycSelfie: u.kycSelfie,
          createdAt: u.createdAt
        })),
        transactions: diagnosticData.allTransactions.map(t => ({
          id: t.id,
          userId: t.userId,
          type: t.type,
          amount: t.amount,
          fee: t.fee,
          status: t.status,
          country: t.country,
          operator: t.operator,
          customerName: t.customerName,
          customerPhone: t.customerPhone,
          description: t.description,
          paydunyaToken: t.paydunyaToken,
          createdAt: t.createdAt
        })),
        stats: diagnosticData.stats,
        message: `Diagnostic avancé: ${diagnosticData.users.length} utilisateur(s), ${diagnosticData.pendingKyc.length} KYC en attente, ${diagnosticData.verifiedKyc.length} KYC vérifiés, ${diagnosticData.allTransactions.length} transaction(s)`
      });
    } catch (error: any) {
      console.error("Advanced diagnostic error:", error);
      res.status(500).json({
        success: false,
        error: "Erreur lors du diagnostic avancé",
        message: error.message
      });
    }
  });

  // Management routes
  app.post("/api/admin/promote", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "Identifiant utilisateur requis" });
      }
      const user = await storage.promoteToAdmin(userId);
      res.json(user);
    } catch (error: any) {
      console.error("Promote error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.post("/api/admin/remove-admin", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "Identifiant utilisateur requis" });
      }
      // Check if target user is primary admin
      const targetUser = await storage.getUser(userId);
      if (targetUser?.isPrimaryAdmin) {
        return res.status(403).json({ error: "Impossible de retirer les droits d'administration de l'administrateur principal" });
      }
      const user = await storage.removeAdminPrivilege(userId);
      res.json(user);
    } catch (error: any) {
      console.error("Remove admin error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.post("/api/admin/delete-user", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "Identifiant utilisateur requis" });
      }
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }
      if (targetUser.isPrimaryAdmin) {
        return res.status(403).json({ error: "Impossible de supprimer l'administrateur principal" });
      }
      const deleted = await storage.deleteUser(userId);
      if (!deleted) {
        return res.status(500).json({ error: "La suppression a échoué, l'utilisateur existe encore" });
      }
      clearAuthCache(userId);
      res.json({ success: true, message: `Compte ${targetUser.email} supprimé définitivement` });
    } catch (error: any) {
      console.error("Delete user error:", error);
      res.status(500).json({ error: "Une erreur est survenue lors de la suppression" });
    }
  });

  app.post("/api/admin/reset-user", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "Identifiant utilisateur requis" });
      }
      const targetUser = await storage.getUser(userId);
      if (targetUser?.isPrimaryAdmin) {
        return res.status(403).json({ error: "Impossible de reinitialiser l'administrateur principal" });
      }
      await storage.resetUserData(userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Reset user error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.post("/api/admin/suspend", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "Identifiant utilisateur requis" });
      }
      // Check if target user is primary admin
      const targetUser = await storage.getUser(userId);
      if (targetUser?.isPrimaryAdmin) {
        return res.status(403).json({ error: "Impossible de suspendre l'administrateur principal" });
      }
      const user = await storage.suspendUser(userId);
      if (!user) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }
      clearAuthCache(userId);
      res.json(user);
    } catch (error: any) {
      console.error("Suspend user error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.post("/api/admin/unsuspend", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "Identifiant utilisateur requis" });
      }
      const user = await storage.unsuspendUser(userId);
      if (!user) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }
      clearAuthCache(userId);
      
      // Also clear any temporary login suspension for this user
      clearTemporarySuspension(user.email);
      
      res.json(user);
    } catch (error: any) {
      console.error("Unsuspend user error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.post("/api/admin/toggle-transfers", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId, enabled } = req.body;
      if (!userId || typeof enabled !== "boolean") {
        return res.status(400).json({ error: "Paramètres invalides" });
      }
      const result = await pgPool.query(
        "UPDATE users SET transfers_enabled = $1 WHERE id = $2 RETURNING transfers_enabled",
        [enabled, userId]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: "Utilisateur non trouvé" });
      res.json({ success: true, transfersEnabled: result.rows[0].transfers_enabled });
    } catch (error: any) {
      console.error("Toggle transfers error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.post("/api/admin/toggle-withdrawals", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId, enabled } = req.body;
      if (!userId || typeof enabled !== "boolean") {
        return res.status(400).json({ error: "Paramètres invalides" });
      }
      const result = await pgPool.query(
        "UPDATE users SET withdrawals_enabled = $1 WHERE id = $2 RETURNING withdrawals_enabled",
        [enabled, userId]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: "Utilisateur non trouvé" });
      res.json({ success: true, withdrawalsEnabled: result.rows[0].withdrawals_enabled });
    } catch (error: any) {
      console.error("Toggle withdrawals error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.post("/api/admin/toggle-payout-api", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId, enabled } = req.body;
      if (!userId || typeof enabled !== "boolean") {
        return res.status(400).json({ error: "Paramètres invalides" });
      }
      const result = await pgPool.query(
        "UPDATE users SET payout_api_enabled = $1 WHERE id = $2 RETURNING payout_api_enabled",
        [enabled, userId]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: "Utilisateur non trouvé" });
      res.json({ success: true, payoutApiEnabled: result.rows[0].payout_api_enabled });
    } catch (error: any) {
      console.error("Toggle payout API error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.post("/api/admin/toggle-wave-payin", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId, enabled } = req.body;
      if (!userId || typeof enabled !== "boolean") {
        return res.status(400).json({ error: "Paramètres invalides" });
      }
      const result = await pgPool.query(
        "UPDATE users SET wave_payin_enabled = $1 WHERE id = $2 RETURNING wave_payin_enabled",
        [enabled, userId]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: "Utilisateur non trouvé" });
      res.json({ success: true, wavePayinEnabled: result.rows[0].wave_payin_enabled });
    } catch (error: any) {
      console.error("Toggle wave payin error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // Platform settings - deposit enabled (public)
  app.get("/api/platform-settings/deposit-enabled", async (req: Request, res: Response) => {
    try {
      const cached = getCachedSetting("deposit_enabled");
      if (cached !== undefined) return res.json(cached);
      const result = await pgPool.query(
        "SELECT value FROM platform_settings WHERE key = 'deposit_enabled'"
      );
      const enabled = result.rows.length > 0 ? result.rows[0].value === 'true' : true;
      const data = { enabled };
      setCachedSetting("deposit_enabled", data);
      res.json(data);
    } catch (error) {
      res.json({ enabled: true });
    }
  });

  // Platform settings - toggle deposit globally (admin only)
  app.post("/api/admin/toggle-deposit", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { enabled } = req.body;
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: "Valeur invalide" });
      }
      await pgPool.query(
        "INSERT INTO platform_settings (key, value, updated_at) VALUES ('deposit_enabled', $1, NOW()) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()",
        [enabled ? 'true' : 'false']
      );
      invalidateCachedSetting("deposit_enabled");
      if (enabled) {
        await pgPool.query("UPDATE users SET deposit_override_enabled = FALSE");
      }
      res.json({ success: true, enabled });
    } catch (error: any) {
      console.error("Toggle deposit error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // Admin - toggle deposit override for a specific user
  app.post("/api/admin/toggle-deposit-override", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId, enabled } = req.body;
      if (!userId || typeof enabled !== "boolean") {
        return res.status(400).json({ error: "Parametres invalides" });
      }
      const result = await pgPool.query(
        "UPDATE users SET deposit_override_enabled = $1 WHERE id = $2 RETURNING deposit_override_enabled",
        [enabled, userId]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: "Utilisateur non trouve" });
      res.json({ success: true, depositOverrideEnabled: result.rows[0].deposit_override_enabled });
    } catch (error: any) {
      console.error("Toggle deposit override error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // Platform settings - maintenance mode (public)
  app.get("/api/platform-settings/maintenance", async (req: Request, res: Response) => {
    try {
      const cached = getCachedSetting("maintenance_mode");
      if (cached !== undefined) return res.json(cached);
      const result = await pgPool.query(
        "SELECT value FROM platform_settings WHERE key = 'maintenance_mode'"
      );
      const enabled = result.rows.length > 0 ? result.rows[0].value === 'true' : false;
      const data = { enabled };
      setCachedSetting("maintenance_mode", data);
      res.json(data);
    } catch (error) {
      res.json({ enabled: false });
    }
  });

  // Platform settings - toggle maintenance mode (admin only)
  app.post("/api/admin/toggle-maintenance", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { enabled } = req.body;
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: "Valeur invalide" });
      }
      await pgPool.query(
        "INSERT INTO platform_settings (key, value, updated_at) VALUES ('maintenance_mode', $1, NOW()) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()",
        [enabled ? 'true' : 'false']
      );

      invalidateCachedSetting("maintenance_mode");

      if (enabled) {
        await pgPool.query(`
          DELETE FROM session 
          WHERE sid NOT IN (
            SELECT s.sid FROM session s
            JOIN users u ON u.id = (s.sess::json->>'userId')::text
            WHERE u.is_admin = true
          )
        `);
        console.log("[Maintenance] Mode maintenance active - toutes les sessions non-admin supprimees");
      } else {
        console.log("[Maintenance] Mode maintenance desactive");
      }

      res.json({ success: true, enabled });
    } catch (error: any) {
      console.error("Toggle maintenance error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // Platform settings - get emali status (public for authenticated users)
  app.get("/api/platform-settings/emali-enabled", async (req: Request, res: Response) => {
    try {
      const cached = getCachedSetting("emali_enabled");
      if (cached !== undefined) return res.json(cached);
      const result = await pgPool.query(
        "SELECT value FROM platform_settings WHERE key = 'emali_enabled'"
      );
      const enabled = result.rows.length > 0 ? result.rows[0].value === 'true' : true;
      const data = { enabled };
      setCachedSetting("emali_enabled", data);
      res.json(data);
    } catch (error) {
      res.json({ enabled: true });
    }
  });

  // Platform settings - toggle emali (admin only)
  app.post("/api/admin/toggle-emali", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { enabled } = req.body;
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: "Valeur invalide" });
      }
      await pgPool.query(
        "INSERT INTO platform_settings (key, value, updated_at) VALUES ('emali_enabled', $1, NOW()) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()",
        [enabled ? 'true' : 'false']
      );
      invalidateCachedSetting("emali_enabled");
      res.json({ success: true, enabled });
    } catch (error: any) {
      console.error("Toggle emali error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // Admin - Get login logs for a user
  app.get("/api/admin/login-logs/:userId", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const logs = await storage.getLoginLogsByUserId(userId, 100);
      res.json(logs);
    } catch (error: any) {
      console.error("Get login logs error:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des logs" });
    }
  });

  app.post("/api/admin/add-funds", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId, amount } = req.body;
      if (!userId || amount === undefined) {
        return res.status(400).json({ error: "Identifiant utilisateur et montant requis" });
      }
      const user = await storage.addFundsToUser(userId, amount);
      res.json(user);
    } catch (error: any) {
      console.error("Add funds error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.post("/api/admin/subtract-funds", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId, amount } = req.body;
      if (!userId || amount === undefined) {
        return res.status(400).json({ error: "Identifiant utilisateur et montant requis" });
      }
      const user = await storage.subtractFundsFromUser(userId, amount);
      res.json(user);
    } catch (error: any) {
      console.error("Subtract funds error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.post("/api/admin/approve-kyc", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "Identifiant utilisateur requis" });
      }
      // Check if target user is primary admin
      const targetUser = await storage.getUser(userId);
      if (targetUser?.isPrimaryAdmin) {
        return res.status(403).json({ error: "Impossible de modifier la KYC de l'administrateur principal" });
      }
      const user = await storage.approveKyc(userId);
      if (!user) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }

      // Send KYC verified email
      try {
        const { sendKycVerifiedEmail } = await import("./email-service");
        await sendKycVerifiedEmail(user.email, user.firstName);
      } catch (emailError) {
        console.error("Error sending KYC verified email:", emailError);
      }

      res.json(user);
    } catch (error: any) {
      console.error("Approve KYC error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.post("/api/admin/reject-kyc", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId, reason } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "Identifiant utilisateur requis" });
      }
      // Check if target user is primary admin
      const targetUser = await storage.getUser(userId);
      if (targetUser?.isPrimaryAdmin) {
        return res.status(403).json({ error: "Impossible de modifier la KYC de l'administrateur principal" });
      }
      const user = await storage.rejectKyc(userId, reason);
      if (!user) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }

      // Send KYC rejected email
      try {
        const { sendKycRejectedEmail } = await import("./email-service");
        await sendKycRejectedEmail(user.email, user.firstName, reason || "Raison non specifiee");
      } catch (emailError) {
        console.error("Error sending KYC rejected email:", emailError);
      }

      res.json(user);
    } catch (error: any) {
      console.error("Reject KYC error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.get("/api/admin/kyc-submissions", requireAdmin, async (req: Request, res: Response) => {
    try {
      // Get all KYC history (submitted, verified, rejected) - sorted with pending first
      const submissions = await storage.getKycHistory();
      // Sort: submitted first (pending verification), then by date descending
      const sorted = submissions.sort((a: any, b: any) => {
        // Submitted status comes first (awaiting verification)
        if (a.kycStatus === 'submitted' && b.kycStatus !== 'submitted') return -1;
        if (a.kycStatus !== 'submitted' && b.kycStatus === 'submitted') return 1;
        // Then sort by date descending
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      res.json(sorted);
    } catch (error: any) {
      console.error("Get KYC submissions error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.get("/api/admin/pending-kyc-count", requireAdmin, async (req: Request, res: Response) => {
    try {
      const submissions = await storage.getKycHistory();
      const pendingCount = submissions.filter((s: any) => s.kycStatus === 'submitted').length;
      res.json(pendingCount);
    } catch (error: any) {
      console.error("Get pending KYC count error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // User details viewing routes
  app.get("/api/admin/user/:userId/profile", requireAdmin, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.params.userId);
      if (!user) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }
      res.json(user);
    } catch (error: any) {
      console.error("Get user profile error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.get("/api/admin/user/:userId/transactions", requireAdmin, async (req: Request, res: Response) => {
    try {
      const transactions = await storage.getTransactions(req.params.userId);
      res.json(transactions);
    } catch (error: any) {
      console.error("Get user transactions error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.post("/api/admin/user/:userId/balance-adjust", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { amount, reason } = req.body;
      if (typeof amount !== "number" || amount === 0) {
        return res.status(400).json({ error: "Montant invalide. Fournissez un nombre non nul (positif pour créditer, négatif pour débiter)." });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }
      const newBalance = user.balance + amount;
      if (newBalance < 0) {
        return res.status(400).json({ error: `Solde insuffisant. Solde actuel: ${user.balance}. Ajustement: ${amount}.` });
      }
      await storage.updateUserBalance(userId, amount);
      const adminEmail = (req as any).user?.email || "admin";
      console.log(`[Admin Balance Adjust] ${adminEmail} adjusted balance of user ${userId} (${user.email}): ${user.balance} → ${newBalance} (${amount > 0 ? "+" : ""}${amount}). Reason: ${reason || "non précisé"}`);
      res.json({ success: true, previousBalance: user.balance, newBalance, adjustment: amount });
    } catch (error: any) {
      console.error("Balance adjust error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.post("/api/admin/transaction/:transactionId/change-status", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { transactionId } = req.params;
      const { newStatus } = req.body;

      if (!newStatus || !["completed", "failed"].includes(newStatus)) {
        return res.status(400).json({ error: "Statut invalide. Utilisez 'completed' ou 'failed'." });
      }

      const transaction = await storage.getTransaction(transactionId);
      if (!transaction) {
        return res.status(404).json({ error: "Transaction introuvable" });
      }

      const oldStatus = transaction.status;
      if (oldStatus === newStatus) {
        return res.status(400).json({ error: `La transaction est déjà en statut '${newStatus}'` });
      }

      const user = await storage.getUser(transaction.userId);
      if (!user) {
        return res.status(404).json({ error: "Utilisateur introuvable" });
      }

      let metadata: any = {};
      try { metadata = JSON.parse(transaction.metadata || "{}"); } catch {}

      const isIncoming = ["deposit", "payment_link", "merchant_link", "api_payment"].includes(transaction.type);
      const isOutgoing = ["withdrawal", "transfer"].includes(transaction.type);

      let netAmountForUser = metadata.netAmountForUser;
      if (typeof netAmountForUser !== "number") {
        if (metadata.customerPaysFee) {
          netAmountForUser = transaction.amount;
        } else {
          netAmountForUser = transaction.amount - (transaction.fee || 0);
        }
      }

      const adminSession = req.session as any;
      const adminUser = await storage.getUser(adminSession.userId);
      const adminEmail = adminUser?.email || "admin";

      // Update status FIRST to prevent race conditions (if status already changed, this is a no-op)
      const statusUpdateResult = await storage.updateTransactionStatus(transactionId, newStatus);
      if (!statusUpdateResult) {
        return res.status(409).json({ error: "La transaction a déjà été modifiée par un autre processus." });
      }

      // Re-verify the transaction was actually in the expected old status
      // by checking that our update succeeded from the right state
      if (newStatus === "failed" && oldStatus === "completed") {
        if (isIncoming) {
          if (user.balance < netAmountForUser) {
            // Rollback status
            await storage.updateTransactionStatus(transactionId, oldStatus);
            return res.status(400).json({ 
              error: `Solde insuffisant. Le solde de l'utilisateur (${user.balance}) est inférieur au montant à déduire (${netAmountForUser}).` 
            });
          }
          await storage.updateUserBalance(transaction.userId, -netAmountForUser);
          console.log(`[Admin] ${adminEmail} changed tx ${transactionId} completed->failed: deducted ${netAmountForUser} from user ${transaction.userId} (balance: ${user.balance} -> ${user.balance - netAmountForUser})`);
        } else if (isOutgoing) {
          await safeRefundOutgoingTransaction(transactionId, transaction.userId, metadata, "admin-status-completed-to-failed");
          console.log(`[Admin] ${adminEmail} changed tx ${transactionId} completed->failed`);
        }
      } else if (newStatus === "completed" && (oldStatus === "failed" || oldStatus === "pending")) {
        if (isIncoming) {
          await storage.updateUserBalance(transaction.userId, netAmountForUser);
          console.log(`[Admin] ${adminEmail} changed tx ${transactionId} ${oldStatus}->completed: credited ${netAmountForUser} to user ${transaction.userId} (balance: ${user.balance} -> ${user.balance + netAmountForUser})`);
        } else if (isOutgoing) {
          if (oldStatus === "pending") {
            console.log(`[Admin] ${adminEmail} changed outgoing tx ${transactionId} pending->completed: no balance change (already debited)`);
          } else {
            const debitAmount = metadata.deductedFromBalance || metadata.totalDebited || transaction.amount;
            if (user.balance < debitAmount) {
              // Rollback status
              await storage.updateTransactionStatus(transactionId, oldStatus);
              return res.status(400).json({ 
                error: `Solde insuffisant pour marquer comme complété. Solde: ${user.balance}, à débiter: ${debitAmount}` 
              });
            }
            await storage.updateUserBalance(transaction.userId, -debitAmount);
            console.log(`[Admin] ${adminEmail} changed tx ${transactionId} failed->completed: debited ${debitAmount} from user ${transaction.userId}`);
          }
        }
      }

      metadata.adminStatusChange = metadata.adminStatusChange || [];
      metadata.adminStatusChange.push({
        from: transaction.status,
        to: newStatus,
        by: adminEmail,
        at: new Date().toISOString(),
      });
      await storage.updateTransactionMetadata(transactionId, JSON.stringify(metadata));

      const updatedUser = await storage.getUser(transaction.userId);

      res.json({ 
        success: true, 
        message: `Statut changé de '${transaction.status}' à '${newStatus}' avec succès`,
        newBalance: updatedUser?.balance,
      });
    } catch (error: any) {
      console.error("[Admin] Change transaction status error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // Get all transactions for admin (with user info)
  app.get("/api/admin/all-transactions", requireAdmin, async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 500;
      const transactions = await storage.getAllTransactionsForAdmin(limit);
      res.json(transactions);
    } catch (error: any) {
      console.error("Get all transactions error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // Full-database transaction search for admin — no limit, searches by ID, phone, name, token, description
  app.get("/api/admin/search-transactions", requireAdmin, async (req: Request, res: Response) => {
    try {
      const q = (req.query.q as string || "").trim().toLowerCase();
      if (!q || q.length < 2) return res.json([]);

      const allTx = await storage.getAllTransactionsForAdmin(999999);
      const results = allTx.filter((tx: any) => {
        const txId = tx.id.toLowerCase();
        const customerName = (tx.customerName || "").toLowerCase();
        const customerEmail = (tx.customerEmail || "").toLowerCase();
        const customerPhone = (tx.customerPhone || "").toLowerCase();
        const paydunyaToken = (tx.paydunyaToken || "").toLowerCase();
        const description = (tx.description || "").toLowerCase();
        const metadata = (tx.metadata || "").toLowerCase();
        const userName = tx.user ? `${tx.user.firstName} ${tx.user.lastName}`.toLowerCase() : "";
        return (
          txId.includes(q) ||
          customerName.includes(q) ||
          customerEmail.includes(q) ||
          customerPhone.includes(q) ||
          paydunyaToken.includes(q) ||
          description.includes(q) ||
          metadata.includes(q) ||
          userName.includes(q)
        );
      });

      res.json(results.slice(0, 200));
    } catch (error: any) {
      console.error("Search transactions error:", error);
      res.status(500).json({ error: "Erreur lors de la recherche" });
    }
  });

  app.get("/api/admin/user/:userId/payment-links", requireAdmin, async (req: Request, res: Response) => {
    try {
      const links = await storage.getPaymentLinks(req.params.userId);
      res.json(links);
    } catch (error: any) {
      console.error("Get user payment links error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.get("/api/admin/user/:userId/merchant-links", requireAdmin, async (req: Request, res: Response) => {
    try {
      const links = await storage.getMerchantLinks(req.params.userId);
      res.json(links);
    } catch (error: any) {
      console.error("Get user merchant links error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.get("/api/admin/user/:userId/api-keys", requireAdmin, async (req: Request, res: Response) => {
    try {
      const keys = await storage.getApiKeys(req.params.userId);
      res.json(keys);
    } catch (error: any) {
      console.error("Get user api keys error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // Admin: get business tokens for a specific user
  app.get("/api/admin/business/users/:id/tokens", requireAdmin, async (req: Request, res: Response) => {
    try {
      const tokens = await storage.getBusinessTokensByUserId(req.params.id);
      res.json(tokens);
    } catch (error: any) {
      console.error("Get business tokens error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // Admin: get business wallets for a specific user
  app.get("/api/admin/business/users/:id/wallets", requireAdmin, async (req: Request, res: Response) => {
    try {
      const wallets = await storage.getBusinessWallets(req.params.id);
      res.json(wallets);
    } catch (error: any) {
      console.error("Get business wallets admin error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // ===== Pending Transactions Management =====
  app.get("/api/admin/pending-transactions", requireAdmin, async (req: Request, res: Response) => {
    try {
      const transactions = await storage.getAllPendingTransactions();
      res.json(transactions);
    } catch (error: any) {
      console.error("Get pending transactions error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.post("/api/admin/validate-transaction", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { transactionId } = req.body;
      if (!transactionId) {
        return res.status(400).json({ error: "Identifiant de transaction requis" });
      }

      const transaction = await storage.getTransaction(transactionId);
      if (!transaction) {
        return res.status(404).json({ error: "Transaction non trouvée" });
      }

      if (transaction.status !== "pending") {
        return res.status(400).json({ error: "Cette transaction n'est pas en attente" });
      }

      await storage.updateTransactionStatus(transactionId, "completed");

      if (transaction.metadata) {
        try {
          const meta = JSON.parse(transaction.metadata);
          if (meta.adminReviewPending) {
            delete meta.adminReviewPending;
            meta.adminValidatedAt = new Date().toISOString();
            meta.adminValidatedBy = (req as any).user?.id;
            await storage.updateTransactionMetadata(transactionId, JSON.stringify(meta));
          }
        } catch (e) {}
      }

      const incomingTypes = ["deposit", "payment_link", "merchant_link", "api_payment"];
      if (incomingTypes.includes(transaction.type)) {
        await storage.updateUserBalance(transaction.userId, transaction.amount);
      }

      res.json({ success: true, message: "Transaction validée avec succès" });
    } catch (error: any) {
      console.error("Validate transaction error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.post("/api/admin/reject-transaction", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { transactionId } = req.body;
      if (!transactionId) {
        return res.status(400).json({ error: "Identifiant de transaction requis" });
      }

      const transaction = await storage.getTransaction(transactionId);
      if (!transaction) {
        return res.status(404).json({ error: "Transaction non trouvée" });
      }

      if (transaction.status !== "pending") {
        return res.status(400).json({ error: "Cette transaction n'est pas en attente" });
      }

      await storage.updateTransactionStatus(transactionId, "failed");

      if (transaction.metadata) {
        try {
          const meta = JSON.parse(transaction.metadata);
          if (meta.adminReviewPending) {
            delete meta.adminReviewPending;
            meta.adminRejectedAt = new Date().toISOString();
            meta.adminRejectedBy = (req as any).user?.id;
            await storage.updateTransactionMetadata(transactionId, JSON.stringify(meta));
          }
        } catch (e) {}
      }

      if (transaction.type === "withdrawal" || transaction.type === "transfer") {
        const meta = JSON.parse(transaction.metadata || "{}");
        await safeRefundOutgoingTransaction(transactionId, transaction.userId, meta, "admin-reject");
      }

      res.json({ success: true, message: "Transaction rejetée" });
    } catch (error: any) {
      console.error("Reject transaction error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // ===== Country/Operator Config Routes (Multi-Provider) =====
  app.get("/api/admin/country-operator-config", requireAdmin, async (req: Request, res: Response) => {
    try {
      const configs = await storage.getCountryOperatorConfigs();
      res.json(configs);
    } catch (error: any) {
      console.error("Get country operator configs error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.get("/api/admin/country-operator-config/:provider", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { provider } = req.params;
      const configs = await storage.getCountryOperatorConfigsByProvider(provider);
      res.json(configs);
    } catch (error: any) {
      console.error("Get country operator configs by provider error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.put("/api/admin/country-operator-config/:provider/:country/:operator", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { provider, country, operator } = req.params;
      const { incomingEnabled, outgoingEnabled } = req.body;

      // Operator-level mutual exclusivity: if enabling an operator for one provider,
      // auto-disable the SAME operator for all OTHER providers
      // This allows different operators in the same country to be active on different providers
      if (incomingEnabled === true) {
        await storage.disableOperatorForOtherProviders(provider, country, operator, "incoming");
      }
      if (outgoingEnabled === true) {
        await storage.disableOperatorForOtherProviders(provider, country, operator, "outgoing");
      }

      const config = await storage.updateCountryOperatorConfig(provider, country, operator, {
        incomingEnabled,
        outgoingEnabled,
      });

      if (!config) {
        return res.status(404).json({ error: "Configuration non trouvée" });
      }

      res.json(config);
    } catch (error: any) {
      console.error("Update country operator config error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // Public endpoint - get enabled countries/operators for deposits (incoming)
  // Returns countries where payin is enabled at country-level, with their enabled operators
  // Countries appear even if no operators are enabled (empty array) - UI shows "no operators" message
  app.get("/api/countries-operators/deposits", async (req: Request, res: Response) => {
    try {
      const [configs, countryStatuses] = await Promise.all([
        storage.getCountryOperatorConfigs(),
        storage.getCountryStatuses(),
      ]);
      
      // First: get all countries where payin is enabled at country-level
      const payinEnabledCountries = new Set<string>();
      const payinEnabledMap = new Map<string, boolean>();
      for (const cs of countryStatuses) {
        if (cs.payinEnabled) {
          payinEnabledCountries.add(cs.country);
          payinEnabledMap.set(`${cs.provider}-${cs.country}`, true);
        }
      }
      
      // Initialize result with all payin-enabled countries (empty arrays)
      const result: Record<string, string[]> = {};
      Array.from(payinEnabledCountries).forEach(country => {
        result[country] = [];
      });
      
      // Add operators that are enabled at operator-level
      const enabledConfigs = configs.filter(
        (c) => c.incomingEnabled && payinEnabledMap.has(`${c.provider}-${c.country}`)
      );
      
      for (const config of enabledConfigs) {
        if (!result[config.country]) {
          result[config.country] = [];
        }
        // Avoid duplicates if same operator enabled for multiple providers
        if (!result[config.country].includes(config.operator)) {
          result[config.country].push(config.operator);
        }
      }
      res.json(result);
    } catch (error: any) {
      console.error("Get deposits config error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.get("/api/countries-operators/deposits/details", async (req: Request, res: Response) => {
    try {
      const [configs, countryStatuses] = await Promise.all([
        storage.getCountryOperatorConfigs(),
        storage.getCountryStatuses(),
      ]);
      
      const payinEnabledMap = new Map<string, boolean>();
      for (const cs of countryStatuses) {
        if (cs.payinEnabled) {
          payinEnabledMap.set(`${cs.provider}-${cs.country}`, true);
        }
      }
      
      const enabledConfigs = configs.filter(
        (c) => c.incomingEnabled && payinEnabledMap.has(`${c.provider}-${c.country}`)
      );
      
      const result: Record<string, Record<string, { provider: string; requiresOtp: boolean; otpInstructions?: string; otpUssdCode?: string; otpHint?: string; currency?: string }>> = {};
      
      for (const config of enabledConfigs) {
        if (!result[config.country]) {
          result[config.country] = {};
        }
        if (result[config.country][config.operator]) continue;
        
        let requiresOtp = false;
        let otpInstructions: string | undefined;
        let otpUssdCode: string | undefined;
        let otpHint: string | undefined;
        let operatorCurrency: string | undefined;
        
        if (config.provider === "paydunya") {
          const { requiresOTP, getUSSDInstruction } = await import("./paydunya-softpay");
          const operatorKey = `${config.operator}_${config.country.toLowerCase()}`;
          requiresOtp = requiresOTP(operatorKey);
          if (requiresOtp) {
            otpInstructions = getUSSDInstruction(operatorKey) || undefined;
          }
        } else if (config.provider === "mbiyopay") {
          const { mbiyoPayOperatorRequiresOtp, getMbiyoPayOtpInstructions } = await import("./mbiyopay");
          requiresOtp = mbiyoPayOperatorRequiresOtp(config.country, config.operator);
          if (requiresOtp) {
            const info = getMbiyoPayOtpInstructions(config.country);
            otpInstructions = info.instructions;
            otpUssdCode = info.ussdCode;
            otpHint = info.hint;
          }
        } else if (config.provider === "afribapay") {
          const { operatorRequiresOtpForCountry, getOtpInstructionsForOperator, getOtpUssdCode } = await import("@shared/afribapay-countries");
          requiresOtp = operatorRequiresOtpForCountry(config.country, config.operator);
          if (requiresOtp) {
            otpInstructions = getOtpInstructionsForOperator(config.country, config.operator) || undefined;
            otpUssdCode = getOtpUssdCode(config.country, config.operator) || undefined;
          }
        } else if (config.provider === "pawapay") {
          const { pawaPayOperatorRequiresOtp, getPawaPayOtpInstructions, getCurrencyForOperator: pawaGetCurrency } = await import("@shared/pawapay-countries");
          requiresOtp = pawaPayOperatorRequiresOtp(config.country, config.operator);
          if (requiresOtp) {
            const info = getPawaPayOtpInstructions(config.country);
            otpInstructions = info.instructions;
            otpUssdCode = info.ussdCode;
            otpHint = info.hint;
          }
          operatorCurrency = pawaGetCurrency(config.country, config.operator);
        }
        
        result[config.country][config.operator] = {
          provider: config.provider,
          requiresOtp,
          ...(otpInstructions && { otpInstructions }),
          ...(otpUssdCode && { otpUssdCode }),
          ...(otpHint && { otpHint }),
          ...(operatorCurrency && { currency: operatorCurrency }),
        };
      }
      
      res.json(result);
    } catch (error: any) {
      console.error("Get deposits details config error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // Public endpoint - get enabled countries/operators for withdrawals (outgoing)
  // Returns countries where payout is enabled at country-level, with their enabled operators
  // Countries appear even if no operators are enabled (empty array) - UI shows "no operators" message
  app.get("/api/countries-operators/withdrawals", async (req: Request, res: Response) => {
    try {
      const [configs, countryStatuses] = await Promise.all([
        storage.getCountryOperatorConfigs(),
        storage.getCountryStatuses(),
      ]);
      
      // First: get all countries where payout is enabled at country-level
      const payoutEnabledCountries = new Set<string>();
      const payoutEnabledMap = new Map<string, boolean>();
      for (const cs of countryStatuses) {
        if (cs.payoutEnabled) {
          payoutEnabledCountries.add(cs.country);
          payoutEnabledMap.set(`${cs.provider}-${cs.country}`, true);
        }
      }
      
      // Initialize result with all payout-enabled countries (empty arrays)
      const result: Record<string, string[]> = {};
      Array.from(payoutEnabledCountries).forEach(country => {
        result[country] = [];
      });
      
      // Add operators that are enabled at operator-level
      const enabledConfigs = configs.filter(
        (c) => c.outgoingEnabled && payoutEnabledMap.has(`${c.provider}-${c.country}`)
      );
      
      for (const config of enabledConfigs) {
        if (!result[config.country]) {
          result[config.country] = [];
        }
        // Avoid duplicates if same operator enabled for multiple providers
        if (!result[config.country].includes(config.operator)) {
          result[config.country].push(config.operator);
        }
      }
      res.json(result);
    } catch (error: any) {
      console.error("Get withdrawals config error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // Initialize country/operator configs on startup
  await storage.initializeCountryOperatorConfigs();
  await storage.initializeCountryStatuses();
  await storage.initializeProviderConfigs();

  // ===== Country Status Routes (Country-level payin/payout control per provider) =====
  app.get("/api/admin/country-status", requireAdmin, async (req: Request, res: Response) => {
    try {
      const statuses = await storage.getCountryStatuses();
      res.json(statuses);
    } catch (error: any) {
      console.error("Get country statuses error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.get("/api/admin/country-status/:provider", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { provider } = req.params;
      const statuses = await storage.getCountryStatusesByProvider(provider);
      res.json(statuses);
    } catch (error: any) {
      console.error("Get country statuses by provider error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.put("/api/admin/country-status/:provider/:country", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { provider, country } = req.params;
      const { payinEnabled, payoutEnabled } = req.body;

      // If enabling, disable same country for other providers (mutual exclusivity)
      if (payinEnabled === true) {
        await storage.disableCountryForOtherProviders(provider, country, "incoming");
      }
      if (payoutEnabled === true) {
        await storage.disableCountryForOtherProviders(provider, country, "outgoing");
      }

      const status = await storage.updateCountryStatus(provider, country, {
        payinEnabled,
        payoutEnabled,
      });

      if (!status) {
        return res.status(404).json({ error: "Pays non trouvé" });
      }

      res.json(status);
    } catch (error: any) {
      console.error("Update country status error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // ===== Crypto Currencies Admin Routes =====
  app.get("/api/admin/crypto-currencies", requireAdmin, async (req: Request, res: Response) => {
    try {
      const cryptosInDb = await storage.getAllCryptoCurrencies();
      const cryptoMap = new Map<string, any>();

      for (const c of SUPPORTED_CRYPTOCURRENCIES) {
        cryptoMap.set(c.code, {
          id: null,
          code: c.code,
          name: c.name,
          symbol: c.symbol,
          payinEnabled: false,
          payoutEnabled: false,
          minAmount: null,
        });
      }

      for (const dbCrypto of cryptosInDb) {
        cryptoMap.set(dbCrypto.code, {
          id: dbCrypto.id,
          code: dbCrypto.code,
          name: dbCrypto.name,
          symbol: dbCrypto.symbol,
          payinEnabled: dbCrypto.payinEnabled,
          payoutEnabled: dbCrypto.payoutEnabled,
          minAmount: dbCrypto.minAmount,
        });
      }

      res.json(Array.from(cryptoMap.values()));
    } catch (error: any) {
      console.error("Get crypto currencies error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.put("/api/admin/crypto-currencies/:code", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { code } = req.params;
      const { payinEnabled, payoutEnabled } = req.body;

      const updates: any = {};
      if (typeof payinEnabled === "boolean") updates.payinEnabled = payinEnabled;
      if (typeof payoutEnabled === "boolean") updates.payoutEnabled = payoutEnabled;

      const existing = await storage.getCryptoCurrencyByCode(code);

      if (existing) {
        const updated = await storage.updateCryptoCurrency(code, updates);
        res.json(updated);
      } else {
        const cryptoInfo = SUPPORTED_CRYPTOCURRENCIES.find((c) => c.code === code);
        if (!cryptoInfo) {
          return res.status(404).json({ error: "Cryptomonnaie non trouvee" });
        }
        const created = await storage.createCryptoCurrency({
          code: cryptoInfo.code,
          name: cryptoInfo.name,
          symbol: cryptoInfo.symbol,
          payinEnabled: typeof payinEnabled === "boolean" ? payinEnabled : true,
          payoutEnabled: typeof payoutEnabled === "boolean" ? payoutEnabled : true,
        });
        res.json(created);
      }
    } catch (error: any) {
      console.error("Update crypto currency error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // ===== Fee Configuration Routes =====
  app.get("/api/admin/fee-configs", requireAdmin, async (req: Request, res: Response) => {
    try {
      const configs = await storage.getAllFeeConfigs();
      res.json(configs);
    } catch (error: any) {
      console.error("Get fee configs error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.get("/api/admin/fee-configs/provider/:provider", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { provider } = req.params;
      const configs = await storage.getFeeConfigsByProvider(provider);
      res.json(configs);
    } catch (error: any) {
      console.error("Get fee configs by provider error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.get("/api/admin/fee-configs/:country", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { country } = req.params;
      const configs = await storage.getFeeConfigsByCountry(country);
      res.json(configs);
    } catch (error: any) {
      console.error("Get fee configs by country error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.put("/api/admin/fee-configs/:provider/:country/:operator", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { provider, country, operator } = req.params;
      const { incomingFeePercentage, outgoingFeePercentage } = req.body;

      // Validate fee percentages (0-100 as whole number, stored as 0-1000)
      if (incomingFeePercentage !== undefined && (incomingFeePercentage < 0 || incomingFeePercentage > 1000)) {
        return res.status(400).json({ error: "Le pourcentage des frais entrants doit etre entre 0 et 100" });
      }
      if (outgoingFeePercentage !== undefined && (outgoingFeePercentage < 0 || outgoingFeePercentage > 1000)) {
        return res.status(400).json({ error: "Le pourcentage des frais sortants doit etre entre 0 et 100" });
      }

      // Check if config exists, create if not
      let config = await storage.getFeeConfig(provider, country, operator);
      if (!config) {
        config = await storage.createOrUpdateFeeConfig({
          provider,
          country,
          operator,
          incomingFeePercentage: incomingFeePercentage ?? 60,
          outgoingFeePercentage: outgoingFeePercentage ?? 60,
        });
      } else {
        config = await storage.updateFeeConfig(provider, country, operator, {
          incomingFeePercentage,
          outgoingFeePercentage,
        });
      }

      res.json(config);
    } catch (error: any) {
      console.error("Update fee config error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // Get/Update NOWPayments crypto global fee settings (markup and crypto fee)
  app.get("/api/admin/crypto-fee-settings", requireAdmin, async (req: Request, res: Response) => {
    try {
      const config = await storage.getProviderConfig("nowpayments");
      res.json({
        cryptoMarkupPercent: config?.cryptoMarkupPercent ?? 100,
        cryptoFeePercent: config?.cryptoFeePercent ?? 150,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.put("/api/admin/crypto-fee-settings", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { cryptoMarkupPercent, cryptoFeePercent } = req.body;
      if (cryptoMarkupPercent !== undefined && (cryptoMarkupPercent < 0 || cryptoMarkupPercent > 1000)) {
        return res.status(400).json({ error: "Le pourcentage de markup doit etre entre 0 et 100" });
      }
      if (cryptoFeePercent !== undefined && (cryptoFeePercent < 0 || cryptoFeePercent > 1000)) {
        return res.status(400).json({ error: "Le pourcentage de frais crypto doit etre entre 0 et 100" });
      }

      const updateData: any = {};
      if (cryptoMarkupPercent !== undefined) updateData.cryptoMarkupPercent = cryptoMarkupPercent;
      if (cryptoFeePercent !== undefined) updateData.cryptoFeePercent = cryptoFeePercent;

      await storage.updateProviderConfig("nowpayments", updateData);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Update crypto fee settings error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // ===== Currency Exchange Fee Routes =====
  app.get("/api/admin/currency-exchange-fees", requireAdmin, async (req: Request, res: Response) => {
    try {
      const fees = await storage.getAllCurrencyExchangeFees();
      res.json(fees);
    } catch (error: any) {
      console.error("Get currency exchange fees error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.put("/api/admin/currency-exchange-fees/:fromCurrency/:toCurrency", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { fromCurrency, toCurrency } = req.params;
      const { feePercentage, isActive } = req.body;

      if (feePercentage === undefined || feePercentage < 0 || feePercentage > 1000) {
        return res.status(400).json({ error: "Le pourcentage des frais doit être entre 0 et 100" });
      }

      const fee = await storage.upsertCurrencyExchangeFee(
        fromCurrency.toUpperCase(),
        toCurrency.toUpperCase(),
        Math.round(feePercentage),
        isActive !== undefined ? (isActive ? 1 : 0) : 1
      );
      res.json(fee);
    } catch (error: any) {
      console.error("Update currency exchange fee error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // Public endpoint to get currency exchange fee for a pair
  app.get("/api/currency-exchange-fee/:fromCurrency/:toCurrency", async (req: Request, res: Response) => {
    try {
      const { fromCurrency, toCurrency } = req.params;
      const fee = await storage.getCurrencyExchangeFee(fromCurrency.toUpperCase(), toCurrency.toUpperCase());
      res.json({
        fromCurrency: fromCurrency.toUpperCase(),
        toCurrency: toCurrency.toUpperCase(),
        feePercentage: fee?.feePercentage ?? 0,
        isActive: fee?.isActive ?? 1,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // Public endpoint to get fee for a specific provider/country/operator (3 params - must be first)
  app.get("/api/fees/:provider/:country/:operator", async (req: Request, res: Response) => {
    try {
      const { provider, country, operator } = req.params;
      const config = await storage.getFeeConfig(provider.toLowerCase(), country.toUpperCase(), operator.toLowerCase());
      
      if (config) {
        res.json({
          incomingFeePercentage: config.incomingFeePercentage,
          outgoingFeePercentage: config.outgoingFeePercentage,
        });
      } else {
        // Default to 6% if no config exists
        res.json({
          incomingFeePercentage: 60,
          outgoingFeePercentage: 60,
        });
      }
    } catch (error: any) {
      console.error("Get fee error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // Public endpoint to get fee for a country/operator (uses SAME logic as deposit/withdrawal)
  app.get("/api/fees/:country/:operator", async (req: Request, res: Response) => {
    try {
      const { country, operator } = req.params;
      const countryUpper = country.toUpperCase();
      const operatorLower = operator.toLowerCase();
      
      let incomingFeePercentage = 60; // Default 6%
      let outgoingFeePercentage = 60; // Default 6%
      let payinProvider = null;
      let payoutProvider = null;
      
      // Use the SAME logic as getActiveProviderForDeposit to find the correct payin provider
      const depositProvider = await getActiveProviderForDeposit(countryUpper, operatorLower);
      if (depositProvider) {
        payinProvider = depositProvider;
        const feeConfig = await storage.getFeeConfig(
          depositProvider.toLowerCase(), 
          countryUpper, 
          operatorLower
        );
        if (feeConfig) {
          incomingFeePercentage = feeConfig.incomingFeePercentage ?? 60;
          console.log(`[Fees] Incoming fee from ${depositProvider}/${countryUpper}/${operatorLower}: ${incomingFeePercentage}`);
        }
      }
      
      // Use the SAME logic as getActiveProviderForWithdrawal to find the correct payout provider
      const withdrawalProvider = await getActiveProviderForWithdrawal(countryUpper, operatorLower);
      if (withdrawalProvider) {
        payoutProvider = withdrawalProvider;
        const feeConfig = await storage.getFeeConfig(
          withdrawalProvider.toLowerCase(), 
          countryUpper, 
          operatorLower
        );
        if (feeConfig) {
          outgoingFeePercentage = feeConfig.outgoingFeePercentage ?? 60;
          console.log(`[Fees] Outgoing fee from ${withdrawalProvider}/${countryUpper}/${operatorLower}: ${outgoingFeePercentage}`);
        }
      }
      
      res.json({
        incomingFeePercentage,
        outgoingFeePercentage,
        payinProvider,
        payoutProvider,
      });
    } catch (error: any) {
      console.error("Get fee error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // DB migration: add user_id column to fee_configs if missing
  try {
    const pgMig = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    await pgMig.query(`ALTER TABLE fee_configs ADD COLUMN IF NOT EXISTS user_id VARCHAR REFERENCES users(id)`);
    await pgMig.end();
    console.log("[Migration] fee_configs.user_id column ensured");
  } catch (migErr) {
    console.warn("[Migration] Could not add user_id to fee_configs:", migErr);
  }

  // Initialize fee configs
  await storage.initializeFeeConfigs();
  await storage.ensurePaydunyaFeeConfigs();
  await storage.ensurePawaPayFeeConfigs();
  await storage.ensureFeeXPayFeeConfigs();
  await storage.ensureMoneyFusionFeeConfigs();
  await storage.initializeCurrencyExchangeFees();

  // ===== Provider Config Routes (API Keys Management) =====
  app.get("/api/admin/pawapay/active-conf", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { getPawaPayActiveConf } = await import("./pawapay");
      const operationType = req.query.operation as string | undefined;
      const result = await getPawaPayActiveConf(operationType);
      res.json(result);
    } catch (error: any) {
      console.error("[Admin PawaPay ActiveConf] Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/admin/providers", requireAdmin, async (req: Request, res: Response) => {
    try {
      const configs = await storage.getProviderConfigs();
      // Mask API keys for security - only show first/last chars
      // For mailtrap: masterKey, token, ipnSecret are boolean toggles ("true"/"false"), don't mask
      const masked = configs.map(c => {
        const isMailtrap = c.provider === "mailtrap";
        return {
          ...c,
          apiKey: c.apiKey ? `${c.apiKey.slice(0, 8)}...${c.apiKey.slice(-4)}` : null,
          secretKey: isMailtrap ? c.secretKey : (c.secretKey ? `${c.secretKey.slice(0, 8)}...${c.secretKey.slice(-4)}` : null),
          publicKey: isMailtrap ? c.publicKey : (c.publicKey ? `${c.publicKey.slice(0, 8)}...${c.publicKey.slice(-4)}` : null),
          masterKey: isMailtrap ? c.masterKey : (c.masterKey ? `${c.masterKey.slice(0, 8)}...${c.masterKey.slice(-4)}` : null),
          token: isMailtrap ? c.token : (c.token ? `${c.token.slice(0, 8)}...${c.token.slice(-4)}` : null),
          ipnSecret: isMailtrap ? c.ipnSecret : (c.ipnSecret ? `${c.ipnSecret.slice(0, 8)}...${c.ipnSecret.slice(-4)}` : null),
        };
      });
      res.json(masked);
    } catch (error: any) {
      console.error("Get provider configs error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.put("/api/admin/providers/:provider", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { provider } = req.params;
      const { isActive, apiKey, secretKey, publicKey, masterKey, token, ipnSecret } = req.body;

      const updates: any = { updatedAt: new Date() };
      if (typeof isActive === "boolean") updates.isActive = isActive;
      if (apiKey !== undefined) updates.apiKey = apiKey || null;
      if (secretKey !== undefined) updates.secretKey = secretKey || null;
      if (publicKey !== undefined) updates.publicKey = publicKey || null;
      if (masterKey !== undefined) updates.masterKey = masterKey || null;
      if (token !== undefined) updates.token = token || null;
      if (ipnSecret !== undefined) updates.ipnSecret = ipnSecret || null;

      let config = await storage.updateProviderConfig(provider, updates);

      if (!config) {
        // Provider doesn't exist yet — initialize all missing providers and retry
        await storage.initializeProviderConfigs();
        config = await storage.updateProviderConfig(provider, updates);
        if (!config) return res.status(404).json({ error: "Fournisseur non trouvé" });
      }

      // Clear Mailtrap config cache when settings are updated
      if (provider === "mailtrap") {
        clearEmailConfigCache();
        console.log("[Admin] Configuration mailtrap mise à jour - cache vidé");
      }

      // Mask keys in response (except mailtrap toggles)
      const isMailtrap = provider === "mailtrap";
      res.json({
        ...config,
        apiKey: config.apiKey ? `${config.apiKey.slice(0, 8)}...${config.apiKey.slice(-4)}` : null,
        secretKey: isMailtrap ? config.secretKey : (config.secretKey ? `${config.secretKey.slice(0, 8)}...${config.secretKey.slice(-4)}` : null),
        publicKey: isMailtrap ? config.publicKey : (config.publicKey ? `${config.publicKey.slice(0, 8)}...${config.publicKey.slice(-4)}` : null),
        masterKey: isMailtrap ? config.masterKey : (config.masterKey ? `${config.masterKey.slice(0, 8)}...${config.masterKey.slice(-4)}` : null),
        token: isMailtrap ? config.token : (config.token ? `${config.token.slice(0, 8)}...${config.token.slice(-4)}` : null),
        ipnSecret: isMailtrap ? config.ipnSecret : (config.ipnSecret ? `${config.ipnSecret.slice(0, 8)}...${config.ipnSecret.slice(-4)}` : null),
      });
    } catch (error: any) {
      console.error("Update provider config error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // Test email connection
  app.post("/api/admin/test-email", requireAdmin, async (req: Request, res: Response) => {
    try {
      clearEmailConfigCache();
      const success = await testEmailConnection();
      
      if (success) {
        res.json({ success: true, message: "Connexion Mailtrap réussie" });
      } else {
        res.status(400).json({ success: false, error: "Impossible de se connecter à Mailtrap. Vérifiez vos identifiants." });
      }
    } catch (error: any) {
      console.error("[Admin] Test email error:", error);
      res.status(500).json({ success: false, error: error.message || "Erreur lors du test" });
    }
  });

  // Support Settings - Public endpoint (for all users to see support info)
  app.get("/api/support-settings", async (req: Request, res: Response) => {
    try {
      let settings = await storage.getSupportSettings();
      
      // If no settings exist, create default settings
      if (!settings) {
        settings = await storage.updateSupportSettings({
          supportEmail: "support@bkapay.com",
          supportPhone: "+229 01 46 44 73 19",
          whatsappLink: "https://chat.whatsapp.com/DRe55FMRXCt87VxNvjF1EF",
          supportWhatsappPhone: "",
        });
      }
      
      res.json(settings);
    } catch (error: any) {
      console.error("[SupportSettings] Get error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // Support Settings - Admin update endpoint
  app.put("/api/admin/support-settings", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { supportEmail, supportPhone, whatsappLink, supportWhatsappPhone } = req.body;
      
      // Validate inputs
      if (supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) {
        return res.status(400).json({ error: "Email invalide" });
      }
      if (supportPhone && supportPhone.length < 8) {
        return res.status(400).json({ error: "Numéro de téléphone invalide" });
      }
      if (whatsappLink && !/^https?:\/\//.test(whatsappLink)) {
        return res.status(400).json({ error: "Lien WhatsApp invalide" });
      }
      
      const settings = await storage.updateSupportSettings({
        supportEmail,
        supportPhone,
        whatsappLink,
        supportWhatsappPhone: supportWhatsappPhone || "",
      });
      
      console.log("[SupportSettings] Updated by admin:", settings);
      res.json({ success: true, settings });
    } catch (error: any) {
      console.error("[SupportSettings] Update error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // ==================== EMALI Chat Endpoint ====================
  app.post("/api/emali-chat", requireAuth, async (req: Request, res: Response) => {
    try {
      const { messages: userMessages } = req.body;
      if (!userMessages || !Array.isArray(userMessages)) {
        return res.status(400).json({ error: "Messages requis" });
      }

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const { COUNTRIES, OPERATORS, COLLECT_COUNTRIES, PAYOUT_COUNTRIES } = await import("@shared/schema");

      const currentUserId = req.session?.userId;

      // Collect real-time data from DB
      const [feeConfigsData, countryStatusData, countryOperatorConfigsData, cryptoCurrenciesData, providerConfigsData, supportSettingsData, currentUser, userStats, exchangeFeesData] = await Promise.all([
        storage.getAllFeeConfigs(),
        storage.getCountryStatuses(),
        storage.getCountryOperatorConfigs(),
        storage.getAllCryptoCurrencies(),
        storage.getProviderConfigs(),
        storage.getSupportSettings(),
        currentUserId ? storage.getUser(currentUserId) : Promise.resolve(null),
        currentUserId ? storage.getUserStats(currentUserId) : Promise.resolve(null),
        storage.getAllCurrencyExchangeFees(),
      ]);

      // Build unified country + operator + fees + availability info
      const countryInfoLines: string[] = [];
      const transferCountryLines: string[] = [];
      const withdrawalCountryLines: string[] = [];
      const countryFeeDetailLines: string[] = [];

      // Si country_status est vide, se baser sur provider_configs (clé API présente) pour déterminer les providers actifs
      const noStatusData = countryStatusData.length === 0;
      const noOpConfigData = countryOperatorConfigsData.length === 0;
      // Providers considérés comme actifs : ceux qui ont une clé API/token/secretKey configurée OU isActive = true
      // Peuplé TOUJOURS (pas seulement quand noStatusData) pour servir de fallback robuste
      const activeProvidersByKey = new Set<string>();
      for (const pc of providerConfigsData) {
        const hasAnyKey = (pc.apiKey && pc.apiKey.trim() !== "") ||
                          (pc.secretKey && (pc.secretKey as any)?.trim() !== "") ||
                          (pc.masterKey && (pc.masterKey as any)?.trim() !== "") ||
                          (pc.token && (pc.token as any)?.trim() !== "");
        if (hasAnyKey || pc.isActive) {
          activeProvidersByKey.add(pc.provider);
        }
      }

      const countryFlagMap: Record<string, string> = {
        "BJ": "🇧🇯", "CI": "🇨🇮", "SN": "🇸🇳", "TG": "🇹🇬", "BF": "🇧🇫",
        "CM": "🇨🇲", "CD": "🇨🇩", "CG": "🇨🇬", "ML": "🇲🇱", "GN": "🇬🇳",
        "NE": "🇳🇪", "RW": "🇷🇼", "GA": "🇬🇦", "ZM": "🇿🇲", "UG": "🇺🇬", "GH": "🇬🇭",
      };

      for (const country of COUNTRIES) {
        const countryCode = country.code as keyof typeof OPERATORS;
        const operators = OPERATORS[countryCode] || [];
        const statuses = countryStatusData.filter((cs: any) => cs.country === country.code);
        const countryFees = feeConfigsData.filter((fc: any) => fc.country === country.code && fc.scope === "personal");
        const opConfigs = countryOperatorConfigsData.filter((oc: any) => oc.country === country.code);

        const payinActiveOps: string[] = [];
        const payoutActiveOps: string[] = [];

        const payinLines: string[] = [];
        const payoutLines: string[] = [];

        for (const op of operators) {
          const opProviders = countryFees.filter((fc: any) => fc.operator === op.code);

          // Determine which fee entry to use — pick the ACTIVE provider's fee, not just the first
          let activeFeeIn: any = opProviders[0];
          let activeFeeOut: any = opProviders[0];
          let hasPayin: boolean;
          let hasPayout: boolean;

          if (noStatusData) {
            // Pas de statuts configurés : actif si le provider a une clé API et a des frais pour cet opérateur
            const activeEntry = opProviders.find((fc: any) => activeProvidersByKey.has(fc.provider));
            if (activeEntry) { activeFeeIn = activeEntry; activeFeeOut = activeEntry; }
            hasPayin = opProviders.some((fc: any) => activeProvidersByKey.has(fc.provider));
            hasPayout = opProviders.some((fc: any) => activeProvidersByKey.has(fc.provider));
          } else {
            const payinEntry = opProviders.find((fc: any) => {
              const providerEnabled = statuses.some((cs: any) => cs.provider === fc.provider && cs.payinEnabled);
              if (!providerEnabled) return false;
              if (noOpConfigData) return true;
              const oc = opConfigs.find((c: any) => c.provider === fc.provider && c.operator === op.code);
              return oc ? oc.incomingEnabled : true;
            });
            const payoutEntry = opProviders.find((fc: any) => {
              const providerEnabled = statuses.some((cs: any) => cs.provider === fc.provider && cs.payoutEnabled);
              if (!providerEnabled) return false;
              if (noOpConfigData) return true;
              const oc = opConfigs.find((c: any) => c.provider === fc.provider && c.operator === op.code);
              return oc ? oc.outgoingEnabled : true;
            });
            if (payinEntry) activeFeeIn = payinEntry;
            if (payoutEntry) activeFeeOut = payoutEntry;
            hasPayin = !!payinEntry;
            hasPayout = !!payoutEntry;

            // Fallback robuste : si aucun opérateur trouvé via les statuts DB mais qu'un provider
            // actif (clé API ou isActive) gère cet opérateur, on le considère disponible
            if (!hasPayin && !hasPayout && opProviders.some((fc: any) => activeProvidersByKey.has(fc.provider))) {
              const fallbackEntry = opProviders.find((fc: any) => activeProvidersByKey.has(fc.provider));
              if (fallbackEntry) { activeFeeIn = fallbackEntry; activeFeeOut = fallbackEntry; }
              hasPayin = true;
              hasPayout = true;
            }
          }

          const inPct = activeFeeIn ? (activeFeeIn.incomingFeePercentage / 10).toFixed(1) : "N/A";
          const outPct = activeFeeOut ? (activeFeeOut.outgoingFeePercentage / 10).toFixed(1) : "N/A";

          // Include operator code in display so EMALI knows the exact code to use in tools
          if (hasPayin) payinActiveOps.push(`${op.name} [code: ${op.code}]`);
          if (hasPayout) payoutActiveOps.push(`${op.name} [code: ${op.code}]`);

          const payinStatus = hasPayin ? "DISPONIBLE" : "NON DISPONIBLE";
          const payoutStatus = hasPayout ? "DISPONIBLE" : "NON DISPONIBLE";
          payinLines.push(`    - ${op.name} (code: ${op.code}): Frais ${inPct}% → ${payinStatus}`);
          payoutLines.push(`    - ${op.name} (code: ${op.code}): Frais ${outPct}% → ${payoutStatus}`);
        }

        // Simple availability line for transfer/withdrawal lists (avec drapeaux)
        if (payoutActiveOps.length > 0) {
          const ctryFlag = countryFlagMap[country.code] || "🌍";
          transferCountryLines.push(`${ctryFlag} ${country.name} (${country.code}): ${payoutActiveOps.join(", ")}`);
          if (currentUser && currentUser.country === country.code) {
            withdrawalCountryLines.push(`${ctryFlag} ${country.name} (${country.code}): ${payoutActiveOps.join(", ")}`);
          }
        }

        // Simple country info line
        const payinText = payinActiveOps.length > 0
          ? `Paiements entrants (dépôts): ${payinActiveOps.join(", ")}`
          : "Paiements entrants (dépôts): Aucun opérateur actif";
        const payoutText = payoutActiveOps.length > 0
          ? `Paiements sortants (retraits): ${payoutActiveOps.join(", ")}`
          : "Paiements sortants (retraits): Aucun opérateur actif";
        countryInfoLines.push(`- ${country.name} (${country.code}): Devise ${country.currency}, Indicatif ${country.phoneCode}\n    ${payinText}\n    ${payoutText}`);

        // Detailed fee block per country — structured for EMALI display
        const flag = countryFlagMap[country.code] || "🌍";
        const opCount = operators.length;
        if (opCount > 0) {
          // Build operator lines first — only add country if at least one operator is active
          const activeOpLines: string[] = [];
          for (const op of operators) {
            const opProviders = countryFees.filter((fc: any) => fc.operator === op.code);
            if (opProviders.length === 0) continue;

            // Pick the ACTIVE provider's fee entry for each direction
            let detailFeeIn: any = opProviders[0];
            let detailFeeOut: any = opProviders[0];
            let hasPayin: boolean;
            let hasPayout: boolean;

            if (noStatusData) {
              const activeEntry = opProviders.find((fc: any) => activeProvidersByKey.has(fc.provider));
              if (activeEntry) { detailFeeIn = activeEntry; detailFeeOut = activeEntry; }
              hasPayin = opProviders.some((fc: any) => activeProvidersByKey.has(fc.provider));
              hasPayout = opProviders.some((fc: any) => activeProvidersByKey.has(fc.provider));
            } else {
              const payinEntry = opProviders.find((fc: any) => {
                const providerEnabled = statuses.some((cs: any) => cs.provider === fc.provider && cs.payinEnabled);
                if (!providerEnabled) return false;
                if (noOpConfigData) return true;
                const oc = opConfigs.find((c: any) => c.provider === fc.provider && c.operator === op.code);
                return oc ? oc.incomingEnabled : true;
              });
              const payoutEntry = opProviders.find((fc: any) => {
                const providerEnabled = statuses.some((cs: any) => cs.provider === fc.provider && cs.payoutEnabled);
                if (!providerEnabled) return false;
                if (noOpConfigData) return true;
                const oc = opConfigs.find((c: any) => c.provider === fc.provider && c.operator === op.code);
                return oc ? oc.outgoingEnabled : true;
              });
              if (payinEntry) detailFeeIn = payinEntry;
              if (payoutEntry) detailFeeOut = payoutEntry;
              hasPayin = !!payinEntry;
              hasPayout = !!payoutEntry;
            }

            if (!hasPayin && !hasPayout) continue;
            const inPct = detailFeeIn ? (detailFeeIn.incomingFeePercentage / 10).toFixed(1) : "N/A";
            const outPct = detailFeeOut ? (detailFeeOut.outgoingFeePercentage / 10).toFixed(1) : "N/A";
            const parts: string[] = [];
            if (hasPayin) parts.push(`Entrant: ${inPct}%`);
            if (hasPayout) parts.push(`Sortant: ${outPct}%`);
            // Include operator code so EMALI knows the exact code to pass to tools
            activeOpLines.push(`  • ${op.name} [code: ${op.code}]: ${parts.join(" | ")}`);
          }
          if (activeOpLines.length > 0) {
            countryFeeDetailLines.push(`${flag} ${country.name.toUpperCase()} (${country.code}) | Devise: ${country.currency}`);
            countryFeeDetailLines.push(...activeOpLines);
            countryFeeDetailLines.push(``);
          }
        }
      }

      // Build crypto info
      const cryptoInfoLines: string[] = [];
      for (const crypto of cryptoCurrenciesData) {
        const payinStatus = crypto.payinEnabled ? "actif" : "inactif";
        const payoutStatus = crypto.payoutEnabled ? "actif" : "inactif";
        cryptoInfoLines.push(`- ${crypto.name} (${crypto.symbol}): Dépôt ${payinStatus}, Retrait ${payoutStatus}`);
      }

      // Get crypto fee config
      const nowpaymentsConfig = providerConfigsData.find((p: any) => p.provider === "nowpayments");
      const cryptoMarkup = nowpaymentsConfig?.cryptoMarkupPercent ? (nowpaymentsConfig.cryptoMarkupPercent / 10).toFixed(1) : "10";
      const cryptoFee = nowpaymentsConfig?.cryptoFeePercent ? (nowpaymentsConfig.cryptoFeePercent / 10).toFixed(1) : "15";

      // Build exchange fees section
      const activeExchangeFees = (exchangeFeesData || []).filter((ef: any) => ef.isActive && ef.feePercentage > 0);
      const exchangeFeeLines: string[] = [];
      for (const ef of activeExchangeFees) {
        const pct = (ef.feePercentage / 10).toFixed(1);
        exchangeFeeLines.push(`- ${ef.fromCurrency} → ${ef.toCurrency}: ${pct}%`);
      }

      // Build user personal info section
      let userInfoSection = "";
      if (currentUser) {
        const userCountry = COUNTRIES.find((c: any) => c.code === currentUser.country);
        const kycStatusMap: Record<string, string> = {
          pending: "Non soumis",
          submitted: "En cours de vérification",
          verified: "Vérifié",
          rejected: "Rejeté",
        };
        const balanceFormatted = currentUser.balance.toLocaleString("fr-FR");
        const totalDepositsFormatted = userStats ? userStats.totalDeposits.toLocaleString("fr-FR") : "0";
        const totalTransfersFormatted = userStats ? userStats.totalTransfers.toLocaleString("fr-FR") : "0";
        const totalWithdrawalsFormatted = userStats ? userStats.totalWithdrawals.toLocaleString("fr-FR") : "0";
        const recentTxCount = userStats?.recentTransactions?.length || 0;
        const recentTxLines = userStats?.recentTransactions?.slice(0, 5).map((tx: any) => {
          const typeMap: Record<string, string> = {
            deposit: "Dépôt",
            withdrawal: "Retrait",
            transfer: "Transfert",
            payment_link: "Lien de paiement",
            merchant_link: "Lien marchand",
            api_payment: "Paiement API",
          };
          const statusMap: Record<string, string> = {
            pending: "En attente",
            completed: "Complété",
            failed: "Échoué",
            expired: "Expiré",
          };
          const amountF = tx.amount.toLocaleString("fr-FR");
          const date = new Date(tx.createdAt).toLocaleDateString("fr-FR");
          const userCurrencyDisplay = userCountry?.currency || "XOF";
          return `  - ${typeMap[tx.type] || tx.type}: ${amountF} ${userCurrencyDisplay} - ${statusMap[tx.status] || tx.status} (${date})`;
        }) || [];

        const userCurrencyLabel = userCountry?.currency || "XOF";
        userInfoSection = `
=== INFORMATIONS DE L'UTILISATEUR ACTUEL ===
- Nom: ${currentUser.firstName} ${currentUser.lastName}
- Email: ${currentUser.email}
- Pays: ${userCountry?.name || currentUser.country || "Non défini"}
- Devise: ${userCurrencyLabel}
- Solde actuel: ${balanceFormatted} ${userCurrencyLabel}
- Total des dépôts (complétés): ${totalDepositsFormatted} ${userCurrencyLabel}
- Total des retraits (complétés): ${totalWithdrawalsFormatted} ${userCurrencyLabel}
- Total des transferts (complétés): ${totalTransfersFormatted} ${userCurrencyLabel}
- Statut KYC: ${kycStatusMap[currentUser.kycStatus] || currentUser.kycStatus}${currentUser.kycRejectionReason ? `\n- Motif de rejet KYC: ${currentUser.kycRejectionReason}` : ""}
- Numéros de retrait configurés: ${currentUser.withdrawalPhones && currentUser.withdrawalPhones.length > 0 ? currentUser.withdrawalPhones.join(", ") : "Aucun configuré"}
- Code de sécurité: ${currentUser.securityCode ? "Configuré" : "Non configuré"}
- Compte créé le: ${new Date(currentUser.createdAt).toLocaleDateString("fr-FR")}
- Dernières transactions (${recentTxCount}):
${recentTxLines.length > 0 ? recentTxLines.join("\n") : "  Aucune transaction récente"}
`;
      }

      const systemPrompt = `Tu es EMALI, l'assistant intelligent de BKApay, une plateforme de paiement mobile money en Afrique. Tu réponds UNIQUEMENT en français.

=== RÈGLES DE FORMATAGE VISUEL (OBLIGATOIRES) ===
Tu DOIS appliquer ces règles de mise en forme dans TOUS tes messages:

1. **Gras** pour tous les montants, devises, noms de pays, noms d'opérateurs et valeurs importantes. Exemples: **1 000 FCFA**, **MTN**, **Bénin**, **Transaction ID: xxx**.
2. Drapeaux: inclure TOUJOURS le drapeau emoji du pays quand tu mentionnes un pays. Exemples: 🇧🇯 **Bénin**, 🇨🇮 **Côte d'Ivoire**, 🇸🇳 **Sénégal**, 🇹🇬 **Togo**, 🇧🇫 **Burkina Faso**, 🇨🇲 **Cameroun**, 🇨🇩 **RD Congo**, 🇨🇬 **Congo Brazzaville**, 🇲🇱 **Mali**, 🇬🇳 **Guinée**, 🇬🇭 **Ghana**, 🇳🇬 **Nigéria**.
3. Badges de statut (mettre au début de la ligne de résultat):
   - Opération réussie → [SUCCÈS] (badge vert)
   - Opération échouée → [ERREUR] (badge rouge)
   - Opération en cours → [EN COURS] (badge jaune)
   - Information importante → [INFO] (badge bleu)
4. Sections: utiliser ## pour les titres de section (ex: ## Récapitulatif du retrait).
5. Séparateurs: utiliser ─────────────────────── pour séparer les sections (utiliser exactement cette ligne de tirets).
6. Listes de pays ou d'opérateurs: un élément par ligne, avec le drapeau et le nom en gras.

FORMAT OBLIGATOIRE POUR LES FRAIS DE TRANSACTION:
Quand l'utilisateur demande les frais, tu DOIS reproduire CHAQUE pays dans ce format EXACT, pays par pays dans l'ordre (n'affiche PAS les codes opérateur entre crochets dans ta réponse utilisateur, affiche seulement le nom):

[DRAPEAU] **NOM DU PAYS** | Devise: XXX
• Opérateur1: Entrant: X.X% | Sortant: X.X%
• Opérateur2: Entrant: X.X%
(ligne vide)
[DRAPEAU] **NOM DU PAYS SUIVANT** | Devise: XXX
...

Tu DOIS mettre le nom du pays en gras avec ** autour.
Tu DOIS lister UNIQUEMENT les opérateurs actifs du pays, un par ligne avec •. N'écris jamais "disponible" ou "non disponible" — tu n'affiches que ce qui est actif. N'affiche pas les codes [code: xxx] dans la réponse utilisateur — ils sont uniquement pour les appels d'outils.
Tu DOIS mettre une ligne vide entre chaque pays.
A la toute fin de ta réponse sur les frais (après TOUS les pays), tu DOIS ajouter la section des frais d'échange de devise ET la note, dans cet ordre exact:

**Frais d'échange de devise** (s'appliquent en plus des frais de transaction si les devises diffèrent):
(liste les paires de devises avec leurs pourcentages)

> **NB:** Ces frais d'échange s'appliquent EN PLUS des frais de transaction habituels si les devises source et destination sont différentes.

RÈGLES IMPORTANTES:
- Tu peux donner à l'utilisateur actuel ses propres informations de compte (solde, transactions, statut KYC, etc.) car elles sont fournies ci-dessous.
- Tu ne donnes JAMAIS d'informations sur d'AUTRES utilisateurs (soldes, transactions, données personnelles).
- Tu réponds sur le fonctionnement de la plateforme BKApay et sur les informations du compte de l'utilisateur.
- Si on te pose une question hors sujet, redirige poliment vers les fonctionnalités de BKApay.
- Sois concis, professionnel et amical.
- Utilise les données ci-dessous pour répondre avec précision.
- FRAIS: Tu connais les frais de TOUS les pays. Le pays de l'utilisateur ne limite PAS les frais que tu peux afficher. Si on te demande les frais de tous les pays ou d'un pays différent du sien, tu DOIS les fournir intégralement.

=== GUIDE RETRAIT ET TRANSFERT ===
Tu peux aider l'utilisateur à effectuer des RETRAITS et des TRANSFERTS directement depuis le chat.
Suis ces étapes UNE PAR UNE, ne pose qu'UNE question à la fois.

RÈGLE DE FORMAT CRITIQUE:
Quand tu proposes des choix à l'utilisateur (numéros, opérateurs, pays, confirmation), tu DOIS les formater en LISTE NUMÉROTÉE avec un élément par ligne. L'interface transforme automatiquement ces listes en boutons cliquables. Exemple:
1. Orange
2. MTN
3. Moov

MONTANTS MINIMUM PAR DEVISE:
- Retrait: XOF = 1 000, XAF = 1 000, CDF = 4 000
- Transfert: XOF = 500, XAF = 500, CDF = 2 000

FORMAT DU RÉCAPITULATIF (RÈGLE ABSOLUE — à appliquer pour TOUT retrait ET transfert):
Ne jamais afficher les pourcentages dans les récapitulatifs. Afficher uniquement les montants.
Utiliser EXACTEMENT les valeurs retournées par calculate_fees. Ne JAMAIS recalculer les montants toi-même.
Le montant total débité est TOUJOURS le champ "montantTotalDebite" (transfert) ou "montantDebiteDuSolde" (retrait) retourné par calculate_fees.

FORMAT RÉCAPITULATIF RETRAIT:
## Récapitulatif du retrait
Montant du retrait       : **[montantBrut] [devise]**
Frais de service         : **[fraisService] [devise]**
[si fraisEchangeDevise > 0: Frais de change          : **[fraisEchangeDevise] [devise]**]
───────────────────────────────────────
Destinataire recevra     : **[montantRecuParDestinataire] [devise]**
Total débité du solde    : **[montantDebiteDuSolde] [devise]**

FORMAT RÉCAPITULATIF TRANSFERT:
## Récapitulatif du transfert
[si deviseSource = deviseDest:]
  Destinataire recevra   : **[montantNet] [deviseSource]**
[si deviseSource ≠ deviseDest:]
  Destinataire recevra   : **[montantNet] [deviseSource]** ≈ **[montantDestination] [deviseDest]**
Frais de service         : **[fraisService] [deviseSource]**
[si fraisEchangeDevise > 0: Frais de change          : **[fraisEchangeDevise] [deviseSource]**]
───────────────────────────────────────
Total débité du solde    : **[montantTotalDebite] [deviseSource]**

RETRAIT (envoyer de l'argent vers son propre numéro mobile money):
IMPORTANT: Pour un retrait, le pays est TOUJOURS le pays de l'utilisateur (fourni dans ses infos). Ne demande JAMAIS le pays.
Étape 1: Affiche les numéros de retrait configurés en LISTE NUMÉROTÉE et demande de choisir
Étape 2: Affiche UNIQUEMENT les opérateurs de la section "OPÉRATEURS ACTIFS POUR LES RETRAITS" en LISTE NUMÉROTÉE. Si aucun opérateur n'est actif, informe l'utilisateur qu'aucun retrait n'est possible actuellement.
Étape 3: Demande le montant souhaité en PRÉCISANT le montant minimum autorisé selon la devise de l'utilisateur (ex: "Quel montant souhaitez-vous retirer ? (minimum: 1 000 FCFA)")
Étape 4: Utilise calculate_fees pour calculer les frais (utilise le pays de l'utilisateur comme country)
Étape 5: Affiche le RÉCAPITULATIF RETRAIT (format ci-dessus) puis demande IMMÉDIATEMENT le code de sécurité à 6 chiffres dans le MÊME message. Ne propose PAS de confirmer ou annuler.
Étape 6: Utilise execute_withdrawal pour exécuter (utilise le pays de l'utilisateur comme country)
Étape 7: Affiche le résultat selon le statut retourné par l'outil:
- Si "pending: true" (traitement en cours): affiche [EN COURS] avec le montant et la référence en gras, indique que la transaction est en cours de traitement chez le fournisseur et que le résultat sera disponible dans les transactions d'ici quelques secondes. NE DIS PAS que le retrait a réussi.
- Si "success: true" SANS "pending": affiche [SUCCÈS] avec montant reçu et référence en gras
- Si "success: false": affiche [ERREUR] avec explication et mention du remboursement si applicable

TRANSFERT (envoyer de l'argent vers un autre numéro):
IMPORTANT: Ne demande PAS le pays en texte libre. Utilise EXCLUSIVEMENT la section "PAYS ACTIFS POUR LES TRANSFERTS" ci-dessous. N'affiche QUE les pays présents dans cette section. Si aucun pays n'est actif, informe l'utilisateur qu'aucun transfert n'est possible actuellement.
Étape 1: Affiche UNIQUEMENT les pays de la section "PAYS ACTIFS POUR LES TRANSFERTS" en LISTE NUMÉROTÉE et demande de choisir
Étape 2: Après le choix du pays, affiche les opérateurs disponibles pour CE pays en LISTE NUMÉROTÉE
Étape 3: Demande le numéro de téléphone du destinataire SANS indicatif (le pays est déjà sélectionné, l'indicatif sera ajouté automatiquement). L'utilisateur saisit uniquement son numéro local (ex: 97000000)
Étape 4: Demande le montant que le destinataire doit recevoir en précisant la devise de l'utilisateur et le minimum (ex: "Quel montant le destinataire doit-il recevoir ? (minimum: 500 FCFA, en FCFA)")
Étape 5: Utilise calculate_fees pour calculer les frais — cet outil calcule automatiquement la conversion et les frais d'échange si les devises sont différentes. Ne pas appeler convert_currency séparément.
Étape 6: Affiche le RÉCAPITULATIF TRANSFERT (format ci-dessus, avec le montant en devise destination si différente) puis demande IMMÉDIATEMENT le code de sécurité à 6 chiffres dans le MÊME message. Ne propose PAS de confirmer ou annuler.
Étape 7: Utilise execute_transfer pour exécuter
Étape 8: Affiche le résultat selon le statut retourné par l'outil:
- Si "pending: true" (traitement en cours): affiche [EN COURS] avec le montant, le numéro destinataire et la référence en gras, indique que la transaction est en cours de traitement chez le fournisseur et que le résultat sera disponible dans les transactions d'ici quelques secondes. NE DIS PAS que le transfert a réussi.
- Si "success: true" SANS "pending": affiche [SUCCÈS] avec montant, numéro destinataire et référence en gras
- Si "success: false": affiche [ERREUR] avec explication et mention du remboursement si applicable

MODE AUTOMATIQUE (message complet en une seule fois):
Si l'utilisateur fournit TOUTES les informations dans un seul message (numéro, opérateur, montant, code de sécurité), tu dois:
1. Extraire automatiquement toutes les informations du message
2. Pour un retrait: utiliser le pays de l'utilisateur automatiquement
3. Utiliser calculate_fees pour calculer les frais
4. Exécuter immédiatement l'opération sans demander de confirmation
5. Afficher le résultat avec le format récapitulatif professionnel défini ci-dessus (sans pourcentages)

RÈGLES POUR LES OPÉRATIONS:
- Vérifie TOUJOURS que le KYC est vérifié avant de proposer un retrait/transfert
- Vérifie que le code de sécurité est configuré avant de proposer un retrait
- Vérifie que des numéros de retrait sont configurés avant de proposer un retrait
- Vérifie que le solde est suffisant avant d'exécuter
- Le code de sécurité est OBLIGATOIRE pour les retraits ET les transferts
- N'exécute JAMAIS une opération sans récapitulatif et confirmation préalable de l'utilisateur
- CRITIQUE: Pour les outils (calculate_fees, execute_withdrawal, execute_transfer), utilise TOUJOURS le code complet affiché entre crochets [code: xxx] dans les sections de frais et d'opérateurs. Le code inclut le suffixe pays (ex: orange-bj, mtn-bj, moov-bj, wave-sn, orange-ci, mtn-cm, airtel-cd, tmoney-tg). N'utilise JAMAIS un code court sans suffixe (jamais "orange" seul, toujours "orange-bj" pour le Bénin).
- Utilise les codes pays en majuscules: BJ, CI, SN, TG, BF, CM, CD, CG, ML
- Le numéro de téléphone doit inclure l'indicatif pays (ex: +229XXXXXXXX)
- Pour les retraits, utilise TOUJOURS le pays de l'utilisateur, ne le demande jamais
- INTERDIT: Ne mentionne JAMAIS le nom des fournisseurs de paiement (FedaPay, Paydunya, MbiyoPay, AfribaPay, NOWPayments) à l'utilisateur. Ces informations sont internes et techniques. Le fournisseur est sélectionné automatiquement en arrière-plan. L'utilisateur ne doit voir que: le montant, les frais, le montant débité et le résultat de l'opération.
- IMPORTANT: Quand execute_withdrawal ou execute_transfer retourne success=true, le message "Transaction initiée avec succès. Traitement en cours..." a DÉJÀ été affiché automatiquement. Ne le répète PAS. Affiche directement le résultat final (confirmé ou en cours de traitement selon le statut retourné).
- IMPORTANT: Quand execute_withdrawal ou execute_transfer retourne success=false avec une mention "solde a été recrédité", informe clairement l'utilisateur que l'opération a échoué ET que son solde a été restitué intégralement.
${userInfoSection}
=== INFORMATIONS SUR BKAPAY ===

SITE OFFICIEL: https://bkapay.com

DESCRIPTION: BKApay est une plateforme de paiement mobile money permettant aux entreprises et particuliers d'accepter et envoyer des paiements via mobile money et cryptomonnaie dans 16 pays d'Afrique.

FONCTIONNALITÉS:
- Dépôts (recevoir de l'argent via mobile money ou crypto)
- Retraits (envoyer de l'argent vers un numéro mobile money ou portefeuille crypto)
- Transferts (envoyer de l'argent à un autre numéro)
- Liens de paiement (créer des liens pour recevoir des paiements)
- Liens marchands (intégration pour les commerçants)
- API pour développeurs (intégration technique)
- Vérification KYC (identification obligatoire en 5 étapes)

PAYS ET OPÉRATEURS DISPONIBLES (données en temps réel):
${countryInfoLines.join("\n")}

=== PAYS ACTIFS POUR LES TRANSFERTS (payout activé dans la base de données) ===
IMPORTANT: Pour les transferts, propose UNIQUEMENT ces pays. Ne propose JAMAIS un pays qui n'est pas dans cette liste.
${transferCountryLines.length > 0 ? transferCountryLines.join("\n") : "Aucun pays actif pour les transferts actuellement."}

=== OPÉRATEURS ACTIFS POUR LES RETRAITS (pays de l'utilisateur) ===
${withdrawalCountryLines.length > 0 ? withdrawalCountryLines.join("\n") : "Aucun opérateur actif pour les retraits dans le pays de l'utilisateur."}

=== FRAIS DE TRANSACTION PAR PAYS ET OPÉRATEUR (données en temps réel) ===
RÈGLE ABSOLUE: Quand l'utilisateur pose une question sur les frais, tu DOIS afficher TOUS les pays ci-dessous en utilisant EXACTEMENT le FORMAT OBLIGATOIRE défini au début de ce prompt (drapeau, nom en gras, opérateurs avec •, entrant/sortant, ligne vide entre pays, NB à la fin). Tu n'as PAS le droit de sauter des pays. Tu n'as PAS le droit de changer le format. Tu n'as PAS le droit de dire que tu ne peux pas fournir ces informations.
RAPPEL FORMAT: [DRAPEAU] **PAYS** | Devise: XXX → puis • Opérateur: Entrant: X% | Sortant: X% (n'affiche que les opérateurs actifs, sans mentionner "disponible") → ligne vide → pays suivant → NB à la toute fin.

${countryFeeDetailLines.length > 0 ? countryFeeDetailLines.join("\n") : "Frais standard de 6% pour tous les pays et opérateurs."}

RÈGLES DES FRAIS:
- Dépôts (paiements entrants): Le client paie le montant brut, l'utilisateur reçoit le net (brut - frais de transaction - frais d'échange si devises différentes).
- Retraits (paiements sortants): L'utilisateur entre le montant brut, le destinataire reçoit le net (brut - frais). Le solde est débité du montant brut + frais d'échange si devises différentes.
- Transferts: L'utilisateur entre le montant net que le destinataire recevra. Le solde est débité du net + frais de transaction + frais d'échange si devises différentes.
- Pour les comptes personnels, les frais d'échange s'appliquent TOUJOURS quand les devises sont différentes (ex: utilisateur XOF qui transfère vers pays CDF).

=== FRAIS D'ÉCHANGE DE DEVISE (données en temps réel) ===
Ces frais s'ajoutent aux frais de transaction standard quand les devises source et destination sont différentes.
${exchangeFeeLines.length > 0 ? exchangeFeeLines.join("\n") : "Aucun frais d'échange configuré actuellement (0%)."}
IMPORTANT: Un compte personnel peut avoir DEUX types de frais pour une même opération internationale: (1) frais de transaction standard selon l'opérateur/pays, ET (2) frais d'échange de devise si les devises diffèrent. La fonction calculate_fees inclut déjà les deux automatiquement.

CRYPTOMONNAIES DISPONIBLES (données en temps réel):
${cryptoInfoLines.length > 0 ? cryptoInfoLines.join("\n") : "Aucune cryptomonnaie configurée actuellement."}

FRAIS CRYPTO:
- Majoration de conversion XOF/USD: ${cryptoMarkup}%
- Frais crypto supplémentaires: ${cryptoFee}%
- Plus les frais standard de la plateforme

VÉRIFICATION KYC (5 étapes):
1. Photo recto de la pièce d'identité
2. Photo verso de la pièce d'identité
3. Selfie avec la pièce d'identité
4. Signature numérique
5. Description de l'activité et localisation GPS
Note: Après 3 rejets de KYC, le compte est automatiquement suspendu.

SÉCURITÉ:
- Code de sécurité à 6 chiffres requis pour les retraits
- Jusqu'à 3 numéros de retrait configurables
- Sessions sécurisées avec authentification persistante

INSCRIPTION:
- Pays autorisés pour l'inscription: Bénin, Côte d'Ivoire, Sénégal, Togo, Burkina Faso, Cameroun, RD Congo, Congo-Brazzaville, Mali
- Vérification email optionnelle lors de l'inscription
- Le pays ne peut pas être changé après l'inscription

SUPPORT ET CONTACT:
- Email du support: ${supportSettingsData?.supportEmail || "support@bkapay.com"}
- Numéro de téléphone du support: ${supportSettingsData?.supportPhone || "+229 01 46 44 73 19"}
- Groupe WhatsApp communautaire: ${supportSettingsData?.whatsappLink || "https://chat.whatsapp.com/DRe55FMRXCt87VxNvjF1EF"}
- Pour toute question ou problème, les utilisateurs peuvent contacter le support par email, téléphone ou rejoindre le groupe WhatsApp.`;

      const emaliTools: any[] = [
        {
          type: "function" as const,
          function: {
            name: "calculate_fees",
            description: "Calcule les frais et le montant net pour un retrait ou transfert mobile money. Appelle cette fonction AVANT d'exécuter une opération pour montrer le récapitulatif à l'utilisateur. IMPORTANT: Inclut automatiquement les frais d'échange de devise si les devises source et destination sont différentes.",
            parameters: {
              type: "object",
              properties: {
                amount: { type: "number", description: "Montant en unité de devise (XOF, CDF, XAF, etc.)" },
                type: { type: "string", enum: ["withdrawal", "transfer"], description: "Type: withdrawal (retrait) ou transfer (transfert)" },
                country: { type: "string", description: "Code pays en majuscules (BJ, CI, SN, TG, BF, CM, CD, CG, ML)" },
                operator: { type: "string", description: "Code opérateur COMPLET avec suffixe pays, en minuscules. Utilise EXACTEMENT le code [code: ...] affiché dans les informations des pays. Exemples: orange-bj, mtn-bj, moov-bj, orange-ci, mtn-ci, wave-ci, orange-sn, free-sn, wave-sn, orange-cm, mtn-cm, orange-cd, airtel-cd, tmoney-tg, moov-tg, orange-bf, moov-bf" },
              },
              required: ["amount", "type", "country", "operator"],
            },
          },
        },
        {
          type: "function" as const,
          function: {
            name: "execute_withdrawal",
            description: "Exécute un retrait mobile money. REQUIERT: KYC vérifié, code de sécurité configuré, numéro dans la liste des numéros de retrait, solde suffisant. Appelle calculate_fees AVANT pour montrer le récapitulatif.",
            parameters: {
              type: "object",
              properties: {
                amount: { type: "number", description: "Montant brut à retirer" },
                country: { type: "string", description: "Code pays en majuscules (BJ, CI, SN, TG, BF, CM, CD, CG, ML)" },
                operator: { type: "string", description: "Code opérateur COMPLET avec suffixe pays, en minuscules (ex: orange-bj, mtn-bj, wave-sn, orange-cm, airtel-cd). Utilise EXACTEMENT le code [code: ...] affiché dans les informations des pays." },
                phone: { type: "string", description: "Numéro de téléphone complet avec indicatif (ex: +22997000000)" },
                securityCode: { type: "string", description: "Code de sécurité à 6 chiffres fourni par l'utilisateur" },
              },
              required: ["amount", "country", "operator", "phone", "securityCode"],
            },
          },
        },
        {
          type: "function" as const,
          function: {
            name: "execute_transfer",
            description: "Exécute un transfert mobile money vers un numéro tiers. REQUIERT: KYC vérifié, code de sécurité, solde suffisant. Le montant est le montant NET que le destinataire recevra. Le solde sera débité du montant + frais de transaction + frais d'échange si les devises sont différentes.",
            parameters: {
              type: "object",
              properties: {
                amount: { type: "number", description: "Montant net que le destinataire recevra" },
                country: { type: "string", description: "Code pays du destinataire en majuscules (BJ, CI, SN, TG, BF, CM, CD, CG, ML)" },
                operator: { type: "string", description: "Code opérateur COMPLET avec suffixe pays, en minuscules (ex: orange-bj, mtn-bj, wave-sn, orange-cm, airtel-cd). Utilise EXACTEMENT le code [code: ...] affiché dans les informations des pays." },
                phone: { type: "string", description: "Numéro de téléphone du destinataire avec indicatif" },
                securityCode: { type: "string", description: "Code de sécurité à 6 chiffres fourni par l'utilisateur" },
              },
              required: ["amount", "country", "operator", "phone", "securityCode"],
            },
          },
        },
        {
          type: "function" as const,
          function: {
            name: "convert_currency",
            description: "Convertit un montant d'une devise à une autre (XOF, XAF, CDF, USD). Utile quand l'utilisateur et le destinataire ont des devises différentes.",
            parameters: {
              type: "object",
              properties: {
                amount: { type: "number", description: "Montant à convertir" },
                fromCurrency: { type: "string", description: "Devise source (XOF, XAF, CDF, USD)" },
                toCurrency: { type: "string", description: "Devise cible (XOF, XAF, CDF, USD)" },
              },
              required: ["amount", "fromCurrency", "toCurrency"],
            },
          },
        },
      ];

      const handleToolCall = async (toolName: string, args: any, userId: string): Promise<string> => {
        try {
          switch (toolName) {
            case "calculate_fees": {
              const { amount, type, country, operator } = args;
              // Normalize operator: strip country suffix if present (e.g. "moov-tg" → "moov")
              const normalizedOperatorC = operator ? operator.replace(/-[a-z]{2}$/i, '') : operator;
              const feeData = await getDynamicOutgoingFees(storage, country, normalizedOperatorC, userId);
              const feeInfo = calculateOutgoingFee(Math.floor(amount), feeData.outgoing);
              const feePct = (feeData.outgoing / 10).toFixed(1);

              const calcUser = await storage.getUser(userId);
              const calcUserCurrency = calcUser?.country ? getCurrencyForCountry(calcUser.country) : "XOF";
              let calcDestCurrency = getCurrencyForCountry(country?.toUpperCase() || "");
              const calcProvider = await getActiveProviderForWithdrawal(country, normalizedOperatorC);
              if (calcProvider === "pawapay") {
                try {
                  const { getCurrencyForOperator: getOpCurr } = await import("@shared/pawapay-countries");
                  const opCurr = getOpCurr(country?.toUpperCase() || "", normalizedOperatorC);
                  if (opCurr) calcDestCurrency = opCurr;
                } catch (_) {}
              }
              const xFeeCalc = await getOutgoingExchangeFee(storage, calcUserCurrency, calcDestCurrency, Math.floor(amount), calcUser?.accountType || "personal");

              if (type === "transfer") {
                const totalDebited = Math.floor(amount) + feeInfo.feeAmount + xFeeCalc.feeAmount;
                const result: any = {
                  success: true,
                  type: "transfer",
                  deviseSource: calcUserCurrency,
                  deviseDest: calcDestCurrency,
                  montantNet: Math.floor(amount),
                  fraisService: feeInfo.feeAmount,
                  montantTotalDebite: totalDebited,
                };
                if (xFeeCalc.feeAmount > 0) {
                  result.fraisEchangeDevise = xFeeCalc.feeAmount;
                }
                // Montant que recevra le destinataire dans sa propre devise (conversion si nécessaire)
                if (calcDestCurrency !== calcUserCurrency) {
                  try {
                    const { convertCurrency } = await import("./currency-converter");
                    const convRes = await convertCurrency(Math.floor(amount), calcUserCurrency, calcDestCurrency);
                    if (convRes.success) {
                      result.montantDestination = Math.floor(convRes.convertedAmount);
                    }
                  } catch (_) {}
                } else {
                  result.montantDestination = Math.floor(amount);
                }
                return JSON.stringify(result);
              } else {
                const result: any = {
                  success: true,
                  type: "withdrawal",
                  devise: calcUserCurrency,
                  montantBrut: Math.floor(amount),
                  fraisService: feeInfo.feeAmount,
                  montantRecuParDestinataire: feeInfo.amountReceived,
                  montantDebiteDuSolde: feeInfo.totalDeductedFromBalance + xFeeCalc.feeAmount,
                };
                if (xFeeCalc.feeAmount > 0) {
                  result.fraisEchangeDevise = xFeeCalc.feeAmount;
                }
                return JSON.stringify(result);
              }
            }

            case "execute_withdrawal": {
              const { amount, country, operator, phone, securityCode } = args;
              const user = await storage.getUser(userId);
              if (!user) return JSON.stringify({ success: false, error: "Utilisateur non trouvé" });
              if (user.suspended) return JSON.stringify({ success: false, error: "Compte suspendu" });
              if (user.withdrawalsEnabled === false) return JSON.stringify({ success: false, error: "Les retraits sont désactivés pour votre compte. Veuillez contacter le support." });
              if (user.kycStatus !== "verified") return JSON.stringify({ success: false, error: "KYC non vérifié. Veuillez compléter votre vérification KYC." });
              if (!user.securityCode) return JSON.stringify({ success: false, error: "Code de sécurité non configuré. Allez dans Paramètres pour le configurer." });

              const sanitizedPhoneCheck = phone.replace(/\s+/g, "").replace(/^(\+|00)/, "");
              const allowedPhones = (user.withdrawalPhones || []).map((p: string) => p.replace(/\s+/g, "").replace(/^(\+|00)/, ""));
              if (allowedPhones.length === 0) return JSON.stringify({ success: false, error: "Aucun numéro de retrait configuré. Allez dans Paramètres pour ajouter vos numéros." });
              if (!allowedPhones.some((p: string) => sanitizedPhoneCheck.includes(p) || p.includes(sanitizedPhoneCheck))) {
                return JSON.stringify({ success: false, error: "Ce numéro ne fait pas partie de vos numéros de retrait autorisés. Utilisez un numéro configuré dans vos paramètres." });
              }

              const bcryptMod = await import("bcrypt");
              const isValidCode = await bcryptMod.compare(securityCode, user.securityCode);
              if (!isValidCode) return JSON.stringify({ success: false, error: "Code de sécurité incorrect" });

              if (!amount || amount <= 0) return JSON.stringify({ success: false, error: "Montant invalide" });

              const userCurrencyW = user.country ? getCurrencyForCountry(user.country) : "XOF";
              const minAmountW = user.country === "CD" ? 1000 : 1000;
              if (amount < minAmountW) return JSON.stringify({ success: false, error: `Montant minimum: ${minAmountW.toLocaleString("fr-FR")} ${userCurrencyW}` });

              // Normalize operator: strip country suffix if present (e.g. "moov-tg" → "moov", "tmoney-tg" → "tmoney")
              const normalizedOperatorW = operator.replace(/-[a-z]{2}$/i, '');

              const activeProviderW = await getActiveProviderForWithdrawal(country, normalizedOperatorW);
              if (!activeProviderW) return JSON.stringify({ success: false, error: "Cet opérateur n'est pas disponible pour les retraits dans ce pays actuellement." });

              const feeConfigW = await getFeeFromDatabase(storage, activeProviderW, country, normalizedOperatorW, "personal", userId);
              const feeInfoW = calculateOutgoingFee(Math.floor(amount), feeConfigW.outgoing);

              // Calcul des frais d'échange de devise (s'appliquent si devise source ≠ devise destination)
              let destCurrencyW = getCurrencyForCountry(country?.toUpperCase() || "");
              if (activeProviderW === "pawapay") {
                try {
                  const { getCurrencyForOperator: getOpCurrW } = await import("@shared/pawapay-countries");
                  const opCurrW = getOpCurrW(country?.toUpperCase() || "", normalizedOperatorW);
                  if (opCurrW) destCurrencyW = opCurrW;
                } catch (_) {}
              }
              const xFeeW = await getOutgoingExchangeFee(storage, userCurrencyW, destCurrencyW, Math.floor(amount), user.accountType || "personal");
              const requiredBalanceW = feeInfoW.totalDeductedFromBalance + xFeeW.feeAmount;

              if (user.balance < requiredBalanceW) {
                return JSON.stringify({ success: false, error: `Solde insuffisant. Solde: ${user.balance.toLocaleString("fr-FR")} ${userCurrencyW}, Requis: ${requiredBalanceW.toLocaleString("fr-FR")} ${userCurrencyW}` });
              }

              let sanitizedPhone = phone.replace(/\s+/g, "").replace(/^(\+|00)/, "");
              const withdrawCountryInfo = COUNTRIES.find((c: any) => c.code === country);
              if (withdrawCountryInfo) {
                const dialDigitsW = withdrawCountryInfo.phoneCode.replace("+", "");
                if (!sanitizedPhone.startsWith(dialDigitsW)) {
                  sanitizedPhone = dialDigitsW + sanitizedPhone;
                }
              }

              // Streaming progressif : 3 étapes visibles
              res.write(`data: ${JSON.stringify({ content: "Transaction initiée avec succès.\n" })}\n\n`);
              const emaliBalanceUpdateEvt = `data: ${JSON.stringify({ type: "balance_update" })}\n\n`;
              res.write(emaliBalanceUpdateEvt);
              res.write(`data: ${JSON.stringify({ content: "Traitement en cours...\n\n" })}\n\n`);

              if (activeProviderW === "fedapay") {
                const result = await handleFedaPayWithdrawal(userId, user, Math.floor(amount), country, normalizedOperatorW, sanitizedPhone, userCurrencyW);
                if (result.success) {
                  if (xFeeW.feeAmount > 0) await storage.updateUserBalance(userId, -xFeeW.feeAmount);
                  res.write(emaliBalanceUpdateEvt);
                  return JSON.stringify({ success: true, pending: true, montant: feeInfoW.amountReceived, devise: userCurrencyW, frais: feeInfoW.feeAmount, transactionId: result.transactionId, message: `Retrait soumis avec succès. Montant: ${feeInfoW.amountReceived.toLocaleString("fr-FR")} ${userCurrencyW}. Frais: ${feeInfoW.feeAmount.toLocaleString("fr-FR")} ${userCurrencyW}. Transaction ID: ${result.transactionId}. Traitement en cours chez le fournisseur.` });
                } else {
                  return JSON.stringify({ success: false, error: result.error || "Erreur lors du retrait" });
                }
              } else if (activeProviderW === "paydunya") {
                const withdrawModeMapW: Record<string, string> = {
                  "orange-sn": "orange-money-senegal", "free-sn": "free-money-senegal", "expresso-sn": "expresso-senegal",
                  "wave-sn": "wave-senegal", "wizall-sn": "wizall-senegal",
                  "orange-ci": "orange-money-ci", "mtn-ci": "mtn-ci", "moov-ci": "moov-ci", "wave-ci": "wave-ci",
                  "orange-bf": "orange-money-burkina", "moov-bf": "moov-burkina-faso",
                  "moov-bj": "moov-benin", "mtn-bj": "mtn-benin",
                  "tmoney-tg": "t-money-togo", "togocom-tg": "t-money-togo", "moov-tg": "moov-togo",
                  "orange-ml": "orange-money-mali", "moov-ml": "moov-mali",
                  "mtn-cm": "mtn-cameroun",
                };
                const withdrawModeW = withdrawModeMapW[`${normalizedOperatorW}-${country.toLowerCase()}`];
                if (!withdrawModeW) return JSON.stringify({ success: false, error: "Cet opérateur n'est pas disponible pour les retraits dans ce pays." });

                let cleanPhoneW = sanitizedPhone.replace(/[\s\-\.]+/g, "");
                const countryPhoneInfoW: Record<string, { code: string, localLength: number[] }> = {
                  "SN": { code: "221", localLength: [9] }, "CI": { code: "225", localLength: [10] },
                  "BF": { code: "226", localLength: [8] }, "BJ": { code: "229", localLength: [8, 10] },
                  "TG": { code: "228", localLength: [8] }, "ML": { code: "223", localLength: [8] },
                  "CM": { code: "237", localLength: [9] },
                };
                const phoneInfoW = countryPhoneInfoW[country.toUpperCase()];
                if (phoneInfoW) {
                  if (cleanPhoneW.startsWith(phoneInfoW.code)) {
                    const withoutCodeW = cleanPhoneW.substring(phoneInfoW.code.length);
                    if (phoneInfoW.localLength.includes(withoutCodeW.length)) {
                      cleanPhoneW = withoutCodeW;
                    }
                  }
                }

                const chatbotWCurrencies: Record<string, string> = { "CM": "XAF" };
                const chatbotWProviderCurrency = chatbotWCurrencies[country.toUpperCase()] || "XOF";
                const amountForProviderW = feeInfoW.amountReceived;
                let providerAmountW = amountForProviderW;
                if (userCurrencyW !== chatbotWProviderCurrency) {
                  const { convertCurrency } = await import("./currency-converter");
                  const convW = await convertCurrency(amountForProviderW, userCurrencyW, chatbotWProviderCurrency);
                  if (convW.success) providerAmountW = Math.floor(convW.convertedAmount);
                  else return JSON.stringify({ success: false, error: "Erreur de conversion de devise" });
                }

                // Pré-déduire le solde et créer une transaction en attente AVANT d'appeler le fournisseur
                await storage.updateUserBalance(userId, -requiredBalanceW);
                res.write(emaliBalanceUpdateEvt);
                const pendingTxW = await storage.createTransaction({ userId, type: "withdrawal", amount: Math.floor(amount), fee: feeInfoW.feeAmount, feePercentage: feeInfoW.feePercentage, currency: userCurrencyW, status: "pending", country, operator: normalizedOperatorW, customerPhone: cleanPhoneW, description: `Retrait de ${Math.floor(amount)} ${userCurrencyW}`, metadata: JSON.stringify({ provider: "paydunya", providerAmount: providerAmountW, providerCurrency: chatbotWProviderCurrency, exchangeFee: xFeeW.feeAmount }) });

                const callbackUrlW = `${process.env.BASE_URL || 'https://bkapay.com'}/api/webhooks/paydunya-disburse`;
                const getInvoiceW = await callPaydunyaAPIv2("/disburse/get-invoice", { account_alias: cleanPhoneW, amount: providerAmountW, withdraw_mode: withdrawModeW, callback_url: callbackUrlW });
                if (getInvoiceW.response_code !== "00" || !getInvoiceW.disburse_token) {
                  await storage.updateUserBalance(userId, requiredBalanceW);
                  await storage.updateTransaction(pendingTxW.id, { status: "failed" });
                  res.write(emaliBalanceUpdateEvt);
                  return JSON.stringify({ success: false, error: "Le retrait n'a pas pu être traité. Votre solde a été recrédité. Veuillez réessayer." });
                }

                const submitW = await callPaydunyaAPIv2("/disburse/submit-invoice", { disburse_invoice: getInvoiceW.disburse_token, disburse_id: `withdrawal-${user.id.substring(0, 8)}-${Date.now()}` });
                if (submitW.response_code === "00") {
                  await storage.updateTransaction(pendingTxW.id, { status: "processing", paydunyaToken: getInvoiceW.disburse_token });
                  const xFeeMsg = xFeeW.feeAmount > 0 ? ` Frais d'échange: ${xFeeW.feeAmount.toLocaleString("fr-FR")} ${userCurrencyW}.` : "";
                  return JSON.stringify({ success: true, pending: true, montant: feeInfoW.amountReceived, devise: userCurrencyW, frais: feeInfoW.feeAmount, transactionId: pendingTxW.id, message: `Retrait soumis avec succès. Montant: ${feeInfoW.amountReceived.toLocaleString("fr-FR")} ${userCurrencyW}. Frais: ${feeInfoW.feeAmount.toLocaleString("fr-FR")} ${userCurrencyW}.${xFeeMsg} Transaction ID: ${pendingTxW.id}. Traitement en cours chez le fournisseur.` });
                }
                await storage.updateUserBalance(userId, requiredBalanceW);
                await storage.updateTransaction(pendingTxW.id, { status: "failed" });
                res.write(emaliBalanceUpdateEvt);
                return JSON.stringify({ success: false, error: "Retrait échoué. Votre solde a été recrédité." });
              } else if (activeProviderW === "mbiyopay") {
                const result = await handleMbiyoPayWithdrawal(userId, user, Math.floor(amount), country, normalizedOperatorW, sanitizedPhone, userCurrencyW);
                if (result.success) {
                  if (xFeeW.feeAmount > 0) await storage.updateUserBalance(userId, -xFeeW.feeAmount);
                  res.write(emaliBalanceUpdateEvt);
                  return JSON.stringify({ success: true, pending: true, montant: feeInfoW.amountReceived, devise: userCurrencyW, frais: feeInfoW.feeAmount, transactionId: result.transactionId, message: `Retrait soumis avec succès. Montant: ${feeInfoW.amountReceived.toLocaleString("fr-FR")} ${userCurrencyW}. Frais: ${feeInfoW.feeAmount.toLocaleString("fr-FR")} ${userCurrencyW}. Transaction ID: ${result.transactionId}. Traitement en cours chez le fournisseur.` });
                }
                res.write(emaliBalanceUpdateEvt);
                return JSON.stringify({ success: false, error: result.error || "Erreur lors du retrait" });
              } else if (activeProviderW === "afribapay") {
                const result = await handleAfribaPayWithdrawal(userId, user, Math.floor(amount), country, normalizedOperatorW, sanitizedPhone, userCurrencyW);
                if (result.success) {
                  if (xFeeW.feeAmount > 0) await storage.updateUserBalance(userId, -xFeeW.feeAmount);
                  res.write(emaliBalanceUpdateEvt);
                  return JSON.stringify({ success: true, pending: true, montant: feeInfoW.amountReceived, devise: userCurrencyW, frais: feeInfoW.feeAmount, transactionId: result.transactionId, message: `Retrait soumis avec succès. Montant: ${feeInfoW.amountReceived.toLocaleString("fr-FR")} ${userCurrencyW}. Frais: ${feeInfoW.feeAmount.toLocaleString("fr-FR")} ${userCurrencyW}. Transaction ID: ${result.transactionId}. Traitement en cours chez le fournisseur.` });
                }
                res.write(emaliBalanceUpdateEvt);
                return JSON.stringify({ success: false, error: result.error || "Erreur lors du retrait" });
              } else if (activeProviderW === "moneyfusion") {
                const result = await handleMoneyFusionWithdrawal(userId, user, Math.floor(amount), country, normalizedOperatorW, sanitizedPhone, userCurrencyW);
                if (result.success) {
                  if (xFeeW.feeAmount > 0) await storage.updateUserBalance(userId, -xFeeW.feeAmount);
                  res.write(emaliBalanceUpdateEvt);
                  return JSON.stringify({ success: true, pending: true, montant: feeInfoW.amountReceived, devise: userCurrencyW, frais: feeInfoW.feeAmount, transactionId: result.transactionId, message: `Retrait soumis avec succès. Montant: ${feeInfoW.amountReceived.toLocaleString("fr-FR")} ${userCurrencyW}. Frais: ${feeInfoW.feeAmount.toLocaleString("fr-FR")} ${userCurrencyW}. Transaction ID: ${result.transactionId}. Traitement en cours chez le fournisseur.` });
                }
                res.write(emaliBalanceUpdateEvt);
                return JSON.stringify({ success: false, error: result.error || "Erreur lors du retrait" });
              } else if (activeProviderW === "pawapay") {
                const result = await handlePawaPayWithdrawal(userId, user, Math.floor(amount), country, normalizedOperatorW, sanitizedPhone, userCurrencyW, userCurrencyW);
                if (result.success) {
                  if (xFeeW.feeAmount > 0) await storage.updateUserBalance(userId, -xFeeW.feeAmount);
                  res.write(emaliBalanceUpdateEvt);
                  return JSON.stringify({ success: true, pending: true, montant: feeInfoW.amountReceived, devise: userCurrencyW, frais: feeInfoW.feeAmount, transactionId: result.transactionId, message: `Retrait soumis avec succès. Montant: ${feeInfoW.amountReceived.toLocaleString("fr-FR")} ${userCurrencyW}. Frais: ${feeInfoW.feeAmount.toLocaleString("fr-FR")} ${userCurrencyW}. Transaction ID: ${result.transactionId}. Traitement en cours chez le fournisseur.` });
                }
                res.write(emaliBalanceUpdateEvt);
                return JSON.stringify({ success: false, error: result.error || "Erreur lors du retrait" });
              } else if (activeProviderW === "feexpay") {
                const result = await handleFeeXPayWithdrawal(userId, user, Math.floor(amount), country, normalizedOperatorW, sanitizedPhone, userCurrencyW);
                if (result.success) {
                  if (xFeeW.feeAmount > 0) {
                    await storage.updateUserBalance(userId, -xFeeW.feeAmount);
                    console.log(`[EMALI Withdrawal feexpay] Exchange fee deducted: ${xFeeW.feeAmount} ${userCurrencyW}`);
                  }
                  res.write(emaliBalanceUpdateEvt);
                  const xFeeMsg = xFeeW.feeAmount > 0 ? ` Frais de change: ${xFeeW.feeAmount.toLocaleString("fr-FR")} ${userCurrencyW}.` : "";
                  return JSON.stringify({ success: true, pending: true, montant: feeInfoW.amountReceived, devise: userCurrencyW, frais: feeInfoW.feeAmount, transactionId: result.transactionId, message: `Retrait soumis avec succès.${xFeeMsg} Montant: ${feeInfoW.amountReceived.toLocaleString("fr-FR")} ${userCurrencyW}. Transaction ID: ${result.transactionId}. Traitement en cours chez le fournisseur.` });
                }
                res.write(emaliBalanceUpdateEvt);
                return JSON.stringify({ success: false, error: result.error || "Erreur lors du retrait" });
              }

              return JSON.stringify({ success: false, error: "Cette opération n'est pas disponible actuellement. Veuillez réessayer plus tard." });
            }

            case "execute_transfer": {
              const { amount, country, operator, phone, securityCode: transferCode } = args;
              const user = await storage.getUser(userId);
              if (!user) return JSON.stringify({ success: false, error: "Utilisateur non trouvé" });
              if (user.suspended) return JSON.stringify({ success: false, error: "Compte suspendu" });
              if (user.transfersEnabled === false) return JSON.stringify({ success: false, error: "Les transferts sont désactivés pour votre compte. Veuillez contacter le support." });
              if (user.kycStatus !== "verified") return JSON.stringify({ success: false, error: "KYC non vérifié. Veuillez compléter votre vérification KYC." });

              if (!user.securityCode) return JSON.stringify({ success: false, error: "Code de sécurité non configuré. Allez dans Paramètres pour le configurer." });
              if (!transferCode) return JSON.stringify({ success: false, error: "Code de sécurité requis pour effectuer un transfert." });
              const bcryptModT = await import("bcrypt");
              const isValidCodeT = await bcryptModT.compare(transferCode, user.securityCode);
              if (!isValidCodeT) return JSON.stringify({ success: false, error: "Code de sécurité incorrect" });

              if (!amount || amount <= 0) return JSON.stringify({ success: false, error: "Montant invalide" });

              const userCurrencyT = user.country ? getCurrencyForCountry(user.country) : "XOF";
              const minAmountT = user.country === "CD" ? 2000 : 500;
              if (amount < minAmountT) return JSON.stringify({ success: false, error: `Montant minimum: ${minAmountT.toLocaleString("fr-FR")} ${userCurrencyT}` });

              // Normalize operator: strip country suffix if present (e.g. "moov-tg" → "moov", "orange-ci" → "orange")
              const normalizedOperatorT = operator.replace(/-[a-z]{2}$/i, '');

              const activeProviderT = await getActiveProviderForWithdrawal(country, normalizedOperatorT);
              if (!activeProviderT) return JSON.stringify({ success: false, error: "Cet opérateur n'est pas disponible pour les transferts dans ce pays actuellement." });

              const feeConfigT = await getFeeFromDatabase(storage, activeProviderT, country, normalizedOperatorT, "personal", userId);
              const feeInfoT = calculateOutgoingFee(Math.floor(amount), feeConfigT.outgoing);

              let destCurrencyT = getCurrencyForCountry(country?.toUpperCase() || "");
              if (activeProviderT === "pawapay") {
                try {
                  const { getCurrencyForOperator: getOpCurrT } = await import("@shared/pawapay-countries");
                  const opCurrT = getOpCurrT(country?.toUpperCase() || "", normalizedOperatorT);
                  if (opCurrT) destCurrencyT = opCurrT;
                } catch (_) {}
              }
              const xFeeT = await getOutgoingExchangeFee(storage, userCurrencyT, destCurrencyT, Math.floor(amount), user.accountType || "personal");
              const requiredBalanceT = Math.floor(amount) + feeInfoT.feeAmount + xFeeT.feeAmount;

              if (user.balance < requiredBalanceT) {
                return JSON.stringify({ success: false, error: `Solde insuffisant. Solde: ${user.balance.toLocaleString("fr-FR")} ${userCurrencyT}, Requis: ${requiredBalanceT.toLocaleString("fr-FR")} ${userCurrencyT}` });
              }

              let sanitizedPhoneT = phone.replace(/\s+/g, "").replace(/^(\+|00)/, "");
              const transferCountryInfo = COUNTRIES.find((c: any) => c.code === country);
              if (transferCountryInfo) {
                const dialDigits = transferCountryInfo.phoneCode.replace("+", "");
                if (!sanitizedPhoneT.startsWith(dialDigits)) {
                  sanitizedPhoneT = dialDigits + sanitizedPhoneT;
                }
              }

              // Streaming progressif : 3 étapes visibles
              res.write(`data: ${JSON.stringify({ content: "Transaction initiée avec succès.\n" })}\n\n`);
              const emaliBalanceUpdateEvtT = `data: ${JSON.stringify({ type: "balance_update" })}\n\n`;
              res.write(emaliBalanceUpdateEvtT);
              res.write(`data: ${JSON.stringify({ content: "Traitement en cours...\n\n" })}\n\n`);

              if (activeProviderT === "fedapay") {
                const result = await handleFedaPayTransfer(userId, user, Math.floor(amount), country, normalizedOperatorT, sanitizedPhoneT, userCurrencyT);
                if (result.success) {
                  if (xFeeT.feeAmount > 0) {
                    await storage.updateUserBalance(userId, -xFeeT.feeAmount);
                    console.log(`[EMALI Transfer fedapay] Exchange fee deducted: ${xFeeT.feeAmount} ${userCurrencyT}`);
                  }
                  res.write(emaliBalanceUpdateEvtT);
                  const xFeeMsgT = xFeeT.feeAmount > 0 ? ` Frais de change: ${xFeeT.feeAmount.toLocaleString("fr-FR")} ${userCurrencyT}.` : "";
                  return JSON.stringify({ success: true, pending: true, montant: Math.floor(amount), destinataire: phone, devise: userCurrencyT, frais: feeInfoT.feeAmount, transactionId: result.transactionId, message: `Transfert soumis avec succès. Montant: ${Math.floor(amount).toLocaleString("fr-FR")} ${userCurrencyT} vers ${phone}. Frais: ${feeInfoT.feeAmount.toLocaleString("fr-FR")} ${userCurrencyT}.${xFeeMsgT} Total débité: ${requiredBalanceT.toLocaleString("fr-FR")} ${userCurrencyT}. Transaction ID: ${result.transactionId}. Traitement en cours chez le fournisseur.` });
                } else {
                  return JSON.stringify({ success: false, error: result.error || "Erreur lors du transfert" });
                }
              } else if (activeProviderT === "paydunya") {
                const withdrawModeMapT: Record<string, string> = {
                  "orange-sn": "orange-money-senegal", "free-sn": "free-money-senegal", "expresso-sn": "expresso-senegal",
                  "wave-sn": "wave-senegal", "wizall-sn": "wizall-senegal",
                  "orange-ci": "orange-money-ci", "mtn-ci": "mtn-ci", "moov-ci": "moov-ci", "wave-ci": "wave-ci",
                  "orange-bf": "orange-money-burkina", "moov-bf": "moov-burkina-faso",
                  "moov-bj": "moov-benin", "mtn-bj": "mtn-benin",
                  "tmoney-tg": "t-money-togo", "togocom-tg": "t-money-togo", "moov-tg": "moov-togo",
                  "orange-ml": "orange-money-mali", "moov-ml": "moov-mali",
                  "mtn-cm": "mtn-cameroun",
                };
                const withdrawModeT = withdrawModeMapT[`${normalizedOperatorT}-${country.toLowerCase()}`];
                if (!withdrawModeT) return JSON.stringify({ success: false, error: "Cet opérateur n'est pas disponible pour les transferts dans ce pays." });

                let cleanPhoneT = sanitizedPhoneT.replace(/[\s\-\.]+/g, "");
                const countryPhoneInfoT: Record<string, { code: string, localLength: number[] }> = {
                  "SN": { code: "221", localLength: [9] }, "CI": { code: "225", localLength: [10] },
                  "BF": { code: "226", localLength: [8] }, "BJ": { code: "229", localLength: [8, 10] },
                  "TG": { code: "228", localLength: [8] }, "ML": { code: "223", localLength: [8] },
                  "CM": { code: "237", localLength: [9] },
                };
                const phoneInfoT = countryPhoneInfoT[country.toUpperCase()];
                if (phoneInfoT) {
                  if (cleanPhoneT.startsWith(phoneInfoT.code)) {
                    const withoutCodeT = cleanPhoneT.substring(phoneInfoT.code.length);
                    if (phoneInfoT.localLength.includes(withoutCodeT.length)) {
                      cleanPhoneT = withoutCodeT;
                    }
                  }
                }

                const chatbotTCurrencies: Record<string, string> = { "CM": "XAF" };
                const chatbotTProviderCurrency = chatbotTCurrencies[country.toUpperCase()] || "XOF";
                let providerAmountT = Math.floor(amount);
                if (userCurrencyT !== chatbotTProviderCurrency) {
                  const { convertCurrency } = await import("./currency-converter");
                  const convT = await convertCurrency(Math.floor(amount), userCurrencyT, chatbotTProviderCurrency);
                  if (convT.success) providerAmountT = Math.floor(convT.convertedAmount);
                  else return JSON.stringify({ success: false, error: "Erreur de conversion de devise" });
                }

                await storage.updateUserBalance(userId, -requiredBalanceT);
                res.write(emaliBalanceUpdateEvtT);
                const pendingTxT = await storage.createTransaction({ userId, type: "transfer", amount: Math.floor(amount), fee: feeInfoT.feeAmount, feePercentage: feeInfoT.feePercentage, currency: userCurrencyT, status: "pending", country, operator: normalizedOperatorT, customerPhone: cleanPhoneT, description: `Transfert de ${Math.floor(amount)} ${userCurrencyT}`, metadata: JSON.stringify({ provider: "paydunya", providerAmount: providerAmountT, providerCurrency: chatbotTProviderCurrency, exchangeFee: xFeeT.feeAmount }) });

                const callbackUrlT = `${process.env.BASE_URL || 'https://bkapay.com'}/api/webhooks/paydunya-disburse`;
                const getInvoiceT = await callPaydunyaAPIv2("/disburse/get-invoice", { account_alias: cleanPhoneT, amount: providerAmountT, withdraw_mode: withdrawModeT, callback_url: callbackUrlT });
                if (getInvoiceT.response_code !== "00" || !getInvoiceT.disburse_token) {
                  await storage.updateUserBalance(userId, requiredBalanceT);
                  await storage.updateTransaction(pendingTxT.id, { status: "failed" });
                  res.write(emaliBalanceUpdateEvtT);
                  return JSON.stringify({ success: false, error: "Le transfert n'a pas pu être traité. Votre solde a été recrédité. Veuillez réessayer." });
                }

                const submitT = await callPaydunyaAPIv2("/disburse/submit-invoice", { disburse_invoice: getInvoiceT.disburse_token, disburse_id: `transfer-${user.id.substring(0, 8)}-${Date.now()}` });
                if (submitT.response_code === "00") {
                  await storage.updateTransaction(pendingTxT.id, { status: "processing", paydunyaToken: getInvoiceT.disburse_token });
                  return JSON.stringify({ success: true, pending: true, montant: Math.floor(amount), destinataire: cleanPhoneT, devise: userCurrencyT, frais: feeInfoT.feeAmount, transactionId: pendingTxT.id, message: `Transfert soumis avec succès. Montant: ${Math.floor(amount).toLocaleString("fr-FR")} ${userCurrencyT}. Frais: ${feeInfoT.feeAmount.toLocaleString("fr-FR")} ${userCurrencyT}. Total débité: ${requiredBalanceT.toLocaleString("fr-FR")} ${userCurrencyT}. Transaction ID: ${pendingTxT.id}. Traitement en cours chez le fournisseur.` });
                }
                await storage.updateUserBalance(userId, requiredBalanceT);
                await storage.updateTransaction(pendingTxT.id, { status: "failed" });
                res.write(emaliBalanceUpdateEvtT);
                return JSON.stringify({ success: false, error: "Transfert échoué. Votre solde a été recrédité." });
              } else if (activeProviderT === "pawapay") {
                const result = await handlePawaPayTransfer(userId, user, Math.floor(amount), country, normalizedOperatorT, sanitizedPhoneT, userCurrencyT, destCurrencyT);
                if (result.success) {
                  if (xFeeT.feeAmount > 0) {
                    await storage.updateUserBalance(userId, -xFeeT.feeAmount);
                    console.log(`[EMALI Transfer pawapay] Exchange fee deducted: ${xFeeT.feeAmount} ${userCurrencyT}`);
                  }
                  res.write(emaliBalanceUpdateEvtT);
                  const xFeeMsgTP = xFeeT.feeAmount > 0 ? ` Frais de change: ${xFeeT.feeAmount.toLocaleString("fr-FR")} ${userCurrencyT}.` : "";
                  return JSON.stringify({ success: true, pending: true, montant: Math.floor(amount), destinataire: phone, devise: userCurrencyT, frais: feeInfoT.feeAmount, transactionId: result.transactionId, message: `Transfert soumis avec succès. Montant: ${Math.floor(amount).toLocaleString("fr-FR")} ${userCurrencyT} vers ${phone}. Frais: ${feeInfoT.feeAmount.toLocaleString("fr-FR")} ${userCurrencyT}.${xFeeMsgTP} Total débité: ${requiredBalanceT.toLocaleString("fr-FR")} ${userCurrencyT}. Transaction ID: ${result.transactionId}. Traitement en cours chez le fournisseur.` });
                }
                res.write(emaliBalanceUpdateEvtT);
                return JSON.stringify({ success: false, error: result.error || "Erreur lors du transfert" });
              } else if (activeProviderT === "mbiyopay") {
                const result = await handleMbiyoPayTransfer(userId, user, Math.floor(amount), country, normalizedOperatorT, sanitizedPhoneT, userCurrencyT);
                if (result.success) {
                  if (xFeeT.feeAmount > 0) {
                    await storage.updateUserBalance(userId, -xFeeT.feeAmount);
                    console.log(`[EMALI Transfer mbiyopay] Exchange fee deducted: ${xFeeT.feeAmount} ${userCurrencyT}`);
                  }
                  res.write(emaliBalanceUpdateEvtT);
                  const xFeeMsgTM = xFeeT.feeAmount > 0 ? ` Frais de change: ${xFeeT.feeAmount.toLocaleString("fr-FR")} ${userCurrencyT}.` : "";
                  return JSON.stringify({ success: true, pending: true, montant: Math.floor(amount), destinataire: phone, devise: userCurrencyT, frais: feeInfoT.feeAmount, transactionId: result.transactionId, message: `Transfert soumis avec succès.${xFeeMsgTM} Total débité: ${requiredBalanceT.toLocaleString("fr-FR")} ${userCurrencyT}. Transaction ID: ${result.transactionId}. Traitement en cours chez le fournisseur.` });
                }
                res.write(emaliBalanceUpdateEvtT);
                return JSON.stringify({ success: false, error: result.error || "Erreur lors du transfert" });
              } else if (activeProviderT === "afribapay") {
                const result = await handleAfribaPayTransfer(userId, user, Math.floor(amount), country, normalizedOperatorT, sanitizedPhoneT, userCurrencyT);
                if (result.success) {
                  if (xFeeT.feeAmount > 0) {
                    await storage.updateUserBalance(userId, -xFeeT.feeAmount);
                    console.log(`[EMALI Transfer afribapay] Exchange fee deducted: ${xFeeT.feeAmount} ${userCurrencyT}`);
                  }
                  res.write(emaliBalanceUpdateEvtT);
                  const xFeeMsgTA = xFeeT.feeAmount > 0 ? ` Frais de change: ${xFeeT.feeAmount.toLocaleString("fr-FR")} ${userCurrencyT}.` : "";
                  return JSON.stringify({ success: true, pending: true, montant: Math.floor(amount), destinataire: phone, devise: userCurrencyT, frais: feeInfoT.feeAmount, transactionId: result.transactionId, message: `Transfert soumis avec succès.${xFeeMsgTA} Total débité: ${requiredBalanceT.toLocaleString("fr-FR")} ${userCurrencyT}. Transaction ID: ${result.transactionId}. Traitement en cours chez le fournisseur.` });
                }
                res.write(emaliBalanceUpdateEvtT);
                return JSON.stringify({ success: false, error: result.error || "Erreur lors du transfert" });
              } else if (activeProviderT === "moneyfusion") {
                const result = await handleMoneyFusionTransfer(userId, user, Math.floor(amount), country, normalizedOperatorT, sanitizedPhoneT, userCurrencyT);
                if (result.success) {
                  if (xFeeT.feeAmount > 0) {
                    await storage.updateUserBalance(userId, -xFeeT.feeAmount);
                    console.log(`[EMALI Transfer moneyfusion] Exchange fee deducted: ${xFeeT.feeAmount} ${userCurrencyT}`);
                  }
                  res.write(emaliBalanceUpdateEvtT);
                  const xFeeMsgTF = xFeeT.feeAmount > 0 ? ` Frais de change: ${xFeeT.feeAmount.toLocaleString("fr-FR")} ${userCurrencyT}.` : "";
                  return JSON.stringify({ success: true, pending: true, montant: Math.floor(amount), destinataire: phone, devise: userCurrencyT, frais: feeInfoT.feeAmount, transactionId: result.transactionId, message: `Transfert soumis avec succès.${xFeeMsgTF} Total débité: ${requiredBalanceT.toLocaleString("fr-FR")} ${userCurrencyT}. Transaction ID: ${result.transactionId}. Traitement en cours chez le fournisseur.` });
                }
                res.write(emaliBalanceUpdateEvtT);
                return JSON.stringify({ success: false, error: result.error || "Erreur lors du transfert" });
              } else if (activeProviderT === "feexpay") {
                const result = await handleFeeXPayTransfer(userId, user, Math.floor(amount), country, normalizedOperatorT, sanitizedPhoneT, userCurrencyT);
                if (result.success) {
                  if (xFeeT.feeAmount > 0) {
                    await storage.updateUserBalance(userId, -xFeeT.feeAmount);
                    console.log(`[EMALI Transfer feexpay] Exchange fee deducted: ${xFeeT.feeAmount} ${userCurrencyT}`);
                  }
                  res.write(emaliBalanceUpdateEvtT);
                  const xFeeMsgTX = xFeeT.feeAmount > 0 ? ` Frais de change: ${xFeeT.feeAmount.toLocaleString("fr-FR")} ${userCurrencyT}.` : "";
                  return JSON.stringify({ success: true, pending: true, montant: Math.floor(amount), destinataire: phone, devise: userCurrencyT, frais: feeInfoT.feeAmount, transactionId: result.transactionId, message: `Transfert soumis avec succès.${xFeeMsgTX} Total débité: ${requiredBalanceT.toLocaleString("fr-FR")} ${userCurrencyT}. Transaction ID: ${result.transactionId}. Traitement en cours chez le fournisseur.` });
                }
                res.write(emaliBalanceUpdateEvtT);
                return JSON.stringify({ success: false, error: result.error || "Erreur lors du transfert" });
              }

              return JSON.stringify({ success: false, error: "Cette opération n'est pas disponible actuellement. Veuillez réessayer plus tard." });
            }

            case "convert_currency": {
              const { convertCurrency } = await import("./currency-converter");
              const convResult = await convertCurrency(args.amount, args.fromCurrency, args.toCurrency);
              if (convResult.success) {
                return JSON.stringify({
                  success: true,
                  montantOriginal: convResult.originalAmount,
                  deviseOrigine: convResult.originalCurrency,
                  montantConverti: Math.floor(convResult.convertedAmount),
                  deviseCible: convResult.targetCurrency,
                  tauxDeChange: convResult.conversionRate,
                });
              }
              return JSON.stringify({ success: false, error: convResult.error || "Erreur de conversion" });
            }

            default:
              return JSON.stringify({ error: "Fonction inconnue" });
          }
        } catch (err: any) {
          console.error(`[EMALI] Tool error (${toolName}):`, err);
          return JSON.stringify({ success: false, error: err.message || "Erreur interne" });
        }
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const conversationMessages: any[] = [
        { role: "system", content: systemPrompt },
        ...userMessages.map((m: any) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      let maxToolRounds = 5;
      while (maxToolRounds > 0) {
        maxToolRounds--;

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: conversationMessages,
          tools: emaliTools,
          tool_choice: "auto",
          max_completion_tokens: 2048,
        });

        const choice = response.choices[0];

        if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
          conversationMessages.push(choice.message);

          for (const toolCall of choice.message.tool_calls) {
            let fnName = "";
            let fnArgs: any = {};
            let toolResult: string;

            try {
              fnName = (toolCall as any).function.name;
              fnArgs = JSON.parse((toolCall as any).function.arguments);
              console.log(`[EMALI] Tool call: ${fnName}(${JSON.stringify(fnArgs)})`);
              toolResult = await handleToolCall(fnName, fnArgs, currentUserId!);
            } catch (parseErr: any) {
              console.error(`[EMALI] Tool parse/exec error:`, parseErr);
              toolResult = JSON.stringify({ success: false, error: "Erreur interne lors du traitement de la demande" });
            }

            console.log(`[EMALI] Tool result: ${toolResult}`);
            conversationMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: toolResult,
            });
          }
          continue;
        }

        if (choice.message.content) {
          const finalContent = choice.message.content;
          const chunkSize = 20;
          for (let i = 0; i < finalContent.length; i += chunkSize) {
            const chunk = finalContent.slice(i, i + chunkSize);
            res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
          }
        }

        break;
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error: any) {
      console.error("[EMALI] Error:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Une erreur est survenue" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Une erreur est survenue avec l'assistant EMALI" });
      }
    }
  });

  // Server IP - Admin endpoint
  app.get("/api/admin/server-ip", requireAdmin, async (req: Request, res: Response) => {
    const results: Record<string, string | null> = { ipv4: null, ipv6: null };
    try {
      const [r4, r6] = await Promise.allSettled([
        fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(5000) }).then(r => r.json()),
        fetch("https://api6.ipify.org?format=json", { signal: AbortSignal.timeout(5000) }).then(r => r.json()),
      ]);
      if (r4.status === "fulfilled") results.ipv4 = r4.value.ip || null;
      if (r6.status === "fulfilled") results.ipv6 = r6.value.ip || null;
    } catch {}
    res.json(results);
  });

  // MoneyFusion IP Logs - Admin routes
  app.get("/api/admin/moneyfusion-ip-logs", requireAdmin, async (req: Request, res: Response) => {
    try {
      const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
      const result = await pool.query("SELECT * FROM moneyfusion_ip_logs ORDER BY created_at DESC LIMIT 100");
      await pool.end();
      res.json(result.rows);
    } catch (error: any) {
      console.error("[Admin IP Logs] Error:", error);
      res.json([]);
    }
  });

  app.post("/api/admin/moneyfusion-ip-logs/:id/resolve", requireAdmin, async (req: Request, res: Response) => {
    try {
      const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
      await pool.query("UPDATE moneyfusion_ip_logs SET resolved = TRUE WHERE id = $1", [req.params.id]);
      await pool.end();
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Admin IP Logs] Resolve error:", error);
      res.status(500).json({ error: "Erreur" });
    }
  });

  app.delete("/api/admin/moneyfusion-ip-logs/resolved", requireAdmin, async (req: Request, res: Response) => {
    try {
      const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
      await pool.query("DELETE FROM moneyfusion_ip_logs WHERE resolved = TRUE");
      await pool.end();
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Admin IP Logs] Delete resolved error:", error);
      res.status(500).json({ error: "Erreur" });
    }
  });

  app.delete("/api/admin/moneyfusion-ip-logs/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
      await pool.query("DELETE FROM moneyfusion_ip_logs WHERE id = $1", [req.params.id]);
      await pool.end();
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Admin IP Logs] Delete error:", error);
      res.status(500).json({ error: "Erreur" });
    }
  });

  app.get("/api/admin/active-users-7d", requireAdmin, async (req: Request, res: Response) => {
    try {
      const pool = new (await import("pg")).default.Pool({ connectionString: process.env.DATABASE_URL });
      const result = await pool.query(`
        SELECT DISTINCT u.* FROM users u
        WHERE u.id IN (
          SELECT DISTINCT t.user_id FROM transactions t
          WHERE t.created_at >= NOW() - INTERVAL '7 days'
          AND t.status = 'completed'
          AND t.type IN ('deposit', 'withdrawal', 'transfer')
        ) OR u.id IN (
          SELECT DISTINCT ll.user_id FROM login_logs ll
          WHERE ll.created_at >= NOW() - INTERVAL '7 days'
        )
        ORDER BY u.first_name ASC
      `);
      await pool.end();
      res.json(result.rows.map((r: any) => ({
        id: r.id,
        email: r.email,
        firstName: r.first_name,
        lastName: r.last_name,
        country: r.country,
        balance: parseFloat(r.balance) || 0,
        kycStatus: r.kyc_status,
        isAdmin: r.is_admin,
        accountType: r.account_type,
        createdAt: r.created_at,
      })));
    } catch (error: any) {
      console.error("[Admin] Active users 7d error:", error);
      res.status(500).json({ error: "Erreur" });
    }
  });

  app.get("/api/admin/pending-broadcast", requireAdmin, async (req: Request, res: Response) => {
    try {
      const result = await pgPool.query("SELECT value FROM platform_settings WHERE key = 'pending_broadcast'");
      const setting = result.rows[0]?.value;
      if (setting) {
        res.json(JSON.parse(setting));
      } else {
        res.json(null);
      }
    } catch {
      res.json(null);
    }
  });

  app.post("/api/admin/save-pending-broadcast", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { data } = req.body;
      const value = data ? JSON.stringify(data) : "";
      await pgPool.query(
        "INSERT INTO platform_settings (key, value, updated_at) VALUES ('pending_broadcast', $1, NOW()) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()",
        [value]
      );
      res.json({ ok: true });
    } catch (err: any) {
      console.error("[Admin] save-pending-broadcast error:", err);
      res.status(500).json({ error: "Erreur" });
    }
  });

  // ==================== Admin Messaging ====================
  app.post("/api/admin/polish-message", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { message, subject } = req.body;
      if (!message || typeof message !== "string" || !message.trim()) {
        return res.status(400).json({ error: "Message requis" });
      }
      if (subject && typeof subject !== "string") {
        return res.status(400).json({ error: "Sujet invalide" });
      }

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Tu es un assistant de redaction professionnel pour BKApay, une plateforme de paiement mobile money en Afrique.
Ton role est de reformuler et ameliorer les messages que l'administrateur souhaite envoyer aux utilisateurs par email.
- Garde le meme sens et intention du message original
- Utilise un ton professionnel, respectueux et chaleureux
- Corrige les fautes d'orthographe et de grammaire
- Structure le message avec des paragraphes clairs et bien separes (saute une ligne entre chaque paragraphe)
- Le message doit etre en francais
- NE PAS commencer par "Bonjour" car le systeme ajoute automatiquement "Bonjour [Prenom]" avant ton message
- Termine TOUJOURS le message par une formule de politesse professionnelle suivie d'un saut de ligne puis "Cordialement," puis un saut de ligne puis "L'equipe BKApay"
- Retourne UNIQUEMENT le message ameliore, sans commentaire ni explication`
          },
          {
            role: "user",
            content: `Ameliore ce message${subject ? ` (sujet: "${subject}")` : ""}:\n\n${message}`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      const polishedMessage = completion.choices[0]?.message?.content || message;
      res.json({ polishedMessage });
    } catch (error: any) {
      console.error("[Admin Messages] AI polish error:", error);
      res.status(500).json({ error: "Erreur lors de l'amelioration du message" });
    }
  });

  app.post("/api/admin/send-broadcast", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { subject, message, audienceType, accountType, kycFilter, userIds } = req.body;
      if (!subject || typeof subject !== "string" || !subject.trim()) {
        return res.status(400).json({ error: "Sujet requis" });
      }
      if (!message || typeof message !== "string" || !message.trim()) {
        return res.status(400).json({ error: "Message requis" });
      }
      if (subject.length > 200) {
        return res.status(400).json({ error: "Sujet trop long (max 200 caracteres)" });
      }
      if (message.length > 5000) {
        return res.status(400).json({ error: "Message trop long (max 5000 caracteres)" });
      }

      const { sendAdminBroadcastEmail } = await import("./email-service");
      const personalUsers = await storage.getAllUsers();
      const businessUsers = await storage.getBusinessUsers();
      const combinedUsers = [...personalUsers, ...businessUsers];

      let targetUsers: typeof combinedUsers = [];

      if (audienceType === "selected" && userIds && Array.isArray(userIds)) {
        targetUsers = combinedUsers.filter(u => userIds.includes(u.id));
      } else {
        targetUsers = combinedUsers.filter(u => !u.isAdmin);

        if (accountType === "personal") {
          targetUsers = targetUsers.filter(u => !u.accountType || u.accountType === "personal");
        } else if (accountType === "merchant") {
          targetUsers = targetUsers.filter(u => u.accountType === "business");
        }

        if (kycFilter === "verified") {
          targetUsers = targetUsers.filter(u => u.kycStatus === "verified");
        } else if (kycFilter === "unverified") {
          targetUsers = targetUsers.filter(u => u.kycStatus !== "verified");
        } else if (kycFilter === "rejected") {
          targetUsers = targetUsers.filter(u => u.kycStatus === "rejected");
        }
      }

      if (targetUsers.length === 0) {
        return res.status(400).json({ error: "Aucun utilisateur correspondant aux criteres" });
      }

      let sent = 0;
      let failed = 0;
      const failedUserIds: string[] = [];

      for (const user of targetUsers) {
        try {
          const success = await sendAdminBroadcastEmail(
            user.email,
            user.firstName || user.email,
            subject,
            message
          );
          if (success) sent++;
          else {
            failed++;
            failedUserIds.push(user.id);
          }
        } catch (e) {
          failed++;
          failedUserIds.push(user.id);
          console.error(`[Admin Messages] Failed to send to ${user.email}:`, e);
        }
      }

      res.json({ sent, failed, total: targetUsers.length, failedUserIds });
    } catch (error: any) {
      console.error("[Admin Messages] Broadcast error:", error);
      res.status(500).json({ error: "Erreur lors de l'envoi des messages" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
