import crypto from 'crypto';
import type { Transaction, ApiKey } from '@shared/schema';

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
  timestamp: string;
}

function generateSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export async function sendPaymentCallback(
  transaction: Transaction,
  apiKey: ApiKey,
  event: 'payment.completed' | 'payment.failed' = 'payment.completed'
): Promise<{ success: boolean; error?: string }> {
  if (!apiKey.callbackUrl || !apiKey.callbackSecret) {
    console.log(`[Callback] No callback URL configured for API key ${apiKey.id}`);
    return { success: false, error: 'No callback URL configured' };
  }

  // Parse metadata to get external reference
  let externalReference: string | undefined;
  if (transaction.metadata) {
    try {
      const metadata = JSON.parse(transaction.metadata);
      externalReference = metadata.externalReference || metadata.reference;
    } catch (e) {
      // Ignore parse errors
    }
  }

  // Calculate net amount (amount - fee)
  const netAmount = transaction.amount - (transaction.fee || 0);

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
    timestamp: new Date().toISOString(),
  };

  const payloadJson = JSON.stringify(payload);
  const signature = generateSignature(payloadJson, apiKey.callbackSecret);

  try {
    console.log(`[Callback] Sending ${event} callback to ${apiKey.callbackUrl}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(apiKey.callbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BKApay-Signature': signature,
        'X-BKApay-Event': event,
        'X-BKApay-Timestamp': payload.timestamp,
      },
      body: payloadJson,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      console.log(`[Callback] Successfully sent to ${apiKey.callbackUrl}, status: ${response.status}`);
      return { success: true };
    } else {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[Callback] Failed to send to ${apiKey.callbackUrl}, status: ${response.status}, error: ${errorText}`);
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error(`[Callback] Timeout sending to ${apiKey.callbackUrl}`);
      return { success: false, error: 'Request timeout' };
    }
    console.error(`[Callback] Error sending to ${apiKey.callbackUrl}:`, error.message);
    return { success: false, error: error.message };
  }
}
