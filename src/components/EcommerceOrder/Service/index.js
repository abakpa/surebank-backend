const EcommerceOrder = require('../Model/index');
const Cart = require('../../Cart/Model/index');
const Product = require('../../Product/Model/index');
const ProductService = require('../../Product/Service/index');
const SBAccount = require('../../SBAccount/Model/index');
const Account = require('../../Account/Model/index');
const AccountTransaction = require('../../AccountTransaction/Service/index');
const Staff = require('../../Staff/Model/index');
const Customer = require('../../Customer/Model/index');
const generateUniqueAccountNumber = require('../../generateAccountNumber');

const formatTransactionDate = (date = new Date()) => {
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const generateOrderNumber = async () => {
  const prefix = 'ORD';
  let orderNumber;
  do {
    orderNumber = prefix + Date.now() + Math.floor(Math.random() * 1000);
  } while (await EcommerceOrder.findOne({ orderNumber }));
  return orderNumber;
};

// Helper function to update SBAccount status to 'sold' when order is fully paid
const updateSBAccountToSold = async (SBAccountNumber) => {
  if (!SBAccountNumber) return;
  try {
    await SBAccount.findOneAndUpdate(
      { SBAccountNumber },
      { status: 'sold' }
    );
    console.log(`SBAccount ${SBAccountNumber} status updated to sold`);
  } catch (error) {
    console.error('Error updating SBAccount status:', error);
  }
};

const calculateInstallmentPlan = (totalAmount, frequency, duration) => {
  const amountPerPeriod = Math.ceil(totalAmount / duration);
  const payments = [];
  let currentDate = new Date();

  for (let i = 0; i < duration; i++) {
    let paymentDate = new Date(currentDate);
    if (frequency === 'daily') {
      paymentDate.setDate(paymentDate.getDate() + (i + 1));
    } else if (frequency === 'weekly') {
      paymentDate.setDate(paymentDate.getDate() + (7 * (i + 1)));
    } else {
      paymentDate.setMonth(paymentDate.getMonth() + (i + 1));
    }

    payments.push({
      date: paymentDate,
      amount: i === duration - 1 ? totalAmount - (amountPerPeriod * (duration - 1)) : amountPerPeriod,
      status: 'pending'
    });
  }

  return {
    frequency,
    duration,
    amountPerPeriod,
    totalPaid: 0,
    remainingBalance: totalAmount,
    nextPaymentDate: payments[0].date,
    payments
  };
};

const calculateFlexibleInstallmentPlan = (totalAmount) => ({
  frequency: 'flexible',
  duration: 0,
  amountPerPeriod: 0,
  totalPaid: 0,
  remainingBalance: totalAmount,
  nextPaymentDate: null,
  payments: []
});

const normalizePaymentAmount = (amount) => {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error('Valid payment amount is required');
  }
  return numericAmount;
};

const getCustomerWalletAccount = async (order) => {
  let account = await Account.findOne({ accountNumber: order.accountNumber });

  if (!account) {
    account = await Account.findOne({ customerId: order.customerId });
  }

  if (!account) {
    throw new Error('Customer wallet account not found');
  }

  return account;
};

const getStaffDisplayName = async (staffId) => {
  if (!staffId) return 'Staff';
  const staff = await Staff.findById(staffId).select('firstName lastName').lean();
  if (!staff) return 'Staff';
  return `${staff.firstName} ${staff.lastName}`.trim();
};

const getReportingStaffId = (accountManagerId, fallbackActor) => {
  if (accountManagerId && accountManagerId !== 'ECOMMERCE_SYSTEM') {
    return accountManagerId;
  }

  return fallbackActor;
};

const resolveOrderOwnership = async ({ customerId, accountNumber, branchId }) => {
  const [account, customer] = await Promise.all([
    Account.findOne({
      $or: [
        { customerId: customerId?.toString() },
        { accountNumber }
      ]
    }).lean(),
    Customer.findById(customerId).lean()
  ]);

  const resolvedAccountManagerId = account?.accountManagerId
    || customer?.accountManagerId
    || (customer?.createdBy && customer.createdBy !== 'ECOMMERCE_SYSTEM' ? customer.createdBy : '')
    || 'ECOMMERCE_SYSTEM';

  const resolvedBranchId = branchId
    || account?.branchId
    || customer?.branchId
    || 'ECOMMERCE';

  return {
    account,
    customer,
    accountManagerId: resolvedAccountManagerId,
    branchId: resolvedBranchId,
  };
};

const createOrder = async (orderData) => {
  const {
    customerId: rawCustomerId,
    accountNumber,
    cartId,
    paymentType,
    installmentFrequency: rawInstallmentFrequency,
    installmentDuration: rawInstallmentDuration,
    shippingAddress,
    shippingCity,
    shippingState,
    customerPhone,
    customerEmail,
    notes,
    branchId,
    paymentReference
  } = orderData;
  const installmentFrequency = paymentType === 'installment'
    ? (rawInstallmentFrequency || 'flexible')
    : rawInstallmentFrequency;
  const installmentDuration = paymentType === 'installment'
    ? Number(rawInstallmentDuration || 0)
    : rawInstallmentDuration;

  if (paymentReference) {
    const existingOrder = await EcommerceOrder.findOne({ paymentReference });
    if (existingOrder) {
      return existingOrder;
    }
  }

  // Ensure customerId is a string for consistent lookups
  const customerId = rawCustomerId ? rawCustomerId.toString() : rawCustomerId;
  const ownership = await resolveOrderOwnership({ customerId, accountNumber, branchId });
  console.log('createOrder - customerId:', customerId, 'type:', typeof customerId);

  // Get cart - try both string and original format
  console.log('Looking for cart with customerId:', customerId);
  let cart = await Cart.findOne({ customerId });

  // If not found, try with raw customerId in case of type mismatch
  if (!cart && rawCustomerId !== customerId) {
    console.log('Cart not found, trying with rawCustomerId:', rawCustomerId);
    cart = await Cart.findOne({ customerId: rawCustomerId });
  }

  console.log('Cart found:', cart ? 'Yes' : 'No');
  if (!cart || cart.items.length === 0) {
    throw new Error('Cart is empty');
  }

  // Note: Stock check removed - orders can be placed regardless of stock
  // Stock will be managed separately by admin

  const orderNumber = await generateOrderNumber();

  let order = {
    orderNumber,
    customerId,
    accountNumber,
    items: cart.items,
    totalAmount: cart.totalAmount,
    paymentType,
    shippingAddress,
    shippingCity,
    shippingState,
    customerPhone,
    customerEmail,
    notes,
    branchId: ownership.branchId,
    accountManagerId: ownership.accountManagerId,
    paymentReference,
    status: 'pending',
    paymentStatus: 'unpaid'
  };

  // Handle installment payment
  if (paymentType === 'installment') {
    if (installmentFrequency && installmentFrequency !== 'flexible' && installmentDuration) {
      if (installmentFrequency === 'daily' && (installmentDuration < 7 || installmentDuration > 90)) {
        throw new Error('Daily installment duration must be between 7 and 90 days');
      }
      if (installmentFrequency === 'weekly' && (installmentDuration < 2 || installmentDuration > 52)) {
        throw new Error('Weekly installment duration must be between 2 and 52 weeks');
      }
      if (installmentFrequency === 'monthly' && (installmentDuration < 2 || installmentDuration > 12)) {
        throw new Error('Monthly installment duration must be between 2 and 12 months');
      }

      order.installmentPlan = calculateInstallmentPlan(
        cart.totalAmount,
        installmentFrequency,
        installmentDuration
      );
    } else {
      order.installmentPlan = calculateFlexibleInstallmentPlan(cart.totalAmount);
    }

    // Create SB Account for installment tracking
    const currentDate = new Date();
    const startDate = currentDate.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    console.log('Looking for account with accountNumber:', accountNumber);
    let account = ownership.account || await Account.findOne({ accountNumber });

    // Fallback: try to find by customerId if accountNumber lookup fails
    if (!account) {
      console.log('Account not found by accountNumber, trying customerId:', customerId);
      account = await Account.findOne({ customerId });
    }

    console.log('Account found:', account ? 'Yes' : 'No', account ? account._id : 'N/A');

    if (account) {
      const productNames = cart.items.map(item => item.productName || item.name).join(', ');

      if (paymentReference) {
        let existingSBAccount = await SBAccount.findOne({ paymentReference });

        if (!existingSBAccount) {
          const SBAccountNumber = await generateUniqueAccountNumber('SBA');
          existingSBAccount = await SBAccount.findOneAndUpdate(
            { paymentReference },
            {
              $setOnInsert: {
                customerId,
                accountNumber: account.accountNumber,
                SBAccountNumber,
                createdBy: 'ECOMMERCE_SYSTEM',
                productName: productNames ? `${productNames} (${orderNumber})` : `E-Commerce Order: ${orderNumber}`,
                productDescription: `Installment payment for order ${orderNumber}`,
                accountManagerId: ownership.accountManagerId,
                paymentReference,
                branchId: ownership.branchId,
                status: 'booked',
                startDate,
                sellingPrice: cart.totalAmount,
                costPrice: 0,
                balance: 0,
                profit: 0
              }
            },
            {
              new: true,
              upsert: true,
            }
          );
        }

        order.SBAccountNumber = existingSBAccount.SBAccountNumber;
      } else {
        const SBAccountNumber = await generateUniqueAccountNumber('SBA');
        const sbAccount = new SBAccount({
          customerId,
          accountNumber: account.accountNumber, // Use account's accountNumber
          SBAccountNumber,
          createdBy: 'ECOMMERCE_SYSTEM',
          productName: productNames ? `${productNames} (${orderNumber})` : `E-Commerce Order: ${orderNumber}`,
          productDescription: `Installment payment for order ${orderNumber}`,
          accountManagerId: ownership.accountManagerId,
          branchId: ownership.branchId,
          status: 'booked',
          startDate,
          sellingPrice: cart.totalAmount,
          costPrice: 0,
          balance: 0,
          profit: 0
        });

        await sbAccount.save();
        order.SBAccountNumber = SBAccountNumber;
      }
    } else {
      console.warn('No account found for customer - SB Account not created for installment order');
    }
  }

  let savedOrder;
  if (paymentReference) {
    savedOrder = await EcommerceOrder.findOneAndUpdate(
      { paymentReference },
      { $setOnInsert: order },
      { new: true, upsert: true }
    );
  } else {
    const newOrder = new EcommerceOrder(order);
    savedOrder = await newOrder.save();
  }

  // Note: Stock is NOT reduced at order creation
  // Stock will be reduced when order status is changed to 'delivered' or 'completed'

  // Clear the cart
  await Cart.findOneAndUpdate(
    { customerId },
    { $set: { items: [], totalAmount: 0, totalItems: 0 } }
  );

  return savedOrder;
};

const getOrderById = async (orderId) => {
  const order = await EcommerceOrder.findById(orderId)
    .populate('customerId', 'firstName lastName phone address');
  if (!order) {
    throw new Error('Order not found');
  }
  return order;
};

const getOrderByNumber = async (orderNumber) => {
  console.log('getOrderByNumber called with:', orderNumber);
  const order = await EcommerceOrder.findOne({ orderNumber });
  if (!order) {
    throw new Error('Order not found');
  }
  console.log('Found order - status:', order.status, 'paymentStatus:', order.paymentStatus);
  return order;
};

const getCustomerOrders = async (customerId) => {
  console.log('getCustomerOrders called with customerId:', customerId, 'type:', typeof customerId);
  const orders = await EcommerceOrder.find({ customerId }).sort({ createdAt: -1 });
  console.log('Found', orders.length, 'orders for customer');
  if (orders.length > 0) {
    console.log('First order status:', orders[0].status, 'paymentStatus:', orders[0].paymentStatus);
  }
  return orders;
};

const getAllOrders = async (filters = {}) => {
  const query = {};

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.paymentStatus) {
    query.paymentStatus = filters.paymentStatus;
  }

  if (filters.branchId) {
    query.branchId = filters.branchId;
  }

  return await EcommerceOrder.find(query).sort({ createdAt: -1 });
};

const updateOrderStatus = async (orderId, status, processedBy) => {
  const order = await EcommerceOrder.findById(orderId);
  if (!order) {
    throw new Error('Order not found');
  }

  const previousStatus = order.status;

  // If changing to 'delivered' or 'completed', reduce stock
  if ((status === 'delivered' || status === 'completed') &&
      previousStatus !== 'delivered' && previousStatus !== 'completed') {
    for (const item of order.items) {
      try {
        await ProductService.updateProductStock(item.productId, item.quantity, 'decrease');
      } catch (err) {
        console.error(`Failed to reduce stock for product ${item.productId}:`, err.message);
        // Continue with order status update even if stock update fails
      }
    }
  }

  order.status = status;
  order.processedBy = processedBy;
  await order.save();

  return order;
};

// Get SB Account details for an order
const getOrderSBAccount = async (orderId) => {
  const order = await EcommerceOrder.findById(orderId);
  if (!order) {
    throw new Error('Order not found');
  }

  if (order.paymentType !== 'installment' || !order.SBAccountNumber) {
    throw new Error('This order does not have an associated SB Account');
  }

  const sbAccount = await SBAccount.findOne({ SBAccountNumber: order.SBAccountNumber });
  if (!sbAccount) {
    throw new Error('SB Account not found');
  }

  return sbAccount;
};

const getOrderWalletAccount = async (orderId) => {
  const order = await EcommerceOrder.findById(orderId);
  if (!order) {
    throw new Error('Order not found');
  }

  return await getCustomerWalletAccount(order);
};

// Credit SB Account for installment order (staff deposits money for customer)
const creditSBAccountForOrder = async (orderId, amount, staffId) => {
  const order = await EcommerceOrder.findById(orderId);
  if (!order) {
    throw new Error('Order not found');
  }

  if (order.paymentType !== 'installment') {
    throw new Error('This order is not an installment order');
  }

  const paymentAmount = normalizePaymentAmount(amount);
  const remainingBalance = Number(order.installmentPlan?.remainingBalance || 0);
  if (remainingBalance <= 0) {
    throw new Error('This order has already been fully paid');
  }
  if (paymentAmount > remainingBalance) {
    throw new Error(`Payment amount cannot exceed remaining balance of ₦${remainingBalance.toLocaleString()}`);
  }
  if (!order.SBAccountNumber || !(await SBAccount.findOne({ SBAccountNumber: order.SBAccountNumber }))) {
    throw new Error('SB Account not found');
  }

  const walletAccount = await getCustomerWalletAccount(order);
  const formattedDate = formatTransactionDate();
  const staffName = await getStaffDisplayName(staffId);
  const newAvailableBalance = Number(walletAccount.availableBalance || 0) + paymentAmount;
  const newLedgerBalance = Number(walletAccount.ledgerBalance || 0) + paymentAmount;
  const transactionRef = `STAFF_ORDER_DEPOSIT_${Date.now()}`;

  await AccountTransaction.DepositTransactionAccount({
    createdBy: staffId,
    transactionOwnerId: staffId,
    customerId: walletAccount.customerId,
    amount: paymentAmount,
    balance: newAvailableBalance,
    branchId: walletAccount.branchId,
    accountManagerId: walletAccount.accountManagerId || 'ECOMMERCE_SYSTEM',
    accountNumber: walletAccount.accountNumber,
    accountTypeId: walletAccount._id,
    date: formattedDate,
    narration: `Deposited by ${staffName} for Order ${order.orderNumber}`,
    package: "Wallet",
    direction: "Credit",
  });

  const updatedWalletAccount = await Account.findByIdAndUpdate(
    walletAccount._id,
    {
      $set: {
        availableBalance: newAvailableBalance,
        ledgerBalance: newLedgerBalance,
      }
    },
    { new: true }
  );

  const paymentResult = await recordFlexibleInstallmentOrderPayment(
    order._id,
    paymentAmount,
    transactionRef,
    staffId,
    { creditWallet: false }
  );
  const refreshedWalletAccount = await getCustomerWalletAccount(order);

  return { walletAccount: refreshedWalletAccount || updatedWalletAccount, order: paymentResult.order, sbAccount: paymentResult.sbAccount };
};

// Debit SB Account for installment payment
const debitSBAccountForPayment = async (sbAccount, amount, order, staffId, options = {}) => {
  const currentDate = new Date();
  const formattedDate = formatTransactionDate(currentDate);

  // Update Account ledger balance
  const account = await Account.findOne({ accountNumber: sbAccount.accountNumber });
  if (!account) {
    throw new Error('Customer account not found');
  }

  const newBalance = sbAccount.balance - amount;

  // Use 'ECOMMERCE_SYSTEM' as default accountManagerId for ecommerce customers who don't have one
  const effectiveAccountManagerId = sbAccount.accountManagerId || 'ECOMMERCE_SYSTEM';

  // Create transaction record
  const transaction = await AccountTransaction.DepositTransactionAccount({
    createdBy: staffId || 'SYSTEM',
    transactionOwnerId: staffId || 'SYSTEM',
    customerId: sbAccount.customerId,
    amount: amount,
    balance: newBalance,
    branchId: sbAccount.branchId || 'ECOMMERCE',
    accountManagerId: effectiveAccountManagerId,
    accountNumber: sbAccount.accountNumber,
    accountTypeId: sbAccount._id,
    date: formattedDate,
    narration: `E-Commerce Installment Payment - Order: ${order.orderNumber}`,
    package: "SB",
    direction: "Debit",
  });

  // Update Account ledger balance
  if (!options.skipAccountLedgerUpdate) {
    await Account.findOneAndUpdate(
      { accountNumber: sbAccount.accountNumber },
      { $set: { ledgerBalance: account.ledgerBalance - amount } }
    );
  }

  // Update SB Account balance
  await SBAccount.findByIdAndUpdate(
    sbAccount._id,
    { balance: newBalance }
  );

  return transaction;
};

const creditWalletForOrderPayment = async (order, amount, transactionRef) => {
  const account = await getCustomerWalletAccount(order);
  const formattedDate = formatTransactionDate();
  const newAvailableBalance = Number(account.availableBalance || 0) + amount;
  const newLedgerBalance = Number(account.ledgerBalance || 0) + amount;
  const customerActor = order.customerId?.toString() || account.customerId;
  const reportingActor = getReportingStaffId(account.accountManagerId, customerActor);

  await AccountTransaction.DepositTransactionAccount({
    createdBy: reportingActor,
    transactionOwnerId: customerActor,
    customerId: account.customerId,
    amount,
    balance: newAvailableBalance,
    branchId: account.branchId,
    accountManagerId: account.accountManagerId || 'ECOMMERCE_SYSTEM',
    accountNumber: account.accountNumber,
    accountTypeId: account._id,
    date: formattedDate,
    narration: `Order Payment to Wallet - Order: ${order.orderNumber} - Ref: ${transactionRef}`,
    package: "Wallet",
    direction: "Credit",
  });

  await Account.findByIdAndUpdate(
    account._id,
    {
      $set: {
        availableBalance: newAvailableBalance,
        ledgerBalance: newLedgerBalance,
      },
    }
  );
};

const debitWalletForOrderPayment = async (order, amount, transactionRef) => {
  const account = await getCustomerWalletAccount(order);
  const formattedDate = formatTransactionDate();
  const newAvailableBalance = Number(account.availableBalance || 0) - amount;
  const newLedgerBalance = Number(account.ledgerBalance || 0) - amount;

  if (newAvailableBalance < 0) {
    throw new Error(`Insufficient wallet balance. Available: ₦${Number(account.availableBalance || 0).toLocaleString()}, Required: ₦${amount.toLocaleString()}`);
  }

  const customerActor = order.customerId?.toString() || account.customerId;
  const reportingActor = getReportingStaffId(account.accountManagerId, customerActor);
  const debitNarration = order.paymentType === 'installment'
    ? `Debited from Wallet to SB Account - Order: ${order.orderNumber} - Ref: ${transactionRef}`
    : `Debited from Wallet for Order Payment - Order: ${order.orderNumber} - Ref: ${transactionRef}`;

  await AccountTransaction.DepositTransactionAccount({
    createdBy: reportingActor,
    transactionOwnerId: customerActor,
    customerId: account.customerId,
    amount,
    balance: newAvailableBalance,
    branchId: account.branchId,
    accountManagerId: account.accountManagerId || 'ECOMMERCE_SYSTEM',
    accountNumber: account.accountNumber,
    accountTypeId: account._id,
    date: formattedDate,
    narration: debitNarration,
    package: "Wallet",
    direction: "Debit",
  });

  await Account.findByIdAndUpdate(
    account._id,
    {
      $set: {
        availableBalance: newAvailableBalance,
        ledgerBalance: newLedgerBalance,
      },
    }
  );
};

const recordWalletMovementForOrderPayment = async (orderId, amount, transactionRef) => {
  const order = await EcommerceOrder.findById(orderId);
  if (!order) {
    throw new Error('Order not found');
  }

  await creditWalletForOrderPayment(order, amount, transactionRef);
  await debitWalletForOrderPayment(order, amount, transactionRef);

  return order;
};

const debitWalletForScheduledPayment = async (order, amount, transactionRef, source = 'SYSTEM_AUTO') => {
  const account = await getCustomerWalletAccount(order);

  if (Number(account.availableBalance || 0) < amount) {
    throw new Error(`Insufficient wallet balance. Available: ₦${Number(account.availableBalance || 0).toLocaleString()}, Required: ₦${amount.toLocaleString()}`);
  }

  const formattedDate = formatTransactionDate();
  const newAvailableBalance = Number(account.availableBalance || 0) - amount;
  const newLedgerBalance = Number(account.ledgerBalance || 0) - amount;
  const reportingActor = getReportingStaffId(account.accountManagerId, source);

  await AccountTransaction.DepositTransactionAccount({
    createdBy: reportingActor,
    transactionOwnerId: source,
    customerId: account.customerId,
    amount,
    balance: newAvailableBalance,
    branchId: account.branchId,
    accountManagerId: account.accountManagerId || 'ECOMMERCE_SYSTEM',
    accountNumber: account.accountNumber,
    accountTypeId: account._id,
    date: formattedDate,
    narration: `Automatic wallet debit for Order: ${order.orderNumber} - Ref: ${transactionRef}`,
    package: "Wallet",
    direction: "Debit",
  });

  await Account.findByIdAndUpdate(
    account._id,
    {
      $set: {
        availableBalance: newAvailableBalance,
        ledgerBalance: newLedgerBalance,
      },
    }
  );
};

const creditSBAccountWithoutLedgerImpact = async (order, amount, transactionRef, source) => {
  const sbAccount = await SBAccount.findOne({ SBAccountNumber: order.SBAccountNumber });
  if (!sbAccount) {
    throw new Error('SB Account not found');
  }

  const formattedDate = formatTransactionDate();
  const effectiveAccountManagerId = sbAccount.accountManagerId || 'ECOMMERCE_SYSTEM';
  const reportingActor = getReportingStaffId(effectiveAccountManagerId, source);

  await AccountTransaction.DepositTransactionAccount({
    createdBy: reportingActor,
    transactionOwnerId: source,
    customerId: sbAccount.customerId,
    amount,
    balance: sbAccount.balance + amount,
    branchId: sbAccount.branchId || 'ECOMMERCE',
    accountManagerId: effectiveAccountManagerId,
    accountNumber: sbAccount.accountNumber,
    accountTypeId: sbAccount._id,
    date: formattedDate,
    narration: `Wallet Transfer to SB Account - Order: ${order.orderNumber} - Ref: ${transactionRef}`,
    package: "SB",
    direction: "Credit",
    excludeFromStaffStats: true,
  });

  return await SBAccount.findByIdAndUpdate(
    sbAccount._id,
    { balance: sbAccount.balance + amount },
    { new: true }
  );
};

const recordFlexibleInstallmentOrderPayment = async (orderId, amount, transactionRef, source, options = {}) => {
  const order = await EcommerceOrder.findById(orderId);
  if (!order) {
    throw new Error('Order not found');
  }

  if (order.paymentType !== 'installment' || !order.installmentPlan) {
    throw new Error('This order is not a pay-small-small order');
  }
  if (!order.SBAccountNumber) {
    throw new Error('This order does not have an SB Account');
  }
  const existingSBAccount = await SBAccount.findOne({ SBAccountNumber: order.SBAccountNumber });
  if (!existingSBAccount) {
    throw new Error('SB Account not found');
  }

  const paymentAmount = normalizePaymentAmount(amount);
  const remainingBalance = Number(order.installmentPlan.remainingBalance || 0);
  if (remainingBalance <= 0) {
    throw new Error('This order has already been fully paid');
  }
  if (paymentAmount > remainingBalance) {
    throw new Error(`Payment amount cannot exceed remaining balance of ₦${remainingBalance.toLocaleString()}`);
  }

  const alreadyRecorded = order.installmentPlan.payments?.some(
    (payment) => payment.transactionRef === transactionRef
  );
  if (alreadyRecorded) {
    return { order, sbAccount: await SBAccount.findOne({ SBAccountNumber: order.SBAccountNumber }) };
  }

  if (options.creditWallet !== false) {
    await creditWalletForOrderPayment(order, paymentAmount, transactionRef);
  }

  await debitWalletForOrderPayment(order, paymentAmount, transactionRef);
  const sbAccount = await creditSBAccountWithoutLedgerImpact(order, paymentAmount, transactionRef, source);

  order.installmentPlan.payments.push({
    date: new Date(),
    amount: paymentAmount,
    status: 'paid',
    paidAt: new Date(),
    transactionRef
  });

  order.installmentPlan.totalPaid = Number(order.installmentPlan.totalPaid || 0) + paymentAmount;
  order.installmentPlan.remainingBalance = Math.max(0, remainingBalance - paymentAmount);
  order.installmentPlan.nextPaymentDate = null;

  if (order.installmentPlan.remainingBalance <= 0) {
    order.paymentStatus = 'paid';
    order.status = 'paid';
    await updateSBAccountToSold(order.SBAccountNumber);
  } else {
    order.paymentStatus = 'partial';
    order.status = 'partially_paid';
  }

  await order.save();

  return { order: await EcommerceOrder.findById(order._id), sbAccount };
};

const transferWalletToSBForPayment = async (order, amount, transactionRef, source = 'SYSTEM_AUTO') => {
  await debitWalletForScheduledPayment(order, amount, transactionRef, source);
  return await creditSBAccountWithoutLedgerImpact(order, amount, transactionRef, source);
};

const debitWalletForInstallmentPayoff = async (order, amount, transactionRef) => {
  const account = await getCustomerWalletAccount(order);

  if (Number(account.availableBalance || 0) < amount) {
    throw new Error(`Insufficient wallet balance. Available: ₦${Number(account.availableBalance || 0).toLocaleString()}, Required: ₦${amount.toLocaleString()}`);
  }

  const formattedDate = formatTransactionDate();
  const newAvailableBalance = Number(account.availableBalance || 0) - amount;
  const newLedgerBalance = Number(account.ledgerBalance || 0) - amount;
  const customerActor = order.customerId?.toString() || account.customerId;
  const reportingActor = getReportingStaffId(account.accountManagerId, customerActor);

  await AccountTransaction.DepositTransactionAccount({
    createdBy: reportingActor,
    transactionOwnerId: customerActor,
    customerId: account.customerId,
    amount,
    balance: newAvailableBalance,
    branchId: account.branchId,
    accountManagerId: account.accountManagerId || 'ECOMMERCE_SYSTEM',
    accountNumber: account.accountNumber,
    accountTypeId: account._id,
    date: formattedDate,
    narration: `Wallet payoff for Order: ${order.orderNumber} - Ref: ${transactionRef}`,
    package: "Wallet",
    direction: "Debit",
  });

  await Account.findByIdAndUpdate(
    account._id,
    {
      $set: {
        availableBalance: newAvailableBalance,
        ledgerBalance: newLedgerBalance,
      },
    }
  );

  return account;
};

const payoffRemainingBalanceFromWallet = async (orderNumber, customerId) => {
  const order = await EcommerceOrder.findOne({ orderNumber, customerId: customerId.toString() });
  if (!order) {
    throw new Error('Order not found');
  }

  if (order.paymentType !== 'installment' || !order.installmentPlan) {
    throw new Error('Only pay-small-small orders can be paid off from wallet');
  }

  const remainingBalance = Number(order.installmentPlan.remainingBalance || 0);
  if (remainingBalance <= 0) {
    throw new Error('This order has already been fully paid');
  }

  const transactionRef = `WALLET_PAYOFF_${Date.now()}`;
  await debitWalletForInstallmentPayoff(order, remainingBalance, transactionRef);
  const fundedSBAccount = await creditSBAccountWithoutLedgerImpact(order, remainingBalance, transactionRef, customerId.toString());

  const pendingPayments = order.installmentPlan.payments.filter((payment) => payment.status === 'pending');
  if (pendingPayments.length === 0) {
    order.installmentPlan.payments.push({
      date: new Date(),
      amount: remainingBalance,
      status: 'paid',
      paidAt: new Date(),
      transactionRef
    });
    order.installmentPlan.totalPaid = Number(order.installmentPlan.totalPaid || 0) + remainingBalance;
    order.installmentPlan.remainingBalance = 0;
    order.installmentPlan.nextPaymentDate = null;
    order.paymentStatus = 'paid';
    order.status = 'paid';
    await updateSBAccountToSold(order.SBAccountNumber);
    await order.save();
    return await EcommerceOrder.findById(order._id);
  }

  let workingSBAccount = fundedSBAccount;

  for (const payment of pendingPayments) {
    await debitSBAccountForPayment(
      workingSBAccount,
      payment.amount,
      order,
      customerId.toString(),
      { skipAccountLedgerUpdate: true }
    );

    const paymentIndex = order.installmentPlan.payments.findIndex(
      (item) => item._id?.toString() === payment._id?.toString()
    );

    if (paymentIndex !== -1) {
      order.installmentPlan.payments[paymentIndex].status = 'paid';
      order.installmentPlan.payments[paymentIndex].paidAt = new Date();
      order.installmentPlan.payments[paymentIndex].transactionRef = transactionRef;
    }

    order.installmentPlan.totalPaid += payment.amount;
    order.installmentPlan.remainingBalance -= payment.amount;
    workingSBAccount.balance -= payment.amount;
  }

  order.installmentPlan.nextPaymentDate = null;
  order.paymentStatus = 'paid';
  order.status = 'paid';
  await updateSBAccountToSold(order.SBAccountNumber);

  await order.save();

  return await EcommerceOrder.findById(order._id);
};

// Record installment payment by debiting from SB Account
const recordInstallmentPayment = async (orderId, amount, transactionRef, staffId) => {
  const order = await EcommerceOrder.findById(orderId);
  if (!order) {
    throw new Error('Order not found');
  }

  if (order.paymentType !== 'installment') {
    throw new Error('This order is not an installment order');
  }

  // Find the next pending payment
  const pendingPaymentIndex = order.installmentPlan.payments.findIndex(
    p => p.status === 'pending'
  );

  if (pendingPaymentIndex === -1) {
    throw new Error('All payments have been completed');
  }

  // Get SB Account and verify balance
  const sbAccount = await SBAccount.findOne({ SBAccountNumber: order.SBAccountNumber });
  if (!sbAccount) {
    throw new Error('SB Account not found for this order');
  }

  if (sbAccount.balance < amount) {
    throw new Error(`Insufficient SB Account balance. Available: ₦${sbAccount.balance.toLocaleString()}, Required: ₦${amount.toLocaleString()}`);
  }

  // Debit the SB Account
  await debitSBAccountForPayment(sbAccount, amount, order, staffId);

  // Update the payment record
  order.installmentPlan.payments[pendingPaymentIndex].status = 'paid';
  order.installmentPlan.payments[pendingPaymentIndex].paidAt = new Date();
  order.installmentPlan.payments[pendingPaymentIndex].transactionRef = transactionRef;

  // Update totals
  order.installmentPlan.totalPaid += amount;
  order.installmentPlan.remainingBalance -= amount;

  // Update next payment date
  const nextPending = order.installmentPlan.payments.find(p => p.status === 'pending');
  order.installmentPlan.nextPaymentDate = nextPending ? nextPending.date : null;

  // Update payment status
  if (order.installmentPlan.remainingBalance <= 0) {
    order.paymentStatus = 'paid';
    order.status = 'paid';
    // Update SBAccount status to sold
    await updateSBAccountToSold(order.SBAccountNumber);
  } else {
    order.paymentStatus = 'partial';
    order.status = 'partially_paid';
  }

  return await order.save();
};

// Process automatic payments for due installments
const processAutomaticPayments = async () => {
  const now = new Date();
  const results = {
    processed: [],
    insufficientBalance: [],
    errors: []
  };

  // Find all orders with due payments
  const ordersWithDuePayments = await EcommerceOrder.find({
    paymentType: 'installment',
    paymentStatus: { $ne: 'paid' },
    'installmentPlan.payments': {
      $elemMatch: {
        status: 'pending',
        date: { $lte: now }
      }
    }
  });

  for (const order of ordersWithDuePayments) {
    try {
      // Get the SB Account
      const sbAccount = await SBAccount.findOne({ SBAccountNumber: order.SBAccountNumber });
      if (!sbAccount) {
        results.errors.push({
          orderId: order._id,
          orderNumber: order.orderNumber,
          error: 'SB Account not found'
        });
        continue;
      }

      // Find all pending due payments
      const duePayments = order.installmentPlan.payments.filter(
        p => p.status === 'pending' && new Date(p.date) <= now
      );

      let workingSBAccount = sbAccount;
      for (const payment of duePayments) {
        try {
          const autoRef = `AUTO_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          workingSBAccount = await transferWalletToSBForPayment(order, payment.amount, autoRef, 'SYSTEM_AUTO');
          await debitSBAccountForPayment(workingSBAccount, payment.amount, order, 'SYSTEM_AUTO', {
            skipAccountLedgerUpdate: true
          });

          const paymentIndex = order.installmentPlan.payments.findIndex(
            p => p.date.getTime() === new Date(payment.date).getTime() && p.status === 'pending'
          );

          if (paymentIndex !== -1) {
            order.installmentPlan.payments[paymentIndex].status = 'paid';
            order.installmentPlan.payments[paymentIndex].paidAt = new Date();
            order.installmentPlan.payments[paymentIndex].transactionRef = autoRef;

            order.installmentPlan.totalPaid += payment.amount;
            order.installmentPlan.remainingBalance -= payment.amount;
            workingSBAccount.balance -= payment.amount;
          }

          results.processed.push({
            orderId: order._id,
            orderNumber: order.orderNumber,
            amount: payment.amount,
            paymentDate: payment.date
          });
        } catch (err) {
          results.insufficientBalance.push({
            orderId: order._id,
            orderNumber: order.orderNumber,
            requiredAmount: payment.amount,
            availableBalance: (await getCustomerWalletAccount(order)).availableBalance,
            paymentDate: payment.date
          });
          if (!String(err.message || '').includes('Insufficient wallet balance')) {
            results.errors.push({
              orderId: order._id,
              orderNumber: order.orderNumber,
              error: err.message
            });
          }
        }
      }

      // Update next payment date and order status
      const nextPending = order.installmentPlan.payments.find(p => p.status === 'pending');
      order.installmentPlan.nextPaymentDate = nextPending ? nextPending.date : null;

      if (order.installmentPlan.remainingBalance <= 0) {
        order.paymentStatus = 'paid';
        order.status = 'paid';
        // Update SBAccount status to sold
        await updateSBAccountToSold(order.SBAccountNumber);
      } else if (order.installmentPlan.totalPaid > 0) {
        order.paymentStatus = 'partial';
        order.status = 'partially_paid';
      }

      await order.save();
    } catch (err) {
      results.errors.push({
        orderId: order._id,
        orderNumber: order.orderNumber,
        error: err.message
      });
    }
  }

  return results;
};

// Check and process payment when SB Account balance changes
const checkAndProcessPendingPayments = async (SBAccountNumber) => {
  const order = await EcommerceOrder.findOne({
    SBAccountNumber,
    paymentType: 'installment',
    paymentStatus: { $ne: 'paid' }
  });

  if (!order) {
    return null;
  }

  const sbAccount = await SBAccount.findOne({ SBAccountNumber });
  if (!sbAccount) {
    return null;
  }

  const now = new Date();
  const results = { processed: [], pending: [] };

  // Find pending payments that are due
  const pendingPayments = order.installmentPlan.payments.filter(
    p => p.status === 'pending' && new Date(p.date) <= now
  );

  let workingSBAccount = sbAccount;
  for (const payment of pendingPayments) {
    try {
      const autoRef = `AUTO_BALANCE_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      workingSBAccount = await transferWalletToSBForPayment(order, payment.amount, autoRef, 'SYSTEM_AUTO');
      await debitSBAccountForPayment(workingSBAccount, payment.amount, order, 'SYSTEM_AUTO', {
        skipAccountLedgerUpdate: true
      });

      const paymentIndex = order.installmentPlan.payments.findIndex(
        p => p.date.getTime() === new Date(payment.date).getTime() && p.status === 'pending'
      );

      if (paymentIndex !== -1) {
        order.installmentPlan.payments[paymentIndex].status = 'paid';
        order.installmentPlan.payments[paymentIndex].paidAt = new Date();
        order.installmentPlan.payments[paymentIndex].transactionRef = autoRef;

        order.installmentPlan.totalPaid += payment.amount;
        order.installmentPlan.remainingBalance -= payment.amount;
        workingSBAccount.balance -= payment.amount;
      }

      results.processed.push({ amount: payment.amount, date: payment.date });
    } catch (err) {
      results.pending.push({ amount: payment.amount, date: payment.date, error: err.message });
    }
  }

  // Update order status
  const nextPending = order.installmentPlan.payments.find(p => p.status === 'pending');
  order.installmentPlan.nextPaymentDate = nextPending ? nextPending.date : null;

  if (order.installmentPlan.remainingBalance <= 0) {
    order.paymentStatus = 'paid';
    order.status = 'paid';
    // Update SBAccount status to sold
    await updateSBAccountToSold(order.SBAccountNumber);
  } else if (order.installmentPlan.totalPaid > 0) {
    order.paymentStatus = 'partial';
    order.status = 'partially_paid';
  }

  await order.save();

  return results;
};

const recordOutrightPayment = async (orderId, transactionRef) => {
  console.log('recordOutrightPayment called with orderId:', orderId, 'type:', typeof orderId);

  // First, find the order to verify it exists
  const existingOrder = await EcommerceOrder.findById(orderId);
  console.log('Existing order found:', existingOrder ? 'Yes' : 'No');
  if (existingOrder) {
    console.log('Current status:', existingOrder.status, 'paymentStatus:', existingOrder.paymentStatus);
  }

  // Use direct update and save for more reliability
  if (!existingOrder) {
    throw new Error('Order not found');
  }

  existingOrder.paymentStatus = 'paid';
  existingOrder.status = 'paid';
  await existingOrder.save();

  // Update SBAccount status to sold
  await updateSBAccountToSold(existingOrder.SBAccountNumber);

  console.log('After save - status:', existingOrder.status, 'paymentStatus:', existingOrder.paymentStatus);

  // Verify the update persisted
  const verifyOrder = await EcommerceOrder.findById(orderId);
  console.log('Verification check - status:', verifyOrder.status, 'paymentStatus:', verifyOrder.paymentStatus);

  return verifyOrder;
};

const cancelOrder = async (orderId, reason) => {
  const order = await EcommerceOrder.findById(orderId);
  if (!order) {
    throw new Error('Order not found');
  }

  if (order.status === 'delivered') {
    throw new Error('Cannot cancel a delivered order');
  }

  // Restore stock
  for (const item of order.items) {
    await ProductService.updateProductStock(item.productId, item.quantity, 'increase');
  }

  order.status = 'cancelled';
  order.notes = order.notes ? `${order.notes}\nCancellation reason: ${reason}` : `Cancellation reason: ${reason}`;

  return await order.save();
};

const getOrdersByBranch = async (branchId) => {
  return await EcommerceOrder.find({ branchId }).sort({ createdAt: -1 });
};

const getOverdueInstallments = async () => {
  const now = new Date();
  return await EcommerceOrder.find({
    paymentType: 'installment',
    paymentStatus: { $ne: 'paid' },
    'installmentPlan.payments': {
      $elemMatch: {
        status: 'pending',
        date: { $lt: now }
      }
    }
  });
};

// Get order by payment reference
const getOrderByReference = async (paymentReference) => {
  return await EcommerceOrder.findOne({ paymentReference });
};

// Credit SB Account directly (used by Paystack payment flow)
const creditSBAccountForOrderDirect = async (orderId, amount, transactionRef, source) => {
  return await recordFlexibleInstallmentOrderPayment(orderId, amount, transactionRef, source);
};

module.exports = {
  createOrder,
  getOrderById,
  getOrderByNumber,
  getCustomerOrders,
  getAllOrders,
  updateOrderStatus,
  recordInstallmentPayment,
  recordOutrightPayment,
  cancelOrder,
  getOrdersByBranch,
  getOverdueInstallments,
  getOrderSBAccount,
  getOrderWalletAccount,
  creditSBAccountForOrder,
  processAutomaticPayments,
  checkAndProcessPendingPayments,
  getOrderByReference,
  creditSBAccountForOrderDirect,
  recordFlexibleInstallmentOrderPayment,
  updateSBAccountToSold,
  recordWalletMovementForOrderPayment,
  payoffRemainingBalanceFromWallet
};
