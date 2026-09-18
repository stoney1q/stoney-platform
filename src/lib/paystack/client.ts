import crypto from 'crypto';

function getSecretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key)
    throw new Error('PAYSTACK_SECRET_KEY environment variable is missing.');
  return key;
}

export interface PaystackInitializeParams {
  email: string;
  amount: number; // in pesewas
  reference?: string;
  callback_url?: string;
  metadata: {
    saleId: string;
    portalToken: string;
    amountPesewas: number;
    [key: string]: string | number | boolean | null | undefined;
  };
}

export interface PaystackInitializeResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export async function initializeTransaction(
  params: PaystackInitializeParams
): Promise<PaystackInitializeResponse> {
  const secret = getSecretKey();

  const response = await fetch(
    'https://api.paystack.co/transaction/initialize',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: params.email,
        amount: params.amount,
        reference: params.reference,
        callback_url: params.callback_url,
        metadata: params.metadata,
        currency: 'GHS',
        channels: ['card', 'mobile_money', 'bank', 'ussd', 'qr'],
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Paystack initialize failed: ${response.status} ${errorText}`
    );
  }

  const data = await response.json();
  if (!data.status) {
    throw new Error(`Paystack returned false status: ${data.message}`);
  }

  return data.data;
}

export async function verifyTransaction(
  reference: string
): Promise<Record<string, unknown>> {
  const secret = getSecretKey();

  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Cache-Control': 'no-cache',
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Paystack verify failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  if (!data.status) {
    throw new Error(`Paystack verify returned false status: ${data.message}`);
  }

  return data.data;
}

export function verifyWebhookSignature(
  rawBody: string,
  signature: string
): boolean {
  if (!signature) return false;
  const secret = getSecretKey();
  const hash = crypto
    .createHmac('sha512', secret)
    .update(rawBody)
    .digest('hex');
  return hash === signature;
}
