import { storage } from "./storage";
import type { Transaction, User } from "@shared/schema";
import { getTransactionStatus as getFedaPayTransactionStatus, getPayoutStatus as getFedaPayPayoutStatus } from "./fedapay";
import { NowPaymentsClient } from "./nowpayments";

const PAYDUNYA_MASTER_KEY = process.env.PAYDUNYA_MASTER_KEY;
const PAYDUNYA_PRIVATE_KEY = process.env.PAYDUNYA_PRIVATE_KEY;
const PAYDUNYA_TOKEN = process.env.PAYDUNYA_TOKEN;

// Polling every 5 seconds for active transactions
const POLLING_INTERVAL = 5000;
const PAYMENT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes timeout (Mobile Money)
const CRYPTO_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes timeout (Crypto)

interface PaydunyaStatusResponse {
  response_code: string;
  response_text: string;
  status?: string;
  invoice?: {
    status?: string;
    total_amount?: number;
  };
  custom_data?: any;
}

async function checkPaydunyaStatus(token: string): Promise<PaydunyaStatusResponse | null> {
  try {
    const response = await fetch(`https://app.paydunya.com/api/v1/checkout-invoice/confirm/${token}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "PAYDUNYA-MASTER-KEY": PAYDUNYA_MASTER_KEY || "",
        "PAYDUNYA-PRIVATE-KEY": PAYDUNYA_PRIVATE_KEY || "",
        "PAYDUNYA-TOKEN": PAYDUNYA_TOKEN || "",
      },
    });

    if (!response.ok) {
      console.log(`[PaymentPolling] Paydunya returned status ${response.status} for token ${token}`);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`[PaymentPolling] Error checking Paydunya status:`, error);
    return null;
  }
}

function getTransactionAge(transaction: Transaction): number {
  const createdAt = new Date(transaction.createdAt).getTime();
  return Date.now() - createdAt;
}

function getPaymentTimeoutForTransaction(transaction: Transaction, metadata: any): number {
  // Crypto transactions get 30 minutes timeout
  if (metadata.paymentProvider === "nowpayments" || metadata.isCrypto === true) {
    return CRYPTO_TIMEOUT_MS;
  }
  // Mobile Money and other transactions get 10 minutes
  return PAYMENT_TIMEOUT_MS;
}

function hasPaymentExpired(transaction: Transaction): boolean {
  let metadata: any = {};
  if (transaction.metadata) {
    try {
      metadata = JSON.parse(transaction.metadata);
    } catch (e) {}
  }

  const timeoutMs = getPaymentTimeoutForTransaction(transaction, metadata);

  if (metadata.startTime) {
    const elapsed = Date.now() - metadata.startTime;
    return elapsed >= timeoutMs;
  }

  if (metadata.expiresAt) {
    return Date.now() >= metadata.expiresAt;
  }

  const age = getTransactionAge(transaction);
  return age >= timeoutMs;
}

async function processFedaPayTransaction(transaction: Transaction & { user?: User }, metadata: any): Promise<boolean> {
  const fedapayTransactionId = metadata.fedapayTransactionId;
  const transactionAge = getTransactionAge(transaction);
  const remainingTime = Math.max(0, PAYMENT_TIMEOUT_MS - transactionAge);
  const remainingSeconds = Math.round(remainingTime / 1000);

  console.log(`[PaymentPolling] Checking FedaPay transaction ${transaction.id} (fedapayId: ${fedapayTransactionId}, ${remainingSeconds}s remaining)`);

  try {
    const fedapayStatus = await getFedaPayTransactionStatus(fedapayTransactionId);
    
    console.log(`[PaymentPolling] FedaPay transaction ${transaction.id} - status:`, fedapayStatus.status);

    if (fedapayStatus.status === "approved" || fedapayStatus.status === "transferred") {
      const result = await storage.finalizeIncomingTransaction(transaction.id, {});
      if (result) {
        console.log(`[PaymentPolling] ✅ FedaPay transaction ${transaction.id} CONFIRMED - finalized: credited=${result.credited}`);
      } else {
        console.log(`[PaymentPolling] FedaPay transaction ${transaction.id} already processed - skipping`);
      }
      return true;
    } else if (fedapayStatus.status === "declined" || fedapayStatus.status === "canceled" || fedapayStatus.status === "refunded") {
      console.log(`[PaymentPolling] ❌ FedaPay transaction ${transaction.id} failed/cancelled (status: ${fedapayStatus.status})`);
      await storage.updateTransactionStatus(transaction.id, "failed");
      return true;
    } else {
      // Still pending
      if (hasPaymentExpired(transaction)) {
        const timeoutMinutes = Math.round(PAYMENT_TIMEOUT_MS / 60000);
        console.log(`[PaymentPolling] ⏱️ FedaPay transaction ${transaction.id} TIMEOUT (${timeoutMinutes}min) - marking as failed`);
        await storage.updateTransactionStatus(transaction.id, "failed");
        return true;
      }
      console.log(`[PaymentPolling] ⏳ FedaPay transaction ${transaction.id} still pending (${remainingSeconds}s remaining)`);
      return false;
    }
  } catch (error) {
    console.error(`[PaymentPolling] Error checking FedaPay transaction ${transaction.id}:`, error);
    if (hasPaymentExpired(transaction)) {
      console.log(`[PaymentPolling] ⏱️ FedaPay transaction ${transaction.id} expired with error - marking as failed`);
      await storage.updateTransactionStatus(transaction.id, "failed");
      return true;
    }
    return false;
  }
}

async function getNowPaymentsClient(): Promise<NowPaymentsClient | null> {
  const config = await storage.getProviderConfig("nowpayments");
  if (!config || !config.isActive || !config.apiKey) {
    return null;
  }
  return new NowPaymentsClient({
    apiKey: config.apiKey,
    ipnSecret: config.ipnSecret || undefined,
  });
}

async function processNowPaymentsTransaction(transaction: Transaction & { user?: User }, metadata: any): Promise<boolean> {
  const nowPaymentsPaymentId = metadata.paymentId || metadata.nowPaymentsPaymentId;
  const transactionAge = getTransactionAge(transaction);
  const remainingTime = Math.max(0, CRYPTO_TIMEOUT_MS - transactionAge);
  const remainingSeconds = Math.round(remainingTime / 1000);

  console.log(`[PaymentPolling] Checking NOWPayments transaction ${transaction.id} (paymentId: ${nowPaymentsPaymentId}, ${remainingSeconds}s remaining)`);

  try {
    const client = await getNowPaymentsClient();
    if (!client) {
      console.log(`[PaymentPolling] NOWPayments client not available for transaction ${transaction.id}`);
      if (hasPaymentExpired(transaction)) {
        console.log(`[PaymentPolling] ⏱️ NOWPayments transaction ${transaction.id} TIMEOUT - marking as failed`);
        await storage.updateTransactionStatus(transaction.id, "failed");
        return true;
      }
      return false;
    }

    const status = await client.getPaymentStatus(nowPaymentsPaymentId);
    
    console.log(`[PaymentPolling] NOWPayments transaction ${transaction.id} - status:`, status.payment_status);

    if (status.payment_status === "finished" || status.payment_status === "confirmed") {
      // Payment is confirmed - use atomic finalize to prevent double crediting
      const result = await storage.finalizeIncomingTransaction(transaction.id, {});
      if (result) {
        console.log(`[PaymentPolling] ✅ NOWPayments transaction ${transaction.id} CONFIRMED - credited=${result.credited}`);
      } else {
        console.log(`[PaymentPolling] NOWPayments transaction ${transaction.id} already processed - skipping`);
      }
      return true;
    } else if (status.payment_status === "failed" || status.payment_status === "expired" || status.payment_status === "refunded") {
      console.log(`[PaymentPolling] ❌ NOWPayments transaction ${transaction.id} failed/expired (status: ${status.payment_status})`);
      await storage.updateTransactionStatus(transaction.id, "failed");
      return true;
    } else {
      // Still pending (waiting, confirming, sending, partially_paid)
      if (hasPaymentExpired(transaction)) {
        const timeoutMinutes = Math.round(CRYPTO_TIMEOUT_MS / 60000);
        console.log(`[PaymentPolling] ⏱️ NOWPayments transaction ${transaction.id} TIMEOUT (${timeoutMinutes}min) - marking as failed`);
        await storage.updateTransactionStatus(transaction.id, "failed");
        return true;
      }
      console.log(`[PaymentPolling] ⏳ NOWPayments transaction ${transaction.id} still pending (status: ${status.payment_status}, ${remainingSeconds}s remaining)`);
      return false;
    }
  } catch (error) {
    console.error(`[PaymentPolling] Error checking NOWPayments transaction ${transaction.id}:`, error);
    if (hasPaymentExpired(transaction)) {
      console.log(`[PaymentPolling] ⏱️ NOWPayments transaction ${transaction.id} expired with error - marking as failed`);
      await storage.updateTransactionStatus(transaction.id, "failed");
      return true;
    }
    return false;
  }
}

async function processFedaPayPayout(transaction: Transaction & { user?: User }, metadata: any): Promise<boolean> {
  const fedapayPayoutId = metadata.fedapayPayoutId;
  const transactionAge = getTransactionAge(transaction);
  const remainingTime = Math.max(0, PAYMENT_TIMEOUT_MS - transactionAge);
  const remainingSeconds = Math.round(remainingTime / 1000);

  console.log(`[PaymentPolling] Checking FedaPay payout ${transaction.id} (payoutId: ${fedapayPayoutId}, ${remainingSeconds}s remaining)`);

  try {
    const payoutStatus = await getFedaPayPayoutStatus(fedapayPayoutId);
    
    console.log(`[PaymentPolling] FedaPay payout ${transaction.id} - status:`, payoutStatus.status);

    if (payoutStatus.status === "sent" || payoutStatus.status === "approved") {
      await storage.updateTransactionStatus(transaction.id, "completed");
      console.log(`[PaymentPolling] ✅ FedaPay payout ${transaction.id} COMPLETED`);
      return true;
    } else if (payoutStatus.status === "declined" || payoutStatus.status === "canceled" || payoutStatus.status === "failed") {
      console.log(`[PaymentPolling] ❌ FedaPay payout ${transaction.id} failed (status: ${payoutStatus.status})`);
      await storage.updateTransactionStatus(transaction.id, "failed");
      
      // Refund the balance
      const deductedAmount = metadata.deductedFromBalance;
      if (deductedAmount) {
        await storage.updateUserBalance(transaction.userId, deductedAmount);
        console.log(`[PaymentPolling] Refunded ${deductedAmount} to user ${transaction.userId}`);
      }
      return true;
    } else {
      // Still pending
      if (hasPaymentExpired(transaction)) {
        console.log(`[PaymentPolling] ⏱️ FedaPay payout ${transaction.id} TIMEOUT (10min) - marking as failed`);
        await storage.updateTransactionStatus(transaction.id, "failed");
        
        // Refund the balance
        const deductedAmount = metadata.deductedFromBalance;
        if (deductedAmount) {
          await storage.updateUserBalance(transaction.userId, deductedAmount);
          console.log(`[PaymentPolling] Refunded ${deductedAmount} to user ${transaction.userId}`);
        }
        return true;
      }
      console.log(`[PaymentPolling] ⏳ FedaPay payout ${transaction.id} still pending (${remainingSeconds}s remaining)`);
      return false;
    }
  } catch (error) {
    console.error(`[PaymentPolling] Error checking FedaPay payout ${transaction.id}:`, error);
    if (hasPaymentExpired(transaction)) {
      console.log(`[PaymentPolling] ⏱️ FedaPay payout ${transaction.id} expired with error - marking as failed`);
      await storage.updateTransactionStatus(transaction.id, "failed");
      
      // Refund the balance
      const deductedAmount = metadata.deductedFromBalance;
      if (deductedAmount) {
        await storage.updateUserBalance(transaction.userId, deductedAmount);
        console.log(`[PaymentPolling] Refunded ${deductedAmount} to user ${transaction.userId}`);
      }
      return true;
    }
    return false;
  }
}

async function processPaydunyaTransaction(transaction: Transaction & { user?: User }): Promise<void> {
  const transactionAge = getTransactionAge(transaction);
  const remainingTime = Math.max(0, PAYMENT_TIMEOUT_MS - transactionAge);
  const remainingSeconds = Math.round(remainingTime / 1000);

  if (!transaction.paydunyaToken) {
    if (hasPaymentExpired(transaction)) {
      console.log(`[PaymentPolling] Transaction ${transaction.id} expired without Paydunya token - marking as failed`);
      await storage.updateTransactionStatus(transaction.id, "failed");
    } else {
      console.log(`[PaymentPolling] Transaction ${transaction.id} waiting for Paydunya token (${remainingSeconds}s remaining)`);
    }
    return;
  }

  console.log(`[PaymentPolling] Checking Paydunya transaction ${transaction.id} (${remainingSeconds}s remaining, token: ${transaction.paydunyaToken.substring(0, 12)}...)`);
  
  const paydunyaStatus = await checkPaydunyaStatus(transaction.paydunyaToken);

  if (!paydunyaStatus) {
    if (hasPaymentExpired(transaction)) {
      console.log(`[PaymentPolling] Transaction ${transaction.id} expired with no Paydunya response - marking as failed`);
      await storage.updateTransactionStatus(transaction.id, "failed");
    } else {
      console.log(`[PaymentPolling] Transaction ${transaction.id} - Paydunya not responding, will retry (${remainingSeconds}s remaining)`);
    }
    return;
  }

  const hasValidInvoice = paydunyaStatus.invoice && typeof paydunyaStatus.invoice === 'object';
  const paymentStatus = paydunyaStatus.status || paydunyaStatus.invoice?.status;

  console.log(`[PaymentPolling] Paydunya transaction ${transaction.id} - response:`, {
    responseCode: paydunyaStatus.response_code,
    rootStatus: paydunyaStatus.status,
    invoiceStatus: paydunyaStatus.invoice?.status,
    finalStatus: paymentStatus,
    hasInvoice: hasValidInvoice,
    remainingSeconds,
  });

  if (paydunyaStatus.response_code === "00" && hasValidInvoice && paymentStatus === "completed") {
    const invoiceData = paydunyaStatus.invoice as any;
    const result = await storage.finalizeIncomingTransaction(transaction.id, {
      paydunyaReceiptUrl: invoiceData?.receipt_url || `https://paydunya.com/receipt/${transaction.paydunyaToken}`,
    });

    if (result) {
      console.log(`[PaymentPolling] ✅ Paydunya transaction ${transaction.id} CONFIRMED - finalized: credited=${result.credited}`);
    } else {
      console.log(`[PaymentPolling] Paydunya transaction ${transaction.id} already processed - skipping`);
    }
  } else if (paymentStatus === "cancelled" || paymentStatus === "canceled" || paymentStatus === "failed" || paymentStatus === "fail") {
    console.log(`[PaymentPolling] ❌ Paydunya transaction ${transaction.id} failed/cancelled (status: ${paymentStatus})`);
    await storage.updateTransactionStatus(transaction.id, "failed");
  } else {
    if (hasPaymentExpired(transaction)) {
      console.log(`[PaymentPolling] ⏱️ Paydunya transaction ${transaction.id} TIMEOUT (10min) with pending status "${paymentStatus}" - marking as failed`);
      await storage.updateTransactionStatus(transaction.id, "failed");
    } else {
      console.log(`[PaymentPolling] ⏳ Paydunya transaction ${transaction.id} still pending (status: ${paymentStatus}, ${remainingSeconds}s remaining)`);
    }
  }
}

async function processTransaction(transaction: Transaction & { user?: User }): Promise<void> {
  // Parse metadata to determine which payment provider to check
  let metadata: any = {};
  if (transaction.metadata) {
    try {
      metadata = JSON.parse(transaction.metadata);
    } catch (e) {}
  }

  // Check if this is a NOWPayments crypto transaction
  if (metadata.paymentId || metadata.nowPaymentsPaymentId || metadata.paymentProvider === "nowpayments" || metadata.isCrypto === true) {
    await processNowPaymentsTransaction(transaction, metadata);
    return;
  }

  // Check if this is a FedaPay transaction
  if (metadata.fedapayTransactionId) {
    await processFedaPayTransaction(transaction, metadata);
    return;
  }

  // Check if this is a FedaPay payout (withdrawal)
  if (metadata.fedapayPayoutId) {
    await processFedaPayPayout(transaction, metadata);
    return;
  }

  // Fallback to Paydunya
  await processPaydunyaTransaction(transaction);
}

async function pollPendingPayments(): Promise<void> {
  try {
    const pendingTransactions = await storage.getAllPendingTransactions();

    if (pendingTransactions.length === 0) {
      console.log(`[PaymentPolling] Cycle check - no pending transactions found`);
      return;
    }

    console.log(`[PaymentPolling] Processing ${pendingTransactions.length} pending transactions`);

    for (const transaction of pendingTransactions) {
      try {
        await processTransaction(transaction);
      } catch (error) {
        console.error(`[PaymentPolling] Error processing transaction ${transaction.id}:`, error);
      }
    }
  } catch (error) {
    console.error("[PaymentPolling] Error in polling cycle:", error);
  }
}

let pollingInterval: NodeJS.Timeout | null = null;
let isPolling = false;

export function startPaymentPolling(): void {
  if (pollingInterval) {
    console.log("[PaymentPolling] Polling already running");
    return;
  }

  console.log(`[PaymentPolling] Starting background payment verification (interval: ${POLLING_INTERVAL / 1000}s)`);

  safePollPendingPayments();

  pollingInterval = setInterval(safePollPendingPayments, POLLING_INTERVAL);
}

async function safePollPendingPayments(): Promise<void> {
  if (isPolling) {
    console.log("[PaymentPolling] Previous polling cycle still running - skipping");
    return;
  }
  
  isPolling = true;
  try {
    await pollPendingPayments();
  } finally {
    isPolling = false;
  }
}

export function stopPaymentPolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log("[PaymentPolling] Stopped background payment verification");
  }
}

export { checkPaydunyaStatus, hasPaymentExpired };
