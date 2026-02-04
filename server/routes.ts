import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import connectPg from "connect-pg-simple";
import pg from "pg";
import bcrypt from "bcrypt";
import { z } from "zod";
import { insertUserSchema, insertPaymentLinkSchema, insertMerchantLinkSchema, insertApiKeySchema } from "@shared/schema";
import { validatePhoneOperator } from "@shared/phone-utils";
import { randomUUID } from "crypto";
import { calculateIncomingFee, calculateOutgoingFee, calculateCustomerPaysFee, getFeeFromDatabase, getDynamicFees, getDynamicOutgoingFees, getActiveProviderForCountry, getActivePayoutProviderForCountry } from "./utils/fees";
import { sendPaymentCallback } from "./utils/callback";
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
} from "./mbiyopay-routes";
import {
  MBIYOPAY_SUPPORTED_COUNTRIES,
  MBIYOPAY_OPERATORS,
} from "./mbiyopay";
import {
  generateVerificationCode,
  sendVerificationEmail,
  isEmailServiceConfigured,
  isEmailSendingEnabled,
  clearEmailConfigCache,
  testEmailConnection,
  EmailType,
} from "./email-service";
import nowpaymentsRoutes from "./nowpayments-routes";
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
import { AFRIBAPAY_COUNTRIES, getCurrencyForCountry as getAfribaCurrency, getPaymentInstructions as getAfribaPaymentInstructions } from "@shared/afribapay-countries";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

// Middleware pour vérifier l'authentification par session
async function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Non authentifié" });
  }
  
  // Check if user account is suspended - auto logout if suspended
  const user = await storage.getUser(req.session.userId);
  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: "Non authentifié" });
  }
  
  if (user.suspended) {
    req.session.destroy(() => {});
    return res.status(403).json({ error: "Votre compte a été suspendu. Veuillez contacter le support." });
  }
  
  next();
}

// Middleware pour vérifier l'authentification administrateur
async function requireAdmin(req: Request, res: Response, next: Function) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Non authentifié" });
  }
  const user = await storage.getUser(req.session.userId);
  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: "Non authentifié" });
  }
  
  // Admin accounts can still be suspended (for security)
  if (user.suspended) {
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
): Promise<{ success: boolean; message: string; data?: any; fees?: number; currency?: string; url?: string; transactionId?: string }> {
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
      return {
        success: true,
        message: result.message || "Paiement initié avec succès",
        data: result.data,
        fees: result.fees,
        currency: result.currency,
        url: result.url,
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

export async function registerRoutes(app: Express): Promise<Server> {
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
        maxAge: 5 * 60 * 60 * 1000, // 5 hours - session expires after 5 hours of inactivity
      },
    })
  );

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
      const validatedData = insertUserSchema.parse(userData);
      
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
      
      res.json({ 
        success: true, 
        message: "Compte créé avec succès",
        user: {
          id: user.id,
          email: user.email,
          fullName: `${user.firstName} ${user.lastName}`,
          isAdmin: user.isAdmin,
          balance: user.balance,
        }
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

      const user = await storage.getUserByEmail(email);
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
        console.log(`[Login] ${user.email} connecté directement (2FA disabled: ${!tfaEnabled}, isAdmin: ${user.isAdmin})`);
        return res.json({
          success: true,
          message: "Connexion réussie",
          requiresCode: false,
          user: {
            id: user.id,
            email: user.email,
            fullName: `${user.firstName} ${user.lastName}`,
            isAdmin: user.isAdmin,
            balance: user.balance,
          }
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
      res.json({ success: true, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName } });
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

  // Get current user
  app.get("/api/auth/me", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }
      
      // Don't send password
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
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
      const { kycIdFront, kycIdBack, kycSelfie, kycSignature } = req.body;

      if (!kycIdFront || !kycIdBack || !kycSelfie || !kycSignature) {
        return res.status(400).json({ error: "Tous les documents sont requis" });
      }

      const user = await storage.submitKyc(req.session.userId!, {
        kycIdFront,
        kycIdBack,
        kycSelfie,
        kycSignature,
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
      const links = await storage.getPaymentLinks(req.session.userId!);
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

      res.json({
        ...link,
        ownerCountry: owner?.country || null,
        ownerCurrency,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.post("/api/payment-links", requireAuth, async (req: Request, res: Response) => {
    try {
      const validatedData = insertPaymentLinkSchema.parse(req.body);
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
        isActive: z.boolean().optional(),
        allowedCountries: z.array(z.string()).optional(),
        customerPaysFee: z.boolean().optional(),
      });
      const validatedData = patchPaymentLinkSchema.parse(req.body);
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

  // Update API key settings (allowed countries and customer pays fee)
  app.patch("/api/api-keys/:id/settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const keyId = req.params.id;
      const userId = req.session.userId!;
      const { allowedCountries, customerPaysFee } = req.body;

      const settingsSchema = z.object({
        allowedCountries: z.array(z.string()).optional(),
        customerPaysFee: z.boolean().optional(),
      });

      const validatedData = settingsSchema.parse({ allowedCountries, customerPaysFee });
      
      const updatedKey = await storage.updateApiKeySettings(keyId, userId, validatedData);
      if (!updatedKey) {
        return res.status(404).json({ error: "Clé API non trouvée" });
      }

      res.json({
        success: true,
        allowedCountries: updatedKey.allowedCountries,
        customerPaysFee: updatedKey.customerPaysFee,
        message: "Paramètres mis à jour avec succès"
      });
    } catch (error: any) {
      console.error("Error updating API key settings:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
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
      const ownerCurrency = owner?.country ? getCurrencyForCountry(owner.country) : "XOF";
      
      res.json({
        siteName: (apiKey as any).siteName || apiKey.name,
        isActive: apiKey.isActive,
        allowedCountries: apiKey.allowedCountries || [],
        customerPaysFee: apiKey.customerPaysFee || false,
        ownerCurrency,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // Initialize API payment
  app.post("/api/api-pay/init", async (req: Request, res: Response) => {
    try {
      const { publicKey, amount, description, customerName, customerEmail, customerPhone, country, operator, currency: requestCurrency, callbackUrl, orderId } = req.body;

      if (!publicKey || !amount || !customerPhone || !country || !operator) {
        return res.status(400).json({ error: "Donnees manquantes" });
      }

      // Validate API key
      const apiKey = await storage.getApiKeyByPublicKey(publicKey);
      if (!apiKey || !apiKey.isActive) {
        return res.status(401).json({ error: "Cle API invalide ou inactive" });
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
      
      const grossAmount = Math.floor(Number(amount));
      if (grossAmount < 200) {
        return res.status(400).json({ error: "Montant minimum: 200" });
      }

      // Calculate fees on the amount in owner's currency with dynamic fee from database
      const { calculateIncomingFee, getFeeFromDatabase } = await import("./utils/fees");
      const apiInitFeeConfig = await getFeeFromDatabase(storage, activeProvider, country, operator);
      const feeInfo = calculateIncomingFee(grossAmount, apiInitFeeConfig.incoming);

      if (activeProvider === "mbiyopay") {
        // Use MbiyoPay
        const { createMbiyoPayPayin, getCurrencyForCountry: getMbiyoCurrency } = await import("./mbiyopay");
        // Provider currency is based on the payer's country
        const providerCurrency = requestCurrency || getMbiyoCurrency(country);
        
        // CRITICAL: Convert amount from owner's currency to provider currency if different
        let amountForProvider = grossAmount;
        if (ownerCurrency !== providerCurrency) {
          const { convertCurrency } = await import("./currency-converter");
          const conversionResult = await convertCurrency(grossAmount, ownerCurrency, providerCurrency);
          if (conversionResult.success) {
            amountForProvider = Math.floor(conversionResult.convertedAmount);
            console.log(`[API-PAY INIT] Currency conversion: ${grossAmount} ${ownerCurrency} -> ${amountForProvider} ${providerCurrency}`);
          } else {
            console.error("[API-PAY INIT] Currency conversion failed:", conversionResult.error);
            return res.status(500).json({ error: "Erreur de conversion de devise" });
          }
        }

        console.log(`[API-PAY INIT] Using MbiyoPay for ${country}/${operator}, phone=${customerPhone}, providerCurrency=${providerCurrency}`);

        const result = await createMbiyoPayPayin({
          amount: amountForProvider, // ALWAYS send converted amount to provider
          currency: providerCurrency,
          phone: customerPhone,
          countryCode: country,
          network: operator,
          orderId: `BKAPAY-APIPAY-${Date.now()}`,
          callbackUrl: `${process.env.BASE_URL || "https://bkapay.com"}/api/webhooks/mbiyopay`,
        });

        if (!result.success) {
          return res.status(400).json({ success: false, error: result.error || "Erreur lors du paiement" });
        }

        // Create transaction record - store in owner's currency for balance credit
        const tx = await storage.createTransaction({
          userId: apiKey.userId,
          type: "api_payment",
          amount: grossAmount, // Store in owner's currency
          fee: feeInfo.feeAmount,
          feePercentage: feeInfo.feePercentage,
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
            provider: "mbiyopay",
            providerAmount: amountForProvider,
            providerCurrency: providerCurrency,
            balanceAmount: grossAmount,
            balanceCurrency: ownerCurrency,
          }),
        });

        return res.json({
          success: true,
          transactionId: tx.id,
          token: tx.id,
          redirectUrl: result.redirectUrl,
          message: result.message || "Paiement initie. Veuillez valider sur votre telephone.",
          provider: "mbiyopay",
        });
      } else if (activeProvider === "fedapay") {
        // Use FedaPay - always uses XOF currency
        const { createCollect } = await import("./fedapay");
        const providerCurrency = "XOF"; // FedaPay only supports XOF

        // CRITICAL: Convert amount from owner's currency to XOF if different
        let amountForProvider = grossAmount;
        if (ownerCurrency !== providerCurrency) {
          const { convertCurrency } = await import("./currency-converter");
          const conversionResult = await convertCurrency(grossAmount, ownerCurrency, providerCurrency);
          if (conversionResult.success) {
            amountForProvider = Math.floor(conversionResult.convertedAmount);
            console.log(`[API-PAY INIT] Currency conversion: ${grossAmount} ${ownerCurrency} -> ${amountForProvider} ${providerCurrency}`);
          } else {
            console.error("[API-PAY INIT] Currency conversion failed:", conversionResult.error);
            return res.status(500).json({ error: "Erreur de conversion de devise" });
          }
        }

        console.log(`[API-PAY INIT] Using FedaPay for ${country}/${operator}, phone=${customerPhone}, providerCurrency=${providerCurrency}`);

        const result = await createCollect({
          amount: amountForProvider, // ALWAYS send converted amount to provider
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

        // Create transaction record - store in owner's currency for balance credit
        const tx = await storage.createTransaction({
          userId: apiKey.userId,
          type: "api_payment",
          amount: grossAmount, // Store in owner's currency
          fee: feeInfo.feeAmount,
          feePercentage: feeInfo.feePercentage,
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
            provider: "fedapay",
            providerAmount: amountForProvider,
            providerCurrency: providerCurrency,
            balanceAmount: grossAmount,
            balanceCurrency: ownerCurrency,
          }),
        });

        return res.json({
          success: true,
          transactionId: tx.id,
          token: tx.id,
          message: result.message || "Paiement initie. Veuillez valider sur votre telephone.",
          provider: "fedapay",
        });
      } else if (activeProvider === "paydunya") {
        // Use Paydunya
        const providerCurrency = "XOF"; // Paydunya only accepts XOF
        
        // CRITICAL: Convert amount from owner's currency to XOF if different
        let amountForProvider = grossAmount;
        if (ownerCurrency !== providerCurrency) {
          const { convertCurrency } = await import("./currency-converter");
          const conversionResult = await convertCurrency(grossAmount, ownerCurrency, providerCurrency);
          if (conversionResult.success) {
            amountForProvider = Math.floor(conversionResult.convertedAmount);
            console.log(`[API-PAY INIT] Currency conversion: ${grossAmount} ${ownerCurrency} -> ${amountForProvider} ${providerCurrency}`);
          } else {
            console.error("[API-PAY INIT] Currency conversion failed:", conversionResult.error);
            return res.status(500).json({ error: "Erreur de conversion de devise" });
          }
        }
        
        console.log(`[API-PAY INIT] Using Paydunya for ${country}/${operator}, phone=${customerPhone}, providerAmount=${amountForProvider}`);
        
        const paydunyaData = {
          invoice: {
            total_amount: amountForProvider, // ALWAYS send converted amount to provider
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
          },
          actions: {
            callback_url: `${process.env.BASE_URL || 'https://bkapay.com'}/api/webhooks/paydunya`,
          },
        };

        const paydunyaResponse = await callPaydunyaAPI("/checkout-invoice/create", paydunyaData);

        if (paydunyaResponse.response_code !== "00" || !paydunyaResponse.token) {
          return res.status(400).json({ success: false, error: "Paiement echoue" });
        }

        // Create transaction record - store in owner's currency for balance credit
        const tx = await storage.createTransaction({
          userId: apiKey.userId,
          type: "api_payment",
          amount: grossAmount, // Store in owner's currency
          fee: feeInfo.feeAmount,
          feePercentage: feeInfo.feePercentage,
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
            provider: "paydunya",
            country: country.toUpperCase(),
            operator: operator,
            providerAmount: amountForProvider,
            providerCurrency: providerCurrency,
            balanceAmount: grossAmount,
            balanceCurrency: ownerCurrency,
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

        // Wave redirect URL
        if (softpayResult.url) {
          response.redirectUrl = softpayResult.url;
          console.log(`[API-PAY INIT] Wave redirect URL: ${softpayResult.url}`);
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

        return res.json(response);
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
  
  app.get("/api/transactions", requireAuth, async (req: Request, res: Response) => {
    try {
      const transactions = await storage.getTransactions(req.session.userId!);
      res.json(transactions);
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
      res.json(transaction);
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
      const { customerName, customerEmail, customerPhone, country, operator } = req.body;
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

      // Get owner's currency and payer's currency
      const ownerCurrency = owner?.country ? getCurrencyForCountry(owner.country) : "XOF";
      const payerCurrency = getCurrencyForCountry(country) || "XOF";
      const providerCurrency = "XOF"; // Paydunya only accepts XOF

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
          callback_url: `${process.env.BASE_URL || 'http://localhost:5000'}/api/webhooks/paydunya`,
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
            balanceAmount: baseAmountInOwnerCurrency,
            balanceCurrency: ownerCurrency,
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

      // Get owner's currency and provider currency
      const ownerCurrency = owner?.country ? getCurrencyForCountry(owner.country) : "XOF";
      const providerCurrency = "XOF"; // Paydunya only accepts XOF
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
          callback_url: `${process.env.BASE_URL || 'http://localhost:5000'}/api/webhooks/paydunya`,
        },
      };

      console.log("[MERCHANT_LINK] Creating invoice with data:", paydunyaData);

      const paydunyaResponse = await callPaydunyaAPI("/checkout-invoice/create", paydunyaData);

      if (paydunyaResponse.response_code === "00") {
        // Calculate fees for INCOMING payment with dynamic fee from database (auto-detect active provider)
        const feeConfig = await getDynamicFees(storage, country, operator);
        const feeInfo = calculateIncomingFee(baseAmountInOwnerCurrency, feeConfig.incoming);
        
        // Create transaction - store in owner's currency for balance credit
        const transactionId = randomUUID();
        await storage.createTransaction({
          userId: merchantLink.userId,
          type: "merchant_link",
          amount: baseAmountInOwnerCurrency, // Store in owner's currency for balance
          fee: feeInfo.feeAmount,
          feePercentage: feeInfo.feePercentage,
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
            providerAmount: convertedAmountForProvider,
            providerCurrency: providerCurrency,
            balanceAmount: baseAmountInOwnerCurrency,
            balanceCurrency: ownerCurrency,
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

      const { amount, description, country, operator, phone, customerName, customerEmail } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Montant invalide" });
      }

      if (!country || !operator || !phone) {
        return res.status(400).json({ error: "Pays, opérateur et numéro de téléphone requis" });
      }

      // Create Paydunya invoice to get token
      // Include customer info in invoice for pre-filling payment page
      // Note: Use generic email for privacy - never send real customer emails to providers
      const effectiveCustomerName = customerName || `${user!.firstName} ${user!.lastName}`;
      
      const paydunyaData = {
        invoice: {
          total_amount: Math.floor(amount),
          description: description || `Dépôt de ${amount} XOF`,
          customer: {
            name: effectiveCustomerName,
            email: "noreply@bkapay.com", // Privacy: never send real customer emails to providers
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
          currency: "XOF",
          status: "pending",
          country,
          operator,
          description: description || `Dépôt de ${grossAmount} XOF`,
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
            // For Wave, return redirect URL
            if (softpayResult.url) {
              return res.json({
                success: true,
                transactionId,
                token: paydunyaResponse.token,
                ussdInstruction: softpayResult.message,
                requiresOTP: false,
                requiresTwoStep: false,
                redirectUrl: softpayResult.url,
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
              redirectUrl: softpayResult.url, // For Wave operators
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
          currency: "XOF",
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
          
          // Send callback for API payments
          if (result.transaction.type === "api_payment") {
            try {
              // Get API key from transaction metadata to find callback URL
              let apiKeyPublicKey: string | undefined;
              if (result.transaction.metadata) {
                try {
                  const metadata = JSON.parse(result.transaction.metadata);
                  apiKeyPublicKey = metadata.apiKeyPublicKey;
                } catch (e) {}
              }
              
              if (apiKeyPublicKey) {
                const apiKey = await storage.getApiKeyByPublicKey(apiKeyPublicKey);
                if (apiKey && apiKey.callbackUrl) {
                  sendPaymentCallback(result.transaction, apiKey, 'payment.completed')
                    .then(callbackResult => {
                      console.log("[WEBHOOK] Callback sent:", callbackResult);
                    })
                    .catch(err => {
                      console.error("[WEBHOOK] Callback error:", err);
                    });
                }
              }
            } catch (callbackError) {
              console.error("[WEBHOOK] Error processing callback:", callbackError);
            }
          }
        } else {
          console.log("[WEBHOOK] Transaction already processed (not pending):", { transactionId: transaction.id });
        }
      } else if (webhookStatus === "failed" || webhookStatus === "cancelled") {
        await storage.updateTransactionStatus(transaction.id, "failed");
        console.log("[WEBHOOK] Transaction marked as failed:", { transactionId: transaction.id });
        
        // Send failed callback for API payments
        if (transaction.type === "api_payment") {
          try {
            let apiKeyPublicKey: string | undefined;
            if (transaction.metadata) {
              try {
                const metadata = JSON.parse(transaction.metadata);
                apiKeyPublicKey = metadata.apiKeyPublicKey;
              } catch (e) {}
            }
            
            if (apiKeyPublicKey) {
              const apiKey = await storage.getApiKeyByPublicKey(apiKeyPublicKey);
              if (apiKey && apiKey.callbackUrl) {
                const updatedTx = await storage.getTransaction(transaction.id);
                if (updatedTx) {
                  sendPaymentCallback(updatedTx, apiKey, 'payment.failed')
                    .then(callbackResult => {
                      console.log("[WEBHOOK] Failed callback sent:", callbackResult);
                    })
                    .catch(err => {
                      console.error("[WEBHOOK] Failed callback error:", err);
                    });
                }
              }
            }
          } catch (callbackError) {
            console.error("[WEBHOOK] Error processing failed callback:", callbackError);
          }
        }
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

      if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, error: "Montant invalide" });
      }

      if (!country || !operator || !phone) {
        return res.status(400).json({ success: false, error: "Pays, operateur et telephone requis" });
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
        
        const paydunyaData = {
          invoice: {
            total_amount: Math.floor(amount),
            description: `Depot de ${amount} XOF`,
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
          // Calculate fees for INCOMING payment with dynamic fee from database (auto-detect active provider)
          const grossAmount = Math.floor(amount);
          const depositPaydunyaFeeConfig = await getDynamicFees(storage, country, operator);
          const feeInfo = calculateIncomingFee(grossAmount, depositPaydunyaFeeConfig.incoming);
          
          const transactionId = randomUUID();
          await storage.createTransaction({
            userId: req.session.userId!,
            type: "deposit",
            amount: feeInfo.grossAmount,
            fee: feeInfo.feeAmount,
            feePercentage: feeInfo.feePercentage,
            currency: "XOF",
            status: "pending",
            country,
            operator,
            description: `Depot de ${grossAmount} XOF`,
            paydunyaToken: paydunyaResponse.token,
            metadata: JSON.stringify({
              phone,
              customerName: effectiveCustomerName,
              provider: "paydunya",
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
              if (softpayResult.url) {
                return res.json({
                  success: true,
                  transactionId,
                  token: paydunyaResponse.token,
                  message: softpayResult.message,
                  redirectUrl: softpayResult.url,
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
        const result = await handleMbiyoPayDeposit(
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
            redirectUrl: result.redirectUrl,
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
          return res.status(400).json({
            success: false,
            error: result.error,
            requiresOtp: true,
            otpInstructions: result.otpInstructions,
          });
        }

        if (result.success) {
          return res.json({
            success: true,
            transactionId: result.transactionId,
            providerLink: result.providerLink,
            message: result.message || "Paiement initie avec succes",
            provider: "afribapay",
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
      console.error("[DEPOSIT] Error:", error);
      return res.status(500).json({ success: false, error: "Erreur lors du depot" });
    }
  });

  // Transfer/Withdrawal Route - Multi-Provider
  app.post("/api/fedapay/withdrawal", requireAuth, async (req: Request, res: Response) => {
    try {
      const { amount, country, operator, phone, type, securityCode, originalAmount, originalCurrency } = req.body;
      const user = await storage.getUser(req.session.userId!);

      if (!user) {
        return res.status(404).json({ success: false, error: "Utilisateur non trouve" });
      }

      if (user.suspended) {
        return res.status(403).json({ success: false, error: "Votre compte a ete suspendu" });
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
        minAmountInUserCurrency = isTransferType ? 2000 : 4000; // 2000 CDF transfer, 4000 CDF withdrawal
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

      // Calculer le montant à débiter selon le type (transfert vs retrait)
      // TRANSFERT: débiter montant + frais | RETRAIT: débiter montant uniquement
      const isTransfer = type === "transfer";
      const requiredBalance = isTransfer 
        ? (Math.floor(amount) + feeInfo.feeAmount) 
        : feeInfo.totalDeductedFromBalance;

      // Check balance avec le bon montant selon le type
      if (user.balance < requiredBalance) {
        return res.status(400).json({ 
          success: false, 
          error: "Solde insuffisant" 
        });
      }

      // Get user's currency for conversion
      const userCurrency = user.country ? getCurrencyForCountry(user.country) : "XOF";
      
      console.log(`[WITHDRAWAL] Using provider: ${activeProvider} for ${country}/${operator}, userCurrency=${userCurrency}`);

      if (activeProvider === "fedapay") {
        // Use FedaPay - pass user's currency for conversion
        const result = isTransfer 
          ? await handleFedaPayTransfer(req.session.userId!, user, amount, country, operator, phone, userCurrency)
          : await handleFedaPayWithdrawal(req.session.userId!, user, amount, country, operator, phone, userCurrency);

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
        const providerCurrency = "XOF"; // Paydunya only uses XOF
        const amountInUserCurrency = isTransfer ? Math.floor(amount) : feeInfo.amountReceived;
        const amountToDebit = isTransfer ? (Math.floor(amount) + feeInfo.feeAmount) : feeInfo.totalDeductedFromBalance;

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

        // Step 1: Get disburse invoice - ALWAYS send converted amount to provider
        const getInvoiceData = {
          account_alias: cleanPhone,
          amount: amountForProvider,
          withdraw_mode: withdrawMode,
          callback_url: callbackUrl,
        };

        console.log("[WITHDRAWAL PAYDUNYA] Creating disburse invoice:", getInvoiceData);
        const getInvoiceResponse = await callPaydunyaAPIv2("/disburse/get-invoice", getInvoiceData);
        console.log("[WITHDRAWAL PAYDUNYA] Get-invoice response:", getInvoiceResponse);

        if (getInvoiceResponse.response_code !== "00" || !getInvoiceResponse.disburse_token) {
          console.error("[WITHDRAWAL PAYDUNYA] Get-invoice failed:", getInvoiceResponse);
          const errorMsg = type === "transfer" ? "Transfert echoue" : "Retrait echoue";
          return res.status(400).json({ success: false, error: errorMsg });
        }

        // Step 2: Submit disburse invoice
        const submitData = {
          disburse_invoice: getInvoiceResponse.disburse_token,
          disburse_id: `${type || 'withdrawal'}-${user.id.substring(0, 8)}-${Date.now()}`,
        };

        console.log("[WITHDRAWAL PAYDUNYA] Submitting disburse invoice:", submitData);
        const submitResponse = await callPaydunyaAPIv2("/disburse/submit-invoice", submitData);
        console.log("[WITHDRAWAL PAYDUNYA] Submit-invoice response:", submitResponse);

        if (submitResponse.response_code === "00") {
          // Success - Deduct balance (montant différent pour transfert vs retrait)
          await storage.updateUserBalance(req.session.userId!, -amountToDebit);
          
          // Create transaction record - store in user's currency for balance
          const tx = await storage.createTransaction({
            userId: req.session.userId!,
            type: isTransfer ? "transfer" : "withdrawal",
            amount: Math.floor(amount), // Store in user's currency
            fee: feeInfo.feeAmount,
            feePercentage: feeInfo.feePercentage,
            currency: userCurrency, // Store in user's currency
            status: "completed",
            country,
            operator,
            customerPhone: cleanPhone,
            description: isTransfer 
              ? `Transfert de ${Math.floor(amount)} ${userCurrency} (envoye: ${amountForProvider} ${providerCurrency})` 
              : `Retrait de ${Math.floor(amount)} ${userCurrency} (recu: ${amountForProvider} ${providerCurrency})`,
            paydunyaToken: getInvoiceResponse.disburse_token,
            metadata: JSON.stringify({
              paydunyaTransactionId: submitResponse.transaction_id,
              disburseId: submitData.disburse_id,
              provider: "paydunya",
              providerAmount: amountForProvider,
              providerCurrency: providerCurrency,
              balanceAmount: Math.floor(amount),
              balanceCurrency: userCurrency,
              amountDebitedFromBalance: amountToDebit,
            }),
          });

          console.log(`[${isTransfer ? 'TRANSFER' : 'WITHDRAWAL'} PAYDUNYA] Success - Balance deducted: ${amountToDebit} ${userCurrency}, Sent to provider: ${amountForProvider} ${providerCurrency}`);

          return res.json({
            success: true,
            transactionId: tx.id,
            message: isTransfer ? "Transfert effectue avec succes" : "Retrait effectue avec succes",
            totalDeducted: amountToDebit,
          });
        } else {
          console.error("[WITHDRAWAL PAYDUNYA] Submit-invoice failed:", submitResponse);
          const errorMsg = type === "transfer" ? "Transfert echoue" : "Retrait echoue";
          return res.status(400).json({ success: false, error: errorMsg });
        }
      } else if (activeProvider === "mbiyopay") {
        // Use MbiyoPay for withdrawals/transfers - pass user's currency for conversion
        console.log(`[WITHDRAWAL] Using MbiyoPay for ${country}/${operator}, userCurrency=${userCurrency}`);
        
        const result = isTransfer 
          ? await handleMbiyoPayTransfer(req.session.userId!, user, amount, country, operator, phone, userCurrency)
          : await handleMbiyoPayWithdrawal(req.session.userId!, user, amount, country, operator, phone, userCurrency);

        if (result.success) {
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
        
        const result = isTransfer 
          ? await handleAfribaPayTransfer(req.session.userId!, user, amount, country, operator, phone, userCurrency)
          : await handleAfribaPayWithdrawal(req.session.userId!, user, amount, country, operator, phone, userCurrency);

        if (result.success) {
          return res.json({
            success: true,
            transactionId: result.transactionId,
            message: result.message || (isTransfer ? "Transfert effectue avec succes" : "Retrait effectue avec succes"),
            provider: "afribapay",
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
      const { customerName, customerEmail, customerPhone, country, operator, currency } = req.body;
      const { token } = req.params;

      const paymentLink = await storage.getPaymentLinkByToken(token);
      if (!paymentLink || !paymentLink.isActive) {
        return res.status(404).json({ success: false, error: "Lien de paiement non trouve ou inactif" });
      }

      const owner = await storage.getUser(paymentLink.userId);
      if (owner?.suspended) {
        return res.status(404).json({ success: false, error: "Ce lien n'existe pas" });
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
          payerCurrency // provider's currency
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
        
        // Calculate amount based on customerPaysFee setting - using converted amount
        let amountForProvider: number;
        let feeAmount: number;
        let feePercentage: number;
        let netAmountForUser: number;
        
        // Get dynamic fee configuration from database (auto-detect active provider)
        const apiLinkFeeConfig = await getDynamicFees(storage, country, operator);
        
        if (paymentLink.customerPaysFee) {
          const feeInfo = calculateCustomerPaysFee(amountInPayerCurrency, apiLinkFeeConfig.incoming);
          amountForProvider = feeInfo.totalForProvider;
          feeAmount = feeInfo.feeAmount;
          feePercentage = feeInfo.feePercentage;
          netAmountForUser = feeInfo.baseAmount;
        } else {
          const feeInfo = calculateIncomingFee(amountInPayerCurrency, apiLinkFeeConfig.incoming);
          amountForProvider = feeInfo.grossAmount;
          feeAmount = feeInfo.feeAmount;
          feePercentage = feeInfo.feePercentage;
          netAmountForUser = feeInfo.netAmount;
        }
        
        const paydunyaData = {
          invoice: {
            total_amount: Math.floor(amountForProvider),
            description: paymentLink.description || `Paiement de ${amountInPayerCurrency} ${payerCurrency}`,
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
            amount: amountForProvider,
            fee: feeAmount,
            feePercentage: feePercentage,
            currency: payerCurrency,
            status: "pending",
            country,
            operator,
            description: paymentLink.description || `Paiement via lien`,
            paydunyaToken: paydunyaResponse.token,
            metadata: JSON.stringify({
              phone: customerPhone,
              customerName: effectiveCustomerName,
              provider: "paydunya",
              paymentLinkId: paymentLink.id,
              customerPaysFee: paymentLink.customerPaysFee,
              originalAmount: paymentLink.amount,
              originalCurrency: ownerCurrency,
              convertedAmount: amountInPayerCurrency,
              conversionRate: conversionRate,
              conversionApplied: conversionApplied,
              netAmountForUser: netAmountForUser,
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
        const result = await handleMbiyoPayPaymentLink(
          paymentLink,
          customerPhone,
          customerName || "Client",
          "noreply@bkapay.com",
          operator,
          country, // payer's country
          amountInPayerCurrency, // converted amount for provider
          payerCurrency, // payer's currency
          ownerCurrency // owner's currency for balance credit
        );

        if (result.success) {
          return res.json({
            success: true,
            transactionId: result.transactionId,
            redirectUrl: result.redirectUrl,
            message: result.message || "Demande de paiement envoyee",
            provider: "mbiyopay",
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
          otpCode
        );

        if (result.requiresOtp) {
          return res.status(400).json({
            success: false,
            error: result.error,
            requiresOtp: true,
            otpInstructions: result.otpInstructions,
          });
        }

        if (result.success) {
          return res.json({
            success: true,
            transactionId: result.transactionId,
            providerLink: result.providerLink,
            message: result.message || "Paiement initie avec succes",
            provider: "afribapay",
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
      const { customerName, customerPhone, amount, country, operator, currency, originalAmount, originalCurrency } = req.body;
      const { token } = req.params;

      const merchantLink = await storage.getMerchantLinkByToken(token);
      if (!merchantLink || !merchantLink.isActive) {
        return res.status(404).json({ success: false, error: "Lien marchand non trouve ou inactif" });
      }

      const owner = await storage.getUser(merchantLink.userId);
      if (owner?.suspended) {
        return res.status(404).json({ success: false, error: "Ce lien n'existe pas" });
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
          "noreply@bkapay.com", // Privacy: never send real customer emails to providers
          customerPhone,
          country,
          operator,
          originalAmount || amount, // original amount for balance credit
          originalCurrency || ownerCurrency // owner's currency
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
        
        const paydunyaData = {
          invoice: {
            total_amount: Math.floor(amount),
            description: `Paiement ${merchantLink.merchantName} - ${amount} XOF`,
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
          // Calculate fees for INCOMING payment with dynamic fee from database (auto-detect active provider)
          const grossAmount = Math.floor(amount);
          const merchantPaydunyaFeeConfig = await getDynamicFees(storage, country, operator);
          const feeInfo = calculateIncomingFee(grossAmount, merchantPaydunyaFeeConfig.incoming);
          
          const transactionId = randomUUID();
          await storage.createTransaction({
            userId: merchantLink.userId,
            type: "merchant_link",
            amount: feeInfo.grossAmount,
            fee: feeInfo.feeAmount,
            feePercentage: feeInfo.feePercentage,
            currency: "XOF",
            status: "pending",
            country,
            operator,
            description: `Paiement ${merchantLink.merchantName}`,
            paydunyaToken: paydunyaResponse.token,
            metadata: JSON.stringify({
              phone: customerPhone,
              customerName: effectiveCustomerName,
              provider: "paydunya",
              merchantLinkId: merchantLink.id,
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
        const result = await handleMbiyoPayMerchantLink(
          merchantLink,
          amount, // converted amount for provider
          customerPhone,
          customerName || "Client",
          "noreply@bkapay.com",
          operator,
          country, // payer's country
          originalAmount || amount, // original amount for balance credit
          originalCurrency || ownerCurrency, // owner's currency
          payerCurrency // payer's selected currency (USD/CDF for RDC)
        );

        if (result.success) {
          return res.json({
            success: true,
            transactionId: result.transactionId,
            redirectUrl: result.redirectUrl,
            message: result.message || "Demande de paiement envoyee",
            provider: "mbiyopay",
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
          otpCode
        );

        if (result.requiresOtp) {
          return res.status(400).json({
            success: false,
            error: result.error,
            requiresOtp: true,
            otpInstructions: result.otpInstructions,
          });
        }

        if (result.success) {
          return res.json({
            success: true,
            transactionId: result.transactionId,
            providerLink: result.providerLink,
            message: result.message || "Paiement initie avec succes",
            provider: "afribapay",
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
      const { transactionId, country, operator, customerPhone, customerName } = req.body;

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
            description: transaction.description || `Paiement API de ${transaction.amount} XOF`,
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
        const result = await handleMbiyoPayApiPayment(
          apiKey,
          transaction.amount,
          transaction.description || "Paiement via API",
          customerName || transaction.customerName || "Client",
          "noreply@bkapay.com",
          customerPhone || transaction.customerPhone || "",
          country,
          operator
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
          return res.status(400).json({
            success: false,
            error: result.error,
            requiresOtp: true,
            otpInstructions: result.otpInstructions,
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
            providerLink: result.providerLink,
            message: result.message || "Paiement initie avec succes",
            provider: "afribapay",
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

      if (user.balance < feeInfo.totalDeductedFromBalance) {
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

      // Callback URL for Paydunya notifications
      const callbackUrl = process.env.BASE_URL 
        ? `${process.env.BASE_URL}/api/webhooks/paydunya-disburse`
        : "https://bkapay.com/api/webhooks/paydunya-disburse";
      
      // Step 1: Create disbursement invoice (get-invoice)
      const getInvoiceData = {
        account_alias: cleanPhone, // Phone WITHOUT country code
        amount: Math.floor(amount), // Integer, no decimals
        withdraw_mode: withdrawMode,
        callback_url: callbackUrl,
      };

      console.log("[Withdrawal] Creating disburse invoice:", getInvoiceData);
      const getInvoiceResponse = await callPaydunyaAPIv2("/disburse/get-invoice", getInvoiceData);
      console.log("[Withdrawal] Get-invoice response:", getInvoiceResponse);

      if (getInvoiceResponse.response_code !== "00") {
        console.error("[Withdrawal] Get-invoice failed:", getInvoiceResponse);
        return res.status(400).json({ error: "Retrait échoué" });
      }

      const disburseToken = getInvoiceResponse.disburse_token;
      if (!disburseToken) {
        console.error("[Withdrawal] No disburse_token in response:", getInvoiceResponse);
        return res.status(400).json({ error: "Retrait échoué" });
      }

      // Step 2: Submit disbursement invoice (submit-invoice)
      const submitData = {
        disburse_invoice: disburseToken,
        disburse_id: `withdrawal-${user.id.substring(0, 8)}-${Date.now()}`,
      };

      console.log("[Withdrawal] Submitting disburse invoice:", submitData);
      const submitResponse = await callPaydunyaAPIv2("/disburse/submit-invoice", submitData);
      console.log("[Withdrawal] Submit-invoice response:", submitResponse);

      if (submitResponse.response_code === "00") {
        // Success - Deduct balance immediately
        await storage.updateUserBalance(req.session.userId!, -feeInfo.totalDeductedFromBalance);
        
        // Create transaction record
        await storage.createTransaction({
          userId: req.session.userId!,
          type: "withdrawal",
          amount: Math.floor(amount),
          fee: feeInfo.feeAmount,
          feePercentage: feeInfo.feePercentage,
          currency: "XOF",
          status: "completed",
          country,
          operator,
          customerPhone: cleanPhone,
          description: `Retrait de ${amount} XOF vers ${cleanPhone}`,
          paydunyaToken: disburseToken,
          metadata: JSON.stringify({
            paydunyaTransactionId: submitResponse.transaction_id,
            disburseId: submitData.disburse_id,
          }),
        });

        console.log("[Withdrawal] Success - Balance deducted:", feeInfo.totalDeductedFromBalance);

        res.json({
          success: true,
          message: "Retrait effectué avec succès",
          totalDeducted: feeInfo.totalDeductedFromBalance,
          amountSent: Math.floor(amount),
          fee: feeInfo.feeAmount,
        });
      } else {
        // Submission failed
        console.error("[Withdrawal] Submit-invoice failed:", submitResponse);
        return res.status(400).json({ error: "Retrait échoué" });
      }
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
          amount: feeInfo.grossAmount, // Store GROSS amount
          fee: feeInfo.feeAmount,
          feePercentage: feeInfo.feePercentage,
          currency: "XOF",
          status: "pending",
          country: paymentCountry,
          operator: operator || "wave",
          customerName,
          customerEmail,
          description: description || "Paiement via API BKApay",
          paydunyaToken: paydunyaResponse.token, // Store in dedicated column
          metadata: JSON.stringify({
            api_key_id: apiKey.id,
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
        const { createMbiyoPayPayin, getCurrencyForCountry } = await import("./mbiyopay");
        const { calculateIncomingFee, getFeeFromDatabase } = await import("./utils/fees");
        
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
      // Check if target user is primary admin
      const targetUser = await storage.getUser(userId);
      if (targetUser?.isPrimaryAdmin) {
        return res.status(403).json({ error: "Impossible de supprimer l'administrateur principal" });
      }
      await storage.deleteUser(userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete user error:", error);
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
      
      // Also clear any temporary login suspension for this user
      clearTemporarySuspension(user.email);
      
      res.json(user);
    } catch (error: any) {
      console.error("Unsuspend user error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.post("/api/admin/add-funds", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId, amount } = req.body;
      if (!userId || amount === undefined) {
        return res.status(400).json({ error: "Identifiant utilisateur et montant requis" });
      }
      // Check if target user is primary admin
      const targetUser = await storage.getUser(userId);
      if (targetUser?.isPrimaryAdmin) {
        return res.status(403).json({ error: "Impossible de modifier l'argent de l'administrateur principal" });
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
      // Check if target user is primary admin
      const targetUser = await storage.getUser(userId);
      if (targetUser?.isPrimaryAdmin) {
        return res.status(403).json({ error: "Impossible de modifier l'argent de l'administrateur principal" });
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

      // Update transaction status to completed
      await storage.updateTransactionStatus(transactionId, "completed");

      // If it's an incoming payment, credit the user's balance
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

      // Update transaction status to failed
      await storage.updateTransactionStatus(transactionId, "failed");

      // If it's a withdrawal, refund the amount back to user's balance
      if (transaction.type === "withdrawal") {
        // The amount stored is net (what user receives), we need to refund gross (amount + fee)
        const refundAmount = transaction.amount + transaction.fee;
        await storage.updateUserBalance(transaction.userId, refundAmount);
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

  // Initialize fee configs
  await storage.initializeFeeConfigs();

  // ===== Provider Config Routes (API Keys Management) =====
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

      const config = await storage.updateProviderConfig(provider, updates);

      if (!config) {
        return res.status(404).json({ error: "Fournisseur non trouvé" });
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
      const { supportEmail, supportPhone, whatsappLink } = req.body;
      
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
      });
      
      console.log("[SupportSettings] Updated by admin:", settings);
      res.json({ success: true, settings });
    } catch (error: any) {
      console.error("[SupportSettings] Update error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
