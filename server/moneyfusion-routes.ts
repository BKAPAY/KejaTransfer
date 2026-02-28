import type { Request, Response } from "express";
import { storage } from "./storage";
import { calculateOutgoingFee, calculateOutgoingFeeFromNet, getFeeFromDatabase } from "./utils/fees";
import { createMoneyFusionPayout } from "./moneyfusion";
import { getMoneyFusionCurrency, isMoneyFusionSupported } from "@shared/moneyfusion-countries";

export async function handleMoneyFusionWithdrawal(
  userId: string,
  user: any,
  amount: number,
  country: string,
  operator: string,
  phone: string,
  userCurrency?: string,
  netMode?: boolean,
  providerAmountOverride?: number
): Promise<{ success: boolean; transactionId?: string; message?: string; error?: string }> {
  try {
    const countryLower = country.toLowerCase();
    if (!isMoneyFusionSupported(countryLower, operator)) {
      console.error(`[MoneyFusion Withdrawal] Unsupported: ${country}/${operator}`);
      return { success: false, error: "L'operation a echoue. Veuillez reessayer." };
    }

    if (user.kycStatus !== "verified") {
      return { success: false, error: "Verification KYC requise" };
    }

    const grossAmount = Math.floor(amount);
    const providerCurrency = getMoneyFusionCurrency(country);
    const balanceCurrency = userCurrency || providerCurrency;

    const feeConfig = await getFeeFromDatabase(storage, "moneyfusion", country, operator);
    const feeInfo = netMode
      ? calculateOutgoingFeeFromNet(grossAmount, feeConfig.outgoing)
      : calculateOutgoingFee(grossAmount, feeConfig.outgoing);

    if (user.balance < feeInfo.totalDeductedFromBalance) {
      return { success: false, error: "L'operation ne peut pas etre effectuee pour le moment. Veuillez reessayer plus tard." };
    }

    // Use providerAmountOverride when set (avoids double-conversion in cross-currency API payouts)
    let amountForProvider: number;
    if (providerAmountOverride !== undefined) {
      amountForProvider = providerAmountOverride;
      console.log(`[MoneyFusion Withdrawal] Using provider amount override: ${amountForProvider} ${providerCurrency}`);
    } else {
      amountForProvider = feeInfo.amountReceived;
      if (balanceCurrency !== providerCurrency) {
        const { convertCurrency } = await import("./currency-converter");
        const conversionResult = await convertCurrency(feeInfo.amountReceived, balanceCurrency, providerCurrency);
        if (conversionResult.success) {
          amountForProvider = Math.floor(conversionResult.convertedAmount);
          console.log(`[MoneyFusion Withdrawal] Currency conversion: ${feeInfo.amountReceived} ${balanceCurrency} -> ${amountForProvider} ${providerCurrency}`);
        } else {
          console.error("[MoneyFusion Withdrawal] Currency conversion failed:", conversionResult.error);
          return { success: false, error: "Erreur de conversion de devise" };
        }
      }
    }

    const orderId = `BKAPAY-MF-WD-${Date.now()}`;
    const startTime = Date.now();

    await storage.updateUserBalance(userId, -feeInfo.totalDeductedFromBalance);

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
      description: `Retrait de ${grossAmount} ${balanceCurrency}`,
      customerPhone: phone,
      metadata: JSON.stringify({
        phone,
        deductedFromBalance: feeInfo.totalDeductedFromBalance,
        amountReceived: feeInfo.amountReceived,
        providerAmount: amountForProvider,
        providerCurrency: providerCurrency,
        balanceAmount: grossAmount,
        balanceCurrency: balanceCurrency,
        provider: "moneyfusion",
        paymentProvider: "moneyfusion",
        orderId,
        startTime,
      }),
    });

    const result = await createMoneyFusionPayout({
      amount: amountForProvider,
      phone: phone,
      countryCode: country,
      operatorCode: operator,
    });

    if (!result.success) {
      await storage.updateUserBalance(userId, feeInfo.totalDeductedFromBalance);
      await storage.updateTransactionStatus(tx.id, "failed");
      return { success: false, transactionId: tx.id, error: result.error || "L'operation a echoue." };
    }

    const updatedMetadata = JSON.stringify({
      moneyFusionTokenPay: result.tokenPay,
      phone,
      deductedFromBalance: feeInfo.totalDeductedFromBalance,
      amountReceived: feeInfo.amountReceived,
      providerAmount: amountForProvider,
      providerCurrency: providerCurrency,
      balanceAmount: grossAmount,
      balanceCurrency: balanceCurrency,
      provider: "moneyfusion",
      paymentProvider: "moneyfusion",
      orderId,
      startTime,
    });
    await storage.updateTransactionMetadata(tx.id, updatedMetadata);

    await storage.updateTransactionStatus(tx.id, "completed");
    console.log(`[MoneyFusion Withdrawal] Transaction ${tx.id} marked as COMPLETED (provider accepted with tokenPay: ${result.tokenPay})`);

    return {
      success: true,
      transactionId: tx.id,
      message: "Operation effectuee avec succes.",
    };
  } catch (error: any) {
    console.error("[MoneyFusion Withdrawal] Error:", error);
    return { success: false, error: "L'operation a echoue." };
  }
}

export async function handleMoneyFusionTransfer(
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
    if (!isMoneyFusionSupported(countryLower, operator)) {
      return { success: false, error: "L'operation a echoue. Veuillez reessayer." };
    }

    if (user.kycStatus !== "verified") {
      return { success: false, error: "Verification KYC requise" };
    }

    const netAmount = Math.floor(amount);
    const providerCurrency = getMoneyFusionCurrency(country);
    const balanceCurrency = userCurrency || providerCurrency;

    const feeConfig = await getFeeFromDatabase(storage, "moneyfusion", country, operator);
    const feeInfo = calculateOutgoingFee(netAmount, feeConfig.outgoing);
    const totalToDebit = netAmount + feeInfo.feeAmount;

    if (user.balance < totalToDebit) {
      return { success: false, error: "L'operation ne peut pas etre effectuee pour le moment. Veuillez reessayer plus tard." };
    }

    let amountForProvider = netAmount;
    if (balanceCurrency !== providerCurrency) {
      const { convertCurrency } = await import("./currency-converter");
      const conversionResult = await convertCurrency(netAmount, balanceCurrency, providerCurrency);
      if (conversionResult.success) {
        amountForProvider = Math.floor(conversionResult.convertedAmount);
        console.log(`[MoneyFusion Transfer] Currency conversion: ${netAmount} ${balanceCurrency} -> ${amountForProvider} ${providerCurrency}`);
      } else {
        console.error("[MoneyFusion Transfer] Currency conversion failed:", conversionResult.error);
        return { success: false, error: "Erreur de conversion de devise" };
      }
    }

    const orderId = `BKAPAY-MF-TF-${Date.now()}`;
    const startTime = Date.now();

    await storage.updateUserBalance(userId, -totalToDebit);

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
      description: `Transfert de ${netAmount} ${balanceCurrency}`,
      customerPhone: phone,
      metadata: JSON.stringify({
        phone,
        totalDebited: totalToDebit,
        providerAmount: amountForProvider,
        providerCurrency: providerCurrency,
        balanceAmount: netAmount,
        balanceCurrency: balanceCurrency,
        provider: "moneyfusion",
        paymentProvider: "moneyfusion",
        orderId,
        startTime,
      }),
    });

    const result = await createMoneyFusionPayout({
      amount: amountForProvider,
      phone: phone,
      countryCode: country,
      operatorCode: operator,
    });

    if (!result.success) {
      await storage.updateUserBalance(userId, totalToDebit);
      await storage.updateTransactionStatus(tx.id, "failed");
      const errorMsg = result.error ? result.error.replace("Retrait", "Transfert") : "L'operation a echoue.";
      return { success: false, transactionId: tx.id, error: errorMsg };
    }

    const updatedMetadata = JSON.stringify({
      moneyFusionTokenPay: result.tokenPay,
      phone,
      totalDebited: totalToDebit,
      providerAmount: amountForProvider,
      providerCurrency: providerCurrency,
      balanceAmount: netAmount,
      balanceCurrency: balanceCurrency,
      provider: "moneyfusion",
      paymentProvider: "moneyfusion",
      orderId,
      startTime,
    });
    await storage.updateTransactionMetadata(tx.id, updatedMetadata);

    await storage.updateTransactionStatus(tx.id, "completed");
    console.log(`[MoneyFusion Transfer] Transaction ${tx.id} marked as COMPLETED (provider accepted with tokenPay: ${result.tokenPay})`);

    return {
      success: true,
      transactionId: tx.id,
      message: "Operation effectuee avec succes.",
    };
  } catch (error: any) {
    console.error("[MoneyFusion Transfer] Error:", error);
    return { success: false, error: "L'operation a echoue." };
  }
}
