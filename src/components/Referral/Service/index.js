const Customer = require('../../Customer/Model');
const EcommerceOrder = require('../../EcommerceOrder/Model');
const Account = require('../../Account/Model');
const AccountTransactionService = require('../../AccountTransaction/Service');
const AccountTransaction = require('../../AccountTransaction/Model');
const SBAccount = require('../../SBAccount/Model');
const Order = require('../../SBAccount/Model/order');
const ReferralSetting = require('../Model/ReferralSetting');
const ReferralLedger = require('../Model/ReferralLedger');
const BonusLedger = require('../Model/BonusLedger');

const normalizePhoneNumber = (value = '') => String(value || '').replace(/\D/g, '');
const roundMoney = (value = 0) => Math.round(Number(value || 0) * 100) / 100;
const isValidObjectIdString = (value = '') => /^[a-f\d]{24}$/i.test(String(value || ''));
const ECOMMERCE_TRANSACTION_BONUS_DEPOSIT_NARRATION_PATTERN = /^(Wallet Funding|SB Order Wallet Funding|Order Payment to Wallet)/i;
const SB_PAID_WALLET_FUNDING_NARRATION_PATTERN = /^(Wallet Funding|SB Order Wallet Funding|Order Payment to Wallet|SB Order Wallet Deposit|Deposited by .* for Order)/i;
const BONUS_TRANSFER_NARRATION_PATTERN = /(Bonus|Incentive) Transfer to Wallet/i;
const isEcommerceTransactionBonusSource = (source = {}) => (
  ECOMMERCE_TRANSACTION_BONUS_DEPOSIT_NARRATION_PATTERN.test(String(source.narration || ''))
);

const formatTransactionDate = (date = new Date()) => {
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

const buildSBOrderWalletAccountNumber = (customer) => `${customer.phone}-SBW`;

const ensureCustomerSBOrderWallet = async (customer) => {
  const customerId = customer._id.toString();
  const accountNumber = buildSBOrderWalletAccountNumber(customer);
  let account = await Account.findOne({
    customerId,
    walletType: 'sb_order_wallet',
  });

  if (!account) {
    account = await Account.findOne({
      accountNumber,
      walletType: 'sb_order_wallet',
    });
  }

  if (!account) {
    account = await Account.create({
      customerId,
      accountNumber,
      walletType: 'sb_order_wallet',
      createdBy: 'ECOMMERCE_SYSTEM',
      branchId: customer.branchId || '',
      accountManagerId: customer.accountManagerId || '',
      status: 'active',
      availableBalance: 0,
      ledgerBalance: 0,
    });
  }

  const updates = {};
  if (account.accountNumber !== accountNumber) updates.accountNumber = accountNumber;
  if (account.walletType !== 'sb_order_wallet') updates.walletType = 'sb_order_wallet';
  if (account.status !== 'active') updates.status = 'active';

  if (Object.keys(updates).length > 0) {
    account = await Account.findByIdAndUpdate(account._id, { $set: updates }, { new: true });
  }

  return account;
};

const getReportingStaffId = (accountManagerId, fallbackActor) => {
  if (accountManagerId && accountManagerId !== 'ECOMMERCE_SYSTEM') {
    return accountManagerId;
  }

  return fallbackActor;
};

const getReferralSetting = async () => {
  let setting = await ReferralSetting.findOne({ key: 'default' });
  if (!setting) {
    setting = await ReferralSetting.create({
      key: 'default',
      enabled: true,
      incentiveAmount: 0,
      incentivePercentage: 0,
      productReferralEnabled: false,
      referralQualifyingAmount: 0,
      sbReferralEnabled: false,
      loginBonusEnabled: false,
      loginBonusAmount: 0,
      transactionBonusEnabled: false,
      transactionBonusPercentage: 0,
      rootCustomers: [],
      shareMode: 'equal',
    });
  }
  return setting;
};

const getOrderedRootCustomerIds = (setting) => (
  [...(setting?.rootCustomers || [])]
    .sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
    .map((item) => String(item.customerId || ''))
    .filter(Boolean)
);

const hydrateRootCustomers = async (setting) => {
  const rootCustomerIds = getOrderedRootCustomerIds(setting);
  if (rootCustomerIds.length === 0) return [];

  const customers = await Customer.find({ _id: { $in: rootCustomerIds } })
    .select('_id firstName lastName phone accountManagerId branchId')
    .lean();
  const customerById = new Map(customers.map((customer) => [customer._id.toString(), customer]));

  return rootCustomerIds
    .map((customerId, index) => {
      const customer = customerById.get(customerId);
      return customer ? { ...customer, position: index + 1 } : null;
    })
    .filter(Boolean);
};

const buildAncestorPath = async (customerId, limit = 50) => {
  const path = [];
  const seen = new Set([String(customerId || '')]);
  let current = await Customer.findById(customerId).select('referredBy').lean();

  while (current?.referredBy && path.length < limit) {
    const parentId = String(current.referredBy || '');
    if (!parentId || seen.has(parentId)) break;
    seen.add(parentId);
    path.unshift(parentId);
    current = await Customer.findById(parentId).select('referredBy').lean();
  }

  return path;
};

const resolveSignupReferral = async ({ referralCode = '', newCustomerPhone = '', defaultBranchId = '' }) => {
  const setting = await getReferralSetting();
  const rootCustomerIds = getOrderedRootCustomerIds(setting);
  const normalizedReferralCode = normalizePhoneNumber(referralCode);
  let referrer = null;

  if (normalizedReferralCode) {
    if (!/^\d{11}$/.test(normalizedReferralCode)) {
      throw new Error('Referral code must be an existing customer phone number');
    }
    if (normalizedReferralCode === normalizePhoneNumber(newCustomerPhone)) {
      throw new Error('You cannot use your own phone number as referral code');
    }
    referrer = await Customer.findOne({ phone: normalizedReferralCode });
    if (!referrer) {
      throw new Error('Referral code not found');
    }
  } else if (rootCustomerIds.length > 0) {
    referrer = await Customer.findById(rootCustomerIds[rootCustomerIds.length - 1]);
  }

  const rootAncestors = rootCustomerIds.filter((customerId) => String(customerId) !== String(referrer?._id || ''));
  const referrerAncestors = referrer?._id ? await buildAncestorPath(referrer._id) : [];
  const referralAncestors = [];
  const seen = new Set();

  [...rootAncestors, ...referrerAncestors, referrer?._id?.toString()]
    .filter(Boolean)
    .forEach((customerId) => {
      const normalizedId = String(customerId);
      if (!seen.has(normalizedId)) {
        seen.add(normalizedId);
        referralAncestors.push(normalizedId);
      }
    });

  return {
    referrer,
    referredBy: referrer?._id?.toString() || '',
    referralCodeUsed: normalizedReferralCode,
    referralAncestors,
    accountManagerId: referrer?.accountManagerId || '',
    branchId: referrer?.branchId || defaultBranchId,
  };
};

const updateReferralSettings = async ({
  incentiveAmount,
  incentivePercentage,
  productReferralEnabled,
  referralQualifyingAmount,
  sbReferralEnabled,
  enabled,
  loginBonusEnabled,
  loginBonusAmount,
  transactionBonusEnabled,
  transactionBonusPercentage,
  rootCustomerIds = [],
  staffId = '',
}) => {
  const normalizedIncentiveAmount = roundMoney(incentiveAmount || 0);
  if (!Number.isFinite(normalizedIncentiveAmount) || normalizedIncentiveAmount < 0) {
    throw new Error('Referral incentive amount must be zero or greater');
  }
  const percentage = Number(incentivePercentage || 0);
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    throw new Error('Product referral incentive percentage must be between 0 and 100');
  }
  const normalizedReferralQualifyingAmount = roundMoney(referralQualifyingAmount || 0);
  if (!Number.isFinite(normalizedReferralQualifyingAmount) || normalizedReferralQualifyingAmount < 0) {
    throw new Error('Referral qualifying amount must be zero or greater');
  }
  const normalizedLoginBonusAmount = roundMoney(loginBonusAmount || 0);
  if (!Number.isFinite(normalizedLoginBonusAmount) || normalizedLoginBonusAmount < 0) {
    throw new Error('Login bonus amount must be zero or greater');
  }
  const normalizedTransactionBonusPercentage = Number(transactionBonusPercentage || 0);
  if (
    !Number.isFinite(normalizedTransactionBonusPercentage)
    || normalizedTransactionBonusPercentage < 0
    || normalizedTransactionBonusPercentage > 100
  ) {
    throw new Error('Transaction bonus percentage must be between 0 and 100');
  }

  const uniqueRootIds = [];
  const seen = new Set();
  rootCustomerIds
    .map((customerId) => String(customerId || '').trim())
    .filter(Boolean)
    .forEach((customerId) => {
      if (!seen.has(customerId)) {
        seen.add(customerId);
        uniqueRootIds.push(customerId);
      }
    });

  const invalidId = uniqueRootIds.find((customerId) => !isValidObjectIdString(customerId));
  if (invalidId) {
    throw new Error('One or more root customers are invalid');
  }

  const foundRootCount = uniqueRootIds.length
    ? await Customer.countDocuments({ _id: { $in: uniqueRootIds } })
    : 0;
  if (foundRootCount !== uniqueRootIds.length) {
    throw new Error('One or more root customers could not be found');
  }

  const setting = await ReferralSetting.findOneAndUpdate(
    { key: 'default' },
    {
      $set: {
        enabled: Boolean(enabled),
        incentiveAmount: normalizedIncentiveAmount,
        incentivePercentage: percentage,
        productReferralEnabled: Boolean(productReferralEnabled),
        referralQualifyingAmount: normalizedReferralQualifyingAmount,
        sbReferralEnabled: Boolean(sbReferralEnabled),
        loginBonusEnabled: Boolean(loginBonusEnabled),
        loginBonusAmount: normalizedLoginBonusAmount,
        transactionBonusEnabled: Boolean(transactionBonusEnabled),
        transactionBonusPercentage: normalizedTransactionBonusPercentage,
        rootCustomers: uniqueRootIds.map((customerId, index) => ({
          customerId,
          position: index + 1,
        })),
        shareMode: 'equal',
        updatedBy: staffId,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return await getReferralAdminSummary(setting);
};

const searchCustomers = async (search = '') => {
  const trimmed = String(search || '').trim();
  if (!trimmed) return [];

  const regex = new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return await Customer.find({
    $or: [
      { firstName: regex },
      { lastName: regex },
      { phone: regex },
      { email: regex },
    ],
  })
    .select('_id firstName lastName phone email accountManagerId branchId referralIncentiveBalance')
    .sort({ firstName: 1, lastName: 1 })
    .limit(20)
    .lean();
};

const getReferralAdminSummary = async (providedSetting = null, options = {}) => {
  const setting = providedSetting || await getReferralSetting();
  const page = Math.max(parseInt(options.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(options.limit, 10) || 25, 1), 100);
  const [rootCustomers, rawLedgers, totalLedgers, totalCreditedResult] = await Promise.all([
    hydrateRootCustomers(setting),
    ReferralLedger.find({})
      .sort({ creditedAt: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ReferralLedger.countDocuments({}),
    ReferralLedger.aggregate([
      { $group: { _id: null, amount: { $sum: '$amount' } } },
    ]),
  ]);

  const ledgerCustomerIds = [...new Set(
    rawLedgers.flatMap((ledger) => [ledger.beneficiaryCustomerId, ledger.buyerCustomerId])
      .map((customerId) => String(customerId || ''))
      .filter(Boolean)
  )];
  const ledgerCustomers = ledgerCustomerIds.length
    ? await Customer.find({ _id: { $in: ledgerCustomerIds } }).select('_id firstName lastName phone').lean()
    : [];
  const customerById = new Map(ledgerCustomers.map((customer) => [customer._id.toString(), customer]));
  const ledgers = rawLedgers.map((ledger) => ({
    ...ledger,
    beneficiary: customerById.get(String(ledger.beneficiaryCustomerId || '')) || null,
    buyer: customerById.get(String(ledger.buyerCustomerId || '')) || null,
  }));

  return {
    settings: {
      enabled: Boolean(setting.enabled),
      incentiveAmount: roundMoney(setting.incentiveAmount || 0),
      incentivePercentage: Number(setting.incentivePercentage || 0),
      productReferralEnabled: Boolean(setting.productReferralEnabled),
      referralQualifyingAmount: roundMoney(setting.referralQualifyingAmount || 0),
      sbReferralEnabled: Boolean(setting.sbReferralEnabled),
      loginBonusEnabled: Boolean(setting.loginBonusEnabled),
      loginBonusAmount: roundMoney(setting.loginBonusAmount || 0),
      transactionBonusEnabled: Boolean(setting.transactionBonusEnabled),
      transactionBonusPercentage: Number(setting.transactionBonusPercentage || 0),
      shareMode: setting.shareMode || 'equal',
      rootCustomers,
      updatedAt: setting.updatedAt,
    },
    ledgers,
    totals: {
      totalCredited: roundMoney(totalCreditedResult[0]?.amount || 0),
      totalLedgers,
      page,
      limit,
      totalPages: Math.max(Math.ceil(totalLedgers / limit), 1),
    },
  };
};

const getCustomerReferralSummary = async (customerId) => {
  let customer = await Customer.findById(customerId).select('-password').lean();
  if (!customer) {
    throw new Error('Customer not found');
  }

  await creditPendingTransactionBonusesForCustomer(customerId);
  await creditPendingSBReferralIncentives({ referrerCustomerId: customerId.toString() });
  if (customer.referredBy) {
    await creditReferralIncentivesForCustomer(customerId, { sourceOrderNumber: 'SB Referral Qualification' });
  }
  customer = await Customer.findById(customerId).select('-password').lean();

  const [recentEarnings, referralCount, sbReferralTotalResult, productReferralTotalResult] = await Promise.all([
    ReferralLedger.find({ beneficiaryCustomerId: customerId.toString() })
      .sort({ creditedAt: -1, createdAt: -1 })
      .limit(10)
      .lean(),
    Customer.countDocuments({ referredBy: customerId.toString() }),
    ReferralLedger.aggregate([
      {
        $match: {
          beneficiaryCustomerId: customerId.toString(),
          incentiveType: 'sb_qualification',
        },
      },
      { $group: { _id: null, amount: { $sum: '$amount' } } },
    ]),
    ReferralLedger.aggregate([
      {
        $match: {
          beneficiaryCustomerId: customerId.toString(),
          incentiveType: 'product',
        },
      },
      { $group: { _id: null, amount: { $sum: '$amount' } } },
    ]),
  ]);

  return {
    referralCode: customer.phone,
    referralIncentiveBalance: roundMoney(customer.referralIncentiveBalance || 0),
    referralIncentiveTotalEarned: roundMoney(customer.referralIncentiveTotalEarned || 0),
    sbReferralIncentiveTotalEarned: roundMoney(sbReferralTotalResult[0]?.amount || 0),
    productReferralIncentiveTotalEarned: roundMoney(productReferralTotalResult[0]?.amount || 0),
    loginBonusBalance: roundMoney(customer.loginBonusBalance || 0),
    loginBonusTotalEarned: roundMoney(customer.loginBonusTotalEarned || 0),
    loginBonusCredited: Boolean(customer.loginBonusCredited),
    loginBonusCreditedAt: customer.loginBonusCreditedAt || null,
    loginBonusTransferredAt: customer.loginBonusTransferredAt || null,
    transactionBonusBalance: roundMoney(customer.transactionBonusBalance || 0),
    transactionBonusTotalEarned: roundMoney(customer.transactionBonusTotalEarned || 0),
    transactionBonusLastCreditedAt: customer.transactionBonusLastCreditedAt || null,
    transactionBonusTransferredAt: customer.transactionBonusTransferredAt || null,
    referralIncentiveTransferredAt: customer.referralIncentiveTransferredAt || null,
    referralCount,
    recentEarnings,
  };
};

const buildCreditChain = async (buyerCustomerId, setting) => {
  const buyer = await Customer.findById(buyerCustomerId).select('referralAncestors referredBy').lean();
  if (!buyer) return [];

  const rootCustomerIds = getOrderedRootCustomerIds(setting);
  const chain = [];
  const seen = new Set([String(buyerCustomerId)]);
  const addCustomerId = (customerId) => {
    const normalizedId = String(customerId || '');
    if (normalizedId && !seen.has(normalizedId)) {
      seen.add(normalizedId);
      chain.push(normalizedId);
    }
  };

  rootCustomerIds.forEach(addCustomerId);
  (buyer.referralAncestors || []).forEach(addCustomerId);
  if (buyer.referredBy) addCustomerId(buyer.referredBy);

  return chain;
};

const buildDirectReferrerChain = async (buyerCustomerId) => {
  const buyer = await Customer.findById(buyerCustomerId).select('referredBy').lean();
  return buyer?.referredBy ? [String(buyer.referredBy)] : [];
};

const getItemPaidAmount = (item = {}) => {
  const subtotal = Number(item.subtotal || 0);
  const paidAmount = Number(item.paidAmount || 0);
  if (item.paymentStatus === 'paid' || ['delivered', 'completed'].includes(item.fulfillmentStatus || '')) {
    return subtotal > 0 ? subtotal : paidAmount;
  }
  return paidAmount;
};

const getEcommerceOrderPaidAmount = (order = {}) => {
  const totalAmount = Number(order.totalAmount || 0);
  const totalPaid = Number(order.installmentPlan?.totalPaid || 0);
  const itemPaid = (order.items || []).reduce((sum, item) => sum + getItemPaidAmount(item), 0);
  if (order.paymentStatus === 'paid' || ['paid', 'delivered', 'completed'].includes(order.status || '')) {
    return totalAmount > 0 ? totalAmount : Math.max(totalPaid, itemPaid);
  }
  return Math.max(totalPaid, itemPaid);
};

const getSBAccountPaidAmount = (account = {}) => {
  const sellingPrice = Number(account.sellingPrice || 0);
  const balance = Number(account.balance || 0);
  const itemPaid = (account.items || []).reduce((sum, item) => sum + getItemPaidAmount(item), 0);
  if (['sold', 'completed'].includes(account.status || '')) {
    return sellingPrice > 0 ? sellingPrice : Math.max(balance, itemPaid);
  }
  return Math.max(balance, itemPaid);
};

const getCustomerCumulativeSBPaidAmount = async (customerId) => {
  const normalizedCustomerId = String(customerId || '');
  if (!normalizedCustomerId) return 0;

  const [transactionTotal, walletFundingTotal, ecommerceOrders, sbAccounts, oldOrders] = await Promise.all([
    AccountTransaction.aggregate([
      {
        $match: {
          customerId: normalizedCustomerId,
          package: 'SB',
          direction: 'Credit',
        },
      },
      { $group: { _id: null, amount: { $sum: '$amount' } } },
    ]),
    AccountTransaction.aggregate([
      {
        $match: {
          customerId: normalizedCustomerId,
          package: 'Wallet',
          direction: 'Credit',
          narration: SB_PAID_WALLET_FUNDING_NARRATION_PATTERN,
        },
      },
      { $match: { narration: { $not: BONUS_TRANSFER_NARRATION_PATTERN } } },
      { $group: { _id: null, amount: { $sum: '$amount' } } },
    ]),
    EcommerceOrder.find({ customerId: normalizedCustomerId, status: { $ne: 'cancelled' } })
      .select('totalAmount installmentPlan.totalPaid paymentStatus status items')
      .lean(),
    SBAccount.find({ customerId: normalizedCustomerId, status: { $ne: 'cancelled' } })
      .select('sellingPrice balance status items')
      .lean(),
    Order.find({ customerId: normalizedCustomerId, status: { $ne: 'cancelled' } })
      .select('sellingPrice balance status items')
      .lean(),
  ]);

  const transactionAmount = roundMoney(Number(transactionTotal[0]?.amount || 0) + Number(walletFundingTotal[0]?.amount || 0));
  const modelAmount = roundMoney(
    ecommerceOrders.reduce((sum, order) => sum + getEcommerceOrderPaidAmount(order), 0)
    + sbAccounts.reduce((sum, account) => sum + getSBAccountPaidAmount(account), 0)
    + oldOrders.reduce((sum, order) => sum + getSBAccountPaidAmount(order), 0)
  );

  return Math.max(transactionAmount, modelAmount);
};

const isOrderFullyPaidForReferral = (order) => {
  if (!order || order.status === 'cancelled') return false;
  if (order.paymentStatus === 'paid') return true;

  const remainingBalance = Number(order.installmentPlan?.remainingBalance);
  if (Number.isFinite(remainingBalance) && remainingBalance <= 0) {
    return true;
  }

  const items = Array.isArray(order.items) ? order.items : [];
  if (items.length > 0) {
    const everyItemPaid = items.every((item) => (
      item.paymentStatus === 'paid'
      || Number(item.paidAmount || 0) >= Number(item.subtotal || 0)
    ));
    if (everyItemPaid) return true;

    const everyItemDelivered = items.every((item) => (
      ['delivered', 'completed'].includes(item.fulfillmentStatus || '')
    ));
    if (everyItemDelivered) return true;
  }

  return ['paid', 'delivered', 'completed'].includes(order.status || '');
};

const normalizePaidReferralOrder = async (order) => {
  if (!isOrderFullyPaidForReferral(order)) {
    return order;
  }

  order.paymentStatus = 'paid';
  if (!['paid', 'delivered', 'completed'].includes(order.status || '')) {
    order.status = 'paid';
  }
  if (order.installmentPlan) {
    order.installmentPlan.remainingBalance = 0;
    order.installmentPlan.nextPaymentDate = null;
  }
  (order.items || []).forEach((item) => {
    const subtotal = Number(item.subtotal || 0);
    if (subtotal > 0) {
      item.paidAmount = subtotal;
      item.paymentStatus = 'paid';
    }
  });

  return await order.save();
};

const isItemFullyPaidForReferral = (item = {}) => (
  item.paymentStatus === 'paid'
  || Number(item.paidAmount || 0) >= Number(item.subtotal || 0)
  || ['delivered', 'completed'].includes(item.fulfillmentStatus || '')
);

const getEligibleReferralItems = (order) => {
  const items = Array.isArray(order?.items) ? order.items : [];
  const orderFullyPaid = isOrderFullyPaidForReferral(order);
  if (items.length === 0) return [];

  return items
    .filter((item) => !item.referralIncentiveCredited && (orderFullyPaid || isItemFullyPaidForReferral(item)))
    .map((item) => ({
      item,
      itemId: String(item._id || item.productId || ''),
      productName: item.productName || 'Product',
      purchaseAmount: Number(item.profitAmount || 0),
    }))
    .filter((entry) => entry.purchaseAmount > 0);
};

const creditReferralForPurchase = async ({ order, purchase, setting, chain }) => {
  const percentage = Number(setting.incentivePercentage || 0);
  if (!setting.enabled || !setting.productReferralEnabled || percentage <= 0) {
    return { credited: false, reason: 'referral_disabled' };
  }

  const sourceOrderId = purchase.itemId
    ? `${order._id.toString()}:${purchase.itemId}`
    : order._id.toString();

  const existingLedger = await ReferralLedger.findOne({ sourceOrderId }).lean();
  if (existingLedger) {
    if (purchase.item) {
      purchase.item.referralIncentiveCredited = true;
      purchase.item.referralIncentiveCreditedAt = existingLedger.creditedAt || existingLedger.createdAt || new Date();
      purchase.item.referralIncentivePool = Number(existingLedger.incentivePool || 0);
    }
    return { credited: false, reason: 'already_credited' };
  }

  if (chain.length === 0) {
    return { credited: false, reason: 'empty_chain' };
  }

  const purchaseAmount = roundMoney(purchase.purchaseAmount || 0);
  const incentivePool = roundMoney((purchaseAmount * percentage) / 100);
  if (incentivePool <= 0) {
    return { credited: false, reason: 'empty_pool' };
  }

  const baseShare = Math.floor((incentivePool / chain.length) * 100) / 100;
  let allocated = 0;
  const ledgerDocs = chain.map((beneficiaryCustomerId, index) => {
    const isLast = index === chain.length - 1;
    const amount = isLast ? roundMoney(incentivePool - allocated) : baseShare;
    allocated = roundMoney(allocated + amount);
    return {
      beneficiaryCustomerId,
      buyerCustomerId: order.customerId?.toString(),
      sourceOrderId,
      sourceOrderNumber: order.orderNumber,
      sourceItemId: purchase.itemId,
      productName: purchase.productName,
      chainLevel: index + 1,
      purchaseAmount,
      incentivePercentage: percentage,
      incentivePool,
      amount,
      incentiveType: 'product',
      status: 'credited',
      branchId: '',
      accountManagerId: '',
      creditedAt: new Date(),
    };
  }).filter((entry) => entry.amount > 0);

  if (ledgerDocs.length === 0) {
    return { credited: false, reason: 'zero_shares' };
  }

  const insertedLedgers = [];
  for (const entry of ledgerDocs) {
    const result = await ReferralLedger.updateOne(
      {
        sourceOrderId: entry.sourceOrderId,
        beneficiaryCustomerId: entry.beneficiaryCustomerId,
      },
      { $setOnInsert: entry },
      { upsert: true }
    );

    if (result.upsertedCount > 0) {
      insertedLedgers.push(entry);
    }
  }

  await Promise.all(insertedLedgers.map((entry) => (
    Customer.findByIdAndUpdate(entry.beneficiaryCustomerId, {
      $inc: {
        referralIncentiveBalance: entry.amount,
        referralIncentiveTotalEarned: entry.amount,
      },
    })
  )));

  if (purchase.item) {
    purchase.item.referralIncentiveCredited = true;
    purchase.item.referralIncentiveCreditedAt = new Date();
    purchase.item.referralIncentivePool = incentivePool;
  }

  return { credited: insertedLedgers.length > 0, incentivePool, beneficiaries: insertedLedgers.length };
};

const creditProductReferralIncentivesForOrder = async (order) => {
  if (!order) {
    return { credited: false, reason: 'order_not_eligible' };
  }

  const eligibleOrder = isOrderFullyPaidForReferral(order)
    ? await normalizePaidReferralOrder(order)
    : order;

  const setting = await getReferralSetting();
  const chain = await buildCreditChain(eligibleOrder.customerId?.toString(), setting);
  const purchases = getEligibleReferralItems(eligibleOrder);

  if (purchases.length === 0) {
    return { credited: false, reason: 'no_uncredited_paid_product' };
  }

  const results = [];
  for (const purchase of purchases) {
    results.push(await creditReferralForPurchase({
      order: eligibleOrder,
      purchase,
      setting,
      chain,
    }));
  }

  const creditedResults = results.filter((result) => result.credited);
  eligibleOrder.referralIncentiveCredited = getEligibleReferralItems(eligibleOrder).length === 0;
  if (eligibleOrder.referralIncentiveCredited) {
    eligibleOrder.referralIncentiveCreditedAt = new Date();
  }
  eligibleOrder.referralIncentivePool = roundMoney(
    (eligibleOrder.items || []).reduce((sum, item) => sum + Number(item.referralIncentivePool || 0), 0)
  );
  await eligibleOrder.save();

  return {
    credited: creditedResults.length > 0,
    incentivePool: roundMoney(results.reduce((sum, result) => sum + Number(result.incentivePool || 0), 0)),
    beneficiaries: creditedResults.reduce((sum, result) => sum + Number(result.beneficiaries || 0), 0),
    products: creditedResults.length,
    reason: creditedResults.length > 0 ? undefined : results[0]?.reason,
  };
};

const creditReferralIncentivesForCustomer = async (customerId, source = {}) => {
  const buyerCustomerId = String(customerId || '');
  if (!buyerCustomerId) {
    return { credited: false, reason: 'customer_not_eligible' };
  }
  const setting = await getReferralSetting();
  const incentiveAmount = roundMoney(setting.incentiveAmount || 0);
  const qualifyingAmount = roundMoney(setting.referralQualifyingAmount || 0);
  if (!setting.enabled || !setting.sbReferralEnabled || incentiveAmount <= 0) {
    return { credited: false, reason: 'referral_disabled' };
  }
  if (qualifyingAmount <= 0) {
    return { credited: false, reason: 'qualifying_amount_not_set' };
  }

  const chain = await buildDirectReferrerChain(buyerCustomerId);
  if (chain.length === 0) {
    return { credited: false, reason: 'no_direct_referrer' };
  }

  const sbPaidAmount = await getCustomerCumulativeSBPaidAmount(buyerCustomerId);
  if (sbPaidAmount < qualifyingAmount) {
    return { credited: false, reason: 'sb_qualifying_amount_not_reached', sbPaidAmount, qualifyingAmount };
  }

  const beneficiaryCustomerId = chain[0];
  const sourceOrderId = `SB_REFERRAL:${buyerCustomerId}`;
  const existingLedger = await ReferralLedger.findOne({ sourceOrderId, beneficiaryCustomerId }).lean();
  if (existingLedger) {
    return { credited: false, reason: 'already_credited', sbPaidAmount, qualifyingAmount };
  }

  const beneficiary = await Customer.findById(beneficiaryCustomerId).select('branchId accountManagerId').lean();
  if (!beneficiary) {
    return { credited: false, reason: 'referrer_not_found' };
  }

  const incentivePool = incentiveAmount;
  if (incentivePool <= 0) {
    return { credited: false, reason: 'empty_pool' };
  }

  const creditedAt = new Date();
  const ledgerEntry = {
    beneficiaryCustomerId,
    buyerCustomerId,
    sourceOrderId,
    sourceOrderNumber: source.orderNumber || source.SBAccountNumber || source.sourceOrderNumber || 'SB Referral Qualification',
    sourceItemId: '',
    productName: 'SB Referral Qualification',
    chainLevel: 1,
    purchaseAmount: sbPaidAmount,
    incentivePercentage: 0,
    incentivePool,
    amount: incentivePool,
    incentiveType: 'sb_qualification',
    status: 'credited',
    branchId: beneficiary.branchId || '',
    accountManagerId: beneficiary.accountManagerId || '',
    creditedAt,
  };

  const result = await ReferralLedger.updateOne(
    { sourceOrderId, beneficiaryCustomerId },
    { $setOnInsert: ledgerEntry },
    { upsert: true }
  );

  if (result.upsertedCount <= 0) {
    return { credited: false, reason: 'already_credited', sbPaidAmount, qualifyingAmount };
  }

  await Customer.findByIdAndUpdate(beneficiaryCustomerId, {
    $inc: {
      referralIncentiveBalance: incentivePool,
      referralIncentiveTotalEarned: incentivePool,
    },
  });

  return { credited: true, incentivePool, beneficiaries: 1, products: 0, sbPaidAmount, qualifyingAmount };
};

const creditPendingSBReferralIncentives = async ({ referrerCustomerId = '' } = {}) => {
  const query = {
    referredBy: { $exists: true, $ne: '' },
  };

  if (referrerCustomerId) {
    query.referredBy = String(referrerCustomerId);
  }

  const referredCustomers = await Customer.find(query).select('_id').lean();
  const results = [];

  for (const referredCustomer of referredCustomers) {
    results.push(await creditReferralIncentivesForCustomer(referredCustomer._id.toString(), {
      sourceOrderNumber: 'SB Referral Qualification',
    }));
  }

  return {
    checked: referredCustomers.length,
    credited: results.filter((result) => result.credited).length,
    results,
  };
};

const creditReferralIncentivesForOrder = async (order) => {
  if (!order) {
    return { credited: false, reason: 'order_not_eligible' };
  }

  const [product, sbQualification] = await Promise.all([
    creditProductReferralIncentivesForOrder(order),
    creditReferralIncentivesForCustomer(order.customerId?.toString(), {
    orderNumber: order.orderNumber,
    SBAccountNumber: order.SBAccountNumber,
    }),
  ]);

  return {
    credited: Boolean(product.credited || sbQualification.credited),
    product,
    sbQualification,
    incentivePool: roundMoney(Number(product.incentivePool || 0) + Number(sbQualification.incentivePool || 0)),
    beneficiaries: Number(product.beneficiaries || 0) + Number(sbQualification.beneficiaries || 0),
    reason: product.credited || sbQualification.credited ? undefined : `${product.reason || 'product_not_credited'}; ${sbQualification.reason || 'sb_not_credited'}`,
  };
};

const creditPaidOrderByNumber = async (orderNumber = '') => {
  const order = await EcommerceOrder.findOne({ orderNumber: String(orderNumber || '').trim() });
  if (!order) {
    throw new Error('Order not found');
  }

  return await creditReferralIncentivesForOrder(order);
};

const creditFirstLoginBonus = async (customerId) => {
  const setting = await getReferralSetting();
  const amount = roundMoney(setting.loginBonusAmount || 0);
  if (!setting.loginBonusEnabled || amount <= 0) {
    return { credited: false, reason: 'login_bonus_disabled' };
  }

  const creditedAt = new Date();
  const customer = await Customer.findOneAndUpdate(
    {
      _id: customerId,
      loginBonusCredited: { $ne: true },
    },
    {
      $inc: {
        loginBonusBalance: amount,
        loginBonusTotalEarned: amount,
      },
      $set: {
        loginBonusCredited: true,
        loginBonusCreditedAt: creditedAt,
      },
    },
    { new: true }
  ).select('-password');

  if (!customer) {
    return { credited: false, reason: 'already_credited' };
  }

  await BonusLedger.create({
    type: 'first_login',
    customerId: customer._id.toString(),
    amount,
    branchId: customer.branchId || '',
    accountManagerId: customer.accountManagerId || '',
    creditedAt,
  });

  return {
    credited: true,
    amount,
    loginBonusBalance: roundMoney(customer.loginBonusBalance || 0),
    loginBonusTotalEarned: roundMoney(customer.loginBonusTotalEarned || 0),
    loginBonusCreditedAt: customer.loginBonusCreditedAt || creditedAt,
  };
};

const creditTransactionBonusForDeposit = async (customerId, depositAmount = 0, source = {}) => {
  const normalizedDepositAmount = roundMoney(depositAmount || 0);
  if (!Number.isFinite(normalizedDepositAmount) || normalizedDepositAmount <= 0) {
    return { credited: false, reason: 'invalid_deposit_amount' };
  }
  if (!isEcommerceTransactionBonusSource(source)) {
    return { credited: false, reason: 'not_ecommerce_transaction' };
  }

  const setting = await getReferralSetting();
  const percentage = Number(setting.transactionBonusPercentage || 0);
  if (!setting.transactionBonusEnabled || percentage <= 0) {
    return { credited: false, reason: 'transaction_bonus_disabled' };
  }

  const amount = roundMoney((normalizedDepositAmount * percentage) / 100);
  if (amount <= 0) {
    return { credited: false, reason: 'transaction_bonus_zero' };
  }

  const transactionRef = String(source.transactionRef || source.reference || '').trim();
  if (!transactionRef) {
    return { credited: false, reason: 'missing_transaction_reference' };
  }

  const creditedAt = new Date();
  const existingLedger = await BonusLedger.findOne({
    type: 'transaction',
    customerId: customerId.toString(),
    transactionRef,
  }).lean();
  if (existingLedger) {
    const customer = await Customer.findById(customerId).select('-password').lean();
    return {
      credited: false,
      reason: 'already_credited',
      amount: roundMoney(existingLedger.amount || 0),
      percentage: Number(existingLedger.percentage || percentage),
      depositAmount: roundMoney(existingLedger.depositAmount || normalizedDepositAmount),
      transactionBonusBalance: roundMoney(customer?.transactionBonusBalance || 0),
      transactionBonusTotalEarned: roundMoney(customer?.transactionBonusTotalEarned || 0),
      transactionBonusLastCreditedAt: customer?.transactionBonusLastCreditedAt || existingLedger.creditedAt || null,
    };
  }

  let customer = await Customer.findById(customerId).select('-password');
  if (!customer) {
    throw new Error('Customer not found');
  }

  const ledgerResult = await BonusLedger.updateOne(
    { type: 'transaction', customerId: customer._id.toString(), transactionRef },
    {
      $setOnInsert: {
        type: 'transaction',
        customerId: customer._id.toString(),
        amount,
        depositAmount: normalizedDepositAmount,
        percentage,
        transactionRef,
        narration: source.narration || '',
        branchId: customer.branchId || '',
        accountManagerId: customer.accountManagerId || '',
        creditedAt,
      },
    },
    { upsert: true }
  );

  if (ledgerResult.upsertedCount <= 0) {
    customer = await Customer.findById(customerId).select('-password');
    return {
      credited: false,
      reason: 'already_credited',
      amount,
      percentage,
      depositAmount: normalizedDepositAmount,
      transactionBonusBalance: roundMoney(customer?.transactionBonusBalance || 0),
      transactionBonusTotalEarned: roundMoney(customer?.transactionBonusTotalEarned || 0),
      transactionBonusLastCreditedAt: customer?.transactionBonusLastCreditedAt || creditedAt,
    };
  }

  customer = await Customer.findByIdAndUpdate(
    customerId,
    {
      $inc: {
        transactionBonusBalance: amount,
        transactionBonusTotalEarned: amount,
      },
      $set: {
        transactionBonusLastCreditedAt: creditedAt,
      },
    },
    { new: true }
  ).select('-password');

  return {
    credited: true,
    amount,
    percentage,
    depositAmount: normalizedDepositAmount,
    transactionBonusBalance: roundMoney(customer.transactionBonusBalance || 0),
    transactionBonusTotalEarned: roundMoney(customer.transactionBonusTotalEarned || 0),
    transactionBonusLastCreditedAt: customer.transactionBonusLastCreditedAt || creditedAt,
  };
};

const creditPendingTransactionBonusesForCustomer = async (customerId) => {
  const normalizedCustomerId = String(customerId || '');
  if (!normalizedCustomerId) {
    return { checked: 0, credited: 0, reason: 'customer_not_eligible', results: [] };
  }
  if (!isValidObjectIdString(normalizedCustomerId)) {
    return { checked: 0, credited: 0, reason: 'invalid_customer_id', results: [] };
  }

  const setting = await getReferralSetting();
  const percentage = Number(setting.transactionBonusPercentage || 0);
  if (!setting.transactionBonusEnabled || percentage <= 0) {
    return { checked: 0, credited: 0, reason: 'transaction_bonus_disabled', results: [] };
  }

  const [transactions, existingLedgers] = await Promise.all([
    AccountTransaction.find({
      customerId: normalizedCustomerId,
      package: 'Wallet',
      direction: 'Credit',
      narration: ECOMMERCE_TRANSACTION_BONUS_DEPOSIT_NARRATION_PATTERN,
    })
      .sort({ createdAt: 1 })
      .lean(),
    BonusLedger.find({
      type: 'transaction',
      customerId: normalizedCustomerId,
    }).lean(),
  ]);

  const depositTransactions = transactions.filter((transaction) => (
    !BONUS_TRANSFER_NARRATION_PATTERN.test(String(transaction.narration || ''))
    && Number(transaction.amount || 0) > 0
  ));
  const ledgerRefs = new Set(
    existingLedgers
      .map((ledger) => String(ledger.transactionRef || '').trim())
      .filter(Boolean)
  );
  let legacyLedgerAmount = roundMoney(
    existingLedgers
      .filter((ledger) => !String(ledger.transactionRef || '').trim())
      .reduce((sum, ledger) => sum + Number(ledger.amount || 0), 0)
  );
  const results = [];

  for (const transaction of depositTransactions) {
    const transactionRef = String(transaction.transactionRef || transaction._id || '').trim();
    const expectedBonusAmount = roundMoney((Number(transaction.amount || 0) * percentage) / 100);
    if (expectedBonusAmount <= 0) continue;

    if (transactionRef && ledgerRefs.has(transactionRef)) {
      results.push({ credited: false, reason: 'already_credited', transactionRef });
      continue;
    }

    if (legacyLedgerAmount >= expectedBonusAmount) {
      legacyLedgerAmount = roundMoney(legacyLedgerAmount - expectedBonusAmount);
      results.push({ credited: false, reason: 'covered_by_legacy_ledger', transactionRef });
      continue;
    }

    const result = await creditTransactionBonusForDeposit(normalizedCustomerId, transaction.amount, {
      transactionRef,
      narration: transaction.narration || '',
    });
    results.push(result);

    if (transactionRef && result.credited) {
      ledgerRefs.add(transactionRef);
    }
  }

  return {
    checked: depositTransactions.length,
    credited: results.filter((result) => result.credited).length,
    results,
  };
};

const creditPendingTransactionBonuses = async () => {
  const transactions = await AccountTransaction.find({
    package: 'Wallet',
    direction: 'Credit',
    narration: ECOMMERCE_TRANSACTION_BONUS_DEPOSIT_NARRATION_PATTERN,
  }).select('customerId narration').lean();
  const customerIds = [...new Set(
    transactions
      .filter((transaction) => !BONUS_TRANSFER_NARRATION_PATTERN.test(String(transaction.narration || '')))
      .map((transaction) => String(transaction.customerId || ''))
      .filter(isValidObjectIdString)
      .filter(Boolean)
  )];
  const results = [];

  for (const customerId of customerIds) {
    results.push(await creditPendingTransactionBonusesForCustomer(customerId));
  }

  return {
    checked: customerIds.length,
    credited: results.reduce((sum, result) => sum + Number(result.credited || 0), 0),
    results,
  };
};

const transferReferralIncentiveToWallet = async (customerId, requestedAmount = 0) => {
  const customer = await Customer.findById(customerId);
  if (!customer) {
    throw new Error('Customer not found');
  }

  const availableBalance = roundMoney(customer.referralIncentiveBalance || 0);
  const amount = requestedAmount
    ? roundMoney(requestedAmount)
    : availableBalance;

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('No referral incentive balance available to transfer');
  }

  if (amount > availableBalance) {
    throw new Error(`Insufficient referral incentive balance. Available: ₦${availableBalance.toLocaleString()}, Requested: ₦${amount.toLocaleString()}`);
  }

  const account = await ensureCustomerSBOrderWallet(customer);
  const transferredAt = new Date();
  const debitedCustomer = await Customer.findOneAndUpdate(
    {
      _id: customer._id,
      referralIncentiveBalance: { $gte: amount },
    },
    {
      $inc: { referralIncentiveBalance: -amount },
      $set: { referralIncentiveTransferredAt: transferredAt },
    },
    { new: true }
  ).select('-password');

  if (!debitedCustomer) {
    throw new Error('Referral incentive balance changed. Please refresh and try again.');
  }

  let creditedAccountId = null;
  try {
    const transactionRef = `REFERRAL_TO_WALLET_${customer._id}_${Date.now()}`;
    const updatedAccount = await Account.findByIdAndUpdate(
      account._id,
      {
        $inc: {
          availableBalance: amount,
          ledgerBalance: amount,
        },
        $set: {
          accountNumber: account.accountNumber,
          walletType: 'sb_order_wallet',
          status: 'active',
        },
      },
      { new: true }
    );
    creditedAccountId = updatedAccount?._id;
    if (!updatedAccount) {
      throw new Error('Wallet account could not be updated');
    }

    const reportingActor = getReportingStaffId(
      updatedAccount.accountManagerId || debitedCustomer.accountManagerId,
      debitedCustomer._id.toString()
    );

    const transaction = await AccountTransactionService.DepositTransactionAccount({
      createdBy: reportingActor,
      transactionOwnerId: debitedCustomer._id.toString(),
      customerId: debitedCustomer._id.toString(),
      amount,
      balance: Number(updatedAccount.availableBalance || 0),
      branchId: updatedAccount.branchId || debitedCustomer.branchId || '',
      accountManagerId: updatedAccount.accountManagerId || debitedCustomer.accountManagerId || 'ECOMMERCE_SYSTEM',
      accountNumber: updatedAccount.accountNumber,
      accountTypeId: updatedAccount._id.toString(),
      date: formatTransactionDate(),
      narration: `Referral Incentive Transfer to Wallet - Ref: ${transactionRef}`,
      transactionRef,
      package: 'Wallet',
      direction: 'Credit',
      excludeFromStaffStats: true,
    });

    return {
      transferredAmount: amount,
      referralIncentiveBalance: roundMoney(debitedCustomer.referralIncentiveBalance || 0),
      referralIncentiveTotalEarned: roundMoney(debitedCustomer.referralIncentiveTotalEarned || 0),
      referralIncentiveTransferredAt: debitedCustomer.referralIncentiveTransferredAt || transferredAt,
      account: updatedAccount,
      transaction: transaction.newTransaction,
    };
  } catch (error) {
    if (creditedAccountId) {
      await Account.findByIdAndUpdate(creditedAccountId, {
        $inc: {
          availableBalance: -amount,
          ledgerBalance: -amount,
        },
      });
    }
    await Customer.findByIdAndUpdate(customer._id, {
      $inc: { referralIncentiveBalance: amount },
      $unset: { referralIncentiveTransferredAt: '' },
    });
    throw error;
  }
};

const transferLoginBonusToWallet = async (customerId, requestedAmount = 0) => {
  const customer = await Customer.findById(customerId);
  if (!customer) {
    throw new Error('Customer not found');
  }

  const availableBalance = roundMoney(customer.loginBonusBalance || 0);
  const amount = requestedAmount
    ? roundMoney(requestedAmount)
    : availableBalance;

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('No login bonus balance available to transfer');
  }

  if (amount > availableBalance) {
    throw new Error(`Insufficient login bonus balance. Available: ₦${availableBalance.toLocaleString()}, Requested: ₦${amount.toLocaleString()}`);
  }

  const account = await ensureCustomerSBOrderWallet(customer);
  const transferredAt = new Date();
  const debitedCustomer = await Customer.findOneAndUpdate(
    {
      _id: customer._id,
      loginBonusBalance: { $gte: amount },
    },
    {
      $inc: { loginBonusBalance: -amount },
      $set: { loginBonusTransferredAt: transferredAt },
    },
    { new: true }
  ).select('-password');

  if (!debitedCustomer) {
    throw new Error('Login bonus balance changed. Please refresh and try again.');
  }

  let creditedAccountId = null;
  try {
    const transactionRef = `LOGIN_BONUS_TO_WALLET_${customer._id}_${Date.now()}`;
    const updatedAccount = await Account.findByIdAndUpdate(
      account._id,
      {
        $inc: {
          availableBalance: amount,
          ledgerBalance: amount,
        },
        $set: {
          accountNumber: account.accountNumber,
          walletType: 'sb_order_wallet',
          status: 'active',
        },
      },
      { new: true }
    );
    creditedAccountId = updatedAccount?._id;
    if (!updatedAccount) {
      throw new Error('Wallet account could not be updated');
    }

    const reportingActor = getReportingStaffId(
      updatedAccount.accountManagerId || debitedCustomer.accountManagerId,
      debitedCustomer._id.toString()
    );

    const transaction = await AccountTransactionService.DepositTransactionAccount({
      createdBy: reportingActor,
      transactionOwnerId: debitedCustomer._id.toString(),
      customerId: debitedCustomer._id.toString(),
      amount,
      balance: Number(updatedAccount.availableBalance || 0),
      branchId: updatedAccount.branchId || debitedCustomer.branchId || '',
      accountManagerId: updatedAccount.accountManagerId || debitedCustomer.accountManagerId || 'ECOMMERCE_SYSTEM',
      accountNumber: updatedAccount.accountNumber,
      accountTypeId: updatedAccount._id.toString(),
      date: formatTransactionDate(),
      narration: `First Login Bonus Transfer to Wallet - Ref: ${transactionRef}`,
      transactionRef,
      package: 'Wallet',
      direction: 'Credit',
      excludeFromStaffStats: true,
    });

    return {
      transferredAmount: amount,
      loginBonusBalance: roundMoney(debitedCustomer.loginBonusBalance || 0),
      loginBonusTotalEarned: roundMoney(debitedCustomer.loginBonusTotalEarned || 0),
      loginBonusCredited: Boolean(debitedCustomer.loginBonusCredited),
      loginBonusCreditedAt: debitedCustomer.loginBonusCreditedAt || null,
      loginBonusTransferredAt: debitedCustomer.loginBonusTransferredAt || transferredAt,
      account: updatedAccount,
      transaction: transaction.newTransaction,
    };
  } catch (error) {
    if (creditedAccountId) {
      await Account.findByIdAndUpdate(creditedAccountId, {
        $inc: {
          availableBalance: -amount,
          ledgerBalance: -amount,
        },
      });
    }
    await Customer.findByIdAndUpdate(customer._id, {
      $inc: { loginBonusBalance: amount },
      $unset: { loginBonusTransferredAt: '' },
    });
    throw error;
  }
};

const transferTransactionBonusToWallet = async (customerId, requestedAmount = 0) => {
  const customer = await Customer.findById(customerId);
  if (!customer) {
    throw new Error('Customer not found');
  }

  const availableBalance = roundMoney(customer.transactionBonusBalance || 0);
  const amount = requestedAmount
    ? roundMoney(requestedAmount)
    : availableBalance;

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('No transaction bonus balance available to transfer');
  }

  if (amount > availableBalance) {
    throw new Error(`Insufficient transaction bonus balance. Available: ₦${availableBalance.toLocaleString()}, Requested: ₦${amount.toLocaleString()}`);
  }

  const account = await ensureCustomerSBOrderWallet(customer);
  const transferredAt = new Date();
  const debitedCustomer = await Customer.findOneAndUpdate(
    {
      _id: customer._id,
      transactionBonusBalance: { $gte: amount },
    },
    {
      $inc: { transactionBonusBalance: -amount },
      $set: { transactionBonusTransferredAt: transferredAt },
    },
    { new: true }
  ).select('-password');

  if (!debitedCustomer) {
    throw new Error('Transaction bonus balance changed. Please refresh and try again.');
  }

  let creditedAccountId = null;
  try {
    const transactionRef = `TRANSACTION_BONUS_TO_WALLET_${customer._id}_${Date.now()}`;
    const updatedAccount = await Account.findByIdAndUpdate(
      account._id,
      {
        $inc: {
          availableBalance: amount,
          ledgerBalance: amount,
        },
        $set: {
          accountNumber: account.accountNumber,
          walletType: 'sb_order_wallet',
          status: 'active',
        },
      },
      { new: true }
    );
    creditedAccountId = updatedAccount?._id;
    if (!updatedAccount) {
      throw new Error('Wallet account could not be updated');
    }

    const reportingActor = getReportingStaffId(
      updatedAccount.accountManagerId || debitedCustomer.accountManagerId,
      debitedCustomer._id.toString()
    );

    const transaction = await AccountTransactionService.DepositTransactionAccount({
      createdBy: reportingActor,
      transactionOwnerId: debitedCustomer._id.toString(),
      customerId: debitedCustomer._id.toString(),
      amount,
      balance: Number(updatedAccount.availableBalance || 0),
      branchId: updatedAccount.branchId || debitedCustomer.branchId || '',
      accountManagerId: updatedAccount.accountManagerId || debitedCustomer.accountManagerId || 'ECOMMERCE_SYSTEM',
      accountNumber: updatedAccount.accountNumber,
      accountTypeId: updatedAccount._id.toString(),
      date: formatTransactionDate(),
      narration: `Transaction Bonus Transfer to Wallet - Ref: ${transactionRef}`,
      transactionRef,
      package: 'Wallet',
      direction: 'Credit',
      excludeFromStaffStats: true,
    });

    return {
      transferredAmount: amount,
      transactionBonusBalance: roundMoney(debitedCustomer.transactionBonusBalance || 0),
      transactionBonusTotalEarned: roundMoney(debitedCustomer.transactionBonusTotalEarned || 0),
      transactionBonusLastCreditedAt: debitedCustomer.transactionBonusLastCreditedAt || null,
      transactionBonusTransferredAt: debitedCustomer.transactionBonusTransferredAt || transferredAt,
      account: updatedAccount,
      transaction: transaction.newTransaction,
    };
  } catch (error) {
    if (creditedAccountId) {
      await Account.findByIdAndUpdate(creditedAccountId, {
        $inc: {
          availableBalance: -amount,
          ledgerBalance: -amount,
        },
      });
    }
    await Customer.findByIdAndUpdate(customer._id, {
      $inc: { transactionBonusBalance: amount },
      $unset: { transactionBonusTransferredAt: '' },
    });
    throw error;
  }
};

module.exports = {
  getReferralSetting,
  resolveSignupReferral,
  updateReferralSettings,
  getReferralAdminSummary,
  getCustomerReferralSummary,
  searchCustomers,
  creditFirstLoginBonus,
  creditTransactionBonusForDeposit,
  creditPendingTransactionBonusesForCustomer,
  creditPendingTransactionBonuses,
  creditReferralIncentivesForCustomer,
  creditPendingSBReferralIncentives,
  creditReferralIncentivesForOrder,
  creditPaidOrderByNumber,
  transferReferralIncentiveToWallet,
  transferLoginBonusToWallet,
  transferTransactionBonusToWallet,
};
