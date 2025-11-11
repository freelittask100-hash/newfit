import { supabase } from '@/integrations/supabase/client';
import SHA256 from 'crypto-js/sha256';

// PhonePe API configuration
const PHONEPE_ENV = import.meta.env.VITE_PHONEPE_ENV || 'sandbox';
const PHONEPE_BASE_URL = PHONEPE_ENV === 'production'
  ? 'https://api.phonepe.com/apis/hermes'
  : 'https://api-preprod.phonepe.com/apis/pg-sandbox';

const PHONEPE_MERCHANT_ID = import.meta.env.VITE_PHONEPE_MERCHANT_ID || '';
const PHONEPE_SALT_KEY = import.meta.env.VITE_PHONEPE_SALT_KEY || '';
const PHONEPE_SALT_INDEX = import.meta.env.VITE_PHONEPE_SALT_INDEX || '1';

// Validate configuration
if (!PHONEPE_MERCHANT_ID || !PHONEPE_SALT_KEY) {
  console.warn('⚠️ PhonePe credentials not configured. Please set VITE_PHONEPE_MERCHANT_ID and VITE_PHONEPE_SALT_KEY in .env file');
}

export interface PhonePePaymentOptions {
  amount: number; // Amount in paisa (1 INR = 100 paisa)
  merchantTransactionId: string;
  merchantUserId: string;
  redirectUrl: string;
  callbackUrl: string;
  mobileNumber?: string;
  deviceContext?: {
    deviceOS: string;
  };
}

export interface PhonePeOrderResponse {
  success: boolean;
  code: string;
  message: string;
  data?: {
    merchantId: string;
    merchantTransactionId: string;
    instrumentResponse?: {
      redirectInfo?: {
        url: string;
        method: string;
      };
      type?: string;
    };
  };
}

export interface PhonePeStatusResponse {
  success: boolean;
  code: string;
  message: string;
  data?: {
    merchantId: string;
    merchantTransactionId: string;
    transactionId: string;
    amount: number;
    state: 'COMPLETED' | 'FAILED' | 'PENDING';
    responseCode: string;
    paymentInstrument?: {
      type: string;
      [key: string]: any;
    };
  };
}

export interface PaymentTransaction {
  id?: string;
  order_id: string;
  merchant_transaction_id: string;
  amount: number;
  status: 'INITIATED' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
  phonepe_transaction_id?: string;
  payment_method?: string;
  response_code?: string;
  response_message?: string;
  phonepe_response?: any;
}

// Generate SHA256 hash for PhonePe
function generateSHA256Hash(data: string): string {
  return SHA256(data).toString();
}

// Create PhonePe payment payload
function createPaymentPayload(options: PhonePePaymentOptions) {
  const payload = {
    merchantId: PHONEPE_MERCHANT_ID,
    merchantTransactionId: options.merchantTransactionId,
    merchantUserId: options.merchantUserId,
    amount: options.amount,
    redirectUrl: options.redirectUrl,
    redirectMode: 'REDIRECT',
    callbackUrl: options.callbackUrl,
    mobileNumber: options.mobileNumber,
    paymentInstrument: {
      type: 'PAY_PAGE'
    },
    deviceContext: options.deviceContext
  };

  return payload;
}

// Create SHA256 hash for request
function createRequestHash(payload: string, endpoint: string): string {
  const data = payload + endpoint + PHONEPE_SALT_KEY;
  return generateSHA256Hash(data) + '###' + PHONEPE_SALT_INDEX;
}

// Initiate PhonePe payment with retry logic
export async function initiatePhonePePayment(
  options: PhonePePaymentOptions,
  retries: number = 2
): Promise<PhonePeOrderResponse> {
  // Validate credentials
  if (!PHONEPE_MERCHANT_ID || !PHONEPE_SALT_KEY) {
    return {
      success: false,
      code: 'CONFIG_ERROR',
      message: 'PhonePe credentials not configured. Please check your environment variables.'
    };
  }

  let lastError: any;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const payload = createPaymentPayload(options);
      const payloadString = JSON.stringify(payload);
      const base64Payload = btoa(payloadString);

      const requestHash = createRequestHash(base64Payload, '/pg/v1/pay');

      const requestBody = {
        request: base64Payload
      };

      console.log(`[PhonePe] Initiating payment (attempt ${attempt + 1}/${retries + 1})`, {
        merchantTransactionId: options.merchantTransactionId,
        amount: options.amount,
        environment: PHONEPE_ENV
      });

      const response = await fetch(`${PHONEPE_BASE_URL}/pg/v1/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': requestHash,
          'X-MERCHANT-ID': PHONEPE_MERCHANT_ID
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      console.log('[PhonePe] Payment initiation response:', {
        success: result.success,
        code: result.code,
        message: result.message
      });

      if (result.success) {
        return {
          success: true,
          code: result.code,
          message: result.message,
          data: result.data
        };
      } else {
        // Don't retry for certain error codes
        const noRetryErrors = ['BAD_REQUEST', 'INVALID_MERCHANT', 'DUPLICATE_TRANSACTION'];
        if (noRetryErrors.includes(result.code)) {
          return {
            success: false,
            code: result.code,
            message: result.message || 'Payment initiation failed'
          };
        }

        lastError = new Error(result.message || 'Payment initiation failed');
      }
    } catch (error: any) {
      console.error(`[PhonePe] Payment initiation attempt ${attempt + 1} failed:`, error);
      lastError = error;

      // Wait before retry (exponential backoff)
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  return {
    success: false,
    code: 'ERROR',
    message: lastError?.message || 'Payment initiation failed after multiple attempts'
  };
}

// Check payment status with retry logic
export async function checkPaymentStatus(
  merchantTransactionId: string,
  retries: number = 3
): Promise<PhonePeStatusResponse | null> {
  if (!PHONEPE_MERCHANT_ID || !PHONEPE_SALT_KEY) {
    console.error('[PhonePe] Credentials not configured');
    return null;
  }

  let lastError: any;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const endpoint = `/pg/v1/status/${PHONEPE_MERCHANT_ID}/${merchantTransactionId}`;
      const requestHash = createRequestHash('', endpoint);

      console.log(`[PhonePe] Checking payment status (attempt ${attempt + 1}/${retries + 1})`, {
        merchantTransactionId
      });

      const response = await fetch(`${PHONEPE_BASE_URL}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': requestHash,
          'X-MERCHANT-ID': PHONEPE_MERCHANT_ID
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      console.log('[PhonePe] Payment status response:', {
        success: result.success,
        code: result.code,
        state: result.data?.state
      });

      return result;
    } catch (error: any) {
      console.error(`[PhonePe] Status check attempt ${attempt + 1} failed:`, error);
      lastError = error;

      // Wait before retry
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  console.error('[PhonePe] Payment status check failed after all retries:', lastError);
  return null;
}

// Create payment transaction record
export async function createPaymentTransaction(
  orderId: string,
  merchantTransactionId: string,
  amount: number,
  metadata?: any
): Promise<string | null> {
  try {
    const { data, error } = await (supabase.rpc as any)('create_payment_transaction', {
      p_order_id: orderId,
      p_merchant_transaction_id: merchantTransactionId,
      p_amount: amount,
      p_metadata: metadata || null
    });

    if (error) {
      console.error('[PhonePe] Failed to create payment transaction:', error);
      return null;
    }

    console.log('[PhonePe] Payment transaction created:', data);
    return data;
  } catch (error) {
    console.error('[PhonePe] Error creating payment transaction:', error);
    return null;
  }
}

// Update payment transaction status
export async function updatePaymentTransaction(
  merchantTransactionId: string,
  status: 'INITIATED' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED' | 'CANCELLED',
  phonePeResponse?: any
): Promise<boolean> {
  try {
    const paymentMethod = phonePeResponse?.data?.paymentInstrument?.type;
    const phonepeTransactionId = phonePeResponse?.data?.transactionId;
    const responseCode = phonePeResponse?.data?.responseCode;
    const responseMessage = phonePeResponse?.message;

    const { data, error } = await (supabase.rpc as any)('update_payment_transaction_status', {
      p_merchant_transaction_id: merchantTransactionId,
      p_status: status,
      p_phonepe_transaction_id: phonepeTransactionId || null,
      p_payment_method: paymentMethod || null,
      p_response_code: responseCode || null,
      p_response_message: responseMessage || null,
      p_phonepe_response: phonePeResponse || null
    });

    if (error) {
      console.error('[PhonePe] Failed to update payment transaction:', error);
      return false;
    }

    console.log('[PhonePe] Payment transaction updated:', {
      merchantTransactionId,
      status,
      success: data
    });

    return data;
  } catch (error) {
    console.error('[PhonePe] Error updating payment transaction:', error);
    return false;
  }
}

// Store payment details (legacy function for backward compatibility)
export async function storePaymentDetails(orderId: string, paymentData: any) {
  try {
    // Update the order with payment information
    const { error } = await supabase
      .from('orders')
      .update({
        payment_id: paymentData.merchantTransactionId,
        status: paymentData.status === 'SUCCESS' ? 'paid' : 'pending'
      })
      .eq('id', orderId);

    if (error) {
      console.error('[PhonePe] Failed to store payment details in orders:', error);
    } else {
      console.log('[PhonePe] Payment details stored in orders table');
    }
  } catch (error) {
    console.error('[PhonePe] Error storing payment details:', error);
  }
}

// Get payment transaction by merchant transaction ID
export async function getPaymentTransaction(merchantTransactionId: string): Promise<PaymentTransaction | null> {
  try {
    const { data, error } = await (supabase
      .from as any)('payment_transactions')
      .select('*')
      .eq('merchant_transaction_id', merchantTransactionId)
      .single();

    if (error) {
      console.error('[PhonePe] Failed to get payment transaction:', error);
      return null;
    }

    return data as PaymentTransaction;
  } catch (error) {
    console.error('[PhonePe] Error getting payment transaction:', error);
    return null;
  }
}

// Get payment transactions for an order
export async function getOrderPaymentTransactions(orderId: string): Promise<PaymentTransaction[]> {
  try {
    const { data, error } = await (supabase
      .from as any)('payment_transactions')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[PhonePe] Failed to get order payment transactions:', error);
      return [];
    }

    return (data || []) as PaymentTransaction[];
  } catch (error) {
    console.error('[PhonePe] Error getting order payment transactions:', error);
    return [];
  }
}

// Verify PhonePe webhook signature
export function verifyWebhookSignature(
  base64Response: string,
  receivedSignature: string
): boolean {
  try {
    const expectedSignature = SHA256(base64Response + PHONEPE_SALT_KEY).toString() + '###' + PHONEPE_SALT_INDEX;
    return expectedSignature === receivedSignature;
  } catch (error) {
    console.error('[PhonePe] Error verifying webhook signature:', error);
    return false;
  }
}
