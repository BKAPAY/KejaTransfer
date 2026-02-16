import type { Request, Response } from "express";
import { storage } from "./storage";

import { calculateIncomingFee, calculateOutgoingFee, getFeeFromDatabase } from "./utils/fees";
import { 
  createMbiyoPayPayin, 
  createMbiyoPayPayout, 
  getMbiyoPayTransactionStatus,
  resendMbiyoPayWebhook,
  MBIYOPAY_SUPPORTED_COUNTRIES,
  MBIYOPAY_OPERATORS,
  getCurrencyForCountry,
  formatPhoneForMbiyoPay,
} from "./mbiyopay";

export async function handleMbiyoPayDeposit(
  userId: string,
  user: any,
  amount: number,
  country: string,
  operator: string,
  phone: string,
  currency?: string,
  originalAmount?: number,
  originalCurrency?: string
): Promise<{ success: boolean; transactionId?: string; mbiyopayTransactionId?: string; redirectUrl?: string; message?: string; error?: string; instructions?: string }> {
  try {
    const countryLower = country.toLowerCase();
    if (!MBIYOPAY_SUPPORTED_COUNTRIES.includes(countryLower)) {
      return { success: false, error: `Pays non supporte pour les depots via MbiyoPay: ${country}` };
    }

    const countryOperators = MBIYOPAY_OPERATORS[countryLower] || [];
    if (!countryOperators.includes(operator.toLowerCase())) {
      return { success: false, error: `Operateur ${operator} non supporte pour ${country}` };
    }

    const providerAmount = Math.floor(amount);
    const providerCurrency = currency || getCurrencyForCountry(country);
    const balanceAmount = originalAmount ? Math.floor(originalAmount) : providerAmount;
    const userCurrency = originalCurrency || providerCurrency;
    
    const feeConfig = await getFeeFromDatabase(storage, "mbiyopay", country, operator);
    const feeInfo = calculateIncomingFee(balanceAmount, feeConfig.incoming);

    // Create transaction BEFORE calling MbiyoPay API so it always appears in history
    const tx = await storage.createTransaction({
      userId: userId,
      type: "deposit",
      amount: feeInfo.grossAmount,
      fee: feeInfo.feeAmount,
      feePercentage: feeInfo.feePercentage,
      currency: userCurrency,
      status: "pending",
      country: country.toUpperCase(),
      operator: operator,
      description: `Depot de ${providerAmount} ${providerCurrency}`,
      customerPhone: phone,
      metadata: JSON.stringify({
        phone,
        provider: "mbiyopay",
        paymentProvider: "mbiyopay",
        providerAmount,
        providerCurrency,
        balanceAmount,
        balanceCurrency: userCurrency,
        startTime: Date.now(),
      }),
    });

    const result = await createMbiyoPayPayin({
      amount: providerAmount,
      currency: providerCurrency,
      phone: phone,
      countryCode: country,
      network: operator,
      orderId: `BKAPAY-DEP-${Date.now()}`,
      callbackUrl: `${process.env.BASE_URL || "https://bkapay.com"}/api/webhooks/mbiyopay`,
    });

    if (!result.success) {
      // Mark the transaction as failed since MbiyoPay rejected it
      await storage.updateTransactionStatus(tx.id, "failed");
      return { success: false, transactionId: tx.id, error: result.error || "Erreur lors du depot" };
    }

    // Update transaction with MbiyoPay transaction ID
    const updatedMetadata = JSON.stringify({
      mbiyopayTransactionId: result.transactionId,
      redirectUrl: result.redirectUrl,
      phone,
      provider: "mbiyopay",
      paymentProvider: "mbiyopay",
      providerAmount,
      providerCurrency,
      balanceAmount,
      balanceCurrency: userCurrency,
      startTime: Date.now(),
    });
    await storage.updateTransactionMetadata(tx.id, updatedMetadata);

    return {
      success: true,
      transactionId: tx.id,
      mbiyopayTransactionId: result.transactionId,
      redirectUrl: result.redirectUrl,
      message: result.message || "Paiement initie. Veuillez valider sur votre telephone.",
      instructions: result.instructions,
    };
  } catch (error: any) {
    console.error("[MbiyoPay Deposit] Error:", error);
    return { success: false, error: "Erreur lors du depot" };
  }
}

export async function handleMbiyoPayWithdrawal(
  userId: string,
  user: any,
  amount: number,
  country: string,
  operator: string,
  phone: string,
  userCurrency?: string
): Promise<{ success: boolean; transactionId?: string; message?: string; error?: string }> {
  try {
    const countryLower = country.toLowerCase();
    if (!MBIYOPAY_SUPPORTED_COUNTRIES.includes(countryLower)) {
      console.error(`[MbiyoPay Withdrawal] Unsupported country: ${country}`);
      return { success: false, error: "Retrait echoue" };
    }

    if (user.kycStatus !== "verified") {
      return { success: false, error: "Verification KYC requise" };
    }

    const grossAmount = Math.floor(amount);
    const providerCurrency = getCurrencyForCountry(country);
    const balanceCurrency = userCurrency || providerCurrency;
    
    const feeConfig = await getFeeFromDatabase(storage, "mbiyopay", country, operator);
    const feeInfo = calculateOutgoingFee(grossAmount, feeConfig.outgoing);

    if (user.balance < feeInfo.totalDeductedFromBalance) {
      return { success: false, error: "Solde insuffisant" };
    }

    let amountForProvider = feeInfo.amountReceived;
    if (balanceCurrency !== providerCurrency) {
      const { convertCurrency } = await import("./currency-converter");
      const conversionResult = await convertCurrency(feeInfo.amountReceived, balanceCurrency, providerCurrency);
      if (conversionResult.success) {
        amountForProvider = Math.floor(conversionResult.convertedAmount);
        console.log(`[MbiyoPay Withdrawal] Currency conversion: ${feeInfo.amountReceived} ${balanceCurrency} -> ${amountForProvider} ${providerCurrency}`);
      } else {
        console.error("[MbiyoPay Withdrawal] Currency conversion failed:", conversionResult.error);
        return { success: false, error: "Erreur de conversion de devise" };
      }
    }

    const beneficiaryName = user.firstName && user.lastName 
      ? `${user.firstName} ${user.lastName}` 
      : "BKApay User";

    // Debit balance BEFORE API call
    await storage.updateUserBalance(userId, -feeInfo.totalDeductedFromBalance);

    // Create transaction BEFORE calling MbiyoPay API so it always appears in history
    const tx = await storage.createTransaction({
      userId: userId,
      type: "withdrawal",
      amount: grossAmount,
      fee: feeInfo.feeAmount,
      feePercentage: feeInfo.feePercentage,
      currency: balanceCurrency,
      status: "pending",
      country: country.toUpperCase(),
      operator: operator,
      description: `Retrait de ${grossAmount} ${balanceCurrency} (recu: ${amountForProvider} ${providerCurrency})`,
      customerPhone: phone,
      metadata: JSON.stringify({
        phone,
        deductedFromBalance: feeInfo.totalDeductedFromBalance,
        amountReceived: feeInfo.amountReceived,
        providerAmount: amountForProvider,
        providerCurrency: providerCurrency,
        balanceAmount: grossAmount,
        balanceCurrency: balanceCurrency,
        provider: "mbiyopay",
        paymentProvider: "mbiyopay",
        startTime: Date.now(),
      }),
    });

    const result = await createMbiyoPayPayout({
      amount: amountForProvider,
      currency: providerCurrency,
      phone: phone,
      countryCode: country,
      network: operator,
      orderId: `BKAPAY-WD-${Date.now()}`,
      callbackUrl: `${process.env.BASE_URL || "https://bkapay.com"}/api/webhooks/mbiyopay`,
      beneficiaryName,
    });

    if (!result.success) {
      // Refund balance and mark as failed
      await storage.updateUserBalance(userId, feeInfo.totalDeductedFromBalance);
      await storage.updateTransactionStatus(tx.id, "failed");
      return { success: false, transactionId: tx.id, error: result.error || "Retrait echoue" };
    }

    // Update transaction with MbiyoPay transaction ID
    const updatedMetadata = JSON.stringify({
      mbiyopayTransactionId: result.transactionId,
      phone,
      deductedFromBalance: feeInfo.totalDeductedFromBalance,
      amountReceived: feeInfo.amountReceived,
      providerAmount: amountForProvider,
      providerCurrency: providerCurrency,
      balanceAmount: grossAmount,
      balanceCurrency: balanceCurrency,
      provider: "mbiyopay",
      paymentProvider: "mbiyopay",
      startTime: Date.now(),
    });
    await storage.updateTransactionMetadata(tx.id, updatedMetadata);

    return {
      success: true,
      transactionId: tx.id,
      message: result.message || "Retrait initie avec succes",
    };
  } catch (error: any) {
    console.error("[MbiyoPay Withdrawal] Error:", error);
    return { success: false, error: "Retrait echoue" };
  }
}

export async function handleMbiyoPayTransfer(
  userId: string,
  user: any,
  amount: number,
  country: string,
  operator: string,
  phone: string,
  userCurrency?: string
): Promise<{ success: boolean; transactionId?: string; message?: string; error?: string }> {
  try {
    const countryLower = country.toLowerCase();
    if (!MBIYOPAY_SUPPORTED_COUNTRIES.includes(countryLower)) {
      return { success: false, error: "Transfert echoue" };
    }

    if (user.kycStatus !== "verified") {
      return { success: false, error: "Verification KYC requise" };
    }

    const netAmount = Math.floor(amount);
    const providerCurrency = getCurrencyForCountry(country);
    const balanceCurrency = userCurrency || providerCurrency;
    
    const feeConfig = await getFeeFromDatabase(storage, "mbiyopay", country, operator);
    const feeInfo = calculateOutgoingFee(netAmount, feeConfig.outgoing);
    const totalToDebit = netAmount + feeInfo.feeAmount;

    if (user.balance < totalToDebit) {
      return { success: false, error: "Solde insuffisant" };
    }

    let amountForProvider = netAmount;
    if (balanceCurrency !== providerCurrency) {
      const { convertCurrency } = await import("./currency-converter");
      const conversionResult = await convertCurrency(netAmount, balanceCurrency, providerCurrency);
      if (conversionResult.success) {
        amountForProvider = Math.floor(conversionResult.convertedAmount);
        console.log(`[MbiyoPay Transfer] Currency conversion: ${netAmount} ${balanceCurrency} -> ${amountForProvider} ${providerCurrency}`);
      } else {
        console.error("[MbiyoPay Transfer] Currency conversion failed:", conversionResult.error);
        return { success: false, error: "Erreur de conversion de devise" };
      }
    }

    const beneficiaryName = user.firstName && user.lastName 
      ? `${user.firstName} ${user.lastName}` 
      : "BKApay User";

    // Debit balance BEFORE API call
    await storage.updateUserBalance(userId, -totalToDebit);

    // Create transaction BEFORE calling MbiyoPay API so it always appears in history
    const tx = await storage.createTransaction({
      userId: userId,
      type: "transfer",
      amount: netAmount,
      fee: feeInfo.feeAmount,
      feePercentage: feeInfo.feePercentage,
      currency: balanceCurrency,
      status: "pending",
      country: country.toUpperCase(),
      operator: operator,
      description: `Transfert de ${netAmount} ${balanceCurrency} (envoye: ${amountForProvider} ${providerCurrency})`,
      customerPhone: phone,
      metadata: JSON.stringify({
        phone,
        totalDebited: totalToDebit,
        providerAmount: amountForProvider,
        providerCurrency: providerCurrency,
        balanceAmount: netAmount,
        balanceCurrency: balanceCurrency,
        provider: "mbiyopay",
        paymentProvider: "mbiyopay",
        startTime: Date.now(),
      }),
    });

    const result = await createMbiyoPayPayout({
      amount: amountForProvider,
      currency: providerCurrency,
      phone: phone,
      countryCode: country,
      network: operator,
      orderId: `BKAPAY-TF-${Date.now()}`,
      callbackUrl: `${process.env.BASE_URL || "https://bkapay.com"}/api/webhooks/mbiyopay`,
      beneficiaryName,
    });

    if (!result.success) {
      // Refund balance and mark as failed
      await storage.updateUserBalance(userId, totalToDebit);
      await storage.updateTransactionStatus(tx.id, "failed");
      const errorMsg = result.error ? result.error.replace("Retrait", "Transfert") : "Transfert echoue";
      return { success: false, transactionId: tx.id, error: errorMsg };
    }

    // Update transaction with MbiyoPay transaction ID
    const updatedMetadata = JSON.stringify({
      mbiyopayTransactionId: result.transactionId,
      phone,
      totalDebited: totalToDebit,
      providerAmount: amountForProvider,
      providerCurrency: providerCurrency,
      balanceAmount: netAmount,
      balanceCurrency: balanceCurrency,
      provider: "mbiyopay",
      paymentProvider: "mbiyopay",
      startTime: Date.now(),
    });
    await storage.updateTransactionMetadata(tx.id, updatedMetadata);

    return {
      success: true,
      transactionId: tx.id,
      message: result.message || "Transfert initie avec succes",
    };
  } catch (error: any) {
    console.error("[MbiyoPay Transfer] Error:", error);
    return { success: false, error: "Transfert echoue" };
  }
}

export async function handleMbiyoPayPaymentLink(
  paymentLink: any,
  customerPhone: string,
  customerName: string,
  customerEmail: string,
  operator: string,
  payerCountry: string,
  convertedAmount?: number,
  convertedCurrency?: string,
  ownerCurrency?: string
): Promise<{ success: boolean; transactionId?: string; mbiyopayTransactionId?: string; redirectUrl?: string; message?: string; error?: string }> {
  try {
    // Use payer's country for the payment provider
    const country = payerCountry || paymentLink.country || "BJ";
    const countryLower = country.toLowerCase();
    
    if (!MBIYOPAY_SUPPORTED_COUNTRIES.includes(countryLower)) {
      return { success: false, error: `Pays non supporte: ${country}` };
    }

    const customerPaysFee = paymentLink.customerPaysFee === true;
    const baseAmount = paymentLink.amount; // Original amount in owner's currency
    const balanceCurrency = ownerCurrency || "XOF";
    
    // Get dynamic fees from database for mbiyopay - calculate on base amount
    const feeConfig = await getFeeFromDatabase(storage, "mbiyopay", country, operator);
    const feeInfo = calculateIncomingFee(baseAmount, feeConfig.incoming);
    
    // Use converted amount for provider if available, otherwise use base amount
    const providerCurrency = convertedCurrency || getCurrencyForCountry(country);
    let providerAmount = convertedAmount ? Math.floor(convertedAmount) : baseAmount;
    
    // Apply customer pays fee on provider amount if needed
    if (customerPaysFee) {
      const feePercentage = feeConfig.incoming / 10; // Convert from decimal (60 = 6%)
      providerAmount = Math.ceil(providerAmount * (1 + feePercentage / 100));
    }

    // Create transaction BEFORE calling MbiyoPay API so it always appears in history
    const tx = await storage.createTransaction({
      userId: paymentLink.userId,
      type: "payment_link",
      amount: baseAmount,
      fee: feeInfo.feeAmount,
      feePercentage: feeInfo.feePercentage,
      currency: balanceCurrency,
      status: "pending",
      country: country.toUpperCase(),
      operator: operator,
      description: paymentLink.description || `Paiement via lien`,
      customerPhone: customerPhone,
      customerName: customerName,
      customerEmail: customerEmail,
      metadata: JSON.stringify({
        paymentLinkId: paymentLink.id,
        customerPaysFee,
        providerAmount,
        providerCurrency,
        balanceAmount: baseAmount,
        balanceCurrency,
        provider: "mbiyopay",
        paymentProvider: "mbiyopay",
        startTime: Date.now(),
      }),
    });

    const result = await createMbiyoPayPayin({
      amount: providerAmount,
      currency: providerCurrency,
      phone: customerPhone,
      countryCode: country,
      network: operator,
      orderId: `BKAPAY-PL-${paymentLink.id}-${Date.now()}`,
      callbackUrl: `${process.env.BASE_URL || "https://bkapay.com"}/api/webhooks/mbiyopay`,
    });

    if (!result.success) {
      await storage.updateTransactionStatus(tx.id, "failed");
      return { success: false, transactionId: tx.id, error: result.error || "Erreur lors du paiement" };
    }

    // Update transaction with MbiyoPay transaction ID
    const updatedMetadata = JSON.stringify({
      mbiyopayTransactionId: result.transactionId,
      redirectUrl: result.redirectUrl,
      paymentLinkId: paymentLink.id,
      customerPaysFee,
      providerAmount,
      providerCurrency,
      balanceAmount: baseAmount,
      balanceCurrency,
      provider: "mbiyopay",
      paymentProvider: "mbiyopay",
      startTime: Date.now(),
    });
    await storage.updateTransactionMetadata(tx.id, updatedMetadata);

    return {
      success: true,
      transactionId: tx.id,
      mbiyopayTransactionId: result.transactionId,
      redirectUrl: result.redirectUrl,
      message: result.message || "Paiement initie",
    };
  } catch (error: any) {
    console.error("[MbiyoPay PaymentLink] Error:", error);
    return { success: false, error: "Erreur lors du paiement" };
  }
}

export async function handleMbiyoPayMerchantLink(
  merchantLink: any,
  amount: number,
  customerPhone: string,
  customerName: string,
  customerEmail: string,
  operator: string,
  payerCountry: string,
  originalAmount?: number,
  originalCurrency?: string,
  payerCurrency?: string // Currency selected by payer (for multi-currency countries like RDC)
): Promise<{ success: boolean; transactionId?: string; mbiyopayTransactionId?: string; redirectUrl?: string; message?: string; error?: string }> {
  try {
    // Use payer's country for the payment provider
    const country = payerCountry || merchantLink.country || "BJ";
    const countryLower = country.toLowerCase();
    
    if (!MBIYOPAY_SUPPORTED_COUNTRIES.includes(countryLower)) {
      return { success: false, error: `Pays non supporte: ${country}` };
    }

    // Provider receives the converted amount in payer's currency
    // IMPORTANT: Use payerCurrency if provided (for multi-currency countries like RDC)
    const providerAmount = Math.floor(amount);
    const providerCurrency = payerCurrency || getCurrencyForCountry(country);
    
    // Balance operations use original amount in owner's currency
    const balanceAmount = originalAmount ? Math.floor(originalAmount) : providerAmount;
    const balanceCurrency = originalCurrency || providerCurrency;
    
    // Get dynamic fees for mbiyopay - calculate on balance amount
    const feeConfig = await getFeeFromDatabase(storage, "mbiyopay", country, operator);
    const feeInfo = calculateIncomingFee(balanceAmount, feeConfig.incoming);

    // Create transaction BEFORE calling MbiyoPay API so it always appears in history
    const tx = await storage.createTransaction({
      userId: merchantLink.userId,
      type: "merchant_link",
      amount: balanceAmount,
      fee: feeInfo.feeAmount,
      feePercentage: feeInfo.feePercentage,
      currency: balanceCurrency,
      status: "pending",
      country: country.toUpperCase(),
      operator: operator,
      description: merchantLink.description || `Paiement marchand`,
      customerPhone: customerPhone,
      customerName: customerName,
      customerEmail: customerEmail,
      metadata: JSON.stringify({
        merchantLinkId: merchantLink.id,
        providerAmount,
        providerCurrency,
        balanceAmount,
        balanceCurrency,
        provider: "mbiyopay",
        paymentProvider: "mbiyopay",
        startTime: Date.now(),
      }),
    });

    const result = await createMbiyoPayPayin({
      amount: providerAmount,
      currency: providerCurrency,
      phone: customerPhone,
      countryCode: country,
      network: operator,
      orderId: `BKAPAY-ML-${merchantLink.id}-${Date.now()}`,
      callbackUrl: `${process.env.BASE_URL || "https://bkapay.com"}/api/webhooks/mbiyopay`,
    });

    if (!result.success) {
      await storage.updateTransactionStatus(tx.id, "failed");
      return { success: false, transactionId: tx.id, error: result.error || "Erreur lors du paiement" };
    }

    const updatedMetadata = JSON.stringify({
      mbiyopayTransactionId: result.transactionId,
      redirectUrl: result.redirectUrl,
      merchantLinkId: merchantLink.id,
      providerAmount,
      providerCurrency,
      balanceAmount,
      balanceCurrency,
      provider: "mbiyopay",
      paymentProvider: "mbiyopay",
      startTime: Date.now(),
    });
    await storage.updateTransactionMetadata(tx.id, updatedMetadata);

    return {
      success: true,
      transactionId: tx.id,
      mbiyopayTransactionId: result.transactionId,
      redirectUrl: result.redirectUrl,
      message: result.message || "Paiement initie",
    };
  } catch (error: any) {
    console.error("[MbiyoPay MerchantLink] Error:", error);
    return { success: false, error: "Erreur lors du paiement" };
  }
}

export async function handleMbiyoPayApiPayment(
  apiKey: any,
  amount: number,
  customerPhone: string,
  customerName: string,
  customerEmail: string,
  operator: string,
  country: string,
  description?: string,
  callbackUrl?: string
): Promise<{ success: boolean; transactionId?: string; mbiyopayTransactionId?: string; redirectUrl?: string; message?: string; error?: string }> {
  try {
    const countryLower = country.toLowerCase();
    
    if (!MBIYOPAY_SUPPORTED_COUNTRIES.includes(countryLower)) {
      return { success: false, error: `Pays non supporte: ${country}` };
    }

    const grossAmount = Math.floor(amount);
    const currency = getCurrencyForCountry(country);
    
    // Get dynamic fees from database for mbiyopay
    const feeConfig = await getFeeFromDatabase(storage, "mbiyopay", country, operator);
    const feeInfo = calculateIncomingFee(grossAmount, feeConfig.incoming);

    // Create transaction BEFORE calling MbiyoPay API so it always appears in history
    const tx = await storage.createTransaction({
      userId: apiKey.userId,
      type: "api_payment",
      amount: grossAmount,
      fee: feeInfo.feeAmount,
      feePercentage: feeInfo.feePercentage,
      currency: currency,
      status: "pending",
      country: country.toUpperCase(),
      operator: operator,
      description: description || `Paiement API`,
      customerPhone: customerPhone,
      customerName: customerName,
      customerEmail: customerEmail,
      metadata: JSON.stringify({
        apiKeyId: apiKey.id,
        grossAmount,
        provider: "mbiyopay",
        paymentProvider: "mbiyopay",
        developerCallbackUrl: callbackUrl,
        startTime: Date.now(),
      }),
    });

    const result = await createMbiyoPayPayin({
      amount: grossAmount,
      currency: currency,
      phone: customerPhone,
      countryCode: country,
      network: operator,
      orderId: `BKAPAY-API-${apiKey.id}-${Date.now()}`,
      callbackUrl: `${process.env.BASE_URL || "https://bkapay.com"}/api/webhooks/mbiyopay`,
    });

    if (!result.success) {
      await storage.updateTransactionStatus(tx.id, "failed");
      return { success: false, transactionId: tx.id, error: result.error || "Erreur lors du paiement" };
    }

    const updatedMetadata = JSON.stringify({
      mbiyopayTransactionId: result.transactionId,
      redirectUrl: result.redirectUrl,
      apiKeyId: apiKey.id,
      grossAmount,
      provider: "mbiyopay",
      paymentProvider: "mbiyopay",
      developerCallbackUrl: callbackUrl,
      startTime: Date.now(),
    });
    await storage.updateTransactionMetadata(tx.id, updatedMetadata);

    return {
      success: true,
      transactionId: tx.id,
      mbiyopayTransactionId: result.transactionId,
      redirectUrl: result.redirectUrl,
      message: result.message || "Paiement initie",
    };
  } catch (error: any) {
    console.error("[MbiyoPay API Payment] Error:", error);
    return { success: false, error: "Erreur lors du paiement" };
  }
}

export async function handleMbiyoPayWebhook(req: Request, res: Response) {
  try {
    const payload = req.body;
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log("[MbiyoPay Webhook] Received:", { transaction_id: payload.transaction_id, status: payload.status, ip: clientIP });

    // Verify webhook signature using the secret configured in MbiyoPay dashboard
    const webhookSecret = process.env.MBIYOPAY_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = req.headers["x-webhook-secret"] || 
                       req.headers["x-webhook-signature"] || 
                       req.headers["x-signature"] || 
                       req.headers["signature"] ||
                       req.headers["secret"];
      if (!signature || signature !== webhookSecret) {
        console.error(`[SECURITY] MbiyoPay webhook invalid signature from IP: ${clientIP}, received: ${signature ? 'present but wrong' : 'missing'}`);
        return res.status(401).json({ error: "Invalid signature" });
      }
      console.log("[MbiyoPay Webhook] Signature verified successfully");
    } else {
      console.warn("[MbiyoPay Webhook] No MBIYOPAY_WEBHOOK_SECRET configured - skipping signature verification");
    }

    // MbiyoPay webhook format: { event, transaction_id, order_id, status, amount, ... }
    const { event, transaction_id, status } = payload;

    if (!transaction_id) {
      console.warn(`[SECURITY] MbiyoPay webhook without transaction_id from IP: ${clientIP}`);
      return res.status(400).json({ error: "Missing transaction_id" });
    }

    const pendingTransactions = await storage.getAllPendingTransactions();
    const tx = pendingTransactions.find((t: any) => {
      try {
        const metadata = JSON.parse(t.metadata || "{}");
        return metadata.mbiyopayTransactionId === transaction_id;
      } catch {
        return false;
      }
    });
    
    if (!tx) {
      console.warn(`[SECURITY] MbiyoPay webhook for unknown transaction from IP ${clientIP}: ${transaction_id}`);
      return res.status(404).json({ error: "Transaction not found" });
    }

    if (tx.status === "completed" || tx.status === "failed") {
      console.log(`[MbiyoPay Webhook] Transaction ${tx.id} already finalized: ${tx.status}`);
      return res.json({ success: true, message: "Already processed" });
    }

    // SECURITY: ALWAYS verify with MbiyoPay API before crediting - NEVER trust webhook status alone
    if (status === "successful") {
      console.log(`[SECURITY] Verifying payment with MbiyoPay API for transaction ${tx.id}...`);
      
      const apiVerification = await getMbiyoPayTransactionStatus(transaction_id);
      
      if (!apiVerification.success) {
        console.error(`[SECURITY] ⚠️ MbiyoPay API verification FAILED for transaction ${tx.id}`);
        console.error(`[SECURITY] Webhook claimed: successful, API error: ${apiVerification.error}, IP: ${clientIP}`);
        // Do NOT credit - let polling handle it if payment is real
        return res.json({ success: true, message: "Webhook received, verification pending" });
      }
      
      const apiStatus = (apiVerification.status || "").toLowerCase();
      const isVerified = apiStatus === "successful";
      
      if (!isVerified) {
        console.error(`[SECURITY] ⚠️ PAYMENT VERIFICATION FAILED for transaction ${tx.id}`);
        console.error(`[SECURITY] Webhook claimed: successful, but API returned: ${apiStatus}, IP: ${clientIP}`);
        // Do NOT credit - let polling handle it if payment becomes real
        return res.json({ success: true, message: "Webhook received, verification pending" });
      }
      
      console.log(`[SECURITY] ✅ Payment VERIFIED by MbiyoPay API for transaction ${tx.id}`);
      
      if (tx.type === "deposit" || tx.type === "payment_link" || tx.type === "merchant_link" || tx.type === "api_payment") {
        // Use atomic finalizeIncomingTransaction to prevent double-credit race with polling
        const result = await storage.finalizeIncomingTransaction(tx.id, {});
        if (result) {
          console.log(`[MbiyoPay Webhook] Deposit completed: ${tx.id}, credited=${result.credited}, netAmount=${result.transaction.amount - (result.transaction.fee || 0)}`);
        } else {
          console.log(`[MbiyoPay Webhook] Transaction ${tx.id} already processed by polling - skipping`);
        }
      } else if (tx.type === "withdrawal" || tx.type === "transfer") {
        await storage.updateTransactionStatus(tx.id, "completed");
        console.log(`[MbiyoPay Webhook] Withdrawal/Transfer completed: ${tx.id}`);
      }
    } else if (status === "failed" || status === "cancelled") {
      // For failed transactions, we can trust the webhook (no risk of fraud)
      if (tx.type === "withdrawal" || tx.type === "transfer") {
        const metadata = JSON.parse(tx.metadata || "{}");
        const refundAmount = metadata.deductedFromBalance || metadata.totalDebited || tx.amount;
        await storage.updateUserBalance(tx.userId, refundAmount);
        console.log(`[MbiyoPay Webhook] Refunding ${refundAmount} for failed ${tx.type}`);
      }
      await storage.updateTransactionStatus(tx.id, "failed");
      console.log(`[MbiyoPay Webhook] Transaction failed: ${tx.id}`);
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("[MbiyoPay Webhook] Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function pollMbiyoPayTransaction(transactionId: string): Promise<{ status: string; completed: boolean }> {
  try {
    const result = await getMbiyoPayTransactionStatus(transactionId);
    
    if (!result.success) {
      return { status: "pending", completed: false };
    }

    const apiStatus = result.status?.toLowerCase();
    
    if (apiStatus === "successful") {
      return { status: "completed", completed: true };
    } else if (apiStatus === "failed" || apiStatus === "cancelled") {
      return { status: "failed", completed: true };
    }

    return { status: "pending", completed: false };
  } catch (error) {
    console.error("[MbiyoPay Poll] Error:", error);
    return { status: "pending", completed: false };
  }
}

// Admin endpoint to resend webhook for stuck transactions
export async function handleMbiyoPayResendWebhook(req: Request, res: Response) {
  try {
    const { transactionId, mbiyopayTransactionId } = req.body;
    
    if (!mbiyopayTransactionId) {
      return res.status(400).json({ success: false, error: "ID transaction MbiyoPay requis" });
    }
    
    // Verify admin session
    const session = req.session as any;
    if (!session?.userId) {
      return res.status(401).json({ success: false, error: "Non authentifie" });
    }
    
    const user = await storage.getUser(session.userId);
    if (!user?.isAdmin) {
      return res.status(403).json({ success: false, error: "Acces refuse" });
    }
    
    console.log(`[MbiyoPay] Admin ${user.email} requesting webhook resend for: ${mbiyopayTransactionId}`);
    
    const result = await resendMbiyoPayWebhook(mbiyopayTransactionId);
    
    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error: any) {
    console.error("[MbiyoPay Resend Webhook] Error:", error);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
}
