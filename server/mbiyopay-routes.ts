import type { Request, Response } from "express";
import { storage } from "./storage";
import { randomUUID } from "crypto";
import { calculateIncomingFee, calculateOutgoingFee, getFeeFromDatabase } from "./utils/fees";
import { 
  createMbiyoPayPayin, 
  createMbiyoPayPayout, 
  getMbiyoPayTransactionStatus,
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
): Promise<{ success: boolean; transactionId?: string; mbiyopayTransactionId?: string; redirectUrl?: string; message?: string; error?: string }> {
  try {
    const countryLower = country.toLowerCase();
    if (!MBIYOPAY_SUPPORTED_COUNTRIES.includes(countryLower)) {
      return { success: false, error: `Pays non supporte pour les depots via MbiyoPay: ${country}` };
    }

    const countryOperators = MBIYOPAY_OPERATORS[countryLower] || [];
    if (!countryOperators.includes(operator.toLowerCase())) {
      return { success: false, error: `Operateur ${operator} non supporte pour ${country}` };
    }

    // Provider gets the converted amount, balance uses original amount
    const providerAmount = Math.floor(amount);
    const providerCurrency = currency || getCurrencyForCountry(country);
    const balanceAmount = originalAmount ? Math.floor(originalAmount) : providerAmount;
    const userCurrency = originalCurrency || providerCurrency;
    
    // Get dynamic fees from database - calculate fees on the balance amount
    const feeConfig = await getFeeFromDatabase(storage, country, operator);
    const feeInfo = calculateIncomingFee(balanceAmount, feeConfig.incoming);

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
      return { success: false, error: result.error || "Erreur lors du depot" };
    }

    const transactionId = randomUUID();
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
        mbiyopayTransactionId: result.transactionId,
        redirectUrl: result.redirectUrl,
        phone,
        provider: "mbiyopay",
        providerAmount,
        providerCurrency,
        balanceAmount,
        balanceCurrency: userCurrency,
      }),
    });

    return {
      success: true,
      transactionId: tx.id,
      mbiyopayTransactionId: result.transactionId,
      redirectUrl: result.redirectUrl,
      message: result.message || "Paiement initie. Veuillez valider sur votre telephone.",
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
  phone: string
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
    const feeInfo = calculateOutgoingFee(grossAmount);
    const currency = getCurrencyForCountry(country);

    if (user.balance < feeInfo.totalDeductedFromBalance) {
      return { success: false, error: "Solde insuffisant" };
    }

    const beneficiaryName = user.firstName && user.lastName 
      ? `${user.firstName} ${user.lastName}` 
      : user.email || "BKApay User";
    
    const result = await createMbiyoPayPayout({
      amount: feeInfo.amountReceived,
      currency: currency,
      phone: phone,
      countryCode: country,
      network: operator,
      orderId: `BKAPAY-WD-${Date.now()}`,
      callbackUrl: `${process.env.BASE_URL || "https://bkapay.com"}/api/webhooks/mbiyopay`,
      beneficiaryName,
    });

    if (!result.success) {
      return { success: false, error: result.error || "Retrait echoue" };
    }

    await storage.updateUserBalance(userId, -feeInfo.totalDeductedFromBalance);

    const tx = await storage.createTransaction({
      userId: userId,
      type: "withdrawal",
      amount: grossAmount,
      fee: feeInfo.feeAmount,
      feePercentage: feeInfo.feePercentage,
      currency: currency,
      status: "pending",
      country: country.toUpperCase(),
      operator: operator,
      description: `Retrait de ${grossAmount} ${currency} (recu: ${feeInfo.amountReceived} ${currency})`,
      customerPhone: phone,
      metadata: JSON.stringify({
        mbiyopayTransactionId: result.transactionId,
        phone,
        deductedFromBalance: feeInfo.totalDeductedFromBalance,
        amountReceived: feeInfo.amountReceived,
        provider: "mbiyopay",
      }),
    });

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
  phone: string
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
    const feeInfo = calculateOutgoingFee(netAmount);
    const currency = getCurrencyForCountry(country);
    const totalToDebit = netAmount + feeInfo.feeAmount;

    if (user.balance < totalToDebit) {
      return { success: false, error: "Solde insuffisant" };
    }

    const beneficiaryName = user.firstName && user.lastName 
      ? `${user.firstName} ${user.lastName}` 
      : user.email || "BKApay User";
    
    const result = await createMbiyoPayPayout({
      amount: netAmount,
      currency: currency,
      phone: phone,
      countryCode: country,
      network: operator,
      orderId: `BKAPAY-TF-${Date.now()}`,
      callbackUrl: `${process.env.BASE_URL || "https://bkapay.com"}/api/webhooks/mbiyopay`,
      beneficiaryName,
    });

    if (!result.success) {
      return { success: false, error: result.error || "Transfert echoue" };
    }

    await storage.updateUserBalance(userId, -totalToDebit);

    const tx = await storage.createTransaction({
      userId: userId,
      type: "transfer",
      amount: netAmount,
      fee: feeInfo.feeAmount,
      feePercentage: feeInfo.feePercentage,
      currency: currency,
      status: "pending",
      country: country.toUpperCase(),
      operator: operator,
      description: `Transfert de ${netAmount} ${currency}`,
      customerPhone: phone,
      metadata: JSON.stringify({
        mbiyopayTransactionId: result.transactionId,
        phone,
        totalDebited: totalToDebit,
        provider: "mbiyopay",
      }),
    });

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
    
    // Get dynamic fees from database - calculate on base amount
    const feeConfig = await getFeeFromDatabase(storage, country, operator);
    const feeInfo = calculateIncomingFee(baseAmount, feeConfig.incoming);
    
    // Use converted amount for provider if available, otherwise use base amount
    const providerCurrency = convertedCurrency || getCurrencyForCountry(country);
    let providerAmount = convertedAmount ? Math.floor(convertedAmount) : baseAmount;
    
    // Apply customer pays fee on provider amount if needed
    if (customerPaysFee) {
      const feePercentage = feeConfig.incoming / 10; // Convert from decimal (60 = 6%)
      providerAmount = Math.ceil(providerAmount * (1 + feePercentage / 100));
    }

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
      return { success: false, error: result.error || "Erreur lors du paiement" };
    }

    // Store transaction with owner's currency for balance credit
    const tx = await storage.createTransaction({
      userId: paymentLink.userId,
      type: "payment_link",
      amount: baseAmount, // Store base amount for balance credit
      fee: feeInfo.feeAmount,
      feePercentage: feeInfo.feePercentage,
      currency: balanceCurrency, // Owner's currency
      status: "pending",
      country: country.toUpperCase(),
      operator: operator,
      description: paymentLink.description || `Paiement via lien`,
      customerPhone: customerPhone,
      customerName: customerName,
      customerEmail: customerEmail,
      metadata: JSON.stringify({
        mbiyopayTransactionId: result.transactionId,
        redirectUrl: result.redirectUrl,
        paymentLinkId: paymentLink.id,
        customerPaysFee,
        providerAmount,
        providerCurrency,
        balanceAmount: baseAmount,
        balanceCurrency,
        provider: "mbiyopay",
      }),
    });

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
  originalCurrency?: string
): Promise<{ success: boolean; transactionId?: string; mbiyopayTransactionId?: string; redirectUrl?: string; message?: string; error?: string }> {
  try {
    // Use payer's country for the payment provider
    const country = payerCountry || merchantLink.country || "BJ";
    const countryLower = country.toLowerCase();
    
    if (!MBIYOPAY_SUPPORTED_COUNTRIES.includes(countryLower)) {
      return { success: false, error: `Pays non supporte: ${country}` };
    }

    // Provider receives the converted amount in payer's currency
    const providerAmount = Math.floor(amount);
    const providerCurrency = getCurrencyForCountry(country);
    
    // Balance operations use original amount in owner's currency
    const balanceAmount = originalAmount ? Math.floor(originalAmount) : providerAmount;
    const balanceCurrency = originalCurrency || providerCurrency;
    
    // Get dynamic fees - calculate on balance amount
    const feeConfig = await getFeeFromDatabase(storage, country, operator);
    const feeInfo = calculateIncomingFee(balanceAmount, feeConfig.incoming);

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
      return { success: false, error: result.error || "Erreur lors du paiement" };
    }

    // Store transaction with owner's currency for balance credit
    const tx = await storage.createTransaction({
      userId: merchantLink.userId,
      type: "merchant_link",
      amount: balanceAmount, // Store balance amount for credit
      fee: feeInfo.feeAmount,
      feePercentage: feeInfo.feePercentage,
      currency: balanceCurrency, // Owner's currency
      status: "pending",
      country: country.toUpperCase(),
      operator: operator,
      description: merchantLink.description || `Paiement marchand`,
      customerPhone: customerPhone,
      customerName: customerName,
      customerEmail: customerEmail,
      metadata: JSON.stringify({
        mbiyopayTransactionId: result.transactionId,
        redirectUrl: result.redirectUrl,
        merchantLinkId: merchantLink.id,
        providerAmount,
        providerCurrency,
        balanceAmount,
        balanceCurrency,
        provider: "mbiyopay",
      }),
    });

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
    const feeInfo = calculateIncomingFee(grossAmount);
    const currency = getCurrencyForCountry(country);

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
      return { success: false, error: result.error || "Erreur lors du paiement" };
    }

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
        mbiyopayTransactionId: result.transactionId,
        redirectUrl: result.redirectUrl,
        apiKeyId: apiKey.id,
        grossAmount,
        provider: "mbiyopay",
        developerCallbackUrl: callbackUrl,
      }),
    });

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
    console.log("[MbiyoPay Webhook] Received:", JSON.stringify(payload));

    // Verify webhook signature if secret is configured
    const webhookSecret = process.env.MBIYOPAY_WEBHOOK_SECRET;
    if (webhookSecret) {
      // MbiyoPay may send signature in various headers
      const signature = req.headers["x-webhook-signature"] || 
                       req.headers["x-webhook-secret"] || 
                       req.headers["x-signature"] || 
                       req.headers["signature"] ||
                       req.headers["authorization"]?.replace("Bearer ", "");
      if (signature !== webhookSecret) {
        console.error("[MbiyoPay Webhook] Invalid signature, received:", signature);
        return res.status(401).json({ error: "Invalid signature" });
      }
      console.log("[MbiyoPay Webhook] Signature verified");
    }

    // MbiyoPay webhook format: { event, transaction_id, order_id, status, amount, ... }
    const { event, transaction_id, status } = payload;

    if (!transaction_id) {
      console.error("[MbiyoPay Webhook] Missing transaction_id");
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
      console.error(`[MbiyoPay Webhook] Transaction not found: ${transaction_id}`);
      return res.status(404).json({ error: "Transaction not found" });
    }

    if (tx.status === "completed" || tx.status === "failed") {
      console.log(`[MbiyoPay Webhook] Transaction ${tx.id} already finalized: ${tx.status}`);
      return res.json({ success: true, message: "Already processed" });
    }

    if (status === "successful") {
      if (tx.type === "deposit" || tx.type === "payment_link" || tx.type === "merchant_link" || tx.type === "api_payment") {
        const netAmount = tx.amount - tx.fee;
        await storage.updateUserBalance(tx.userId, netAmount);
        await storage.updateTransactionStatus(tx.id, "completed");
        console.log(`[MbiyoPay Webhook] Deposit completed: ${tx.id}, credited ${netAmount}`);
      } else if (tx.type === "withdrawal" || tx.type === "transfer") {
        await storage.updateTransactionStatus(tx.id, "completed");
        console.log(`[MbiyoPay Webhook] Withdrawal/Transfer completed: ${tx.id}`);
      }
    } else if (status === "failed" || status === "cancelled") {
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

    const status = result.status?.toLowerCase();
    
    if (status === "successful") {
      return { status: "completed", completed: true };
    } else if (status === "failed" || status === "cancelled") {
      return { status: "failed", completed: true };
    }

    return { status: "pending", completed: false };
  } catch (error) {
    console.error("[MbiyoPay Poll] Error:", error);
    return { status: "pending", completed: false };
  }
}
