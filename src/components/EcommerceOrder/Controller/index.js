const EcommerceOrderService = require('../Service/index');
const PaystackService = require('../../Paystack/Service/index');
const Cart = require('../../Cart/Model/index');
const Product = require('../../Product/Model/index');
const CartService = require('../../Cart/Service/index');

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

    const order = await EcommerceOrderService.createOrder({
      customerId,
      accountNumber: accountNumber || req.customer.phone,
      paymentType,
      installmentFrequency,
      installmentDuration,
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
    const order = await EcommerceOrderService.getOrderById(orderId);
    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getOrderByNumber = async (req, res) => {
  try {
    const orderNumber = req.params.orderNumber;
    const order = await EcommerceOrderService.getOrderByNumber(orderNumber);
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

const getAllOrders = async (req, res) => {
  try {
    const { status, paymentStatus, branchId } = req.query;
    const orders = await EcommerceOrderService.getAllOrders({
      status,
      paymentStatus,
      branchId
    });
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
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

const updateOrderStatus = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { status } = req.body;
    const processedBy = req.staff.staffId;

    const order = await EcommerceOrderService.updateOrderStatus(orderId, status, processedBy);

    res.status(200).json({
      message: 'Order status updated',
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
      quantity = 1
    } = req.body;

    // Validate email
    if (!customerEmail || !customerEmail.includes('@')) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
    }

    // Validate installment duration for installment payments
    const duration = parseInt(installmentDuration) || 1;
    if (paymentType === 'installment' && duration < 1) {
      return res.status(400).json({ message: 'Invalid installment duration' });
    }

    console.log('Initializing payment for:', { customerId, customerEmail, paymentType, productId, installmentDuration: duration });

    let totalAmount;
    let productName;
    let cartItems = [];

    // If productId is provided, get product directly (no stock check for payment)
    if (productId) {
      const productInfo = await CartService.getProductForPayment(productId, quantity);
      totalAmount = productInfo.subtotal;
      productName = productInfo.productName;
      cartItems = [productInfo];

      // Also add to cart for order creation later (skip stock check)
      await CartService.addToCart({ customerId }, productId, quantity, true);
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
      // First installment payment (amount due now)
      amountToCharge = Math.ceil(totalAmount / duration);
    } else {
      // Outright payment - full amount
      amountToCharge = totalAmount;
    }

    console.log('Payment amount calculation:', { totalAmount, duration, amountToCharge });

    // Always use the phone from the authenticated customer (from JWT token)
    // This ensures we have the correct accountNumber even if frontend state is stale
    const customerAccountNumber = req.customer.phone;

    // Initialize Paystack payment with the correct amount
    const paymentResult = await PaystackService.initializeOrderPayment(
      {
        paymentType,
        installmentFrequency,
        installmentDuration: duration,
        totalAmount,
        amountToCharge, // Pass the calculated amount to charge
        productName,
        customerId,
        accountNumber: customerAccountNumber,
        shippingAddress,
        shippingCity,
        shippingState,
        customerPhone,
        customerEmail,
        notes,
        cartItems
      },
      customerEmail,
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

    // Extract order data from metadata
    const metadata = verificationResult.data.metadata;
    const orderData = metadata.order_data;

    console.log('Order data from Paystack:', {
      customerId: orderData.customerId,
      accountNumber: orderData.accountNumber,
      paymentType: orderData.paymentType
    });

    // Check if order already exists for this reference
    const existingOrder = await EcommerceOrderService.getOrderByReference(reference);
    if (existingOrder) {
      console.log('Order already exists:', existingOrder.orderNumber);
      return res.status(200).json({
        message: 'Order already exists',
        order: existingOrder
      });
    }

    // Create the order
    const order = await EcommerceOrderService.createOrder({
      customerId: orderData.customerId,
      accountNumber: orderData.accountNumber,
      paymentType: orderData.paymentType,
      installmentFrequency: orderData.installmentFrequency,
      installmentDuration: orderData.installmentDuration,
      shippingAddress: orderData.shippingAddress,
      shippingCity: orderData.shippingCity,
      shippingState: orderData.shippingState,
      customerPhone: orderData.customerPhone,
      customerEmail: orderData.customerEmail,
      notes: orderData.notes,
      paymentReference: reference
    });

    console.log('Order created:', order.orderNumber, 'Type:', orderData.paymentType);

    const walletPaymentAmount = Number(verificationResult.data.amount || 0) / 100;
    await EcommerceOrderService.recordWalletMovementForOrderPayment(
      order._id,
      walletPaymentAmount,
      reference
    );

    // If outright payment, mark as paid
    if (orderData.paymentType === 'outright') {
      console.log('Processing outright payment for order:', order._id);
      try {
        await EcommerceOrderService.recordOutrightPayment(order._id, reference);
        console.log('Outright payment recorded successfully');
      } catch (paymentError) {
        console.error('Error recording outright payment:', paymentError);
        // Still continue - order was created
      }
    } else {
      // For installment, record the first payment
      const firstPaymentAmount = Math.ceil(order.totalAmount / orderData.installmentDuration);
      console.log('Processing installment first payment:', firstPaymentAmount, 'SBAccountNumber:', order.SBAccountNumber);

      // Credit the SB Account with the first payment
      if (order.SBAccountNumber) {
        try {
          await EcommerceOrderService.creditSBAccountForOrderDirect(
            order._id,
            firstPaymentAmount,
            reference,
            'PAYSTACK_PAYMENT'
          );
          console.log('Installment payment credited successfully');
        } catch (creditError) {
          console.error('Error crediting SB account:', creditError);
          // Still continue - order was created
        }
      } else {
        console.warn('No SBAccountNumber for installment order - payment status may not update');
      }
    }

    // Get updated order - fetch fresh from database
    const updatedOrder = await EcommerceOrderService.getOrderById(order._id);
    console.log('Final order status:', updatedOrder.paymentStatus, updatedOrder.status);

    // Double-check: if outright payment and still showing unpaid, force update
    if (orderData.paymentType === 'outright' && updatedOrder.paymentStatus !== 'paid') {
      console.warn('Payment status still not updated, forcing update...');
      updatedOrder.paymentStatus = 'paid';
      updatedOrder.status = 'paid';
      await updatedOrder.save();
      // Update SBAccount status to sold
      await EcommerceOrderService.updateSBAccountToSold(updatedOrder.SBAccountNumber);
      console.log('Forced update complete - status:', updatedOrder.paymentStatus);
    }

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

      if (metadata && metadata.order_data) {
        const orderData = metadata.order_data;

        // Check if order already exists
        const existingOrder = await EcommerceOrderService.getOrderByReference(reference);
        if (!existingOrder) {
          // Create order
          const order = await EcommerceOrderService.createOrder({
            customerId: orderData.customerId,
            accountNumber: orderData.accountNumber,
            paymentType: orderData.paymentType,
            installmentFrequency: orderData.installmentFrequency,
            installmentDuration: orderData.installmentDuration,
            shippingAddress: orderData.shippingAddress,
            shippingCity: orderData.shippingCity,
            shippingState: orderData.shippingState,
            customerPhone: orderData.customerPhone,
            customerEmail: orderData.customerEmail,
            notes: orderData.notes,
            paymentReference: reference
          });

          const walletPaymentAmount = Number(event.data.amount || 0) / 100;
          await EcommerceOrderService.recordWalletMovementForOrderPayment(
            order._id,
            walletPaymentAmount,
            reference
          );

          // Handle payment based on type
          if (orderData.paymentType === 'outright') {
            await EcommerceOrderService.recordOutrightPayment(order._id, reference);

            // Verify the update
            const verifyOrder = await EcommerceOrderService.getOrderById(order._id);
            if (verifyOrder.paymentStatus !== 'paid') {
              console.warn('Webhook: Payment status not updated, forcing...');
              verifyOrder.paymentStatus = 'paid';
              verifyOrder.status = 'paid';
              await verifyOrder.save();
              // Update SBAccount status to sold
              await EcommerceOrderService.updateSBAccountToSold(verifyOrder.SBAccountNumber);
            }
          } else {
            const firstPaymentAmount = Math.ceil(order.totalAmount / orderData.installmentDuration);
            if (order.SBAccountNumber) {
              await EcommerceOrderService.creditSBAccountForOrderDirect(
                order._id,
                firstPaymentAmount,
                reference,
                'PAYSTACK_WEBHOOK'
              );
            }
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
  payoffRemainingBalance,
  getAllOrders,
  getOrdersByBranch,
  updateOrderStatus,
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
