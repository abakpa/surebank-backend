const Customer = require('../../Customer/Model');
const EcommerceOrder = require('../../EcommerceOrder/Model');
const Account = require('../../Account/Model');
const AccountTransactionService = require('../../AccountTransaction/Service');
const ReferralSetting = require('../Model/ReferralSetting');
const ReferralLedger = require('../Model/ReferralLedger');
const BonusLedger = require('../Model/BonusLedger');

const normalizePhoneNumber = (value = '') => String(value || '').replace(/\D/g, '');
const roundMoney = (value = 0) => Math.round(Number(value || 0) * 100) / 100;
const isValidObjectIdString = (value = '') => /^[a-f\d]{24}$/i.test(String(value || ''));

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
      incentivePercentage: 0,
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
  incentivePercentage,
  enabled,
  loginBonusEnabled,
  loginBonusAmount,
  transactionBonusEnabled,
  transactionBonusPercentage,
  rootCustomerIds = [],
  staffId = '',
}) => {
  const percentage = Number(incentivePercentage || 0);
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    throw new Error('Referral incentive percentage must be between 0 and 100');
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
        incentivePercentage: percentage,
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
      incentivePercentage: Number(setting.incentivePercentage || 0),
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
  const customer = await Customer.findById(customerId).select('-password').lean();
  if (!customer) {
    throw new Error('Customer not found');
  }

  const [recentEarnings, referralCount] = await Promise.all([
    ReferralLedger.find({ beneficiaryCustomerId: customerId.toString() })
      .sort({ creditedAt: -1, createdAt: -1 })
      .limit(10)
      .lean(),
    Customer.countDocuments({ referredBy: customerId.toString() }),
  ]);

  return {
    referralCode: customer.phone,
    referralIncentiveBalance: roundMoney(customer.referralIncentiveBalance || 0),
    referralIncentiveTotalEarned: roundMoney(customer.referralIncentiveTotalEarned || 0),
    loginBonusBalance: roundMoney(customer.loginBonusBalance || 0),
    loginBonusTotalEarned: roundMoney(customer.loginBonusTotalEarned || 0),
    loginBonusCredited: Boolean(customer.loginBonusCredited),
    loginBonusCreditedAt: customer.loginBonusCreditedAt || null,
    loginBonusTransferredAt: customer.loginBonusTransferredAt || null,
    transactionBonusBalance: roundMoney(customer.transactionBonusBalance || 0),
    transactionBonusTotalEarned: roundMoney(customer.transactionBonusTotalEarned || 0),
    transactionBonusLastCreditedAt: customer.transactionBonusLastCreditedAt || null,
    transactionBonusTransferredAt: customer.transactionBonusTransferredAt || null,
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
  if (!setting.enabled || percentage <= 0) {
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
      status: 'credited',
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

const creditReferralIncentivesForOrder = async (order) => {
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

const creditPaidOrderByNumber = async (orderNumber = '') => {
  const order = await EcommerceOrder.findOne({ orderNumber: String(orderNumber || '').trim() });
  if (!order) {
    throw new Error('Order not found');
  }

  const eligiblePaidItems = getEligibleReferralItems(order);
  if (!isOrderFullyPaidForReferral(order) && eligiblePaidItems.length === 0) {
    throw new Error('Referral incentives can only be credited after a product is fully paid');
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

const creditTransactionBonusForDeposit = async (customerId, depositAmount = 0) => {
  const normalizedDepositAmount = roundMoney(depositAmount || 0);
  if (!Number.isFinite(normalizedDepositAmount) || normalizedDepositAmount <= 0) {
    return { credited: false, reason: 'invalid_deposit_amount' };
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

  const creditedAt = new Date();
  const customer = await Customer.findByIdAndUpdate(
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

  if (!customer) {
    throw new Error('Customer not found');
  }

  await BonusLedger.create({
    type: 'transaction',
    customerId: customer._id.toString(),
    amount,
    depositAmount: normalizedDepositAmount,
    percentage,
    branchId: customer.branchId || '',
    accountManagerId: customer.accountManagerId || '',
    creditedAt,
  });

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
  const debitedCustomer = await Customer.findOneAndUpdate(
    {
      _id: customer._id,
      referralIncentiveBalance: { $gte: amount },
    },
    {
      $inc: { referralIncentiveBalance: -amount },
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
  creditReferralIncentivesForOrder,
  creditPaidOrderByNumber,
  transferReferralIncentiveToWallet,
  transferLoginBonusToWallet,
  transferTransactionBonusToWallet,
};
