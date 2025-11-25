import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import connectPg from "connect-pg-simple";
import pg from "pg";
import bcrypt from "bcrypt";
import { z } from "zod";
import { insertUserSchema, insertPaymentLinkSchema, insertMerchantLinkSchema, insertApiKeySchema } from "@shared/schema";
import { randomUUID } from "crypto";
import { calculateIncomingFee, calculateOutgoingFee } from "./utils/fees";
import { 
  SOFTPAY_OPERATORS, 
  getOperatorKey, 
  requiresOTP, 
  requiresTwoStep, 
  getUSSDInstruction,
  type SoftpayPaymentData 
} from "./paydunya-softpay";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

// Middleware pour vérifier l'authentification par session
function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Non authentifié" });
  }
  next();
}

// Middleware pour vérifier l'authentification administrateur
async function requireAdmin(req: Request, res: Response, next: Function) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Non authentifié" });
  }
  const user = await storage.getUser(req.session.userId);
  if (!user || !user.isAdmin) {
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

// Configuration Paydunya - Les clés doivent être définies dans les variables d'environnement
const PAYDUNYA_CONFIG = {
  masterKey: process.env.PAYDUNYA_MASTER_KEY!,
  publicKey: process.env.PAYDUNYA_PUBLIC_KEY!,
  privateKey: process.env.PAYDUNYA_PRIVATE_KEY!,
  token: process.env.PAYDUNYA_TOKEN!,
  apiUrl: "https://app.paydunya.com/api/v1",
};

// Vérifier que les clés Paydunya sont configurées
if (!PAYDUNYA_CONFIG.masterKey || !PAYDUNYA_CONFIG.publicKey || !PAYDUNYA_CONFIG.privateKey || !PAYDUNYA_CONFIG.token) {
  console.error("ERREUR: Les clés API Paydunya doivent être configurées dans les variables d'environnement");
  console.error("Veuillez définir: PAYDUNYA_MASTER_KEY, PAYDUNYA_PUBLIC_KEY, PAYDUNYA_PRIVATE_KEY, PAYDUNYA_TOKEN");
}

// Helper function to call Paydunya API (v1) - POST requests
async function callPaydunyaAPI(endpoint: string, data: any) {
  try {
    const response = await fetch(`${PAYDUNYA_CONFIG.apiUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "PAYDUNYA-MASTER-KEY": PAYDUNYA_CONFIG.masterKey,
        "PAYDUNYA-PRIVATE-KEY": PAYDUNYA_CONFIG.privateKey,
        "PAYDUNYA-TOKEN": PAYDUNYA_CONFIG.token,
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    console.log(`[Paydunya API] ${endpoint} - Status: ${response.status}`, result);
    return result;
  } catch (error) {
    console.error(`[Paydunya API Error] ${endpoint}:`, error);
    throw error;
  }
}

// Helper function to call Paydunya API (v1) - GET requests (for status checks)
async function callPaydunyaAPIGet(endpoint: string) {
  try {
    const url = `${PAYDUNYA_CONFIG.apiUrl}${endpoint}`;
    console.log(`[Paydunya API GET] Calling: ${url}`);
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "PAYDUNYA-MASTER-KEY": PAYDUNYA_CONFIG.masterKey,
        "PAYDUNYA-PRIVATE-KEY": PAYDUNYA_CONFIG.privateKey,
        "PAYDUNYA-TOKEN": PAYDUNYA_CONFIG.token,
      },
    });

    const responseText = await response.text();
    console.log(`[Paydunya API GET] ${endpoint} - Status: ${response.status}, Response: ${responseText.substring(0, 500)}`);
    
    try {
      const result = JSON.parse(responseText);
      return result;
    } catch (e) {
      console.error(`[Paydunya API GET] Received non-JSON response:`, responseText.substring(0, 500));
      throw new Error(`Paydunya API error: ${responseText.substring(0, 200)}`);
    }
  } catch (error) {
    console.error(`[Paydunya API GET Error] ${endpoint}:`, error);
    throw error;
  }
}

// Helper function to call Paydunya API v2 (for disbursements/withdrawals)
async function callPaydunyaAPIv2(endpoint: string, data: any) {
  try {
    const url = `https://app.paydunya.com/api/v2${endpoint}`;
    console.log(`[Paydunya APIv2] Calling: ${url}`);
    console.log(`[Paydunya APIv2] Data:`, data);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "PAYDUNYA-MASTER-KEY": PAYDUNYA_CONFIG.masterKey,
        "PAYDUNYA-PRIVATE-KEY": PAYDUNYA_CONFIG.privateKey,
        "PAYDUNYA-TOKEN": PAYDUNYA_CONFIG.token,
      },
      body: JSON.stringify(data),
    });

    // Read response text first to handle both JSON and HTML errors
    const responseText = await response.text();
    console.log(`[Paydunya APIv2] Response Status: ${response.status}, Text: ${responseText.substring(0, 500)}`);

    try {
      const result = JSON.parse(responseText);
      return result;
    } catch (e) {
      // If response is HTML, likely an error from Paydunya
      console.error(`[Paydunya APIv2] Received non-JSON response:`, responseText.substring(0, 500));
      throw new Error(`Paydunya API error: ${responseText.substring(0, 200)}`);
    }
  } catch (error) {
    console.error(`[Paydunya APIv2 Error] ${endpoint}:`, error);
    throw error;
  }
}

// Helper function to call Paydunya API v2 GET (for invoice status check)
async function callPaydunyaAPIv2Get(endpoint: string) {
  try {
    const url = `https://app.paydunya.com/api/v2${endpoint}`;
    console.log(`[Paydunya APIv2 GET] Calling: ${url}`);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "PAYDUNYA-MASTER-KEY": PAYDUNYA_CONFIG.masterKey,
        "PAYDUNYA-PRIVATE-KEY": PAYDUNYA_CONFIG.privateKey,
        "PAYDUNYA-TOKEN": PAYDUNYA_CONFIG.token,
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

// Helper function to confirm Wizall two-step payment
async function confirmWizallPayment(
  authorizationCode: string,
  phoneNumber: string,
  transactionId: string
): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    const confirmResponse = await fetch(`${PAYDUNYA_CONFIG.apiUrl}/softpay/wizall-money-senegal/confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "PAYDUNYA-MASTER-KEY": PAYDUNYA_CONFIG.masterKey,
        "PAYDUNYA-PRIVATE-KEY": PAYDUNYA_CONFIG.privateKey,
        "PAYDUNYA-TOKEN": PAYDUNYA_CONFIG.token,
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

// Helper function to call Paydunya SOFTPAY API (operator-specific OTP endpoints)
async function callPaydunyaSoftpay(
  operator: string,
  country: string,
  paymentData: SoftpayPaymentData
): Promise<{ success: boolean; message: string; data?: any; fees?: number; currency?: string; url?: string; transactionId?: string }> {
  try {
    // Get operator configuration key
    const operatorKey = getOperatorKey(operator, country);
    if (!operatorKey) {
      return {
        success: false,
        message: `Opérateur non supporté pour ce pays`,
      };
    }

    const config = SOFTPAY_OPERATORS[operatorKey];
    if (!config) {
      return {
        success: false,
        message: `Configuration introuvable pour cet opérateur`,
      };
    }

    // Build request parameters using operator-specific mapping
    const requestData = config.parameterMapping(paymentData);

    console.log(`[SOFTPAY] Calling ${config.endpoint} for ${operatorKey}`, requestData);

    // Call the operator-specific SOFTPAY endpoint
    const response = await fetch(`${PAYDUNYA_CONFIG.apiUrl}${config.endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "PAYDUNYA-MASTER-KEY": PAYDUNYA_CONFIG.masterKey,
        "PAYDUNYA-PRIVATE-KEY": PAYDUNYA_CONFIG.privateKey,
        "PAYDUNYA-TOKEN": PAYDUNYA_CONFIG.token,
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

    console.log(`[SOFTPAY] ${config.endpoint} - Status: ${response.status}`, result);

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
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax", // Changed from "strict" to "lax" for better compatibility
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      },
    })
  );

  // ===== Auth Routes =====
  
  // Signup
  app.post("/api/auth/signup", async (req: Request, res: Response) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
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

      res.json({ success: true, message: "Compte créé avec succès" });
    } catch (error: any) {
      res.status(400).json({ error: "Erreur lors de l'inscription" });
    }
  });

  // Login
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

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

      req.session.userId = user.id;
      res.json({ success: true, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName } });
    } catch (error: any) {
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

  // KYC Submit
  app.post("/api/kyc/submit", requireAuth, async (req: Request, res: Response) => {
    try {
      const { kycIdFront, kycIdBack, kycSelfie } = req.body;

      if (!kycIdFront || !kycIdBack || !kycSelfie) {
        return res.status(400).json({ error: "Tous les documents sont requis" });
      }

      // Validate base64 strings aren't too large (limit to 5MB per file)
      const maxSize = 5 * 1024 * 1024;
      if (kycIdFront.length > maxSize || kycIdBack.length > maxSize || kycSelfie.length > maxSize) {
        return res.status(400).json({ error: "Les fichiers sont trop volumineux" });
      }

      const user = await storage.submitKyc(req.session.userId!, {
        kycIdFront,
        kycIdBack,
        kycSelfie,
      });

      if (!user) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }

      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      console.error("KYC submission error:", error);
      res.status(500).json({ error: "Erreur lors de la soumission KYC" });
    }
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

      res.json(link);
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
      const updatePaymentLinkSchema = z.object({
        productName: z.string().min(1, "Le nom du produit est requis").optional(),
        description: z.string().optional(),
        amount: z.number().min(1, "Le montant doit être supérieur à 0").optional(),
        imageUrl: z.string().optional(),
        isActive: z.boolean().optional(),
      });
      const validatedData = updatePaymentLinkSchema.parse(req.body);
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

      res.json(link);
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

      // Return PSR response format
      const response: any = {
        success: true,
        token: metadata.paydunyaToken,
      };

      // Add mode if in test environment
      if (PAYDUNYA_CONFIG.publicKey.includes("test")) {
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

      // Call Paydunya API to create checkout invoice with customer info
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
          tagline: "Plateforme de paiement mobile money",
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

      console.log("[PAYMENT_LINK] Creating invoice with data:", paydunyaData);

      const paydunyaResponse = await callPaydunyaAPI("/checkout-invoice/create", paydunyaData);

      if (paydunyaResponse.response_code === "00") {
        // Calculate fees for INCOMING payment (client pays GROSS)
        const grossAmount = paymentLink.amount;
        const feeInfo = calculateIncomingFee(grossAmount, country);
        
        // Create transaction with GROSS amount (what client pays)
        const transactionId = randomUUID();
        await storage.createTransaction({
          userId: paymentLink.userId,
          type: "payment_link",
          amount: feeInfo.grossAmount, // Store GROSS amount (e.g., 2000)
          fee: feeInfo.feeAmount, // Store fee (e.g., 60)
          feePercentage: feeInfo.feePercentage, // Store percentage (30 or 60)
          currency: "XOF",
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

      // Call Paydunya API with customer info
      const paydunyaData = {
        invoice: {
          total_amount: amount,
          description: `Paiement marchand - ${merchantLink.merchantName}`,
          customer: {
            name: customerName || "Client",
            email: customerEmail || "",
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
          customer_email: customerEmail,
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
        // Calculate fees for INCOMING payment (client pays GROSS)
        const grossAmount = Math.floor(amount);
        const feeInfo = calculateIncomingFee(grossAmount, country);
        
        // Create transaction with GROSS amount (what client pays)
        const transactionId = randomUUID();
        await storage.createTransaction({
          userId: merchantLink.userId,
          type: "merchant_link",
          amount: feeInfo.grossAmount, // Store GROSS amount (e.g., 2000)
          fee: feeInfo.feeAmount, // Store fee (e.g., 60)
          feePercentage: feeInfo.feePercentage, // Store percentage (30 or 60)
          currency: "XOF",
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

  // ===== Deposit Routes =====
  app.post("/api/deposits", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.suspended) {
        return res.status(403).json({ error: "Votre compte a été suspendu. Veuillez contacter le support." });
      }

      const { amount, country, operator, phone } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Montant invalide" });
      }

      // Create Paydunya invoice (send GROSS amount to Paydunya)
      const paydunyaData = {
        invoice: {
          total_amount: Math.floor(amount),
          description: `Dépôt de ${amount} XOF sur BKApay`,
          customer: {
            name: `${user!.firstName} ${user!.lastName}`,
            email: user!.email,
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
          callback_url: `${process.env.BASE_URL || 'http://localhost:5000'}/api/webhooks/paydunya`,
        },
      };

      const paydunyaResponse = await callPaydunyaAPI("/checkout-invoice/create", paydunyaData);

      if (paydunyaResponse.response_code === "00") {
        // Calculate fees for INCOMING payment (client pays GROSS)
        const grossAmount = Math.floor(amount);
        const feeInfo = calculateIncomingFee(grossAmount, country);
        
        // Create transaction with GROSS amount (what client pays)
        const transactionId = randomUUID();
        await storage.createTransaction({
          userId: req.session.userId!,
          type: "deposit",
          amount: feeInfo.grossAmount, // Store GROSS amount (e.g., 2000)
          fee: feeInfo.feeAmount, // Store fee (e.g., 60)
          feePercentage: feeInfo.feePercentage, // Store percentage (30 or 60)
          currency: "XOF",
          status: "pending",
          country,
          operator,
          description: `Dépôt de ${grossAmount} XOF`,
          paydunyaToken: paydunyaResponse.token, // Store in dedicated column
          metadata: JSON.stringify({
            phone,
          }),
        });
        
        res.json({
          success: true,
          transactionId: transactionId,
          paydunyaToken: paydunyaResponse.token,
        });
      } else {
        res.status(400).json({ error: "Erreur lors de l'initiation du dépôt" });
      }
    } catch (error: any) {
      console.error("Deposit error:", error);
      res.status(500).json({ error: "Erreur lors du dépôt" });
    }
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
      const effectiveCustomerName = customerName || `${user!.firstName} ${user!.lastName}`;
      const effectiveCustomerEmail = customerEmail || user!.email;
      
      const paydunyaData = {
        invoice: {
          total_amount: Math.floor(amount),
          description: description || `Dépôt de ${amount} XOF`,
          customer: {
            name: effectiveCustomerName,
            email: effectiveCustomerEmail,
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
        // Calculate fees for INCOMING payment (client pays GROSS)
        const grossAmount = Math.floor(amount);
        const feeInfo = calculateIncomingFee(grossAmount, country);
        
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
            customerEmail: effectiveCustomerEmail,
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
          
          const paymentData: SoftpayPaymentData = {
            customerName: effectiveCustomerName,
            customerEmail: effectiveCustomerEmail,
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
        const paymentData: SoftpayPaymentData = {
          customerName: customerName || metadata.customerName || `${user!.firstName} ${user!.lastName}`,
          customerEmail: customerEmail || metadata.customerEmail || user!.email,
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
        // Calculate fees for INCOMING payment
        const grossAmount = paymentLink.amount;
        const feeInfo = calculateIncomingFee(grossAmount, country);
        
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
        const paymentData: SoftpayPaymentData = {
          customerName: customerName || transaction.customerName || "Client",
          customerEmail: customerEmail || transaction.customerEmail || "",
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

  // SOFTPAY for Payment Links - Initialize payment
  app.post("/api/payment-links/softpay-init/:token", async (req: Request, res: Response) => {
    try {
      const { customerName, customerEmail, customerPhone, country, operator } = req.body;
      const { token } = req.params;

      if (!country || !operator || !customerPhone) {
        return res.status(400).json({ error: "Informations incomplètes" });
      }

      // Validate operator BEFORE creating transaction
      const operatorKey = getOperatorKey(operator, country);
      if (!operatorKey) {
        return res.status(400).json({ error: "Opérateur non supporté pour ce pays" });
      }

      // Get payment link
      const paymentLink = await storage.getPaymentLinkByToken(token);
      if (!paymentLink) {
        return res.status(404).json({ error: "Lien de paiement non trouvé" });
      }

      // Check if user account is suspended
      const owner = await storage.getUser(paymentLink.userId);
      if (owner?.suspended) {
        return res.status(404).json({ error: "Ce lien n'existe pas" });
      }

      // Create Paydunya invoice with customer info
      const paydunyaData = {
        invoice: {
          total_amount: Math.floor(paymentLink.amount),
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
        // Calculate fees for INCOMING payment
        const grossAmount = Math.floor(paymentLink.amount);
        const feeInfo = calculateIncomingFee(grossAmount, country);
        
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

        // Get operator configuration (already validated above)
        const ussdInstruction = getUSSDInstruction(operatorKey);
        const needsOTP = requiresOTP(operatorKey);
        const twoStep = requiresTwoStep(operatorKey);

        // CRITICAL FIX: For operators that DO NOT require OTP, call SOFTPAY endpoint immediately!
        if (!needsOTP && !twoStep && operatorKey) {
          console.log(`[PAYMENT_LINK SOFTPAY INIT] Operator ${operatorKey} does NOT require OTP - calling SOFTPAY endpoint immediately`);
          
          const paymentData: SoftpayPaymentData = {
            customerName: customerName || "Client",
            customerEmail: customerEmail || "",
            phoneNumber: customerPhone,
            invoiceToken: paydunyaResponse.token,
          };

          const softpayResult = await callPaydunyaSoftpay(operator, country, paymentData);
          
          console.log(`[PAYMENT_LINK SOFTPAY INIT] SOFTPAY result for ${operatorKey}:`, softpayResult);

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
            console.error(`[PAYMENT_LINK SOFTPAY INIT] SOFTPAY call failed:`, softpayResult.message);
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
        res.status(400).json({ error: "Erreur lors de la création de la facture" });
      }
    } catch (error: any) {
      console.error("[PAYMENT_LINK SOFTPAY INIT] Error:", error);
      res.status(500).json({ error: "Erreur lors de l'initialisation du paiement" });
    }
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
        const paymentData: SoftpayPaymentData = {
          customerName: customerName || transaction.customerName || "Client",
          customerEmail: customerEmail || transaction.customerEmail || "",
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

  // SOFTPAY for Merchant Links - Initialize payment
  app.post("/api/merchant-links/softpay-init/:token", async (req: Request, res: Response) => {
    try {
      const { amount, customerName, customerEmail, customerPhone, country, operator } = req.body;
      const { token } = req.params;

      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Montant invalide" });
      }

      if (!country || !operator || !customerPhone) {
        return res.status(400).json({ error: "Pays, opérateur et numéro de téléphone requis" });
      }

      // Validate operator BEFORE creating transaction
      const operatorKey = getOperatorKey(operator, country);
      if (!operatorKey) {
        return res.status(400).json({ error: "Opérateur non supporté pour ce pays" });
      }

      // Get merchant link
      const merchantLink = await storage.getMerchantLinkByToken(token);
      if (!merchantLink) {
        return res.status(404).json({ error: "Lien marchand non trouvé" });
      }

      // Check if user account is suspended
      const owner = await storage.getUser(merchantLink.userId);
      if (owner?.suspended) {
        return res.status(404).json({ error: "Ce lien n'existe pas" });
      }

      // Create Paydunya invoice with customer info
      const paydunyaData = {
        invoice: {
          total_amount: Math.floor(amount),
          description: `Paiement marchand - ${merchantLink.merchantName}`,
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
          type: "merchant_link",
          user_id: merchantLink.userId,
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
        // Calculate fees for INCOMING payment
        const grossAmount = Math.floor(amount);
        const feeInfo = calculateIncomingFee(grossAmount, country);
        
        // Create transaction
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
          description: `Paiement marchand - ${merchantLink.merchantName}`,
          customerName,
          customerEmail,
          customerPhone,
          paydunyaToken: paydunyaResponse.token,
          metadata: JSON.stringify({
            merchantLinkId: merchantLink.id,
          }),
        });

        // Get operator configuration (already validated above)
        const ussdInstruction = getUSSDInstruction(operatorKey);
        const needsOTP = requiresOTP(operatorKey);
        const twoStep = requiresTwoStep(operatorKey);

        // CRITICAL FIX: For operators that DO NOT require OTP, call SOFTPAY endpoint immediately!
        if (!needsOTP && !twoStep && operatorKey) {
          console.log(`[MERCHANT_LINK SOFTPAY INIT] Operator ${operatorKey} does NOT require OTP - calling SOFTPAY endpoint immediately`);
          
          const paymentData: SoftpayPaymentData = {
            customerName: customerName || "Client",
            customerEmail: customerEmail || "",
            phoneNumber: customerPhone,
            invoiceToken: paydunyaResponse.token,
          };

          const softpayResult = await callPaydunyaSoftpay(operator, country, paymentData);
          
          console.log(`[MERCHANT_LINK SOFTPAY INIT] SOFTPAY result for ${operatorKey}:`, softpayResult);

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
            console.error(`[MERCHANT_LINK SOFTPAY INIT] SOFTPAY call failed:`, softpayResult.message);
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
        res.status(400).json({ error: "Erreur lors de la création de la facture" });
      }
    } catch (error: any) {
      console.error("[MERCHANT_LINK SOFTPAY INIT] Error:", error);
      res.status(500).json({ error: "Erreur lors de l'initialisation du paiement" });
    }
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
        const paymentData: SoftpayPaymentData = {
          customerName: customerName || transaction.customerName || "Client",
          customerEmail: customerEmail || transaction.customerEmail || "",
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

  // Verify SOFTPAY Payment - Polling endpoint (uses checkout-invoice/confirm GET API)
  // Also updates transaction status and user balance when payment is completed
  app.post("/api/softpay/verify-payment", async (req: Request, res: Response) => {
    try {
      const { invoiceToken } = req.body;

      if (!invoiceToken) {
        return res.status(400).json({ error: "Token invalide" });
      }

      console.log("[SOFTPAY] Verifying payment with token:", invoiceToken);

      // Call Paydunya checkout-invoice/confirm API (GET request)
      // Endpoint: GET /api/v1/checkout-invoice/confirm/[token]
      const paydunyaResponse = await callPaydunyaAPIGet("/checkout-invoice/confirm/" + invoiceToken);

      console.log("[SOFTPAY] Confirm response:", JSON.stringify(paydunyaResponse));

      // Response format: { response_code: "00", invoice: { status: "completed|pending|canceled|fail" }, ... }
      const invoiceStatus = paydunyaResponse.invoice?.status || paydunyaResponse.status;
      
      if (paydunyaResponse.response_code === "00" && invoiceStatus === "completed") {
        // CRITICAL: Update transaction status and user balance
        const transaction = await storage.getTransactionByPaydunyaToken(invoiceToken);
        
        if (transaction && transaction.status === "pending") {
          console.log("[SOFTPAY] Payment completed - updating transaction and balance:", {
            transactionId: transaction.id,
            userId: transaction.userId,
            grossAmount: transaction.amount,
            fee: transaction.fee,
          });
          
          // Update transaction status to completed
          await storage.updateTransactionStatus(transaction.id, "completed");
          
          // Calculate and credit NET amount (GROSS - 6% fee)
          const netAmount = transaction.amount - (transaction.fee || 0);
          await storage.updateUserBalance(transaction.userId, netAmount);
          
          console.log("[SOFTPAY] Balance credited with NET:", { 
            userId: transaction.userId, 
            grossAmount: transaction.amount, 
            fee: transaction.fee,
            netCredited: netAmount 
          });
        }
        
        res.json({
          status: "completed",
          response_code: "00",
        });
      } else if (paydunyaResponse.response_code === "00" && 
                 (invoiceStatus === "pending" || !invoiceStatus)) {
        res.json({
          status: "pending",
          response_code: "01",
        });
      } else if (invoiceStatus === "canceled" || invoiceStatus === "fail" || invoiceStatus === "failed") {
        // Update transaction to failed
        const transaction = await storage.getTransactionByPaydunyaToken(invoiceToken);
        if (transaction && transaction.status === "pending") {
          await storage.updateTransactionStatus(transaction.id, "failed");
          console.log("[SOFTPAY] Transaction marked as failed:", transaction.id);
        }
        
        res.json({
          status: "failed",
          response_code: "05",
        });
      } else {
        // Unknown status - keep polling
        res.json({
          status: "pending",
          response_code: "01",
        });
      }
    } catch (error: any) {
      console.error("[SOFTPAY] Verify payment error:", error);
      // On error, return pending to continue polling
      res.json({
        status: "pending",
        response_code: "01",
      });
    }
  });

  // ===== Paydunya Webhook Routes =====
  app.post("/api/webhooks/paydunya", async (req: Request, res: Response) => {
    try {
      const { token, status, custom_data, data } = req.body;

      console.log("[WEBHOOK] Paydunya webhook received:", req.body);

      // Handle PSR format (data.status) or direct format (status)
      const webhookToken = token || data?.token;
      const webhookStatus = status || data?.status;
      const webhookCustomData = custom_data || data?.custom_data;
      const webhookAmount = data?.amount;
      const receiptUrl = data?.receipt_url;

      if (!webhookToken) {
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
        console.log("[WEBHOOK] Transaction not found for token:", webhookToken);
        console.log("[WEBHOOK] This should not happen - all flows create pending transactions");
        return res.status(200).json({ success: true, message: "Transaction not found, but webhook acknowledged" });
      }

      // Update transaction status based on webhook status
      let newStatus = "pending";
      if (webhookStatus === "completed" || webhookStatus === "approved") {
        newStatus = "completed";
        
        // For INCOMING transactions: credit NET amount (GROSS - fee)
        // Transaction stores: amount = GROSS, fee = fee amount
        const netAmount = transaction.amount - (transaction.fee || 0);
        
        await storage.updateUserBalance(transaction.userId, netAmount);
        console.log("[WEBHOOK] User balance credited with NET:", { 
          userId: transaction.userId, 
          grossAmount: transaction.amount, 
          fee: transaction.fee,
          netCredited: netAmount 
        });
      } else if (webhookStatus === "failed" || webhookStatus === "cancelled") {
        newStatus = "failed";
      }

      // Update transaction
      await storage.updateTransactionStatus(transaction.id, newStatus);
      console.log("[WEBHOOK] Transaction updated:", { transactionId: transaction.id, status: newStatus });

      res.json({ success: true, message: "Webhook traité" });
    } catch (error: any) {
      console.error("[WEBHOOK] Paydunya webhook error:", error);
      // Return 200 to Paydunya so it doesn't retry
      res.status(200).json({ success: true, message: "Webhook received, but processing error" });
    }
  });

  // ===== Withdrawal Routes (Paydunya Disburse API v2) =====
  // Documentation: https://developers.paydunya.com/doc/EN/api_deboursement
  app.post("/api/withdrawals", requireAuth, async (req: Request, res: Response) => {
    try {
      const { amount, phone, country, operator } = req.body;
      const user = await storage.getUser(req.session.userId!);

      if (!user) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }

      if (user.suspended) {
        return res.status(403).json({ error: "Votre compte a été suspendu. Veuillez contacter le support." });
      }

      // Check KYC verification for withdrawals
      if (user.kycStatus !== "verified") {
        return res.status(403).json({ 
          error: "Vous devez vérifier votre identité avant de faire des retraits"
        });
      }

      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Montant invalide" });
      }

      const minAmount = 500;
      if (amount < minAmount) {
        return res.status(400).json({ error: `Le montant minimum est de ${minAmount} XOF` });
      }

      if (!phone || !country || !operator) {
        return res.status(400).json({ error: "Informations de retrait incomplètes" });
      }

      // Calculate fees silently for outgoing withdrawals (6% for all countries)
      const feeInfo = calculateOutgoingFee(Math.floor(amount), country);

      if (user.balance < feeInfo.totalDeductedFromBalance) {
        return res.status(400).json({ 
          error: "Solde insuffisant", 
          required: feeInfo.totalDeductedFromBalance,
          current: user.balance
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
        return res.status(400).json({ error: "Opérateur ou pays non supporté pour les retraits" });
      }

      // IMPORTANT: Paydunya requires phone WITHOUT country code prefix
      // Example: "771234567" for Senegal, "96123456" for Benin
      // The phone should be the local subscriber number only
      
      // Step 1: Remove only whitespace, dashes, dots (keep digits and +)
      let cleanPhone = phone.replace(/[\s\-\.]+/g, "");
      
      // Step 2: Validate format - must be digits only (with optional + at start)
      if (!/^\+?\d+$/.test(cleanPhone)) {
        return res.status(400).json({ error: "Le numéro de téléphone doit contenir uniquement des chiffres" });
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
        return res.status(400).json({ error: "Pays non supporté" });
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
          error: `Numéro invalide pour ${country}. Le numéro local doit avoir ${phoneInfo.localLength.join(' ou ')} chiffres.` 
        });
      }

      console.log(`[Withdrawal] Original phone: ${phone}, Cleaned phone: ${cleanPhone}, Country: ${country}`);

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
        const errorMessage = getInvoiceResponse.response_text || "Erreur lors de la création du retrait";
        console.error("[Withdrawal] Get-invoice failed:", getInvoiceResponse);
        return res.status(400).json({ error: errorMessage });
      }

      const disburseToken = getInvoiceResponse.disburse_token;
      if (!disburseToken) {
        console.error("[Withdrawal] No disburse_token in response:", getInvoiceResponse);
        return res.status(400).json({ error: "Erreur: Token de retrait non reçu" });
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
        const errorMessage = submitResponse.response_text || "Erreur lors du traitement du retrait";
        console.error("[Withdrawal] Submit-invoice failed:", submitResponse);
        return res.status(400).json({ error: errorMessage });
      }
    } catch (error: any) {
      console.error("[Withdrawal] Error:", error);
      res.status(500).json({ error: "Erreur lors du traitement du retrait" });
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

      // Calculate fees for INCOMING payment
      const grossAmount = Math.floor(amount);
      const feeInfo = calculateIncomingFee(grossAmount, paymentCountry);
      
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
        const paymentData: SoftpayPaymentData = {
          customerName: customerName || transaction.customerName || "Client",
          customerEmail: customerEmail || transaction.customerEmail || "",
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
      const { transactionId, country, operator } = req.body;

      if (!transactionId) {
        return res.status(400).json({ error: "Transaction ID requis" });
      }

      // Get transaction
      const transactions = await storage.getTransactions("", 1);
      let transaction = transactions.find((t) => t.id === transactionId);

      if (!transaction) {
        return res.status(404).json({ error: "Transaction non trouvée" });
      }

      // Update transaction with country and operator
      await storage.updateTransactionStatus(transactionId, "pending");

      // Call Paydunya API to create checkout invoice with customer info
      const paydunyaData = {
        invoice: {
          total_amount: transaction.amount,
          description: transaction.description || "Paiement via BKApay",
          customer: {
            name: transaction.customerName || "Client",
            email: transaction.customerEmail || "",
            phone: transaction.customerPhone || "",
          },
        },
        store: {
          name: "BKApay",
          tagline: "Plateforme de paiement mobile money",
        },
        custom_data: {
          transaction_id: transaction.id,
          customer_name: transaction.customerName,
          customer_email: transaction.customerEmail,
          customer_phone: transaction.customerPhone,
          country: country,
          operator: operator,
        },
        actions: {
          callback_url: `${process.env.BASE_URL || 'http://localhost:5000'}/api/webhooks/paydunya`,
        },
      };

      const paydunyaResponse = await callPaydunyaAPI("/checkout-invoice/create", paydunyaData);

      if (paydunyaResponse.response_code === "00") {
        // Update transaction with Paydunya token
        await storage.updateTransactionStatus(transactionId, "pending", {
          paydunyaToken: paydunyaResponse.token,
          country,
          operator,
        });

        // CRITICAL FIX: Call SOFTPAY endpoint immediately for operators that don't require OTP
        const operatorKey = getOperatorKey(operator, country);
        if (operatorKey) {
          const needsOTP = requiresOTP(operatorKey);
          const twoStep = requiresTwoStep(operatorKey);

          if (!needsOTP && !twoStep) {
            console.log(`[API PAYMENTS SUBMIT] Operator ${operatorKey} does NOT require OTP - calling SOFTPAY endpoint immediately`);
            
            const paymentData: SoftpayPaymentData = {
              customerName: transaction.customerName || "Client",
              customerEmail: transaction.customerEmail || "",
              phoneNumber: transaction.customerPhone || "",
              invoiceToken: paydunyaResponse.token,
            };

            const softpayResult = await callPaydunyaSoftpay(operator, country, paymentData);
            
            console.log(`[API PAYMENTS SUBMIT] SOFTPAY result for ${operatorKey}:`, softpayResult);

            if (!softpayResult.success) {
              console.error(`[API PAYMENTS SUBMIT] SOFTPAY call failed:`, softpayResult.message);
              // Continue anyway - let the status page handle it
            }
          }
        }

        res.json({
          success: true,
          transactionId: transactionId,
          redirectUrl: paydunyaResponse.response_text,
        });
      } else {
        // Paydunya error - still return transactionId so client can redirect to status page
        await storage.updateTransactionStatus(transactionId, "failed");
        res.json({
          success: false,
          transactionId: transactionId,
          error: "Erreur lors de l'initiation du paiement",
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
        return res.status(400).json({ error: "Clé API privée requise" });
      }

      if (!amount || amount < 500) {
        return res.status(400).json({ error: "Montant minimum 500 XOF" });
      }

      // Validate private key and get its owner
      const apiKey = await storage.getApiKeyByPrivateKey(privateKey);
      if (!apiKey || !apiKey.isActive) {
        return res.status(401).json({ error: "Clé API invalide ou inactive" });
      }

      // Get the developer's balance
      const user = await storage.getUserById(apiKey.userId);
      if (!user || user.balance < amount) {
        return res.status(400).json({ error: "Solde insuffisant pour ce retrait" });
      }

      res.json({
        success: true,
        message: "Retrait initialisé. Consultez votre historique pour le statut.",
      });
    } catch (error: any) {
      console.error("Withdrawal creation error:", error);
      res.status(500).json({ error: "Erreur lors de la création du retrait" });
    }
  });

  // Admin routes
  app.get("/api/admin/stats", requireAdmin, async (req: Request, res: Response) => {
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error: any) {
      console.error("Admin stats error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.get("/api/admin/users", requireAdmin, async (req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error: any) {
      console.error("Admin users error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.get("/api/admin/search", requireAdmin, async (req: Request, res: Response) => {
    try {
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
      res.json(user);
    } catch (error: any) {
      console.error("Reject KYC error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.get("/api/admin/kyc-submissions", requireAdmin, async (req: Request, res: Response) => {
    try {
      // Get all KYC history (submitted, verified, rejected)
      const submissions = await storage.getKycHistory();
      res.json(submissions);
    } catch (error: any) {
      console.error("Get KYC submissions error:", error);
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

  // ===== Country/Operator Config Routes =====
  app.get("/api/admin/country-operator-config", requireAdmin, async (req: Request, res: Response) => {
    try {
      const configs = await storage.getCountryOperatorConfigs();
      res.json(configs);
    } catch (error: any) {
      console.error("Get country operator configs error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  app.put("/api/admin/country-operator-config/:country/:operator", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { country, operator } = req.params;
      const { incomingEnabled, outgoingEnabled } = req.body;

      const config = await storage.updateCountryOperatorConfig(country, operator, {
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
  app.get("/api/countries-operators/deposits", async (req: Request, res: Response) => {
    try {
      const configs = await storage.getCountryOperatorConfigs();
      const enabledConfigs = configs.filter((c) => c.incomingEnabled);
      
      const result: Record<string, string[]> = {};
      for (const config of enabledConfigs) {
        if (!result[config.country]) {
          result[config.country] = [];
        }
        result[config.country].push(config.operator);
      }
      res.json(result);
    } catch (error: any) {
      console.error("Get deposits config error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // Public endpoint - get enabled countries/operators for withdrawals (outgoing)
  app.get("/api/countries-operators/withdrawals", async (req: Request, res: Response) => {
    try {
      const configs = await storage.getCountryOperatorConfigs();
      const enabledConfigs = configs.filter((c) => c.outgoingEnabled);
      
      const result: Record<string, string[]> = {};
      for (const config of enabledConfigs) {
        if (!result[config.country]) {
          result[config.country] = [];
        }
        result[config.country].push(config.operator);
      }
      res.json(result);
    } catch (error: any) {
      console.error("Get withdrawals config error:", error);
      res.status(500).json({ error: "Une erreur est survenue" });
    }
  });

  // Initialize country/operator configs on startup
  await storage.initializeCountryOperatorConfigs();

  const httpServer = createServer(app);
  return httpServer;
}
