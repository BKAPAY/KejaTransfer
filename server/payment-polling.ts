import { storage } from "./storage";
import type { Transaction, User } from "@shared/schema";

const PAYDUNYA_MASTER_KEY = process.env.PAYDUNYA_MASTER_KEY;
const PAYDUNYA_PRIVATE_KEY = process.env.PAYDUNYA_PRIVATE_KEY;
const PAYDUNYA_TOKEN = process.env.PAYDUNYA_TOKEN;

const POLLING_INTERVAL = 20000;
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
  if (!transaction.paydunyaToken) {
    if (hasPaymentExpired(transaction)) {
      console.log(`[PaymentPolling] Transaction ${transaction.id} expired without Paydunya token - marking as failed`);
      await storage.updateTransactionStatus(transaction.id, "failed");
    }
    return;
  }

  const paydunyaStatus = await checkPaydunyaStatus(transaction.paydunyaToken);

  if (!paydunyaStatus) {
    if (hasPaymentExpired(transaction)) {
      console.log(`[PaymentPolling] Transaction ${transaction.id} expired with no Paydunya response - marking as failed`);
      await storage.updateTransactionStatus(transaction.id, "failed");
    }
    return;
  }

  const invoiceStatus = paydunyaStatus.status || paydunyaStatus.invoice?.status;

  if (invoiceStatus === "completed" || paydunyaStatus.response_code === "00") {
    const result = await storage.finalizeIncomingTransaction(transaction.id, {
      paydunyaReceiptUrl: paydunyaStatus.invoice?.total_amount ? `https://paydunya.com/receipt/${transaction.paydunyaToken}` : undefined,
    });

    if (result) {
      console.log(`[PaymentPolling] Transaction ${transaction.id} finalized: credited=${result.credited}`);
    } else {
      console.log(`[PaymentPolling] Transaction ${transaction.id} already processed - skipping`);
    }
  } else if (invoiceStatus === "cancelled" || invoiceStatus === "failed" || paydunyaStatus.response_code === "01") {
    console.log(`[PaymentPolling] Transaction ${transaction.id} failed/cancelled by Paydunya - marking as failed`);
    await storage.updateTransactionStatus(transaction.id, "failed");
  } else {
    if (hasPaymentExpired(transaction)) {
      console.log(`[PaymentPolling] Transaction ${transaction.id} expired with pending Paydunya status "${invoiceStatus}" - marking as failed`);
      await storage.updateTransactionStatus(transaction.id, "failed");
    } else {
      console.log(`[PaymentPolling] Transaction ${transaction.id} still pending (Paydunya status: ${invoiceStatus})`);
    }
  }
}

async function pollPendingPayments(): Promise<void> {
  try {
    const pendingTransactions = await storage.getAllPendingTransactions();

    if (pendingTransactions.length === 0) {
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
