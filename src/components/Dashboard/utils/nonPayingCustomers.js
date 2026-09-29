const AccountTransaction = require('../../AccountTransaction/Model/index');
const Customer = require('../../Customer/Model/index');
const Branch = require('../../Branch/Model/index');
const Staff = require('../../Staff/Model/index');
const DSAccount = require('../../DSAccount/Model/index');
const SBAccount = require('../../SBAccount/Model/index');
const Order = require('../../SBAccount/Model/order');
const EcommerceOrder = require('../../EcommerceOrder/Model/index');
const mongoose = require('mongoose');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toNumber = (value) => Number(value || 0);

const normalizePeriodDays = (period) => {
  const normalized = String(period || '').toLowerCase().trim();
  if (normalized.includes('30')) return 30;
  if (normalized.includes('14') || normalized.includes('2')) return 14;
  return 14;
};

const buildScopeQuery = ({ branchId, accountManagerId } = {}) => {
  const query = {};
  if (branchId) query.branchId = branchId;
  if (accountManagerId) query.accountManagerId = accountManagerId;
  return query;
};

const getCustomerName = (customer) => {
  if (!customer) return 'N/A';
  return `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'N/A';
};

const getStaffName = (staff) => {
  if (!staff) return 'N/A';
  return `${staff.firstName || ''} ${staff.lastName || ''}`.trim() || 'N/A';
};

const fetchLookupMaps = async (rows) => {
  const customerIds = [...new Set(rows.map((row) => row.customerId?.toString()).filter(mongoose.isValidObjectId))];
  const branchIds = [...new Set(rows.map((row) => row.branchId?.toString()).filter(mongoose.isValidObjectId))];
  const staffIds = [...new Set(rows.map((row) => row.accountManagerId?.toString()).filter(mongoose.isValidObjectId))];

  const [customers, branches, staff] = await Promise.all([
    Customer.find({ _id: { $in: customerIds } }).select('firstName lastName phone email').lean(),
    Branch.find({ _id: { $in: branchIds } }).select('name').lean(),
    Staff.find({ _id: { $in: staffIds } }).select('firstName lastName phone').lean(),
  ]);

  return {
    customerMap: new Map(customers.map((customer) => [customer._id.toString(), customer])),
    branchMap: new Map(branches.map((branch) => [branch._id.toString(), branch])),
    staffMap: new Map(staff.map((staffMember) => [staffMember._id.toString(), staffMember])),
  };
};

const getLastCreditMap = async (accountIds, packageName) => {
  if (!accountIds.length) return new Map();

  const transactions = await AccountTransaction.aggregate([
    {
      $match: {
        accountTypeId: { $in: accountIds },
        package: packageName,
        direction: 'Credit',
      },
    },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$accountTypeId',
        lastPaymentDate: { $first: '$createdAt' },
        lastPaymentAmount: { $first: '$amount' },
      },
    },
  ]);

  return new Map(transactions.map((transaction) => [transaction._id?.toString(), transaction]));
};

const getDaysSince = (date) => Math.floor((Date.now() - new Date(date).getTime()) / MS_PER_DAY);

const isOlderThanPeriod = (date, periodDays) => {
  if (!date) return false;
  return getDaysSince(date) >= periodDays;
};

const getSBOutstanding = (account) => {
  const itemTotal = (account.items || []).reduce((sum, item) => sum + toNumber(item.subtotal), 0);
  const itemPaid = (account.items || []).reduce((sum, item) => sum + toNumber(item.paidAmount), 0);
  const totalAmount = itemTotal || toNumber(account.sellingPrice);
  const paidAmount = itemTotal ? itemPaid : toNumber(account.balance);
  return Math.max(totalAmount - paidAmount, 0);
};

const getEcommerceLastPaymentDate = (order) => {
  const dates = [];
  (order.installmentPlan?.payments || []).forEach((payment) => {
    if (payment.status === 'paid' && payment.paidAt) dates.push(new Date(payment.paidAt));
  });
  (order.paymentReferences || []).forEach((payment) => {
    if (payment.createdAt) dates.push(new Date(payment.createdAt));
  });
  if (!dates.length) return order.createdAt;
  return new Date(Math.max(...dates.map((date) => date.getTime())));
};

const formatRow = ({ row, lookups, source, type, accountNumber, lastPaymentDate, lastPaymentAmount, outstandingBalance, expectedAmount }) => {
  const customer = lookups.customerMap.get(row.customerId?.toString());
  const branch = lookups.branchMap.get(row.branchId?.toString());
  const staff = lookups.staffMap.get(row.accountManagerId?.toString());

  return {
    id: row._id?.toString(),
    customerName: getCustomerName(customer),
    phone: customer?.phone || row.customerPhone || 'N/A',
    branchName: branch?.name || 'N/A',
    staffName: getStaffName(staff),
    type,
    source,
    accountNumber: accountNumber || 'N/A',
    lastPaymentDate,
    daysSinceLastPayment: getDaysSince(lastPaymentDate),
    lastPaymentAmount: toNumber(lastPaymentAmount),
    expectedAmount: toNumber(expectedAmount),
    outstandingBalance: toNumber(outstandingBalance),
    status: row.status || row.paymentStatus || 'N/A',
  };
};

const getDSNonPayingCustomers = async ({ period, branchId, accountManagerId } = {}) => {
  const periodDays = normalizePeriodDays(period);
  const accounts = await DSAccount.find({
    ...buildScopeQuery({ branchId, accountManagerId }),
    status: { $nin: ['closed', 'Closed', 'inactive', 'Inactive'] },
  }).lean();

  const creditMap = await getLastCreditMap(accounts.map((account) => account._id.toString()), 'DS');
  const lookups = await fetchLookupMaps(accounts);

  const customers = accounts
    .map((account) => {
      const lastCredit = creditMap.get(account._id.toString());
      const lastPaymentDate = lastCredit?.lastPaymentDate || account.createdAt;
      if (!isOlderThanPeriod(lastPaymentDate, periodDays)) return null;
      return formatRow({
        row: account,
        lookups,
        type: 'DS',
        source: 'DS Account',
        accountNumber: account.DSAccountNumber || account.accountNumber,
        lastPaymentDate,
        lastPaymentAmount: lastCredit?.lastPaymentAmount || 0,
        expectedAmount: account.amountPerDay,
        outstandingBalance: 0,
      });
    })
    .filter(Boolean)
    .sort((a, b) => b.daysSinceLastPayment - a.daysSinceLastPayment);

  return { count: customers.length, periodDays, customers };
};

const getSBAccountRows = async ({ periodDays, branchId, accountManagerId, Model, source }) => {
  const accounts = await Model.find({
    ...buildScopeQuery({ branchId, accountManagerId }),
    status: { $nin: ['sold', 'Sold', 'closed', 'Closed', 'cancelled', 'Cancelled'] },
  }).lean();

  const openAccounts = accounts.filter((account) => getSBOutstanding(account) > 0);
  const creditMap = await getLastCreditMap(openAccounts.map((account) => account._id.toString()), 'SB');
  const lookups = await fetchLookupMaps(openAccounts);

  return openAccounts
    .map((account) => {
      const lastCredit = creditMap.get(account._id.toString());
      const lastPaymentDate = lastCredit?.lastPaymentDate || account.createdAt;
      if (!isOlderThanPeriod(lastPaymentDate, periodDays)) return null;
      return formatRow({
        row: account,
        lookups,
        type: 'SB',
        source,
        accountNumber: account.SBAccountNumber || account.accountNumber,
        lastPaymentDate,
        lastPaymentAmount: lastCredit?.lastPaymentAmount || 0,
        expectedAmount: 0,
        outstandingBalance: getSBOutstanding(account),
      });
    })
    .filter(Boolean);
};

const getEcommerceRows = async ({ periodDays, branchId, accountManagerId }) => {
  const orders = await EcommerceOrder.find({
    ...buildScopeQuery({ branchId, accountManagerId }),
    status: { $nin: ['paid', 'completed', 'cancelled'] },
    paymentStatus: { $ne: 'paid' },
  }).lean();

  const openOrders = orders.filter((order) => {
    const remaining = order.installmentPlan?.remainingBalance;
    return remaining === undefined || toNumber(remaining) > 0;
  });
  const lookups = await fetchLookupMaps(openOrders);

  return openOrders
    .map((order) => {
      const lastPaymentDate = getEcommerceLastPaymentDate(order);
      if (!isOlderThanPeriod(lastPaymentDate, periodDays)) return null;
      return formatRow({
        row: order,
        lookups,
        type: 'SB',
        source: 'Ecommerce Order',
        accountNumber: order.orderNumber || order.SBAccountNumber || order.accountNumber,
        lastPaymentDate,
        lastPaymentAmount: 0,
        expectedAmount: order.installmentPlan?.amountPerPeriod || 0,
        outstandingBalance: order.installmentPlan?.remainingBalance ?? Math.max(toNumber(order.totalAmount) - toNumber(order.installmentPlan?.totalPaid), 0),
      });
    })
    .filter(Boolean);
};

const getSBNonPayingCustomers = async ({ period, branchId, accountManagerId } = {}) => {
  const periodDays = normalizePeriodDays(period);
  const [sbAccounts, oldOrders, ecommerceOrders] = await Promise.all([
    getSBAccountRows({ periodDays, branchId, accountManagerId, Model: SBAccount, source: 'SB Account' }),
    getSBAccountRows({ periodDays, branchId, accountManagerId, Model: Order, source: 'Old Backoffice SB Order' }),
    getEcommerceRows({ periodDays, branchId, accountManagerId }),
  ]);
  const customers = [...sbAccounts, ...oldOrders, ...ecommerceOrders].sort(
    (a, b) => b.daysSinceLastPayment - a.daysSinceLastPayment
  );

  return { count: customers.length, periodDays, customers };
};

module.exports = {
  getDSNonPayingCustomers,
  getSBNonPayingCustomers,
  normalizePeriodDays,
};
