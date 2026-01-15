import type { Request, Response } from "express";
import { storage } from "./storage";
import { randomUUID } from "crypto";
import { calculateIncomingFee, calculateOutgoingFee } from "./utils/fees";
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
  phone: string
): Promise<{ success: boolean; transactionId?: string; fedapayTransactionId?: number; message?: string; error?: string }> {
  try {
    if (!FEDAPAY_SUPPORTED_COUNTRIES_COLLECT.includes(country.toLowerCase())) {
      return { success: false, error: `Pays non supporte pour les depots: ${country}` };
    }

    const operatorCode = getCollectOperatorCode(operator, country);
    if (!operatorCode) {
      return { success: false, error: `Operateur ${operator} non supporte pour ${country}` };
    }

    const grossAmount = Math.floor(amount);
    const feeInfo = calculateIncomingFee(grossAmount);

    const nameParts = (user.firstName + " " + user.lastName).split(" ");
    const firstName = nameParts[0] || "Client";
    const lastName = nameParts.slice(1).join(" ") || "BKApay";

    const result = await createCollect({
      amount: grossAmount,
      description: `Depot de ${grossAmount} XOF sur BKApay`,
      customerFirstName: firstName,
      customerLastName: lastName,
      customerEmail: user.email,
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
      currency: "XOF",
      status: "pending",
      country: country.toUpperCase(),
      operator: operator,
      description: `Depot de ${grossAmount} XOF`,
      customerPhone: phone,
      metadata: JSON.stringify({
        fedapayTransactionId: result.transactionId,
        fedapayReference: result.reference,
        phone,
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
  phone: string
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
    const feeInfo = calculateOutgoingFee(grossAmount);

    if (user.balance < feeInfo.totalDeductedFromBalance) {
      return { success: false, error: "Solde insuffisant" };
    }

    const nameParts = (user.firstName + " " + user.lastName).split(" ");
    const firstName = nameParts[0] || "Client";
    const lastName = nameParts.slice(1).join(" ") || "BKApay";

    // Envoyer le montant recu (montant - frais) au provider
    const result = await createPayout({
      amount: feeInfo.amountReceived,
      customerFirstName: firstName,
      customerLastName: lastName,
      customerEmail: user.email,
      customerPhone: phone,
      country: country,
      operator: operator,
    });

    if (!result.success) {
      return { success: false, error: "Retrait echoue" };
    }

    // Debiter le montant brut (ce que l'utilisateur a saisi)
    await storage.updateUserBalance(userId, -feeInfo.totalDeductedFromBalance);

    const tx = await storage.createTransaction({
      userId: userId,
      type: "withdrawal",
      amount: grossAmount, // Montant saisi par l'utilisateur
      fee: feeInfo.feeAmount,
      feePercentage: feeInfo.feePercentage,
      currency: "XOF",
      status: "pending",
      country: country.toUpperCase(),
      operator: operator,
      description: `Retrait de ${grossAmount} XOF (recu: ${feeInfo.amountReceived} XOF)`,
      customerPhone: phone,
      metadata: JSON.stringify({
        fedapayPayoutId: result.payoutId,
        fedapayReference: result.reference,
        phone,
        deductedFromBalance: feeInfo.totalDeductedFromBalance,
        amountReceived: feeInfo.amountReceived,
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

// Fonction pour les TRANSFERTS (ancienne logique: montant envoye = montant saisi, frais ajoutes au solde debite)
export async function handleFedaPayTransfer(
  userId: string,
  user: any,
  amount: number,
  country: string,
  operator: string,
  phone: string
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
    const feePercentage = 60; // 6%
    const feeAmount = Math.floor((netAmount * feePercentage) / 1000);
    const totalDeductedFromBalance = netAmount + feeAmount;

    if (user.balance < totalDeductedFromBalance) {
      return { success: false, error: "Solde insuffisant" };
    }

    const nameParts = (user.firstName + " " + user.lastName).split(" ");
    const firstName = nameParts[0] || "Client";
    const lastName = nameParts.slice(1).join(" ") || "BKApay";

    // Envoyer le montant saisi (netAmount) au provider
    const result = await createPayout({
      amount: netAmount,
      customerFirstName: firstName,
      customerLastName: lastName,
      customerEmail: user.email,
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
      currency: "XOF",
      status: "pending",
      country: country.toUpperCase(),
      operator: operator,
      description: `Transfert de ${netAmount} XOF`,
      customerPhone: phone,
      metadata: JSON.stringify({
        fedapayPayoutId: result.payoutId,
        fedapayReference: result.reference,
        phone,
        deductedFromBalance: totalDeductedFromBalance,
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
    // Le marchand reçoit toujours le montant de base (paymentLink.amount)
    const baseAmount = paymentLink.amount;
    const customerPaysFee = paymentLink.customerPaysFee || false;
    
    let grossAmount: number;
    let feeInfo: ReturnType<typeof calculateIncomingFee>;
    
    if (customerPaysFee) {
      // Client paie les frais: on calcule le montant total que le client doit payer
      const feePercentage = 6; // 6% uniform fee
      const feeAmount = Math.ceil(baseAmount * feePercentage / 100);
      grossAmount = baseAmount + feeAmount;
      feeInfo = {
        grossAmount: grossAmount,
        netAmount: baseAmount, // Le marchand reçoit le montant de base
        feeAmount: feeAmount,
        feePercentage: feePercentage * 10, // Converti en décimal (60 = 6%)
      };
    } else {
      // Marchand paie les frais: logique standard
      grossAmount = baseAmount;
      feeInfo = calculateIncomingFee(grossAmount);
    }

    const nameParts = customerName.split(" ");
    const firstName = nameParts[0] || "Client";
    const lastName = nameParts.slice(1).join(" ") || "";

    const result = await createCollect({
      amount: grossAmount,
      description: `Paiement - ${paymentLink.productName}`,
      customerFirstName: firstName,
      customerLastName: lastName || "Client",
      customerEmail: customerEmail,
      customerPhone: customerPhone,
      country: country,
      operator: operator,
      callbackUrl: `${process.env.BASE_URL || "https://bkapay.com"}/api/webhooks/fedapay`,
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
      currency: "XOF",
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

    const grossAmount = Math.floor(amount);
    const feeInfo = calculateIncomingFee(grossAmount);

    const nameParts = customerName.split(" ");
    const firstName = nameParts[0] || "Client";
    const lastName = nameParts.slice(1).join(" ") || "";

    const result = await createCollect({
      amount: grossAmount,
      description: `Paiement marchand - ${merchantLink.merchantName}`,
      customerFirstName: firstName,
      customerLastName: lastName || "Client",
      customerEmail: customerEmail,
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
      amount: feeInfo.grossAmount,
      fee: feeInfo.feeAmount,
      feePercentage: feeInfo.feePercentage,
      currency: "XOF",
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
    
    let grossAmount: number;
    let feeInfo: ReturnType<typeof calculateIncomingFee>;
    
    if (customerPaysFee) {
      // Client paie les frais: on calcule le montant total que le client doit payer
      const feePercentage = 6; // 6% uniform fee
      const feeAmount = Math.ceil(baseAmount * feePercentage / 100);
      grossAmount = baseAmount + feeAmount;
      feeInfo = {
        grossAmount: grossAmount,
        netAmount: baseAmount, // Le marchand reçoit le montant de base
        feeAmount: feeAmount,
        feePercentage: feePercentage * 10, // Converti en décimal (60 = 6%)
      };
    } else {
      // Marchand paie les frais: logique standard
      grossAmount = baseAmount;
      feeInfo = calculateIncomingFee(grossAmount);
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
      customerEmail: customerEmail,
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

      if (transaction.type === "withdrawal") {
        try {
          const metadata = JSON.parse(transaction.metadata || "{}");
          const deductedAmount = metadata.deductedFromBalance;
          if (deductedAmount) {
            await storage.updateUserBalance(transaction.userId, deductedAmount);
            console.log(`[FedaPay Webhook] Refunded ${deductedAmount} to user ${transaction.userId}`);
          }
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
