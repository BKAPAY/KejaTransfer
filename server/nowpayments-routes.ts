import { Router, Request, Response } from "express";
import { storage } from "./storage";
import { NowPaymentsClient, SUPPORTED_CRYPTOCURRENCIES, getCryptoDisplayName, getCryptoMinAmountXOF, CRYPTO_MIN_AMOUNT_XOF, USDT_MIN_AMOUNT_XOF } from "./nowpayments";
import QRCode from "qrcode";

const router = Router();

async function getNowPaymentsClient(): Promise<NowPaymentsClient | null> {
  const config = await storage.getProviderConfig("nowpayments");
  if (!config || !config.isActive || !config.apiKey) {
    return null;
  }
  return new NowPaymentsClient({
    apiKey: config.apiKey,
    ipnSecret: config.ipnSecret || undefined,
  });
}

router.get("/api/crypto/status", async (req: Request, res: Response) => {
  try {
    const client = await getNowPaymentsClient();
    if (!client) {
      return res.json({ available: false, message: "Paiements crypto non configurés" });
    }

    const status = await client.getStatus();
    res.json({ available: status.message === "OK", message: status.message });
  } catch (error: any) {
    console.error("[NOWPayments] Status check failed:", error);
    res.json({ available: false, message: error.message });
  }
});

router.get("/api/crypto/currencies", async (req: Request, res: Response) => {
  try {
    const enabledCryptos = await storage.getEnabledCryptoCurrencies();
    
    if (enabledCryptos.length === 0) {
      const defaultCryptos = SUPPORTED_CRYPTOCURRENCIES.map((c) => ({
        code: c.code,
        name: c.name,
        symbol: c.symbol,
        isEnabled: true,
        minAmountXOF: c.minAmountXOF,
      }));
      return res.json(defaultCryptos);
    }

    // Ajouter les minimums XOF aux cryptos activées
    const cryptosWithMinimums = enabledCryptos.map((crypto: any) => ({
      ...crypto,
      minAmountXOF: getCryptoMinAmountXOF(crypto.code),
    }));

    res.json(cryptosWithMinimums);
  } catch (error: any) {
    console.error("[NOWPayments] Get currencies failed:", error);
    res.status(500).json({ error: "Impossible de récupérer les cryptomonnaies" });
  }
});

// Configuration des frais crypto (en arrière-plan, invisible pour les utilisateurs)
const CRYPTO_MARKUP_PERCENT = 10; // 10% markup sur le montant crypto
const CRYPTO_FEE_PERCENT = 15; // 15% frais crypto supplémentaires
const STANDARD_INCOMING_FEE_PERCENT = 6; // 6% frais standard incoming
const TOTAL_CRYPTO_FEE_PERCENT = CRYPTO_FEE_PERCENT + STANDARD_INCOMING_FEE_PERCENT; // 21% total

router.get("/api/crypto/estimate", async (req: Request, res: Response) => {
  try {
    const { amount, currency, crypto } = req.query;

    if (!amount || !currency || !crypto) {
      return res.status(400).json({ error: "Paramètres manquants: amount, currency, crypto" });
    }

    const client = await getNowPaymentsClient();
    if (!client) {
      return res.status(503).json({ error: "Paiements crypto non disponibles" });
    }

    let baseAmount = parseFloat(amount as string);
    const sourceCurrency = (currency as string).toUpperCase();

    // Appliquer le markup de 10% en arrière-plan
    const amountWithMarkup = baseAmount * (1 + CRYPTO_MARKUP_PERCENT / 100);

    let usdAmount = amountWithMarkup;
    if (sourceCurrency === "XOF") {
      const conversionRate = 0.0015;
      usdAmount = amountWithMarkup * conversionRate;
    } else if (sourceCurrency !== "USD") {
      return res.status(400).json({ error: "Devise non supportée. Utilisez XOF ou USD." });
    }

    const estimate = await client.getEstimate(usdAmount, "usd", crypto as string);

    res.json({
      priceAmount: usdAmount,
      priceCurrency: "usd",
      payCurrency: crypto,
      estimatedAmount: estimate.estimated_amount,
      originalAmount: baseAmount,
      originalCurrency: sourceCurrency,
      // Le montant avec markup est ce que le client paie réellement
      amountWithMarkup: sourceCurrency === "XOF" ? Math.ceil(amountWithMarkup) : amountWithMarkup,
    });
  } catch (error: any) {
    console.error("[NOWPayments] Estimate failed:", error);
    res.status(500).json({ error: error.message || "Impossible d'obtenir l'estimation" });
  }
});

router.post("/api/crypto/create-payment", async (req: Request, res: Response) => {
  try {
    const { amountXof, crypto, orderId, orderDescription, userId, paymentLinkId, merchantLinkId, apiKeyId } = req.body;

    if (!amountXof || !crypto) {
      return res.status(400).json({ error: "Paramètres manquants: amountXof, crypto" });
    }

    const client = await getNowPaymentsClient();
    if (!client) {
      return res.status(503).json({ error: "Paiements crypto non disponibles" });
    }

    // Trouver le userId et vérifier customerPaysFee
    let ownerUserId = userId;
    let customerPaysFee = false;
    
    if (!ownerUserId && paymentLinkId) {
      const paymentLink = await storage.getPaymentLinkById(paymentLinkId);
      if (paymentLink) {
        ownerUserId = paymentLink.userId;
        customerPaysFee = paymentLink.customerPaysFee || false;
      }
    }
    
    if (!ownerUserId && merchantLinkId) {
      const merchantLink = await storage.getMerchantLinkById(merchantLinkId);
      if (merchantLink) {
        ownerUserId = merchantLink.userId;
        // merchantLinks n'a pas customerPaysFee, donc on utilise false par défaut
        customerPaysFee = false;
      }
    }
    
    if (!ownerUserId && apiKeyId) {
      const apiKey = await storage.getApiKeyByPublicKey(apiKeyId);
      if (apiKey) {
        ownerUserId = apiKey.userId;
        customerPaysFee = apiKey.customerPaysFee || false;
      }
    }
    
    if (!ownerUserId) {
      return res.status(400).json({ error: "Impossible d'identifier le destinataire du paiement" });
    }

    // Montant de base demandé par l'utilisateur
    const baseAmountXof = parseFloat(amountXof);
    
    // Validation du montant minimum en XOF selon la cryptomonnaie
    const minAmountXof = getCryptoMinAmountXOF(crypto);
    if (baseAmountXof < minAmountXof) {
      const cryptoName = getCryptoDisplayName(crypto);
      return res.status(400).json({
        error: `Montant minimum pour ${cryptoName}: ${minAmountXof.toLocaleString("fr-FR")} XOF`,
      });
    }
    
    // Appliquer le markup de 10% en arrière-plan (le client paie ce montant majoré)
    const amountWithMarkupXof = baseAmountXof * (1 + CRYPTO_MARKUP_PERCENT / 100);
    const usdAmount = amountWithMarkupXof * 0.0015;

    const baseUrl = process.env.BASE_URL || `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
    const ipnCallbackUrl = `${baseUrl}/api/webhooks/nowpayments`;

    const payment = await client.createPayment({
      price_amount: usdAmount,
      price_currency: "usd",
      pay_currency: crypto,
      ipn_callback_url: ipnCallbackUrl,
      order_id: orderId || `bka_${Date.now()}`,
      order_description: orderDescription || "Paiement BKApay",
    });

    const qrCodeDataUrl = await QRCode.toDataURL(payment.pay_address, {
      width: 256,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    });

    // Calculer les frais crypto:
    // - 15% crypto TOUJOURS prélevés
    // - 6% standard SEULEMENT si customerPaysFee est désactivé
    const effectiveFeePercent = customerPaysFee 
      ? CRYPTO_FEE_PERCENT  // 15% seulement (client a déjà payé les 6%)
      : TOTAL_CRYPTO_FEE_PERCENT; // 21% (15% + 6%)
    
    const totalFee = Math.floor(baseAmountXof * (effectiveFeePercent / 100));
    const feePercentage = effectiveFeePercent * 10;

    const transaction = await storage.createTransaction({
      userId: ownerUserId,
      type: "deposit",
      amount: Math.floor(baseAmountXof),
      fee: totalFee,
      feePercentage: feePercentage,
      currency: "XOF",
      status: "pending",
      country: "CRYPTO",
      operator: crypto,
      description: `Paiement crypto ${getCryptoDisplayName(crypto)}`,
      metadata: JSON.stringify({
        paymentProvider: "nowpayments",
        isCrypto: true,
        paymentId: payment.payment_id,
        payAddress: payment.pay_address,
        payAmount: payment.pay_amount,
        payCurrency: payment.pay_currency,
        priceAmount: payment.price_amount,
        priceCurrency: payment.price_currency,
        paymentLinkId,
        merchantLinkId,
        apiKeyId,
        purchaseId: payment.purchase_id,
        network: payment.network,
        customerPaysFee,
        cryptoMarkupPercent: CRYPTO_MARKUP_PERCENT,
        cryptoFeePercent: CRYPTO_FEE_PERCENT,
        standardFeePercent: customerPaysFee ? 0 : STANDARD_INCOMING_FEE_PERCENT,
        effectiveFeePercent,
        amountWithMarkupXof: Math.ceil(amountWithMarkupXof),
        baseAmountXof: Math.floor(baseAmountXof),
      }),
    });

    res.json({
      success: true,
      paymentId: payment.payment_id,
      payAddress: payment.pay_address,
      payAmount: payment.pay_amount,
      payCurrency: payment.pay_currency,
      priceAmountUsd: payment.price_amount,
      // Afficher le montant avec markup (ce que le client paie en crypto)
      priceAmountXof: Math.ceil(amountWithMarkupXof),
      qrCode: qrCodeDataUrl,
      transactionId: transaction.id,
      expiresIn: 1800,
    });
  } catch (error: any) {
    console.error("[NOWPayments] Create payment failed:", error);
    res.status(500).json({ error: error.message || "Impossible de créer le paiement" });
  }
});

router.get("/api/crypto/payment-status/:paymentId", async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;

    const client = await getNowPaymentsClient();
    if (!client) {
      return res.status(503).json({ error: "Paiements crypto non disponibles" });
    }

    const status = await client.getPaymentStatus(paymentId);

    res.json({
      paymentId: status.payment_id,
      status: status.payment_status,
      payAddress: status.pay_address,
      payAmount: status.pay_amount,
      actuallyPaid: status.actually_paid,
      payCurrency: status.pay_currency,
      priceAmount: status.price_amount,
      priceCurrency: status.price_currency,
    });
  } catch (error: any) {
    console.error("[NOWPayments] Get payment status failed:", error);
    res.status(500).json({ error: error.message || "Impossible de vérifier le statut" });
  }
});

router.post("/api/webhooks/nowpayments", async (req: Request, res: Response) => {
  try {
    const signature = req.headers["x-nowpayments-sig"] as string;
    const body = req.body;

    console.log("[NOWPayments Webhook] Received:", JSON.stringify(body));

    const config = await storage.getProviderConfig("nowpayments");
    if (!config || !config.ipnSecret) {
      console.error("[NOWPayments Webhook] IPN secret not configured");
      return res.status(400).json({ error: "IPN not configured" });
    }

    const client = new NowPaymentsClient({
      apiKey: config.apiKey || "",
      ipnSecret: config.ipnSecret,
    });

    if (signature && !client.verifyIpnSignature(body, signature)) {
      console.error("[NOWPayments Webhook] Invalid signature");
      return res.status(400).json({ error: "Invalid signature" });
    }

    const { payment_id, payment_status, order_id, actually_paid, pay_amount, outcome_amount } = body;

    const transactions = await storage.getTransactionsByMetadataPaymentId(payment_id.toString());
    
    if (transactions.length === 0) {
      console.error(`[NOWPayments Webhook] Transaction not found for payment_id: ${payment_id}`);
      return res.status(404).json({ error: "Transaction not found" });
    }

    const transaction = transactions[0];

    if (transaction.status === "completed") {
      console.log(`[NOWPayments Webhook] Transaction ${transaction.id} already completed`);
      return res.json({ success: true, message: "Already processed" });
    }

    let newStatus: "completed" | "pending" | "failed" = "pending";

    if (payment_status === "finished" || payment_status === "confirmed") {
      newStatus = "completed";
    } else if (payment_status === "failed" || payment_status === "expired" || payment_status === "refunded") {
      newStatus = "failed";
    }

    if (newStatus !== "pending") {
      await storage.updateTransactionStatus(transaction.id, newStatus);

      if (newStatus === "completed") {
        const netAmount = transaction.amount - transaction.fee;
        await storage.updateUserBalance(transaction.userId, netAmount);
        console.log(`[NOWPayments Webhook] Credited ${netAmount} XOF to user ${transaction.userId}`);
      }
    }

    console.log(`[NOWPayments Webhook] Updated transaction ${transaction.id} to ${newStatus}`);
    res.json({ success: true });
  } catch (error: any) {
    console.error("[NOWPayments Webhook] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/admin/crypto-currencies", async (req: Request, res: Response) => {
  try {
    const cryptosInDb = await storage.getAllCryptoCurrencies();
    
    // Fusionner toutes les cryptos supportées avec celles en base de données
    const cryptoMap = new Map<string, any>();
    
    // D'abord, ajouter toutes les cryptos supportées avec isEnabled: false par défaut
    for (const c of SUPPORTED_CRYPTOCURRENCIES) {
      cryptoMap.set(c.code, {
        id: null,
        code: c.code,
        name: c.name,
        symbol: c.symbol,
        isEnabled: false,
        minAmount: null,
      });
    }
    
    // Ensuite, mettre à jour avec les données de la base de données
    for (const dbCrypto of cryptosInDb) {
      cryptoMap.set(dbCrypto.code, {
        id: dbCrypto.id,
        code: dbCrypto.code,
        name: dbCrypto.name,
        symbol: dbCrypto.symbol,
        isEnabled: dbCrypto.isEnabled,
        minAmount: dbCrypto.minAmount,
      });
    }
    
    res.json(Array.from(cryptoMap.values()));
  } catch (error: any) {
    console.error("[Admin] Get crypto currencies failed:", error);
    res.status(500).json({ error: "Impossible de récupérer les cryptomonnaies" });
  }
});

router.put("/api/admin/crypto-currencies/:code", async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const { isEnabled } = req.body;

    const existing = await storage.getCryptoCurrencyByCode(code);
    
    if (existing) {
      await storage.updateCryptoCurrency(code, { isEnabled });
    } else {
      const cryptoInfo = SUPPORTED_CRYPTOCURRENCIES.find((c) => c.code === code);
      if (!cryptoInfo) {
        return res.status(404).json({ error: "Cryptomonnaie non supportée" });
      }
      await storage.createCryptoCurrency({
        code: cryptoInfo.code,
        name: cryptoInfo.name,
        symbol: cryptoInfo.symbol,
        isEnabled,
      });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("[Admin] Update crypto currency failed:", error);
    res.status(500).json({ error: "Impossible de mettre à jour la cryptomonnaie" });
  }
});

export default router;
