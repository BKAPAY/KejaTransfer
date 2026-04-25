import { storage } from "./storage";
import type { Transaction, User } from "@shared/schema";
import { getTransactionStatus as getFedaPayTransactionStatus, getPayoutStatus as getFedaPayPayoutStatus } from "./fedapay";
import { NowPaymentsClient } from "./nowpayments";
import { getMbiyoPayTransactionStatus, searchMbiyoPayTransactionByOrderId } from "./mbiyopay";
import { getPawaPayDepositStatus, getPawaPayPayoutStatus, mapPawaPayStatus } from "./pawapay";
import { getAfribaPayTransaction, mapAfribaPayStatus } from "./afribapay";
import { getFeeXPayConfig, checkFeeXPayTransactionStatus, mapFeeXPayStatus } from "./feexpay";
import { trySendPaymentCallback } from "./utils/callback";
import { sendPaymentDocumentsEmail } from "./email-service";
import crypto from "crypto";

async function trySendPaymentLinkDocuments(transaction: Transaction) {
  try {
    if (transaction.type !== "payment_link" || !transaction.customerEmail) return;
    let metadata: any = {};
    try { metadata = JSON.parse(transaction.metadata as string || "{}"); } catch {}
    if (!metadata.paymentLinkId) return;
    const pl = await storage.getPaymentLinkById(metadata.paymentLinkId);
    if (pl?.documentUrls?.length && pl.documentNames?.length) {
      await sendPaymentDocumentsEmail(
        transaction.customerEmail,
        transaction.customerName || "Client",
        pl.productName,
        pl.documentNames,
        pl.documentUrls
      );
      console.log(`[PaymentPolling] Documents email sent for transaction ${transaction.id}`);
    }
  } catch (err) {
    console.log(`[PaymentPolling] Failed to send documents email for ${transaction.id}:`, err);
  }
}

/**
 * Attempts a single webhook delivery. Returns true if server responded with 2xx, false otherwise.
 */
async function tryDeliverApiPayoutWebhook(
  callbackUrl: string,
  callbackSecret: string,
  payloadStr: string,
  event: string,
  timestamp: string,
): Promise<boolean> {
  try {
    const signature = crypto.createHmac("sha256", callbackSecret).update(payloadStr).digest("hex");
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(callbackUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-BKApay-Signature": signature,
        "X-BKApay-Event": event,
        "X-BKApay-Timestamp": timestamp,
      },
      body: payloadStr,
      signal: controller.signal,
    }).finally(() => clearTimeout(tid));
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Sends the developer callback webhook when an API Payout transaction status changes.
 * Only fires if metadata contains apiKeyId (= initiated via /api/v1/payout).
 * Retries every 5 seconds for up to 10 minutes if the server doesn't respond with 2xx.
 */
export async function sendApiPayoutCallback(transactionId: string, metadata: any, finalStatus: "completed" | "failed"): Promise<void> {
  if (!metadata.apiKeyId) return;

  const apiKey = await storage.getApiKeyById(metadata.apiKeyId);
  const payoutCbUrl = (apiKey as any)?.payoutCallbackUrl;
  const payoutCbSecret = (apiKey as any)?.payoutCallbackSecret;
  if (!apiKey || !payoutCbUrl || !payoutCbSecret) return;

  const tx = await storage.getTransaction(transactionId);
  if (!tx) return;

  const event = finalStatus === "completed" ? "payout.completed" : "payout.failed";
  const timestamp = new Date().toISOString();
  const payoutPayload = {
    event,
    transactionId: tx.id,
    reference: metadata.reference || undefined,
    recipientAmount: tx.amount,
    currency: tx.currency,
    status: finalStatus,
    country: tx.country,
    operator: tx.operator,
    recipientPhone: metadata.phone || tx.customerPhone,
    timestamp,
  };
  const payloadStr = JSON.stringify(payoutPayload);

  const MAX_ATTEMPTS = 240;   // 20 minutes at 5s intervals
  const RETRY_INTERVAL_MS = 5000;

  let attempt = 0;

  const attempt_send = async () => {
    attempt++;
    const success = await tryDeliverApiPayoutWebhook(
      payoutCbUrl,
      payoutCbSecret,
      payloadStr,
      event,
      timestamp,
    );

    if (success) {
      console.log(`[ApiPayoutCallback] ✅ Webhook delivered to ${payoutCbUrl} for tx ${transactionId} (${event}) — attempt ${attempt}`);
      return;
    }

    console.warn(`[ApiPayoutCallback] ⚠️ Webhook attempt ${attempt}/${MAX_ATTEMPTS} failed for tx ${transactionId} — retrying in ${RETRY_INTERVAL_MS / 1000}s`);

    if (attempt < MAX_ATTEMPTS) {
      setTimeout(attempt_send, RETRY_INTERVAL_MS);
    } else {
      console.error(`[ApiPayoutCallback] ❌ Gave up after ${MAX_ATTEMPTS} attempts for tx ${transactionId} (${event})`);
    }
  };

  attempt_send();
}

/**
 * Sends the business webhook callback when a business transaction status changes via polling.
 * Checks if the transaction metadata contains scope="business" and businessTokenId.
 * Retries every 3 seconds for up to 15 minutes if the server doesn't respond with 2xx.
 */
export async function sendBusinessWebhookCallback(
  transactionId: string,
  finalStatus: "completed" | "failed",
  txType: "payin" | "payout"
): Promise<void> {
  try {
    const tx = await storage.getTransaction(transactionId);
    if (!tx) return;

    let metadata: any = {};
    try { metadata = JSON.parse(tx.metadata || "{}"); } catch {}

    if (metadata.scope !== "business" || !metadata.businessTokenId) return;

    const businessToken = await storage.getBusinessTokenById(metadata.businessTokenId);
    if (!businessToken) return;

    const isPayin = txType === "payin";
    const cbUrl = isPayin ? businessToken.callbackUrl : (businessToken.payoutCallbackUrl || businessToken.callbackUrl);
    const cbSecret = isPayin ? businessToken.callbackSecret : (businessToken.payoutCallbackSecret || businessToken.callbackSecret);

    if (!cbUrl || !cbSecret) return;

    const event = `business.${txType}.${finalStatus}`;
    const timestamp = new Date().toISOString();
    const payload: any = {
      event,
      transactionId: tx.id,
      amount: tx.amount,
      currency: tx.currency,
      status: finalStatus,
      country: tx.country,
      operator: tx.operator,
      timestamp,
    };
    if (metadata.orderId) payload.orderId = metadata.orderId;
    if (metadata.reference) payload.reference = metadata.reference;
    if (tx.customerPhone) payload.phone = tx.customerPhone;

    const payloadStr = JSON.stringify(payload);

    const MAX_ATTEMPTS = 400;
    const RETRY_INTERVAL_MS = 3000;
    let attempt = 0;

    const attemptSend = async () => {
      attempt++;
      const success = await tryDeliverApiPayoutWebhook(cbUrl, cbSecret, payloadStr, event, timestamp);

      if (success) {
        console.log(`[BusinessWebhook] Webhook delivered to ${cbUrl} for tx ${transactionId} (${event}) — attempt ${attempt}`);
        return;
      }

      console.warn(`[BusinessWebhook] Attempt ${attempt}/${MAX_ATTEMPTS} failed for tx ${transactionId} — retrying in ${RETRY_INTERVAL_MS / 1000}s`);

      if (attempt < MAX_ATTEMPTS) {
        setTimeout(attemptSend, RETRY_INTERVAL_MS);
      } else {
        console.error(`[BusinessWebhook] Gave up after ${MAX_ATTEMPTS} attempts for tx ${transactionId} (${event})`);
      }
    };

    attemptSend();
  } catch (error) {
    console.error(`[BusinessWebhook] Error preparing webhook for tx ${transactionId}:`, error);
  }
}

const PAYDUNYA_MASTER_KEY = process.env.PAYDUNYA_MASTER_KEY;
const PAYDUNYA_PRIVATE_KEY = process.env.PAYDUNYA_PRIVATE_KEY;
const PAYDUNYA_TOKEN = process.env.PAYDUNYA_TOKEN;

export async function safeRefundOutgoingTransaction(
  transactionId: string,
  userId: string,
  _metadata: any,
  source: string
): Promise<boolean> {
  const latestTx = await storage.getTransaction(transactionId);
  if (!latestTx) {
    console.log(`[SafeRefund] Transaction ${transactionId} not found - skipping refund (source: ${source})`);
    return false;
  }

  const latestMeta = JSON.parse(latestTx.metadata || "{}");
  // deductedFromBalance / totalDebited = montant + frais de service (stockés par le handler fournisseur)
  // exchangeFee = frais d'échange déduits SÉPARÉMENT dans routes.ts pour les transferts cross-devises
  // → il faut rembourser les deux pour restituer la totalité du solde débité
  const baseRefundAmount = latestMeta.deductedFromBalance || latestMeta.totalDebited || latestTx.amount;
  const exchangeFeeToRefund = latestMeta.exchangeFee || 0;
  const refundAmount = baseRefundAmount + exchangeFeeToRefund;
  if (!refundAmount || refundAmount <= 0) {
    console.log(`[SafeRefund] Transaction ${transactionId} no valid refund amount - skipping (source: ${source})`);
    return false;
  }
  if (exchangeFeeToRefund > 0) {
    console.log(`[SafeRefund] Including exchange fee in refund: base=${baseRefundAmount} + exchangeFee=${exchangeFeeToRefund} = total=${refundAmount} (source: ${source})`);
  }

  if (latestMeta.scope === "business") {
    const country = latestTx.country || latestMeta.country;
    const currency = latestTx.currency || latestMeta.balanceCurrency || latestMeta.providerCurrency;
    if (country && currency) {
      const success = await storage.atomicFailAndRefundBusinessWallet(transactionId, userId, country, currency, refundAmount, source);
      if (!success) {
        console.log(`[SafeRefund] Business tx ${transactionId} not eligible for refund (already processed or wrong status) - skipping (source: ${source})`);
        return false;
      }
      console.log(`[SafeRefund] ✅ Refunded ${refundAmount} ${currency} to business wallet ${country} for transaction ${transactionId} (source: ${source})`);
      return true;
    }
  }

  // Try atomic fail+refund for pending transactions (status still 'pending')
  const successFromPending = await storage.atomicFailAndRefundPayout(transactionId, userId, refundAmount);
  if (successFromPending) {
    console.log(`[SafeRefund] ✅ Refunded ${refundAmount} to user ${userId} for transaction ${transactionId} (atomic fail+refund, source: ${source})`);
    return true;
  }

  // If not pending, try idempotent refund for already-failed transactions (prevents double refund)
  const success = await storage.atomicMarkRefundedAndCredit(transactionId, userId, refundAmount, source);
  if (!success) {
    console.log(`[SafeRefund] Transaction ${transactionId} not eligible for refund (already refunded or wrong status) - skipping (source: ${source})`);
    return false;
  }

  console.log(`[SafeRefund] ✅ Refunded ${refundAmount} to user ${userId} for transaction ${transactionId} (source: ${source})`);
  return true;
}

// Polling every 3 seconds for active transactions
const POLLING_INTERVAL = 3000;
const PAYMENT_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes timeout (Mobile Money)
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
  // Les transactions sortantes (retraits, transferts) ne s'expirent jamais automatiquement.
  // On laisse le fournisseur répondre, peu importe le délai.
  if (transaction.type === "withdrawal" || transaction.type === "transfer") {
    return false;
  }

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
        const updatedFedaTx = await storage.getTransaction(transaction.id);
        if (updatedFedaTx) {
          trySendPaymentCallback(updatedFedaTx, 'payment.completed', '[PaymentPolling/FedaPay]');
          trySendPaymentLinkDocuments(updatedFedaTx);
        }
        setImmediate(() => sendBusinessWebhookCallback(transaction.id, "completed", "payin"));
      } else {
        console.log(`[PaymentPolling] FedaPay transaction ${transaction.id} already processed - skipping`);
      }
      return true;
    } else if (fedapayStatus.status === "declined" || fedapayStatus.status === "canceled" || fedapayStatus.status === "refunded") {
      console.log(`[PaymentPolling] ❌ FedaPay transaction ${transaction.id} failed/cancelled (status: ${fedapayStatus.status})`);
      await storage.updateTransactionStatus(transaction.id, "failed");
      setImmediate(() => sendBusinessWebhookCallback(transaction.id, "failed", "payin"));
      return true;
    } else {
      // Still pending
      if (hasPaymentExpired(transaction)) {
        const timeoutMinutes = Math.round(PAYMENT_TIMEOUT_MS / 60000);
        console.log(`[PaymentPolling] ⏱️ FedaPay transaction ${transaction.id} TIMEOUT (${timeoutMinutes}min) - marking as failed`);
        await storage.updateTransactionStatus(transaction.id, "failed");
        setImmediate(() => sendBusinessWebhookCallback(transaction.id, "failed", "payin"));
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
      setImmediate(() => sendBusinessWebhookCallback(transaction.id, "failed", "payin"));
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
    email: config.publicKey || undefined,
    password: config.secretKey || undefined,
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
        setImmediate(() => sendBusinessWebhookCallback(transaction.id, "failed", "payin"));
        return true;
      }
      return false;
    }

    const status = await client.getPaymentStatus(nowPaymentsPaymentId);
    
    console.log(`[PaymentPolling] NOWPayments transaction ${transaction.id} - status:`, status.payment_status);

    if (status.payment_status === "finished" || status.payment_status === "confirmed") {
      const result = await storage.finalizeIncomingTransaction(transaction.id, {});
      if (result) {
        console.log(`[PaymentPolling] ✅ NOWPayments transaction ${transaction.id} CONFIRMED - credited=${result.credited}`);
        
        const updatedNowTx = await storage.getTransaction(transaction.id);
        if (updatedNowTx) {
          trySendPaymentCallback(updatedNowTx, 'payment.completed', '[PaymentPolling/NOWPayments]');
        }
        setImmediate(() => sendBusinessWebhookCallback(transaction.id, "completed", "payin"));
      } else {
        console.log(`[PaymentPolling] NOWPayments transaction ${transaction.id} already processed - skipping`);
      }
      return true;
    } else if (status.payment_status === "failed" || status.payment_status === "expired" || status.payment_status === "refunded") {
      console.log(`[PaymentPolling] ❌ NOWPayments transaction ${transaction.id} failed/expired (status: ${status.payment_status})`);
      await storage.updateTransactionStatus(transaction.id, "failed");
      
      const failedNowTx = await storage.getTransaction(transaction.id);
      if (failedNowTx) {
        trySendPaymentCallback(failedNowTx, 'payment.failed', '[PaymentPolling/NOWPayments]');
      }
      setImmediate(() => sendBusinessWebhookCallback(transaction.id, "failed", "payin"));
      return true;
    } else {
      // Still pending (waiting, confirming, sending, partially_paid)
      if (hasPaymentExpired(transaction)) {
        const timeoutMinutes = Math.round(CRYPTO_TIMEOUT_MS / 60000);
        console.log(`[PaymentPolling] ⏱️ NOWPayments transaction ${transaction.id} TIMEOUT (${timeoutMinutes}min) - marking as failed`);
        await storage.updateTransactionStatus(transaction.id, "failed");
        setImmediate(() => sendBusinessWebhookCallback(transaction.id, "failed", "payin"));
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
      setImmediate(() => sendBusinessWebhookCallback(transaction.id, "failed", "payin"));
      return true;
    }
    return false;
  }
}

async function processMbiyoPayTransaction(transaction: Transaction & { user?: User }, metadata: any): Promise<boolean> {
  const mbiyopayTransactionId = metadata.mbiyopayTransactionId;
  const transactionAge = getTransactionAge(transaction);
  const remainingTime = Math.max(0, PAYMENT_TIMEOUT_MS - transactionAge);
  const remainingSeconds = Math.round(remainingTime / 1000);

  // SAFETY: Re-check the current transaction status from DB before processing
  // This prevents race conditions where the API handler already marked it as "failed"
  // but polling tries to override it with "completed"
  const currentTx = await storage.getTransaction(transaction.id);
  if (!currentTx || currentTx.status !== "pending") {
    console.log(`[PaymentPolling] Transaction ${transaction.id} is no longer pending (status: ${currentTx?.status || 'not found'}) - skipping`);
    return true;
  }

  console.log(`[PaymentPolling] Checking MbiyoPay transaction ${transaction.id} (mbiyopayId: ${mbiyopayTransactionId || 'not yet assigned'}, orderId: ${metadata.orderId || 'none'}, ${remainingSeconds}s remaining)`);

  // For outgoing transactions (withdrawal/transfer), wait at least 10 seconds before
  // searching by order_id to avoid race conditions with the API response handler
  const isOutgoing = transaction.type === "withdrawal" || transaction.type === "transfer";
  const MIN_AGE_BEFORE_SEARCH_MS = isOutgoing ? 10000 : 5000;

  // If we don't have a MbiyoPay transaction ID yet, try to find it by order_id
  // Only search every ~30 seconds (6 polling cycles) to avoid API rate limiting
  if (!mbiyopayTransactionId) {
    const orderId = metadata.orderId;
    const lastOrderIdSearch = metadata._lastOrderIdSearchTime || 0;
    const searchInterval = 30000; // 30 seconds between searches
    const shouldSearch = orderId && transactionAge >= MIN_AGE_BEFORE_SEARCH_MS && (Date.now() - lastOrderIdSearch >= searchInterval);
    
    if (shouldSearch) {
      console.log(`[PaymentPolling] No mbiyopayTransactionId for ${transaction.id} - searching by order_id: ${orderId}`);
      // Record the search time to avoid searching too frequently
      metadata._lastOrderIdSearchTime = Date.now();
      await storage.updateTransactionMetadata(transaction.id, JSON.stringify(metadata));
      
      try {
        const searchResult = await searchMbiyoPayTransactionByOrderId(orderId);
        if (searchResult.success && searchResult.transactionId) {
          // SAFETY: Validate that the found transaction matches our expected amount/currency
          // to prevent false positives from MbiyoPay's search API
          const expectedAmount = metadata.providerAmount || transaction.amount;
          const expectedCurrency = metadata.providerCurrency || transaction.currency;
          if (searchResult.amount && Math.abs(searchResult.amount - expectedAmount) > 1) {
            console.warn(`[SECURITY] Order_id search returned transaction with WRONG amount: expected=${expectedAmount}, got=${searchResult.amount} for ${transaction.id} - ignoring match`);
            return false;
          }
          if (searchResult.currency && expectedCurrency && searchResult.currency.toUpperCase() !== expectedCurrency.toUpperCase()) {
            console.warn(`[SECURITY] Order_id search returned transaction with WRONG currency: expected=${expectedCurrency}, got=${searchResult.currency} for ${transaction.id} - ignoring match`);
            return false;
          }

          // Found the transaction! Store the MbiyoPay transaction ID in metadata
          // IMPORTANT: We NEVER finalize/credit based on order_id search alone
          // We only store the ID and let the NEXT polling cycle verify via direct API (getMbiyoPayTransactionStatus)
          // This ensures the authoritative direct API is ALWAYS the source for crediting decisions
          metadata.mbiyopayTransactionId = searchResult.transactionId;
          await storage.updateTransactionMetadata(transaction.id, JSON.stringify(metadata));
          console.log(`[PaymentPolling] Found MbiyoPay transaction ID ${searchResult.transactionId} for order ${orderId} - status: ${searchResult.status}, amount: ${searchResult.amount}, currency: ${searchResult.currency}`);
          console.log(`[PaymentPolling] Stored mbiyopayTransactionId - will verify via direct API on next polling cycle`);
          // Don't process the status here - let the next cycle handle it through the standard path
          // which uses getMbiyoPayTransactionStatus (the authoritative, direct API)
          return false;
        } else {
          console.log(`[PaymentPolling] Could not find MbiyoPay transaction by order_id ${orderId}: ${searchResult.error}`);
        }
      } catch (searchError) {
        console.log(`[PaymentPolling] Error searching MbiyoPay by order_id: ${searchError}`);
      }
    }
    
    if (hasPaymentExpired(transaction)) {
      console.log(`[PaymentPolling] MbiyoPay transaction ${transaction.id} expired without receiving mbiyopayTransactionId - marking as failed`);
      const isOutgoingNoId = transaction.type === "withdrawal" || transaction.type === "transfer";
      if (isOutgoingNoId) {
        await safeRefundOutgoingTransaction(transaction.id, transaction.userId, metadata, "polling-mbiyopay-expired-no-id");
      }
      await storage.updateTransactionStatus(transaction.id, "failed");
      setImmediate(() => sendApiPayoutCallback(transaction.id, metadata, "failed"));
      setImmediate(() => sendBusinessWebhookCallback(transaction.id, "failed", isOutgoingNoId ? "payout" : "payin"));
      return true;
    }
    console.log(`[PaymentPolling] Waiting for MbiyoPay transaction ID for ${transaction.id} (${remainingSeconds}s remaining)`);
    return false;
  }

  try {
    const statusResult = await getMbiyoPayTransactionStatus(mbiyopayTransactionId);
    
    console.log(`[PaymentPolling] MbiyoPay transaction ${transaction.id} - status:`, statusResult.status);

    if (statusResult.success && statusResult.status) {
      const status = statusResult.status.toLowerCase();
      
      // MbiyoPay official status: successful = payment confirmed (per API docs)
      if (status === "successful") {
        // SECURITY: Double-verification via searchMbiyoPayTransactionByOrderId if orderId available
        let doubleVerified = false;
        if (metadata.orderId) {
          try {
            const verifyResult = await searchMbiyoPayTransactionByOrderId(metadata.orderId);
            if (verifyResult.success && verifyResult.status) {
              const verifyStatus = verifyResult.status.toLowerCase();
              if (verifyStatus === "successful") {
                doubleVerified = true;
                console.log(`[SECURITY] Double-verification PASSED for transaction ${transaction.id} (getMbiyoPayTransactionStatus -> order_id search both say "successful")`);
              } else {
                console.warn(`[SECURITY] Double-verification FAILED for transaction ${transaction.id} - getMbiyoPayTransactionStatus says "successful" but order_id search says "${verifyStatus}" - leaving pending for admin review`);
              }
            } else {
              console.warn(`[SECURITY] Double-verification FAILED for transaction ${transaction.id} - order_id search returned error: ${verifyResult.error} - leaving pending for admin review`);
            }
          } catch (verifyError) {
            console.warn(`[SECURITY] Double-verification FAILED for transaction ${transaction.id} - order_id search threw error: ${verifyError} - leaving pending for admin review`);
          }
        } else {
          doubleVerified = true;
          console.log(`[SECURITY] Double-verification SKIPPED for transaction ${transaction.id} - no orderId in metadata, trusting getMbiyoPayTransactionStatus`);
        }

        if (!doubleVerified) {
          return false;
        }

        // SAFETY: Re-check status before finalizing - prevent overwriting "failed" set by API handler
        const latestTx2 = await storage.getTransaction(transaction.id);
        if (!latestTx2 || latestTx2.status !== "pending") {
          console.log(`[PaymentPolling] Transaction ${transaction.id} status changed to "${latestTx2?.status}" during verification - aborting completion`);
          return true;
        }

        if (transaction.type === "deposit" || transaction.type === "payment_link" || transaction.type === "merchant_link" || transaction.type === "api_payment") {
          const result = await storage.finalizeIncomingTransaction(transaction.id, {});
          if (result) {
            console.log(`[PaymentPolling] ✅ MbiyoPay transaction ${transaction.id} CONFIRMED (double-verified) - finalized: credited=${result.credited}`);
            const updatedMbiyoTx = await storage.getTransaction(transaction.id);
            if (updatedMbiyoTx) {
              trySendPaymentCallback(updatedMbiyoTx, 'payment.completed', '[PaymentPolling/MbiyoPay]');
              trySendPaymentLinkDocuments(updatedMbiyoTx);
            }
            setImmediate(() => sendBusinessWebhookCallback(transaction.id, "completed", "payin"));
          } else {
            console.log(`[PaymentPolling] MbiyoPay transaction ${transaction.id} already processed - skipping`);
          }
        } else {
          await storage.updateTransactionStatus(transaction.id, "completed");
          console.log(`[PaymentPolling] ✅ MbiyoPay ${transaction.type} ${transaction.id} COMPLETED (double-verified)`);
          setImmediate(() => sendApiPayoutCallback(transaction.id, metadata, "completed"));
          setImmediate(() => sendBusinessWebhookCallback(transaction.id, "completed", "payout"));
        }
        return true;
      } 
      else if (status === "failed" || status === "cancelled" || status === "expired" || status === "rejected" || status === "error") {
        const isOutgoing = transaction.type === "withdrawal" || transaction.type === "transfer";
        const MBIYOPAY_FAILED_GRACE_PERIOD_MS = isOutgoing ? 15 * 1000 : 60 * 1000;
        const transactionAgeMs = getTransactionAge(transaction);
        
        if (transactionAgeMs < MBIYOPAY_FAILED_GRACE_PERIOD_MS) {
          const graceRemaining = Math.round((MBIYOPAY_FAILED_GRACE_PERIOD_MS - transactionAgeMs) / 1000);
          console.log(`[PaymentPolling] ⏳ MbiyoPay transaction ${transaction.id} shows "${status}" but too recent (${Math.round(transactionAgeMs/1000)}s old) - waiting ${graceRemaining}s grace period before trusting`);
          return false; // Keep polling
        }
        
        // Grace period passed - getMbiyoPayTransactionStatus with the real mbiyopayTransactionId is the AUTHORITATIVE source
        // We trust the direct API status and do NOT override it with order_id search which can return wrong transactions
        console.log(`[PaymentPolling] ❌ MbiyoPay transaction ${transaction.id} confirmed ${status} after grace period (authoritative source: getMbiyoPayTransactionStatus with ID ${mbiyopayTransactionId})`);
        const isOutgoingMbiyo = transaction.type === "withdrawal" || transaction.type === "transfer";
        if (isOutgoingMbiyo) {
          await safeRefundOutgoingTransaction(transaction.id, transaction.userId, metadata, "polling-mbiyopay-failed");
        }
        await storage.updateTransactionStatus(transaction.id, "failed");
        setImmediate(() => sendApiPayoutCallback(transaction.id, metadata, "failed"));
        setImmediate(() => sendBusinessWebhookCallback(transaction.id, "failed", isOutgoingMbiyo ? "payout" : "payin"));
        return true;
      } 
      // Still pending
      else {
        const isOutgoingTx = transaction.type === "withdrawal" || transaction.type === "transfer";
        if (hasPaymentExpired(transaction)) {
          if (isOutgoingTx) {
            metadata.adminReviewPending = true;
            await storage.updateTransactionMetadata(transaction.id, JSON.stringify(metadata));
            console.log(`[PaymentPolling] ⏱️ MbiyoPay ${transaction.type} ${transaction.id} TIMEOUT - reste en pending pour validation admin (transfert sortant)`);
            return true;
          }
          const timeoutMinutes = Math.round(PAYMENT_TIMEOUT_MS / 60000);
          console.log(`[PaymentPolling] ⏱️ MbiyoPay transaction ${transaction.id} TIMEOUT (${timeoutMinutes}min) - marking as failed`);
          await storage.updateTransactionStatus(transaction.id, "failed");
          setImmediate(() => sendApiPayoutCallback(transaction.id, metadata, "failed"));
          setImmediate(() => sendBusinessWebhookCallback(transaction.id, "failed", "payin"));
          return true;
        }
        console.log(`[PaymentPolling] ⏳ MbiyoPay transaction ${transaction.id} still pending (status: ${status}, ${remainingSeconds}s remaining)`);
        return false;
      }
    } else {
      const isOutgoingTx = transaction.type === "withdrawal" || transaction.type === "transfer";
      if (hasPaymentExpired(transaction)) {
        if (isOutgoingTx) {
          metadata.adminReviewPending = true;
          await storage.updateTransactionMetadata(transaction.id, JSON.stringify(metadata));
          console.log(`[PaymentPolling] ⏱️ MbiyoPay ${transaction.type} ${transaction.id} expired with API error - reste en pending pour validation admin`);
          return true;
        }
        console.log(`[PaymentPolling] ⏱️ MbiyoPay transaction ${transaction.id} expired with API error - marking as failed`);
        await storage.updateTransactionStatus(transaction.id, "failed");
        setImmediate(() => sendBusinessWebhookCallback(transaction.id, "failed", "payin"));
        return true;
      }
      console.log(`[PaymentPolling] MbiyoPay API error for ${transaction.id}: ${statusResult.error}, will retry (${remainingSeconds}s remaining)`);
      return false;
    }
  } catch (error) {
    console.error(`[PaymentPolling] Error checking MbiyoPay transaction ${transaction.id}:`, error);
    const isOutgoingTx = transaction.type === "withdrawal" || transaction.type === "transfer";
    if (hasPaymentExpired(transaction)) {
      if (isOutgoingTx) {
        metadata.adminReviewPending = true;
        await storage.updateTransactionMetadata(transaction.id, JSON.stringify(metadata));
        console.log(`[PaymentPolling] ⏱️ MbiyoPay ${transaction.type} ${transaction.id} expired with error - reste en pending pour validation admin`);
        return true;
      }
      console.log(`[PaymentPolling] ⏱️ MbiyoPay transaction ${transaction.id} expired with error - marking as failed`);
      await storage.updateTransactionStatus(transaction.id, "failed");
      setImmediate(() => sendBusinessWebhookCallback(transaction.id, "failed", "payin"));
      return true;
    }
    return false;
  }
}

async function processAfribaPayIncoming(transaction: Transaction & { user?: User }, metadata: any): Promise<boolean> {
  const afribaPayTransactionId = metadata.afribaPayTransactionId;
  const transactionAge = getTransactionAge(transaction);
  const remainingTime = Math.max(0, PAYMENT_TIMEOUT_MS - transactionAge);
  const remainingSeconds = Math.round(remainingTime / 1000);

  const currentTx = await storage.getTransaction(transaction.id);
  if (!currentTx || currentTx.status !== "pending") {
    console.log(`[PaymentPolling] AfribaPay incoming ${transaction.id} no longer pending (status: ${currentTx?.status || 'not found'}) - skipping`);
    return true;
  }

  console.log(`[PaymentPolling] Checking AfribaPay incoming ${transaction.id} (afribaPayId: ${afribaPayTransactionId}, ${remainingSeconds}s remaining)`);

  try {
    const result = await getAfribaPayTransaction(afribaPayTransactionId);

    if (!result.success) {
      if (hasPaymentExpired(transaction)) {
        console.log(`[PaymentPolling] ⏱️ AfribaPay incoming ${transaction.id} TIMEOUT - API error - marking failed`);
        await storage.updateTransactionStatus(transaction.id, "failed");
        setImmediate(() => sendBusinessWebhookCallback(transaction.id, "failed", "payin"));
        return true;
      }
      console.log(`[PaymentPolling] AfribaPay incoming ${transaction.id} API error: ${result.error}, will retry (${remainingSeconds}s remaining)`);
      return false;
    }

    const mappedStatus = mapAfribaPayStatus(result.status || "");
    console.log(`[PaymentPolling] AfribaPay incoming ${transaction.id} raw status: ${result.status} → mapped: ${mappedStatus}`);

    if (mappedStatus === "completed") {
      // Validation multi-critères avant tout crédit
      const { validateAfribaPayFingerprint } = await import("./afribapay");
      const fingerprint = validateAfribaPayFingerprint(result, metadata, transaction);
      if (fingerprint.warnings.length > 0) {
        fingerprint.warnings.forEach(w => console.warn(`[PaymentPolling] ⚠️ AfribaPay fingerprint warning (${transaction.id}): ${w}`));
      }
      if (!fingerprint.valid) {
        console.error(`[PaymentPolling] 🚨 AfribaPay fingerprint INVALIDE pour ${transaction.id}: ${fingerprint.reason} - CREDIT BLOQUE`);
        await storage.updateTransactionStatus(transaction.id, "failed");
        setImmediate(() => sendBusinessWebhookCallback(transaction.id, "failed", "payin"));
        return true;
      }

      const finalizeResult = await storage.finalizeIncomingTransaction(transaction.id, {});
      if (finalizeResult) {
        console.log(`[PaymentPolling] ✅ AfribaPay incoming ${transaction.id} CONFIRMÉ (fingerprint OK) - credited=${finalizeResult.credited}`);
        const updatedTx = await storage.getTransaction(transaction.id);
        if (updatedTx) {
          trySendPaymentCallback(updatedTx, 'payment.completed', '[PaymentPolling/AfribaPay]');
          trySendPaymentLinkDocuments(updatedTx);
        }
        setImmediate(() => sendBusinessWebhookCallback(transaction.id, "completed", "payin"));
      } else {
        console.log(`[PaymentPolling] AfribaPay incoming ${transaction.id} already processed - skipping`);
      }
      return true;
    } else if (mappedStatus === "failed") {
      console.log(`[PaymentPolling] ❌ AfribaPay incoming ${transaction.id} failed (raw status: ${result.status})`);
      await storage.updateTransactionStatus(transaction.id, "failed");
      const failedTx = await storage.getTransaction(transaction.id);
      if (failedTx) {
        trySendPaymentCallback(failedTx, 'payment.failed', '[PaymentPolling/AfribaPay]');
      }
      setImmediate(() => sendBusinessWebhookCallback(transaction.id, "failed", "payin"));
      return true;
    } else {
      if (hasPaymentExpired(transaction)) {
        console.log(`[PaymentPolling] ⏱️ AfribaPay incoming ${transaction.id} TIMEOUT (15min) - marking failed`);
        await storage.updateTransactionStatus(transaction.id, "failed");
        setImmediate(() => sendBusinessWebhookCallback(transaction.id, "failed", "payin"));
        return true;
      }
      console.log(`[PaymentPolling] ⏳ AfribaPay incoming ${transaction.id} still pending (raw: ${result.status}, ${remainingSeconds}s remaining)`);
      return false;
    }
  } catch (error) {
    console.error(`[PaymentPolling] Error checking AfribaPay incoming ${transaction.id}:`, error);
    if (hasPaymentExpired(transaction)) {
      console.log(`[PaymentPolling] ⏱️ AfribaPay incoming ${transaction.id} expired with error - marking failed`);
      await storage.updateTransactionStatus(transaction.id, "failed");
      setImmediate(() => sendBusinessWebhookCallback(transaction.id, "failed", "payin"));
      return true;
    }
    return false;
  }
}

async function processAfribaPayPayout(transaction: Transaction & { user?: User }, metadata: any): Promise<boolean> {
  const afribaPayTransactionId = metadata.afribaPayTransactionId;
  const transactionAge = getTransactionAge(transaction);
  const remainingTime = Math.max(0, PAYMENT_TIMEOUT_MS - transactionAge);
  const remainingSeconds = Math.round(remainingTime / 1000);

  const currentTx = await storage.getTransaction(transaction.id);
  if (!currentTx || currentTx.status !== "pending") {
    console.log(`[PaymentPolling] AfribaPay payout ${transaction.id} no longer pending (status: ${currentTx?.status || 'not found'}) - skipping`);
    return true;
  }

  console.log(`[PaymentPolling] Checking AfribaPay payout ${transaction.id} (afribaPayId: ${afribaPayTransactionId}, ${remainingSeconds}s remaining)`);

  try {
    const result = await getAfribaPayTransaction(afribaPayTransactionId);

    if (!result.success) {
      if (hasPaymentExpired(transaction)) {
        console.log(`[PaymentPolling] ⏱️ AfribaPay payout ${transaction.id} TIMEOUT - API error - marking pending for admin review`);
        metadata.adminReviewPending = true;
        await storage.updateTransactionMetadata(transaction.id, JSON.stringify(metadata));
        return true;
      }
      console.log(`[PaymentPolling] AfribaPay payout ${transaction.id} API error: ${result.error}, will retry (${remainingSeconds}s remaining)`);
      return false;
    }

    const mappedStatus = mapAfribaPayStatus(result.status || "");
    console.log(`[PaymentPolling] AfribaPay payout ${transaction.id} raw status: ${result.status} → mapped: ${mappedStatus}`);

    if (mappedStatus === "completed") {
      await storage.updateTransactionStatus(transaction.id, "completed");
      console.log(`[PaymentPolling] ✅ AfribaPay payout ${transaction.id} COMPLETED`);
      setImmediate(() => sendApiPayoutCallback(transaction.id, metadata, "completed"));
      setImmediate(() => sendBusinessWebhookCallback(transaction.id, "completed", "payout"));
      return true;
    } else if (mappedStatus === "failed") {
      console.log(`[PaymentPolling] ❌ AfribaPay payout ${transaction.id} FAILED (raw: ${result.status}) - refunding user`);
      await safeRefundOutgoingTransaction(transaction.id, transaction.userId, metadata, "polling-afribapay-payout-failed");
      await storage.updateTransactionStatus(transaction.id, "failed");
      setImmediate(() => sendApiPayoutCallback(transaction.id, metadata, "failed"));
      setImmediate(() => sendBusinessWebhookCallback(transaction.id, "failed", "payout"));
      return true;
    } else {
      if (hasPaymentExpired(transaction)) {
        console.log(`[PaymentPolling] ⏱️ AfribaPay payout ${transaction.id} TIMEOUT (10min) - marking pending for admin review`);
        metadata.adminReviewPending = true;
        await storage.updateTransactionMetadata(transaction.id, JSON.stringify(metadata));
        return true;
      }
      console.log(`[PaymentPolling] ⏳ AfribaPay payout ${transaction.id} still pending (raw: ${result.status}, ${remainingSeconds}s remaining)`);
      return false;
    }
  } catch (error) {
    console.error(`[PaymentPolling] Error checking AfribaPay payout ${transaction.id}:`, error);
    if (hasPaymentExpired(transaction)) {
      console.log(`[PaymentPolling] ⏱️ AfribaPay payout ${transaction.id} expired with error - marking pending for admin review`);
      metadata.adminReviewPending = true;
      await storage.updateTransactionMetadata(transaction.id, JSON.stringify(metadata));
      return true;
    }
    return false;
  }
}

async function processMoneyFusionPayout(transaction: Transaction & { user?: User }, metadata: any): Promise<boolean> {
  const tokenPay = metadata.moneyFusionTokenPay;
  const age = getTransactionAge(transaction);
  const ageMinutes = Math.round(age / 60000);

  if (!tokenPay) {
    console.log(`[PaymentPolling] MoneyFusion payout ${transaction.id} - no tokenPay, waiting for webhook`);
    return false;
  }

  const logIntervalMs = 60000;
  const lastLogTime = metadata._lastMfLogTime || 0;
  const now = Date.now();
  if (now - lastLogTime < logIntervalMs) {
    return false;
  }

  try {
    const updatedMeta = { ...metadata, _lastMfLogTime: now };
    await storage.updateTransactionMetadata(transaction.id, JSON.stringify(updatedMeta));
  } catch (e) {}

  console.log(`[PaymentPolling] MoneyFusion payout ${transaction.id} (tokenPay: ${tokenPay}) still pending - age: ${ageMinutes}min - waiting for webhook callback`);

  return false;
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
      setImmediate(() => sendApiPayoutCallback(transaction.id, metadata, "completed"));
      setImmediate(() => sendBusinessWebhookCallback(transaction.id, "completed", "payout"));
      return true;
    } else if (payoutStatus.status === "declined" || payoutStatus.status === "canceled" || payoutStatus.status === "failed") {
      console.log(`[PaymentPolling] ❌ FedaPay payout ${transaction.id} failed (status: ${payoutStatus.status})`);
      await safeRefundOutgoingTransaction(transaction.id, transaction.userId, metadata, "polling-fedapay-failed");
      await storage.updateTransactionStatus(transaction.id, "failed");
      setImmediate(() => sendApiPayoutCallback(transaction.id, metadata, "failed"));
      setImmediate(() => sendBusinessWebhookCallback(transaction.id, "failed", "payout"));
      return true;
    } else {
      // Still pending
      if (hasPaymentExpired(transaction)) {
        console.log(`[PaymentPolling] ⏱️ FedaPay payout ${transaction.id} TIMEOUT (15min) - marking as failed`);
        await safeRefundOutgoingTransaction(transaction.id, transaction.userId, metadata, "polling-fedapay-timeout");
        await storage.updateTransactionStatus(transaction.id, "failed");
        setImmediate(() => sendApiPayoutCallback(transaction.id, metadata, "failed"));
        setImmediate(() => sendBusinessWebhookCallback(transaction.id, "failed", "payout"));
        return true;
      }
      console.log(`[PaymentPolling] ⏳ FedaPay payout ${transaction.id} still pending (${remainingSeconds}s remaining)`);
      return false;
    }
  } catch (error) {
    console.error(`[PaymentPolling] Error checking FedaPay payout ${transaction.id}:`, error);
    if (hasPaymentExpired(transaction)) {
      console.log(`[PaymentPolling] ⏱️ FedaPay payout ${transaction.id} expired with error - marking as failed`);
      await safeRefundOutgoingTransaction(transaction.id, transaction.userId, metadata, "polling-fedapay-error-timeout");
      await storage.updateTransactionStatus(transaction.id, "failed");
      setImmediate(() => sendApiPayoutCallback(transaction.id, metadata, "failed"));
      setImmediate(() => sendBusinessWebhookCallback(transaction.id, "failed", "payout"));
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
      setImmediate(() => sendBusinessWebhookCallback(transaction.id, "failed", "payin"));
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
      setImmediate(() => sendBusinessWebhookCallback(transaction.id, "failed", "payin"));
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
      const updatedPaydTx = await storage.getTransaction(transaction.id);
      if (updatedPaydTx) {
        trySendPaymentCallback(updatedPaydTx, 'payment.completed', '[PaymentPolling/Paydunya]');
        trySendPaymentLinkDocuments(updatedPaydTx);
      }
      setImmediate(() => sendBusinessWebhookCallback(transaction.id, "completed", "payin"));
    } else {
      console.log(`[PaymentPolling] Paydunya transaction ${transaction.id} already processed - skipping`);
    }
  } else if (paymentStatus === "cancelled" || paymentStatus === "canceled" || paymentStatus === "failed" || paymentStatus === "fail") {
    console.log(`[PaymentPolling] ❌ Paydunya transaction ${transaction.id} failed/cancelled (status: ${paymentStatus})`);
    await storage.updateTransactionStatus(transaction.id, "failed");
    setImmediate(() => sendBusinessWebhookCallback(transaction.id, "failed", "payin"));
  } else {
    if (hasPaymentExpired(transaction)) {
      console.log(`[PaymentPolling] ⏱️ Paydunya transaction ${transaction.id} TIMEOUT (15min) with pending status "${paymentStatus}" - marking as failed`);
      await storage.updateTransactionStatus(transaction.id, "failed");
      setImmediate(() => sendBusinessWebhookCallback(transaction.id, "failed", "payin"));
    } else {
      console.log(`[PaymentPolling] ⏳ Paydunya transaction ${transaction.id} still pending (status: ${paymentStatus}, ${remainingSeconds}s remaining)`);
    }
  }
}

async function processPawaPayDeposit(transaction: Transaction & { user?: User }, metadata: any): Promise<void> {
  const depositId = metadata.pawaPayDepositId;
  const transactionAge = getTransactionAge(transaction);
  const remainingTime = Math.max(0, PAYMENT_TIMEOUT_MS - transactionAge);
  const remainingSeconds = Math.round(remainingTime / 1000);

  console.log(`[PaymentPolling] Checking PawaPay deposit ${transaction.id} (depositId: ${depositId}, ${remainingSeconds}s remaining)`);

  try {
    const result = await getPawaPayDepositStatus(depositId);
    const mappedStatus = mapPawaPayStatus(result.status);

    console.log(`[PaymentPolling] PawaPay deposit ${transaction.id} - raw: ${result.status} → mapped: ${mappedStatus}`);

    if (mappedStatus === "completed") {
      const finalized = await storage.finalizeIncomingTransaction(transaction.id, {});
      if (finalized) {
        console.log(`[PaymentPolling] ✅ PawaPay deposit ${transaction.id} CONFIRMED - credited=${finalized.credited}`);
        const updatedTx = await storage.getTransaction(transaction.id);
        if (updatedTx) {
          trySendPaymentCallback(updatedTx, 'payment.completed', '[PaymentPolling/PawaPay]');
          trySendPaymentLinkDocuments(updatedTx);
        }
        setImmediate(() => sendBusinessWebhookCallback(transaction.id, "completed", "payin"));
      } else {
        console.log(`[PaymentPolling] PawaPay deposit ${transaction.id} already processed - skipping`);
      }
    } else if (mappedStatus === "failed") {
      console.log(`[PaymentPolling] ❌ PawaPay deposit ${transaction.id} failed (raw status: ${result.status})`);
      await storage.updateTransactionStatus(transaction.id, "failed");
      setImmediate(() => sendBusinessWebhookCallback(transaction.id, "failed", "payin"));
    } else {
      if (hasPaymentExpired(transaction)) {
        console.log(`[PaymentPolling] ⏱️ PawaPay deposit ${transaction.id} TIMEOUT - marking as failed`);
        await storage.updateTransactionStatus(transaction.id, "failed");
        setImmediate(() => sendBusinessWebhookCallback(transaction.id, "failed", "payin"));
      } else {
        console.log(`[PaymentPolling] ⏳ PawaPay deposit ${transaction.id} still pending (${remainingSeconds}s remaining)`);
      }
    }
  } catch (error) {
    console.error(`[PaymentPolling] Error checking PawaPay deposit ${transaction.id}:`, error);
    if (hasPaymentExpired(transaction)) {
      await storage.updateTransactionStatus(transaction.id, "failed");
      setImmediate(() => sendBusinessWebhookCallback(transaction.id, "failed", "payin"));
    }
  }
}

async function processPawaPayPayout(transaction: Transaction & { user?: User }, metadata: any): Promise<void> {
  const payoutId = metadata.pawaPayPayoutId;
  const transactionAge = getTransactionAge(transaction);
  const remainingTime = Math.max(0, PAYMENT_TIMEOUT_MS - transactionAge);
  const remainingSeconds = Math.round(remainingTime / 1000);

  console.log(`[PaymentPolling] Checking PawaPay payout ${transaction.id} (payoutId: ${payoutId}, ${remainingSeconds}s remaining)`);

  try {
    const result = await getPawaPayPayoutStatus(payoutId);
    const mappedStatus = mapPawaPayStatus(result.status);

    console.log(`[PaymentPolling] PawaPay payout ${transaction.id} - raw: ${result.status} → mapped: ${mappedStatus}`);

    if (mappedStatus === "completed") {
      await storage.updateTransactionStatus(transaction.id, "completed");
      console.log(`[PaymentPolling] ✅ PawaPay payout ${transaction.id} COMPLETED`);
      const updatedTx = await storage.getTransaction(transaction.id);
      if (updatedTx) {
        trySendPaymentCallback(updatedTx, 'payment.completed', '[PaymentPolling/PawaPay/Payout]');
      }
      setImmediate(() => sendBusinessWebhookCallback(transaction.id, "completed", "payout"));
    } else if (mappedStatus === "failed") {
      console.log(`[PaymentPolling] ❌ PawaPay payout ${transaction.id} failed (raw: ${result.status}) - refunding`);
      await safeRefundOutgoingTransaction(transaction.id, transaction.userId, metadata, "polling-pawapay-payout-failed");
      await storage.updateTransactionStatus(transaction.id, "failed");
      setImmediate(() => sendBusinessWebhookCallback(transaction.id, "failed", "payout"));
    } else {
      if (hasPaymentExpired(transaction)) {
        console.log(`[PaymentPolling] ⏱️ PawaPay payout ${transaction.id} TIMEOUT - refunding`);
        await safeRefundOutgoingTransaction(transaction.id, transaction.userId, metadata, "polling-pawapay-payout-timeout");
        await storage.updateTransactionStatus(transaction.id, "failed");
        setImmediate(() => sendBusinessWebhookCallback(transaction.id, "failed", "payout"));
      } else {
        console.log(`[PaymentPolling] ⏳ PawaPay payout ${transaction.id} still pending (${remainingSeconds}s remaining)`);
      }
    }
  } catch (error) {
    console.error(`[PaymentPolling] Error checking PawaPay payout ${transaction.id}:`, error);
    if (hasPaymentExpired(transaction)) {
      await safeRefundOutgoingTransaction(transaction.id, transaction.userId, metadata, "polling-pawapay-payout-error");
      await storage.updateTransactionStatus(transaction.id, "failed");
      setImmediate(() => sendBusinessWebhookCallback(transaction.id, "failed", "payout"));
    }
  }
}

async function processFeeXPayTransaction(transaction: Transaction & { user?: User }, metadata: any): Promise<boolean> {
  const feeXPayReference = metadata.feeXPayReference;
  const transactionAge = getTransactionAge(transaction);
  const remainingTime = Math.max(0, PAYMENT_TIMEOUT_MS - transactionAge);
  const remainingSeconds = Math.round(remainingTime / 1000);
  const isOutgoing = transaction.type === "withdrawal" || transaction.type === "transfer";

  console.log(`[PaymentPolling] Checking FeeXPay ${isOutgoing ? "payout" : "payin"} ${transaction.id} (ref: ${feeXPayReference}, ${remainingSeconds}s remaining)`);

  const config = await getFeeXPayConfig();
  if (!config) {
    console.log(`[PaymentPolling] FeeXPay config not available - skipping ${transaction.id}`);
    return false;
  }

  try {
    const statusResult = await checkFeeXPayTransactionStatus(config, feeXPayReference);

    if (!statusResult.success) {
      console.log(`[PaymentPolling] FeeXPay status check failed for ${transaction.id}: ${statusResult.error}`);
      if (hasPaymentExpired(transaction)) {
        console.log(`[PaymentPolling] ⏱️ FeeXPay transaction ${transaction.id} TIMEOUT - marking as failed`);
        if (isOutgoing) {
          await safeRefundOutgoingTransaction(transaction.id, transaction.userId, metadata, "polling-feexpay-timeout");
        }
        await storage.updateTransactionStatus(transaction.id, "failed");
        if (isOutgoing) setImmediate(() => sendApiPayoutCallback(transaction.id, metadata, "failed"));
        setImmediate(() => sendBusinessWebhookCallback(transaction.id, "failed", isOutgoing ? "payout" : "payin"));
        return true;
      }
      return false;
    }

    const mapped = statusResult.mappedStatus || "pending";
    console.log(`[PaymentPolling] FeeXPay transaction ${transaction.id} - raw: ${statusResult.status}, mapped: ${mapped}`);

    if (mapped === "completed") {
      const latestTx = await storage.getTransaction(transaction.id);
      if (!latestTx || latestTx.status !== "pending") {
        console.log(`[PaymentPolling] FeeXPay transaction ${transaction.id} already processed (status: ${latestTx?.status}) - skipping`);
        return true;
      }

      if (isOutgoing) {
        await storage.updateTransactionStatus(transaction.id, "completed");
        console.log(`[PaymentPolling] ✅ FeeXPay ${transaction.type} ${transaction.id} COMPLETED`);
        setImmediate(() => sendApiPayoutCallback(transaction.id, metadata, "completed"));
        setImmediate(() => sendBusinessWebhookCallback(transaction.id, "completed", "payout"));
      } else {
        const result = await storage.finalizeIncomingTransaction(transaction.id, {});
        if (result) {
          console.log(`[PaymentPolling] ✅ FeeXPay deposit ${transaction.id} CONFIRMED - credited=${result.credited}`);
          const updatedTx = await storage.getTransaction(transaction.id);
          if (updatedTx) {
            trySendPaymentCallback(updatedTx, 'payment.completed', '[PaymentPolling/FeeXPay]');
            trySendPaymentLinkDocuments(updatedTx);
          }
          setImmediate(() => sendBusinessWebhookCallback(transaction.id, "completed", "payin"));
        } else {
          console.log(`[PaymentPolling] FeeXPay transaction ${transaction.id} already finalized - skipping`);
        }
      }
      return true;
    }

    if (mapped === "failed") {
      const latestTx = await storage.getTransaction(transaction.id);
      if (!latestTx || latestTx.status !== "pending") {
        console.log(`[PaymentPolling] FeeXPay transaction ${transaction.id} already processed (status: ${latestTx?.status}) - skipping`);
        return true;
      }

      console.log(`[PaymentPolling] ❌ FeeXPay transaction ${transaction.id} FAILED (raw: ${statusResult.status})`);
      if (isOutgoing) {
        await safeRefundOutgoingTransaction(transaction.id, transaction.userId, metadata, "polling-feexpay-failed");
      } else {
        await storage.updateTransactionStatus(transaction.id, "failed");
      }
      if (isOutgoing) setImmediate(() => sendApiPayoutCallback(transaction.id, metadata, "failed"));
      setImmediate(() => sendBusinessWebhookCallback(transaction.id, "failed", isOutgoing ? "payout" : "payin"));
      return true;
    }

    if (hasPaymentExpired(transaction)) {
      const latestTx = await storage.getTransaction(transaction.id);
      if (!latestTx || latestTx.status !== "pending") {
        console.log(`[PaymentPolling] FeeXPay transaction ${transaction.id} already processed (status: ${latestTx?.status}) during timeout - skipping`);
        return true;
      }

      console.log(`[PaymentPolling] ⏱️ FeeXPay transaction ${transaction.id} TIMEOUT (still pending after ${Math.round(transactionAge / 60000)}min)`);
      if (isOutgoing) {
        await safeRefundOutgoingTransaction(transaction.id, transaction.userId, metadata, "polling-feexpay-timeout");
      } else {
        await storage.updateTransactionStatus(transaction.id, "failed");
      }
      if (isOutgoing) setImmediate(() => sendApiPayoutCallback(transaction.id, metadata, "failed"));
      setImmediate(() => sendBusinessWebhookCallback(transaction.id, "failed", isOutgoing ? "payout" : "payin"));
      return true;
    }

    console.log(`[PaymentPolling] ⏳ FeeXPay transaction ${transaction.id} still pending (${remainingSeconds}s remaining)`);
    return false;
  } catch (error) {
    console.error(`[PaymentPolling] Error checking FeeXPay transaction ${transaction.id}:`, error);
    if (hasPaymentExpired(transaction)) {
      const latestTx = await storage.getTransaction(transaction.id);
      if (!latestTx || latestTx.status !== "pending") {
        return true;
      }
      if (isOutgoing) {
        await safeRefundOutgoingTransaction(transaction.id, transaction.userId, metadata, "polling-feexpay-error");
      } else {
        await storage.updateTransactionStatus(transaction.id, "failed");
      }
      setImmediate(() => sendBusinessWebhookCallback(transaction.id, "failed", isOutgoing ? "payout" : "payin"));
      return true;
    }
    return false;
  }
}

async function processTransaction(transaction: Transaction & { user?: User }): Promise<void> {
  let metadata: any = {};
  if (transaction.metadata) {
    try {
      metadata = JSON.parse(transaction.metadata);
    } catch (e) {}
  }

  // Check if this is a NOWPayments crypto transaction
  // IMPORTANT: Skip outgoing crypto transactions (withdrawals/transfers) - they must ONLY be updated by the NOWPayments payout webhook
  if (metadata.paymentId || metadata.nowPaymentsPaymentId || metadata.paymentProvider === "nowpayments" || metadata.isCrypto === true) {
    if (metadata.isCryptoWithdrawal === true || metadata.payoutId) {
      console.log(`[PaymentPolling] Skipping crypto payout transaction ${transaction.id} (payoutId: ${metadata.payoutId}) - status managed by webhook only`);
      return;
    }
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

  // Check if this is an AfribaPay transaction (incoming or outgoing)
  if (metadata.provider === "afribapay" && metadata.afribaPayTransactionId) {
    const isOutgoing = transaction.type === "withdrawal" || transaction.type === "transfer";
    if (isOutgoing) {
      await processAfribaPayPayout(transaction, metadata);
    } else {
      await processAfribaPayIncoming(transaction, metadata);
    }
    return;
  }

  // Check if this is a FeeXPay transaction
  if (metadata.paymentProvider === "feexpay" || metadata.provider === "feexpay" || metadata.feeXPayReference) {
    await processFeeXPayTransaction(transaction, metadata);
    return;
  }

  // Check if this is a MoneyFusion transaction (payout only)
  if (metadata.paymentProvider === "moneyfusion" || metadata.moneyFusionTokenPay) {
    await processMoneyFusionPayout(transaction, metadata);
    return;
  }

  // Check if this is a MbiyoPay transaction
  if (metadata.mbiyopayTransactionId || metadata.paymentProvider === "mbiyopay") {
    if (metadata.adminReviewPending) {
      return;
    }
    await processMbiyoPayTransaction(transaction, metadata);
    return;
  }

  // Check if this is a PawaPay transaction (deposit or payout)
  if (metadata.paymentProvider === "pawapay" || metadata.pawaPayDepositId || metadata.pawaPayPayoutId) {
    const isOutgoing = transaction.type === "withdrawal" || transaction.type === "transfer";
    if (isOutgoing && metadata.pawaPayPayoutId) {
      await processPawaPayPayout(transaction, metadata);
    } else if (metadata.pawaPayDepositId) {
      await processPawaPayDeposit(transaction, metadata);
    }
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
