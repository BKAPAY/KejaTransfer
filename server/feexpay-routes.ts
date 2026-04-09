import { storage } from "./storage";
import { calculateIncomingFee, calculateOutgoingFee, getFeeFromDatabase } from "./utils/fees";
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
  originalCurrency?: string
): Promise<{
  success: boolean;
  transactionId?: string;
  feeXPayReference?: string;
  message?: string;
  error?: string;
  requiresOtp?: boolean;
  otpInstructions?: string;
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

    if (operatorConfig.requiresOtp && !otpCode) {
      return {
        success: false,
        error: "Code OTP requis pour ce paiement",
        requiresOtp: true,
        otpInstructions: `Composez le code USSD pour generer un OTP, puis entrez-le ici.`,
      };
    }

    const config = await getFeeXPayConfig();
    if (!config) {
      return { success: false, error: "FeeXPay non configure" };
    }

    const networkKey = getNetworkKey(countryCode, operator);
    if (!networkKey) {
      return { success: false, error: "Reseau non supporte" };
    }

    const providerCurrency = currency || getCurrencyForCountry(countryCode);
    const balanceAmount = originalAmount ? Math.floor(originalAmount) : Math.floor(amount);
    const userCurrency = originalCurrency || providerCurrency;
    const providerAmount = Math.floor(amount);

    const feeConfig = await getFeeFromDatabase(storage, "feexpay", country, operator);
    const feeInfo = calculateIncomingFee(balanceAmount, feeConfig.incoming);

    const formattedPhone = formatPhoneForFeeXPay(phone, countryCode);

    const result = await createFeeXPayPayin(config, {
      networkKey,
      shopId: config.shopId,
      amount: providerAmount,
      phoneNumber: formattedPhone,
      otpCode,
    });

    if (!result.success) {
      return { success: false, error: translateFeeXPayError(result.error, "deposit") };
    }

    const tx = await storage.createTransaction({
      userId,
      type: "deposit",
      amount: feeInfo.grossAmount,
      fee: feeInfo.feeAmount,
      feePercentage: feeInfo.feePercentage,
      currency: userCurrency,
      status: "pending",
      country: countryCode,
      operator,
      description: `Depot de ${providerAmount} ${providerCurrency}`,
      customerPhone: phone,
      metadata: JSON.stringify({
        feeXPayReference: result.reference,
        phone,
        provider: "feexpay",
        networkKey,
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
      feeXPayReference: result.reference,
      message: result.message || "Paiement initie avec succes. Validez sur votre telephone.",
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
  userCurrency?: string
): Promise<{ success: boolean; transactionId?: string; message?: string; error?: string }> {
  try {
    const countryCode = country.toUpperCase();
    const countryConfig = FEEXPAY_COUNTRIES.find(c => c.code === countryCode);
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

    const formattedPhone = formatPhoneForFeeXPay(phone, countryCode);

    const result = await createFeeXPayPayout(config, {
      networkKey,
      shopId: config.shopId,
      amount: amountForProvider,
      phoneNumber: formattedPhone,
    });

    if (!result.success) {
      return { success: false, error: translateFeeXPayError(result.error, "withdrawal") };
    }

    await storage.updateUserBalance(userId, -feeInfo.totalDeductedFromBalance);

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
      }),
    });

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
      return { success: false, error: "Transfert echoue" };
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

    const result = await createFeeXPayPayout(config, {
      networkKey,
      shopId: config.shopId,
      amount: amountForProvider,
      phoneNumber: formattedPhone,
    });

    if (!result.success) {
      return { success: false, error: translateFeeXPayError(result.error, "transfer") };
    }

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
      }),
    });

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
