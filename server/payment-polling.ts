import { storage } from "./storage";
import type { Transaction, User } from "@shared/schema";

const PAYDUNYA_MASTER_KEY = process.env.PAYDUNYA_MASTER_KEY;
const PAYDUNYA_PRIVATE_KEY = process.env.PAYDUNYA_PRIVATE_KEY;
const PAYDUNYA_TOKEN = process.env.PAYDUNYA_TOKEN;

// Polling every 5 seconds for active transactions
const POLLING_INTERVAL = 5000;
const PAYMENT_TIMEOUT_MS = 5 * 60 * 1000;

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

function hasPaymentExpired(transaction: Transaction): boolean {
  let metadata: any = {};
  if (transaction.metadata) {
    try {
      metadata = JSON.parse(transaction.metadata);
    } catch (e) {}
  }

  if (metadata.startTime) {
    const elapsed = Date.now() - metadata.startTime;
    return elapsed >= PAYMENT_TIMEOUT_MS;
  }

  if (metadata.expiresAt) {
    return Date.now() >= metadata.expiresAt;
  }

  const age = getTransactionAge(transaction);
  return age >= PAYMENT_TIMEOUT_MS;
}

async function processTransaction(transaction: Transaction & { user?: User }): Promise<void> {
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

  console.log(`[PaymentPolling] Checking transaction ${transaction.id} (${remainingSeconds}s remaining, token: ${transaction.paydunyaToken.substring(0, 12)}...)`);
  
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

  // STRICT VALIDATION: Paydunya returns status at ROOT level OR in invoice object
  // Format: { response_code: "00", status: "completed", invoice: {...} }
  const hasValidInvoice = paydunyaStatus.invoice && typeof paydunyaStatus.invoice === 'object';
  // Check status at ROOT level first (Paydunya's actual format), then fallback to invoice.status
  const paymentStatus = paydunyaStatus.status || paydunyaStatus.invoice?.status;

  console.log(`[PaymentPolling] Transaction ${transaction.id} - Paydunya response:`, {
    responseCode: paydunyaStatus.response_code,
    rootStatus: paydunyaStatus.status,
    invoiceStatus: paydunyaStatus.invoice?.status,
    finalStatus: paymentStatus,
    hasInvoice: hasValidInvoice,
    remainingSeconds,
  });

  // ONLY finalize if ALL conditions are met:
  // 1. response_code is "00"
  // 2. invoice object exists
  // 3. status (at root or in invoice) is explicitly "completed"
  if (paydunyaStatus.response_code === "00" && hasValidInvoice && paymentStatus === "completed") {
    const invoiceData = paydunyaStatus.invoice as any;
    const result = await storage.finalizeIncomingTransaction(transaction.id, {
      paydunyaReceiptUrl: invoiceData?.receipt_url || `https://paydunya.com/receipt/${transaction.paydunyaToken}`,
    });

    if (result) {
      console.log(`[PaymentPolling] ✅ Transaction ${transaction.id} CONFIRMED by Paydunya - finalized: credited=${result.credited}`);
    } else {
      console.log(`[PaymentPolling] Transaction ${transaction.id} already processed - skipping`);
    }
  } else if (paymentStatus === "cancelled" || paymentStatus === "canceled" || paymentStatus === "failed" || paymentStatus === "fail") {
    console.log(`[PaymentPolling] ❌ Transaction ${transaction.id} failed/cancelled by Paydunya (status: ${paymentStatus})`);
    await storage.updateTransactionStatus(transaction.id, "failed");
  } else {
    // Transaction still pending - DO NOT mark as failed unless timeout reached
    if (hasPaymentExpired(transaction)) {
      console.log(`[PaymentPolling] ⏱️ Transaction ${transaction.id} TIMEOUT (5min) with pending status "${paymentStatus}" - marking as failed`);
      await storage.updateTransactionStatus(transaction.id, "failed");
    } else {
      // Keep waiting - this is the normal case during countdown
      console.log(`[PaymentPolling] ⏳ Transaction ${transaction.id} still pending (status: ${paymentStatus}, ${remainingSeconds}s remaining)`);
    }
  }
}

async function pollPendingPayments(): Promise<void> {
  try {
    const pendingTransactions = await storage.getAllPendingTransactions();

    if (pendingTransactions.length === 0) {
      console.log(`[PaymentPolling] Cycle check - no pending transactions found`);
      return;
    }

    console.log(`[PaymentPolling] Processing ${pendingTransactions.length} pending transactions:`, 
      pendingTransactions.map(t => ({ id: t.id, token: t.paydunyaToken?.substring(0,8) + '...', amount: t.amount })));

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
