import { Router, Request, Response } from "express";
import { storage } from "./storage";
import { randomUUID } from "crypto";
import { calculateIncomingFee, calculateOutgoingFee, getFeeFromDatabase } from "./utils/fees";
import { sendPaymentDocumentsEmail } from "./email-service";
import {
  createAfribaPayPayin,
  createAfribaPayPayout,
  getAfribaPayTransaction,
  verifyAfribaPayPayment,
  operatorRequiresOtp,
  getOtpInstructions,
  mapAfribaPayStatus,
  getAfribaPayConfig,
  translateAfribaPayError,
} from "./afribapay";
import { AFRIBAPAY_COUNTRIES, getCurrencyForCountry, getPaymentInstructions } from "@shared/afribapay-countries";

const router = Router();

export async function handleAfribaPayDeposit(
  userId: string,
  user: any,
  amount: number,
  country: string,
  operator: string,
  phone: string,
  otpCode?: string,
  currency?: string,
  originalAmount?: number,
  originalCurrency?: string
): Promise<{ 
  success: boolean; 
  transactionId?: string; 
  afribaPayTransactionId?: string; 
  providerLink?: string;
  message?: string; 
  error?: string; 
  requiresOtp?: boolean;
  otpInstructions?: string;
}> {
  try {
    const countryCode = country.toUpperCase();
    const countryConfig = AFRIBAPAY_COUNTRIES.find(c => c.code === countryCode);
    if (!countryConfig) {
      return { success: false, error: `Pays non supporte pour AfribaPay: ${country}` };
    }

    const operatorConfig = countryConfig.operators.find(op => op.code === operator.toLowerCase() && op.payin);
    if (!operatorConfig) {
      return { success: false, error: `Operateur ${operator} non supporte pour ${country}` };
    }

    const instructions = getPaymentInstructions(countryCode, operator);
    if (instructions.requiresOtp && !otpCode) {
      return {
        success: false,
        error: "Code OTP requis pour ce paiement",
        requiresOtp: true,
        otpInstructions: instructions.otpInstructions || undefined,
      };
    }

    const providerAmount = Math.floor(amount);
    const providerCurrency = currency || getCurrencyForCountry(countryCode);
    const balanceAmount = originalAmount ? Math.floor(originalAmount) : providerAmount;
    const userCurrency = originalCurrency || providerCurrency;

    const feeConfig = await getFeeFromDatabase(storage, "afribapay", country, operator);
    const feeInfo = calculateIncomingFee(balanceAmount, feeConfig.incoming);

    const baseUrl = process.env.BASE_URL || "https://bkapay.com";
    const orderId = `BKAPAY-DEP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const result = await createAfribaPayPayin({
      amount: providerAmount,
      currency: providerCurrency,
      phone: phone,
      countryCode: countryCode,
      operator: operator,
      otpCode: otpCode,
      orderId: orderId,
      referenceId: `BKApay Deposit`,
      notifyUrl: `${baseUrl}/api/afribapay/webhook`,
      returnUrl: `${baseUrl}/dashboard`,
      cancelUrl: `${baseUrl}/dashboard`,
    });

    if (!result.success) {
      return { success: false, error: result.error || "Erreur lors du depot" };
    }

    const tx = await storage.createTransaction({
      userId: userId,
      type: "deposit",
      amount: feeInfo.grossAmount,
      fee: feeInfo.feeAmount,
      feePercentage: feeInfo.feePercentage,
      currency: userCurrency,
      status: "pending",
      country: countryCode,
      operator: operator,
      description: `Depot de ${providerAmount} ${providerCurrency}`,
      customerPhone: phone,
      metadata: JSON.stringify({
        afribaPayTransactionId: result.transactionId,
        afribaPayOrderId: result.orderId,
        providerLink: result.providerLink,
        phone,
        provider: "afribapay",
        providerAmount,
        providerCurrency,
        netAmountForUser: feeInfo.netAmount,
        balanceAmount: feeInfo.netAmount,
        balanceCurrency: userCurrency,
      }),
    });

    return {
      success: true,
      transactionId: tx.id,
      afribaPayTransactionId: result.transactionId,
      providerLink: result.providerLink,
      message: result.message || "Paiement initie avec succes",
    };
  } catch (error: any) {
    console.error("[AfribaPay Deposit] Error:", error);
    return { success: false, error: "Erreur lors du depot" };
  }
}

export async function handleAfribaPayWithdrawal(
  userId: string,
  user: any,
  amount: number,
  country: string,
  operator: string,
  phone: string,
  userCurrency?: string
): Promise<{ success: boolean; transactionId?: string; message?: string; error?: string }> {
  try {
    const countryCode = country.toUpperCase();
    const countryConfig = AFRIBAPAY_COUNTRIES.find(c => c.code === countryCode);
    if (!countryConfig) {
      return { success: false, error: "Retrait echoue" };
    }

    const operatorConfig = countryConfig.operators.find(op => op.code === operator.toLowerCase() && op.payout);
    if (!operatorConfig) {
      return { success: false, error: "Retrait echoue" };
    }

    if (user.kycStatus !== "verified") {
      return { success: false, error: "Verification KYC requise" };
    }

    const grossAmount = Math.floor(amount);
    const providerCurrency = getCurrencyForCountry(countryCode);
    const balanceCurrency = userCurrency || providerCurrency;

    const feeConfig = await getFeeFromDatabase(storage, "afribapay", country, operator);
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
      } else {
        return { success: false, error: "Erreur de conversion de devise" };
      }
    }

    const orderId = `BKAPAY-WD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const baseUrl = process.env.BASE_URL || "https://bkapay.com";

    const result = await createAfribaPayPayout({
      amount: amountForProvider,
      currency: providerCurrency,
      phone: phone,
      countryCode: countryCode,
      operator: operator,
      orderId: orderId,
      referenceId: `BKApay Withdrawal`,
      notifyUrl: `${baseUrl}/api/afribapay/webhook`,
    });

    if (!result.success) {
      return { success: false, error: translateAfribaPayError(result.error, "withdrawal") };
    }

    await storage.updateUserBalance(userId, -feeInfo.totalDeductedFromBalance);

    const tx = await storage.createTransaction({
      userId: userId,
      type: "withdrawal",
      amount: feeInfo.totalDeductedFromBalance,
      fee: feeInfo.feeAmount,
      feePercentage: feeInfo.feePercentage,
      currency: balanceCurrency,
      status: "pending",
      country: countryCode,
      operator: operator,
      description: `Retrait de ${amountForProvider} ${providerCurrency}`,
      customerPhone: phone,
      metadata: JSON.stringify({
        afribaPayTransactionId: result.transactionId,
        afribaPayOrderId: result.orderId,
        phone,
        provider: "afribapay",
        providerAmount: amountForProvider,
        providerCurrency,
        balanceAmount: feeInfo.totalDeductedFromBalance,
        balanceCurrency,
        deductedFromBalance: feeInfo.totalDeductedFromBalance,
        totalDebited: feeInfo.totalDeductedFromBalance,
      }),
    });

    return {
      success: true,
      transactionId: tx.id,
      message: "Retrait en cours de traitement",
    };
  } catch (error: any) {
    console.error("[AfribaPay Withdrawal] Error:", error);
    return { success: false, error: "Le retrait n'a pas abouti. Votre solde n'a pas ete debite. Veuillez reessayer ou contacter le support." };
  }
}

export async function handleAfribaPayTransfer(
  userId: string,
  user: any,
  amount: number,
  country: string,
  operator: string,
  phone: string,
  userCurrency?: string
): Promise<{ success: boolean; transactionId?: string; message?: string; error?: string }> {
  try {
    const countryCode = country.toUpperCase();
    const countryConfig = AFRIBAPAY_COUNTRIES.find(c => c.code === countryCode);
    if (!countryConfig) {
      return { success: false, error: "Transfert echoue" };
    }

    const operatorConfig = countryConfig.operators.find(op => op.code === operator.toLowerCase() && op.payout);
    if (!operatorConfig) {
      return { success: false, error: "Transfert echoue" };
    }

    if (user.kycStatus !== "verified") {
      return { success: false, error: "Verification KYC requise" };
    }

    const netAmount = Math.floor(amount);
    const providerCurrency = getCurrencyForCountry(countryCode);
    const balanceCurrency = userCurrency || providerCurrency;

    const feeConfig = await getFeeFromDatabase(storage, "afribapay", country, operator);
    const feePercentage = feeConfig.outgoing;
    const feeAmount = Math.ceil(netAmount * (feePercentage / 100));
    const totalDeducted = netAmount + feeAmount;

    if (user.balance < totalDeducted) {
      return { success: false, error: "Solde insuffisant" };
    }

    let amountForProvider = netAmount;
    if (balanceCurrency !== providerCurrency) {
      const { convertCurrency } = await import("./currency-converter");
      const conversionResult = await convertCurrency(netAmount, balanceCurrency, providerCurrency);
      if (conversionResult.success) {
        amountForProvider = Math.floor(conversionResult.convertedAmount);
      } else {
        return { success: false, error: "Erreur de conversion de devise" };
      }
    }

    const orderId = `BKAPAY-TF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const baseUrl = process.env.BASE_URL || "https://bkapay.com";

    const result = await createAfribaPayPayout({
      amount: amountForProvider,
      currency: providerCurrency,
      phone: phone,
      countryCode: countryCode,
      operator: operator,
      orderId: orderId,
      referenceId: `BKApay Transfer`,
      notifyUrl: `${baseUrl}/api/afribapay/webhook`,
    });

    if (!result.success) {
      return { success: false, error: translateAfribaPayError(result.error, "transfer") };
    }

    await storage.updateUserBalance(userId, -totalDeducted);

    const tx = await storage.createTransaction({
      userId: userId,
      type: "transfer",
      amount: totalDeducted,
      fee: feeAmount,
      feePercentage: feePercentage,
      currency: balanceCurrency,
      status: "pending",
      country: countryCode,
      operator: operator,
      description: `Transfert de ${amountForProvider} ${providerCurrency}`,
      customerPhone: phone,
      metadata: JSON.stringify({
        afribaPayTransactionId: result.transactionId,
        afribaPayOrderId: result.orderId,
        phone,
        provider: "afribapay",
        providerAmount: amountForProvider,
        providerCurrency,
        balanceAmount: totalDeducted,
        balanceCurrency,
        deductedFromBalance: totalDeducted,
        totalDebited: totalDeducted,
      }),
    });

    return {
      success: true,
      transactionId: tx.id,
      message: "Transfert en cours de traitement",
    };
  } catch (error: any) {
    console.error("[AfribaPay Transfer] Error:", error);
    return { success: false, error: "Le transfert n'a pas abouti. Votre solde n'a pas ete debite. Veuillez reessayer ou contacter le support." };
  }
}

export async function handleAfribaPayPaymentLink(
  paymentLink: any,
  amount: number,
  phone: string,
  country: string,
  operator: string,
  otpCode?: string,
  customerName?: string,
  customerEmail?: string
): Promise<{ 
  success: boolean; 
  transactionId?: string; 
  providerLink?: string;
  message?: string; 
  error?: string;
  requiresOtp?: boolean;
  otpInstructions?: string;
}> {
  try {
    const countryCode = country.toUpperCase();
    const owner = await storage.getUser(paymentLink.userId);
    if (!owner) {
      return { success: false, error: "Proprietaire du lien non trouve" };
    }

    const instructions = getPaymentInstructions(countryCode, operator);
    if (instructions.requiresOtp && !otpCode) {
      return {
        success: false,
        error: "Code OTP requis",
        requiresOtp: true,
        otpInstructions: instructions.otpInstructions || undefined,
      };
    }

    const providerCurrency = getCurrencyForCountry(countryCode);
    const ownerCurrency = owner.country ? getCurrencyForCountry(owner.country) : "XOF";

    let balanceAmount = amount;
    if (providerCurrency !== ownerCurrency) {
      const { convertCurrency } = await import("./currency-converter");
      const conversionResult = await convertCurrency(amount, providerCurrency, ownerCurrency);
      if (conversionResult.success) {
        balanceAmount = Math.floor(conversionResult.convertedAmount);
      }
    }

    const feeConfig = await getFeeFromDatabase(storage, "afribapay", country, operator);
    const feeInfo = calculateIncomingFee(balanceAmount, feeConfig.incoming);

    const baseUrl = process.env.BASE_URL || "https://bkapay.com";
    const orderId = `BKAPAY-PL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const result = await createAfribaPayPayin({
      amount: Math.floor(amount),
      currency: providerCurrency,
      phone: phone,
      countryCode: countryCode,
      operator: operator,
      otpCode: otpCode,
      orderId: orderId,
      referenceId: paymentLink.description || "Payment Link",
      notifyUrl: `${baseUrl}/api/afribapay/webhook`,
      returnUrl: `${baseUrl}/payment-success`,
      cancelUrl: `${baseUrl}/pay/${paymentLink.token}`,
    });

    if (!result.success) {
      return { success: false, error: result.error || "Erreur lors du paiement" };
    }

    const tx = await storage.createTransaction({
      userId: paymentLink.userId,
      type: "payment_link",
      amount: feeInfo.grossAmount,
      fee: feeInfo.feeAmount,
      feePercentage: feeInfo.feePercentage,
      currency: ownerCurrency,
      status: "pending",
      country: countryCode,
      operator: operator,
      description: paymentLink.description || "Paiement via lien",
      customerName: customerName || null,
      customerEmail: customerEmail || null,
      customerPhone: phone,
      metadata: JSON.stringify({
        afribaPayTransactionId: result.transactionId,
        afribaPayOrderId: result.orderId,
        providerLink: result.providerLink,
        paymentLinkId: paymentLink.id,
        provider: "afribapay",
        netAmountForUser: feeInfo.netAmount,
        providerAmount: amount,
        providerCurrency,
        balanceAmount: feeInfo.netAmount,
        balanceCurrency: ownerCurrency,
      }),
    });

    return {
      success: true,
      transactionId: tx.id,
      providerLink: result.providerLink,
      message: result.message || "Paiement initie avec succes",
    };
  } catch (error: any) {
    console.error("[AfribaPay PaymentLink] Error:", error);
    return { success: false, error: "Erreur lors du paiement" };
  }
}

export async function handleAfribaPayMerchantLink(
  merchantLink: any,
  amount: number,
  phone: string,
  country: string,
  operator: string,
  otpCode?: string,
  customerName?: string,
  customerEmail?: string
): Promise<{ 
  success: boolean; 
  transactionId?: string; 
  providerLink?: string;
  message?: string; 
  error?: string;
  requiresOtp?: boolean;
  otpInstructions?: string;
}> {
  try {
    const countryCode = country.toUpperCase();
    const owner = await storage.getUser(merchantLink.userId);
    if (!owner) {
      return { success: false, error: "Proprietaire du lien non trouve" };
    }

    const instructions = getPaymentInstructions(countryCode, operator);
    if (instructions.requiresOtp && !otpCode) {
      return {
        success: false,
        error: "Code OTP requis",
        requiresOtp: true,
        otpInstructions: instructions.otpInstructions || undefined,
      };
    }

    const providerCurrency = getCurrencyForCountry(countryCode);
    const ownerCurrency = owner.country ? getCurrencyForCountry(owner.country) : "XOF";

    let balanceAmount = amount;
    if (providerCurrency !== ownerCurrency) {
      const { convertCurrency } = await import("./currency-converter");
      const conversionResult = await convertCurrency(amount, providerCurrency, ownerCurrency);
      if (conversionResult.success) {
        balanceAmount = Math.floor(conversionResult.convertedAmount);
      }
    }

    const feeConfig = await getFeeFromDatabase(storage, "afribapay", country, operator);
    const feeInfo = calculateIncomingFee(balanceAmount, feeConfig.incoming);

    const baseUrl = process.env.BASE_URL || "https://bkapay.com";
    const orderId = `BKAPAY-ML-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const result = await createAfribaPayPayin({
      amount: Math.floor(amount),
      currency: providerCurrency,
      phone: phone,
      countryCode: countryCode,
      operator: operator,
      otpCode: otpCode,
      orderId: orderId,
      referenceId: merchantLink.merchantName || "Merchant Payment",
      notifyUrl: `${baseUrl}/api/afribapay/webhook`,
      returnUrl: `${baseUrl}/payment-success`,
      cancelUrl: `${baseUrl}/merchant/${merchantLink.token}`,
    });

    if (!result.success) {
      return { success: false, error: result.error || "Erreur lors du paiement" };
    }

    const tx = await storage.createTransaction({
      userId: merchantLink.userId,
      type: "merchant_link",
      amount: feeInfo.grossAmount,
      fee: feeInfo.feeAmount,
      feePercentage: feeInfo.feePercentage,
      currency: ownerCurrency,
      status: "pending",
      country: countryCode,
      operator: operator,
      description: `Paiement ${merchantLink.merchantName}`,
      customerName: customerName || null,
      customerEmail: customerEmail || null,
      customerPhone: phone,
      metadata: JSON.stringify({
        afribaPayTransactionId: result.transactionId,
        afribaPayOrderId: result.orderId,
        providerLink: result.providerLink,
        merchantLinkId: merchantLink.id,
        provider: "afribapay",
        netAmountForUser: feeInfo.netAmount,
        providerAmount: amount,
        providerCurrency,
        balanceAmount: feeInfo.netAmount,
        balanceCurrency: ownerCurrency,
      }),
    });

    return {
      success: true,
      transactionId: tx.id,
      providerLink: result.providerLink,
      message: result.message || "Paiement initie avec succes",
    };
  } catch (error: any) {
    console.error("[AfribaPay MerchantLink] Error:", error);
    return { success: false, error: "Erreur lors du paiement" };
  }
}

export async function handleAfribaPayApiPayment(
  apiKey: any,
  amount: number,
  description: string,
  customerName: string,
  customerEmail: string,
  customerPhone: string,
  country: string,
  operator: string,
  otpCode?: string
): Promise<{ 
  success: boolean; 
  transactionId?: string; 
  afribaPayTransactionId?: string;
  providerLink?: string;
  message?: string; 
  error?: string;
  requiresOtp?: boolean;
  otpInstructions?: string;
}> {
  try {
    const countryCode = country.toUpperCase();
    const owner = await storage.getUser(apiKey.userId);
    if (!owner) {
      return { success: false, error: "Proprietaire non trouve" };
    }

    const instructions = getPaymentInstructions(countryCode, operator);
    if (instructions.requiresOtp && !otpCode) {
      return {
        success: false,
        error: "Code OTP requis",
        requiresOtp: true,
        otpInstructions: instructions.otpInstructions || undefined,
      };
    }

    const providerCurrency = getCurrencyForCountry(countryCode);
    const ownerCurrency = owner.country ? getCurrencyForCountry(owner.country) : "XOF";

    let balanceAmount = amount;
    if (providerCurrency !== ownerCurrency) {
      const { convertCurrency } = await import("./currency-converter");
      const conversionResult = await convertCurrency(amount, providerCurrency, ownerCurrency);
      if (conversionResult.success) {
        balanceAmount = Math.floor(conversionResult.convertedAmount);
      }
    }

    const feeConfig = await getFeeFromDatabase(storage, "afribapay", country, operator);
    const feeInfo = calculateIncomingFee(balanceAmount, feeConfig.incoming);

    const baseUrl = process.env.BASE_URL || "https://bkapay.com";
    const orderId = `BKAPAY-API-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const result = await createAfribaPayPayin({
      amount: Math.floor(amount),
      currency: providerCurrency,
      phone: customerPhone,
      countryCode: countryCode,
      operator: operator,
      otpCode: otpCode,
      orderId: orderId,
      referenceId: description || "API Payment",
      notifyUrl: `${baseUrl}/api/afribapay/webhook`,
      returnUrl: `${baseUrl}/payment-success`,
      cancelUrl: `${baseUrl}/payment-failed`,
    });

    if (!result.success) {
      return { success: false, error: result.error || "Erreur lors du paiement" };
    }

    const tx = await storage.createTransaction({
      userId: apiKey.userId,
      type: "api_payment",
      amount: feeInfo.grossAmount,
      fee: feeInfo.feeAmount,
      feePercentage: feeInfo.feePercentage,
      currency: ownerCurrency,
      status: "pending",
      country: countryCode,
      operator: operator,
      description: description || "Paiement via API",
      customerPhone: customerPhone,
      customerName: customerName,
      customerEmail: customerEmail || null,
      metadata: JSON.stringify({
        afribaPayTransactionId: result.transactionId,
        afribaPayOrderId: result.orderId,
        providerLink: result.providerLink,
        apiKeyId: apiKey.id,
        provider: "afribapay",
        netAmountForUser: feeInfo.netAmount,
        providerAmount: amount,
        providerCurrency,
        balanceAmount: feeInfo.netAmount,
        balanceCurrency: ownerCurrency,
      }),
    });

    return {
      success: true,
      transactionId: tx.id,
      afribaPayTransactionId: result.transactionId,
      providerLink: result.providerLink,
      message: result.message || "Paiement initie avec succes",
    };
  } catch (error: any) {
    console.error("[AfribaPay API Payment] Error:", error);
    return { success: false, error: "Erreur lors du paiement" };
  }
}

router.post("/webhook", async (req: Request, res: Response) => {
  try {
    console.log("[AfribaPay Webhook] Received:", JSON.stringify(req.body));

    const payload = req.body?.data || req.body;
    const { transaction_id, status } = payload;

    if (!transaction_id) {
      console.log("[AfribaPay Webhook] Missing transaction_id");
      return res.status(400).json({ error: "Missing transaction_id" });
    }

    const tx = await storage.getTransactionByAfribaPayId(transaction_id);
    if (!tx) {
      console.log(`[AfribaPay Webhook] Transaction not found for afribapay_id: ${transaction_id}`);
      return res.status(404).json({ error: "Transaction not found" });
    }

    if (tx.status !== "pending") {
      console.log(`[AfribaPay Webhook] Transaction ${tx.id} already in status "${tx.status}" - skipping`);
      return res.json({ success: true, message: "Transaction already processed" });
    }

    const isOutgoing = tx.type === "withdrawal" || tx.type === "transfer";
    const txMetadata = tx.metadata ? JSON.parse(tx.metadata) : {};

    // Vérification authoritative via API AfribaPay (récupère montant + téléphone pour fingerprint)
    const apiResult = await getAfribaPayTransaction(transaction_id);
    const rawStatus = (apiResult.success ? apiResult.status : status || "").toUpperCase() || "";
    const isSuccess = rawStatus === "SUCCESS" || rawStatus === "SUCCESSFUL";
    const isFailed = rawStatus === "FAILED" || rawStatus === "CANCELLED" || rawStatus === "EXPIRED";

    console.log(`[AfribaPay Webhook] Transaction ${tx.id} type=${tx.type} rawStatus=${rawStatus} isSuccess=${isSuccess} isFailed=${isFailed}`);

    if (isOutgoing) {
      if (isSuccess) {
        // Validation fingerprint pour les paiements sortants (montant + téléphone + age)
        if (apiResult.success) {
          const { validateAfribaPayFingerprint } = await import("./afribapay");
          const fingerprint = validateAfribaPayFingerprint(apiResult, txMetadata, tx);
          fingerprint.warnings.forEach(w => console.warn(`[AfribaPay Webhook] ⚠️ fingerprint warning (${tx.id}): ${w}`));
          if (!fingerprint.valid) {
            console.error(`[AfribaPay Webhook] 🚨 Fingerprint INVALIDE payout ${tx.id}: ${fingerprint.reason} - ignoré`);
            return res.json({ success: true, message: "Webhook recu - validation fingerprint echouee" });
          }
        }
        await storage.updateTransactionStatus(tx.id, "completed");
        console.log(`[AfribaPay Webhook] ✅ Payout ${tx.id} COMPLETED (fingerprint OK)`);
      } else if (isFailed) {
        const { safeRefundOutgoingTransaction } = await import("./payment-polling");
        await safeRefundOutgoingTransaction(tx.id, tx.userId, txMetadata, "webhook-afribapay-payout-failed");
        await storage.updateTransactionStatus(tx.id, "failed");
        console.log(`[AfribaPay Webhook] ❌ Payout ${tx.id} FAILED - utilisateur remboursé`);
      } else {
        console.log(`[AfribaPay Webhook] Payout ${tx.id} status still pending (rawStatus: ${rawStatus}) - waiting for polling`);
      }
    } else {
      // Paiement entrant
      if (isSuccess) {
        // Validation fingerprint obligatoire avant crédit
        if (apiResult.success) {
          const { validateAfribaPayFingerprint } = await import("./afribapay");
          const fingerprint = validateAfribaPayFingerprint(apiResult, txMetadata, tx);
          fingerprint.warnings.forEach(w => console.warn(`[AfribaPay Webhook] ⚠️ fingerprint warning (${tx.id}): ${w}`));
          if (!fingerprint.valid) {
            console.error(`[AfribaPay Webhook] 🚨 Fingerprint INVALIDE incoming ${tx.id}: ${fingerprint.reason} - CREDIT BLOQUE`);
            await storage.updateTransactionStatus(tx.id, "failed");
            return res.json({ success: true, message: "Webhook recu - validation fingerprint echouee" });
          }
        }
        const result = await storage.finalizeIncomingTransaction(tx.id);
        if (result?.credited) {
          console.log(`[AfribaPay Webhook] ✅ Incoming ${tx.id} CONFIRMÉ (fingerprint OK) - utilisateur crédité`);
          const updatedTx = await storage.getTransaction(tx.id);
          if (updatedTx) {
            const { trySendPaymentCallback } = await import("./utils/callback");
            trySendPaymentCallback(updatedTx, 'payment.completed', '[AfribaPay Webhook]');
          }
          if (tx.type === "payment_link" && tx.customerEmail) {
            try {
              const txMeta = JSON.parse(tx.metadata as string || "{}");
              if (txMeta.paymentLinkId) {
                const pl = await storage.getPaymentLinkById(txMeta.paymentLinkId);
                if (pl?.documentUrls?.length && pl.documentNames?.length) {
                  sendPaymentDocumentsEmail(tx.customerEmail, tx.customerName || "Client", pl.productName, pl.documentNames, pl.documentUrls).catch(() => {});
                }
              }
            } catch {}
          }
        } else {
          console.log(`[AfribaPay Webhook] Incoming ${tx.id} déjà traité - ignoré`);
        }
      } else if (isFailed) {
        await storage.updateTransactionStatus(tx.id, "failed");
        console.log(`[AfribaPay Webhook] ❌ Incoming ${tx.id} FAILED (rawStatus: ${rawStatus})`);
      } else {
        console.log(`[AfribaPay Webhook] Incoming ${tx.id} not yet confirmed (rawStatus: ${rawStatus})`);
      }
    }

    res.json({ success: true, message: "Webhook processed successfully" });
  } catch (error) {
    console.error("[AfribaPay Webhook] Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/verify/:transactionId", async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;
    
    const tx = await storage.getTransaction(transactionId);
    if (!tx) {
      return res.status(404).json({ success: false, error: "Transaction non trouvee" });
    }

    let metadata: any = {};
    try {
      metadata = JSON.parse(tx.metadata || "{}");
    } catch {}

    const afribaPayTransactionId = metadata.afribaPayTransactionId;
    if (!afribaPayTransactionId) {
      return res.json({
        success: true,
        status: tx.status,
        transactionId: tx.id,
      });
    }

    const verification = await verifyAfribaPayPayment(afribaPayTransactionId);
    
    if (verification.verified && tx.status === "pending") {
      const result = await storage.finalizeIncomingTransaction(tx.id);
      if (result?.credited && tx.type === "payment_link" && tx.customerEmail) {
        try {
          const txMeta = JSON.parse(tx.metadata as string || "{}");
          if (txMeta.paymentLinkId) {
            const pl = await storage.getPaymentLinkById(txMeta.paymentLinkId);
            if (pl?.documentUrls?.length && pl.documentNames?.length) {
              sendPaymentDocumentsEmail(tx.customerEmail, tx.customerName || "Client", pl.productName, pl.documentNames, pl.documentUrls).catch(() => {});
            }
          }
        } catch {}
      }
      return res.json({
        success: true,
        status: "completed",
        transactionId: tx.id,
        credited: result?.credited || false,
      });
    }

    res.json({
      success: true,
      status: mapAfribaPayStatus(verification.status),
      transactionId: tx.id,
      afribaPayStatus: verification.status,
    });
  } catch (error) {
    console.error("[AfribaPay Verify] Error:", error);
    res.status(500).json({ success: false, error: "Erreur lors de la verification" });
  }
});

router.get("/countries", async (req: Request, res: Response) => {
  try {
    const countriesWithInstructions = AFRIBAPAY_COUNTRIES.map(country => ({
      ...country,
      operators: country.operators.map(op => {
        const instructions = getPaymentInstructions(country.code, op.code);
        return {
          ...op,
          otpInstructions: instructions.otpInstructions,
          waveInstructions: instructions.waveInstructions,
          generalInstructions: instructions.generalInstructions,
        };
      }),
    }));

    res.json({
      success: true,
      countries: countriesWithInstructions,
    });
  } catch (error) {
    console.error("[AfribaPay Countries] Error:", error);
    res.status(500).json({ success: false, error: "Erreur lors de la recuperation des pays" });
  }
});

router.get("/otp-instructions/:country/:operator", async (req: Request, res: Response) => {
  try {
    const { country, operator } = req.params;
    
    const instructions = getPaymentInstructions(country, operator);
    
    res.json({
      success: true,
      ...instructions,
      operator,
      country,
    });
  } catch (error) {
    console.error("[AfribaPay OTP Instructions] Error:", error);
    res.status(500).json({ success: false, error: "Erreur lors de la recuperation des instructions" });
  }
});

export default router;
