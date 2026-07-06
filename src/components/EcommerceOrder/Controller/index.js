const EcommerceOrderService = require('../Service/index');
const PaystackService = require('../../Paystack/Service/index');
const Cart = require('../../Cart/Model/index');
const Product = require('../../Product/Model/index');
const Customer = require('../../Customer/Model/index');
const CartService = require('../../Cart/Service/index');

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
};

const buildFallbackEmail = (customer) => {
  const identifier = String(customer?.phone || customer?._id || 'customer')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
  return `${identifier || 'customer'}@surebankstores.com`;
};

const resolvePaymentEmail = async ({ customerId, customerEmail, orderEmail }) => {
  const providedEmail = String(customerEmail || '').trim();
  if (isValidEmail(providedEmail)) return providedEmail;

  const storedOrderEmail = String(orderEmail || '').trim();
  if (isValidEmail(storedOrderEmail)) return storedOrderEmail;

  const customer = await Customer.findById(customerId).select('email phone').lean();
  const profileEmail = String(customer?.email || '').trim();
  if (isValidEmail(profileEmail)) return profileEmail;

  return buildFallbackEmail(customer || { _id: customerId });
};

const createOrder = async (req, res) => {
  try {
    const customerId = req.customer.customerId;
    const {
      paymentType,
      installmentFrequency,
      installmentDuration,
      shippingAddress,
      shippingCity,
      shippingState,
      customerPhone,
      customerEmail,
      notes,
      branchId,
      accountNumber
    } = req.body;

    const normalizedInstallmentFrequency = paymentType === 'installment'
      ? (installmentFrequency || 'flexible')
      : installmentFrequency;
    const normalizedInstallmentDuration = paymentType === 'installment'
      ? Number(installmentDuration || 0)
      : installmentDuration;

    const order = await EcommerceOrderService.createOrder({
      customerId,
      accountNumber: accountNumber || req.customer.phone,
      paymentType,
      installmentFrequency: normalizedInstallmentFrequency,
      installmentDuration: normalizedInstallmentDuration,
      shippingAddress,
      shippingCity,
      shippingState,
      customerPhone,
      customerEmail,
      notes,
      branchId
    });

    res.status(201).json({
      message: 'Order created successfully',
      order
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getOrderById = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await EcommerceOrderService.getOrderById(orderId, req.staff);
    res.status(200).json(order);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

const getOrderByNumber = async (req, res) => {
  try {
    const orderNumber = req.params.orderNumber;
    const order = await EcommerceOrderService.getOrderByNumber(orderNumber);
    if (order.customerId?.toString() !== req.customer.customerId.toString()) {
      return res.status(403).json({ message: 'You are not allowed to view this order' });
    }
    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getMyOrders = async (req, res) => {
  try {
    const customerId = req.customer.customerId;
    const orders = await EcommerceOrderService.getCustomerOrders(customerId);
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getProductActionRequests = async (req, res) => {
  try {
    const result = await EcommerceOrderService.getProductActionRequests(req.staff);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getActiveOrder = async (req, res) => {
  try {
    const customerId = req.customer.customerId;
    const order = await EcommerceOrderService.getActiveCustomerEcommerceOrder(customerId);
    res.status(200).json({
      hasActiveOrder: Boolean(order),
      order
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const addItemsToActiveOrder = async (req, res) => {
  try {
    const customerId = req.customer.customerId;
    const order = await EcommerceOrderService.addItemsToActiveOrder({
      ...req.body,
      customerId,
      accountNumber: req.body.accountNumber || req.customer.phone
    });

    res.status(200).json({
      message: 'Product added to your active SB order',
      order
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const replaceInstallmentOrderItem = async (req, res) => {
  try {
    const customerId = req.customer.customerId;
    const { orderNumber, itemId } = req.params;
    const { productId, variationId } = req.body;

    if (!productId) {
      return res.status(400).json({ message: 'Product is required' });
    }

    const order = await EcommerceOrderService.replaceInstallmentOrderItem({
      orderNumber,
      customerId,
      itemId,
      productId,
      variationId: variationId || ''
    });

    res.status(200).json({
      message: 'Order item replaced successfully',
      order
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const payoffRemainingBalance = async (req, res) => {
  try {
    const customerId = req.customer.customerId;
    const orderNumber = req.params.orderNumber;
    const order = await EcommerceOrderService.payoffRemainingBalanceFromWallet(orderNumber, customerId);

    res.status(200).json({
      message: 'Remaining balance paid successfully from wallet',
      order
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const payOrderItemFromWallet = async (req, res) => {
  try {
    const customerId = req.customer.customerId;
    const { orderNumber, itemId } = req.params;
    const order = await EcommerceOrderService.payOrderItemFromWallet({
      orderNumber,
      itemId,
      customerId
    });

    res.status(200).json({
      message: 'Product paid successfully from wallet',
      order
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const initializeOrderDepositPayment = async (req, res) => {
  try {
    const customerId = req.customer.customerId;
    const orderNumber = req.params.orderNumber;
    const { amount, customerEmail, callbackUrl } = req.body;
    const paymentAmount = Number(amount);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ message: 'Valid payment amount is required' });
    }

    const order = await EcommerceOrderService.getOrderByNumber(orderNumber);
    if (order.customerId?.toString() !== customerId.toString()) {
      return res.status(403).json({ message: 'You are not allowed to pay for this order' });
    }
    if (order.paymentType !== 'installment' || !order.installmentPlan) {
      return res.status(400).json({ message: 'Only pay-small-small orders can receive deposits' });
    }

    const remainingBalance = Number(order.installmentPlan.remainingBalance || 0);
    if (remainingBalance <= 0) {
      return res.status(400).json({ message: 'This order has already been fully paid' });
    }
    if (paymentAmount > remainingBalance) {
      return res.status(400).json({ message: `Payment amount cannot exceed remaining balance of ₦${remainingBalance.toLocaleString()}` });
    }

    const email = await resolvePaymentEmail({
      customerId,
      customerEmail,
      orderEmail: order.customerEmail
    });
    const paymentResult = await PaystackService.initializeOrderDepositPayment({
      orderNumber,
      customerId,
      amount: paymentAmount,
      customerEmail: email,
      callbackUrl
    });

    res.status(200).json({
      message: 'Order deposit payment initialized',
      data: {
        authorization_url: paymentResult.data.authorization_url,
        access_code: paymentResult.data.access_code,
        reference: paymentResult.reference,
        amount: paymentAmount,
        amountInKobo: paymentResult.amountInKobo
      }
    });
  } catch (error) {
    console.error('Initialize order deposit error:', error);
    res.status(500).json({ message: error.message });
  }
};

const getAllOrders = async (req, res) => {
  try {
    const { status, paymentStatus, branchId } = req.query;
    const orders = await EcommerceOrderService.getAllOrders({
      status,
      paymentStatus,
      branchId
    }, req.staff);
    res.status(200).json(orders);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

const getOrdersByBranch = async (req, res) => {
  try {
    const branchId = req.params.branchId;
    const orders = await EcommerceOrderService.getOrdersByBranch(branchId);
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getProductDemandSummary = async (req, res) => {
  try {
    const demand = await EcommerceOrderService.getProductDemandSummary();
    res.status(200).json(demand);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getProductDemandDetail = async (req, res) => {
  try {
    const demand = await EcommerceOrderService.getProductDemandDetail(req.params.productId);
    res.status(200).json(demand);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { status } = req.body;

    const order = await EcommerceOrderService.updateOrderStatus(orderId, status, req.staff);

    res.status(200).json({
      message: 'Order status updated',
      order
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateOrderItemFulfillment = async (req, res) => {
  try {
    const { id: orderId, itemId } = req.params;
    const { status } = req.body;

    const order = await EcommerceOrderService.updateOrderItemFulfillment(
      orderId,
      itemId,
      status,
      req.staff
    );

    res.status(200).json({
      message: 'Order item fulfillment updated',
      order
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const recordInstallmentPayment = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { amount, transactionRef } = req.body;
    const staffId = req.staff.staffId;

    const order = await EcommerceOrderService.recordInstallmentPayment(
      orderId,
      amount,
      transactionRef,
      staffId
    );

    res.status(200).json({
      message: 'Installment payment recorded',
      order
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const recordOutrightPayment = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { transactionRef } = req.body;

    const order = await EcommerceOrderService.recordOutrightPayment(orderId, transactionRef);

    res.status(200).json({
      message: 'Payment recorded',
      order
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { reason } = req.body;

    const order = await EcommerceOrderService.cancelOrder(orderId, reason);

    res.status(200).json({
      message: 'Order cancelled',
      order
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getOverdueInstallments = async (req, res) => {
  try {
    const orders = await EcommerceOrderService.getOverdueInstallments();
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get SB Account details for an order
const getOrderSBAccount = async (req, res) => {
  try {
    const orderId = req.params.id;
    const sbAccount = await EcommerceOrderService.getOrderSBAccount(orderId);
    res.status(200).json(sbAccount);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getOrderWalletAccount = async (req, res) => {
  try {
    const orderId = req.params.id;
    const walletAccount = await EcommerceOrderService.getOrderWalletAccount(orderId);
    res.status(200).json(walletAccount);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Credit SB Account for installment order
const creditSBAccount = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { amount } = req.body;
    const staffId = req.staff.staffId;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Valid amount is required' });
    }

    const result = await EcommerceOrderService.creditSBAccountForOrder(orderId, amount, staffId);

    // Check and process any pending due payments after crediting
    if (result.sbAccount && result.sbAccount.SBAccountNumber) {
      await EcommerceOrderService.checkAndProcessPendingPayments(result.sbAccount.SBAccountNumber);
    }

    // Get updated order
    const updatedOrder = await EcommerceOrderService.getOrderById(orderId);

    res.status(200).json({
      message: 'Wallet credited successfully',
      walletAccount: result.walletAccount,
      order: updatedOrder
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Process automatic payments for all due installments
const processAutomaticPayments = async (req, res) => {
  try {
    const results = await EcommerceOrderService.processAutomaticPayments();
    res.status(200).json({
      message: 'Automatic payment processing completed',
      results
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Initialize Paystack payment
const initializePayment = async (req, res) => {
  try {
    const customerId = req.customer.customerId;
    const {
      paymentType,
      installmentFrequency,
      installmentDuration,
      shippingAddress,
      shippingCity,
      shippingState,
      customerPhone,
      customerEmail,
      notes,
      accountNumber,
      callbackUrl,
      productId,
      variationId,
      quantity = 1,
      firstPaymentAmount,
      amountToPay,
      initialPaymentAmount,
      amountToCharge: requestedAmountToCharge,
      amount,
      paymentSource = 'bank'
    } = req.body;

    const paymentEmail = await resolvePaymentEmail({ customerId, customerEmail });

    console.log('Initializing payment for:', { customerId, customerEmail: paymentEmail, paymentType, productId, variationId });

    let totalAmount;
    let productName;
    let cartItems = [];

    // If productId is provided, get product directly (no stock check for payment)
    if (productId) {
      const productInfo = await CartService.getProductForPayment(productId, quantity, variationId || '');
      totalAmount = productInfo.subtotal;
      productName = productInfo.variationName
        ? `${productInfo.productName} - ${productInfo.variationName}`
        : productInfo.productName;
      cartItems = [productInfo];

      // Also add to cart for order creation later (skip stock check)
      await CartService.addToCart({ customerId }, productId, quantity, true, variationId || '');
    } else {
      // Use existing cart
      const cart = await Cart.findOne({ customerId });
      if (!cart || cart.items.length === 0) {
        return res.status(400).json({ message: 'Cart is empty' });
      }
      totalAmount = cart.totalAmount;
      productName = cart.items.map(item => item.productName).join(', ');
      cartItems = cart.items;
    }

    // Calculate amount based on payment type - this is the amount to charge NOW
    let amountToCharge;
    if (paymentType === 'installment') {
      amountToCharge = Number(
        firstPaymentAmount
        || amountToPay
        || initialPaymentAmount
        || requestedAmountToCharge
        || amount
      );
      if (!Number.isFinite(amountToCharge) || amountToCharge <= 0) {
        return res.status(400).json({ message: 'Enter a valid first payment amount' });
      }
      if (amountToCharge > totalAmount) {
        return res.status(400).json({ message: `First payment cannot exceed total amount of ₦${totalAmount.toLocaleString()}` });
      }
    } else {
      // Outright payment - full amount
      amountToCharge = totalAmount;
    }

    console.log('Payment amount calculation:', { totalAmount, amountToCharge });

    // Always use the phone from the authenticated customer (from JWT token)
    // This ensures we have the correct accountNumber even if frontend state is stale
    const customerAccountNumber = req.customer.phone;

    if (paymentSource === 'wallet') {
      const order = await EcommerceOrderService.createOrderAndPayFromWallet({
        customerId,
        accountNumber: customerAccountNumber,
        paymentType,
        installmentFrequency: paymentType === 'installment' ? 'flexible' : installmentFrequency,
        installmentDuration: paymentType === 'installment' ? 0 : installmentDuration,
        shippingAddress,
        shippingCity,
        shippingState,
        customerPhone,
        customerEmail: paymentEmail,
        notes,
        paymentAmount: amountToCharge
      });

      return res.status(200).json({
        message: 'Wallet payment completed',
        data: {
          paymentSource: 'wallet',
          order,
          amount: amountToCharge,
          reference: order.paymentReference
        }
      });
    }

    // Initialize Paystack payment with the correct amount
    const paymentResult = await PaystackService.initializeOrderPayment(
      {
        paymentType,
        installmentFrequency: paymentType === 'installment' ? 'flexible' : installmentFrequency,
        installmentDuration: paymentType === 'installment' ? 0 : installmentDuration,
        totalAmount,
        amountToCharge, // Pass the calculated amount to charge
        firstPaymentAmount: amountToCharge,
        amountToPay: amountToCharge,
        initialPaymentAmount: amountToCharge,
        productName,
        customerId,
        accountNumber: customerAccountNumber,
        shippingAddress,
        shippingCity,
        shippingState,
        customerPhone,
        customerEmail: paymentEmail,
        notes,
        cartItems
      },
      paymentEmail,
      callbackUrl,
      amountToCharge // Pass amount directly
    );

    console.log('Paystack payment result:', JSON.stringify(paymentResult, null, 2));

    // Validate Paystack response
    if (!paymentResult || !paymentResult.data || !paymentResult.data.authorization_url) {
      console.error('Invalid Paystack response:', paymentResult);
      return res.status(500).json({ message: 'Failed to get payment URL from Paystack' });
    }

    res.status(200).json({
      message: 'Payment initialized',
      data: {
        authorization_url: paymentResult.data.authorization_url,
        access_code: paymentResult.data.access_code,
        reference: paymentResult.reference,
        amount: amountToCharge,
        amountInKobo: amountToCharge * 100
      }
    });
  } catch (error) {
    console.error('Initialize payment error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Verify Paystack payment and create order
const verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;

    console.log('Verifying payment for reference:', reference);

    // Verify payment with Paystack
    const verificationResult = await PaystackService.verifyTransaction(reference);

    console.log('Paystack verification result:', verificationResult.data.status);

    if (verificationResult.data.status !== 'success') {
      return res.status(400).json({
        message: 'Payment not successful',
        status: verificationResult.data.status
      });
    }

    const metadata = verificationResult.data.metadata || {};
    const walletPaymentAmount = Number(verificationResult.data.amount || 0) / 100;

    if (metadata.order_deposit_data) {
      const depositData = metadata.order_deposit_data;
      const order = await EcommerceOrderService.getOrderByNumber(depositData.orderNumber);

      if (order.customerId?.toString() !== req.customer.customerId.toString()) {
        return res.status(403).json({ message: 'You are not allowed to verify this payment' });
      }

      const result = await EcommerceOrderService.recordCustomerOrderDepositPayment(
        order.orderNumber,
        req.customer.customerId,
        walletPaymentAmount,
        reference,
        'PAYSTACK_PAYMENT'
      );

      return res.status(200).json({
        message: 'Order deposit verified',
        order: result.order,
        paymentDetails: {
          amount: walletPaymentAmount,
          reference,
          paidAt: verificationResult.data.paid_at
        }
      });
    }

    const orderData = metadata.order_data;
    if (!orderData) {
      return res.status(400).json({ message: 'Payment metadata is missing order data' });
    }

    console.log('Order data from Paystack:', {
      customerId: orderData.customerId,
      accountNumber: orderData.accountNumber,
      paymentType: orderData.paymentType
    });

    // Check if order already exists for this reference
    const existingOrder = await EcommerceOrderService.getOrderByReference(reference);
    if (existingOrder) {
      console.log('Order already exists:', existingOrder.orderNumber);
      const alreadyPaid = existingOrder.installmentPlan?.payments?.some(
        (payment) => payment.transactionRef === reference
      );
      if (!alreadyPaid && existingOrder.SBAccountNumber) {
        await EcommerceOrderService.creditSBAccountForOrderDirect(
          existingOrder._id,
          walletPaymentAmount,
          reference,
          'PAYSTACK_PAYMENT'
        );
      }
      const refreshedOrder = await EcommerceOrderService.getOrderById(existingOrder._id);
      return res.status(200).json({
        message: 'Order already exists',
        order: refreshedOrder
      });
    }

    // Create the order
    const order = await EcommerceOrderService.createOrder({
      customerId: orderData.customerId,
      accountNumber: orderData.accountNumber,
      paymentType: orderData.paymentType,
      installmentFrequency: orderData.paymentType === 'installment'
        ? (orderData.installmentFrequency || 'flexible')
        : orderData.installmentFrequency,
      installmentDuration: orderData.paymentType === 'installment'
        ? Number(orderData.installmentDuration || 0)
        : orderData.installmentDuration,
      shippingAddress: orderData.shippingAddress,
      shippingCity: orderData.shippingCity,
      shippingState: orderData.shippingState,
      customerPhone: orderData.customerPhone,
      customerEmail: orderData.customerEmail,
      notes: orderData.notes,
      paymentReference: reference
    });

    console.log('Order created:', order.orderNumber, 'Type:', orderData.paymentType);

    console.log('Processing ecommerce account payment:', walletPaymentAmount, 'SBAccountNumber:', order.SBAccountNumber);

    if (order.SBAccountNumber) {
      try {
        await EcommerceOrderService.creditSBAccountForOrderDirect(
          order._id,
          walletPaymentAmount,
          reference,
          'PAYSTACK_PAYMENT'
        );
        console.log('Ecommerce account payment credited successfully');
      } catch (creditError) {
        console.error('Error crediting ecommerce account payment:', creditError);
        // Still continue - order was created
      }
    } else {
      console.warn('No SBAccountNumber for ecommerce order - payment status may not update');
    }

    // Get updated order - fetch fresh from database
    const updatedOrder = await EcommerceOrderService.getOrderById(order._id);
    console.log('Final order status:', updatedOrder.paymentStatus, updatedOrder.status);

    res.status(200).json({
      message: 'Payment verified and order created',
      order: updatedOrder,
      paymentDetails: {
        amount: verificationResult.data.amount / 100,
        reference: reference,
        paidAt: verificationResult.data.paid_at
      }
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Paystack webhook handler
const handlePaystackWebhook = async (req, res) => {
  try {
    const crypto = require('crypto');
    const secret = process.env.PAYSTACK_SECRET_KEY;

    // Verify webhook signature
    const hash = crypto.createHmac('sha512', secret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(401).json({ message: 'Invalid signature' });
    }

    const event = req.body;

    if (event.event === 'charge.success') {
      const reference = event.data.reference;
      const metadata = event.data.metadata;
      const walletPaymentAmount = Number(event.data.amount || 0) / 100;

      if (metadata && metadata.order_deposit_data) {
        const depositData = metadata.order_deposit_data;
        await EcommerceOrderService.recordCustomerOrderDepositPayment(
          depositData.orderNumber,
          depositData.customerId,
          walletPaymentAmount,
          reference,
          'PAYSTACK_WEBHOOK'
        );
      } else if (metadata && metadata.order_data) {
        const orderData = metadata.order_data;

        // Check if order already exists
        const existingOrder = await EcommerceOrderService.getOrderByReference(reference);
        if (existingOrder) {
          const alreadyPaid = existingOrder.installmentPlan?.payments?.some(
            (payment) => payment.transactionRef === reference
          );
          if (!alreadyPaid && existingOrder.SBAccountNumber) {
            await EcommerceOrderService.creditSBAccountForOrderDirect(
              existingOrder._id,
              walletPaymentAmount,
              reference,
              'PAYSTACK_WEBHOOK'
            );
          }
        } else {
          // Create order
          const order = await EcommerceOrderService.createOrder({
            customerId: orderData.customerId,
            accountNumber: orderData.accountNumber,
            paymentType: orderData.paymentType,
            installmentFrequency: orderData.paymentType === 'installment'
              ? (orderData.installmentFrequency || 'flexible')
              : orderData.installmentFrequency,
            installmentDuration: orderData.paymentType === 'installment'
              ? Number(orderData.installmentDuration || 0)
              : orderData.installmentDuration,
            shippingAddress: orderData.shippingAddress,
            shippingCity: orderData.shippingCity,
            shippingState: orderData.shippingState,
            customerPhone: orderData.customerPhone,
            customerEmail: orderData.customerEmail,
            notes: orderData.notes,
            paymentReference: reference
          });

          if (order.SBAccountNumber) {
            await EcommerceOrderService.creditSBAccountForOrderDirect(
              order._id,
              walletPaymentAmount,
              reference,
              'PAYSTACK_WEBHOOK'
            );
          }
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createOrder,
  getOrderById,
  getOrderByNumber,
  getMyOrders,
  getProductActionRequests,
  getActiveOrder,
  addItemsToActiveOrder,
  replaceInstallmentOrderItem,
  payOrderItemFromWallet,
  payoffRemainingBalance,
  initializeOrderDepositPayment,
  getAllOrders,
  getOrdersByBranch,
  getProductDemandSummary,
  getProductDemandDetail,
  updateOrderStatus,
  updateOrderItemFulfillment,
  recordInstallmentPayment,
  recordOutrightPayment,
  cancelOrder,
  getOverdueInstallments,
  getOrderSBAccount,
  getOrderWalletAccount,
  creditSBAccount,
  processAutomaticPayments,
  initializePayment,
  verifyPayment,
  handlePaystackWebhook
};
