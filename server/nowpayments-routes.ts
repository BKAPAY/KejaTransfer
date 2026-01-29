import { Router, Request, Response } from "express";
import { storage } from "./storage";
import { NowPaymentsClient, SUPPORTED_CRYPTOCURRENCIES, getCryptoDisplayName, getCryptoMinAmountXOF, CRYPTO_MIN_AMOUNT_XOF, USDT_MIN_AMOUNT_XOF } from "./nowpayments";
import { convertCurrency } from "./currency-converter";
import QRCode from "qrcode";
import { getFeeFromDatabase } from "./utils/fees";

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
    const { currency } = req.query;
    const targetCurrency = ((currency as string) || "XOF").toUpperCase();
    
    const enabledCryptos = await storage.getEnabledCryptoCurrencies();
    
    let cryptosList = enabledCryptos.length === 0 
      ? SUPPORTED_CRYPTOCURRENCIES.map((c) => ({
          code: c.code,
          name: c.name,
          symbol: c.symbol,
          isEnabled: true,
          minAmountXOF: c.minAmountXOF,
        }))
      : enabledCryptos.map((crypto: any) => ({
          ...crypto,
          minAmountXOF: getCryptoMinAmountXOF(crypto.code),
        }));

    // Si la devise demandée n'est pas XOF, convertir les minimums
    if (targetCurrency !== "XOF") {
      const conversionResult = await convertCurrency(1, "XOF", targetCurrency);
      const conversionRate = conversionResult.success ? conversionResult.conversionRate : 1;
      
      cryptosList = cryptosList.map((crypto: any) => ({
        ...crypto,
        minAmount: Math.ceil(crypto.minAmountXOF * conversionRate),
        minCurrency: targetCurrency,
      }));
    } else {
      cryptosList = cryptosList.map((crypto: any) => ({
        ...crypto,
        minAmount: crypto.minAmountXOF,
        minCurrency: "XOF",
      }));
    }

    res.json(cryptosList);
  } catch (error: any) {
    console.error("[NOWPayments] Get currencies failed:", error);
    res.status(500).json({ error: "Impossible de récupérer les cryptomonnaies" });
  }
});

// Configuration des frais crypto (en arrière-plan, invisible pour les utilisateurs)
const CRYPTO_MARKUP_PERCENT = 10; // 10% markup sur le montant crypto
const CRYPTO_FEE_PERCENT = 15; // 15% frais crypto supplémentaires
// Note: Le frais standard incoming est maintenant récupéré dynamiquement depuis la base de données

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
    if (sourceCurrency === "XOF" || sourceCurrency === "XAF") {
      const conversionRate = 0.0015;
      usdAmount = amountWithMarkup * conversionRate;
    } else if (sourceCurrency === "CDF") {
      const conversionRate = 0.00035;
      usdAmount = amountWithMarkup * conversionRate;
    } else if (sourceCurrency === "GNF") {
      const conversionRate = 0.00012;
      usdAmount = amountWithMarkup * conversionRate;
    } else if (sourceCurrency !== "USD") {
      return res.status(400).json({ error: "Devise non supportée." });
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
    const { 
      amount,
      currency = "XOF",
      crypto, 
      orderId, 
      orderDescription, 
      userId, 
      paymentLinkId, 
      merchantLinkId, 
      apiKeyId,
      customerName,
      customerEmail,
      customerPhone
    } = req.body;

    if (!amount || !crypto) {
      return res.status(400).json({ error: "Paramètres manquants: amount, crypto" });
    }
    
    const sourceCurrency = (currency as string).toUpperCase();

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
    const baseAmount = parseFloat(amount);
    
    // Convertir en XOF pour validation du minimum
    let baseAmountInXof = baseAmount;
    let conversionToUsdRate = 0.0015;
    if (sourceCurrency === "CDF") {
      baseAmountInXof = baseAmount * 0.00036 * 655.957;
      conversionToUsdRate = 0.00035;
    } else if (sourceCurrency === "GNF") {
      baseAmountInXof = baseAmount * 0.00012 * 655.957;
      conversionToUsdRate = 0.00012;
    } else if (sourceCurrency === "XAF") {
      conversionToUsdRate = 0.0015;
    }
    
    // Validation du montant minimum en XOF selon la cryptomonnaie
    const minAmountXof = getCryptoMinAmountXOF(crypto);
    if (baseAmountInXof < minAmountXof) {
      const cryptoName = getCryptoDisplayName(crypto);
      return res.status(400).json({
        error: `Montant minimum pour ${cryptoName}: ${minAmountXof.toLocaleString("fr-FR")} XOF`,
      });
    }
    
    // Récupérer les frais standard depuis la base de données pour nowpayments
    const feeConfig = await getFeeFromDatabase(storage, "nowpayments", "CRYPTO", crypto);
    const standardFeePercent = feeConfig.incoming / 10; // Convert from decimal (60 = 6%)
    
    // Montant que le client voit (avec les frais standard si customerPaysFee=true)
    const customerAmount = customerPaysFee 
      ? Math.ceil(baseAmount * (1 + standardFeePercent / 100)) 
      : baseAmount;
    
    // Appliquer le markup de 10% en arrière-plan sur le montant client (le client paie ce montant majoré en crypto)
    const amountWithMarkup = customerAmount * (1 + CRYPTO_MARKUP_PERCENT / 100);
    const usdAmount = amountWithMarkup * conversionToUsdRate;

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
    // - frais standard (dynamique) SEULEMENT si customerPaysFee est désactivé
    const totalCryptoFeePercent = CRYPTO_FEE_PERCENT + standardFeePercent;
    const effectiveFeePercent = customerPaysFee 
      ? CRYPTO_FEE_PERCENT  // 15% seulement (client a déjà payé les frais standard)
      : totalCryptoFeePercent; // 15% + frais standard dynamique
    
    const totalFee = Math.floor(baseAmount * (effectiveFeePercent / 100));
    const feePercentage = effectiveFeePercent * 10;

    const transaction = await storage.createTransaction({
      userId: ownerUserId,
      type: "deposit",
      amount: Math.floor(baseAmount),
      fee: totalFee,
      feePercentage: feePercentage,
      currency: sourceCurrency,
      status: "pending",
      country: "CRYPTO",
      operator: crypto,
      description: `Paiement crypto ${getCryptoDisplayName(crypto)}`,
      customerName: customerName || null,
      customerEmail: customerEmail || null,
      customerPhone: customerPhone || null,
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
        standardFeePercent: customerPaysFee ? 0 : standardFeePercent,
        effectiveFeePercent,
        customerAmount: Math.ceil(customerAmount),
        amountWithMarkup: Math.ceil(amountWithMarkup),
        baseAmount: Math.floor(baseAmount),
        originalCurrency: sourceCurrency,
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
      priceAmount: Math.ceil(amountWithMarkup),
      priceCurrency: sourceCurrency,
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

    if (payment_status === "finished" || payment_status === "confirmed") {
      // Use atomic finalize to prevent double crediting from webhook/polling race
      const result = await storage.finalizeIncomingTransaction(transaction.id, {});
      if (result) {
        console.log(`[NOWPayments Webhook] ✅ Transaction ${transaction.id} finalized - credited=${result.credited}`);
      } else {
        console.log(`[NOWPayments Webhook] Transaction ${transaction.id} already processed by polling`);
      }
    } else if (payment_status === "failed" || payment_status === "expired" || payment_status === "refunded") {
      await storage.updateTransactionStatus(transaction.id, "failed");
      console.log(`[NOWPayments Webhook] Transaction ${transaction.id} marked as failed (${payment_status})`);
    } else {
      console.log(`[NOWPayments Webhook] Transaction ${transaction.id} still pending (${payment_status})`);
    }
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
