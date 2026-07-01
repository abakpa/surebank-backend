const axios = require('axios');
const crypto = require('crypto');

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

// Check if Paystack key is configured
if (!PAYSTACK_SECRET_KEY) {
  console.warn('WARNING: PAYSTACK_SECRET_KEY is not set in environment variables');
}

const paystackApi = axios.create({
  baseURL: PAYSTACK_BASE_URL,
  headers: {
    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json'
  }
});

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
};

const buildFallbackEmail = (identifier = 'customer') => {
  const safeIdentifier = String(identifier || 'customer')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
  return `${safeIdentifier || 'customer'}@surebankstores.com`;
};

const resolvePaystackEmail = (email, fallbackIdentifier) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  return isValidEmail(normalizedEmail)
    ? normalizedEmail
    : buildFallbackEmail(fallbackIdentifier);
};

/**
 * Initialize a Paystack transaction
 * @param {Object} data - Transaction data
 * @param {string} data.email - Customer email
 * @param {number} data.amount - Amount in kobo (multiply naira by 100)
 * @param {string} data.reference - Unique transaction reference
 * @param {string} data.callback_url - URL to redirect after payment
 * @param {Object} data.metadata - Additional data to store with transaction
 */
const initializeTransaction = async (data) => {
  try {
    // Validate Paystack key is configured
    if (!PAYSTACK_SECRET_KEY) {
      throw new Error('Paystack is not configured. Please contact support.');
    }

    const paymentEmail = resolvePaystackEmail(
      data.email,
      data.metadata?.wallet_data?.customerId
        || data.metadata?.order_deposit_data?.customerId
        || data.metadata?.order_data?.customerId
        || data.reference
    );

    console.log('Initializing Paystack transaction for:', paymentEmail, 'Amount:', data.amount);

    const response = await paystackApi.post('/transaction/initialize', {
      email: paymentEmail,
      amount: data.amount, // Amount in kobo
      reference: data.reference,
      callback_url: data.callback_url,
      metadata: data.metadata,
      channels: data.channels
    });

    console.log('Paystack API response status:', response.status);

    return response.data;
  } catch (error) {
    console.error('Paystack initialization error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Failed to initialize payment');
  }
};

/**
 * Verify a Paystack transaction
 * @param {string} reference - Transaction reference
 */
const verifyTransaction = async (reference) => {
  try {
    const response = await paystackApi.get(`/transaction/verify/${reference}`);
    return response.data;
  } catch (error) {
    console.error('Paystack verification error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Failed to verify payment');
  }
};

/**
 * Generate a unique payment reference
 * @param {string} prefix - Prefix for the reference
 */
const generateReference = (prefix = 'SB') => {
  const timestamp = Date.now();
  const randomBytes = crypto.randomBytes(8).toString('hex');
  return `${prefix}_${timestamp}_${randomBytes}`;
};

/**
 * Initialize payment for an order
 * @param {Object} orderData - Order details
 * @param {string} customerEmail - Customer's email
 * @param {string} callbackUrl - URL to redirect after payment
 * @param {number} amountToCharge - Pre-calculated amount to charge (optional)
 */
const initializeOrderPayment = async (orderData, customerEmail, callbackUrl, amountToCharge = null) => {
  const reference = generateReference('ORD');

  // Use pre-calculated amount if provided, otherwise calculate
  let amount;
  const explicitAmount = Number(
    amountToCharge
    || orderData.amountToCharge
    || orderData.firstPaymentAmount
    || orderData.amountToPay
    || orderData.initialPaymentAmount
  );

  if (Number.isFinite(explicitAmount) && explicitAmount > 0) {
    amount = explicitAmount;
  } else if (orderData.paymentType === 'installment') {
    throw new Error('First payment amount is required for pay-small-small orders');
  } else {
    amount = orderData.totalAmount;
  }

  // Convert to kobo (Paystack uses kobo, not naira)
  const amountInKobo = Math.round(amount * 100);

  console.log('Paystack payment initialization:', { amount, amountInKobo, email: customerEmail });

  const paymentData = {
    email: customerEmail,
    amount: amountInKobo,
    reference,
    callback_url: callbackUrl,
    channels: ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer'],
    metadata: {
      custom_fields: [
        {
          display_name: 'Order Type',
          variable_name: 'order_type',
          value: orderData.paymentType
        },
        {
          display_name: 'Product',
          variable_name: 'product_name',
          value: orderData.productName || 'E-Commerce Order'
        },
        {
          display_name: 'Amount Due',
          variable_name: 'amount_due',
          value: `₦${amount.toLocaleString()}`
        }
      ],
      order_data: orderData
    }
  };

  console.log('Sending to Paystack:', JSON.stringify(paymentData, null, 2));

  const result = await initializeTransaction(paymentData);

  console.log('Paystack response:', JSON.stringify(result, null, 2));

  // Validate Paystack response
  if (!result || !result.data || !result.data.authorization_url) {
    console.error('Invalid Paystack response structure:', result);
    throw new Error('Invalid response from Paystack');
  }

  return {
    ...result,
    reference,
    amount,
    amountInKobo
  };
};

const initializeOrderDepositPayment = async ({ orderNumber, customerId, amount, customerEmail, callbackUrl }) => {
  const reference = generateReference('ORDDEP');
  const amountInKobo = Math.round(Number(amount) * 100);

  const result = await initializeTransaction({
    email: customerEmail,
    amount: amountInKobo,
    reference,
    callback_url: callbackUrl,
    channels: ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer'],
    metadata: {
      custom_fields: [
        {
          display_name: 'Order Deposit',
          variable_name: 'order_number',
          value: orderNumber
        },
        {
          display_name: 'Amount',
          variable_name: 'amount',
          value: `₦${Number(amount).toLocaleString()}`
        }
      ],
      order_deposit_data: {
        orderNumber,
        customerId,
        amount: Number(amount)
      }
    }
  });

  if (!result || !result.data || !result.data.authorization_url) {
    throw new Error('Invalid response from Paystack');
  }

  return {
    ...result,
    reference,
    amount: Number(amount),
    amountInKobo
  };
};

module.exports = {
  initializeTransaction,
  verifyTransaction,
  generateReference,
  initializeOrderPayment,
  initializeOrderDepositPayment
};
