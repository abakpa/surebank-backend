const Account = require('../../Account/Model');
const AccountTransaction = require('../../AccountTransaction/Model');
const Branch = require('../../Branch/Model');
const Customer = require('../../Customer/Model');
const DSAccount = require('../../DSAccount/Model');
const EcommerceOrder = require('../../EcommerceOrder/Model');
const Expenditure = require('../../Expenditure/Model');
const FDAccount = require('../../FDAccount/Model');
const Product = require('../../Product/Model');
const ProductReview = require('../../ProductReview/Model');
const SBAccount = require('../../SBAccount/Model');
const Staff = require('../../Staff/Model');

const sum = (items, field) => items.reduce((total, item) => total + Number(item[field] || 0), 0);

const countBy = (items, getKey) => items.reduce((acc, item) => {
  const key = getKey(item) || 'unknown';
  acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {});

const money = (value) => Number(value || 0);

const getDateRangeQuery = (days) => {
  const safeDays = Number(days || 30);
  const start = new Date();
  start.setDate(start.getDate() - safeDays);
  start.setHours(0, 0, 0, 0);
  return { $gte: start, $lte: new Date() };
};

const getOrderOutstanding = (order) => {
  if (order.paymentType === 'installment') {
    return money(order.installmentPlan?.remainingBalance);
  }
  return order.paymentStatus === 'paid' ? 0 : money(order.totalAmount);
};

const getOrderPaid = (order) => {
  if (order.paymentType === 'installment') {
    return money(order.installmentPlan?.totalPaid);
  }
  return order.paymentStatus === 'paid' ? money(order.totalAmount) : 0;
};

const buildName = (person) => {
  const name = `${person?.firstName || ''} ${person?.lastName || ''}`.trim();
  return name || person?.phone || 'N/A';
};

const getAnalytics = async ({ days = 30 } = {}) => {
  const rangeQuery = getDateRangeQuery(days);

  const [
    branches,
    staffs,
    customers,
    accounts,
    dsAccounts,
    sbAccounts,
    fdAccounts,
    products,
    orders,
    recentOrders,
    transactions,
    expenditures,
    reviews
  ] = await Promise.all([
    Branch.find({ isActive: { $ne: false } }).lean(),
    Staff.find({}).select('firstName lastName role branchId status').lean(),
    Customer.find({}).select('firstName lastName phone branchId accountManagerId createdAt').lean(),
    Account.find({}).lean(),
    DSAccount.find({}).lean(),
    SBAccount.find({}).lean(),
    FDAccount.find({}).lean(),
    Product.find({}).lean(),
    EcommerceOrder.find({}).lean(),
    EcommerceOrder.find({ createdAt: rangeQuery }).lean(),
    AccountTransaction.find({ createdAt: rangeQuery }).lean(),
    Expenditure.find({ status: 1, createdAt: rangeQuery }).lean(),
    ProductReview.find({}).lean()
  ]);

  const branchNameById = new Map(branches.map((branch) => [branch._id.toString(), branch.name]));
  const staffNameById = new Map(staffs.map((staff) => [staff._id.toString(), buildName(staff)]));

  const nonCompletedOrders = orders.filter((order) => !['completed', 'cancelled'].includes(order.status));
  const completedOrders = orders.filter((order) => order.status === 'completed');
  const ecommerceOrderValue = sum(orders, 'totalAmount');
  const ecommercePaidValue = orders.reduce((total, order) => total + getOrderPaid(order), 0);
  const ecommerceOutstandingValue = orders.reduce((total, order) => total + getOrderOutstanding(order), 0);
  const recentOrderValue = sum(recentOrders, 'totalAmount');
  const recentPaidValue = recentOrders.reduce((total, order) => total + getOrderPaid(order), 0);
  const recentOutstandingValue = recentOrders.reduce((total, order) => total + getOrderOutstanding(order), 0);

  const walletAvailable = sum(accounts, 'availableBalance');
  const walletLedger = sum(accounts, 'ledgerBalance');
  const dsTotalContribution = sum(dsAccounts, 'totalContribution');
  const sbSellingValue = sum(sbAccounts, 'sellingPrice');
  const sbCollectedValue = sum(sbAccounts, 'balance');
  const sbOutstandingValue = Math.max(0, sbSellingValue - sbCollectedValue);
  const fdPrincipal = sum(fdAccounts, 'fdamount');
  const fdMaturityValue = sum(fdAccounts, 'totalAmount');
  const fdInterestExpense = sum(fdAccounts, 'expenseInterest');
  const expenditureTotal = sum(expenditures, 'amount');

  const transactionCredit = transactions
    .filter((transaction) => transaction.direction === 'Credit')
    .reduce((total, transaction) => total + money(transaction.amount), 0);
  const transactionDebit = transactions
    .filter((transaction) => transaction.direction === 'Debit')
    .reduce((total, transaction) => total + money(transaction.amount), 0);

  const demandByProduct = new Map();
  const topProducts = new Map();
  orders.forEach((order) => {
    (order.items || []).forEach((item) => {
      const productId = item.productId?.toString();
      if (!productId) return;

      const top = topProducts.get(productId) || {
        productId,
        productName: item.productName,
        quantity: 0,
        value: 0
      };
      top.quantity += Number(item.quantity || 0);
      top.value += money(item.subtotal);
      topProducts.set(productId, top);

      if (!['completed', 'cancelled'].includes(order.status)) {
        const demand = demandByProduct.get(productId) || {
          productId,
          productName: item.productName,
          orderIds: new Set(),
          customerIds: new Set(),
          quantity: 0,
          outstanding: 0
        };
        demand.orderIds.add(order._id.toString());
        if (order.customerId) demand.customerIds.add(order.customerId.toString());
        demand.quantity += Number(item.quantity || 0);
        demand.outstanding += getOrderOutstanding(order);
        demandByProduct.set(productId, demand);
      }
    });
  });

  const productDemand = Array.from(demandByProduct.values())
    .map((item) => ({
      productId: item.productId,
      productName: item.productName,
      activeOrderCount: item.orderIds.size,
      activeCustomerCount: item.customerIds.size,
      totalQuantity: item.quantity,
      outstanding: item.outstanding
    }))
    .sort((a, b) => b.activeOrderCount - a.activeOrderCount)
    .slice(0, 10);

  const topSellingProducts = Array.from(topProducts.values())
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const branchPerformance = branches.map((branch) => {
    const branchId = branch._id.toString();
    const branchCustomers = customers.filter((customer) => String(customer.branchId || '') === branchId);
    const branchAccounts = accounts.filter((account) => String(account.branchId || '') === branchId);
    const branchOrders = orders.filter((order) => String(order.branchId || '') === branchId);
    const branchExpenditures = expenditures.filter((expense) => String(expense.branchId || '') === branchId);

    return {
      branchId,
      branchName: branch.name,
      customers: branchCustomers.length,
      walletAvailable: sum(branchAccounts, 'availableBalance'),
      ecommerceOrders: branchOrders.length,
      ecommerceValue: sum(branchOrders, 'totalAmount'),
      ecommerceOutstanding: branchOrders.reduce((total, order) => total + getOrderOutstanding(order), 0),
      expenditures: sum(branchExpenditures, 'amount')
    };
  }).sort((a, b) => b.ecommerceValue - a.ecommerceValue);

  const repPerformance = staffs
    .filter((staff) => ['Agent', 'OnlineRep'].includes(staff.role))
    .map((staff) => {
      const staffId = staff._id.toString();
      const repCustomers = customers.filter((customer) => String(customer.accountManagerId || '') === staffId);
      const repOrders = orders.filter((order) => String(order.accountManagerId || '') === staffId);
      return {
        staffId,
        staffName: buildName(staff),
        role: staff.role,
        branchName: branchNameById.get(String(staff.branchId || '')) || 'N/A',
        customers: repCustomers.length,
        ecommerceOrders: repOrders.length,
        ecommerceValue: sum(repOrders, 'totalAmount'),
        ecommerceOutstanding: repOrders.reduce((total, order) => total + getOrderOutstanding(order), 0)
      };
    })
    .sort((a, b) => b.ecommerceValue - a.ecommerceValue)
    .slice(0, 15);

  const recentDailyTrend = [];
  for (let i = Number(days || 30) - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    const dayOrders = recentOrders.filter((order) => order.createdAt?.toISOString().slice(0, 10) === key);
    const dayTransactions = transactions.filter((transaction) => transaction.createdAt?.toISOString().slice(0, 10) === key);
    recentDailyTrend.push({
      date: key,
      ecommerceValue: sum(dayOrders, 'totalAmount'),
      ecommercePaid: dayOrders.reduce((total, order) => total + getOrderPaid(order), 0),
      cashIn: dayTransactions
        .filter((transaction) => transaction.direction === 'Credit')
        .reduce((total, transaction) => total + money(transaction.amount), 0),
      cashOut: dayTransactions
        .filter((transaction) => transaction.direction === 'Debit')
        .reduce((total, transaction) => total + money(transaction.amount), 0)
    });
  }

  return {
    period: { days: Number(days || 30), from: rangeQuery.$gte, to: rangeQuery.$lte },
    overview: {
      branches: branches.length,
      staff: staffs.length,
      customers: customers.length,
      walletAccounts: accounts.length,
      products: products.length,
      activeProducts: products.filter((product) => product.isActive !== false).length,
      inactiveProducts: products.filter((product) => product.isActive === false).length,
      reviews: reviews.length
    },
    finance: {
      walletAvailable,
      walletLedger,
      dsTotalContribution,
      sbSellingValue,
      sbCollectedValue,
      sbOutstandingValue,
      fdPrincipal,
      fdMaturityValue,
      fdInterestExpense,
      transactionCredit,
      transactionDebit,
      expenditureTotal,
      netMovement: transactionCredit - transactionDebit - expenditureTotal
    },
    ecommerce: {
      totalOrders: orders.length,
      recentOrders: recentOrders.length,
      completedOrders: completedOrders.length,
      uncompletedOrders: nonCompletedOrders.length,
      totalOrderValue: ecommerceOrderValue,
      paidValue: ecommercePaidValue,
      outstandingValue: ecommerceOutstandingValue,
      recentOrderValue,
      recentPaidValue,
      recentOutstandingValue,
      statusBreakdown: countBy(orders, (order) => order.status),
      paymentBreakdown: countBy(orders, (order) => order.paymentStatus)
    },
    accounts: {
      ds: {
        total: dsAccounts.length,
        totalContribution: dsTotalContribution,
        statusBreakdown: countBy(dsAccounts, (account) => account.status)
      },
      sb: {
        total: sbAccounts.length,
        sellingValue: sbSellingValue,
        collectedValue: sbCollectedValue,
        outstandingValue: sbOutstandingValue,
        statusBreakdown: countBy(sbAccounts, (account) => account.status)
      },
      fd: {
        total: fdAccounts.length,
        principal: fdPrincipal,
        maturityValue: fdMaturityValue,
        interestExpense: fdInterestExpense,
        statusBreakdown: countBy(fdAccounts, (account) => account.status)
      }
    },
    productDemand,
    topSellingProducts,
    branchPerformance,
    repPerformance,
    recentDailyTrend,
    staffRoleBreakdown: countBy(staffs, (staff) => staff.role),
    customerBranchBreakdown: countBy(customers, (customer) => branchNameById.get(String(customer.branchId || '')) || 'Unknown'),
    generatedAt: new Date()
  };
};

module.exports = {
  getAnalytics
};
