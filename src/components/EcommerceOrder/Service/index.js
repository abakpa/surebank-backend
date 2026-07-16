const EcommerceOrder = require('../Model/index');
const Cart = require('../../Cart/Model/index');
const CartService = require('../../Cart/Service/index');
const Product = require('../../Product/Model/index');
const ProductService = require('../../Product/Service/index');
const SBAccount = require('../../SBAccount/Model/index');
const Account = require('../../Account/Model/index');
const AccountTransaction = require('../../AccountTransaction/Service/index');
const AccountTransactionModel = require('../../AccountTransaction/Model/index');
const SureBankAccountTransaction = require('../../SureBankAccount/Model/index');
const SureBankAccountTransactionService = require('../../SureBankAccount/Service/index');
const Staff = require('../../Staff/Model/index');
const Customer = require('../../Customer/Model/index');
const ProductBranchStock = require('../../ProductBranchStock/Model/index');
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

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getOrderItemVariation = (product, variationId = '') => {
  if (!product || !variationId || !Array.isArray(product.variations)) {
    return null;
  }

  return product.variations.find((variation) => String(variation._id || '') === String(variationId)) || null;
};

const calculateOrderItemProfit = (product, item) => {
  const quantity = Math.max(1, Number(item.quantity || 1));
  const subtotal = Number(item.subtotal || item.price || 0);
  const variation = getOrderItemVariation(product, item.variationId || '');
  const costPrice = Number((variation ? variation.costPrice : product?.costPrice) || 0);

  if (subtotal <= 0 || costPrice <= 0) {
    return { costPrice: 0, costSubtotal: 0, profitAmount: 0 };
  }

  const costSubtotal = costPrice * quantity;
  const profitAmount = Math.max(0, Math.round((subtotal - costSubtotal) * 100) / 100);

  return { costPrice, costSubtotal, profitAmount };
};

const recordEcommerceOrderItemIncome = async (order, item, staff) => {
  if (!order || !item || item.profitReported) {
    return null;
  }

  const product = await Product.findById(item.productId);
  const { costPrice, costSubtotal, profitAmount } = calculateOrderItemProfit(product, item);

  item.costPrice = costPrice;
  item.costSubtotal = costSubtotal;
  item.profitAmount = profitAmount;

  if (profitAmount <= 0) {
    return null;
  }

  const itemId = String(item._id || item.productId || '');
  const narrationRef = `ECOMMERCE_ITEM_PROFIT_${order.orderNumber}_${itemId}`;
  const existingIncome = await SureBankAccountTransaction.findOne({
    package: 'ECOMMERCE',
    direction: 'Credit',
    narration: { $regex: escapeRegex(narrationRef) }
  });

  if (existingIncome) {
    item.profitReported = true;
    item.profitReportedAt = existingIncome.createdAt || new Date();
    return existingIncome;
  }

  const sbAccount = order.SBAccountNumber
    ? await SBAccount.findOne({ SBAccountNumber: order.SBAccountNumber })
    : null;
  const currentDate = new Date();

  const result = await SureBankAccountTransactionService.DepositTransactionAccount({
    package: 'ECOMMERCE',
    date: formatTransactionDate(currentDate),
    direction: 'Credit',
    narration: `${narrationRef} - Profit on ${item.productName}`,
    branchId: order.branchId || sbAccount?.branchId || '',
    amount: profitAmount,
    customerId: order.customerId,
    type: sbAccount?._id?.toString() || order._id?.toString(),
  });

  item.profitReported = true;
  item.profitReportedAt = currentDate;

  return result;
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

const buildOrderProductSummary = (items = [], orderNumber = '') => {
  const productNames = items
    .map((item) => item.variationName ? `${item.productName} - ${item.variationName}` : item.productName)
    .filter(Boolean)
    .join(', ');

  return productNames ? `${productNames} (${orderNumber})` : `E-Commerce Order: ${orderNumber}`;
};

const getPaymentStatusFromSBAccount = (sbAccount, paidAmountOverride = null) => {
  if (sbAccount.status === 'sold') {
    return 'paid';
  }

  const sellingPrice = Number(sbAccount.sellingPrice || 0);
  const balance = paidAmountOverride === null
    ? Number(sbAccount.balance || 0)
    : Number(paidAmountOverride || 0);

  if (sellingPrice > 0 && balance >= sellingPrice) {
    return 'paid';
  }

  return balance > 0 ? 'partial' : 'unpaid';
};

const getOrderStatusFromSBAccount = (sbAccount, paidAmountOverride = null) => {
  if (sbAccount.status === 'sold') {
    return 'paid';
  }

  const paymentStatus = getPaymentStatusFromSBAccount(sbAccount, paidAmountOverride);
  if (paymentStatus === 'paid') return 'paid';
  if (paymentStatus === 'partial') return 'partially_paid';
  return 'pending';
};

const allocateOrderItemPayments = (order, preferredPaymentReference = '') => {
  if (!order || !Array.isArray(order.items)) return order;

  let remainingPaid = Number(order.installmentPlan?.totalPaid || 0);
  const orderedItems = preferredPaymentReference
    ? [
        ...order.items.filter((item) => item.paymentReference === preferredPaymentReference),
        ...order.items.filter((item) => item.paymentReference !== preferredPaymentReference)
      ]
    : order.items;

  orderedItems.forEach((item) => {
    const subtotal = Number(item.subtotal || 0);
    const paidAmount = Math.min(subtotal, Math.max(0, remainingPaid));
    remainingPaid -= paidAmount;
    item.paidAmount = paidAmount;
    item.paymentStatus = paidAmount >= subtotal
      ? 'paid'
      : paidAmount > 0
        ? 'partial'
        : 'unpaid';

    if (!item.fulfillmentStatus) {
      item.fulfillmentStatus = 'pending';
    }
  });

  return order;
};

const markAllOrderItemsPaid = (order) => {
  if (!order || !Array.isArray(order.items)) return order;

  order.items.forEach((item) => {
    const subtotal = Number(item.subtotal || 0);
    item.paidAmount = subtotal;
    item.paymentStatus = 'paid';
    if (!item.fulfillmentStatus) {
      item.fulfillmentStatus = 'pending';
    }
  });

  return order;
};

const isDeliveredOrderItem = (item = {}) => ['delivered', 'completed'].includes(item.fulfillmentStatus);
const PRODUCT_DEBIT_DIRECTIONS = ['Debit', 'Purchased', 'Bought', 'Delivered'];

const isDebitPaymentRecord = (payment = {}) => (
  payment.type === 'debit' || PRODUCT_DEBIT_DIRECTIONS.includes(payment.direction)
);

const getInstallmentPaymentSummary = (payments = []) => {
  const summary = payments.reduce((totals, payment) => {
    if (payment.status !== 'paid') {
      return totals;
    }

    const amount = Number(payment.amount || 0);
    if (isDebitPaymentRecord(payment)) {
      totals.debitTotal += amount;
      totals.netPaid -= amount;
      return totals;
    }

    totals.grossPaid += amount;
    totals.netPaid += amount;
    return totals;
  }, { grossPaid: 0, debitTotal: 0, netPaid: 0 });

  summary.netPaid = Math.max(0, summary.netPaid);
  return summary;
};

const attachOrderItemFinancialSummary = (order, options = {}) => {
  if (!order) return order;

  const items = Array.isArray(order.items) ? order.items : [];
  const activeItemsSubtotal = items
    .filter((item) => !isDeliveredOrderItem(item))
    .reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  const outstandingItemsSubtotal = items
    .filter((item) => !isDeliveredOrderItem(item))
    .reduce((sum, item) => {
      const subtotal = Number(item.subtotal || 0);
      const paidAmount = Math.min(subtotal, Math.max(0, Number(item.paidAmount || 0)));
      return sum + Math.max(0, subtotal - paidAmount);
    }, 0);
  const deliveredItemsSubtotal = items
    .filter(isDeliveredOrderItem)
    .reduce((sum, item) => sum + Number(item.subtotal || 0), 0);

  order.activeItemsSubtotal = activeItemsSubtotal;
  order.outstandingItemsSubtotal = outstandingItemsSubtotal;
  order.deliveredItemsSubtotal = deliveredItemsSubtotal;

  if (order.paymentType === 'installment' && order.installmentPlan) {
    const payments = Array.isArray(order.installmentPlan.payments)
      ? order.installmentPlan.payments
      : [];
    const paymentSummary = getInstallmentPaymentSummary(payments);
    const statementBalance = Number(
      options.walletBalance ??
        order.customerStatement?.walletBalance ??
        order.installmentPlan.walletBalance ??
        paymentSummary.netPaid
    );
    const currentWalletBalance = Math.max(0, statementBalance);
    const remainingBalance = Math.max(0, outstandingItemsSubtotal - currentWalletBalance);

    order.installmentPlan = {
      ...order.installmentPlan,
      payments,
      totalPaid: currentWalletBalance,
      walletBalance: currentWalletBalance,
      grossPaid: paymentSummary.grossPaid,
      debitTotal: paymentSummary.debitTotal,
      remainingBalance,
      creditBalance: Math.max(0, currentWalletBalance - outstandingItemsSubtotal)
    };

    order.customerStatement = {
      title: 'Customer Statement of Account',
      walletBalance: currentWalletBalance,
      paidTotal: currentWalletBalance,
      totalDeposits: paymentSummary.grossPaid,
      totalProductPayments: paymentSummary.debitTotal,
      remainingBalance,
      activeItemsSubtotal,
      outstandingItemsSubtotal,
      deliveredItemsSubtotal,
      transactions: payments
    };
  }

  return order;
};

const getSBAccountPaymentRecords = async (sbAccountId) => {
  const transactions = await AccountTransactionModel.find({
    accountTypeId: sbAccountId.toString(),
    package: 'SB',
    direction: { $in: ['Credit', ...PRODUCT_DEBIT_DIRECTIONS] }
  }).sort({ createdAt: 1 }).lean();

  return transactions.map((transaction) => ({
    _id: transaction._id,
    date: transaction.createdAt || new Date(),
    amount: Number(transaction.amount || 0),
    status: 'paid',
    direction: transaction.direction,
    type: PRODUCT_DEBIT_DIRECTIONS.includes(transaction.direction) ? 'debit' : 'credit',
    paidAt: transaction.createdAt || new Date(),
    transactionRef: transaction.transactionRef || transaction.narration || transaction._id?.toString(),
    narration: transaction.narration,
    balance: Number(transaction.balance || 0),
    source: transaction.createdBy === 'PAYSTACK' ? 'Paystack' : 'Backoffice'
  }));
};

const getSBOrderWalletStatementRecords = async (walletAccountId) => {
  const transactions = await AccountTransactionModel.find({
    accountTypeId: walletAccountId.toString(),
    package: 'Wallet',
    direction: { $in: ['Credit', 'Debit', 'Bought', 'Delivered'] }
  }).sort({ createdAt: -1 }).lean();

  return transactions.map((transaction) => ({
    _id: transaction._id,
    date: transaction.createdAt || new Date(),
    amount: Number(transaction.amount || 0),
    status: 'paid',
    direction: transaction.direction,
    type: PRODUCT_DEBIT_DIRECTIONS.includes(transaction.direction) ? 'debit' : 'credit',
    paidAt: transaction.createdAt || new Date(),
    transactionRef: transaction.transactionRef || transaction.narration || transaction._id?.toString(),
    narration: transaction.narration,
    balance: Number(transaction.balance || 0),
    source: transaction.createdBy === 'PAYSTACK' ? 'Paystack' : 'Backoffice'
  }));
};

const getSBAccountPaidAmountFromRecords = (payments = []) => (
  getInstallmentPaymentSummary(payments).netPaid
);

const mergeOrderPaymentRecordsWithSBDeposits = async (plainOrder) => {
  if (!plainOrder?.SBAccountNumber || plainOrder.paymentType !== 'installment' || !plainOrder.installmentPlan) {
    return plainOrder;
  }

  const sbAccount = await SBAccount.findOne({ SBAccountNumber: plainOrder.SBAccountNumber }).lean();
  if (!sbAccount) {
    return plainOrder;
  }
  const walletAccount = await getCustomerWalletAccount(plainOrder);

  const walletPayments = await getSBOrderWalletStatementRecords(walletAccount._id);

  const mergedPayments = walletPayments
    .map((payment) => ({
      ...payment,
      type: isDebitPaymentRecord(payment) ? 'debit' : payment.type || 'credit'
    }))
    .sort((a, b) => new Date(b.paidAt || b.date || 0) - new Date(a.paidAt || a.date || 0));

  plainOrder.installmentPlan = {
    ...plainOrder.installmentPlan,
    payments: mergedPayments
  };
  attachOrderItemFinancialSummary(plainOrder, { walletBalance: Number(walletAccount.availableBalance || 0) });

  if (plainOrder.installmentPlan.remainingBalance <= 0) {
    plainOrder.paymentStatus = 'paid';
    if (!['delivered', 'completed', 'cancelled'].includes(plainOrder.status)) {
      plainOrder.status = 'paid';
    }
  } else if (Number(plainOrder.installmentPlan.totalPaid || 0) > 0) {
    plainOrder.paymentStatus = 'partial';
    if (!['delivered', 'completed', 'cancelled'].includes(plainOrder.status)) {
      plainOrder.status = 'partially_paid';
    }
  }

  return plainOrder;
};

async function normalizeMultiItemOrderPayments(plainOrder) {
  if (!plainOrder?.SBAccountNumber || plainOrder.paymentType !== 'installment') {
    return plainOrder;
  }

  const sbAccount = await SBAccount.findOne({ SBAccountNumber: plainOrder.SBAccountNumber }).select('accountMode').lean();
  if (sbAccount?.accountMode !== 'multi_item') {
    return plainOrder;
  }

  const payments = Array.isArray(plainOrder.installmentPlan?.payments)
    ? plainOrder.installmentPlan.payments
    : [];

  plainOrder.items = await Promise.all((plainOrder.items || []).map(async (item) => {
    const subtotal = Number(item.subtotal || 0);
    const itemId = String(item._id || '');
    const isDelivered = ['delivered', 'completed'].includes(item.fulfillmentStatus);
    const hasItemPayment = payments.some((payment) => (
      payment.status === 'paid' &&
      String(payment.transactionRef || '').startsWith(`ITEM_PAYMENT_${plainOrder.orderNumber}_${itemId}_`)
    ));
    const hasDeliverySettlement = Boolean(await findExistingItemDeliverySettlement(plainOrder, item));

    if (isDelivered || hasItemPayment || hasDeliverySettlement) {
      return {
        ...item,
        paidAmount: subtotal,
        paymentStatus: 'paid'
      };
    }

    return {
      ...item,
      paidAmount: 0,
      paymentStatus: 'unpaid'
    };
  }));

  return plainOrder;
}

const buildOrderFromSBAccount = async (sbAccount) => {
  const sellingPrice = Number(sbAccount.sellingPrice || 0);
  const isLegacyAccount = sbAccount.accountMode !== 'multi_item';
  const walletAccount = await ensureSBOrderWalletForCustomer({
    customerId: sbAccount.customerId,
    accountNumber: sbAccount.accountNumber
  });
  const payments = await getSBOrderWalletStatementRecords(walletAccount._id);
  const paymentSummary = getInstallmentPaymentSummary(payments);
  const totalPaid = Number(walletAccount.availableBalance || 0);
  const remainingBalance = Math.max(0, sellingPrice - totalPaid);
  const creditBalance = Math.max(0, totalPaid - sellingPrice);
  const sbItems = Array.isArray(sbAccount.items) && sbAccount.items.length > 0
    ? sbAccount.items
    : [{
        productId: '',
        productName: sbAccount.productName,
        productDescription: sbAccount.productDescription,
        quantity: 1,
        price: sellingPrice,
        subtotal: sellingPrice
      }];
  const items = sbItems.map((item, index) => {
    const quantity = Math.max(1, Number(item.quantity || 1));
    const subtotal = Number(item.subtotal || item.price || 0);
    const itemPaidAmount = ['delivered', 'completed'].includes(item.fulfillmentStatus)
      ? subtotal
      : Number(item.paidAmount || 0);
    const paidAmount = Math.min(subtotal, Math.max(0, itemPaidAmount));

	    return {
	      _id: `${sbAccount._id}-item-${item.productId || index}`,
	      productId: item.productId || '',
	      variationId: item.variationId || '',
	      variationName: item.variationName || '',
	      selectedOptions: {},
	      productName: item.productName || sbAccount.productName,
	      quantity,
	      price: Number(item.price || subtotal / quantity || 0),
	      subtotal,
	      addedAt: resolveOrderItemAddedAt(item, sbAccount.createdAt),
	      paidAmount,
	      paymentStatus: paidAmount >= subtotal ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid',
	      fulfillmentStatus: item.fulfillmentStatus || (sbAccount.status === 'sold' ? 'completed' : 'pending')
	    };
  });

  const order = {
    _id: sbAccount._id,
    orderNumber: sbAccount.SBAccountNumber,
    customerId: sbAccount.customerId,
    accountNumber: sbAccount.accountNumber,
    SBAccountNumber: sbAccount.SBAccountNumber,
    items,
    totalAmount: sellingPrice,
    paymentType: 'installment',
    installmentPlan: {
      frequency: 'flexible',
      duration: 0,
      amountPerPeriod: 0,
      totalPaid,
      walletBalance: totalPaid,
      grossPaid: paymentSummary.grossPaid,
      debitTotal: paymentSummary.debitTotal,
      remainingBalance,
      creditBalance,
      nextPaymentDate: null,
      payments
    },
    status: getOrderStatusFromSBAccount(sbAccount, totalPaid),
    paymentStatus: getPaymentStatusFromSBAccount(sbAccount, totalPaid),
    shippingAddress: 'Created in backoffice',
    shippingCity: '',
    shippingState: '',
    customerPhone: '',
    customerEmail: '',
    notes: sbAccount.productDescription,
    accountManagerId: sbAccount.accountManagerId,
    branchId: sbAccount.branchId,
    createdAt: sbAccount.createdAt,
    updatedAt: sbAccount.updatedAt,
    isBackofficeSBAccount: true,
    accountMode: sbAccount.accountMode || 'legacy',
    isReadOnlyLegacy: isLegacyAccount,
    readOnlyReason: isLegacyAccount ? 'Previous SB account. New products cannot be added to this account.' : '',
    source: 'backoffice_sb_account'
  };

  attachOrderItemFinancialSummary(order, { walletBalance: totalPaid });
  return order;
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

const getSelectedOptions = (variation) => {
  if (!variation?.optionValues) {
    return {};
  }

  return variation.optionValues instanceof Map
    ? Object.fromEntries(variation.optionValues)
    : variation.optionValues;
};

const getOutOfMarketProductIds = async (items = []) => {
  const productIds = [...new Set(
    items
      .map((item) => item.productId?.toString())
      .filter(Boolean)
  )];

  if (productIds.length === 0) {
    return new Set();
  }

  const products = await Product.find({ _id: { $in: productIds } })
    .select('_id isActive')
    .lean();
  const activeProductIds = new Set(
    products
      .filter((product) => product.isActive !== false)
      .map((product) => product._id.toString())
  );

  return new Set(productIds.filter((productId) => !activeProductIds.has(productId)));
};

const decorateOrderProductAvailability = async (order) => {
  if (!order || order.isBackofficeSBAccount || order.source === 'backoffice_sb_account') {
    return order;
  }

  const plainOrder = typeof order.toObject === 'function' ? order.toObject() : { ...order };
  await mergeOrderPaymentRecordsWithSBDeposits(plainOrder);
  await normalizeMultiItemOrderPayments(plainOrder);
  const outOfMarketProductIds = await getOutOfMarketProductIds(plainOrder.items || []);
  const orderIsCompleted = plainOrder.paymentStatus === 'paid' && plainOrder.status === 'completed';

  plainOrder.items = (plainOrder.items || []).map((item) => ({
    ...item,
    addedAt: resolveOrderItemAddedAt(item, plainOrder.createdAt),
    isOutOfMarket: outOfMarketProductIds.has(item.productId?.toString()),
    requiresReplacement: outOfMarketProductIds.has(item.productId?.toString()) && !orderIsCompleted
  }));
  attachOrderItemFinancialSummary(plainOrder);

  return plainOrder;
};

const canStaffUpdateOrderStatus = (order, staff) => {
  if (!staff) return false;
  if (staff.role === 'Admin') return true;
  if (staff.role === 'Manager') {
    return String(order.branchId || '') === String(staff.branchId || '');
  }
  return false;
};

const isRepRole = (role = '') => ['Agent', 'OnlineRep'].includes(role);

const canStaffViewOrder = (order, staff) => {
  if (!staff) return false;
  if (staff.role === 'Admin') return true;
  if (staff.role === 'Manager') {
    return true;
  }
  if (isRepRole(staff.role)) {
    return String(order.accountManagerId || '') === String(staff.staffId || '');
  }
  return true;
};

const applyStaffOrderScope = (query, staff) => {
  if (!staff) return query;
  if (staff.role === 'Manager') {
    query.branchId = staff.branchId;
  }
  if (isRepRole(staff.role)) {
    query.accountManagerId = staff.staffId;
  }
  return query;
};

const buildOrderItemFromProduct = async ({ productId, variationId = '', quantity = 1, paymentType = 'installment' }) => {
  const product = await Product.findById(productId);
  if (!product || product.isActive === false) {
    throw new Error('Product not found');
  }

  let variation = null;
  if (product.hasVariations) {
    if (!variationId) {
      throw new Error('Please select a product variation');
    }

    variation = product.variations.id(variationId);
    if (!variation || variation.isActive === false) {
      throw new Error('Product variation is not available');
    }
  }

  const basePrice = variation ? Number(variation.price || 0) : Number(product.price || 0);
  const selectedPrice = CartService.calculateCustomerSellingPrice(basePrice, paymentType);
  const normalizedQuantity = Number(quantity || 1);

  return {
    productId: product._id.toString(),
    variationId: variation ? variation._id.toString() : '',
    variationName: variation?.name || '',
    selectedOptions: variation ? getSelectedOptions(variation) : {},
    productName: product.name,
    quantity: normalizedQuantity,
    price: selectedPrice,
    subtotal: selectedPrice * normalizedQuantity
  };
};

const normalizePaymentAmount = (amount) => {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error('Valid payment amount is required');
  }
  return numericAmount;
};

const getObjectIdTimestamp = (id) => {
  if (!id) return null;
  if (typeof id.getTimestamp === 'function') {
    return id.getTimestamp();
  }
  const value = id.toString?.() || String(id);
  if (!/^[a-fA-F0-9]{24}$/.test(value)) {
    return null;
  }
  const timestamp = parseInt(value.substring(0, 8), 16) * 1000;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
};

const resolveOrderItemAddedAt = (item, fallbackDate) => {
  const fallback = fallbackDate ? new Date(fallbackDate) : null;
  const idTimestamp = getObjectIdTimestamp(item?._id);
  const addedAt = item?.addedAt ? new Date(item.addedAt) : null;

  if (idTimestamp && addedAt && addedAt.getTime() - idTimestamp.getTime() > 60 * 1000) {
    return idTimestamp;
  }
  if (addedAt && !Number.isNaN(addedAt.getTime())) {
    return addedAt;
  }
  if (idTimestamp) {
    return idTimestamp;
  }
  return fallback && !Number.isNaN(fallback.getTime()) ? fallback : undefined;
};

const getPrimaryCustomerAccount = async ({ accountNumber, customerId }) => {
  let account = null;
  if (accountNumber) {
    account = await Account.findOne({
      accountNumber,
      walletType: { $ne: 'sb_order_wallet' }
    });
  }
  if (!account && customerId) {
    account = await Account.findOne({
      customerId: customerId.toString(),
      walletType: { $ne: 'sb_order_wallet' }
    });
  }
  return account;
};

const buildSBOrderWalletAccountNumber = (customer) => `${customer.phone}-SBW`;

const ensureSBOrderWalletForCustomer = async ({ customerId, accountNumber }) => {
  let customer = null;
  if (customerId) {
    customer = await Customer.findById(customerId);
  }

  let account = null;
  if (customer?._id) {
    account = await Account.findOne({
      customerId: customer._id.toString(),
      walletType: 'sb_order_wallet'
    });
  }

  if (!account && accountNumber && String(accountNumber).endsWith('-SBW')) {
    account = await Account.findOne({
      accountNumber,
      walletType: 'sb_order_wallet'
    });
  }

  if (!account && customer) {
    account = await Account.create({
      customerId: customer._id.toString(),
      accountNumber: buildSBOrderWalletAccountNumber(customer),
      walletType: 'sb_order_wallet',
      createdBy: 'ECOMMERCE_SYSTEM',
      branchId: customer.branchId || '',
      accountManagerId: customer.accountManagerId || '',
      status: 'active',
      availableBalance: 0,
      ledgerBalance: 0
    });
  }

  if (!account) {
    throw new Error('Customer SB order wallet not found');
  }

  return account;
};

const getCustomerWalletAccount = async (order) => {
  return await ensureSBOrderWalletForCustomer({
    customerId: order.customerId,
    accountNumber: order.accountNumber
  });
};

const getWalletAccountForCustomer = async ({ customerId, accountNumber }) => {
  return await ensureSBOrderWalletForCustomer({ customerId, accountNumber });
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
      ],
      walletType: { $ne: 'sb_order_wallet' }
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

const ACTIVE_ORDER_STATUSES = ['pending', 'confirmed', 'paid', 'partially_paid', 'processing', 'shipped', 'delivered'];

const findActiveCustomerEcommerceOrder = async (customerId) => {
  return await EcommerceOrder.findOne({
    customerId: customerId.toString(),
    status: { $in: ACTIVE_ORDER_STATUSES }
  }).sort({ updatedAt: -1, createdAt: -1 });
};

const findActiveCustomerMultiItemSBAccount = async (customerId) => {
  return await SBAccount.findOne({
    customerId: customerId.toString(),
    $or: [
      { accountMode: 'multi_item' },
      { 'items.0': { $exists: true } }
    ]
  }).sort({ updatedAt: -1, createdAt: -1 });
};

const mapSBAccountItemsToOrderItems = (sbAccount) => (
  (sbAccount.items || []).map((item) => {
    const subtotal = Number(item.subtotal || item.price || 0);
    const paidAmount = Number(item.paidAmount || 0);
    return {
      _id: item._id,
      productId: item.productId || '',
      variationId: item.variationId || '',
      variationName: item.variationName || '',
      productName: item.productName,
      quantity: Number(item.quantity || 1),
      price: Number(item.price || 0),
      subtotal,
      paymentType: 'installment',
      addedAt: item.addedAt || sbAccount.createdAt,
      paidAmount,
      paymentStatus: paidAmount >= subtotal ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid',
      fulfillmentStatus: item.fulfillmentStatus || 'pending',
      fulfilledAt: item.fulfilledAt,
      fulfilledBy: item.fulfilledBy,
      costPrice: Number(item.costPrice || 0),
      costSubtotal: Number(item.costSubtotal || 0),
      profitAmount: Number(item.profitAmount || 0),
      profitReported: Boolean(item.profitReported),
      profitReportedAt: item.profitReportedAt
    };
  })
);

const createEcommerceOrderFromActiveSBAccount = async ({ sbAccount, customerId, accountNumber, ownership }) => {
  const existingLinkedOrder = await EcommerceOrder.findOne({
    customerId: customerId.toString(),
    SBAccountNumber: sbAccount.SBAccountNumber,
    status: { $ne: 'cancelled' }
  }).sort({ updatedAt: -1, createdAt: -1 });

  if (existingLinkedOrder) {
    return existingLinkedOrder;
  }

  const orderNumber = await generateOrderNumber();
  const totalAmount = Number(sbAccount.sellingPrice || 0);
  const order = new EcommerceOrder({
    orderNumber,
    customerId: customerId.toString(),
    accountNumber: accountNumber || sbAccount.accountNumber,
    SBAccountNumber: sbAccount.SBAccountNumber,
    items: mapSBAccountItemsToOrderItems(sbAccount),
    totalAmount,
    paymentType: 'installment',
    installmentPlan: calculateFlexibleInstallmentPlan(totalAmount),
    shippingAddress: 'Created in backoffice',
    shippingCity: '',
    shippingState: '',
    customerPhone: ownership?.customer?.phone || accountNumber || sbAccount.accountNumber,
    customerEmail: ownership?.customer?.email || '',
    notes: sbAccount.productDescription || '',
    branchId: ownership?.branchId || sbAccount.branchId,
    accountManagerId: ownership?.accountManagerId || sbAccount.accountManagerId || 'ECOMMERCE_SYSTEM',
    status: 'pending',
    paymentStatus: 'unpaid',
    ...(sbAccount.paymentReference ? { paymentReference: sbAccount.paymentReference } : {})
  });

  return await order.save();
};

const syncEcommerceOrderFromSBAccount = async (order) => {
  if (!order?.SBAccountNumber) {
    return order;
  }

  const sbAccount = await SBAccount.findOne({
    SBAccountNumber: order.SBAccountNumber,
    $or: [
      { accountMode: 'multi_item' },
      { 'items.0': { $exists: true } }
    ]
  });
  if (!sbAccount) {
    return order;
  }

  const totalAmount = Number(sbAccount.sellingPrice || 0);
  const hasActiveItems = Array.isArray(sbAccount.items) && sbAccount.items.some((item) => (
    !['delivered', 'completed'].includes(item.fulfillmentStatus || 'pending')
  ));
  order.items = mapSBAccountItemsToOrderItems(sbAccount);
  order.totalAmount = totalAmount;
  order.paymentType = 'installment';
  order.installmentPlan = order.installmentPlan || calculateFlexibleInstallmentPlan(0);
  order.installmentPlan.frequency = 'flexible';
  order.installmentPlan.duration = 0;
  order.installmentPlan.amountPerPeriod = 0;
  order.installmentPlan.remainingBalance = Math.max(0, totalAmount - Number(order.installmentPlan.totalPaid || 0));
  order.installmentPlan.creditBalance = Math.max(0, Number(order.installmentPlan.totalPaid || 0) - totalAmount);
  order.installmentPlan.nextPaymentDate = null;
  order.notes = sbAccount.productDescription || order.notes;
  order.branchId = sbAccount.branchId || order.branchId;
  order.accountManagerId = sbAccount.accountManagerId || order.accountManagerId;
  if ((order.status !== 'cancelled') && (!['delivered', 'completed'].includes(order.status || '') || hasActiveItems)) {
    order.status = order.installmentPlan.remainingBalance <= 0
      ? 'paid'
      : Number(order.installmentPlan.totalPaid || 0) > 0
        ? 'partially_paid'
        : 'pending';
  }
  order.paymentStatus = order.installmentPlan.remainingBalance <= 0
    ? 'paid'
    : Number(order.installmentPlan.totalPaid || 0) > 0
      ? 'partial'
      : 'unpaid';

  return await order.save();
};

const findOrCreateActiveCustomerEcommerceOrder = async ({ customerId, accountNumber, branchId }) => {
  const activeOrder = await findActiveCustomerEcommerceOrder(customerId);
  if (activeOrder) {
    return await syncEcommerceOrderFromSBAccount(activeOrder);
  }

  const activeSBAccount = await findActiveCustomerMultiItemSBAccount(customerId);
  if (!activeSBAccount) {
    return null;
  }

  const ownership = await resolveOrderOwnership({ customerId, accountNumber, branchId });
  return await createEcommerceOrderFromActiveSBAccount({
    sbAccount: activeSBAccount,
    customerId,
    accountNumber,
    ownership
  });
};

const getActiveCustomerEcommerceOrder = async (customerId) => {
  const order = await findActiveCustomerEcommerceOrder(customerId);
  if (order) {
    const syncedOrder = await syncEcommerceOrderFromSBAccount(order);
    return await decorateOrderProductAvailability(syncedOrder);
  }

  const activeSBAccount = await findActiveCustomerMultiItemSBAccount(customerId);
  if (!activeSBAccount) {
    return null;
  }

  return await buildOrderFromSBAccount(activeSBAccount);
};

const appendItemsToExistingOrder = async ({
  order,
  customerId,
  accountNumber,
  paymentType,
  shippingAddress,
  shippingCity,
  shippingState,
  customerPhone,
  customerEmail,
  notes,
  branchId,
  paymentReference,
  items,
  totalAmount,
  clearCustomerCart = false
}) => {
  if (!order) {
    throw new Error('Active order not found');
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('No product selected');
  }

  const ownership = await resolveOrderOwnership({ customerId, accountNumber, branchId });
  const newOrderItems = items.map((item) => ({
    ...(typeof item.toObject === 'function' ? item.toObject() : item),
    paymentType,
    addedAt: new Date(),
    paymentReference,
    paidAmount: 0,
    paymentStatus: 'unpaid',
    fulfillmentStatus: 'pending'
  }));

  newOrderItems.forEach((item) => order.items.push(item));
  order.totalAmount = Number(order.totalAmount || 0) + Number(totalAmount || 0);
  order.shippingAddress = shippingAddress || order.shippingAddress;
  order.shippingCity = shippingCity || order.shippingCity;
  order.shippingState = shippingState || order.shippingState;
  order.customerPhone = customerPhone || order.customerPhone;
  order.customerEmail = customerEmail || order.customerEmail;
  order.notes = notes || order.notes;
  order.branchId = ownership.branchId || order.branchId;
  order.accountManagerId = ownership.accountManagerId || order.accountManagerId;
  order.paymentType = 'installment';
  order.installmentPlan = order.installmentPlan || calculateFlexibleInstallmentPlan(0);
  order.installmentPlan.frequency = 'flexible';
  order.installmentPlan.duration = 0;
  order.installmentPlan.amountPerPeriod = 0;
  order.installmentPlan.remainingBalance = Math.max(
    0,
    Number(order.totalAmount || 0) - Number(order.installmentPlan.totalPaid || 0)
  );
  order.installmentPlan.creditBalance = Math.max(
    0,
    Number(order.installmentPlan.totalPaid || 0) - Number(order.totalAmount || 0)
  );
  order.installmentPlan.nextPaymentDate = null;
  if (paymentReference) {
    order.paymentReferences = order.paymentReferences || [];
    if (!order.paymentReferences.some((entry) => entry.reference === paymentReference)) {
      order.paymentReferences.push({
        reference: paymentReference,
        amount: 0,
        paymentType
      });
    }
  }

  if (order.installmentPlan.remainingBalance <= 0) {
    order.paymentStatus = 'paid';
    if (!['delivered', 'completed', 'cancelled'].includes(order.status)) {
      order.status = 'paid';
    }
  } else if (Number(order.installmentPlan.totalPaid || 0) > 0) {
    order.paymentStatus = 'partial';
    if (!['delivered', 'completed', 'cancelled'].includes(order.status)) {
      order.status = 'partially_paid';
    }
  } else {
    order.paymentStatus = 'unpaid';
    if (!['delivered', 'completed', 'cancelled'].includes(order.status)) {
      order.status = 'pending';
    }
  }

  let account = ownership.account || await getPrimaryCustomerAccount({ accountNumber, customerId });
  if (!account) {
    throw new Error('Customer wallet account not found');
  }
  await ensureOrderSBAccount({ order, customerId, account, ownership, paymentReference });
  const savedOrder = await order.save();
  await syncSBAccountItemsFromOrder(savedOrder);

  if (clearCustomerCart) {
    await Cart.findOneAndUpdate(
      { customerId },
      { $set: { items: [], totalAmount: 0, totalItems: 0 } }
    );
  }

  return savedOrder;
};

const addItemsToActiveOrder = async (orderData) => {
  const {
    customerId: rawCustomerId,
    accountNumber,
    paymentType = 'installment',
    shippingAddress,
    shippingCity,
    shippingState,
    customerPhone,
    customerEmail,
    notes,
    branchId,
    paymentReference,
    productId,
    variationId = '',
    quantity = 1
  } = orderData;

  const customerId = rawCustomerId ? rawCustomerId.toString() : rawCustomerId;
  const activeOrder = await findOrCreateActiveCustomerEcommerceOrder({ customerId, accountNumber, branchId });
  if (!activeOrder) {
    throw new Error('No active SB order found for this customer');
  }

  let items = [];
  let totalAmount = 0;
  let clearCustomerCart = false;

  if (productId) {
    const item = await CartService.getProductForPayment(productId, Number(quantity || 1), variationId || '', paymentType);
    items = [item];
    totalAmount = Number(item.subtotal || 0);
  } else {
    const cart = await Cart.findOne({ customerId });
    if (!cart || cart.items.length === 0) {
      throw new Error('Cart is empty');
    }
    const outOfMarketProductIds = await getOutOfMarketProductIds(cart.items);
    if (outOfMarketProductIds.size > 0) {
      throw new Error('One or more products in your cart are out of market. Remove them and select another product from SureBank stores.');
    }
    const pricedCart = await CartService.priceCartItemsForPaymentType(cart.items, paymentType);
    items = pricedCart.items;
    totalAmount = Number(pricedCart.totalAmount || 0);
    clearCustomerCart = true;
  }

  const savedOrder = await appendItemsToExistingOrder({
    order: activeOrder,
    customerId,
    accountNumber,
    paymentType,
    shippingAddress,
    shippingCity,
    shippingState,
    customerPhone,
    customerEmail,
    notes,
    branchId,
    paymentReference,
    items,
    totalAmount,
    clearCustomerCart
  });

  return await decorateOrderProductAvailability(savedOrder);
};

const syncSBAccountItemsFromOrder = async (order) => {
  if (!order?.SBAccountNumber) return null;

  const existingSBAccount = await SBAccount.findOne({ SBAccountNumber: order.SBAccountNumber }).lean();
  const existingItems = Array.isArray(existingSBAccount?.items) ? existingSBAccount.items : [];
  const syncedItems = await Promise.all((order.items || []).map(async (item) => {
    const existingItem = existingItems.find((sbItem) => (
      String(sbItem._id || '') === String(item._id || '') ||
      (
        String(sbItem.productId || '') === String(item.productId || '') &&
        String(sbItem.variationId || '') === String(item.variationId || '')
      )
    ));
    const existingCostSubtotal = Number(existingItem?.costSubtotal || 0);
    const existingCostPrice = Number(existingItem?.costPrice || 0);
    let costPrice = existingCostPrice;
    let costSubtotal = existingCostSubtotal;
    let profitAmount = Number(existingItem?.profitAmount || 0);
    let requiresCostApproval = existingItem?.requiresCostApproval;
    let costApprovedBy = existingItem?.costApprovedBy;
    let costApprovedAt = existingItem?.costApprovedAt;

    if (costSubtotal <= 0) {
      const product = item.productId ? await Product.findById(item.productId) : null;
      const calculated = calculateOrderItemProfit(product, item);
      costPrice = Number(calculated.costPrice || 0);
      costSubtotal = Number(calculated.costSubtotal || 0);
      profitAmount = Number(calculated.profitAmount || 0);
      requiresCostApproval = costPrice <= 0;
      costApprovedBy = costPrice > 0 ? (costApprovedBy || order.processedBy || 'ECOMMERCE_SYSTEM') : undefined;
      costApprovedAt = costPrice > 0 ? (costApprovedAt || new Date()) : undefined;
    }

    return {
      _id: item._id,
      productId: item.productId,
      variationId: item.variationId || '',
      productName: item.productName,
      productDescription: '',
      quantity: Number(item.quantity || 1),
      price: Number(item.price || 0),
      subtotal: Number(item.subtotal || 0),
      addedAt: resolveOrderItemAddedAt(item, order.createdAt),
      paidAmount: Number(item.paidAmount || 0),
      fulfillmentStatus: item.fulfillmentStatus || 'pending',
      fulfilledAt: item.fulfilledAt || existingItem?.fulfilledAt,
      fulfilledBy: item.fulfilledBy || existingItem?.fulfilledBy || '',
      costPrice,
      costSubtotal,
      profitAmount,
      requiresCostApproval: costSubtotal > 0 ? false : (requiresCostApproval !== undefined ? requiresCostApproval : costPrice <= 0),
      costApprovedBy,
      costApprovedAt,
      profitReported: Boolean(existingItem?.profitReported),
      profitReportedAt: existingItem?.profitReportedAt
    };
  }));

  return await SBAccount.findOneAndUpdate(
    { SBAccountNumber: order.SBAccountNumber },
    {
      $set: {
        productName: buildOrderProductSummary(order.items || [], order.orderNumber),
        productDescription: `Ecommerce product account for order ${order.orderNumber}`,
        sellingPrice: Number(order.totalAmount || 0),
        accountMode: 'multi_item',
        status: order.status === 'completed' ? 'sold' : 'booked',
        items: syncedItems,
        costPrice: syncedItems.reduce((sum, item) => sum + Number(item.costSubtotal || 0), 0),
        profit: syncedItems.reduce((sum, item) => sum + Number(item.profitAmount || 0), 0)
      }
    },
    { new: true }
  );
};

const ensureOrderSBAccount = async ({ order, customerId, account, ownership, paymentReference }) => {
  if (order.SBAccountNumber) {
    return await syncSBAccountItemsFromOrder(order);
  }

  const currentDate = new Date();
  const startDate = formatTransactionDate(currentDate);
  const SBAccountNumber = await generateUniqueAccountNumber('SBA');
  const sbAccount = new SBAccount({
    customerId,
    accountNumber: account.accountNumber,
    SBAccountNumber,
    createdBy: 'ECOMMERCE_SYSTEM',
    productName: buildOrderProductSummary(order.items || [], order.orderNumber),
    productDescription: `Ecommerce product account for order ${order.orderNumber}`,
    accountManagerId: ownership.accountManagerId,
    paymentReference,
    branchId: ownership.branchId,
    status: 'booked',
    accountMode: 'multi_item',
    startDate,
    sellingPrice: Number(order.totalAmount || 0),
    items: (order.items || []).map((item) => ({
      productId: item.productId,
      variationId: item.variationId || '',
      productName: item.productName,
      productDescription: '',
      quantity: Number(item.quantity || 1),
      price: Number(item.price || 0),
      subtotal: Number(item.subtotal || 0),
      addedAt: resolveOrderItemAddedAt(item, order.createdAt),
      paidAmount: Number(item.paidAmount || 0),
      fulfillmentStatus: item.fulfillmentStatus || 'pending'
    })),
    costPrice: 0,
    balance: 0,
    profit: 0
  });

  await sbAccount.save();
  order.SBAccountNumber = SBAccountNumber;
  return sbAccount;
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
  const outOfMarketProductIds = await getOutOfMarketProductIds(cart.items);
  if (outOfMarketProductIds.size > 0) {
    throw new Error('One or more products in your cart are out of market. Remove them and select another product from SureBank stores.');
  }

  // Note: Stock check removed - orders can be placed regardless of stock
  // Stock will be managed separately by admin

  const pricedCart = await CartService.priceCartItemsForPaymentType(cart.items, paymentType);
  const newOrderItems = pricedCart.items.map((item) => ({
    ...(typeof item.toObject === 'function' ? item.toObject() : item),
    paymentType,
    addedAt: new Date(),
    paymentReference,
    paidAmount: 0,
    paymentStatus: 'unpaid',
    fulfillmentStatus: 'pending'
  }));

  const activeOrder = await findOrCreateActiveCustomerEcommerceOrder({ customerId, accountNumber, branchId });
  if (activeOrder) {
    newOrderItems.forEach((item) => activeOrder.items.push(item));
    activeOrder.totalAmount = Number(activeOrder.totalAmount || 0) + Number(pricedCart.totalAmount || 0);
    activeOrder.shippingAddress = shippingAddress || activeOrder.shippingAddress;
    activeOrder.shippingCity = shippingCity || activeOrder.shippingCity;
    activeOrder.shippingState = shippingState || activeOrder.shippingState;
    activeOrder.customerPhone = customerPhone || activeOrder.customerPhone;
    activeOrder.customerEmail = customerEmail || activeOrder.customerEmail;
    activeOrder.notes = notes || activeOrder.notes;
    activeOrder.branchId = ownership.branchId || activeOrder.branchId;
    activeOrder.accountManagerId = ownership.accountManagerId || activeOrder.accountManagerId;
    activeOrder.paymentType = 'installment';
    activeOrder.installmentPlan = activeOrder.installmentPlan || calculateFlexibleInstallmentPlan(0);
    activeOrder.installmentPlan.frequency = 'flexible';
    activeOrder.installmentPlan.duration = 0;
    activeOrder.installmentPlan.amountPerPeriod = 0;
    activeOrder.installmentPlan.remainingBalance = Math.max(
      0,
      Number(activeOrder.totalAmount || 0) - Number(activeOrder.installmentPlan.totalPaid || 0)
    );
    activeOrder.installmentPlan.creditBalance = Math.max(
      0,
      Number(activeOrder.installmentPlan.totalPaid || 0) - Number(activeOrder.totalAmount || 0)
    );
    activeOrder.installmentPlan.nextPaymentDate = null;
    if (paymentReference) {
      activeOrder.paymentReferences = activeOrder.paymentReferences || [];
      if (!activeOrder.paymentReferences.some((entry) => entry.reference === paymentReference)) {
        activeOrder.paymentReferences.push({
          reference: paymentReference,
          amount: 0,
          paymentType
        });
      }
    }

    if (activeOrder.installmentPlan.remainingBalance <= 0) {
      activeOrder.paymentStatus = 'paid';
      if (!['delivered', 'completed', 'cancelled'].includes(activeOrder.status)) {
        activeOrder.status = 'paid';
      }
    } else if (Number(activeOrder.installmentPlan.totalPaid || 0) > 0) {
      activeOrder.paymentStatus = 'partial';
      if (!['delivered', 'completed', 'cancelled'].includes(activeOrder.status)) {
        activeOrder.status = 'partially_paid';
      }
    } else {
      activeOrder.paymentStatus = 'unpaid';
      if (!['delivered', 'completed', 'cancelled'].includes(activeOrder.status)) {
        activeOrder.status = 'pending';
      }
    }

    let account = ownership.account || await getPrimaryCustomerAccount({ accountNumber, customerId });
    if (!account) {
      throw new Error('Customer wallet account not found');
    }
    await ensureOrderSBAccount({ order: activeOrder, customerId, account, ownership, paymentReference });
    const savedActiveOrder = await activeOrder.save();
    await syncSBAccountItemsFromOrder(savedActiveOrder);

    await Cart.findOneAndUpdate(
      { customerId },
      { $set: { items: [], totalAmount: 0, totalItems: 0 } }
    );

    return savedActiveOrder;
  }

  const orderNumber = await generateOrderNumber();

  let order = {
    orderNumber,
    customerId,
    accountNumber,
    items: newOrderItems,
    totalAmount: pricedCart.totalAmount,
    paymentType: 'installment',
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

  // Handle the customer's single ecommerce SB order as a flexible installment account.
  if (true) {
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
        pricedCart.totalAmount,
        installmentFrequency,
        installmentDuration
      );
    } else {
      order.installmentPlan = calculateFlexibleInstallmentPlan(pricedCart.totalAmount);
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
    let account = ownership.account || await getPrimaryCustomerAccount({ accountNumber, customerId });

    // Fallback: try to find by customerId if accountNumber lookup fails
    if (!account) {
      console.log('Account not found by accountNumber, trying customerId:', customerId);
      account = await getPrimaryCustomerAccount({ customerId });
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
                productDescription: `Ecommerce product account for order ${orderNumber}`,
                accountManagerId: ownership.accountManagerId,
                paymentReference,
                branchId: ownership.branchId,
                status: 'booked',
                accountMode: 'multi_item',
                startDate,
                sellingPrice: pricedCart.totalAmount,
                items: newOrderItems.map((item) => ({
                  productId: item.productId,
                  variationId: item.variationId || '',
                  productName: item.productName,
                  productDescription: '',
                  quantity: Number(item.quantity || 1),
                  price: Number(item.price || 0),
                  subtotal: Number(item.subtotal || 0),
                  paidAmount: Number(item.paidAmount || 0),
                  fulfillmentStatus: item.fulfillmentStatus || 'pending'
                })),
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

        if (existingSBAccount && existingSBAccount.accountMode !== 'multi_item') {
          existingSBAccount.accountMode = 'multi_item';
          await existingSBAccount.save();
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
          productDescription: `Ecommerce product account for order ${orderNumber}`,
          accountManagerId: ownership.accountManagerId,
          branchId: ownership.branchId,
          status: 'booked',
          accountMode: 'multi_item',
          startDate,
          sellingPrice: pricedCart.totalAmount,
          items: newOrderItems.map((item) => ({
            productId: item.productId,
            variationId: item.variationId || '',
            productName: item.productName,
            productDescription: item.productDescription || '',
            quantity: Number(item.quantity || 1),
            price: Number(item.price || 0),
            subtotal: Number(item.subtotal || 0),
            addedAt: item.addedAt || new Date()
          })),
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

const getOrderById = async (orderId, staff = null) => {
  const order = await EcommerceOrder.findById(orderId)
    .populate('customerId', 'firstName lastName phone address');
  if (!order) {
    throw new Error('Order not found');
  }
  if (staff && !canStaffViewOrder(order, staff)) {
    const error = new Error('You are not allowed to view this order');
    error.statusCode = 403;
    throw error;
  }
  const syncedOrder = await syncEcommerceOrderFromSBAccount(order);
  const populatedOrder = await EcommerceOrder.findById(syncedOrder._id)
    .populate('customerId', 'firstName lastName phone address');
  return await decorateOrderProductAvailability(populatedOrder || syncedOrder);
};

const getOrderByNumber = async (orderNumber) => {
  console.log('getOrderByNumber called with:', orderNumber);
  const order = await EcommerceOrder.findOne({ orderNumber });
  if (order) {
    console.log('Found order - status:', order.status, 'paymentStatus:', order.paymentStatus);
    const syncedOrder = await syncEcommerceOrderFromSBAccount(order);
    return await decorateOrderProductAvailability(syncedOrder);
  }

  const sbAccount = await SBAccount.findOne({ SBAccountNumber: orderNumber });
  if (!sbAccount) {
    throw new Error('Order not found');
  }

  return await buildOrderFromSBAccount(sbAccount);
};

const getCustomerOrders = async (customerId) => {
  console.log('getCustomerOrders called with customerId:', customerId, 'type:', typeof customerId);
  const [rawOrders, sbAccounts] = await Promise.all([
    EcommerceOrder.find({ customerId }).sort({ createdAt: -1 }),
    SBAccount.find({ customerId }).sort({ createdAt: -1 })
  ]);
  const orders = await Promise.all(rawOrders.map((order) => syncEcommerceOrderFromSBAccount(order)));
  const orderSBAccountNumbers = new Set(
    orders
      .map((order) => order.SBAccountNumber)
      .filter(Boolean)
  );
  const standaloneSBOrders = await Promise.all(
    sbAccounts
      .filter((sbAccount) => !orderSBAccountNumbers.has(sbAccount.SBAccountNumber))
      .map((sbAccount) => buildOrderFromSBAccount(sbAccount))
  );
  const combinedOrders = [...orders, ...standaloneSBOrders].sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  );
  const decoratedOrders = await Promise.all(
    combinedOrders.map((order) => decorateOrderProductAvailability(order))
  );

  console.log('Found', orders.length, 'orders for customer');
  if (decoratedOrders.length > 0) {
    console.log('First order status:', decoratedOrders[0].status, 'paymentStatus:', decoratedOrders[0].paymentStatus);
  }
  return decoratedOrders;
};

const findSBAccountReplacementItemIndex = (sbAccount, itemId) => {
  const decodedItemId = decodeURIComponent(String(itemId || ''));
  const numericItemIndex = Number(decodedItemId);
  if (Number.isInteger(numericItemIndex) && numericItemIndex >= 0 && numericItemIndex < (sbAccount.items || []).length) {
    return numericItemIndex;
  }

  return (sbAccount.items || []).findIndex((item, index) => (
    String(item._id || '') === decodedItemId ||
    String(item.productId || '') === decodedItemId ||
    `${sbAccount._id}-item-${item.productId || index}` === decodedItemId
  ));
};

const replaceSBAccountOrderItem = async ({
  orderNumber,
  customerId,
  itemId,
  productId,
  variationId = '',
  actorId = ''
}) => {
  const sbAccountQuery = { SBAccountNumber: orderNumber };
  if (customerId) {
    sbAccountQuery.customerId = customerId.toString();
  }
  const sbAccount = await SBAccount.findOne(sbAccountQuery);
  if (!sbAccount) {
    throw new Error('Order not found');
  }

  if (['sold', 'cancelled'].includes(sbAccount.status)) {
    throw new Error('This order can no longer be edited');
  }
  if (!Array.isArray(sbAccount.items) || sbAccount.items.length === 0) {
    throw new Error('Order item not found');
  }

  const itemIndex = findSBAccountReplacementItemIndex(sbAccount, itemId);
  if (itemIndex === -1) {
    throw new Error('Order item not found');
  }

  const existingItem = sbAccount.items[itemIndex];
  if (['delivered', 'completed'].includes(existingItem.fulfillmentStatus || 'pending')) {
    throw new Error('This product has already been delivered and cannot be changed');
  }

  const replacementItem = await buildOrderItemFromProduct({
    productId,
    variationId,
    quantity: existingItem.quantity
  });
  const actor = actorId || customerId?.toString() || sbAccount.customerId?.toString() || 'ECOMMERCE_SYSTEM';
  const orderLike = buildOrderLikeFromSBAccount(sbAccount);
  const reversedAmount = await reverseChangedOrderItemPayment(orderLike, existingItem, actor);

  sbAccount.items[itemIndex].productId = replacementItem.productId;
  sbAccount.items[itemIndex].variationId = replacementItem.variationId || '';
  sbAccount.items[itemIndex].productName = replacementItem.variationName
    ? `${replacementItem.productName} - ${replacementItem.variationName}`
    : replacementItem.productName;
  sbAccount.items[itemIndex].productDescription = '';
  sbAccount.items[itemIndex].quantity = Number(replacementItem.quantity || 1);
  sbAccount.items[itemIndex].price = Number(replacementItem.price || 0);
  sbAccount.items[itemIndex].subtotal = Number(replacementItem.subtotal || 0);
  sbAccount.items[itemIndex].addedAt = existingItem.addedAt || sbAccount.createdAt || new Date();
  sbAccount.items[itemIndex].paidAmount = 0;
  sbAccount.items[itemIndex].fulfillmentStatus = 'pending';
  sbAccount.items[itemIndex].fulfilledAt = undefined;
  sbAccount.items[itemIndex].fulfilledBy = undefined;
  sbAccount.items[itemIndex].costPrice = 0;
  sbAccount.items[itemIndex].costSubtotal = 0;
  sbAccount.items[itemIndex].profitAmount = 0;
  sbAccount.items[itemIndex].profitReported = false;
  sbAccount.items[itemIndex].profitReportedAt = undefined;
  sbAccount.items[itemIndex].requiresCostApproval = true;
  sbAccount.items[itemIndex].costApprovedBy = undefined;
  sbAccount.items[itemIndex].costApprovedAt = undefined;

  sbAccount.accountMode = 'multi_item';
  sbAccount.productName = buildOrderProductSummary(sbAccount.items, sbAccount.SBAccountNumber);
  sbAccount.productDescription = sbAccount.items
    .map((item) => item.productDescription)
    .filter(Boolean)
    .join(' | ') || sbAccount.productName;
  sbAccount.sellingPrice = sbAccount.items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  sbAccount.costPrice = sbAccount.items.reduce((sum, item) => sum + Number(item.costSubtotal || 0), 0);
  sbAccount.profit = sbAccount.items.reduce((sum, item) => sum + Number(item.profitAmount || 0), 0);
  if (sbAccount.status === 'sold') {
    sbAccount.status = 'booked';
  }

  const autoPayment = await payReplacementItemFromWalletIfFullyFunded(orderLike, sbAccount.items[itemIndex], actor);
  if (autoPayment.paid) {
    sbAccount.items[itemIndex].paidAmount = Number(sbAccount.items[itemIndex].subtotal || 0);
  }

  const savedSBAccount = await sbAccount.save();
  const responseOrder = await buildOrderFromSBAccount(savedSBAccount);
  responseOrder.productChangePayment = {
    reversedAmount,
    paidAmount: autoPayment.paid ? autoPayment.amount : 0,
    paymentStatus: autoPayment.paid ? 'paid' : 'unpaid'
  };
  return responseOrder;
};

const replaceInstallmentOrderItem = async ({
  orderNumber,
  customerId,
  itemId,
  productId,
  variationId = '',
  actorId = ''
}) => {
  const orderQuery = { orderNumber };
  if (customerId) {
    orderQuery.customerId = customerId.toString();
  }
  const order = await EcommerceOrder.findOne(orderQuery);
  if (!order) {
    return await replaceSBAccountOrderItem({
      orderNumber,
      customerId,
      itemId,
      productId,
      variationId,
      actorId
    });
  }

  if (['delivered', 'completed', 'shipped', 'cancelled'].includes(order.status)) {
    throw new Error('This order can no longer be edited');
  }

  const decodedItemId = decodeURIComponent(String(itemId || ''));
  const numericItemIndex = Number(decodedItemId);
  const itemIndex = Number.isInteger(numericItemIndex) && numericItemIndex >= 0 && numericItemIndex < (order.items || []).length
    ? numericItemIndex
    : order.items.findIndex((item) => String(item._id || '') === decodedItemId);
  if (itemIndex === -1) {
    throw new Error('Order item not found');
  }

  const existingItem = order.items[itemIndex];
  if (['delivered', 'completed'].includes(existingItem.fulfillmentStatus || 'pending')) {
    throw new Error('This product has already been delivered and cannot be changed');
  }

  const replacementItem = await buildOrderItemFromProduct({
    productId,
    variationId,
    quantity: existingItem.quantity
  });
  const actor = actorId || customerId?.toString() || order.customerId?.toString() || 'ECOMMERCE_SYSTEM';
  const reversedAmount = await reverseChangedOrderItemPayment(order, existingItem, actor);
  const autoPayment = await payReplacementItemFromWalletIfFullyFunded(order, replacementItem, actor);
  replacementItem.addedAt = existingItem.addedAt || order.createdAt || new Date();
  replacementItem.paidAmount = autoPayment.paid ? Number(replacementItem.subtotal || 0) : 0;
  replacementItem.paymentStatus = autoPayment.paid ? 'paid' : 'unpaid';
  replacementItem.fulfillmentStatus = 'pending';

  order.items.set(itemIndex, replacementItem);
  const nextTotalAmount = order.items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  if (!order.installmentPlan) {
    order.installmentPlan = {};
  }
  const totalPaid = order.items.reduce((sum, item) => sum + Number(item.paidAmount || 0), 0);

  const nextRemainingBalance = Math.max(0, nextTotalAmount - totalPaid);

  order.totalAmount = nextTotalAmount;
  order.installmentPlan.totalPaid = totalPaid;
  order.installmentPlan.remainingBalance = nextRemainingBalance;
  order.installmentPlan.creditBalance = Math.max(0, totalPaid - nextTotalAmount);
  order.installmentPlan.amountPerPeriod = 0;
  order.installmentPlan.duration = 0;
  order.installmentPlan.frequency = 'flexible';
  order.installmentPlan.nextPaymentDate = null;

  if (nextRemainingBalance === 0) {
    order.paymentStatus = 'paid';
    order.status = 'paid';
  } else {
    order.paymentStatus = totalPaid > 0 ? 'partial' : 'unpaid';
    order.status = totalPaid > 0 ? 'partially_paid' : order.status;
  }

  const savedOrder = await order.save();
  await syncSBAccountItemsFromOrder(savedOrder);
  savedOrder.productChangePayment = {
    reversedAmount,
    paidAmount: autoPayment.paid ? autoPayment.amount : 0,
    paymentStatus: autoPayment.paid ? 'paid' : 'unpaid'
  };
  return savedOrder;
};

const replaceInstallmentOrderItemBySBAccount = async ({
  SBAccountNumber,
  itemId,
  productId,
  variationId = '',
  actorId = ''
}) => {
  if (!SBAccountNumber) {
    throw new Error('SB account number is required');
  }

  const linkedOrder = await EcommerceOrder.findOne({ SBAccountNumber });
  if (linkedOrder) {
    return await replaceInstallmentOrderItem({
      orderNumber: linkedOrder.orderNumber,
      itemId,
      productId,
      variationId,
      actorId
    });
  }

  return await replaceSBAccountOrderItem({
    orderNumber: SBAccountNumber,
    itemId,
    productId,
    variationId,
    actorId
  });
};

const getAllOrders = async (filters = {}, staff = null) => {
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

  applyStaffOrderScope(query, staff);

  const orders = await EcommerceOrder.find(query).sort({ createdAt: -1 });
  return await Promise.all(orders.map((order) => decorateOrderProductAvailability(order)));
};

const isActiveUncompletedOrder = (order) =>
  order.status !== 'completed' && order.status !== 'cancelled';

const getProductDemandSummary = async () => {
  const orders = await EcommerceOrder.find({
    status: { $nin: ['completed', 'cancelled'] }
  }).select('customerId items paymentStatus status').lean();

  const demandByProduct = new Map();

  orders.forEach((order) => {
    (order.items || []).forEach((item) => {
      const productId = item.productId?.toString();
      if (!productId) return;

      const current = demandByProduct.get(productId) || {
        productId,
        activeOrderCount: 0,
        activeCustomerCount: 0,
        totalQuantity: 0,
        unpaidCount: 0,
        partialCount: 0,
        paidCount: 0,
        customerIds: new Set(),
        orderIds: new Set()
      };

      current.orderIds.add(order._id.toString());
      if (order.customerId) current.customerIds.add(order.customerId.toString());
      current.totalQuantity += Number(item.quantity || 0);
      if (order.paymentStatus === 'paid') current.paidCount += 1;
      else if (order.paymentStatus === 'partial') current.partialCount += 1;
      else current.unpaidCount += 1;

      demandByProduct.set(productId, current);
    });
  });

  return Array.from(demandByProduct.values()).map((item) => ({
    productId: item.productId,
    activeOrderCount: item.orderIds.size,
    activeCustomerCount: item.customerIds.size,
    totalQuantity: item.totalQuantity,
    unpaidCount: item.unpaidCount,
    partialCount: item.partialCount,
    paidCount: item.paidCount
  }));
};

const getProductSalesSummary = async () => {
  const soldByProduct = new Map();
  const addSoldQuantity = (productId, quantity) => {
    if (!productId) return;
    const key = productId.toString();
    const current = soldByProduct.get(key) || {
      productId: key,
      totalSoldQuantity: 0
    };
    current.totalSoldQuantity += Number(quantity || 0);
    soldByProduct.set(key, current);
  };

  const deliveredOrders = await EcommerceOrder.find({
    'items.fulfillmentStatus': { $in: ['delivered', 'completed'] }
  }).select('items').lean();

  deliveredOrders.forEach((order) => {
    (order.items || []).forEach((item) => {
      if (['delivered', 'completed'].includes(item.fulfillmentStatus)) {
        addSoldQuantity(item.productId, item.quantity);
      }
    });
  });

  const ecommerceSBAccountNumbers = await EcommerceOrder.distinct('SBAccountNumber', {
    SBAccountNumber: { $nin: [null, ''] }
  });
  const deliveredSBAccounts = await SBAccount.find({
    SBAccountNumber: { $nin: ecommerceSBAccountNumbers },
    'items.fulfillmentStatus': { $in: ['delivered', 'completed'] }
  }).select('items').lean();

  deliveredSBAccounts.forEach((account) => {
    (account.items || []).forEach((item) => {
      if (['delivered', 'completed'].includes(item.fulfillmentStatus)) {
        addSoldQuantity(item.productId, item.quantity);
      }
    });
  });

  return Array.from(soldByProduct.values());
};

const getProductDemandDetail = async (productId) => {
  const orders = await EcommerceOrder.find({
    status: { $nin: ['completed', 'cancelled'] },
    'items.productId': productId
  })
    .populate('customerId', 'firstName lastName phone')
    .sort({ createdAt: -1 });

  const entries = [];
  const customerIds = new Set();
  let totalQuantity = 0;

  orders.forEach((order) => {
    if (!isActiveUncompletedOrder(order)) return;

    (order.items || [])
      .filter((item) => item.productId === productId)
      .forEach((item) => {
        const customer = order.customerId;
        const customerName = customer?.firstName || customer?.lastName
          ? `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim()
          : 'N/A';
        const customerPhone = customer?.phone || order.customerPhone || '';

        totalQuantity += Number(item.quantity || 0);
        if (customer?._id) customerIds.add(customer._id.toString());

        entries.push({
          orderId: order._id,
          orderNumber: order.orderNumber,
          SBAccountNumber: order.SBAccountNumber || '',
          customerId: customer?._id || order.customerId,
          customerName,
          customerPhone,
          quantity: Number(item.quantity || 0),
          unitPrice: Number(item.price || 0),
          subtotal: Number(item.subtotal || 0),
          variationId: item.variationId || '',
          variationName: item.variationName || '',
          selectedOptions: item.selectedOptions instanceof Map
            ? Object.fromEntries(item.selectedOptions)
            : item.selectedOptions || {},
          paymentStatus: order.paymentStatus,
          orderStatus: order.status,
          totalAmount: Number(order.totalAmount || 0),
          totalPaid: Number(order.installmentPlan?.totalPaid || 0),
          remainingBalance: Number(order.installmentPlan?.remainingBalance || 0),
          createdAt: order.createdAt
        });
      });
  });

  return {
    productId,
    activeOrderCount: orders.length,
    activeCustomerCount: customerIds.size,
    totalQuantity,
    entries
  };
};

const updateOrderStatus = async (orderId, status, staff) => {
  const order = await EcommerceOrder.findById(orderId);
  if (!order) {
    throw new Error('Order not found');
  }
  if (!canStaffUpdateOrderStatus(order, staff)) {
    throw new Error('You are not allowed to update this order status');
  }
  if (staff?.role === 'Manager' && status !== 'delivered') {
    throw new Error('Managers can only mark ecommerce orders as delivered');
  }
  if (status === 'completed' && order.paymentStatus !== 'paid') {
    throw new Error('Only fully paid orders can be marked completed');
  }

  const previousStatus = order.status;

  // If changing to 'delivered' or 'completed', reduce stock
  if ((status === 'delivered' || status === 'completed') &&
      previousStatus !== 'delivered' && previousStatus !== 'completed') {
    for (const item of order.items) {
      if (!['delivered', 'completed'].includes(item.fulfillmentStatus)) {
        await assertOrderItemBranchStockAvailable(order, item, staff);
      }
    }
    for (const item of order.items) {
      if (['delivered', 'completed'].includes(item.fulfillmentStatus)) {
        continue;
      }
      await decreaseStockThenSettleOrderItem(order, item, staff);
      item.fulfillmentStatus = status === 'completed' ? 'completed' : 'delivered';
      item.fulfilledAt = new Date();
      item.fulfilledBy = staff?.staffId || '';
      await recordEcommerceOrderItemIncome(order, item, staff);
    }
  }

  order.status = status;
  order.processedBy = staff?.staffId;
  await order.save();

  return await decorateOrderProductAvailability(order);
};

const canStaffFulfillOrderItem = (order, staff) => {
  if (!staff) return false;
  if (staff.role === 'Admin') return true;
  if (staff.role === 'Manager') {
    return true;
  }
  return false;
};

const updateOrderItemFulfillment = async (orderId, itemId, status, staff) => {
  const order = await EcommerceOrder.findById(orderId);
  if (!order) {
    throw new Error('Order not found');
  }
  if (!canStaffFulfillOrderItem(order, staff)) {
    throw new Error('You are not allowed to fulfill this order item');
  }
  if (!['delivered', 'completed'].includes(status)) {
    throw new Error('Invalid item fulfillment status');
  }
  if (staff?.role === 'Manager' && status !== 'delivered') {
    throw new Error('Managers can only mark items as delivered');
  }

  const item = order.items.id(itemId);
  if (!item) {
    throw new Error('Order item not found');
  }
  if (item.fulfillmentStatus === 'completed') {
    throw new Error('This item has already been completed');
  }

  const previousStatus = item.fulfillmentStatus || 'pending';
  if (status === 'delivered' && !['delivered', 'completed'].includes(previousStatus)) {
    await decreaseStockThenSettleOrderItem(order, item, staff);
  }

  item.fulfillmentStatus = status;
  item.fulfilledAt = new Date();
  item.fulfilledBy = staff?.staffId || '';
  await markOrderItemWalletPurchaseDelivered(order, item);
  await recordEcommerceOrderItemIncome(order, item, staff);

  if (order.items.every((orderItem) => orderItem.fulfillmentStatus === 'completed')) {
    order.status = 'completed';
  } else if (order.items.every((orderItem) => ['delivered', 'completed'].includes(orderItem.fulfillmentStatus))) {
    order.status = 'delivered';
  }

  order.processedBy = staff?.staffId;
  await order.save();
  await syncSBAccountItemsFromOrder(order);

  return await decorateOrderProductAvailability(order);
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
  const orderSBAccount = order.SBAccountNumber
    ? await SBAccount.findOne({ SBAccountNumber: order.SBAccountNumber })
    : null;
  if (!orderSBAccount) {
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

  if (orderSBAccount.accountMode === 'multi_item') {
    return {
      walletAccount: updatedWalletAccount,
      order,
      sbAccount: orderSBAccount
    };
  }

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
  const account = await ensureSBOrderWalletForCustomer({
    customerId: sbAccount.customerId,
    accountNumber: sbAccount.accountNumber
  });
  if (!account) {
    throw new Error('Customer SB order wallet not found');
  }

  const newBalance = sbAccount.balance - amount;
  if (newBalance < 0) {
    throw new Error(`Insufficient SB Account balance. Available: ₦${Number(sbAccount.balance || 0).toLocaleString()}, Required: ₦${amount.toLocaleString()}`);
  }

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
    narration: options.narration || `E-Commerce Installment Payment - Order: ${order.orderNumber}`,
    package: "SB",
    direction: "Debit",
  });

  // Update Account ledger balance
  if (!options.skipAccountLedgerUpdate) {
    await Account.findOneAndUpdate(
      { _id: account._id },
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

const creditWalletForOrderPayment = async (order, amount, transactionRef, options = {}) => {
  const account = await getCustomerWalletAccount(order);
  const formattedDate = formatTransactionDate();
  const newAvailableBalance = Number(account.availableBalance || 0) + amount;
  const newLedgerBalance = Number(account.ledgerBalance || 0) + amount;
  const customerActor = order.customerId?.toString() || account.customerId;
  const transactionOwner = options.transactionOwnerId || customerActor;
  const reportingActor = getReportingStaffId(account.accountManagerId, options.createdBy || transactionOwner);
  const productName = String(options.productName || '').trim();
  const creditNarration = options.narration ||
    (productName
      ? `Reversed payment for changed product: ${productName}`
      : `Order Payment to Wallet - Order: ${order.orderNumber} - Ref: ${transactionRef}`);

  await AccountTransaction.DepositTransactionAccount({
    createdBy: reportingActor,
    transactionOwnerId: transactionOwner,
    customerId: account.customerId,
    amount,
    balance: newAvailableBalance,
    branchId: account.branchId,
    accountManagerId: account.accountManagerId || 'ECOMMERCE_SYSTEM',
    accountNumber: account.accountNumber,
    accountTypeId: account._id,
    date: formattedDate,
    narration: creditNarration,
    transactionRef,
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

const debitWalletForOrderPayment = async (order, amount, transactionRef, options = {}) => {
  const account = await getCustomerWalletAccount(order);
  const formattedDate = formatTransactionDate();
  const newAvailableBalance = Number(account.availableBalance || 0) - amount;
  const newLedgerBalance = Number(account.ledgerBalance || 0) - amount;

  if (newAvailableBalance < 0) {
    throw new Error(`Insufficient wallet balance. Available: ₦${Number(account.availableBalance || 0).toLocaleString()}, Required: ₦${amount.toLocaleString()}`);
  }

  const customerActor = order.customerId?.toString() || account.customerId;
  const reportingActor = getReportingStaffId(account.accountManagerId, customerActor);
  const productName = String(options.productName || '').trim();
  const debitNarration = productName
    ? `Debited from wallet for ${productName}`
    : order.paymentType === 'installment'
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
    transactionRef,
    package: "Wallet",
    direction: productName ? "Bought" : "Debit",
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

const createOrderAndPayFromWallet = async ({
  customerId,
  accountNumber,
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
  paymentAmount
}) => {
  const normalizedPaymentAmount = normalizePaymentAmount(paymentAmount);
  const walletAccount = await getWalletAccountForCustomer({
    customerId,
    accountNumber
  });

  if (Number(walletAccount.availableBalance || 0) < normalizedPaymentAmount) {
    throw new Error(
      `Insufficient wallet balance. Available: ₦${Number(walletAccount.availableBalance || 0).toLocaleString()}, Required: ₦${normalizedPaymentAmount.toLocaleString()}`
    );
  }

  const transactionRef = `WALLET_ORDER_${Date.now()}`;
  const order = await createOrder({
    customerId,
    accountNumber,
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
    paymentReference: transactionRef
  });

  await recordFlexibleInstallmentOrderPayment(
    order._id,
    normalizedPaymentAmount,
    transactionRef,
    customerId.toString(),
    { creditWallet: false }
  );

  return await EcommerceOrder.findById(order._id);
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
    transactionRef,
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
  const shouldUseSBOrderWalletOnly = sbAccount.accountMode === 'multi_item';
  const nextSBBalance = shouldUseSBOrderWalletOnly
    ? Number(sbAccount.balance || 0)
    : Number(sbAccount.balance || 0) + amount;

  await AccountTransaction.DepositTransactionAccount({
    createdBy: reportingActor,
    transactionOwnerId: source,
    customerId: sbAccount.customerId,
    amount,
    balance: nextSBBalance,
    branchId: sbAccount.branchId || 'ECOMMERCE',
    accountManagerId: effectiveAccountManagerId,
    accountNumber: sbAccount.accountNumber,
    accountTypeId: sbAccount._id,
    date: formattedDate,
    narration: shouldUseSBOrderWalletOnly
      ? `SB Order Wallet payment reserved for Order: ${order.orderNumber} - Ref: ${transactionRef}`
      : `Wallet Transfer to SB Account - Order: ${order.orderNumber} - Ref: ${transactionRef}`,
    transactionRef,
    package: "SB",
    direction: "Credit",
    excludeFromStaffStats: true,
  });

  return await SBAccount.findByIdAndUpdate(
    sbAccount._id,
    { balance: nextSBBalance },
    { new: true }
  );
};

const buildOrderLikeFromSBAccount = (sbAccount) => ({
  _id: sbAccount._id,
  orderNumber: sbAccount.SBAccountNumber,
  customerId: sbAccount.customerId,
  accountNumber: sbAccount.accountNumber,
  SBAccountNumber: sbAccount.SBAccountNumber,
  branchId: sbAccount.branchId,
  accountManagerId: sbAccount.accountManagerId,
  paymentType: 'installment'
});

const reverseSBAccountReservationForChangedItem = async (order, amount, transactionRef, source, productName = '') => {
  if (!order?.SBAccountNumber || amount <= 0) {
    return null;
  }

  const sbAccount = await SBAccount.findOne({ SBAccountNumber: order.SBAccountNumber });
  if (!sbAccount) {
    return null;
  }

  const formattedDate = formatTransactionDate();
  const effectiveAccountManagerId = sbAccount.accountManagerId || order.accountManagerId || 'ECOMMERCE_SYSTEM';
  const reportingActor = getReportingStaffId(effectiveAccountManagerId, source);
  const shouldUseSBOrderWalletOnly = sbAccount.accountMode === 'multi_item';
  const nextSBBalance = shouldUseSBOrderWalletOnly
    ? Number(sbAccount.balance || 0)
    : Math.max(0, Number(sbAccount.balance || 0) - amount);

  await AccountTransaction.DepositTransactionAccount({
    createdBy: reportingActor,
    transactionOwnerId: source,
    customerId: sbAccount.customerId,
    amount,
    balance: nextSBBalance,
    branchId: sbAccount.branchId || order.branchId || 'ECOMMERCE',
    accountManagerId: effectiveAccountManagerId,
    accountNumber: sbAccount.accountNumber,
    accountTypeId: sbAccount._id,
    date: formattedDate,
    narration: `Reversed payment reservation for changed product: ${productName || 'Product'} - Ref: ${transactionRef}`,
    transactionRef,
    package: "SB",
    direction: "Debit",
    excludeFromStaffStats: true,
  });

  return await SBAccount.findByIdAndUpdate(
    sbAccount._id,
    { balance: nextSBBalance },
    { new: true }
  );
};

const reverseChangedOrderItemPayment = async (order, item, actor) => {
  const paidAmount = Math.max(0, Number(item?.paidAmount || 0));
  if (paidAmount <= 0) {
    return 0;
  }

  const productName = item.productName || 'Product';
  const transactionRef = `ITEM_CHANGE_REVERSAL_${order.orderNumber}_${item._id || item.productId}_${Date.now()}`;
  await creditWalletForOrderPayment(order, paidAmount, transactionRef, {
    createdBy: actor,
    transactionOwnerId: order.customerId?.toString(),
    productName,
  });
  await reverseSBAccountReservationForChangedItem(order, paidAmount, transactionRef, actor, productName);

  return paidAmount;
};

const payReplacementItemFromWalletIfFullyFunded = async (order, item, actor) => {
  const amount = Math.max(0, Number(item?.subtotal || item?.price || 0));
  if (amount <= 0) {
    return { paid: false, amount: 0 };
  }

  const walletAccount = await getCustomerWalletAccount(order);
  if (Number(walletAccount.availableBalance || 0) < amount) {
    return { paid: false, amount: 0 };
  }

  const transactionRef = `ITEM_REPLACEMENT_PAYMENT_${order.orderNumber}_${item._id || item.productId}_${Date.now()}`;
  await debitWalletForOrderPayment(order, amount, transactionRef, { productName: item.productName });
  await creditSBAccountWithoutLedgerImpact(order, amount, transactionRef, actor);

  return { paid: true, amount };
};

const getOrderFulfillmentBranchId = (order, staff) => {
  if (staff?.role === 'Manager' && staff.branchId) {
    return staff.branchId.toString();
  }
  return order.branchId?.toString() || '';
};

const assertOrderItemBranchStockAvailable = async (order, item, staff = null) => {
  const fulfillmentBranchId = getOrderFulfillmentBranchId(order, staff);
  if (!fulfillmentBranchId) {
    throw new Error('Branch is required for product stock update');
  }

  const stockRow = await ProductBranchStock.findOne({
    productId: item.productId?.toString(),
    branchId: fulfillmentBranchId,
    variationId: item.variationId || ''
  }).lean();
  const availableQuantity = Number(stockRow?.quantity || 0);
  const requiredQuantity = Number(item.quantity || 0);

  if (availableQuantity < requiredQuantity) {
    throw new Error(
      `Insufficient branch stock for ${item.productName || 'this product'}. Available: ${availableQuantity}, Required: ${requiredQuantity}`
    );
  }
};

const getOrderItemAmountDue = (item) => {
  const subtotal = Number(item.subtotal || 0);
  const paidAmount = Math.min(subtotal, Math.max(0, Number(item.paidAmount || 0)));
  return Math.max(0, subtotal - paidAmount);
};

const assertOrderItemFundingAvailable = async (order, item) => {
  const amountDue = getOrderItemAmountDue(item);
  if (amountDue <= 0) return;

  const existingSettlement = await findExistingItemDeliverySettlement(order, item);
  if (existingSettlement) return;

  const sbAccount = await SBAccount.findOne({ SBAccountNumber: order.SBAccountNumber });
  if (!sbAccount) {
    throw new Error('SB Account not found');
  }

  const sbBalance = Number(sbAccount.balance || 0);
  if (sbBalance >= amountDue) return;

  const shortfall = amountDue - sbBalance;
  const account = await getCustomerWalletAccount(order);
  const availableBalance = Number(account.availableBalance || 0);
  if (availableBalance < shortfall) {
    throw new Error(`Insufficient wallet balance. Available: ₦${availableBalance.toLocaleString()}, Required: ₦${shortfall.toLocaleString()}`);
  }
};

const findExistingItemDeliverySettlement = async (order, item) => {
  const transactionPrefix = `ITEM_DELIVERY_${order.orderNumber}_${item._id}_`;
  const escapedPrefix = transactionPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  return await AccountTransactionModel.findOne({
    package: 'SB',
    direction: { $in: ['Debit', 'Purchased'] },
    narration: { $regex: escapedPrefix }
  }).lean();
};

const markOrderItemWalletPurchaseDelivered = async (order, item) => {
  const itemId = String(item?._id || '');
  if (!order?.orderNumber || !itemId) {
    return;
  }

  const transactionRefPattern = `^(ITEM_PAYMENT|ITEM_DELIVERY)_${escapeRegex(order.orderNumber)}_${escapeRegex(itemId)}_`;
  await AccountTransactionModel.updateMany(
    {
      package: 'Wallet',
      customerId: order.customerId?.toString(),
      direction: 'Bought',
      transactionRef: { $regex: transactionRefPattern }
    },
    { $set: { direction: 'Delivered' } }
  );
};

const settleOrderItemPaymentFromSBAccount = async (order, item, staff) => {
  const subtotal = Number(item.subtotal || 0);
  const paidAmount = Math.min(subtotal, Math.max(0, Number(item.paidAmount || 0)));
  const amountDue = Math.max(0, subtotal - paidAmount);

  if (amountDue <= 0) {
    item.paidAmount = subtotal;
    item.paymentStatus = 'paid';
    return null;
  }

  if (!order.SBAccountNumber) {
    throw new Error('This order does not have an SB Account');
  }

  const existingSettlement = await findExistingItemDeliverySettlement(order, item);
  if (existingSettlement) {
    item.paidAmount = subtotal;
    item.paymentStatus = 'paid';
    return await SBAccount.findOne({ SBAccountNumber: order.SBAccountNumber });
  }

  const transactionRef = `ITEM_DELIVERY_${order.orderNumber}_${item._id}_${Date.now()}`;
  const source = staff?.staffId || staff?._id?.toString() || 'ECOMMERCE_SYSTEM';
  let sbAccount = await SBAccount.findOne({ SBAccountNumber: order.SBAccountNumber });
  if (!sbAccount) {
    throw new Error('SB Account not found');
  }

  if (sbAccount.accountMode === 'multi_item') {
    await debitWalletForOrderPayment(order, amountDue, transactionRef, { productName: item.productName });

    await AccountTransaction.DepositTransactionAccount({
      createdBy: source,
      transactionOwnerId: source,
      customerId: sbAccount.customerId,
      amount: amountDue,
      balance: Number(sbAccount.balance || 0),
      branchId: sbAccount.branchId || order.branchId || 'ECOMMERCE',
      accountManagerId: sbAccount.accountManagerId || order.accountManagerId || 'ECOMMERCE_SYSTEM',
      accountNumber: sbAccount.accountNumber,
      accountTypeId: sbAccount._id,
      date: formatTransactionDate(),
      narration: `Product delivered: ${item.productName || item._id} - Order ${order.orderNumber} - Ref: ${transactionRef}`,
      package: "SB",
      direction: "Purchased",
    });

    item.paidAmount = subtotal;
    item.paymentStatus = 'paid';
    return await SBAccount.findOne({ SBAccountNumber: order.SBAccountNumber });
  }

  const sbBalance = Number(sbAccount.balance || 0);
  if (sbBalance < amountDue) {
    const shortfall = amountDue - sbBalance;
    await debitWalletForOrderPayment(order, shortfall, transactionRef, { productName: item.productName });
    sbAccount = await creditSBAccountWithoutLedgerImpact(order, shortfall, transactionRef, source);
  }

  await debitSBAccountForPayment(sbAccount, amountDue, order, source, {
    skipAccountLedgerUpdate: true,
    narration: `Product delivered: ${item.productName || item._id} - Order ${order.orderNumber} - Ref: ${transactionRef}`
  });

  item.paidAmount = subtotal;
  item.paymentStatus = 'paid';

  return await SBAccount.findOne({ SBAccountNumber: order.SBAccountNumber });
};

const decreaseStockThenSettleOrderItem = async (order, item, staff) => {
  const fulfillmentBranchId = getOrderFulfillmentBranchId(order, staff);
  await assertOrderItemBranchStockAvailable(order, item, staff);
  if (item.paymentStatus !== 'paid') {
    await assertOrderItemFundingAvailable(order, item);
  }

  await ProductService.updateProductStock(
    item.productId,
    item.quantity,
    'decrease',
    item.variationId || '',
    fulfillmentBranchId,
    staff?.staffId || ''
  );

  try {
    if (item.paymentStatus !== 'paid') {
      await settleOrderItemPaymentFromSBAccount(order, item, staff);
    }
  } catch (err) {
    try {
      await ProductService.updateProductStock(
        item.productId,
        item.quantity,
        'increase',
        item.variationId || '',
        fulfillmentBranchId,
        staff?.staffId || ''
      );
    } catch (restoreErr) {
      console.error(`Failed to restore stock for product ${item.productId}:`, restoreErr.message);
    }
    throw err;
  }
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

  order.installmentPlan.payments.push({
    date: new Date(),
    amount: paymentAmount,
    status: 'paid',
    paidAt: new Date(),
    transactionRef
  });

  order.installmentPlan.totalPaid = Number(order.installmentPlan.totalPaid || 0) + paymentAmount;
  order.installmentPlan.remainingBalance = Math.max(0, remainingBalance - paymentAmount);
  order.installmentPlan.creditBalance = Math.max(0, Number(order.installmentPlan.totalPaid || 0) - Number(order.totalAmount || 0));
  order.installmentPlan.nextPaymentDate = null;
  if (transactionRef) {
    order.paymentReferences = order.paymentReferences || [];
    const paymentReferenceEntry = order.paymentReferences.find((entry) => entry.reference === transactionRef);
    if (paymentReferenceEntry) {
      paymentReferenceEntry.amount = paymentAmount;
    } else {
      order.paymentReferences.push({
        reference: transactionRef,
        amount: paymentAmount,
        paymentType: options.paymentType || 'installment'
      });
    }
  }

  if (order.installmentPlan.remainingBalance <= 0) {
    order.paymentStatus = 'paid';
    order.status = 'paid';
  } else {
    order.paymentStatus = 'partial';
    order.status = 'partially_paid';
  }

  await order.save();

  return {
    order: await EcommerceOrder.findById(order._id),
    sbAccount: await SBAccount.findOne({ SBAccountNumber: order.SBAccountNumber })
  };
};

const payOrderItemFromWallet = async ({ orderNumber, customerId, itemId }) => {
  const order = await EcommerceOrder.findOne({ orderNumber, customerId: customerId.toString() });
  if (!order) {
    throw new Error('Order not found');
  }

  const item = order.items.id(itemId);
  if (!item) {
    throw new Error('Order item not found');
  }
  if (['delivered', 'completed'].includes(item.fulfillmentStatus)) {
    throw new Error('This product has already been collected or delivered');
  }

  const subtotal = Number(item.subtotal || 0);
  const paidAmount = Math.min(subtotal, Math.max(0, Number(item.paidAmount || 0)));
  const amountDue = Math.max(0, subtotal - paidAmount);
  if (amountDue <= 0) {
    item.paidAmount = subtotal;
    item.paymentStatus = 'paid';
    await order.save();
    return await decorateOrderProductAvailability(order);
  }

  const walletAccount = await getCustomerWalletAccount(order);
  if (Number(walletAccount.availableBalance || 0) < amountDue) {
    throw new Error(`Insufficient wallet balance. Available: ₦${Number(walletAccount.availableBalance || 0).toLocaleString()}, Required: ₦${amountDue.toLocaleString()}`);
  }

  const transactionRef = `ITEM_PAYMENT_${order.orderNumber}_${item._id}_${Date.now()}`;
  await debitWalletForOrderPayment(order, amountDue, transactionRef, { productName: item.productName });
  await creditSBAccountWithoutLedgerImpact(order, amountDue, transactionRef, customerId.toString());

  item.paidAmount = subtotal;
  item.paymentStatus = 'paid';
  order.installmentPlan = order.installmentPlan || calculateFlexibleInstallmentPlan(Number(order.totalAmount || 0));
  order.installmentPlan.payments = order.installmentPlan.payments || [];
  order.installmentPlan.payments.push({
    date: new Date(),
    amount: amountDue,
    status: 'paid',
    paidAt: new Date(),
    transactionRef
  });
  order.installmentPlan.totalPaid = Number(order.installmentPlan.totalPaid || 0) + amountDue;
  order.installmentPlan.remainingBalance = Math.max(0, Number(order.totalAmount || 0) - Number(order.installmentPlan.totalPaid || 0));
  order.installmentPlan.creditBalance = Math.max(0, Number(order.installmentPlan.totalPaid || 0) - Number(order.totalAmount || 0));
  order.installmentPlan.nextPaymentDate = null;
  order.paymentStatus = order.installmentPlan.remainingBalance <= 0 ? 'paid' : 'partial';
  if (!['delivered', 'completed', 'cancelled'].includes(order.status)) {
    order.status = order.paymentStatus === 'paid' ? 'paid' : 'partially_paid';
  }

  await order.save();
  await syncSBAccountItemsFromOrder(order);

  return await decorateOrderProductAvailability(await EcommerceOrder.findById(order._id));
};

const hasRepAccessToCustomer = (staffId, customer, ownerId = '') => {
  const normalizedStaffId = String(staffId || '');
  return (
    String(ownerId || '') === normalizedStaffId ||
    String(customer?.accountManagerId || '') === normalizedStaffId ||
    String(customer?.createdBy || '') === normalizedStaffId
  );
};

const getCustomerDisplayName = (customer) => {
  return [customer?.firstName, customer?.lastName].filter(Boolean).join(' ').trim() || 'Unknown Customer';
};

const normalizeProductActionKeyPart = (value) => String(value || '').trim().toLowerCase();

const buildProductActionDedupeKey = ({
  SBAccountNumber,
  customerId,
  productId,
  productName,
  variationId,
  quantity,
  amount
}) => [
  normalizeProductActionKeyPart(SBAccountNumber),
  normalizeProductActionKeyPart(customerId),
  normalizeProductActionKeyPart(productId) || normalizeProductActionKeyPart(productName),
  normalizeProductActionKeyPart(variationId),
  Number(quantity || 1),
  Number(amount || 0)
].join('|');

const getProductActionRequests = async (staff) => {
  const role = staff?.role;
  const staffId = String(staff?.staffId || '');
  const isRep = ['Agent', 'OnlineRep', 'Rep'].includes(role);
  const isManager = role === 'Manager';

  const [ecommerceOrders, sbAccounts] = await Promise.all([
    EcommerceOrder.find({
      status: { $ne: 'cancelled' },
      'items.paymentStatus': 'paid'
    }).lean(),
    SBAccount.find({
      createdBy: { $ne: 'ECOMMERCE_SYSTEM' },
      status: { $ne: 'sold' },
      items: { $exists: true, $ne: [] }
    }).lean()
  ]);

  const customerIds = new Set();
  ecommerceOrders.forEach((order) => customerIds.add(String(order.customerId || '')));
  sbAccounts.forEach((account) => customerIds.add(String(account.customerId || '')));

  const customers = await Customer.find({
    _id: { $in: Array.from(customerIds).filter(Boolean) }
  }).select('firstName lastName phone accountManagerId createdBy branchId').lean();
  const customerById = new Map(customers.map((customer) => [String(customer._id), customer]));

  const actionItems = [];
  const ecommerceActionKeys = new Set();

  ecommerceOrders.forEach((order) => {
    const customer = customerById.get(String(order.customerId || ''));
    if (isRep && !hasRepAccessToCustomer(staffId, customer, order.accountManagerId)) {
      return;
    }

    const payments = Array.isArray(order.installmentPlan?.payments)
      ? order.installmentPlan.payments
      : [];

    (order.items || []).forEach((item) => {
      const itemId = String(item._id || '');
      const successfulItemPayment = payments.find((payment) => (
        payment.status === 'paid' &&
        String(payment.transactionRef || '').startsWith(`ITEM_PAYMENT_${order.orderNumber}_${itemId}_`)
      ));
      const outrightInitialPayment = (
        item.paymentType === 'outright' &&
        item.paymentStatus === 'paid' &&
        item.paymentReference &&
        payments.some((payment) => (
          payment.status === 'paid' &&
          payment.transactionRef === item.paymentReference
        ))
      );

      if ((!successfulItemPayment && !outrightInitialPayment) || ['delivered', 'completed'].includes(item.fulfillmentStatus)) {
        return;
      }

      ecommerceActionKeys.add(buildProductActionDedupeKey({
        SBAccountNumber: order.SBAccountNumber || '',
        customerId: order.customerId || '',
        productId: item.productId || '',
        productName: item.productName || '',
        variationId: item.variationId || '',
        quantity: item.quantity || 1,
        amount: item.subtotal || 0
      }));

      actionItems.push({
        id: `ecommerce-${order._id}-${itemId}`,
        source: 'ecommerce',
        sourceLabel: 'Ecommerce',
        orderId: String(order._id),
        orderNumber: order.orderNumber,
        SBAccountNumber: order.SBAccountNumber || '',
        customerId: String(order.customerId || ''),
        customerName: getCustomerDisplayName(customer),
        customerPhone: customer?.phone || order.customerPhone || '',
        accountManagerId: order.accountManagerId || customer?.accountManagerId || '',
        branchId: order.branchId || customer?.branchId || '',
        productId: item.productId || '',
        itemId,
        productName: item.productName,
        variationName: item.variationName || '',
        quantity: Number(item.quantity || 1),
        amount: Number(item.subtotal || 0),
        paidAmount: Number(item.paidAmount || item.subtotal || 0),
        paymentStatus: item.paymentStatus || 'paid',
        fulfillmentStatus: item.fulfillmentStatus || 'pending',
        paidAt: successfulItemPayment?.paidAt || successfulItemPayment?.date || order.updatedAt,
        createdAt: item.addedAt || order.createdAt,
        actionUrl: `/ecommerce-order/${order._id}`
      });
    });
  });

  sbAccounts.forEach((account) => {
    const customer = customerById.get(String(account.customerId || ''));
    const accountBranchId = String(account.branchId || customer?.branchId || '');
    if (isManager && accountBranchId !== String(staff?.branchId || '')) {
      return;
    }
    if (isRep && !hasRepAccessToCustomer(staffId, customer, account.accountManagerId || account.createdBy)) {
      return;
    }

    (account.items || []).forEach((item) => {
      const itemId = String(item._id || '');
      const itemAmount = Number(item.subtotal || item.price || 0);
      const paidAmount = Number(item.paidAmount || 0);
      const itemIsPaid = paidAmount >= itemAmount;

      if (!itemIsPaid || ['delivered', 'completed'].includes(item.fulfillmentStatus)) {
        return;
      }

      const duplicateEcommerceActionKey = buildProductActionDedupeKey({
        SBAccountNumber: account.SBAccountNumber || '',
        customerId: account.customerId || '',
        productId: item.productId || '',
        productName: item.productName || '',
        variationId: item.variationId || '',
        quantity: item.quantity || 1,
        amount: itemAmount
      });
      if (ecommerceActionKeys.has(duplicateEcommerceActionKey)) {
        return;
      }

      actionItems.push({
        id: `backoffice-${account._id}-${itemId}`,
        source: 'backoffice',
        sourceLabel: 'Backoffice',
        sbAccountId: String(account._id),
        SBAccountNumber: account.SBAccountNumber,
        customerId: String(account.customerId || ''),
        customerName: getCustomerDisplayName(customer),
        customerPhone: customer?.phone || account.accountNumber || '',
        accountManagerId: account.accountManagerId || customer?.accountManagerId || account.createdBy || '',
        branchId: account.branchId || customer?.branchId || '',
        productId: item.productId || '',
        itemId,
        productName: item.productName,
        variationName: item.variationName || '',
        quantity: Number(item.quantity || 1),
        amount: itemAmount,
        paidAmount: paidAmount >= itemAmount ? paidAmount : Number(account.balance || 0),
        paymentStatus: 'paid',
        fulfillmentStatus: item.fulfillmentStatus || 'pending',
        paidAt: account.updatedAt || account.createdAt,
        createdAt: account.createdAt,
        actionUrl: `/customeraccountdashboard/${account.customerId}`
      });
    });
  });

  actionItems.sort((a, b) => new Date(b.paidAt || b.createdAt || 0) - new Date(a.paidAt || a.createdAt || 0));

  return {
    total: actionItems.length,
    items: actionItems
  };
};

const recordBackofficeSBAccountPayment = async (SBAccountNumber, customerId, amount, transactionRef, source, options = {}) => {
  const sbAccount = await SBAccount.findOne({
    SBAccountNumber,
    customerId: customerId.toString()
  });

  if (!sbAccount) {
    throw new Error('Order not found');
  }

  const paymentAmount = normalizePaymentAmount(amount);
  const payments = await getSBAccountPaymentRecords(sbAccount._id);
  const totalPaid = getSBAccountPaidAmountFromRecords(payments);
  const remainingBalance = Math.max(0, Number(sbAccount.sellingPrice || 0) - totalPaid);
  if (remainingBalance <= 0) {
    throw new Error('This order has already been fully paid');
  }
  if (paymentAmount > remainingBalance) {
    throw new Error(`Payment amount cannot exceed remaining balance of ₦${remainingBalance.toLocaleString()}`);
  }

  const existingTransaction = await AccountTransactionModel.findOne({
    accountTypeId: sbAccount._id.toString(),
    $or: [
      { transactionRef },
      { narration: { $regex: transactionRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') } }
    ]
  });
  if (existingTransaction) {
    const refreshedSBAccount = await SBAccount.findById(sbAccount._id);
    return {
      order: await buildOrderFromSBAccount(refreshedSBAccount),
      sbAccount: refreshedSBAccount
    };
  }

  const orderLike = await buildOrderFromSBAccount(sbAccount);

  if (options.creditWallet !== false) {
    await creditWalletForOrderPayment(orderLike, paymentAmount, transactionRef);
  }

  await debitWalletForOrderPayment(orderLike, paymentAmount, transactionRef);
  const updatedSBAccount = await creditSBAccountWithoutLedgerImpact(orderLike, paymentAmount, transactionRef, source);

  if (Number(updatedSBAccount.balance || 0) >= Number(updatedSBAccount.sellingPrice || 0)) {
    await updateSBAccountToSold(updatedSBAccount.SBAccountNumber);
  }

  const refreshedSBAccount = await SBAccount.findById(sbAccount._id);
  return {
    order: await buildOrderFromSBAccount(refreshedSBAccount),
    sbAccount: refreshedSBAccount
  };
};

const recordCustomerOrderDepositPayment = async (orderNumber, customerId, amount, transactionRef, source) => {
  const order = await EcommerceOrder.findOne({ orderNumber, customerId: customerId.toString() });
  if (order) {
    return await recordFlexibleInstallmentOrderPayment(
      order._id,
      amount,
      transactionRef,
      source
    );
  }

  return await recordBackofficeSBAccountPayment(
    orderNumber,
    customerId,
    amount,
    transactionRef,
    source
  );
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
    const sbAccount = await SBAccount.findOne({
      SBAccountNumber: orderNumber,
      customerId: customerId.toString()
    });
    if (!sbAccount) {
      throw new Error('Order not found');
    }

    const payments = await getSBAccountPaymentRecords(sbAccount._id);
    const totalPaid = getSBAccountPaidAmountFromRecords(payments);
    const remainingBalance = Math.max(0, Number(sbAccount.sellingPrice || 0) - totalPaid);
    if (remainingBalance <= 0) {
      throw new Error('This order has already been fully paid');
    }

    const transactionRef = `WALLET_PAYOFF_${Date.now()}`;
    const result = await recordBackofficeSBAccountPayment(
      orderNumber,
      customerId,
      remainingBalance,
      transactionRef,
      customerId.toString(),
      { creditWallet: false }
    );

    return result.order;
  }

  if (order.paymentType !== 'installment' || !order.installmentPlan) {
    throw new Error('Only pay-small-small orders can be paid off from wallet');
  }

  const remainingBalance = Number(order.installmentPlan.remainingBalance || 0);
  if (remainingBalance <= 0) {
    throw new Error('This order has already been fully paid');
  }

  const walletAccount = await getCustomerWalletAccount(order);
  if (Number(walletAccount.availableBalance || 0) < remainingBalance) {
    throw new Error(`Insufficient wallet balance. Available: ₦${Number(walletAccount.availableBalance || 0).toLocaleString()}, Required: ₦${remainingBalance.toLocaleString()}`);
  }

  const transactionRef = `WALLET_PAYOFF_${Date.now()}`;

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
    await order.save();
    return await EcommerceOrder.findById(order._id);
  }

  for (const payment of pendingPayments) {
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
  }

  order.installmentPlan.nextPaymentDate = null;
  order.paymentStatus = 'paid';
  order.status = 'paid';

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
  markAllOrderItemsPaid(existingOrder);
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

  if (['delivered', 'completed'].includes(order.status)) {
    throw new Error('Cannot cancel a delivered or completed order');
  }

  // Restore stock
  for (const item of order.items) {
    await ProductService.updateProductStock(
      item.productId,
      item.quantity,
      'increase',
      item.variationId || '',
      order.branchId,
      ''
    );
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
  return await EcommerceOrder.findOne({
    $or: [
      { paymentReference },
      { 'paymentReferences.reference': paymentReference },
      { 'items.paymentReference': paymentReference }
    ]
  });
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
  getActiveCustomerEcommerceOrder,
  addItemsToActiveOrder,
  getProductActionRequests,
  getAllOrders,
  updateOrderStatus,
  updateOrderItemFulfillment,
  recordInstallmentPayment,
  recordOutrightPayment,
  cancelOrder,
  getOrdersByBranch,
  getOverdueInstallments,
  getOrderSBAccount,
  getOrderWalletAccount,
  getProductDemandSummary,
  getProductSalesSummary,
  getProductDemandDetail,
  creditSBAccountForOrder,
  processAutomaticPayments,
  checkAndProcessPendingPayments,
  getOrderByReference,
  creditSBAccountForOrderDirect,
  recordFlexibleInstallmentOrderPayment,
  recordCustomerOrderDepositPayment,
  updateSBAccountToSold,
  recordWalletMovementForOrderPayment,
  payoffRemainingBalanceFromWallet,
  createOrderAndPayFromWallet,
  replaceInstallmentOrderItem,
  replaceInstallmentOrderItemBySBAccount,
  payOrderItemFromWallet
};
