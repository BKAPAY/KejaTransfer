import { storage } from "./storage";
import { calculateIncomingFee, calculateOutgoingFee, getFeeFromDatabase } from "./utils/fees";
import { safeRefundOutgoingTransaction } from "./payment-polling";
import {
  getFeeXPayConfig,
  createFeeXPayPayin,
  createFeeXPayPayout,
  translateFeeXPayError,
} from "./feexpay";
import {
  FEEXPAY_COUNTRIES,
  getCurrencyForCountry,
  getNetworkKey,
  operatorRequiresOtp,
  formatPhoneForFeeXPay,
  isRedirectFlowOperator,
} from "@shared/feexpay-countries";

export async function handleFeeXPayDeposit(
  userId: string,
  user: any,
  amount: number,
  country: string,
  operator: string,
  phone: string,
  otpCode?: string,
  currency?: string,
  originalAmount?: number,
  originalCurrency?: string,
  options?: {
    transactionType?: "deposit" | "payment_link" | "merchant_link" | "api_payment";
    transactionDescription?: string;
    customerName?: string;
    customerEmail?: string;
    customerPaysFee?: boolean;
    extraMetadata?: Record<string, any>;
  }
): Promise<{
  success: boolean;
  transactionId?: string;
  feeXPayReference?: string;
  message?: string;
  error?: string;
  requiresOtp?: boolean;
  otpInstructions?: string;
  redirectUrl?: string;
}> {
  try {
    const countryCode = country.toUpperCase();
    const countryConfig = FEEXPAY_COUNTRIES.find(c => c.code === countryCode);
    if (!countryConfig) {
      return { success: false, error: `Pays non supporte pour FeeXPay: ${country}` };
    }

    const operatorConfig = countryConfig.operators.find(op => op.code === operator.toLowerCase() && op.payin);
    if (!operatorConfig) {
      return { success: false, error: `Operateur ${operator} non supporte pour ${country} (FeeXPay)` };
    }

    const config = await getFeeXPayConfig();
    if (!config) {
      return { success: false, error: "FeeXPay non configure" };
    }

    const networkKey = getNetworkKey(countryCode, operator);
    if (!networkKey) {
      return { success: false, error: "Reseau non supporte" };
    }

    const webhookUrl = `${process.env.BASE_URL || "https://bkapay.com"}/api/webhooks/feexpay`;

    if (operatorConfig.requiresOtp && !otpCode) {
      const formattedPhone = formatPhoneForFeeXPay(phone, countryCode);
      const providerAmount = Math.floor(amount);
      const triggerResult = await createFeeXPayPayin(config, {
        networkKey,
        shopId: config.shopId,
        amount: providerAmount,
        phoneNumber: formattedPhone,
        otpCode: "",
        callbackUrl: webhookUrl,
      });

      if (!triggerResult.success) {
        return { success: false, error: translateFeeXPayError(triggerResult.error, "deposit") };
      }

      return {
        success: false,
        error: "Code OTP requis pour ce paiement",
        requiresOtp: true,
        otpInstructions: `Un code OTP a ete envoye par SMS au ${phone}. Entrez-le pour confirmer le paiement.`,
      };
    }

    const providerCurrency = currency || getCurrencyForCountry(countryCode);
    const balanceAmount = originalAmount ? Math.floor(originalAmount) : Math.floor(amount);
    const userCurrency = originalCurrency || providerCurrency;
    const providerAmount = Math.floor(amount);

    const feeConfig = await getFeeFromDatabase(storage, "feexpay", country, operator);
    const feeInfo = calculateIncomingFee(balanceAmount, feeConfig.incoming);

    // Calculate exchange fee if payer currency differs from merchant currency (personal accounts only)
    let incomingExchangeFee = 0;
    let incomingExchangeFeePercentage = 0;
    if (providerCurrency !== userCurrency && user.accountType === "personal") {
      try {
        let efRow = await storage.getCurrencyExchangeFee(providerCurrency, userCurrency);
        if (!efRow || !efRow.isActive) {
          efRow = await storage.getCurrencyExchangeFee(userCurrency, providerCurrency);
        }
        if (efRow && efRow.isActive && efRow.feePercentage > 0) {
          incomingExchangeFee = Math.floor((balanceAmount * efRow.feePercentage) / 1000);
          incomingExchangeFeePercentage = efRow.feePercentage;
        }
      } catch (_) { /* ignore */ }
    }
    const netAmountForUser = Math.max(0, feeInfo.netAmount - incomingExchangeFee);
    const totalFeeAmount = feeInfo.feeAmount + incomingExchangeFee;
    const totalFeePercentage = feeInfo.feePercentage + incomingExchangeFeePercentage;

    const formattedPhone = formatPhoneForFeeXPay(phone, countryCode);

    const result = await createFeeXPayPayin(config, {
      networkKey,
      shopId: config.shopId,
      amount: providerAmount,
      phoneNumber: formattedPhone,
      otpCode,
      callbackUrl: webhookUrl,
    });

    if (!result.success) {
      return { success: false, error: translateFeeXPayError(result.error, "deposit") };
    }

    if (operatorConfig.isRedirectFlow && !result.redirectUrl) {
      console.warn(`[FeeXPay Deposit] Redirect operator ${networkKey} did not return a redirect URL`);
    }

    const txType = options?.transactionType || "deposit";
    const txDescription = options?.transactionDescription || `Depot de ${providerAmount} ${providerCurrency}`;

    const tx = await storage.createTransaction({
      userId,
      type: txType,
      amount: balanceAmount,
      fee: totalFeeAmount,
      feePercentage: totalFeePercentage,
      currency: userCurrency,
      status: "pending",
      country: countryCode,
      operator,
      description: txDescription,
      customerPhone: phone,
      customerName: options?.customerName || null,
      customerEmail: options?.customerEmail || null,
      metadata: JSON.stringify({
        feeXPayReference: result.reference,
        phone,
        provider: "feexpay",
        networkKey,
        providerAmount,
        providerCurrency,
        netAmountForUser,
        balanceAmount: netAmountForUser,
        balanceCurrency: userCurrency,
        ...(incomingExchangeFee > 0 ? { exchangeFee: incomingExchangeFee, exchangeFeePercentage: incomingExchangeFeePercentage } : {}),
        ...(options?.customerPaysFee !== undefined ? { customerPaysFee: options.customerPaysFee } : {}),
        ...(result.redirectUrl ? { redirectUrl: result.redirectUrl } : {}),
        ...(options?.extraMetadata || {}),
      }),
    });

    let message = result.message || "Paiement initie avec succes. Validez sur votre telephone.";
    if (result.redirectUrl) {
      message = "Paiement initie. Veuillez suivre le lien pour finaliser.";
    }

    return {
      success: true,
      transactionId: tx.id,
      feeXPayReference: result.reference,
      message,
      redirectUrl: result.redirectUrl,
    };
  } catch (error: any) {
    console.error("[FeeXPay Deposit] Error:", error);
    return { success: false, error: translateFeeXPayError(error?.message, "deposit") };
  }
}

export async function handleFeeXPayWithdrawal(
  userId: string,
  user: any,
  amount: number,
  country: string,
  operator: string,
  phone: string,
  userCurrency?: string,
  isTransfer: boolean = false,
  securityCode?: string,
  skipBalanceOps: boolean = false
): Promise<{ success: boolean; transactionId?: string; message?: string; error?: string }> {
  try {
    const countryCode = country.toUpperCase();
    const countryConfig = FEEXPAY_COUNTRIES.find(c => c.code === countryCode);
    if (!countryConfig) {
      return { success: false, error: "Retrait echoue" };
    }

    const operatorConfig = countryConfig.operators.find(op => op.code === operator.toLowerCase() && op.payout);
    if (!operatorConfig) {
      return { success: false, error: "Operateur non supporte pour les retraits (FeeXPay)" };
    }

    if (user.kycStatus !== "verified") {
      return { success: false, error: "Verification KYC requise" };
    }

    const config = await getFeeXPayConfig();
    if (!config) {
      return { success: false, error: "FeeXPay non configure" };
    }

    const networkKey = getNetworkKey(countryCode, operator);
    if (!networkKey) {
      return { success: false, error: "Reseau non supporte" };
    }

    const grossAmount = Math.floor(amount);
    const providerCurrency = getCurrencyForCountry(countryCode);
    const balanceCurrency = userCurrency || providerCurrency;

    const feeConfig = await getFeeFromDatabase(storage, "feexpay", country, operator);
    const feeInfo = calculateOutgoingFee(grossAmount, feeConfig.outgoing);

    if (!skipBalanceOps && user.balance < feeInfo.totalDeductedFromBalance) {
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

    const formattedPhone = formatPhoneForFeeXPay(phone, countryCode);

    // Debit balance and create pending transaction immediately
    if (!skipBalanceOps) {
      await storage.updateUserBalance(userId, -feeInfo.totalDeductedFromBalance);
    }

    const tx = await storage.createTransaction({
      userId,
      type: "withdrawal",
      amount: grossAmount,
      fee: feeInfo.feeAmount,
      feePercentage: feeInfo.feePercentage,
      currency: balanceCurrency,
      status: "pending",
      country: countryCode,
      operator,
      description: `Retrait de ${grossAmount} ${balanceCurrency}`,
      customerPhone: phone,
      metadata: JSON.stringify({
        phone,
        provider: "feexpay",
        networkKey,
        providerAmount: amountForProvider,
        providerCurrency,
        balanceAmount: grossAmount,
        balanceCurrency,
        deductedFromBalance: feeInfo.totalDeductedFromBalance,
        totalDebited: feeInfo.totalDeductedFromBalance,
      }),
    });

    // Dispatch to FeeXPay 5s after securing the funds
    const feeXTxId = tx.id;
    setTimeout(async () => {
      try {
        const result = await createFeeXPayPayout(config, {
          networkKey,
          shopId: config.shopId,
          amount: amountForProvider,
          phoneNumber: formattedPhone,
        });

        if (!result.success) {
          console.error(`[FeeXPay Withdrawal] Dispatch failed for ${feeXTxId} - refunding:`, result.error);
          await safeRefundOutgoingTransaction(feeXTxId, userId, { deductedFromBalance: feeInfo.totalDeductedFromBalance, scope: skipBalanceOps ? "business" : undefined }, "feexpay-dispatch-failed");
          return;
        }

        await storage.updateTransactionMetadata(feeXTxId, JSON.stringify({
          feeXPayReference: result.reference,
          phone,
          provider: "feexpay",
          networkKey,
          providerAmount: amountForProvider,
          providerCurrency,
          balanceAmount: grossAmount,
          balanceCurrency,
          deductedFromBalance: feeInfo.totalDeductedFromBalance,
          totalDebited: feeInfo.totalDeductedFromBalance,
        }));
        console.log(`[FeeXPay Withdrawal] Dispatched tx ${feeXTxId}, reference: ${result.reference}`);
      } catch (dispatchErr) {
        console.error(`[FeeXPay Withdrawal] Dispatch error for ${feeXTxId}:`, dispatchErr);
        await safeRefundOutgoingTransaction(feeXTxId, userId, { deductedFromBalance: feeInfo.totalDeductedFromBalance }, "feexpay-dispatch-error");
      }
    }, 5000);

    return {
      success: true,
      transactionId: tx.id,
      message: "Retrait en cours de traitement",
    };
  } catch (error: any) {
    console.error("[FeeXPay Withdrawal] Error:", error);
    return { success: false, error: "Le retrait n'a pas abouti. Votre solde n'a pas ete debite. Veuillez reessayer ou contacter le support." };
  }
}

export async function handleFeeXPayTransfer(
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
    const countryConfig = FEEXPAY_COUNTRIES.find(c => c.code === countryCode);
    if (!countryConfig) {
      return { success: false, error: "Transfert echoue" };
    }

    const operatorConfig = countryConfig.operators.find(op => op.code === operator.toLowerCase() && op.payout);
    if (!operatorConfig) {
      return { success: false, error: "Operateur non supporte pour les transferts (FeeXPay)" };
    }

    if (user.kycStatus !== "verified") {
      return { success: false, error: "Verification KYC requise" };
    }

    const config = await getFeeXPayConfig();
    if (!config) {
      return { success: false, error: "FeeXPay non configure" };
    }

    const networkKey = getNetworkKey(countryCode, operator);
    if (!networkKey) {
      return { success: false, error: "Reseau non supporte" };
    }

    const netAmount = Math.floor(amount);
    const providerCurrency = getCurrencyForCountry(countryCode);
    const balanceCurrency = userCurrency || providerCurrency;

    const feeConfig = await getFeeFromDatabase(storage, "feexpay", country, operator);
    const { calculateOutgoingFeeFromNet } = await import("./utils/fees");
    const feeInfo = calculateOutgoingFeeFromNet(netAmount, feeConfig.outgoing);

    if (user.balance < feeInfo.totalDeductedFromBalance) {
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

    const formattedPhone = formatPhoneForFeeXPay(phone, countryCode);

    // Debit balance and create pending transaction immediately
    await storage.updateUserBalance(userId, -feeInfo.totalDeductedFromBalance);

    const tx = await storage.createTransaction({
      userId,
      type: "transfer",
      amount: netAmount,
      fee: feeInfo.feeAmount,
      feePercentage: feeInfo.feePercentage,
      currency: balanceCurrency,
      status: "pending",
      country: countryCode,
      operator,
      description: `Transfert de ${netAmount} ${balanceCurrency}`,
      customerPhone: phone,
      metadata: JSON.stringify({
        phone,
        provider: "feexpay",
        networkKey,
        providerAmount: amountForProvider,
        providerCurrency,
        balanceAmount: netAmount,
        balanceCurrency,
        deductedFromBalance: feeInfo.totalDeductedFromBalance,
        totalDebited: feeInfo.totalDeductedFromBalance,
      }),
    });

    // Dispatch to FeeXPay 5s after securing the funds
    const feeXTransferTxId = tx.id;
    setTimeout(async () => {
      try {
        const result = await createFeeXPayPayout(config, {
          networkKey,
          shopId: config.shopId,
          amount: amountForProvider,
          phoneNumber: formattedPhone,
        });

        if (!result.success) {
          console.error(`[FeeXPay Transfer] Dispatch failed for ${feeXTransferTxId} - refunding:`, result.error);
          await safeRefundOutgoingTransaction(feeXTransferTxId, userId, { deductedFromBalance: feeInfo.totalDeductedFromBalance }, "feexpay-transfer-dispatch-failed");
          return;
        }

        await storage.updateTransactionMetadata(feeXTransferTxId, JSON.stringify({
          feeXPayReference: result.reference,
          phone,
          provider: "feexpay",
          networkKey,
          providerAmount: amountForProvider,
          providerCurrency,
          balanceAmount: netAmount,
          balanceCurrency,
          deductedFromBalance: feeInfo.totalDeductedFromBalance,
          totalDebited: feeInfo.totalDeductedFromBalance,
        }));
        console.log(`[FeeXPay Transfer] Dispatched tx ${feeXTransferTxId}, reference: ${result.reference}`);
      } catch (dispatchErr) {
        console.error(`[FeeXPay Transfer] Dispatch error for ${feeXTransferTxId}:`, dispatchErr);
        await safeRefundOutgoingTransaction(feeXTransferTxId, userId, { deductedFromBalance: feeInfo.totalDeductedFromBalance }, "feexpay-transfer-dispatch-error");
      }
    }, 5000);

    return {
      success: true,
      transactionId: tx.id,
      message: "Transfert en cours de traitement",
    };
  } catch (error: any) {
    console.error("[FeeXPay Transfer] Error:", error);
    return { success: false, error: "Le transfert n'a pas abouti. Votre solde n'a pas ete debite. Veuillez reessayer ou contacter le support." };
  }
}
