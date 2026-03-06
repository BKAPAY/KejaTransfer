import type { Request, Response } from "express";
import { storage } from "./storage";
import { randomUUID } from "crypto";
import { calculateIncomingFee, calculateOutgoingFee, calculateOutgoingFeeFromNet, getFeeFromDatabase } from "./utils/fees";
import { trySendPaymentCallback } from "./utils/callback";
import { safeRefundOutgoingTransaction, sendApiPayoutCallback } from "./payment-polling";
import {
  createPawaPayDeposit,
  createPawaPayPayout,
  getPawaPayDepositStatus,
  getPawaPayPayoutStatus,
  mapPawaPayStatus,
  PAWAPAY_SUPPORTED_COUNTRIES,
  getPawaPayConfig,
} from "./pawapay";
import {
  PAWAPAY_COUNTRIES,
  getCurrencyForCountry,
  getPayinOperatorsForCountry,
  getPayoutOperatorsForCountry,
} from "@shared/pawapay-countries";

export async function handlePawaPayDeposit(
  userId: string,
  user: any,
  amount: number,
  country: string,
  operator: string,
  phone: string,
  currency?: string,
  originalAmount?: number,
  originalCurrency?: string
): Promise<{ success: boolean; transactionId?: string; pawaPayDepositId?: string; message?: string; error?: string }> {
  try {
    const countryUpper = country.toUpperCase();
    if (!PAWAPAY_SUPPORTED_COUNTRIES.includes(country.toLowerCase())) {
      return { success: false, error: `Ce pays n'est pas disponible via PawaPay` };
    }

    const availableOperators = getPayinOperatorsForCountry(countryUpper);
    const operatorConfig = availableOperators.find(o => o.code.toLowerCase() === operator.toLowerCase());
    if (!operatorConfig) {
      return { success: false, error: `Opérateur ${operator} non supporté pour ${country} avec PawaPay` };
    }

    const providerAmount = Math.floor(amount);
    const providerCurrency = currency || getCurrencyForCountry(countryUpper);
    const balanceAmount = originalAmount ? Math.floor(originalAmount) : providerAmount;
    const userCurrency = originalCurrency || providerCurrency;

    const feeConfig = await getFeeFromDatabase(storage, "pawapay", country, operator);
    const feeInfo = calculateIncomingFee(balanceAmount, feeConfig.incoming);

    const orderId = `BKAPAY-DEP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    const tx = await storage.createTransaction({
      userId,
      type: "deposit",
      amount: feeInfo.grossAmount,
      fee: feeInfo.feeAmount,
      feePercentage: feeInfo.feePercentage,
      currency: userCurrency,
      status: "pending",
      country: countryUpper,
      operator,
      description: `Dépôt de ${providerAmount} ${providerCurrency}`,
      customerPhone: phone,
      metadata: JSON.stringify({
        phone,
        provider: "pawapay",
        paymentProvider: "pawapay",
        providerAmount,
        providerCurrency,
        netAmountForUser: feeInfo.netAmount,
        balanceAmount: feeInfo.netAmount,
        balanceCurrency: userCurrency,
        orderId,
        startTime,
      }),
    });

    const result = await createPawaPayDeposit({
      amount: providerAmount,
      currency: providerCurrency,
      country: countryUpper,
      operator,
      phone,
      description: "Depot BKApay",
      externalId: randomUUID(),
    });

    if (!result.success) {
      await storage.updateTransactionStatus(tx.id, "failed");
      return { success: false, transactionId: tx.id, error: result.error || "Erreur lors du dépôt" };
    }

    const updatedMetadata = JSON.stringify({
      pawaPayDepositId: result.depositId,
      phone,
      provider: "pawapay",
      paymentProvider: "pawapay",
      providerAmount,
      providerCurrency,
      netAmountForUser: feeInfo.netAmount,
      balanceAmount: feeInfo.netAmount,
      balanceCurrency: userCurrency,
      orderId,
      startTime,
    });
    await storage.updateTransactionMetadata(tx.id, updatedMetadata);

    return {
      success: true,
      transactionId: tx.id,
      pawaPayDepositId: result.depositId,
      message: result.message || "Paiement initié. Veuillez valider sur votre téléphone.",
    };
  } catch (error: any) {
    console.error("[PawaPay Deposit Handler] Error:", error);
    return { success: false, error: "Erreur lors du dépôt" };
  }
}

export async function handlePawaPayWithdrawal(
  userId: string,
  user: any,
  amount: number,
  country: string,
  operator: string,
  phone: string,
  userCurrency?: string,
  targetCurrency?: string,
  netMode?: boolean,
  providerAmountOverride?: number
): Promise<{ success: boolean; transactionId?: string; message?: string; error?: string }> {
  try {
    const countryUpper = country.toUpperCase();
    if (!PAWAPAY_SUPPORTED_COUNTRIES.includes(country.toLowerCase())) {
      return { success: false, error: "Retrait échoué" };
    }

    if (user.kycStatus !== "verified") {
      return { success: false, error: "Vérification KYC requise" };
    }

    const grossAmount = Math.floor(amount);
    const defaultCurrency = getCurrencyForCountry(countryUpper);
    const providerCurrency = targetCurrency || userCurrency || defaultCurrency;
    const balanceCurrency = userCurrency || providerCurrency;

    const feeConfig = await getFeeFromDatabase(storage, "pawapay", country, operator);
    const feeInfo = netMode
      ? calculateOutgoingFeeFromNet(grossAmount, feeConfig.outgoing)
      : calculateOutgoingFee(grossAmount, feeConfig.outgoing);

    if (user.balance < feeInfo.totalDeductedFromBalance) {
      return { success: false, error: "Solde insuffisant" };
    }

    let amountForProvider: number;
    if (providerAmountOverride !== undefined) {
      amountForProvider = providerAmountOverride;
    } else {
      amountForProvider = feeInfo.amountReceived;
      if (balanceCurrency !== providerCurrency) {
        const { convertCurrency } = await import("./currency-converter");
        const conversionResult = await convertCurrency(feeInfo.amountReceived, balanceCurrency, providerCurrency);
        if (conversionResult.success) {
          amountForProvider = Math.floor(conversionResult.convertedAmount);
        } else {
          return { success: false, error: "Erreur de conversion de devise" };
        }
      }
    }

    const orderId = `BKAPAY-WD-${Date.now()}`;
    const startTime = Date.now();

    await storage.updateUserBalance(userId, -feeInfo.totalDeductedFromBalance);

    const tx = await storage.createTransaction({
      userId,
      type: "withdrawal",
      amount: grossAmount,
      fee: feeInfo.feeAmount,
      feePercentage: feeInfo.feePercentage,
      currency: balanceCurrency,
      status: "pending",
      country: countryUpper,
      operator,
      description: `Retrait de ${grossAmount} ${balanceCurrency} (reçu: ${amountForProvider} ${providerCurrency})`,
      customerPhone: phone,
      metadata: JSON.stringify({
        phone,
        deductedFromBalance: feeInfo.totalDeductedFromBalance,
        amountReceived: feeInfo.amountReceived,
        providerAmount: amountForProvider,
        providerCurrency,
        balanceAmount: grossAmount,
        balanceCurrency,
        provider: "pawapay",
        paymentProvider: "pawapay",
        orderId,
        startTime,
      }),
    });

    const result = await createPawaPayPayout({
      amount: amountForProvider,
      currency: providerCurrency,
      country: countryUpper,
      operator,
      phone,
      description: "Retrait BKApay",
      externalId: randomUUID(),
    });

    if (!result.success) {
      await storage.updateUserBalance(userId, feeInfo.totalDeductedFromBalance);
      await storage.updateTransactionStatus(tx.id, "failed");
      return { success: false, transactionId: tx.id, error: result.error || "Retrait échoué" };
    }

    const updatedMetadata = JSON.stringify({
      pawaPayPayoutId: result.payoutId,
      phone,
      deductedFromBalance: feeInfo.totalDeductedFromBalance,
      amountReceived: feeInfo.amountReceived,
      providerAmount: amountForProvider,
      providerCurrency,
      balanceAmount: grossAmount,
      balanceCurrency,
      provider: "pawapay",
      paymentProvider: "pawapay",
      orderId,
      startTime,
    });
    await storage.updateTransactionMetadata(tx.id, updatedMetadata);

    return {
      success: true,
      transactionId: tx.id,
      message: result.message || "Retrait initié avec succès",
    };
  } catch (error: any) {
    console.error("[PawaPay Withdrawal Handler] Error:", error);
    return { success: false, error: "Retrait échoué" };
  }
}

export async function handlePawaPayTransfer(
  userId: string,
  user: any,
  amount: number,
  country: string,
  operator: string,
  phone: string
): Promise<{ success: boolean; transactionId?: string; message?: string; error?: string }> {
  return handlePawaPayWithdrawal(userId, user, amount, country, operator, phone);
}

export async function handlePawaPayWebhook(req: Request, res: Response): Promise<void> {
  try {
    const payload = req.body;
    if (!payload) {
      res.status(400).json({ error: "Invalid payload" });
      return;
    }

    const depositId = payload.depositId;
    const payoutId = payload.payoutId;
    const status = payload.status;

    console.log(`[PawaPay Webhook] Received: depositId=${depositId}, payoutId=${payoutId}, status=${status}`);

    res.status(200).json({ success: true });

    const mappedStatus = mapPawaPayStatus(status);

    if (depositId) {
      const transactions = await storage.getTransactionsByMetadata("pawaPayDepositId", depositId);
      for (const tx of transactions) {
        if (tx.status !== "pending") continue;
        if (mappedStatus === "completed") {
          const meta = JSON.parse(tx.metadata || "{}");
          const netAmount = meta.netAmountForUser || meta.balanceAmount || tx.amount;
          await storage.updateUserBalance(tx.userId, netAmount);
          await storage.updateTransactionStatus(tx.id, "completed");
          console.log(`[PawaPay Webhook] Deposit ${tx.id} completed - credited ${netAmount}`);
          await trySendPaymentCallback(tx, "completed");
        } else if (mappedStatus === "failed") {
          await storage.updateTransactionStatus(tx.id, "failed");
          console.log(`[PawaPay Webhook] Deposit ${tx.id} failed`);
        }
      }
    }

    if (payoutId) {
      const transactions = await storage.getTransactionsByMetadata("pawaPayPayoutId", payoutId);
      for (const tx of transactions) {
        if (tx.status !== "pending") continue;
        if (mappedStatus === "completed") {
          await storage.updateTransactionStatus(tx.id, "completed");
          console.log(`[PawaPay Webhook] Payout ${tx.id} completed`);
          await sendApiPayoutCallback(tx.id, "completed");
        } else if (mappedStatus === "failed") {
          const meta = JSON.parse(tx.metadata || "{}");
          const refundAmount = meta.deductedFromBalance || tx.amount;
          await storage.updateUserBalance(tx.userId, refundAmount);
          await storage.updateTransactionStatus(tx.id, "failed");
          console.log(`[PawaPay Webhook] Payout ${tx.id} failed - refunded ${refundAmount}`);
          await sendApiPayoutCallback(tx.id, "failed");
        }
      }
    }
  } catch (error) {
    console.error("[PawaPay Webhook] Error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
}

export async function pollPawaPayTransaction(txId: string): Promise<void> {
  try {
    const tx = await storage.getTransaction(txId);
    if (!tx || tx.status !== "pending") return;

    const meta = JSON.parse(tx.metadata || "{}");
    const depositId = meta.pawaPayDepositId;
    const payoutId = meta.pawaPayPayoutId;

    if (depositId) {
      const { status } = await getPawaPayDepositStatus(depositId);
      const mappedStatus = mapPawaPayStatus(status);
      if (mappedStatus === "completed") {
        const netAmount = meta.netAmountForUser || meta.balanceAmount || tx.amount;
        await storage.updateUserBalance(tx.userId, netAmount);
        await storage.updateTransactionStatus(txId, "completed");
        await trySendPaymentCallback(tx, "completed");
      } else if (mappedStatus === "failed") {
        await storage.updateTransactionStatus(txId, "failed");
      }
    }

    if (payoutId) {
      const { status } = await getPawaPayPayoutStatus(payoutId);
      const mappedStatus = mapPawaPayStatus(status);
      if (mappedStatus === "completed") {
        await storage.updateTransactionStatus(txId, "completed");
        await sendApiPayoutCallback(txId, "completed");
      } else if (mappedStatus === "failed") {
        const refundAmount = meta.deductedFromBalance || tx.amount;
        await storage.updateUserBalance(tx.userId, refundAmount);
        await storage.updateTransactionStatus(txId, "failed");
        await sendApiPayoutCallback(txId, "failed");
      }
    }
  } catch (error) {
    console.error("[PawaPay Poll] Error:", error);
  }
}
