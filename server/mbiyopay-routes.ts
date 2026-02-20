import type { Request, Response } from "express";
import { storage } from "./storage";

import { calculateIncomingFee, calculateOutgoingFee, getFeeFromDatabase } from "./utils/fees";
import { safeRefundOutgoingTransaction } from "./payment-polling";
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
  originalCurrency?: string,
  otpCode?: string
): Promise<{ success: boolean; transactionId?: string; mbiyopayTransactionId?: string; redirectUrl?: string; message?: string; error?: string; instructions?: string }> {
  try {
    const countryLower = country.toLowerCase();
    if (!MBIYOPAY_SUPPORTED_COUNTRIES.includes(countryLower)) {
      return { success: false, error: `Ce pays n'est pas encore disponible pour les depots` };
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

    const orderId = `BKAPAY-DEP-${Date.now()}`;
    const startTime = Date.now();

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
        netAmountForUser: feeInfo.netAmount,
        balanceAmount: feeInfo.netAmount,
        balanceCurrency: userCurrency,
        orderId,
        startTime,
      }),
    });

    const result = await createMbiyoPayPayin({
      amount: providerAmount,
      currency: providerCurrency,
      phone: phone,
      countryCode: country,
      network: operator,
      orderId,
      callbackUrl: `${process.env.BASE_URL || "https://bkapay.com"}/api/webhooks/mbiyopay`,
      otpCode,
    });

    if (!result.success) {
      await storage.updateTransactionStatus(tx.id, "failed");
      return { success: false, transactionId: tx.id, error: result.error || "Erreur lors du depot" };
    }

    // If pending (ambiguous API response), keep transaction pending and wait for webhook
    if (result.pending) {
      console.log(`[MbiyoPay Deposit] Ambiguous API response - transaction ${tx.id} stays pending, waiting for webhook`);
      return {
        success: true,
        transactionId: tx.id,
        message: result.message || "Paiement en cours de traitement. Veuillez patienter.",
      };
    }

    const updatedMetadata = JSON.stringify({
      mbiyopayTransactionId: result.transactionId,
      redirectUrl: result.redirectUrl,
      phone,
      provider: "mbiyopay",
      paymentProvider: "mbiyopay",
      providerAmount,
      providerCurrency,
      netAmountForUser: feeInfo.netAmount,
      balanceAmount: feeInfo.netAmount,
      balanceCurrency: userCurrency,
      orderId,
      startTime,
    });
    await storage.updateTransactionMetadata(tx.id, updatedMetadata);

    console.log(`[MbiyoPay Deposit] Returning to frontend: transactionId=${tx.id}, redirectUrl=${result.redirectUrl || "NONE"}, instructions=${result.instructions || "NONE"}`);
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
  userCurrency?: string,
  targetCurrency?: string
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
    const defaultCurrency = getCurrencyForCountry(country);
    const { getMbiyoPayCurrenciesForCountry } = await import("@shared/mbiyopay-countries");
    const supportedCurrencies = getMbiyoPayCurrenciesForCountry(country.toUpperCase());
    const providerCurrency = (targetCurrency && supportedCurrencies.includes(targetCurrency)) 
      ? targetCurrency 
      : (userCurrency && supportedCurrencies.includes(userCurrency)) ? userCurrency : defaultCurrency;
    const balanceCurrency = userCurrency || providerCurrency;
    
    console.log(`[MbiyoPay Withdrawal] Currency selection: userCurrency=${userCurrency}, targetCurrency=${targetCurrency}, defaultCurrency=${defaultCurrency}, supportedCurrencies=${supportedCurrencies.join(",")}, providerCurrency=${providerCurrency}, balanceCurrency=${balanceCurrency}`);
    
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

    const orderId = `BKAPAY-WD-${Date.now()}`;
    const startTime = Date.now();

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
        orderId,
        startTime,
      }),
    });

    const result = await createMbiyoPayPayout({
      amount: amountForProvider,
      currency: providerCurrency,
      phone: phone,
      countryCode: country,
      network: operator,
      orderId,
      callbackUrl: `${process.env.BASE_URL || "https://bkapay.com"}/api/webhooks/mbiyopay`,
      beneficiaryName,
    });

    if (!result.success && !result.transactionId) {
      await storage.updateUserBalance(userId, feeInfo.totalDeductedFromBalance);
      await storage.updateTransactionStatus(tx.id, "failed");
      return { success: false, transactionId: tx.id, error: result.error || "Retrait echoue" };
    }

    if (!result.success && result.transactionId) {
      console.log(`[MbiyoPay Withdrawal] API returned transactionId ${result.transactionId} but success=false - keeping pending for admin review`);
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
        orderId,
        startTime,
      });
      await storage.updateTransactionMetadata(tx.id, updatedMetadata);
      return {
        success: true,
        transactionId: tx.id,
        message: "Retrait en cours de traitement. Veuillez patienter.",
      };
    }

    if (result.pending) {
      console.log(`[MbiyoPay Withdrawal] Ambiguous API response - transaction ${tx.id} stays pending, waiting for webhook`);
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
        orderId,
        startTime,
      });
      await storage.updateTransactionMetadata(tx.id, updatedMetadata);
      return {
        success: true,
        transactionId: tx.id,
        message: result.message || "Retrait en cours de traitement. Veuillez patienter.",
      };
    }

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
      orderId,
      startTime,
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
  userCurrency?: string,
  targetCurrency?: string
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
    const defaultCurrency = getCurrencyForCountry(country);
    const { getMbiyoPayCurrenciesForCountry } = await import("@shared/mbiyopay-countries");
    const supportedCurrencies = getMbiyoPayCurrenciesForCountry(country.toUpperCase());
    const providerCurrency = (targetCurrency && supportedCurrencies.includes(targetCurrency)) 
      ? targetCurrency 
      : (userCurrency && supportedCurrencies.includes(userCurrency)) ? userCurrency : defaultCurrency;
    const balanceCurrency = userCurrency || providerCurrency;
    
    console.log(`[MbiyoPay Transfer] Currency selection: userCurrency=${userCurrency}, targetCurrency=${targetCurrency}, defaultCurrency=${defaultCurrency}, supportedCurrencies=${supportedCurrencies.join(",")}, providerCurrency=${providerCurrency}, balanceCurrency=${balanceCurrency}`);
    
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

    const orderId = `BKAPAY-TF-${Date.now()}`;
    const startTime = Date.now();

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
        orderId,
        startTime,
      }),
    });

    const result = await createMbiyoPayPayout({
      amount: amountForProvider,
      currency: providerCurrency,
      phone: phone,
      countryCode: country,
      network: operator,
      orderId,
      callbackUrl: `${process.env.BASE_URL || "https://bkapay.com"}/api/webhooks/mbiyopay`,
      beneficiaryName,
    });

    if (!result.success && !result.transactionId) {
      await storage.updateUserBalance(userId, totalToDebit);
      await storage.updateTransactionStatus(tx.id, "failed");
      const errorMsg = result.error ? result.error.replace("Retrait", "Transfert") : "Transfert echoue";
      return { success: false, transactionId: tx.id, error: errorMsg };
    }

    if (!result.success && result.transactionId) {
      console.log(`[MbiyoPay Transfer] API returned transactionId ${result.transactionId} but success=false - keeping pending for admin review`);
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
        orderId,
        startTime,
      });
      await storage.updateTransactionMetadata(tx.id, updatedMetadata);
      return {
        success: true,
        transactionId: tx.id,
        message: "Transfert en cours de traitement. Veuillez patienter.",
      };
    }

    if (result.pending) {
      console.log(`[MbiyoPay Transfer] Ambiguous API response - transaction ${tx.id} stays pending, waiting for webhook`);
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
        orderId,
        startTime,
      });
      await storage.updateTransactionMetadata(tx.id, updatedMetadata);
      return {
        success: true,
        transactionId: tx.id,
        message: result.message || "Transfert en cours de traitement. Veuillez patienter.",
      };
    }

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
      orderId,
      startTime,
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
  ownerCurrency?: string,
  otpCode?: string
): Promise<{ success: boolean; transactionId?: string; mbiyopayTransactionId?: string; redirectUrl?: string; message?: string; error?: string; instructions?: string }> {
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

    const orderId = `BKAPAY-PL-${paymentLink.id}-${Date.now()}`;
    const startTime = Date.now();

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
        netAmountForUser: customerPaysFee ? baseAmount : feeInfo.netAmount,
        providerAmount,
        providerCurrency,
        balanceAmount: customerPaysFee ? baseAmount : feeInfo.netAmount,
        balanceCurrency,
        provider: "mbiyopay",
        paymentProvider: "mbiyopay",
        orderId,
        startTime,
      }),
    });

    const result = await createMbiyoPayPayin({
      amount: providerAmount,
      currency: providerCurrency,
      phone: customerPhone,
      countryCode: country,
      network: operator,
      orderId,
      callbackUrl: `${process.env.BASE_URL || "https://bkapay.com"}/api/webhooks/mbiyopay`,
      otpCode,
    });

    if (!result.success) {
      await storage.updateTransactionStatus(tx.id, "failed");
      return { success: false, transactionId: tx.id, error: result.error || "Erreur lors du paiement" };
    }

    if (result.pending) {
      console.log(`[MbiyoPay PaymentLink] Ambiguous API response - transaction ${tx.id} stays pending, waiting for webhook`);
      return {
        success: true,
        transactionId: tx.id,
        message: result.message || "Paiement en cours de traitement. Veuillez patienter.",
      };
    }

    const updatedMetadata = JSON.stringify({
      mbiyopayTransactionId: result.transactionId,
      redirectUrl: result.redirectUrl,
      paymentLinkId: paymentLink.id,
      customerPaysFee,
      netAmountForUser: customerPaysFee ? baseAmount : feeInfo.netAmount,
      providerAmount,
      providerCurrency,
      balanceAmount: customerPaysFee ? baseAmount : feeInfo.netAmount,
      balanceCurrency,
      provider: "mbiyopay",
      paymentProvider: "mbiyopay",
      orderId,
      startTime,
    });
    await storage.updateTransactionMetadata(tx.id, updatedMetadata);

    return {
      success: true,
      transactionId: tx.id,
      mbiyopayTransactionId: result.transactionId,
      redirectUrl: result.redirectUrl,
      instructions: result.instructions,
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
  payerCurrency?: string,
  otpCode?: string
): Promise<{ success: boolean; transactionId?: string; mbiyopayTransactionId?: string; redirectUrl?: string; message?: string; error?: string; instructions?: string }> {
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

    const orderId = `BKAPAY-ML-${merchantLink.id}-${Date.now()}`;
    const startTime = Date.now();

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
        netAmountForUser: feeInfo.netAmount,
        providerAmount,
        providerCurrency,
        balanceAmount: feeInfo.netAmount,
        balanceCurrency,
        provider: "mbiyopay",
        paymentProvider: "mbiyopay",
        orderId,
        startTime,
      }),
    });

    const result = await createMbiyoPayPayin({
      amount: providerAmount,
      currency: providerCurrency,
      phone: customerPhone,
      countryCode: country,
      network: operator,
      orderId,
      callbackUrl: `${process.env.BASE_URL || "https://bkapay.com"}/api/webhooks/mbiyopay`,
      otpCode,
    });

    if (!result.success) {
      await storage.updateTransactionStatus(tx.id, "failed");
      return { success: false, transactionId: tx.id, error: result.error || "Erreur lors du paiement" };
    }

    if (result.pending) {
      console.log(`[MbiyoPay MerchantLink] Ambiguous API response - transaction ${tx.id} stays pending, waiting for webhook`);
      return {
        success: true,
        transactionId: tx.id,
        message: result.message || "Paiement en cours de traitement. Veuillez patienter.",
      };
    }

    const updatedMetadata = JSON.stringify({
      mbiyopayTransactionId: result.transactionId,
      redirectUrl: result.redirectUrl,
      merchantLinkId: merchantLink.id,
      netAmountForUser: feeInfo.netAmount,
      providerAmount,
      providerCurrency,
      balanceAmount: feeInfo.netAmount,
      balanceCurrency,
      provider: "mbiyopay",
      paymentProvider: "mbiyopay",
      orderId,
      startTime,
    });
    await storage.updateTransactionMetadata(tx.id, updatedMetadata);

    return {
      success: true,
      transactionId: tx.id,
      mbiyopayTransactionId: result.transactionId,
      redirectUrl: result.redirectUrl,
      instructions: result.instructions,
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
  callbackUrl?: string,
  otpCode?: string
): Promise<{ success: boolean; transactionId?: string; mbiyopayTransactionId?: string; redirectUrl?: string; message?: string; error?: string; instructions?: string }> {
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

    const orderId = `BKAPAY-API-${apiKey.id}-${Date.now()}`;
    const startTime = Date.now();

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
        orderId,
        startTime,
      }),
    });

    const result = await createMbiyoPayPayin({
      amount: grossAmount,
      currency: currency,
      phone: customerPhone,
      countryCode: country,
      network: operator,
      orderId,
      callbackUrl: `${process.env.BASE_URL || "https://bkapay.com"}/api/webhooks/mbiyopay`,
      otpCode,
    });

    if (!result.success) {
      await storage.updateTransactionStatus(tx.id, "failed");
      return { success: false, transactionId: tx.id, error: result.error || "Erreur lors du paiement" };
    }

    if (result.pending) {
      console.log(`[MbiyoPay API Payment] Ambiguous API response - transaction ${tx.id} stays pending, waiting for webhook`);
      return {
        success: true,
        transactionId: tx.id,
        message: result.message || "Paiement en cours de traitement. Veuillez patienter.",
      };
    }

    const updatedMetadata = JSON.stringify({
      mbiyopayTransactionId: result.transactionId,
      redirectUrl: result.redirectUrl,
      apiKeyId: apiKey.id,
      grossAmount,
      provider: "mbiyopay",
      paymentProvider: "mbiyopay",
      developerCallbackUrl: callbackUrl,
      orderId,
      startTime,
    });
    await storage.updateTransactionMetadata(tx.id, updatedMetadata);

    return {
      success: true,
      transactionId: tx.id,
      mbiyopayTransactionId: result.transactionId,
      redirectUrl: result.redirectUrl,
      instructions: result.instructions,
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
    const { event, transaction_id, order_id, status } = payload;
    console.log("[MbiyoPay Webhook] Full payload:", JSON.stringify(payload));

    if (!transaction_id && !order_id) {
      console.warn(`[SECURITY] MbiyoPay webhook without transaction_id or order_id from IP: ${clientIP}`);
      return res.status(400).json({ error: "Missing transaction_id and order_id" });
    }

    const pendingTransactions = await storage.getAllPendingTransactions();
    let tx = pendingTransactions.find((t: any) => {
      try {
        const metadata = JSON.parse(t.metadata || "{}");
        return metadata.mbiyopayTransactionId === transaction_id;
      } catch {
        return false;
      }
    });
    
    if (!tx && order_id) {
      tx = pendingTransactions.find((t: any) => {
        try {
          const metadata = JSON.parse(t.metadata || "{}");
          return metadata.orderId === order_id;
        } catch {
          return false;
        }
      });
    }

    // If not found in pending, search ALL recent MbiyoPay transactions (including failed ones)
    // This handles the case where a transaction was prematurely marked as "failed" 
    // due to ambiguous API response but the payment actually went through
    if (!tx && (transaction_id || order_id)) {
      const allTransactions = await storage.getAllTransactionsForAdmin(200);
      tx = allTransactions.find((t: any) => {
        try {
          const metadata = JSON.parse(t.metadata || "{}");
          if (metadata.paymentProvider !== "mbiyopay") return false;
          if (transaction_id && metadata.mbiyopayTransactionId === transaction_id) return true;
          if (order_id && metadata.orderId === order_id) return true;
          return false;
        } catch {
          return false;
        }
      });
      if (tx) {
        console.log(`[MbiyoPay Webhook] Found transaction ${tx.id} in all transactions (status: ${tx.status})`);
      }
    }

    // Update metadata with mbiyopayTransactionId if matched by orderId
    if (tx && transaction_id) {
      try {
        const existingMeta = JSON.parse(tx.metadata || "{}");
        if (!existingMeta.mbiyopayTransactionId && transaction_id) {
          existingMeta.mbiyopayTransactionId = transaction_id;
          await storage.updateTransactionMetadata(tx.id, JSON.stringify(existingMeta));
          console.log(`[MbiyoPay Webhook] Updated metadata with mbiyopayTransactionId: ${transaction_id}`);
        }
      } catch (e) {
        console.error(`[MbiyoPay Webhook] Failed to update metadata:`, e);
      }
    }
    
    if (!tx) {
      console.warn(`[SECURITY] MbiyoPay webhook for unknown transaction from IP ${clientIP}: transaction_id=${transaction_id}, order_id=${order_id}`);
      return res.status(404).json({ error: "Transaction not found" });
    }

    if (tx.status === "completed") {
      console.log(`[MbiyoPay Webhook] Transaction ${tx.id} already completed`);
      return res.json({ success: true, message: "Already processed" });
    }

    // Allow processing of "failed" transactions if webhook says successful
    // (handles case where API returned ambiguous response but payment actually went through)
    if (tx.status === "failed" && status !== "successful") {
      console.log(`[MbiyoPay Webhook] Transaction ${tx.id} already failed and webhook status is ${status} - skipping`);
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
      
      const wasAlreadyFailed = tx.status === "failed";
      
      if (tx.type === "deposit" || tx.type === "payment_link" || tx.type === "merchant_link" || tx.type === "api_payment") {
        // For incoming transactions: recover from "failed" by resetting to "pending" first
        if (wasAlreadyFailed) {
          console.log(`[MbiyoPay Webhook] Recovering failed deposit ${tx.id} - resetting to pending before finalizing`);
          await storage.updateTransactionStatus(tx.id, "pending");
        }
        const result = await storage.finalizeIncomingTransaction(tx.id, {});
        if (result) {
          console.log(`[MbiyoPay Webhook] Deposit completed: ${tx.id}, credited=${result.credited}, netAmount=${result.transaction.amount - (result.transaction.fee || 0)}`);
        } else {
          console.log(`[MbiyoPay Webhook] Transaction ${tx.id} already processed by polling - skipping`);
        }
      } else if (tx.type === "withdrawal" || tx.type === "transfer") {
        if (wasAlreadyFailed) {
          // For outgoing transactions that were already "failed" and refunded:
          // We must re-debit the user's balance before marking as completed
          const txMetadata = JSON.parse(tx.metadata || "{}");
          const reDebitAmount = txMetadata.deductedFromBalance || txMetadata.totalDebited || tx.amount;
          await storage.updateUserBalance(tx.userId, -reDebitAmount);
          console.log(`[MbiyoPay Webhook] Re-debited ${reDebitAmount} from user ${tx.userId} for recovered ${tx.type} ${tx.id}`);
        }
        await storage.updateTransactionStatus(tx.id, "completed");
        console.log(`[MbiyoPay Webhook] Withdrawal/Transfer completed: ${tx.id}`);
      }
    } else if (status === "failed" || status === "cancelled" || status === "expired" || status === "rejected" || status === "error") {
      if (tx.type === "withdrawal" || tx.type === "transfer") {
        const metadata = JSON.parse(tx.metadata || "{}");
        await safeRefundOutgoingTransaction(tx.id, tx.userId, metadata, "webhook-mbiyopay-failed");
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
    } else if (apiStatus === "failed" || apiStatus === "cancelled" || apiStatus === "expired" || apiStatus === "rejected" || apiStatus === "error") {
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
