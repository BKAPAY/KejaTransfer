import crypto from 'crypto';
import type { Transaction, ApiKey } from '@shared/schema';
import { storage } from '../storage';

export async function resolveApiKeyForCallback(transaction: Transaction): Promise<ApiKey | null> {
  if (transaction.type !== "api_payment") return null;

  let apiKeyPublicKey: string | undefined;
  let apiKeyId: string | undefined;
  let sessionCallbackUrl: string | undefined;

  if (transaction.metadata) {
    try {
      const meta = JSON.parse(transaction.metadata);
      apiKeyPublicKey = meta.apiKeyPublicKey;
      apiKeyId = meta.api_key_id || meta.apiKeyId;
      sessionCallbackUrl = meta.callbackUrl;
    } catch (e) {}
  }

  let apiKey: ApiKey | undefined;

  if (apiKeyPublicKey) {
    apiKey = await storage.getApiKeyByPublicKey(apiKeyPublicKey);
  }

  if (!apiKey && apiKeyId) {
    apiKey = await storage.getApiKeyById(apiKeyId);
  }

  if (apiKey && (apiKey.callbackUrl || sessionCallbackUrl)) {
    return apiKey;
  }

  return null;
}

function generateSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

async function tryDeliverPayinWebhook(
  callbackUrl: string,
  callbackSecret: string,
  payloadStr: string,
  event: string,
  timestamp: string,
): Promise<boolean> {
  try {
    const signature = generateSignature(payloadStr, callbackSecret);
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(callbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BKApay-Signature': signature,
        'X-BKApay-Event': event,
        'X-BKApay-Timestamp': timestamp,
      },
      body: payloadStr,
      signal: controller.signal,
    }).finally(() => clearTimeout(tid));
    return response.ok;
  } catch {
    return false;
  }
}

interface CallbackPayload {
  event: 'payment.completed' | 'payment.failed';
  transactionId: string;
  externalReference?: string;
  amount: number;
  fee: number;
  netAmount: number;
  currency: string;
  status: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  country?: string;
  operator?: string;
  description?: string;
  successUrl?: string;
  cancelUrl?: string;
  timestamp: string;
  original_amount?: number;
  original_currency?: string;
}

export async function sendPaymentCallback(
  transaction: Transaction,
  apiKey: ApiKey,
  event: 'payment.completed' | 'payment.failed' = 'payment.completed'
): Promise<{ success: boolean; error?: string }> {
  let externalReference: string | undefined;
  let successUrl: string | undefined;
  let cancelUrl: string | undefined;
  let sessionCallbackUrl: string | undefined;
  let netAmountFromMeta: number | null = null;
  let originalAmountFromMeta: number | undefined;
  let originalCurrencyFromMeta: string | undefined;

  if (transaction.metadata) {
    try {
      const metadata = JSON.parse(transaction.metadata);
      externalReference = metadata.externalReference || metadata.reference || metadata.orderId;
      successUrl = metadata.successUrl || undefined;
      cancelUrl = metadata.cancelUrl || undefined;
      sessionCallbackUrl = metadata.callbackUrl || undefined;
      if (typeof metadata.netAmountForUser === 'number') {
        netAmountFromMeta = metadata.netAmountForUser;
      }
      if (typeof metadata.originalAmount === 'number') {
        originalAmountFromMeta = metadata.originalAmount;
        originalCurrencyFromMeta = metadata.originalCurrency || undefined;
      }
    } catch (e) {}
  }

  const effectiveCallbackUrl = sessionCallbackUrl || apiKey.callbackUrl;

  if (!effectiveCallbackUrl || !apiKey.callbackSecret) {
    console.log(`[Callback] Aucune callbackUrl ou secret configure pour la cle API ${apiKey.id}`);
    return { success: false, error: 'No callback URL configured' };
  }

  const netAmount = netAmountFromMeta !== null
    ? netAmountFromMeta
    : transaction.amount - (transaction.fee || 0);

  const payload: CallbackPayload = {
    event,
    transactionId: transaction.id,
    externalReference,
    amount: transaction.amount,
    fee: transaction.fee || 0,
    netAmount,
    currency: transaction.currency || 'XOF',
    status: transaction.status,
    customerName: transaction.customerName || undefined,
    customerEmail: transaction.customerEmail || undefined,
    customerPhone: transaction.customerPhone || undefined,
    country: transaction.country || undefined,
    operator: transaction.operator || undefined,
    description: transaction.description || undefined,
    successUrl,
    cancelUrl,
    timestamp: new Date().toISOString(),
    ...(originalAmountFromMeta !== undefined ? {
      original_amount: originalAmountFromMeta,
      original_currency: originalCurrencyFromMeta,
    } : {}),
  };

  const payloadJson = JSON.stringify(payload);
  const timestamp = payload.timestamp;

  const MAX_ATTEMPTS = 120;
  const RETRY_INTERVAL_MS = 5000;
  let attempt = 0;

  const attempt_send = async () => {
    attempt++;
    const success = await tryDeliverPayinWebhook(
      effectiveCallbackUrl!,
      apiKey.callbackSecret!,
      payloadJson,
      event,
      timestamp,
    );

    if (success) {
      console.log(`[Callback] Webhook ${event} delivre a ${effectiveCallbackUrl} pour tx ${transaction.id} — tentative ${attempt}`);
      return;
    }

    console.warn(`[Callback] Tentative ${attempt}/${MAX_ATTEMPTS} echouee pour tx ${transaction.id} — nouvel essai dans ${RETRY_INTERVAL_MS / 1000}s`);

    if (attempt < MAX_ATTEMPTS) {
      setTimeout(attempt_send, RETRY_INTERVAL_MS);
    } else {
      console.error(`[Callback] Abandon apres ${MAX_ATTEMPTS} tentatives pour tx ${transaction.id} (${event})`);
    }
  };

  attempt_send();
  return { success: true };
}

export async function trySendPaymentCallback(
  transaction: Transaction,
  event: 'payment.completed' | 'payment.failed',
  logPrefix: string = '[Callback]'
): Promise<void> {
  try {
    const apiKey = await resolveApiKeyForCallback(transaction);
    if (apiKey) {
      await sendPaymentCallback(transaction, apiKey, event);
      console.log(`${logPrefix} Developer callback ${event} initie avec retry pour tx ${transaction.id}`);
    }
  } catch (error) {
    console.error(`${logPrefix} Erreur envoi developer callback:`, error);
  }
}
