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
  getCurrencyForOperator,
  getPayinOperatorsForCountry,
  getPayoutOperatorsForCountry,
  pawaPayOperatorRequiresOtp,
  getPawaPayOtpInstructions,
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
  originalCurrency?: string,
  otpCode?: string,
  options?: {
    transactionType?: "deposit" | "payment_link" | "merchant_link";
    transactionDescription?: string;
    customerName?: string;
    customerEmail?: string;
    extraMetadata?: Record<string, any>;
  }
): Promise<{
  success: boolean;
  transactionId?: string;
  pawaPayDepositId?: string;
  message?: string;
  error?: string;
  requiresOTP?: boolean;
  otpInstructions?: string;
  otpUssdCode?: string;
  otpHint?: string;
}> {
  try {
    const countryUpper = country.toUpperCase();
    if (!PAWAPAY_SUPPORTED_COUNTRIES.includes(country.toLowerCase())) {
      return { success: false, error: `Ce pays n'est pas disponible pour ce moyen de paiement.` };
    }

    const availableOperators = getPayinOperatorsForCountry(countryUpper);
    const operatorConfig = availableOperators.find(o => o.code.toLowerCase() === operator.toLowerCase());
    if (!operatorConfig) {
      return { success: false, error: `Opérateur non disponible pour ce pays.` };
    }

    const needsOtp = pawaPayOperatorRequiresOtp(countryUpper, operator);
    if (needsOtp && !otpCode) {
      const otpInfo = getPawaPayOtpInstructions(countryUpper);
      return {
        success: false,
        requiresOTP: true,
        otpInstructions: otpInfo.instructions,
        otpUssdCode: otpInfo.ussdCode,
        otpHint: otpInfo.hint,
        error: "Code OTP Orange Money requis pour ce paiement",
      };
    }

    const providerAmount = Math.floor(amount);
    const providerCurrency = currency || getCurrencyForOperator(countryUpper, operator);
    const balanceAmount = originalAmount ? Math.floor(originalAmount) : providerAmount;
    const userCurrency = originalCurrency || providerCurrency;

    const feeConfig = await getFeeFromDatabase(storage, "pawapay", country, operator);
    const feeInfo = calculateIncomingFee(balanceAmount, feeConfig.incoming);

    const txType = options?.transactionType || "deposit";
    const txDescription = options?.transactionDescription || `Dépôt de ${providerAmount} ${providerCurrency}`;
    const orderId = `BKAPAY-DEP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    const tx = await storage.createTransaction({
      userId,
      type: txType,
      amount: feeInfo.grossAmount,
      fee: feeInfo.feeAmount,
      feePercentage: feeInfo.feePercentage,
      currency: userCurrency,
      status: "pending",
      country: countryUpper,
      operator,
      description: txDescription,
      customerPhone: phone,
      customerName: options?.customerName || null,
      customerEmail: options?.customerEmail || null,
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
        ...(options?.extraMetadata || {}),
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
      preAuthorisationCode: otpCode,
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
      ...(options?.extraMetadata || {}),
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
    // Use operator-specific currency as default (e.g. USD for Vodacom/Orange COD)
    const defaultCurrency = getCurrencyForOperator(countryUpper, operator);
    const providerCurrency = targetCurrency || defaultCurrency;
    const balanceCurrency = userCurrency || providerCurrency;

    const feeConfig = await getFeeFromDatabase(storage, "pawapay", country, operator);
    const feeInfo = netMode
      ? calculateOutgoingFeeFromNet(grossAmount, feeConfig.outgoing)
      : calculateOutgoingFee(grossAmount, feeConfig.outgoing);

    if (user.balance < feeInfo.totalDeductedFromBalance) {
      return { success: false, error: "Solde insuffisant sur votre compte. Veuillez effectuer un dépôt avant de retirer." };
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

    const orderId = netMode ? `BKAPAY-API-${Date.now()}` : `BKAPAY-WD-${Date.now()}`;
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
      description: netMode
        ? `Payout API ${grossAmount} ${balanceCurrency}`
        : `Retrait de ${grossAmount} ${balanceCurrency} (reçu: ${amountForProvider} ${providerCurrency})`,
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
        netMode: netMode || false,
      }),
    });

    const result = await createPawaPayPayout({
      amount: amountForProvider,
      currency: providerCurrency,
      country: countryUpper,
      operator,
      phone,
      description: netMode ? "Payout API BKApay" : "Retrait BKApay",
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
      netMode: netMode || false,
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
  phone: string,
  userCurrency?: string,
  targetCurrency?: string
): Promise<{ success: boolean; transactionId?: string; message?: string; error?: string }> {
  try {
    const countryUpper = country.toUpperCase();
    if (!PAWAPAY_SUPPORTED_COUNTRIES.includes(country.toLowerCase())) {
      return { success: false, error: "Transfert échoué" };
    }

    if (user.kycStatus !== "verified") {
      return { success: false, error: "Vérification KYC requise" };
    }

    const netAmount = Math.floor(amount);
    const defaultCurrency = getCurrencyForOperator(countryUpper, operator);
    const providerCurrency = targetCurrency || defaultCurrency;
    const balanceCurrency = userCurrency || providerCurrency;

    const feeConfig = await getFeeFromDatabase(storage, "pawapay", country, operator);
    // Transfer: recipient gets full amount, fee is added ON TOP of balance deduction
    const feeInfo = calculateOutgoingFeeFromNet(netAmount, feeConfig.outgoing);

    if (user.balance < feeInfo.totalDeductedFromBalance) {
      return { success: false, error: "Solde insuffisant sur votre compte. Veuillez effectuer un dépôt avant de transférer." };
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

    const orderId = `BKAPAY-TF-${Date.now()}`;
    const startTime = Date.now();

    await storage.updateUserBalance(userId, -feeInfo.totalDeductedFromBalance);

    const tx = await storage.createTransaction({
      userId,
      type: "transfer",
      amount: netAmount,
      fee: feeInfo.feeAmount,
      feePercentage: feeInfo.feePercentage,
      currency: balanceCurrency,
      status: "pending",
      country: countryUpper,
      operator,
      description: `Transfert de ${netAmount} ${balanceCurrency}`,
      customerPhone: phone,
      metadata: JSON.stringify({
        phone,
        totalDebited: feeInfo.totalDeductedFromBalance,
        providerAmount: amountForProvider,
        providerCurrency,
        balanceAmount: netAmount,
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
      description: "Transfert BKApay",
      externalId: randomUUID(),
    });

    if (!result.success) {
      await storage.updateUserBalance(userId, feeInfo.totalDeductedFromBalance);
      await storage.updateTransactionStatus(tx.id, "failed");
      return { success: false, transactionId: tx.id, error: result.error || "Transfert échoué" };
    }

    const updatedMetadata = JSON.stringify({
      pawaPayPayoutId: result.payoutId,
      phone,
      totalDebited: feeInfo.totalDeductedFromBalance,
      providerAmount: amountForProvider,
      providerCurrency,
      balanceAmount: netAmount,
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
      message: result.message || "Transfert initié avec succès",
    };
  } catch (error: any) {
    console.error("[PawaPay Transfer Handler] Error:", error);
    return { success: false, error: "Transfert échoué" };
  }
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
    const webhookStatus = payload.status;

    console.log(`[PawaPay Webhook] Received: depositId=${depositId}, payoutId=${payoutId}, status=${webhookStatus}`);

    // Acknowledge immediately so PawaPay doesn't retry
    res.status(200).json({ success: true });

    if (depositId) {
      const transactions = await storage.getTransactionsByMetadata("pawaPayDepositId", depositId);
      for (const tx of transactions) {
        // Skip already-processed transactions
        if (tx.status !== "pending") {
          console.log(`[PawaPay Webhook] Deposit ${tx.id} already processed (status=${tx.status}), skipping`);
          continue;
        }

        // SECURITY: Re-verify status via PawaPay API — never trust webhook payload alone
        let verifiedStatus: string;
        let apiData: any;
        try {
          const apiResult = await getPawaPayDepositStatus(depositId);
          verifiedStatus = apiResult.status;
          apiData = apiResult.data;
          console.log(`[PawaPay Webhook] API verification for depositId=${depositId}: status=${verifiedStatus}`);
        } catch (err) {
          console.error(`[PawaPay Webhook] API verification failed for depositId=${depositId}, aborting:`, err);
          continue;
        }

        const mappedStatus = mapPawaPayStatus(verifiedStatus);

        if (mappedStatus === "completed") {
          // SECURITY: Verify amount from API matches what we stored
          const meta = JSON.parse(tx.metadata || "{}");
          if (apiData?.amount) {
            const apiAmount = Number(apiData.amount);
            const storedAmount = tx.amount;
            if (Math.abs(apiAmount - storedAmount) > 1) {
              console.error(`[PawaPay Webhook] AMOUNT MISMATCH for ${tx.id}: API=${apiAmount}, stored=${storedAmount} — aborting credit`);
              continue;
            }
          }

          // ATOMIC: Use finalizeIncomingTransaction which atomically sets status=completed
          // WHERE status='pending' — prevents double-credit if webhook fires twice
          const result = await storage.finalizeIncomingTransaction(tx.id);
          if (result && result.credited) {
            console.log(`[PawaPay Webhook] Deposit ${tx.id} finalized and credited to user ${tx.userId}`);
            await trySendPaymentCallback(tx, "completed");
          } else if (!result) {
            console.log(`[PawaPay Webhook] Deposit ${tx.id} was already finalized by another process (race condition prevented)`);
          }
        } else if (mappedStatus === "failed") {
          // ATOMIC: Only fails if still pending
          const failed = await storage.atomicFailTransaction(tx.id);
          if (failed) {
            console.log(`[PawaPay Webhook] Deposit ${tx.id} marked failed (verified via API)`);
          }
        }
        // If status is still "pending" from API, do nothing — let polling handle it
      }
    }

    if (payoutId) {
      const transactions = await storage.getTransactionsByMetadata("pawaPayPayoutId", payoutId);
      for (const tx of transactions) {
        // Skip already-processed transactions
        if (tx.status !== "pending") {
          console.log(`[PawaPay Webhook] Payout ${tx.id} already processed (status=${tx.status}), skipping`);
          continue;
        }

        // SECURITY: Re-verify status via PawaPay API
        let verifiedStatus: string;
        try {
          const apiResult = await getPawaPayPayoutStatus(payoutId);
          verifiedStatus = apiResult.status;
          console.log(`[PawaPay Webhook] API verification for payoutId=${payoutId}: status=${verifiedStatus}`);
        } catch (err) {
          console.error(`[PawaPay Webhook] API verification failed for payoutId=${payoutId}, aborting:`, err);
          continue;
        }

        const mappedStatus = mapPawaPayStatus(verifiedStatus);

        if (mappedStatus === "completed") {
          // ATOMIC: Only completes if still pending
          const completed = await storage.atomicCompleteTransaction(tx.id);
          if (completed) {
            console.log(`[PawaPay Webhook] Payout ${tx.id} completed`);
            await sendApiPayoutCallback(tx.id, "completed");
          } else {
            console.log(`[PawaPay Webhook] Payout ${tx.id} already processed by another process`);
          }
        } else if (mappedStatus === "failed") {
          const meta = JSON.parse(tx.metadata || "{}");
          const refundAmount = meta.deductedFromBalance || tx.amount;
          // ATOMIC: Fails and refunds in one DB transaction — prevents double-refund
          const refunded = await storage.atomicFailAndRefundPayout(tx.id, tx.userId, refundAmount);
          if (refunded) {
            console.log(`[PawaPay Webhook] Payout ${tx.id} failed — refunded ${refundAmount} to user ${tx.userId}`);
            await sendApiPayoutCallback(tx.id, "failed");
          } else {
            console.log(`[PawaPay Webhook] Payout ${tx.id} already processed by another process`);
          }
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
    // Re-fetch from DB to get latest state (prevents race with concurrent webhook)
    const tx = await storage.getTransaction(txId);
    if (!tx || tx.status !== "pending") return;

    const meta = JSON.parse(tx.metadata || "{}");
    const depositId = meta.pawaPayDepositId;
    const payoutId = meta.pawaPayPayoutId;

    if (depositId) {
      const { status, data: apiData } = await getPawaPayDepositStatus(depositId);
      const mappedStatus = mapPawaPayStatus(status);

      console.log(`[PawaPay Poll] depositId=${depositId}, API status=${status}, mapped=${mappedStatus}`);

      if (mappedStatus === "completed") {
        // SECURITY: Verify amount from API matches what we stored
        if (apiData?.amount) {
          const apiAmount = Number(apiData.amount);
          if (Math.abs(apiAmount - tx.amount) > 1) {
            console.error(`[PawaPay Poll] AMOUNT MISMATCH for ${txId}: API=${apiAmount}, stored=${tx.amount} — aborting`);
            return;
          }
        }

        // ATOMIC: finalizeIncomingTransaction — atomically sets completed WHERE pending
        const result = await storage.finalizeIncomingTransaction(txId);
        if (result && result.credited) {
          console.log(`[PawaPay Poll] Deposit ${txId} finalized and credited to user ${tx.userId}`);
          await trySendPaymentCallback(tx, "completed");
        } else if (!result) {
          console.log(`[PawaPay Poll] Deposit ${txId} already finalized by another process (race condition prevented)`);
        }
      } else if (mappedStatus === "failed") {
        const failed = await storage.atomicFailTransaction(txId);
        if (failed) {
          console.log(`[PawaPay Poll] Deposit ${txId} marked failed`);
        }
      }
    }

    if (payoutId) {
      const { status } = await getPawaPayPayoutStatus(payoutId);
      const mappedStatus = mapPawaPayStatus(status);

      console.log(`[PawaPay Poll] payoutId=${payoutId}, API status=${status}, mapped=${mappedStatus}`);

      if (mappedStatus === "completed") {
        // ATOMIC: Only completes if still pending
        const completed = await storage.atomicCompleteTransaction(txId);
        if (completed) {
          console.log(`[PawaPay Poll] Payout ${txId} completed`);
          await sendApiPayoutCallback(txId, "completed");
        } else {
          console.log(`[PawaPay Poll] Payout ${txId} already processed by another process`);
        }
      } else if (mappedStatus === "failed") {
        const refundAmount = meta.deductedFromBalance || tx.amount;
        // ATOMIC: Fails and refunds in one DB transaction — prevents double-refund
        const refunded = await storage.atomicFailAndRefundPayout(txId, tx.userId, refundAmount);
        if (refunded) {
          console.log(`[PawaPay Poll] Payout ${txId} failed — refunded ${refundAmount} to user ${tx.userId}`);
          await sendApiPayoutCallback(txId, "failed");
        } else {
          console.log(`[PawaPay Poll] Payout ${txId} already processed by another process`);
        }
      }
    }
  } catch (error) {
    console.error("[PawaPay Poll] Error:", error);
  }
}
