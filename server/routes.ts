import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import bcrypt from "bcrypt";
import { z } from "zod";
import { insertUserSchema, insertPaymentLinkSchema, insertMerchantLinkSchema, insertApiKeySchema } from "@shared/schema";
import { imageCache } from "./index";
import { randomUUID } from "crypto";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

// Middleware pour vérifier l'authentification
function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Non authentifié" });
  }
  next();
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

// Helper function to call Paydunya API
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

  // ===== Image Upload Routes =====
  
  app.post("/api/images", requireAuth, async (req: Request, res: Response) => {
    try {
      const { imageData } = req.body;
      if (!imageData || typeof imageData !== "string") {
        return res.status(400).json({ error: "Image data is required" });
      }
      
      const imageId = randomUUID().replace(/-/g, '').substring(0, 12);
      imageCache.set(imageId, imageData);
      res.json({ imageId });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/images/:imageId", async (req: Request, res: Response) => {
    try {
      const imageData = imageCache.get(req.params.imageId);
      if (!imageData) {
        return res.status(404).json({ error: "Image not found" });
      }
      
      // Return as data URL
      res.setHeader("Content-Type", "application/json");
      res.json({ data: imageData });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ===== Payment Links Routes =====
  // NOTE: Payment links are IMMUTABLE once created - no PATCH/PUT endpoints
  // Users can only create and delete them, not modify
  
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
      const link = await storage.getPaymentLinkByToken(req.params.token);
      if (!link) {
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
      const link = await storage.getMerchantLinkByToken(req.params.token);
      if (!link) {
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

  // ===== Payment Processing Routes =====
  
  // Process payment link payment
  app.post("/api/payments/process/:token", async (req: Request, res: Response) => {
    try {
      const { customerName, customerEmail, customerPhone, country, operator } = req.body;
      const { token } = req.params;

      // Get payment link
      const paymentLink = await storage.getPaymentLinkByToken(token);
      if (!paymentLink || !paymentLink.isActive) {
        return res.status(404).json({ error: "Lien de paiement non trouvé ou inactif" });
      }

      // Create transaction record
      const transaction = await storage.createTransaction({
        userId: paymentLink.userId,
        type: "payment_link",
        amount: paymentLink.amount,
        currency: "XOF",
        status: "pending",
        country,
        operator,
        customerName,
        customerEmail,
        customerPhone,
        description: `Paiement - ${paymentLink.productName}`,
      });

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
          transaction_id: transaction.id,
          customer_name: customerName,
          customer_email: customerEmail,
        },
        actions: {
          callback_url: `${process.env.BASE_URL || 'http://localhost:5000'}/api/webhooks/paydunya`,
        },
      };

      const paydunyaResponse = await callPaydunyaAPI("/checkout-invoice/create", paydunyaData);

      if (paydunyaResponse.response_code === "00") {
        // Update transaction with Paydunya token
        await storage.updateTransactionStatus(transaction.id, "pending", {
          paydunyaToken: paydunyaResponse.token,
        });

        res.json({
          success: true,
          redirectUrl: paydunyaResponse.response_text, // This is the Paydunya checkout URL
        });
      } else {
        await storage.updateTransactionStatus(transaction.id, "failed");
        const errorMsg = paydunyaResponse.response_text || "Erreur lors de l'initiation du paiement";
        res.status(400).json({ error: errorMsg });
      }
    } catch (error: any) {
      console.error("Payment processing error:", error);
      res.status(500).json({ error: error.message || "Erreur lors du traitement du paiement" });
    }
  });

  // Process merchant link payment
  app.post("/api/merchant-payments/process/:token", async (req: Request, res: Response) => {
    try {
      const { amount, customerName, customerEmail, customerPhone, country, operator } = req.body;
      const { token } = req.params;

      // Get merchant link
      const merchantLink = await storage.getMerchantLinkByToken(token);
      if (!merchantLink || !merchantLink.isActive) {
        return res.status(404).json({ error: "Lien marchand non trouvé ou inactif" });
      }

      // Create transaction record
      const transaction = await storage.createTransaction({
        userId: merchantLink.userId,
        type: "merchant_link",
        amount,
        currency: "XOF",
        status: "pending",
        country,
        operator,
        customerName,
        customerEmail,
        customerPhone,
        description: `Paiement marchand - ${merchantLink.merchantName}`,
      });

      // Call Paydunya API
      const paydunyaData = {
        invoice: {
          total_amount: amount,
          description: `Paiement - ${merchantLink.merchantName}`,
        },
        store: {
          name: merchantLink.merchantName,
        },
        custom_data: {
          transaction_id: transaction.id,
          customer_name: customerName,
          customer_email: customerEmail,
        },
        actions: {
          callback_url: `${process.env.BASE_URL || 'http://localhost:5000'}/api/webhooks/paydunya`,
        },
      };

      const paydunyaResponse = await callPaydunyaAPI("/checkout-invoice/create", paydunyaData);

      if (paydunyaResponse.response_code === "00") {
        await storage.updateTransactionStatus(transaction.id, "pending", {
          paydunyaToken: paydunyaResponse.token,
        });

        res.json({
          success: true,
          redirectUrl: paydunyaResponse.response_text,
        });
      } else {
        await storage.updateTransactionStatus(transaction.id, "failed");
        const errorMsg = paydunyaResponse.response_text || "Erreur lors de l'initiation du paiement";
        res.status(400).json({ error: errorMsg });
      }
    } catch (error: any) {
      console.error("Merchant payment processing error:", error);
      res.status(500).json({ error: error.message || "Erreur lors du traitement du paiement" });
    }
  });

  // ===== Deposit Routes =====
  app.post("/api/deposits", requireAuth, async (req: Request, res: Response) => {
    try {
      const { amount, country, operator, customerName, customerEmail, customerPhone } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Montant invalide" });
      }

      // Create transaction
      const transaction = await storage.createTransaction({
        userId: req.session.userId!,
        type: "deposit",
        amount: Math.floor(amount),
        currency: "XOF",
        status: "pending",
        country,
        operator,
        customerName,
        customerEmail,
        customerPhone,
        description: `Dépôt de ${amount} XOF`,
      });

      // Create Paydunya invoice
      const paydunyaData = {
        invoice: {
          total_amount: Math.floor(amount),
          description: `Dépôt de ${amount} XOF sur BKApay`,
        },
        store: {
          name: "BKApay",
        },
        custom_data: {
          transaction_id: transaction.id,
          type: "deposit",
        },
        actions: {
          callback_url: `${process.env.BASE_URL || 'http://localhost:5000'}/api/webhooks/paydunya`,
        },
      };

      const paydunyaResponse = await callPaydunyaAPI("/checkout-invoice/create", paydunyaData);

      if (paydunyaResponse.response_code === "00") {
        await storage.updateTransactionStatus(transaction.id, "pending", {
          paydunyaToken: paydunyaResponse.token,
        });

        res.json({
          success: true,
          redirectUrl: paydunyaResponse.response_text,
        });
      } else {
        await storage.updateTransactionStatus(transaction.id, "failed");
        const errorMsg = paydunyaResponse.response_text || "Erreur lors de l'initiation du dépôt";
        res.status(400).json({ error: errorMsg });
      }
    } catch (error: any) {
      console.error("Deposit error:", error);
      res.status(500).json({ error: error.message || "Erreur lors du dépôt" });
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

      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Montant invalide" });
      }

      if (user.balance < amount) {
        return res.status(400).json({ error: "Solde insuffisant" });
      }

      if (!phone || !country || !operator) {
        return res.status(400).json({ error: "Informations de transfert incomplètes" });
      }

      // Create transaction
      const transaction = await storage.createTransaction({
        userId: req.session.userId!,
        type: "transfer",
        amount: Math.floor(amount),
        currency: "XOF",
        status: "pending",
        country,
        operator,
        customerPhone: phone,
        description: `Transfert de ${amount} XOF vers ${phone}`,
      });

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
        await storage.updateTransactionStatus(transaction.id, "failed");
        return res.status(400).json({ error: "Opérateur ou pays non supporté" });
      }

      // Initiate withdrawal with Paydunya
      const callbackUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/api/webhooks/paydunya`;
      const paydunyaData = {
        account_alias: phone.replace(/^[+\d]{1,3}/, ""), // Remove country code if present
        amount: Math.floor(amount),
        withdraw_mode: withdrawMode,
        callback_url: callbackUrl,
      };

      const paydunyaResponse = await callPaydunyaAPI("/disburse/get-invoice", paydunyaData);

      if (paydunyaResponse.response_code === "00") {
        const disbursalToken = paydunyaResponse.disburse_token;

        // Submit the disbursal
        const submitData = {
          disburse_invoice: disbursalToken,
          disburse_id: transaction.id,
        };

        const submitResponse = await callPaydunyaAPI("/disburse/submit-invoice", submitData);

        if (submitResponse.response_code === "00") {
          // Update balance and transaction
          await storage.updateUserBalance(req.session.userId!, -amount);
          await storage.updateTransactionStatus(transaction.id, submitResponse.status || "pending", {
            paydunyaToken: disbursalToken,
          });

          res.json({
            success: true,
            message: "Transfert initialisé avec succès",
            transactionId: transaction.id,
          });
        } else {
          await storage.updateTransactionStatus(transaction.id, "failed");
          res.status(400).json({ error: "Erreur lors de la soumission du transfert" });
        }
      } else {
        await storage.updateTransactionStatus(transaction.id, "failed");
        res.status(400).json({ error: "Erreur lors de l'initiation du transfert" });
      }
    } catch (error: any) {
      console.error("Transfer error:", error);
      res.status(500).json({ error: error.message || "Erreur lors du transfert" });
    }
  });

  // ===== API Key Payment Route (Public) =====
  // Allow developers to integrate payments using their API key
  app.post("/api/payments/create", async (req: Request, res: Response) => {
    try {
      const { publicKey, amount, description, customerName, customerEmail, customerPhone, country, operator } = req.body;

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

      // Create transaction record for the API key owner
      const transaction = await storage.createTransaction({
        userId: apiKey.userId,
        type: "api_payment",
        amount: Math.floor(amount),
        currency: "XOF",
        status: "pending",
        country,
        operator,
        customerName,
        customerEmail,
        customerPhone,
        description: description || "Paiement via API",
      });

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
          transaction_id: transaction.id,
          customer_name: customerName,
          customer_email: customerEmail,
          api_key_id: apiKey.id,
        },
        actions: {
          callback_url: `${process.env.BASE_URL || 'http://localhost:5000'}/api/webhooks/paydunya`,
        },
      };

      res.json({
        success: true,
        redirectUrl: `${process.env.BASE_URL || 'http://localhost:5000'}/api-payment/${transaction.id}`,
      });
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
          redirectUrl: paydunyaResponse.response_text,
        });
      } else {
        await storage.updateTransactionStatus(transactionId, "failed");
        const errorMsg = paydunyaResponse.response_text || "Erreur lors de l'initiation du paiement";
        res.status(400).json({ error: errorMsg });
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

      // Create a withdrawal transaction (pending until developer confirms from dashboard)
      const transaction = await storage.createTransaction({
        userId: apiKey.userId,
        type: "api_withdrawal",
        amount: Math.floor(amount),
        currency: "XOF",
        status: "pending",
        country,
        operator,
        customerPhone: phone,
        description: "Retrait demandé via API",
      });

      res.json({
        success: true,
        message: "Demande de retrait créée. Confirmez depuis votre dashboard.",
        transactionId: transaction.id,
      });
    } catch (error: any) {
      console.error("Withdrawal creation error:", error);
      res.status(500).json({ error: error.message || "Erreur lors de la création du retrait" });
    }
  });

  // Paydunya webhook
  app.post("/api/webhooks/paydunya", async (req: Request, res: Response) => {
    try {
      const paymentData = req.body;

      if (paymentData.data?.status === "completed") {
        const transactionId = paymentData.data.custom_data?.transaction_id;
        
        if (transactionId) {
          const transaction = await storage.updateTransactionStatus(
            transactionId,
            "completed",
            {
              paydunyaReceiptUrl: paymentData.data.receipt_url,
            }
          );

          // Update user balance
          if (transaction) {
            await storage.updateUserBalance(transaction.userId, transaction.amount);
          }
        }
      } else if (paymentData.data?.status === "failed") {
        const transactionId = paymentData.data.custom_data?.transaction_id;
        if (transactionId) {
          await storage.updateTransactionStatus(transactionId, "failed");
        }
      } else if (paymentData.data?.status === "cancelled") {
        const transactionId = paymentData.data.custom_data?.transaction_id;
        if (transactionId) {
          await storage.updateTransactionStatus(transactionId, "cancelled");
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Webhook error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
