import type { Request, Response } from "express";
import { storage } from "./storage";
import { randomUUID } from "crypto";
import { calculateIncomingFee, calculateOutgoingFee, calculateOutgoingFeeFromNet, getFeeFromDatabase } from "./utils/fees";
import { safeRefundOutgoingTransaction } from "./payment-polling";
import { 
  createCollect, 
  createPayout, 
  getTransactionStatus,
  getPayoutStatus,
  getCollectOperatorCode,
  getPayoutOperatorCode,
  FEDAPAY_SUPPORTED_COUNTRIES_COLLECT,
  FEDAPAY_SUPPORTED_COUNTRIES_PAYOUT,
} from "./fedapay";
import { sendPaymentCallback } from "./utils/callback";

export async function handleFedaPayDeposit(
  userId: string,
  user: any,
  amount: number,
  country: string,
  operator: string,
  phone: string,
  currency?: string,
  originalAmount?: number,
  originalCurrency?: string
): Promise<{ success: boolean; transactionId?: string; fedapayTransactionId?: number; message?: string; error?: string }> {
  try {
    if (!FEDAPAY_SUPPORTED_COUNTRIES_COLLECT.includes(country.toLowerCase())) {
      return { success: false, error: `Pays non supporte pour les depots: ${country}` };
    }

    const operatorCode = getCollectOperatorCode(operator, country);
    if (!operatorCode) {
      return { success: false, error: `Operateur ${operator} non supporte pour ${country}` };
    }

    // Provider gets the converted amount, balance uses original amount
    const providerAmount = Math.floor(amount);
    const balanceAmount = originalAmount ? Math.floor(originalAmount) : providerAmount;
    const providerCurrency = currency || "XOF";
    const userCurrency = originalCurrency || providerCurrency;
    
    // Get dynamic fees from database for fedapay - calculate fees on the balance amount
    const feeConfig = await getFeeFromDatabase(storage, "fedapay", country, operator);
    const feeInfo = calculateIncomingFee(balanceAmount, feeConfig.incoming);

    const nameParts = (user.firstName + " " + user.lastName).split(" ");
    const firstName = nameParts[0] || "Client";
    const lastName = nameParts.slice(1).join(" ") || "BKApay";

    const result = await createCollect({
      amount: providerAmount,
      description: `Depot de ${providerAmount} ${providerCurrency} sur BKApay`,
      customerFirstName: firstName,
      customerLastName: lastName,
      customerEmail: "noreply@bkapay.com",
      customerPhone: phone,
      country: country,
      operator: operator,
      callbackUrl: `${process.env.BASE_URL || "https://bkapay.com"}/api/webhooks/fedapay`,
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
        fedapayTransactionId: result.transactionId,
        fedapayReference: result.reference,
        phone,
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
      fedapayTransactionId: result.transactionId,
      message: result.message || "Paiement initie. Veuillez valider sur votre telephone.",
    };
  } catch (error: any) {
    console.error("[FedaPay Deposit] Error:", error);
    return { success: false, error: "Erreur lors du depot" };
  }
}

export async function handleFedaPayWithdrawal(
  userId: string,
  user: any,
  amount: number,
  country: string,
  operator: string,
  phone: string,
  userCurrency?: string,
  netMode?: boolean,
  skipBalanceOps?: boolean
): Promise<{ success: boolean; transactionId?: string; message?: string; error?: string }> {
  try {
    if (!FEDAPAY_SUPPORTED_COUNTRIES_PAYOUT.includes(country.toLowerCase())) {
      console.error(`[FedaPay Withdrawal] Unsupported country for payout: ${country}`);
      return { success: false, error: "Retrait echoue" };
    }

    const operatorCode = getPayoutOperatorCode(operator, country);
    if (!operatorCode) {
      console.error(`[FedaPay Withdrawal] Unsupported operator: ${operator} for ${country}`);
      return { success: false, error: "Retrait echoue" };
    }

    if (user.kycStatus !== "verified") {
      return { success: false, error: "Verification KYC requise" };
    }

    const grossAmount = Math.floor(amount);
    const providerCurrency = "XOF"; // FedaPay only uses XOF
    const balanceCurrency = userCurrency || providerCurrency;
    
    // Get dynamic fees from database for fedapay
    const feeConfig = await getFeeFromDatabase(storage, "fedapay", country, operator);
    const feeInfo = netMode
      ? calculateOutgoingFeeFromNet(grossAmount, feeConfig.outgoing)
      : calculateOutgoingFee(grossAmount, feeConfig.outgoing);

    if (!skipBalanceOps && user.balance < feeInfo.totalDeductedFromBalance) {
      return { success: false, error: "Solde insuffisant" };
    }

    let amountForProvider = feeInfo.amountReceived;
    if (balanceCurrency !== providerCurrency) {
      const { convertCurrency } = await import("./currency-converter");
      const conversionResult = await convertCurrency(feeInfo.amountReceived, balanceCurrency, providerCurrency);
      if (conversionResult.success) {
        amountForProvider = Math.floor(conversionResult.convertedAmount);
        console.log(`[FedaPay Withdrawal] Currency conversion: ${feeInfo.amountReceived} ${balanceCurrency} -> ${amountForProvider} ${providerCurrency}`);
      } else {
        console.error("[FedaPay Withdrawal] Currency conversion failed:", conversionResult.error);
        return { success: false, error: "Erreur de conversion de devise" };
      }
    }

    const nameParts = (user.firstName + " " + user.lastName).split(" ");
    const firstName = nameParts[0] || "Client";
    const lastName = nameParts.slice(1).join(" ") || "BKApay";

    const result = await createPayout({
      amount: amountForProvider,
      customerFirstName: firstName,
      customerLastName: lastName,
      customerEmail: "noreply@bkapay.com",
      customerPhone: phone,
      country: country,
      operator: operator,
    });

    if (!result.success) {
      return { success: false, error: "Retrait echoue" };
    }

    if (!skipBalanceOps) {
      await storage.updateUserBalance(userId, -feeInfo.totalDeductedFromBalance);
    }

    const tx = await storage.createTransaction({
      userId: userId,
      type: "withdrawal",
      amount: grossAmount, // Montant saisi par l'utilisateur dans sa devise
      fee: feeInfo.feeAmount,
      feePercentage: feeInfo.feePercentage,
      currency: balanceCurrency, // Store in user's currency
      status: "pending",
      country: country.toUpperCase(),
      operator: operator,
      description: `Retrait de ${grossAmount} ${balanceCurrency} (recu: ${amountForProvider} ${providerCurrency})`,
      customerPhone: phone,
      metadata: JSON.stringify({
        fedapayPayoutId: result.payoutId,
        fedapayReference: result.reference,
        phone,
        deductedFromBalance: feeInfo.totalDeductedFromBalance,
        amountReceived: feeInfo.amountReceived,
        providerAmount: amountForProvider,
        providerCurrency: providerCurrency,
        balanceAmount: grossAmount,
        balanceCurrency: balanceCurrency,
      }),
    });

    return {
      success: true,
      transactionId: tx.id,
      message: result.message || "Retrait initie avec succes",
    };
  } catch (error: any) {
    console.error("[FedaPay Withdrawal] Error:", error);
    return { success: false, error: "Retrait echoue" };
  }
}

// Fonction pour les TRANSFERTS (montant envoye = montant saisi, frais ajoutes au solde debite)
export async function handleFedaPayTransfer(
  userId: string,
  user: any,
  amount: number,
  country: string,
  operator: string,
  phone: string,
  userCurrency?: string
): Promise<{ success: boolean; transactionId?: string; message?: string; error?: string }> {
  try {
    if (!FEDAPAY_SUPPORTED_COUNTRIES_PAYOUT.includes(country.toLowerCase())) {
      console.error(`[FedaPay Transfer] Unsupported country for payout: ${country}`);
      return { success: false, error: "Transfert echoue" };
    }

    const operatorCode = getPayoutOperatorCode(operator, country);
    if (!operatorCode) {
      console.error(`[FedaPay Transfer] Unsupported operator: ${operator} for ${country}`);
      return { success: false, error: "Transfert echoue" };
    }

    if (user.kycStatus !== "verified") {
      return { success: false, error: "Verification KYC requise" };
    }

    const netAmount = Math.floor(amount);
    const providerCurrency = "XOF"; // FedaPay only uses XOF
    const balanceCurrency = userCurrency || providerCurrency;
    
    // Get dynamic fees from database for fedapay transfers
    const feeConfig = await getFeeFromDatabase(storage, "fedapay", country, operator);
    const feePercentage = feeConfig.outgoing;
    const feeAmount = Math.floor((netAmount * feePercentage) / 1000);
    const totalDeductedFromBalance = netAmount + feeAmount;

    if (user.balance < totalDeductedFromBalance) {
      return { success: false, error: "Solde insuffisant" };
    }

    // CRITICAL: Convert amount from user's currency to provider currency if different
    let amountForProvider = netAmount;
    if (balanceCurrency !== providerCurrency) {
      const { convertCurrency } = await import("./currency-converter");
      const conversionResult = await convertCurrency(netAmount, balanceCurrency, providerCurrency);
      if (conversionResult.success) {
        amountForProvider = Math.floor(conversionResult.convertedAmount);
        console.log(`[FedaPay Transfer] Currency conversion: ${netAmount} ${balanceCurrency} -> ${amountForProvider} ${providerCurrency}`);
      } else {
        console.error("[FedaPay Transfer] Currency conversion failed:", conversionResult.error);
        return { success: false, error: "Erreur de conversion de devise" };
      }
    }

    const nameParts = (user.firstName + " " + user.lastName).split(" ");
    const firstName = nameParts[0] || "Client";
    const lastName = nameParts.slice(1).join(" ") || "BKApay";

    // ALWAYS send converted amount to provider
    const result = await createPayout({
      amount: amountForProvider,
      customerFirstName: firstName,
      customerLastName: lastName,
      customerEmail: "noreply@bkapay.com",
      customerPhone: phone,
      country: country,
      operator: operator,
    });

    if (!result.success) {
      return { success: false, error: "Transfert echoue" };
    }

    // Debiter montant + frais
    await storage.updateUserBalance(userId, -totalDeductedFromBalance);

    const tx = await storage.createTransaction({
      userId: userId,
      type: "transfer",
      amount: netAmount,
      fee: feeAmount,
      feePercentage: feePercentage,
      currency: balanceCurrency, // Store in user's currency
      status: "pending",
      country: country.toUpperCase(),
      operator: operator,
      description: `Transfert de ${netAmount} ${balanceCurrency} (envoye: ${amountForProvider} ${providerCurrency})`,
      customerPhone: phone,
      metadata: JSON.stringify({
        fedapayPayoutId: result.payoutId,
        fedapayReference: result.reference,
        phone,
        deductedFromBalance: totalDeductedFromBalance,
        providerAmount: amountForProvider,
        providerCurrency: providerCurrency,
        balanceAmount: netAmount,
        balanceCurrency: balanceCurrency,
      }),
    });

    return {
      success: true,
      transactionId: tx.id,
      message: result.message || "Transfert initie avec succes",
    };
  } catch (error: any) {
    console.error("[FedaPay Transfer] Error:", error);
    return { success: false, error: "Transfert echoue" };
  }
}

export async function handlePaymentLinkPayment(
  paymentLink: any,
  customerName: string,
  customerEmail: string,
  customerPhone: string,
  country: string,
  operator: string,
  convertedAmount?: number,
  convertedCurrency?: string
): Promise<{ success: boolean; transactionId?: string; message?: string; error?: string }> {
  try {
    if (!FEDAPAY_SUPPORTED_COUNTRIES_COLLECT.includes(country.toLowerCase())) {
      return { success: false, error: `Pays non supporte: ${country}` };
    }

    const operatorCode = getCollectOperatorCode(operator, country);
    if (!operatorCode) {
      return { success: false, error: `Operateur ${operator} non supporte pour ${country}` };
    }

    // Use converted amount for provider if available, otherwise use original amount
    const baseAmount = paymentLink.amount;
    const providerAmount = convertedAmount ? Math.floor(convertedAmount) : baseAmount;
    const providerCurrency = convertedCurrency || "XOF";
    const customerPaysFee = paymentLink.customerPaysFee || false;
    
    // Get dynamic fees from database for fedapay
    const feeConfig = await getFeeFromDatabase(storage, "fedapay", country, operator);
    
    let grossAmount: number;
    let feeInfo: ReturnType<typeof calculateIncomingFee>;
    
    if (customerPaysFee) {
      // Client paie les frais: on calcule le montant total que le client doit payer
      const feePercentage = feeConfig.incoming / 10; // Convert from decimal (60 = 6%)
      const feeAmount = Math.ceil(baseAmount * feePercentage / 100);
      grossAmount = providerAmount + Math.ceil(providerAmount * feePercentage / 100);
      feeInfo = {
        grossAmount: grossAmount,
        netAmount: baseAmount, // Le marchand reçoit le montant de base (in user's currency)
        feeAmount: feeAmount,
        feePercentage: feeConfig.incoming,
      };
    } else {
      // Marchand paie les frais: logique standard - calculate fees on base amount
      grossAmount = providerAmount;
      feeInfo = calculateIncomingFee(baseAmount, feeConfig.incoming);
    }

    const nameParts = customerName.split(" ");
    const firstName = nameParts[0] || "Client";
    const lastName = nameParts.slice(1).join(" ") || "";

    const result = await createCollect({
      amount: grossAmount,
      description: `Paiement - ${paymentLink.productName}`,
      customerFirstName: firstName,
      customerLastName: lastName || "Client",
      customerEmail: "noreply@bkapay.com", // Privacy: never send real customer emails to providers
      customerPhone: customerPhone,
      country: country,
      operator: operator,
      callbackUrl: `${process.env.BASE_URL || "https://bkapay.com"}/api/webhooks/fedapay`,
    });

    if (!result.success) {
      return { success: false, error: result.error || "Erreur lors du paiement" };
    }

    // Store transaction with user's base currency for balance credit
    const ownerCurrency = (paymentLink as any)?.ownerCurrency || "XOF";
    const tx = await storage.createTransaction({
      userId: paymentLink.userId,
      type: "payment_link",
      amount: baseAmount, // Store base amount for balance credit
      fee: feeInfo.feeAmount,
      feePercentage: feeInfo.feePercentage,
      currency: ownerCurrency,
      status: "pending",
      country: country.toUpperCase(),
      operator: operator,
      description: `Paiement - ${paymentLink.productName}`,
      customerName: customerName,
      customerEmail: customerEmail,
      customerPhone: customerPhone,
      metadata: JSON.stringify({
        fedapayTransactionId: result.transactionId,
        fedapayReference: result.reference,
        paymentLinkId: paymentLink.id,
        customerPaysFee: customerPaysFee,
        netAmountForUser: feeInfo.netAmount,
        providerAmount: grossAmount,
        providerCurrency: providerCurrency,
        balanceAmount: feeInfo.netAmount,
        balanceCurrency: ownerCurrency,
      }),
    });

    return {
      success: true,
      transactionId: tx.id,
      message: result.message || "Paiement initie. Veuillez valider sur votre telephone.",
    };
  } catch (error: any) {
    console.error("[FedaPay PaymentLink] Error:", error);
    return { success: false, error: "Erreur lors du paiement" };
  }
}

export async function handleMerchantLinkPayment(
  merchantLink: any,
  amount: number,
  customerName: string,
  customerEmail: string,
  customerPhone: string,
  country: string,
  operator: string,
  originalAmount?: number,
  originalCurrency?: string
): Promise<{ success: boolean; transactionId?: string; message?: string; error?: string }> {
  try {
    if (!FEDAPAY_SUPPORTED_COUNTRIES_COLLECT.includes(country.toLowerCase())) {
      return { success: false, error: `Pays non supporte: ${country}` };
    }

    const operatorCode = getCollectOperatorCode(operator, country);
    if (!operatorCode) {
      return { success: false, error: `Operateur ${operator} non supporte pour ${country}` };
    }

    // Use converted amount for provider, original amount for balance credit
    const providerAmount = Math.floor(amount);
    const balanceAmount = originalAmount ? Math.floor(originalAmount) : providerAmount;
    const ownerCurrency = originalCurrency || "XOF";
    
    // Get dynamic fees from database for fedapay - calculate fees on the balance amount
    const feeConfig = await getFeeFromDatabase(storage, "fedapay", country, operator);
    const feeInfo = calculateIncomingFee(balanceAmount, feeConfig.incoming);

    const nameParts = customerName.split(" ");
    const firstName = nameParts[0] || "Client";
    const lastName = nameParts.slice(1).join(" ") || "";

    const result = await createCollect({
      amount: providerAmount,
      description: `Paiement marchand - ${merchantLink.merchantName}`,
      customerFirstName: firstName,
      customerLastName: lastName || "Client",
      customerEmail: "noreply@bkapay.com",
      customerPhone: customerPhone,
      country: country,
      operator: operator,
      callbackUrl: `${process.env.BASE_URL || "https://bkapay.com"}/api/webhooks/fedapay`,
    });

    if (!result.success) {
      return { success: false, error: result.error || "Erreur lors du paiement" };
    }

    const tx = await storage.createTransaction({
      userId: merchantLink.userId,
      type: "merchant_link",
      amount: balanceAmount,
      fee: feeInfo.feeAmount,
      feePercentage: feeInfo.feePercentage,
      currency: ownerCurrency,
      status: "pending",
      country: country.toUpperCase(),
      operator: operator,
      description: `Paiement marchand - ${merchantLink.merchantName}`,
      customerName: customerName,
      customerEmail: customerEmail,
      customerPhone: customerPhone,
      metadata: JSON.stringify({
        fedapayTransactionId: result.transactionId,
        fedapayReference: result.reference,
        merchantLinkId: merchantLink.id,
        netAmountForUser: feeInfo.netAmount,
        providerAmount: providerAmount,
        providerCurrency: "XOF",
        balanceAmount: feeInfo.netAmount,
        balanceCurrency: ownerCurrency,
      }),
    });

    return {
      success: true,
      transactionId: tx.id,
      message: result.message || "Paiement initie. Veuillez valider sur votre telephone.",
    };
  } catch (error: any) {
    console.error("[FedaPay MerchantLink] Error:", error);
    return { success: false, error: "Erreur lors du paiement" };
  }
}

export async function handleApiPayment(
  apiKey: any,
  amount: number,
  description: string,
  customerName: string,
  customerEmail: string,
  customerPhone: string,
  country: string,
  operator: string
): Promise<{ success: boolean; transactionId?: string; message?: string; error?: string }> {
  try {
    if (!FEDAPAY_SUPPORTED_COUNTRIES_COLLECT.includes(country.toLowerCase())) {
      return { success: false, error: `Pays non supporte: ${country}` };
    }

    const operatorCode = getCollectOperatorCode(operator, country);
    if (!operatorCode) {
      return { success: false, error: `Operateur ${operator} non supporte pour ${country}` };
    }

    // Si customerPaysFee est activé, le client paie le montant + frais
    // Le marchand reçoit toujours le montant de base
    const baseAmount = Math.floor(amount);
    const customerPaysFee = apiKey.customerPaysFee || false;
    
    // Get dynamic fees from database for fedapay
    const feeConfig = await getFeeFromDatabase(storage, "fedapay", country, operator);
    
    let grossAmount: number;
    let feeInfo: ReturnType<typeof calculateIncomingFee>;
    
    if (customerPaysFee) {
      // Client paie les frais: on calcule le montant total que le client doit payer
      const feePercentage = feeConfig.incoming / 10; // Convert from decimal (60 = 6%)
      const feeAmount = Math.ceil(baseAmount * feePercentage / 100);
      grossAmount = baseAmount + feeAmount;
      feeInfo = {
        grossAmount: grossAmount,
        netAmount: baseAmount, // Le marchand reçoit le montant de base
        feeAmount: feeAmount,
        feePercentage: feeConfig.incoming,
      };
    } else {
      // Marchand paie les frais: logique standard
      grossAmount = baseAmount;
      feeInfo = calculateIncomingFee(grossAmount, feeConfig.incoming);
    }

    const nameParts = customerName.split(" ");
    const firstName = nameParts[0] || "Client";
    const lastName = nameParts.slice(1).join(" ") || "";

    const siteName = (apiKey as any).siteName || apiKey.name;

    const result = await createCollect({
      amount: grossAmount,
      description: description || `Paiement a ${siteName}`,
      customerFirstName: firstName,
      customerLastName: lastName || "Client",
      customerEmail: "noreply@bkapay.com",
      customerPhone: customerPhone,
      country: country,
      operator: operator,
      callbackUrl: `${process.env.BASE_URL || "https://bkapay.com"}/api/webhooks/fedapay`,
      metadata: {
        apiKeyId: apiKey.id,
        apiKeyPublicKey: apiKey.publicKey,
      },
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
      currency: "XOF",
      status: "pending",
      country: country.toUpperCase(),
      operator: operator,
      description: description || `Paiement a ${siteName}`,
      customerName: customerName,
      customerEmail: customerEmail,
      customerPhone: customerPhone,
      metadata: JSON.stringify({
        fedapayTransactionId: result.transactionId,
        fedapayReference: result.reference,
        apiKeyId: apiKey.id,
        apiKeyPublicKey: apiKey.publicKey,
        customerPaysFee: customerPaysFee,
        netAmountForUser: feeInfo.netAmount,
        provider: "fedapay",
        providerAmount: grossAmount,
        providerCurrency: "XOF",
        balanceAmount: feeInfo.netAmount,
        balanceCurrency: "XOF",
      }),
    });

    return {
      success: true,
      transactionId: tx.id,
      message: result.message || "Paiement initie. Veuillez valider sur votre telephone.",
    };
  } catch (error: any) {
    console.error("[FedaPay API Payment] Error:", error);
    return { success: false, error: "Erreur lors du paiement" };
  }
}

export async function handleFedaPayWebhook(req: Request, res: Response) {
  try {
    const { entity, event } = req.body;
    
    console.log("[FedaPay Webhook] Received:", { event, entity: entity?.id });

    if (!entity || !entity.id) {
      return res.status(200).json({ success: true, message: "No entity to process" });
    }

    const fedapayTransactionId = entity.id;
    const status = entity.status;

    const transaction = await storage.getTransactionByFedapayId(fedapayTransactionId);

    if (!transaction) {
      console.log("[FedaPay Webhook] Transaction not found for FedaPay ID:", fedapayTransactionId);
      return res.status(200).json({ success: true, message: "Transaction not found" });
    }

    if (transaction.status !== "pending") {
      console.log("[FedaPay Webhook] Transaction already processed:", transaction.id);
      return res.status(200).json({ success: true, message: "Already processed" });
    }

    if (status === "approved" || status === "transferred") {
      console.log(`[FedaPay Webhook] Payment confirmed for transaction ${transaction.id}`);
      
      if (transaction.type === "withdrawal") {
        await storage.updateTransactionStatus(transaction.id, "completed");
      } else {
        const result = await storage.finalizeIncomingTransaction(transaction.id, {});
        console.log(`[FedaPay Webhook] Finalized: ${result ? 'new' : 'already processed'}`);
      }

      try {
        const metadata = JSON.parse(transaction.metadata || "{}");
        const apiKeyPublicKey = metadata.apiKeyPublicKey;
        if (apiKeyPublicKey) {
          const apiKey = await storage.getApiKeyByPublicKey(apiKeyPublicKey);
          if (apiKey && apiKey.callbackUrl) {
            const updatedTx = await storage.getTransaction(transaction.id);
            if (updatedTx) {
              sendPaymentCallback(updatedTx, apiKey, 'payment.completed')
                .then(callbackResult => {
                  console.log("[FedaPay Webhook] Callback sent:", callbackResult);
                })
                .catch(err => {
                  console.error("[FedaPay Webhook] Callback error:", err);
                });
            }
          }
        }
      } catch (e) {
        console.error("[FedaPay Webhook] Callback processing error:", e);
      }
    } else if (status === "declined" || status === "canceled" || status === "refunded") {
      console.log(`[FedaPay Webhook] Payment failed for transaction ${transaction.id}`);
      await storage.updateTransactionStatus(transaction.id, "failed");

      if (transaction.type === "withdrawal" || transaction.type === "transfer") {
        try {
          const metadata = JSON.parse(transaction.metadata || "{}");
          await safeRefundOutgoingTransaction(transaction.id, transaction.userId, metadata, "webhook-fedapay-failed");
        } catch (e) {
          console.error("[FedaPay Webhook] Refund error:", e);
        }
      }
    }

    return res.status(200).json({ success: true, message: "Webhook processed" });
  } catch (error: any) {
    console.error("[FedaPay Webhook] Error:", error);
    return res.status(200).json({ success: true, message: "Error processing webhook" });
  }
}
