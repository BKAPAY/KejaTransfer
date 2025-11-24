import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import bcrypt from "bcrypt";
import { z } from "zod";
import { insertUserSchema, insertPaymentLinkSchema, insertMerchantLinkSchema, insertApiKeySchema } from "@shared/schema";
import { randomUUID } from "crypto";
import { calculateIncomingFee, calculateOutgoingFee } from "./utils/fees";

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

// Helper function to call Paydunya API (v1)
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

export async function registerRoutes(app: Express): Promise<Server> {
  // Configure session - SESSION_SECRET doit être défini dans les variables d'environnement
  if (!process.env.SESSION_SECRET) {
    console.error("ERREUR: SESSION_SECRET doit être configuré dans les variables d'environnement");
  }

  app.use(
    session({
      secret: process.env.SESSION_SECRET!,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
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
      res.status(400).json({ error: error.message || "Erreur lors de l'inscription" });
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
      res.status(500).json({ error: error.message || "Erreur lors de la connexion" });
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
      res.status(500).json({ error: error.message });
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
      res.status(500).json({ error: error.message || "Erreur lors de la modification du mot de passe" });
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
        return res.status(400).json({ error: "Les fichiers sont trop volumineux (max 5MB par fichier)" });
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
      res.status(500).json({ error: error.message || "Erreur lors de la soumission KYC" });
    }
  });

  // ===== Dashboard Stats =====
  
  app.get("/api/dashboard/stats", requireAuth, async (req: Request, res: Response) => {
    try {
      const stats = await storage.getUserStats(req.session.userId!);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/analytics", requireAuth, async (req: Request, res: Response) => {
    try {
      const analytics = await storage.getAnalytics(req.session.userId!);
      res.json(analytics);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ===== Payment Links Routes =====
  
  app.get("/api/payment-links", requireAuth, async (req: Request, res: Response) => {
    try {
      const links = await storage.getPaymentLinks(req.session.userId!);
      res.json(links);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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
      res.status(500).json({ error: error.message });
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
      res.status(400).json({ error: error.message });
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
      res.status(400).json({ error: error.message });
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
      res.status(500).json({ error: error.message });
    }
  });

  // ===== Merchant Links Routes =====
  
  app.get("/api/merchant-links", requireAuth, async (req: Request, res: Response) => {
    try {
      const links = await storage.getMerchantLinks(req.session.userId!);
      res.json(links);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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
      res.status(500).json({ error: error.message });
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
      res.status(400).json({ error: error.message });
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
      res.status(500).json({ error: error.message });
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
          error: "Vous devez vérifier votre identité (KYC) avant de générer des clés API.",
          kycStatus: user.kycStatus
        });
      }

      const validatedData = insertApiKeySchema.parse(req.body);
      const key = await storage.createApiKey({
        ...validatedData,
        userId: req.session.userId!,
      });
      res.json(key);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
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
      res.status(500).json({ error: error.message });
    }
  });

  // ===== Transactions Routes =====
  
  app.get("/api/transactions", requireAuth, async (req: Request, res: Response) => {
    try {
      const transactions = await storage.getTransactions(req.session.userId!);
      res.json(transactions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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
      res.status(500).json({ error: error.message });
    }
  });

  // ===== PSR Endpoint (for Paydunya SDK) =====
  // GET endpoint that returns token for PSR (Paiement Sans Redirection)
  app.get("/api/paydunya-api", async (req: Request, res: Response) => {
    try {
      const ref = req.query.ref as string;
      if (!ref) {
        return res.status(400).json({ error: "ref parameter required" });
      }

      // Find transaction by ID
      const transaction = await storage.getTransaction(ref);
      if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }

      // Get metadata (contains paydunyaToken)
      let metadata: any = {};
      if (transaction.metadata) {
        metadata = JSON.parse(transaction.metadata);
      }

      if (!metadata.paydunyaToken) {
        return res.status(400).json({ error: "Token not available" });
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
      res.status(500).json({ error: error.message });
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

      // Call Paydunya API to create checkout invoice
      const paydunyaData = {
        invoice: {
          total_amount: paymentLink.amount,
          description: `Paiement - ${paymentLink.productName}`,
        },
        store: {
          name: "BKApay",
          tagline: "Plateforme de paiement mobile money",
        },
        custom_data: {
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
        // Create transaction now with the Paydunya token
        const transactionId = randomUUID();
        await storage.createTransaction({
          userId: paymentLink.userId,
          type: "payment_link",
          amount: paymentLink.amount,
          fee: 0,
          feePercentage: 0,
          currency: "XOF",
          status: "pending",
          country,
          operator,
          description: `Paiement - ${paymentLink.productName}`,
          customerName,
          customerEmail,
          customerPhone,
          metadata: JSON.stringify({
            paydunyaToken: paydunyaResponse.token,
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
          error: paydunyaResponse.response_text || "Erreur lors de l'initiation du paiement" 
        });
      }
    } catch (error: any) {
      console.error("Payment processing error:", error);
      res.status(500).json({ error: error.message || "Erreur lors du traitement du paiement" });
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

      // Call Paydunya API
      const paydunyaData = {
        invoice: {
          total_amount: amount,
          description: `Paiement marchand - ${merchantLink.merchantName}`,
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
        // Create transaction now with the Paydunya token
        const transactionId = randomUUID();
        await storage.createTransaction({
          userId: merchantLink.userId,
          type: "merchant_link",
          amount: amount,
          fee: 0,
          feePercentage: 0,
          currency: "XOF",
          status: "pending",
          country,
          operator,
          description: `Paiement marchand - ${merchantLink.merchantName}`,
          customerName,
          customerEmail,
          customerPhone,
          metadata: JSON.stringify({
            paydunyaToken: paydunyaResponse.token,
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
          error: paydunyaResponse.response_text || "Erreur lors de l'initiation du paiement" 
        });
      }
    } catch (error: any) {
      console.error("Merchant payment processing error:", error);
      res.status(500).json({ error: error.message || "Erreur lors du traitement du paiement" });
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
        // Create transaction now with the Paydunya token
        const transactionId = randomUUID();
        await storage.createTransaction({
          userId: req.session.userId!,
          type: "deposit",
          amount: Math.floor(amount),
          fee: 0,
          feePercentage: 0,
          currency: "XOF",
          status: "pending",
          country,
          operator,
          description: `Dépôt de ${amount} XOF`,
          metadata: JSON.stringify({
            paydunyaToken: paydunyaResponse.token,
            phone,
          }),
        });
        
        res.json({
          success: true,
          transactionId: transactionId,
          paydunyaToken: paydunyaResponse.token,
        });
      } else {
        const errorMsg = paydunyaResponse.response_text || "Erreur lors de l'initiation du dépôt";
        res.status(400).json({ error: errorMsg });
      }
    } catch (error: any) {
      console.error("Deposit error:", error);
      res.status(500).json({ error: error.message || "Erreur lors du dépôt" });
    }
  });

  // ===== SOFTPAY Routes (No Redirect - Using existing v1 API) =====
  
  // Create SOFTPAY Payment - Using v1 API (existing endpoint that works)
  app.post("/api/softpay/create-payment", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.suspended) {
        return res.status(403).json({ error: "Votre compte a été suspendu. Veuillez contacter le support." });
      }

      const { amount, description, country, operator, phone } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Montant invalide" });
      }

      // Create SOFTPAY invoice using existing v1 API (which works)
      const paydunyaData = {
        invoice: {
          total_amount: Math.floor(amount),
          description: description || `Dépôt de ${amount} XOF`,
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

      console.log("[SOFTPAY] Creating invoice with data:", paydunyaData);

      const paydunyaResponse = await callPaydunyaAPI("/checkout-invoice/create", paydunyaData);

      if (paydunyaResponse.response_code === "00" && paydunyaResponse.token) {
        // Create transaction
        const transactionId = randomUUID();
        await storage.createTransaction({
          userId: req.session.userId!,
          type: "deposit",
          amount: Math.floor(amount),
          fee: 0,
          feePercentage: 0,
          currency: "XOF",
          status: "pending",
          country,
          operator,
          description: description || `Dépôt de ${amount} XOF`,
          metadata: JSON.stringify({
            paydunyaToken: paydunyaResponse.token,
            phone,
            softpay: true,
          }),
        });

        res.json({
          success: true,
          transactionId,
          token: paydunyaResponse.token,
        });
      } else {
        console.error("[SOFTPAY] Error response:", paydunyaResponse);
        res.status(400).json({
          error: paydunyaResponse.response_text || "Erreur lors de la création de la facture",
        });
      }
    } catch (error: any) {
      console.error("[SOFTPAY] Create payment error:", error);
      res.status(500).json({ error: error.message || "Erreur lors du paiement SOFTPAY" });
    }
  });

  // Verify SOFTPAY Payment - Polling endpoint
  app.post("/api/softpay/verify-payment", async (req: Request, res: Response) => {
    try {
      const { invoiceToken } = req.body;

      if (!invoiceToken) {
        return res.status(400).json({ error: "Token invalide" });
      }

      console.log("[SOFTPAY] Verifying payment with token:", invoiceToken);

      // Call Paydunya to check payment status
      const paydunyaResponse = await callPaydunyaAPI("/query-invoice/" + invoiceToken, {});

      if (paydunyaResponse.response_code === "00" && paydunyaResponse.status === "completed") {
        res.json({
          status: "completed",
          response_code: "00",
        });
      } else if (paydunyaResponse.response_code === "00") {
        res.json({
          status: "pending",
          response_code: "01",
        });
      } else {
        res.json({
          status: "failed",
          response_code: "05",
        });
      }
    } catch (error: any) {
      console.error("[SOFTPAY] Verify payment error:", error);
      res.json({
        status: "pending",
        response_code: "01",
      });
    }
  });

  // ===== Paydunya Webhook Routes =====
  app.post("/api/webhooks/paydunya", async (req: Request, res: Response) => {
    try {
      const { token, status, custom_data } = req.body;

      console.log("[WEBHOOK] Paydunya webhook received:", { token, status, custom_data });

      if (!token) {
        return res.status(400).json({ error: "Token manquant" });
      }

      // Use custom_data.user_id if provided, otherwise we need to search
      let userId: string | null = null;
      if (custom_data?.user_id) {
        userId = custom_data.user_id;
      }

      // Search for transaction by token in metadata
      // We'll need to search through user's transactions
      let transaction = null;
      if (userId) {
        const userTransactions = await storage.getTransactions(userId, 100);
        transaction = userTransactions.find((t: any) => {
          try {
            const meta = JSON.parse(t.metadata);
            return meta.paydunyaToken === token;
          } catch {
            return false;
          }
        });
      }

      if (!transaction) {
        console.log("[WEBHOOK] Transaction not found for token:", token);
        // Still return 200 to acknowledge receipt
        return res.status(200).json({ success: true, message: "Transaction not found, but webhook acknowledged" });
      }

      // Update transaction status based on webhook status
      let newStatus = "pending";
      if (status === "completed" || status === "approved") {
        newStatus = "completed";
        // Update user balance
        await storage.updateUserBalance(transaction.userId, transaction.amount);
        console.log("[WEBHOOK] User balance updated:", { userId: transaction.userId, amount: transaction.amount });
      } else if (status === "failed" || status === "cancelled") {
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

  // ===== Withdrawal/Transfer Routes =====
  app.post("/api/transfers", requireAuth, async (req: Request, res: Response) => {
    try {
      const { amount, phone, country, operator } = req.body;
      const user = await storage.getUser(req.session.userId!);

      if (!user) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }

      if (user.suspended) {
        return res.status(403).json({ error: "Votre compte a été suspendu. Veuillez contacter le support." });
      }

      // Check KYC verification for transfers
      if (user.kycStatus !== "verified") {
        return res.status(403).json({ 
          error: "Vous devez vérifier votre identité (KYC) avant de faire des transferts.",
          kycStatus: user.kycStatus
        });
      }

      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Montant invalide" });
      }

      if (!phone || !country || !operator) {
        return res.status(400).json({ error: "Informations de transfert incomplètes" });
      }

      // Calculate fees silently for outgoing transfers
      const feeInfo = calculateOutgoingFee(Math.floor(amount), country);

      if (user.balance < feeInfo.totalDeductedFromBalance) {
        return res.status(400).json({ 
          error: "Solde insuffisant", 
          required: feeInfo.totalDeductedFromBalance,
          current: user.balance
        });
      }

      // Map operator to Paydunya withdraw mode
      const withdrawModeMap: Record<string, string> = {
        "orange-sn": "orange-money-senegal",
        "free-sn": "free-money-senegal",
        "expresso-sn": "expresso-senegal",
        "wave-sn": "wave-senegal",
        "wizall-sn": "wizall-senegal",
        "orange-ci": "orange-money-ci",
        "mtn-ci": "mtn-ci",
        "moov-ci": "moov-ci",
        "wave-ci": "wave-ci",
        "orange-bf": "orange-money-burkina",
        "moov-bf": "moov-burkina-faso",
        "moov-bj": "moov-benin",
        "mtn-bj": "mtn-benin",
        "tmoney-tg": "t-money-togo",
        "moov-tg": "moov-togo",
        "orange-ml": "orange-money-mali",
        "moov-ml": "moov-mali",
      };

      const withdrawMode = withdrawModeMap[`${operator}-${country.toLowerCase()}`];
      if (!withdrawMode) {
        return res.status(400).json({ error: "Opérateur ou pays non supporté" });
      }

      // Country phone codes
      const countryPhoneCodes: Record<string, string> = {
        "SN": "+221",
        "CI": "+225",
        "BF": "+226",
        "BJ": "+229",
        "TG": "+228",
        "ML": "+223",
      };

      // Format phone number: add country code if not present
      let formattedPhone = phone;
      const countryCode = countryPhoneCodes[country.toUpperCase()];
      if (countryCode && !phone.startsWith("+")) {
        formattedPhone = countryCode + phone;
      }

      // Step 1: Get disbursement invoice
      // For production: use real callback URL. For development: Paydunya may not be able to validate localhost
      const callbackUrl = process.env.BASE_URL 
        ? `${process.env.BASE_URL}/api/webhooks/paydunya`
        : "https://api.paydunya.com/callback"; // Fallback for development
      
      const paydunyaData = {
        account_alias: formattedPhone,
        amount: Math.floor(amount),
        withdraw_mode: withdrawMode,
        callback_url: callbackUrl,
      };

      // Step 1: Get disbursement invoice
      const getInvoiceResponse = await callPaydunyaAPIv2("/disburse/get-invoice", paydunyaData);

      if (getInvoiceResponse.response_code !== "00") {
        return res.status(400).json({ error: "Erreur de transaction" });
      }

      const disbursalToken = getInvoiceResponse.disburse_token;

      // Step 2: Submit disbursement invoice
      const submitData = {
        disburse_invoice: disbursalToken,
        disburse_id: "transfer-" + Date.now(),
      };

      const submitResponse = await callPaydunyaAPIv2("/disburse/submit-invoice", submitData);

      if (submitResponse.response_code === "00") {
        // Deduct balance immediately after successful submission
        await storage.updateUserBalance(req.session.userId!, -feeInfo.totalDeductedFromBalance);
        
        // Create completed transaction immediately
        await storage.createTransaction({
          userId: req.session.userId!,
          type: "transfer",
          amount: Math.floor(amount),
          fee: feeInfo.feeAmount,
          feePercentage: feeInfo.feePercentage,
          currency: "XOF",
          status: "completed",
          country,
          operator,
          customerPhone: phone,
          description: `Transfert de ${amount} XOF vers ${phone}`,
          metadata: JSON.stringify({
            paydunyaToken: disbursalToken,
            paydunyaTransactionId: submitResponse.transaction_id,
          }),
        });

        res.json({
          success: true,
          message: "Transfert effectué avec succès",
          totalDeducted: feeInfo.totalDeductedFromBalance,
        });
      } else {
        res.status(400).json({ error: "Erreur de transaction" });
      }
    } catch (error: any) {
      console.error("Transfer error:", error);
      res.status(500).json({ error: "Erreur de transaction" });
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

      // Call Paydunya API to create checkout invoice
      const paydunyaData = {
        invoice: {
          total_amount: Math.floor(amount),
          description: description || "Paiement via API BKApay",
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
        },
        actions: {
          callback_url: `${process.env.BASE_URL || 'http://localhost:5000'}/api/webhooks/paydunya`,
        },
      };

      const paydunyaResponse = await callPaydunyaAPI("/checkout-invoice/create", paydunyaData);

      if (paydunyaResponse.response_code === "00") {
        res.json({
          success: true,
          redirectUrl: paydunyaResponse.response_text,
          paydunyaToken: paydunyaResponse.token,
        });
      } else {
        res.status(400).json({ 
          error: paydunyaResponse.response_text || "Erreur lors de l'initiation du paiement" 
        });
      }
    } catch (error: any) {
      console.error("API payment processing error:", error);
      res.status(500).json({ error: error.message || "Erreur lors du traitement du paiement" });
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

      // Call Paydunya API to create checkout invoice
      const paydunyaData = {
        invoice: {
          total_amount: transaction.amount,
          description: transaction.description || "Paiement via BKApay",
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
        });

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
          error: paydunyaResponse.response_text || "Erreur lors de l'initiation du paiement",
        });
      }
    } catch (error: any) {
      console.error("Payment submission error:", error);
      res.status(500).json({ error: error.message || "Erreur lors de la soumission du paiement" });
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
        return res.status(400).json({ error: "Montant minimum: 500 XOF" });
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
      res.status(500).json({ error: error.message || "Erreur lors de la création du retrait" });
    }
  });

  // Paydunya webhook - Create/Update transactions only on completion
  app.post("/api/webhooks/paydunya", async (req: Request, res: Response) => {
    try {
      const paymentData = req.body;

      if (paymentData.data?.status === "completed") {
        const customData = paymentData.data.custom_data;
        
        if (customData) {
          // Determine transaction type and create transaction with COMPLETED status
          const amount = Math.floor(paymentData.data.amount || 0);
          
          if (customData.user_id && customData.type === "deposit") {
            // Deposit payment
            const feeInfo = calculateIncomingFee(amount, customData.country);
            const transaction = await storage.createTransaction({
              userId: customData.user_id,
              type: "deposit",
              amount: feeInfo.netAmount,
              fee: feeInfo.feeAmount,
              feePercentage: feeInfo.feePercentage,
              currency: "XOF",
              status: "completed",
              country: customData.country,
              operator: customData.operator,
              description: `Dépôt de ${amount} XOF`,
              metadata: JSON.stringify({
                paydunyaToken: paymentData.data.token,
                receiptUrl: paymentData.data.receipt_url,
              }),
            });
            
            // Credit user balance
            await storage.updateUserBalance(customData.user_id, feeInfo.netAmount);
          } 
          else if (customData.type === "merchant_link" && customData.merchant_user_id) {
            // Merchant link payment
            const feeInfo = calculateIncomingFee(amount, "SN"); // Default country
            const transaction = await storage.createTransaction({
              userId: customData.merchant_user_id,
              type: "merchant_link",
              amount: feeInfo.netAmount,
              fee: feeInfo.feeAmount,
              feePercentage: feeInfo.feePercentage,
              currency: "XOF",
              status: "completed",
              country: "SN",
              operator: "wave",
              customerName: customData.customer_name,
              customerEmail: customData.customer_email,
              description: `Paiement marchand - ${customData.merchant_name}`,
              metadata: JSON.stringify({
                paydunyaToken: paymentData.data.token,
                receiptUrl: paymentData.data.receipt_url,
              }),
            });
            
            // Credit user balance
            await storage.updateUserBalance(customData.merchant_user_id, feeInfo.netAmount);
          }
          else if (customData.type === "api_payment" && customData.user_id) {
            // API payment
            const feeInfo = calculateIncomingFee(amount, "SN");
            const transaction = await storage.createTransaction({
              userId: customData.user_id,
              type: "api_payment",
              amount: feeInfo.netAmount,
              fee: feeInfo.feeAmount,
              feePercentage: feeInfo.feePercentage,
              currency: "XOF",
              status: "completed",
              country: "SN",
              operator: "wave",
              customerName: customData.customer_name,
              customerEmail: customData.customer_email,
              description: "Paiement via API",
              metadata: JSON.stringify({
                paydunyaToken: paymentData.data.token,
                receiptUrl: paymentData.data.receipt_url,
                api_key_id: customData.api_key_id,
              }),
            });
            
            // Credit user balance
            await storage.updateUserBalance(customData.user_id, feeInfo.netAmount);
          }
          else if (customData.user_id) {
            // Payment link or other user transaction
            const feeInfo = calculateIncomingFee(amount, "SN");
            const transaction = await storage.createTransaction({
              userId: customData.user_id,
              type: "payment_link",
              amount: feeInfo.netAmount,
              fee: feeInfo.feeAmount,
              feePercentage: feeInfo.feePercentage,
              currency: "XOF",
              status: "completed",
              country: "SN",
              operator: "wave",
              customerName: customData.customer_name,
              customerEmail: customData.customer_email,
              description: "Paiement",
              metadata: JSON.stringify({
                paydunyaToken: paymentData.data.token,
                receiptUrl: paymentData.data.receipt_url,
              }),
            });
            
            // Credit user balance
            await storage.updateUserBalance(customData.user_id, feeInfo.netAmount);
          }
        }
      } else if (paymentData.data?.status === "failed" || paymentData.data?.status === "cancelled") {
        // Payment failed - do not create transaction, user will see error immediately
        console.log("Payment failed/cancelled by Paydunya:", paymentData.data);
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Webhook error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin routes
  app.get("/api/admin/stats", requireAdmin, async (req: Request, res: Response) => {
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error: any) {
      console.error("Admin stats error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/users", requireAdmin, async (req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error: any) {
      console.error("Admin users error:", error);
      res.status(500).json({ error: error.message });
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
      res.status(500).json({ error: error.message });
    }
  });

  // Management routes
  app.post("/api/admin/promote", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      const user = await storage.promoteToAdmin(userId);
      res.json(user);
    } catch (error: any) {
      console.error("Promote error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/remove-admin", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      const user = await storage.removeAdminPrivilege(userId);
      res.json(user);
    } catch (error: any) {
      console.error("Remove admin error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/delete-user", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      await storage.deleteUser(userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete user error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/suspend", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      const user = await storage.suspendUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error: any) {
      console.error("Suspend user error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/unsuspend", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      const user = await storage.unsuspendUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error: any) {
      console.error("Unsuspend user error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/add-funds", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId, amount } = req.body;
      if (!userId || amount === undefined) {
        return res.status(400).json({ error: "userId and amount are required" });
      }
      const user = await storage.addFundsToUser(userId, amount);
      res.json(user);
    } catch (error: any) {
      console.error("Add funds error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/subtract-funds", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId, amount } = req.body;
      if (!userId || amount === undefined) {
        return res.status(400).json({ error: "userId and amount are required" });
      }
      const user = await storage.subtractFundsFromUser(userId, amount);
      res.json(user);
    } catch (error: any) {
      console.error("Subtract funds error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/approve-kyc", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      const user = await storage.approveKyc(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error: any) {
      console.error("Approve KYC error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/reject-kyc", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId, reason } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      const user = await storage.rejectKyc(userId, reason);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error: any) {
      console.error("Reject KYC error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/kyc-submissions", requireAdmin, async (req: Request, res: Response) => {
    try {
      const submissions = await storage.getPendingKycSubmissions();
      res.json(submissions);
    } catch (error: any) {
      console.error("Get KYC submissions error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // User details viewing routes
  app.get("/api/admin/user/:userId/profile", requireAdmin, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.params.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error: any) {
      console.error("Get user profile error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/user/:userId/transactions", requireAdmin, async (req: Request, res: Response) => {
    try {
      const transactions = await storage.getTransactions(req.params.userId);
      res.json(transactions);
    } catch (error: any) {
      console.error("Get user transactions error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/user/:userId/payment-links", requireAdmin, async (req: Request, res: Response) => {
    try {
      const links = await storage.getPaymentLinks(req.params.userId);
      res.json(links);
    } catch (error: any) {
      console.error("Get user payment links error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/user/:userId/merchant-links", requireAdmin, async (req: Request, res: Response) => {
    try {
      const links = await storage.getMerchantLinks(req.params.userId);
      res.json(links);
    } catch (error: any) {
      console.error("Get user merchant links error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/user/:userId/api-keys", requireAdmin, async (req: Request, res: Response) => {
    try {
      const keys = await storage.getApiKeys(req.params.userId);
      res.json(keys);
    } catch (error: any) {
      console.error("Get user api keys error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
