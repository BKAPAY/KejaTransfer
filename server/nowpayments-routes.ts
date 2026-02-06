import { Router, Request, Response } from "express";
import { storage } from "./storage";
import { NowPaymentsClient, SUPPORTED_CRYPTOCURRENCIES, getCryptoDisplayName, getCryptoMinAmountXOF, getCryptoSymbol, CRYPTO_MIN_AMOUNT_XOF, USDT_MIN_AMOUNT_XOF, CRYPTO_WITHDRAWAL_MIN_XOF } from "./nowpayments";
import { convertCurrency } from "./currency-converter";
import QRCode from "qrcode";
import { getFeeFromDatabase, calculateOutgoingFee } from "./utils/fees";
import bcrypt from "bcrypt";

const router = Router();

async function getNowPaymentsClient(): Promise<NowPaymentsClient | null> {
  const config = await storage.getProviderConfig("nowpayments");
  if (!config || !config.isActive || !config.apiKey) {
    return null;
  }
  return new NowPaymentsClient({
    apiKey: config.apiKey,
    ipnSecret: config.ipnSecret || undefined,
    email: config.publicKey || undefined,
    password: config.secretKey || undefined,
  });
}

router.get("/api/crypto/country-availability", async (req: Request, res: Response) => {
  try {
    const { country } = req.query;
    if (!country || typeof country !== "string") {
      return res.status(400).json({ error: "Le parametre country est requis" });
    }

    const countryStatuses = await storage.getCountryStatuses();
    const nowpaymentsStatus = countryStatuses.find(
      (s) => s.provider === "nowpayments" && s.country === country.toUpperCase()
    );

    if (!nowpaymentsStatus) {
      return res.json({ payinEnabled: false, payoutEnabled: false });
    }

    return res.json({
      payinEnabled: nowpaymentsStatus.payinEnabled,
      payoutEnabled: nowpaymentsStatus.payoutEnabled,
    });
  } catch (error: any) {
    console.error("[NOWPayments] Country availability check failed:", error);
    res.status(500).json({ error: "Erreur lors de la verification" });
  }
});

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
    
    const direction = (req.query.direction as string) || "payin";
    let enabledCryptos;
    if (direction === "all") {
      enabledCryptos = await storage.getAllCryptoCurrencies();
    } else if (direction === "payout") {
      enabledCryptos = await storage.getPayoutEnabledCryptoCurrencies();
    } else {
      enabledCryptos = await storage.getPayinEnabledCryptoCurrencies();
    }
    
    const isPayoutDirection = direction === "payout";
    const allDbCryptos = await storage.getAllCryptoCurrencies();
    const hasDbRecords = allDbCryptos.length > 0;
    
    let cryptosList = (enabledCryptos.length === 0 && !hasDbRecords)
      ? SUPPORTED_CRYPTOCURRENCIES.map((c) => ({
          code: c.code,
          name: c.name,
          symbol: c.symbol,
          payinEnabled: true,
          payoutEnabled: true,
          minAmountXOF: isPayoutDirection ? CRYPTO_WITHDRAWAL_MIN_XOF : c.minAmountXOF,
        }))
      : enabledCryptos.map((crypto: any) => ({
          ...crypto,
          minAmountXOF: isPayoutDirection ? CRYPTO_WITHDRAWAL_MIN_XOF : getCryptoMinAmountXOF(crypto.code),
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

// Valeurs par défaut pour les frais crypto (utilisées si la config DB n'existe pas)
const DEFAULT_CRYPTO_MARKUP_PERCENT = 10;
const DEFAULT_CRYPTO_FEE_PERCENT = 15;

async function getCryptoFeeSettings(): Promise<{ markupPercent: number; feePercent: number }> {
  try {
    const config = await storage.getProviderConfig("nowpayments");
    return {
      markupPercent: config?.cryptoMarkupPercent != null ? config.cryptoMarkupPercent / 10 : DEFAULT_CRYPTO_MARKUP_PERCENT,
      feePercent: config?.cryptoFeePercent != null ? config.cryptoFeePercent / 10 : DEFAULT_CRYPTO_FEE_PERCENT,
    };
  } catch {
    return { markupPercent: DEFAULT_CRYPTO_MARKUP_PERCENT, feePercent: DEFAULT_CRYPTO_FEE_PERCENT };
  }
}

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
    const customerPaysFee = req.query.customerPaysFee === "true";

    const feeConfig = await getFeeFromDatabase(storage, "nowpayments", "CRYPTO", crypto as string);
    const standardFeePercent = feeConfig.incoming / 10;

    const cryptoSettings = await getCryptoFeeSettings();
    const totalFeePercent = cryptoSettings.feePercent + standardFeePercent;

    let customerAmount = baseAmount;
    let feeAmount = 0;

    if (customerPaysFee && totalFeePercent > 0) {
      feeAmount = Math.ceil(baseAmount * totalFeePercent / 100);
      customerAmount = baseAmount + feeAmount;
    } else if (!customerPaysFee) {
      feeAmount = Math.floor(baseAmount * totalFeePercent / 100);
    }

    const amountWithMarkup = customerAmount * (1 + cryptoSettings.markupPercent / 100);

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
      amountWithMarkup: sourceCurrency === "XOF" ? Math.ceil(amountWithMarkup) : amountWithMarkup,
      customerAmount: Math.ceil(customerAmount),
      feeAmount,
      feePercentage: totalFeePercent * 10,
      customerPaysFee,
      netAmount: customerPaysFee ? Math.floor(baseAmount) : Math.floor(baseAmount - feeAmount),
      markupPercent: cryptoSettings.markupPercent,
      cryptoFeePercent: cryptoSettings.feePercent,
      standardFeePercent,
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

    // Vérifier si le propriétaire est suspendu
    const ownerUser = await storage.getUser(ownerUserId);
    if (ownerUser?.suspended) {
      return res.status(403).json({ error: "Ce service est temporairement indisponible" });
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
    
    const cryptoSettings = await getCryptoFeeSettings();
    const totalFeePercent = cryptoSettings.feePercent + standardFeePercent;
    
    // Montant que le client paie (avec les frais ajoutés si customerPaysFee=true)
    const feeAmount = customerPaysFee ? Math.ceil(baseAmount * totalFeePercent / 100) : 0;
    const customerAmount = baseAmount + feeAmount;
    
    const amountWithMarkup = customerAmount * (1 + cryptoSettings.markupPercent / 100);
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

    // Frais effectifs: frais globaux crypto + frais par crypto
    // Si customerPaysFee: les frais sont ajoutés au montant client (déjà fait ci-dessus)
    // Sinon: les frais sont déduits du solde du propriétaire
    const effectiveFeePercent = totalFeePercent;
    
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
        cryptoMarkupPercent: cryptoSettings.markupPercent,
        cryptoFeePercent: cryptoSettings.feePercent,
        standardFeePercent,
        totalFeePercent: effectiveFeePercent,
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

router.post("/api/webhooks/nowpayments/payout", async (req: Request, res: Response) => {
  try {
    const signature = req.headers["x-nowpayments-sig"] as string;
    const body = req.body;

    console.log("[NOWPayments Payout Webhook] Received:", JSON.stringify(body));

    const config = await storage.getProviderConfig("nowpayments");
    if (!config || !config.ipnSecret) {
      console.error("[NOWPayments Payout Webhook] IPN secret not configured");
      return res.status(400).json({ error: "IPN not configured" });
    }

    if (!signature) {
      console.error("[NOWPayments Payout Webhook] Missing signature header");
      return res.status(401).json({ error: "Missing signature" });
    }

    const client = new NowPaymentsClient({
      apiKey: config.apiKey || "",
      ipnSecret: config.ipnSecret,
    });

    if (!client.verifyIpnSignature(body, signature)) {
      console.error("[NOWPayments Payout Webhook] Invalid signature");
      return res.status(401).json({ error: "Invalid signature" });
    }

    const { id, batch_withdrawal_id, status } = body;

    const searchId = batch_withdrawal_id || id;
    if (!searchId) {
      console.error("[NOWPayments Payout Webhook] No payout ID found in webhook body");
      return res.status(400).json({ error: "No payout ID" });
    }

    let transactions = await storage.getTransactionsByMetadataPayoutId(searchId.toString());
    if (transactions.length === 0 && id) {
      transactions = await storage.getTransactionsByMetadataPayoutId(id.toString());
    }

    if (transactions.length === 0) {
      console.error(`[NOWPayments Payout Webhook] Transaction not found for payout: ${searchId}`);
      return res.status(404).json({ error: "Transaction not found" });
    }

    const transaction = transactions[0];

    if (transaction.status === "completed" || transaction.status === "failed") {
      console.log(`[NOWPayments Payout Webhook] Transaction ${transaction.id} already in terminal state: ${transaction.status}`);
      return res.json({ success: true, message: "Already processed" });
    }

    const normalizedStatus = (status || "").toUpperCase();

    if (normalizedStatus === "FINISHED" || normalizedStatus === "SENDING") {
      await storage.updateTransactionStatus(transaction.id, "completed");
      const metadata = transaction.metadata ? JSON.parse(transaction.metadata) : {};
      metadata.payoutStatus = normalizedStatus;
      if (body.hash) metadata.txHash = body.hash;
      await storage.updateTransactionMetadata(transaction.id, JSON.stringify(metadata));
      console.log(`[NOWPayments Payout Webhook] Transaction ${transaction.id} marked as completed (${normalizedStatus})`);
    } else if (normalizedStatus === "FAILED" || normalizedStatus === "REJECTED" || normalizedStatus === "EXPIRED") {
      await storage.updateTransactionStatus(transaction.id, "failed");
      const metadata = transaction.metadata ? JSON.parse(transaction.metadata) : {};
      metadata.payoutStatus = normalizedStatus;
      metadata.payoutError = body.error || null;
      metadata.refunded = true;
      await storage.updateTransactionMetadata(transaction.id, JSON.stringify(metadata));
      const refundAmount = transaction.amount + (transaction.fee || 0);
      await storage.addFundsToUser(transaction.userId, refundAmount);
      console.log(`[NOWPayments Payout Webhook] Transaction ${transaction.id} failed (${normalizedStatus}) - refunded ${refundAmount} to user ${transaction.userId}`);
    } else {
      const metadata = transaction.metadata ? JSON.parse(transaction.metadata) : {};
      metadata.payoutStatus = normalizedStatus;
      await storage.updateTransactionMetadata(transaction.id, JSON.stringify(metadata));
      console.log(`[NOWPayments Payout Webhook] Transaction ${transaction.id} status: ${normalizedStatus}`);
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("[NOWPayments Payout Webhook] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/crypto/withdrawal-estimate", async (req: Request, res: Response) => {
  try {
    const { amount, currency, crypto, type } = req.query;

    if (!amount || !currency || !crypto) {
      return res.status(400).json({ error: "Parametres manquants: amount, currency, crypto" });
    }

    const client = await getNowPaymentsClient();
    if (!client) {
      return res.status(503).json({ error: "Paiements crypto non disponibles" });
    }

    const baseAmount = parseFloat(amount as string);
    const sourceCurrency = (currency as string).toUpperCase();
    const operationType = type === "transfer" ? "transfer" : "withdrawal";

    if (!baseAmount || baseAmount <= 0) {
      return res.status(400).json({ error: "Montant invalide" });
    }

    const supportedCurrencies = ["XOF", "XAF", "CDF", "GNF", "USD"];
    if (!supportedCurrencies.includes(sourceCurrency)) {
      return res.status(400).json({ error: "Devise non supportee" });
    }

    const feeConfig = await getFeeFromDatabase(storage, "nowpayments", "CRYPTO", crypto as string);
    const feePercentage = feeConfig.outgoing;
    const feeCalc = calculateOutgoingFee(Math.floor(baseAmount), feePercentage);

    let amountForConversion: number;
    let totalDeducted: number;

    if (operationType === "transfer") {
      amountForConversion = baseAmount;
      totalDeducted = baseAmount + feeCalc.feeAmount;
    } else {
      amountForConversion = feeCalc.amountReceived;
      totalDeducted = feeCalc.totalDeductedFromBalance;
    }

    let usdAmount = amountForConversion;
    if (sourceCurrency === "XOF" || sourceCurrency === "XAF") {
      usdAmount = amountForConversion * 0.0015;
    } else if (sourceCurrency === "CDF") {
      usdAmount = amountForConversion * 0.00035;
    } else if (sourceCurrency === "GNF") {
      usdAmount = amountForConversion * 0.00012;
    }

    const estimate = await client.getEstimate(usdAmount, "usd", crypto as string);

    res.json({
      amount: baseAmount,
      currency: sourceCurrency,
      type: operationType,
      feeAmount: feeCalc.feeAmount,
      feePercentage: feePercentage,
      amountAfterFee: feeCalc.amountReceived,
      totalDeducted: totalDeducted,
      estimatedCryptoAmount: estimate.estimated_amount,
      cryptoCurrency: crypto,
      cryptoSymbol: getCryptoSymbol(crypto as string),
      usdEquivalent: usdAmount,
    });
  } catch (error: any) {
    console.error("[NOWPayments] Withdrawal estimate failed:", error);
    res.status(500).json({ error: error.message || "Impossible d'obtenir l'estimation" });
  }
});

router.post("/api/crypto/create-withdrawal", async (req: Request, res: Response) => {
  try {
    const { amount, currency, crypto, walletAddress, type, securityCode } = req.body;

    if (!amount || !currency || !crypto || !walletAddress || !securityCode) {
      return res.status(400).json({ success: false, error: "Parametres manquants" });
    }

    if (!req.session?.userId) {
      return res.status(401).json({ success: false, error: "Non authentifie" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: "Utilisateur non trouve" });
    }

    if (user.suspended) {
      return res.status(403).json({ success: false, error: "Votre compte a ete suspendu" });
    }

    if (user.kycStatus !== "verified") {
      return res.status(403).json({ success: false, error: "Verification KYC requise" });
    }

    if (!user.securityCode) {
      return res.status(400).json({ success: false, error: "Code de securite non configure" });
    }

    const isValidCode = await bcrypt.compare(securityCode, user.securityCode);
    if (!isValidCode) {
      return res.status(400).json({ success: false, error: "Code de securite incorrect" });
    }

    const cryptoInfo = SUPPORTED_CRYPTOCURRENCIES.find(c => c.code === crypto);
    if (!cryptoInfo) {
      return res.status(400).json({ success: false, error: "Cryptomonnaie non supportee" });
    }

    if (walletAddress.length < 10 || walletAddress.length > 256) {
      return res.status(400).json({ success: false, error: "Adresse de portefeuille invalide" });
    }

    const baseAmount = parseFloat(amount);
    const sourceCurrency = (currency as string).toUpperCase();

    const supportedCurrencies = ["XOF", "XAF", "CDF", "GNF", "USD"];
    if (!supportedCurrencies.includes(sourceCurrency)) {
      return res.status(400).json({ success: false, error: "Devise non supportee" });
    }

    if (baseAmount <= 0) {
      return res.status(400).json({ success: false, error: "Montant invalide" });
    }

    let baseAmountInXof = baseAmount;
    if (sourceCurrency === "CDF") {
      baseAmountInXof = baseAmount * 0.00036 * 655.957;
    } else if (sourceCurrency === "GNF") {
      baseAmountInXof = baseAmount * 0.00012 * 655.957;
    } else if (sourceCurrency === "XAF") {
      baseAmountInXof = baseAmount;
    } else if (sourceCurrency === "USD") {
      baseAmountInXof = baseAmount / 0.0015;
    }

    if (baseAmountInXof < CRYPTO_WITHDRAWAL_MIN_XOF) {
      return res.status(400).json({
        success: false,
        error: `Montant minimum pour les retraits/transferts crypto: ${CRYPTO_WITHDRAWAL_MIN_XOF.toLocaleString("fr-FR")} XOF`,
      });
    }

    const withdrawalType = type === "transfer" ? "transfer" : "withdrawal";

    const feeConfig = await getFeeFromDatabase(storage, "nowpayments", "CRYPTO", crypto);
    const feePercentage = feeConfig.outgoing;
    const feeCalc = calculateOutgoingFee(Math.floor(baseAmount), feePercentage);

    let amountForConversion: number;
    let totalToDebit: number;

    if (withdrawalType === "transfer") {
      amountForConversion = baseAmount;
      totalToDebit = baseAmount + feeCalc.feeAmount;
    } else {
      amountForConversion = feeCalc.amountReceived;
      totalToDebit = feeCalc.totalDeductedFromBalance;
    }

    if (user.balance < totalToDebit) {
      return res.status(400).json({ 
        success: false, 
        error: `Solde insuffisant. Vous avez ${user.balance} ${sourceCurrency}, il faut ${totalToDebit} ${sourceCurrency}` 
      });
    }

    let usdAmount = amountForConversion;
    if (sourceCurrency === "XOF" || sourceCurrency === "XAF") {
      usdAmount = amountForConversion * 0.0015;
    } else if (sourceCurrency === "CDF") {
      usdAmount = amountForConversion * 0.00035;
    } else if (sourceCurrency === "GNF") {
      usdAmount = amountForConversion * 0.00012;
    }

    const client = await getNowPaymentsClient();
    if (!client) {
      return res.status(503).json({ success: false, error: "Service crypto non disponible" });
    }

    let estimatedCryptoAmount = 0;
    try {
      const estimate = await client.getEstimate(usdAmount, "usd", crypto);
      estimatedCryptoAmount = estimate.estimated_amount;
    } catch (err) {
      console.error("[NOWPayments] Could not get estimate for withdrawal:", err);
      return res.status(503).json({ success: false, error: "Impossible d'obtenir l'estimation crypto" });
    }

    if (estimatedCryptoAmount <= 0) {
      return res.status(400).json({ success: false, error: "Le montant crypto estime est trop faible" });
    }

    await storage.subtractFundsFromUser(user.id, totalToDebit);

    const baseUrl = process.env.BASE_URL || `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
    const ipnCallbackUrl = `${baseUrl}/api/webhooks/nowpayments/payout`;

    let payoutId: string | null = null;
    let payoutWithdrawalId: string | null = null;
    let payoutStatus = "pending";

    try {
      const payoutResult = await client.createPayout(
        [{
          address: walletAddress,
          currency: crypto,
          amount: estimatedCryptoAmount,
          ipn_callback_url: ipnCallbackUrl,
        }],
        ipnCallbackUrl
      );

      payoutId = payoutResult.id;
      if (payoutResult.withdrawals && payoutResult.withdrawals.length > 0) {
        payoutWithdrawalId = payoutResult.withdrawals[0].id;
        payoutStatus = payoutResult.withdrawals[0].status || "CREATING";
      }

      console.log(`[NOWPayments] Payout created: ${payoutId} - withdrawal: ${payoutWithdrawalId} - status: ${payoutStatus}`);
    } catch (payoutError: any) {
      console.error("[NOWPayments] Payout API failed:", payoutError);
      await storage.addFundsToUser(user.id, totalToDebit);
      
      let errorMessage = "Le retrait crypto a echoue. Votre solde n'a pas ete debite. Veuillez reessayer.";
      const errMsg = payoutError?.message || "";
      if (errMsg.includes("Invalid IP") || errMsg.includes("Access denied") || errMsg.includes("IP")) {
        const ipMatch = errMsg.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
        const ip = ipMatch ? ipMatch[1] : "";
        errorMessage = ip
          ? `Pour activer les retraits crypto, veuillez contacter l'assistance BKApay et communiquer l'adresse IP suivante : ${ip}`
          : "Pour activer les retraits crypto, veuillez contacter l'assistance BKApay pour finaliser la configuration.";
      } else if (errMsg.includes("Authorization") || errMsg.includes("auth")) {
        errorMessage = "Service de retrait crypto temporairement indisponible. Veuillez contacter l'assistance BKApay.";
      }
      
      return res.status(500).json({ 
        success: false, 
        error: errorMessage
      });
    }

    const transaction = await storage.createTransaction({
      userId: user.id,
      type: withdrawalType,
      amount: Math.floor(baseAmount),
      fee: feeCalc.feeAmount,
      feePercentage: feePercentage,
      currency: sourceCurrency,
      status: "pending",
      country: "CRYPTO",
      operator: crypto,
      description: `${withdrawalType === "transfer" ? "Transfert" : "Retrait"} crypto ${getCryptoDisplayName(crypto)}`,
      metadata: JSON.stringify({
        paymentProvider: "nowpayments",
        isCrypto: true,
        isCryptoWithdrawal: true,
        withdrawalType,
        walletAddress,
        cryptoCurrency: crypto,
        cryptoSymbol: getCryptoSymbol(crypto),
        estimatedCryptoAmount,
        usdEquivalent: usdAmount,
        feeAmount: feeCalc.feeAmount,
        totalDebited: totalToDebit,
        amountForConversion: amountForConversion,
        originalAmount: baseAmount,
        originalCurrency: sourceCurrency,
        payoutId,
        payoutWithdrawalId,
        payoutStatus,
      }),
    });

    console.log(`[NOWPayments] Crypto ${withdrawalType} created: ${transaction.id} - payout: ${payoutId} - ${baseAmount} ${sourceCurrency} -> ${estimatedCryptoAmount} ${getCryptoSymbol(crypto)} to ${walletAddress}`);

    res.json({
      success: true,
      transactionId: transaction.id,
      estimatedCryptoAmount,
      cryptoSymbol: getCryptoSymbol(crypto),
      walletAddress,
      message: `${withdrawalType === "transfer" ? "Transfert" : "Retrait"} crypto en cours de traitement.`,
    });
  } catch (error: any) {
    console.error("[NOWPayments] Create crypto withdrawal failed:", error);
    res.status(500).json({ success: false, error: error.message || "Erreur lors du retrait crypto" });
  }
});

export default router;
