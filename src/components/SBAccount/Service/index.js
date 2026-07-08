const Account = require('../../Account/Model');
const  generateUniqueAccountNumber  = require('../../generateAccountNumber');
const SBAccount = require('../Model/index');
const Order = require('../Model/order');
const EcommerceOrder = require('../../EcommerceOrder/Model/index');
const AccountTransaction = require('../../AccountTransaction/Service/index');
const AccountTransactionModel = require('../../AccountTransaction/Model/index');
const SureBankAccount = require('../../SureBankAccount/Service/index');
const ProductService = require('../../Product/Service/index');
const Product = require('../../Product/Model/index');
const ProductBranchStock = require('../../ProductBranchStock/Model/index');
const Customer = require('../../Customer/Model/index');
const Staff = require('../../Staff/Model/index');
const Branch = require('../../Branch/Model/index');
const sendSMS = require('../../sendSMS');

const getProductVariation = (product, variationId = '') => {
  if (!product || !variationId || !product.hasVariations || !Array.isArray(product.variations)) {
    return null;
  }

  return product.variations.id
    ? product.variations.id(variationId)
    : product.variations.find((variation) => String(variation._id || '') === String(variationId));
};

const getProductCostPrice = (product, variationId = '') => {
  const variation = getProductVariation(product, variationId);
  if (variation) {
    return Number(variation.costPrice || 0);
  }

  return Number(product?.costPrice || 0);
};

const getProductSellingPrice = (product, variationId = '') => {
  const variation = getProductVariation(product, variationId);
  if (variation) {
    return Number(variation.price || 0);
  }

  return Number(product?.price || 0);
};

const buildSBOrderWalletAccountNumber = (customer) => `${customer.phone}-SBW`;

const ensureSBOrderWalletForSBAccount = async (sbaccount) => {
  let walletAccount = await Account.findOne({
    customerId: sbaccount.customerId,
    walletType: 'sb_order_wallet'
  });

  if (walletAccount) {
    return walletAccount;
  }

  const customer = await Customer.findById(sbaccount.customerId);
  if (!customer) {
    throw new Error('Customer not found for SB order wallet');
  }

  walletAccount = await Account.create({
    customerId: customer._id.toString(),
    accountNumber: buildSBOrderWalletAccountNumber(customer),
    walletType: 'sb_order_wallet',
    createdBy: 'ECOMMERCE_SYSTEM',
    branchId: sbaccount.branchId || customer.branchId || '',
    accountManagerId: sbaccount.accountManagerId || customer.accountManagerId || '',
    status: 'active',
    availableBalance: 0,
    ledgerBalance: 0
  });

  return walletAccount;
};

const getActiveProductVariations = (product) => {
  if (!product?.hasVariations || !Array.isArray(product.variations)) {
    return [];
  }

  return product.variations.filter((variation) => variation.isActive !== false);
};

const resolveStockedVariationId = async (product, requestedVariationId = '', branchId = '', requiredQuantity = 1) => {
  if (!product?.hasVariations) {
    return '';
  }
  if (requestedVariationId) {
    return requestedVariationId;
  }

  const variations = getActiveProductVariations(product);
  if (variations.length === 0) {
    return '';
  }

  if (branchId) {
    const variationIds = variations.map((variation) => String(variation._id || ''));
    const stockQuery = {
      productId: product._id.toString(),
      branchId: branchId.toString(),
      variationId: { $in: variationIds },
    };
    const stockRow = await ProductBranchStock.findOne({
      ...stockQuery,
      quantity: { $gte: Math.max(1, Number(requiredQuantity || 1)) }
    }).sort({ quantity: -1 }).lean();

    if (stockRow?.variationId) {
      return stockRow.variationId;
    }

    const fallbackStockRow = await ProductBranchStock.findOne({
      ...stockQuery,
      quantity: { $gt: 0 }
    }).sort({ quantity: -1 }).lean();

    if (fallbackStockRow?.variationId) {
      return fallbackStockRow.variationId;
    }
  }

  const displayVariation = variations.reduce((lowest, variation) => (
    Number(variation.price || 0) < Number(lowest.price || 0) ? variation : lowest
  ), variations[0]);

  return String(displayVariation._id || '');
};

const normalizeSBAccountItems = async (items = [], approvedBy = '', branchId = '') => {
  if (!Array.isArray(items)) return [];

  const normalizedItems = await Promise.all(
    items.map(async (item) => {
      const quantity = Math.max(1, Number(item.quantity || 1));
      const product = item.productId ? await Product.findById(item.productId) : null;
      if (product?.hasVariations && !item.variationId) {
        throw new Error(`Select a variation for ${product.name}`);
      }
      const resolvedVariationId = await resolveStockedVariationId(product, item.variationId || '', branchId, quantity);
      const productPrice = getProductSellingPrice(product, resolvedVariationId);
      const productCostPrice = getProductCostPrice(product, resolvedVariationId);
      const price = Number(productPrice || item.price || item.sellingPrice || 0);
      const costPrice = Number(productCostPrice || item.costPrice || 0);
      const subtotal = Number(item.subtotal || price * quantity);
      const costSubtotal = costPrice * quantity;
      const profitAmount = Math.max(0, subtotal - costSubtotal);

      return {
        productId: item.productId || '',
        variationId: resolvedVariationId,
        productName: product?.name || item.productName || item.name || '',
        productDescription: product?.description || item.productDescription || item.description || '',
        quantity,
        price,
        costPrice,
        subtotal,
        costSubtotal,
        profitAmount,
        requiresCostApproval: costPrice <= 0,
        costApprovedBy: costPrice > 0 ? approvedBy : undefined,
        costApprovedAt: costPrice > 0 ? new Date() : undefined
      };
    })
  );

  return normalizedItems.filter((item) => item.productName && item.subtotal > 0);
};

const assertSBItemCanReduceStock = (sbaccount, item) => {
  if (!item.productId) {
    throw new Error('Product is required before item can be delivered');
  }
  if (!sbaccount.branchId) {
    throw new Error('Branch is required for product stock update');
  }
};

const updateSBItemStock = async (sbaccount, item, operation, staffId) => {
  assertSBItemCanReduceStock(sbaccount, item);
  return await ProductService.updateProductStock(
    item.productId,
    Number(item.quantity || 1),
    operation,
    item.variationId || '',
    sbaccount.branchId,
    staffId || ''
  );
};

const calculateSBItemProfit = (sbaccount, itemAmount) => {
  const accountSellingPrice = Number(sbaccount.sellingPrice || 0);
  const accountProfit = Number(sbaccount.profit || 0);
  const amount = Number(itemAmount || 0);

  if (accountSellingPrice <= 0 || accountProfit <= 0 || amount <= 0) {
    return 0;
  }

  return Math.round(((accountProfit * amount) / accountSellingPrice) * 100) / 100;
};

const calculateExactSBItemProfit = (item) => {
  const itemAmount = Number(item.subtotal || item.price || 0);
  const costSubtotal = Number(item.costSubtotal || 0);

  if (costSubtotal <= 0) {
    return 0;
  }

  return Math.max(0, Math.round((itemAmount - costSubtotal) * 100) / 100);
};

const hydrateSBItemCostFromProduct = async (sbaccount, itemIndex, approvedBy = '') => {
  const item = sbaccount.items[itemIndex];
  if (!item.productId) {
    return item;
  }

  const product = await Product.findById(item.productId);
  const resolvedVariationId = await resolveStockedVariationId(
    product,
    item.variationId || '',
    sbaccount.branchId || '',
    item.quantity || 1
  );
  if (!item.variationId && resolvedVariationId) {
    sbaccount.items[itemIndex].variationId = resolvedVariationId;
  }
  if (Number(item.costSubtotal || 0) > 0) {
    return sbaccount.items[itemIndex];
  }
  const costPrice = getProductCostPrice(product, resolvedVariationId);
  if (costPrice <= 0) {
    return item;
  }

  const quantity = Math.max(1, Number(item.quantity || 1));
  const itemAmount = Number(item.subtotal || item.price || 0);
  const costSubtotal = costPrice * quantity;
  sbaccount.items[itemIndex].variationId = resolvedVariationId;
  sbaccount.items[itemIndex].costPrice = costPrice;
  sbaccount.items[itemIndex].costSubtotal = costSubtotal;
  sbaccount.items[itemIndex].profitAmount = Math.max(0, itemAmount - costSubtotal);
  sbaccount.items[itemIndex].requiresCostApproval = false;
  sbaccount.items[itemIndex].costApprovedBy = approvedBy;
  sbaccount.items[itemIndex].costApprovedAt = new Date();

  return sbaccount.items[itemIndex];
};

const refreshSBAccountCostFromItems = (sbaccount) => {
  if (!Array.isArray(sbaccount.items) || sbaccount.items.length === 0) {
    return sbaccount;
  }

  const totalCost = sbaccount.items.reduce((sum, item) => sum + Number(item.costSubtotal || 0), 0);
  const totalProfit = sbaccount.items.reduce((sum, item) => sum + Number(item.profitAmount || 0), 0);
  sbaccount.costPrice = totalCost;
  sbaccount.profit = totalProfit;
  return sbaccount;
};

const isLegacySBAccount = (sbaccount) => (
  sbaccount?.accountMode !== 'multi_item' &&
  (!Array.isArray(sbaccount?.items) || sbaccount.items.length === 0)
);

const isClosedLegacySBAccount = (sbaccount) => (
  isLegacySBAccount(sbaccount) && Number(sbaccount?.balance || 0) <= 0
);

const filterClosedLegacySBAccountsForRole = (accounts = [], requesterRole = '') => {
  if (!requesterRole || requesterRole === 'Admin') {
    return accounts;
  }

  return accounts.filter((account) => !isClosedLegacySBAccount(account));
};

const getStaffDisplayName = (staff) => (
  [staff?.firstName, staff?.lastName].filter(Boolean).join(' ').trim() || staff?.email || 'N/A'
);

const getCustomerDisplayName = (customer) => (
  [customer?.firstName, customer?.lastName].filter(Boolean).join(' ').trim() || 'Unknown Customer'
);

const isMongoId = (value) => /^[a-f\d]{24}$/i.test(String(value || ''));

const hasRepAccessToCustomer = (staffId, customer, fallbackManagerId = '') => {
  const id = String(staffId || '');
  if (!id) return false;

  return [
    customer?.accountManagerId,
    customer?.createdBy,
    fallbackManagerId
  ].some((value) => String(value || '') === id);
};

const getBackofficeProductDeliverySummary = async (staff = {}, options = {}) => {
  const role = staff?.role;
  let staffId = String(staff?.staffId || '');
  const isAdmin = role === 'Admin';
  const isManager = role === 'Manager';
  const isRepDashboardView = Boolean(options.staffId) && (isAdmin || isManager);
  let isRep = ['Agent', 'OnlineRep', 'Rep'].includes(role);
  const shouldLimitDeliveredToLoggedInManager = isManager && !isRepDashboardView;

  if (isRepDashboardView) {
    const targetStaff = await Staff.findById(options.staffId).select('role branchId').lean();
    if (!targetStaff) {
      throw new Error('Selected rep not found');
    }
    if (isManager && String(targetStaff.branchId || '') !== String(staff.branchId || '')) {
      throw new Error('You can only view reps in your branch');
    }

    staffId = String(options.staffId);
    isRep = true;
  }

  let assignedCustomerIds = [];
  if (isRep) {
    const assignedCustomers = await Customer.find({
      $or: [
        { accountManagerId: staffId },
        { createdBy: staffId }
      ]
    }).select('_id').lean();
    assignedCustomerIds = assignedCustomers.map((customer) => String(customer._id));
  }

  const query = {
    createdBy: { $ne: 'ECOMMERCE_SYSTEM' },
    items: { $exists: true, $ne: [] }
  };
  const ecommerceQuery = {
    status: { $ne: 'cancelled' },
    items: { $exists: true, $ne: [] }
  };

  if (isManager && staff?.branchId && !shouldLimitDeliveredToLoggedInManager) {
    query.branchId = String(staff.branchId);
    ecommerceQuery.branchId = String(staff.branchId);
  }

  if (isRep) {
    query.$or = [
      { accountManagerId: staffId },
      { createdBy: staffId },
      { customerId: { $in: assignedCustomerIds } }
    ];
    ecommerceQuery.$or = [
      { accountManagerId: staffId },
      { processedBy: staffId },
      { customerId: { $in: assignedCustomerIds } }
    ];
  }

  if (!isAdmin && !isManager && !isRep) {
    return {
      pending: { count: 0, items: [] },
      delivered: { count: 0, items: [] }
    };
  }

  const [accounts, ecommerceOrders] = await Promise.all([
    SBAccount.find(query)
      .select('SBAccountNumber accountNumber customerId branchId createdBy accountManagerId items createdAt updatedAt status')
      .lean(),
    EcommerceOrder.find(ecommerceQuery)
      .select('orderNumber SBAccountNumber accountNumber customerId customerPhone branchId accountManagerId processedBy items createdAt updatedAt status paymentStatus')
      .lean()
  ]);

  const linkedSbNumbers = [...new Set(ecommerceOrders.map((order) => String(order.SBAccountNumber || '')).filter(Boolean))];
  const linkedSbAccounts = linkedSbNumbers.length > 0
    ? await SBAccount.find({ SBAccountNumber: { $in: linkedSbNumbers } }).select('SBAccountNumber createdBy').lean()
    : [];
  const linkedSbAccountByNumber = new Map(linkedSbAccounts.map((account) => [String(account.SBAccountNumber), account]));

  const customerIds = [...new Set([
    ...accounts.map((account) => String(account.customerId || '')),
    ...ecommerceOrders.map((order) => String(order.customerId || ''))
  ].filter(isMongoId))];
  const branchIds = [...new Set([
    ...accounts.map((account) => String(account.branchId || '')),
    ...ecommerceOrders.map((order) => String(order.branchId || ''))
  ].filter(isMongoId))];
  const staffIds = [...new Set([
    ...accounts.flatMap((account) => [
    account.createdBy,
    account.accountManagerId,
    ...(account.items || []).map((item) => item.fulfilledBy)
    ]),
    ...ecommerceOrders.flatMap((order) => [
      order.accountManagerId,
      order.processedBy,
      ...(order.items || []).map((item) => item.fulfilledBy)
    ])
  ].map((value) => String(value || '')).filter(isMongoId))];

  const [customers, branches, staffMembers] = await Promise.all([
    Customer.find({ _id: { $in: customerIds } }).select('firstName lastName phone accountManagerId createdBy branchId').lean(),
    Branch.find({ _id: { $in: branchIds } }).select('name').lean(),
    Staff.find({ _id: { $in: staffIds } }).select('firstName lastName email role').lean()
  ]);

  const customerById = new Map(customers.map((customer) => [String(customer._id), customer]));
  const branchById = new Map(branches.map((branch) => [String(branch._id), branch]));
  const staffById = new Map(staffMembers.map((member) => [String(member._id), member]));

  const pendingItems = [];
  const deliveredItems = [];

  accounts.forEach((account) => {
    const customer = customerById.get(String(account.customerId || ''));
    if (isRep && !hasRepAccessToCustomer(staffId, customer, account.accountManagerId || account.createdBy)) {
      return;
    }

    (account.items || []).forEach((item, index) => {
      const status = item.fulfillmentStatus || 'pending';
      const isDelivered = ['delivered', 'completed'].includes(status);
      const itemId = String(item._id || index);
      const branch = branchById.get(String(account.branchId || ''));
      const createdBy = staffById.get(String(account.createdBy || ''));
      const fulfilledBy = staffById.get(String(item.fulfilledBy || ''));

      const detail = {
        id: `${account._id}-${itemId}`,
        sbAccountId: String(account._id),
        SBAccountNumber: account.SBAccountNumber,
        customerId: String(account.customerId || ''),
        customerName: getCustomerDisplayName(customer),
        customerPhone: customer?.phone || account.accountNumber || '',
        branchName: branch?.name || 'N/A',
        productName: item.productName || account.productName || 'N/A',
        quantity: Number(item.quantity || 1),
        amount: Number(item.subtotal || item.price || 0),
        fulfillmentStatus: status,
        accountStatus: account.status || '',
        source: 'Backoffice',
        createdBy: getStaffDisplayName(createdBy),
        fulfilledBy: item.fulfilledBy ? getStaffDisplayName(fulfilledBy) : 'N/A',
        addedAt: item.addedAt || account.createdAt,
        fulfilledAt: item.fulfilledAt || null,
        actionUrl: `/customeraccountdashboard/${account.customerId}`
      };

      if (isDelivered) {
        if (!shouldLimitDeliveredToLoggedInManager || String(item.fulfilledBy || '') === String(staff.staffId || '')) {
          deliveredItems.push(detail);
        }
      } else if (!isManager || String(account.branchId || '') === String(staff.branchId || '')) {
        pendingItems.push(detail);
      }
    });
  });

  ecommerceOrders.forEach((order) => {
    const linkedSbAccount = linkedSbAccountByNumber.get(String(order.SBAccountNumber || ''));
    if (linkedSbAccount && linkedSbAccount.createdBy !== 'ECOMMERCE_SYSTEM') {
      return;
    }

    const customer = customerById.get(String(order.customerId || ''));
    if (isRep && !hasRepAccessToCustomer(staffId, customer, order.accountManagerId || order.processedBy)) {
      return;
    }

    (order.items || []).forEach((item, index) => {
      const status = item.fulfillmentStatus || 'pending';
      const isDelivered = ['delivered', 'completed'].includes(status);
      const itemId = String(item._id || index);
      const branch = branchById.get(String(order.branchId || ''));
      const fulfilledBy = staffById.get(String(item.fulfilledBy || order.processedBy || ''));

      const detail = {
        id: `ecommerce-${order._id}-${itemId}`,
        orderId: String(order._id),
        orderNumber: order.orderNumber,
        SBAccountNumber: order.SBAccountNumber || '',
        customerId: String(order.customerId || ''),
        customerName: getCustomerDisplayName(customer),
        customerPhone: customer?.phone || order.customerPhone || order.accountNumber || '',
        branchName: branch?.name || 'N/A',
        productName: item.productName || 'N/A',
        quantity: Number(item.quantity || 1),
        amount: Number(item.subtotal || item.price || 0),
        fulfillmentStatus: status,
        accountStatus: order.status || '',
        source: 'Ecommerce',
        createdBy: 'Ecommerce',
        fulfilledBy: item.fulfilledBy ? getStaffDisplayName(fulfilledBy) : 'N/A',
        addedAt: item.addedAt || order.createdAt,
        fulfilledAt: item.fulfilledAt || null,
        actionUrl: `/ecommerce-order/${order._id}`
      };

      if (isDelivered) {
        if (!shouldLimitDeliveredToLoggedInManager || String(item.fulfilledBy || '') === String(staff.staffId || '')) {
          deliveredItems.push(detail);
        }
      } else if (!isManager || String(order.branchId || '') === String(staff.branchId || '')) {
        pendingItems.push(detail);
      }
    });
  });

  const sortByDateDesc = (a, b) => new Date(b.fulfilledAt || b.addedAt || 0) - new Date(a.fulfilledAt || a.addedAt || 0);
  pendingItems.sort(sortByDateDesc);
  deliveredItems.sort(sortByDateDesc);

  return {
    pending: {
      count: pendingItems.length,
      items: pendingItems
    },
    delivered: {
      count: deliveredItems.length,
      items: deliveredItems
    }
  };
};

const buildSBAccountItemSummary = (items = []) => {
  return items.map((item) => item.productName).filter(Boolean).join(', ');
};

const appendItemsToActiveMultiItemSBAccount = async (activeSBAccount, items) => {
  if (!activeSBAccount || !Array.isArray(items) || items.length === 0) {
    return null;
  }

  items.forEach((item) => activeSBAccount.items.push(item));
  activeSBAccount.accountMode = 'multi_item';
  activeSBAccount.productName = buildSBAccountItemSummary(activeSBAccount.items);
  activeSBAccount.productDescription = activeSBAccount.items
    .map((item) => item.productDescription)
    .filter(Boolean)
    .join(' | ') || activeSBAccount.productName;
  activeSBAccount.sellingPrice = activeSBAccount.items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  activeSBAccount.costPrice = activeSBAccount.items.reduce((sum, item) => sum + Number(item.costSubtotal || 0), 0);
  activeSBAccount.profit = activeSBAccount.items.reduce((sum, item) => sum + Number(item.profitAmount || 0), 0);
  if (activeSBAccount.status === 'sold') {
    activeSBAccount.status = 'booked';
  }

  return await activeSBAccount.save();
};

const transferSBExcessBalanceToWallet = async ({ sbaccount, walletAccount, amount, date, formattedDate, createdBy }) => {
  const transferAmount = Number(amount || 0);
  if (transferAmount <= 0) {
    return null;
  }

  const narration = `Excess SB balance transferred to wallet from ${sbaccount.SBAccountNumber}`;
  const duplicate = await AccountTransactionModel.findOne({
    accountTypeId: sbaccount._id,
    package: "SB",
    direction: "Debit",
    narration,
  });
  if (duplicate) {
    sbaccount.balance = 0;
    return null;
  }

  const sbBalanceAfterTransfer = Number(sbaccount.balance || 0) - transferAmount;
  await AccountTransaction.DepositTransactionAccount({
    createdBy,
    transactionOwnerId: createdBy,
    customerId: sbaccount.customerId,
    amount: transferAmount,
    balance: sbBalanceAfterTransfer,
    branchId: sbaccount.branchId,
    accountManagerId: sbaccount.accountManagerId || walletAccount.accountManagerId || '',
    accountNumber: sbaccount.accountNumber,
    accountTypeId: sbaccount._id,
    date: formattedDate,
    package: "SB",
    narration,
    direction: "Debit",
  });

  await AccountTransaction.DepositTransactionAccount({
    createdBy,
    transactionOwnerId: createdBy,
    customerId: walletAccount.customerId,
    amount: transferAmount,
    balance: Number(walletAccount.availableBalance || 0) + transferAmount,
    branchId: walletAccount.branchId,
    accountManagerId: walletAccount.accountManagerId || sbaccount.accountManagerId || '',
    accountNumber: walletAccount.accountNumber,
    accountTypeId: walletAccount._id,
    date: formattedDate,
    package: "Wallet",
    narration,
    direction: "Credit",
  });

  await Account.findByIdAndUpdate(walletAccount._id, {
    $set: {
      availableBalance: Number(walletAccount.availableBalance || 0) + transferAmount,
      ledgerBalance: Number(walletAccount.ledgerBalance || 0) + transferAmount,
    }
  });

  sbaccount.balance = sbBalanceAfterTransfer;
  return { amount: transferAmount, transferredAt: date };
};

const hydrateSBAccountCostFromProducts = async (sbaccount, approvedBy = '') => {
  if (!Array.isArray(sbaccount.items) || sbaccount.items.length === 0) {
    return sbaccount;
  }

  for (let index = 0; index < sbaccount.items.length; index += 1) {
    await hydrateSBItemCostFromProduct(sbaccount, index, approvedBy);
  }

  return refreshSBAccountCostFromItems(sbaccount);
};

const createSBAccount = async (SBAccountData) => {
          const existingSBAccountNumber = await getAccountByAccountNumber(SBAccountData.accountNumber);
          if (!existingSBAccountNumber) {
            throw new Error('Account number does not exists');
          }
          const items = await normalizeSBAccountItems(
            SBAccountData.items,
            SBAccountData.createdBy,
            existingSBAccountNumber.branchId
          );
          if (items.length > 0) {
            const activeMultiItemSBAccount = await SBAccount.findOne({
              customerId: existingSBAccountNumber.customerId,
              $or: [
                { accountMode: 'multi_item' },
                { 'items.0': { $exists: true } }
              ]
            }).sort({ createdAt: 1 });

            if (activeMultiItemSBAccount) {
              const updatedSBAccount = await appendItemsToActiveMultiItemSBAccount(activeMultiItemSBAccount, items);
              return ({message:"Product added to existing SB account successfully", newSBAccount: updatedSBAccount})
            }

            SBAccountData.items = items;
            SBAccountData.productName = items.map((item) => item.productName).join(', ');
            SBAccountData.productDescription = items
              .map((item) => item.productDescription)
              .filter(Boolean)
              .join(' | ') || SBAccountData.productName;
            SBAccountData.sellingPrice = items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
            SBAccountData.costPrice = items.reduce((sum, item) => sum + Number(item.costSubtotal || 0), 0);
            SBAccountData.profit = items.reduce((sum, item) => sum + Number(item.profitAmount || 0), 0);
            SBAccountData.accountMode = 'multi_item';
          }
          const existingSBAccount = await SBAccount.findOne({
            accountNumber: SBAccountData.accountNumber,
            productName: SBAccountData.productName,
});
          if (existingSBAccount) {
            throw new Error(`Customer has an active ${SBAccountData.productName} SB account running`);
          }
          const SBAccountNumber = await generateUniqueAccountNumber('SBA')
  const sbaccount = new SBAccount({...SBAccountData,customerId:existingSBAccountNumber.customerId,branchId:existingSBAccountNumber.branchId,SBAccountNumber});
  const newSBAccount = await sbaccount.save();

  return ({message:"Account created successfilly", newSBAccount})
};

const updateSBAccountAmount = async (details) => {
    const {SBAccountNumber,sellingPrice,productName,editedBy} = details
    // try {
      // Validate input
      if (!SBAccountNumber) {
        throw new Error('Invalid account number');
      }
  
      const sbaccount = await SBAccount.findOne({
        SBAccountNumber: SBAccountNumber,
        // productName: productName,
      });
      if (sbaccount.costPrice !== 0) {
        throw new Error("This selling price has been approved");
      }
      // Find and update the DSAccount by DSAccount
      const updatedSBAccount = await SBAccount.findOneAndUpdate(
        { SBAccountNumber }, // Find the account by accountNumber
        { $set: { sellingPrice: sellingPrice, editedBy:editedBy, productName:productName,status:'booked' } }, // Update only the amount field
        { new: true } // Return the updated document
      );
  
      // Check if the account was found and updated
      if (!updatedSBAccount) {
        throw new Error('SBAccount not found or update failed');
      }
   
      return { success: true, message: 'Updated successfully', updatedSBAccount };
    // } catch (error) {
    //   throw new Error('An error occurred while updating the amount', error );
    // }
  };

const updateCostPrice = async (details) => {
    const {SBAccountNumber,costPrice,productName,editedBy} = details
    // try {
      // Validate input
      if (!SBAccountNumber) {
        throw new Error('Invalid account number');
      }
  
      const sbaccount = await SBAccount.findOne({
        SBAccountNumber: SBAccountNumber,
        // productName: productName,
      });
      if (!sbaccount) {
        throw new Error('SBAccount not found or update failed');
      }
      const isMultiItemSBAccount = Array.isArray(sbaccount.items) && sbaccount.items.length > 1;
      if (!isMultiItemSBAccount && sbaccount.sellingPrice > sbaccount.balance) {
        throw new Error("The money must be completed before approval");
      }
      const nextCostPrice = Number(costPrice || 0);
      if (nextCostPrice <= 0) {
        throw new Error('Enter a valid cost price');
      }
      if (nextCostPrice > Number(sbaccount.sellingPrice || 0)) {
        throw new Error('Cost price cannot be greater than selling price');
      }
      const profit = sbaccount.sellingPrice - nextCostPrice
      // Find and update the DSAccount by DSAccount
      const updatedcostPrice = await SBAccount.findOneAndUpdate(
        { SBAccountNumber }, // Find the account by accountNumber
        { $set: { costPrice: nextCostPrice, profit:profit, editedBy:editedBy, productName:productName } }, // Update only the amount field
        { new: true } // Return the updated document
      );
  
      // Check if the account was found and updated
      if (!updatedcostPrice) {
        throw new Error('SBAccount not found or update failed');
      }
  
      return { success: true, message: 'Cost price updated successfully', updatedcostPrice };
    // } catch (error) {
    //   throw new Error('An error occurred while updating the amount', error );
    // }
  };

const updateSBAccountItemCostPrice = async ({ SBAccountNumber, itemId, costPrice, editedBy }) => {
  if (!SBAccountNumber) {
    throw new Error('Invalid account number');
  }

  const sbaccount = await SBAccount.findOne({ SBAccountNumber });
  if (!sbaccount) {
    throw new Error('SBAccount not found');
  }
  if (!Array.isArray(sbaccount.items) || sbaccount.items.length === 0) {
    throw new Error('This SB account does not have item details');
  }

  const decodedItemId = decodeURIComponent(String(itemId));
  const numericItemIndex = Number(decodedItemId);
  const itemIndex = Number.isInteger(numericItemIndex) && numericItemIndex >= 0
    ? numericItemIndex
    : sbaccount.items.findIndex((item) =>
        String(item._id || '') === decodedItemId ||
        String(item.productId || '') === decodedItemId
      );

  if (itemIndex === -1 || itemIndex >= sbaccount.items.length) {
    throw new Error('SB account item not found');
  }
  if (['delivered', 'completed'].includes(sbaccount.items[itemIndex].fulfillmentStatus)) {
    throw new Error('Delivered item cost price cannot be changed');
  }

  const nextCostPrice = Number(costPrice || 0);
  if (nextCostPrice <= 0) {
    throw new Error('Enter a valid cost price');
  }

  const item = sbaccount.items[itemIndex];
  const quantity = Math.max(1, Number(item.quantity || 1));
  const itemAmount = Number(item.subtotal || item.price || 0);
  const costSubtotal = nextCostPrice * quantity;
  if (costSubtotal > itemAmount) {
    throw new Error('Cost price cannot be greater than item selling price');
  }

  sbaccount.items[itemIndex].costPrice = nextCostPrice;
  sbaccount.items[itemIndex].costSubtotal = costSubtotal;
  sbaccount.items[itemIndex].profitAmount = itemAmount - costSubtotal;
  sbaccount.items[itemIndex].requiresCostApproval = false;
  sbaccount.items[itemIndex].costApprovedBy = editedBy;
  sbaccount.items[itemIndex].costApprovedAt = new Date();
  sbaccount.costPrice = sbaccount.items.reduce((sum, orderItem) => sum + Number(orderItem.costSubtotal || 0), 0);
  sbaccount.profit = sbaccount.items.reduce((sum, orderItem) => sum + Number(orderItem.profitAmount || 0), 0);
  sbaccount.editedBy = editedBy;

  await sbaccount.save();
  return { success: true, message: 'Item cost price updated successfully', sbAccount: sbaccount };
};

const getAccountByAccountNumber = async (accountNumber) => {
    return await Account.findOne({ accountNumber });
  };

  const getCustomerSBAccountById = async (customerId, requesterRole = '') =>{
    try {
        const accounts = await SBAccount.find({customerId:customerId});
        return filterClosedLegacySBAccountsForRole(accounts, requesterRole);
    } catch (error) {
        throw error;
    }
  }

  const saveSBContribution = async (contributionInput) => {
    // Retrieve customer account using the DS account number
    const customerAccount = await getSBAccountByAccountNumber(contributionInput.SBAccountNumber);
    if (!customerAccount) {
      throw new Error  ('Account number does not exist.');
    }
  
    // Check for an active package with the given account type
    let sbaccount = await SBAccount.findOne({
      SBAccountNumber: contributionInput.SBAccountNumber,
    });

    if (sbaccount?.accountMode !== 'multi_item' && contributionInput.productName) {
      sbaccount = await SBAccount.findOne({
        SBAccountNumber: contributionInput.SBAccountNumber,
        productName: contributionInput.productName,
      });
    }
  
    if (!sbaccount) {
      throw new error('Customer does not have an active package');
    }

    if (isClosedLegacySBAccount(sbaccount)) {
      throw new Error('This old SB account is closed and can no longer receive deposits.');
    }
  
    const SBAccountId = sbaccount._id;
    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "2-digit", // Abbreviated year (YY)
      hour: "2-digit",
      minute: "2-digit",
      hour12: true, // Ensures AM/PM format
    });

    if (sbaccount.accountMode === 'multi_item') {
      const walletAccount = await ensureSBOrderWalletForSBAccount(sbaccount);
      const depositAmount = Number(contributionInput.amount || 0);
      if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
        throw new Error('Invalid deposit amount');
      }
      const newWalletAvailableBalance = Number(walletAccount.availableBalance || 0) + depositAmount;
      const newWalletLedgerBalance = Number(walletAccount.ledgerBalance || 0) + depositAmount;
      const newContribution = await AccountTransaction.DepositTransactionAccount({
        createdBy: contributionInput.createdBy,
        transactionOwnerId: contributionInput.createdBy,
        customerId: sbaccount.customerId,
        amount: depositAmount,
        balance: newWalletAvailableBalance,
        branchId: walletAccount.branchId || sbaccount.branchId,
        accountManagerId: walletAccount.accountManagerId || sbaccount.accountManagerId || '',
        accountNumber: walletAccount.accountNumber,
        accountTypeId: walletAccount._id,
        date: formattedDate,
        narration: `SB Order Wallet Deposit - ${sbaccount.SBAccountNumber}`,
        package: "Wallet",
        direction: "Credit",
      });

      await Account.findByIdAndUpdate(walletAccount._id, {
        $set: {
          availableBalance: newWalletAvailableBalance,
          ledgerBalance: newWalletLedgerBalance,
        }
      });

      return { data: newContribution, message: "deposit successful" };
    }
  
        // Retrieve and update ledger balance
        const updateLedgerBalance = await Account.findOne({ accountNumber: sbaccount.accountNumber });
  
        if (!updateLedgerBalance) {
          throw new Error('Account not found for ledger update');
        }

            const newContribution = await AccountTransaction.DepositTransactionAccount({
                createdBy: contributionInput.createdBy,
                transactionOwnerId: contributionInput.createdBy,
                customerId:sbaccount.customerId,
                amount: contributionInput.amount,
                balance: sbaccount.balance + contributionInput.amount,
                branchId: sbaccount.branchId,
                accountManagerId: sbaccount.accountManagerId,
                accountNumber: sbaccount.accountNumber,
                accountTypeId: SBAccountId,
                date: formattedDate,
                narration: "SB Deposit",
                package: "SB",
                direction: "Credit",
              });

              await Account.findOneAndUpdate(
                { accountNumber: sbaccount.accountNumber },
                {
                  $set: {
                    ledgerBalance: updateLedgerBalance.ledgerBalance + contributionInput.amount
                  },
                }
              );

      const sbNewBalance = await SBAccount.findByIdAndUpdate(SBAccountId, {
        balance: sbaccount.balance + contributionInput.amount,
      });
      // const message = `Your account has been credited with NGN${contributionInput.amount}, Date:${sbNewBalance.createdAt} Bal:${sbNewBalance.balance}`
      // await sendSMS(sbaccount.accountNumber,message)
      return { data: newContribution, message: "deposit successful" };
    }

    const withdrawSBContribution = async (contributionInput) => {
        // Retrieve customer account using the DS account number
        const customerAccount = await getSBAccountByAccountNumber(contributionInput.SBAccountNumber);
        if (!customerAccount) {
          throw new Error('Account number does not exist.');
        }
      
        // Check for an active package with the given account type
        const sbaccount = await SBAccount.findOne({
          SBAccountNumber: contributionInput.SBAccountNumber,
          productName: contributionInput.productName,
        });
      
        if (!sbaccount) {
          throw new Error('Customer does not have an active package');
        }
      
        const SBAccountId = sbaccount._id;
        const currentDate = new Date();
    const formattedDate = currentDate.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "2-digit", // Abbreviated year (YY)
      hour: "2-digit",
      minute: "2-digit",
      hour12: true, // Ensures AM/PM format
    });
      
        if (contributionInput.amount > sbaccount.balance) {
          throw new Error("Insuffitient balance");
        }
      
        // Retrieve and update ledger balance
        const account = await Account.findOne({ accountNumber: sbaccount.accountNumber });
      
        if (!account) {
          throw new Error('Account not found for ledger update');
        }
        const newBalance = sbaccount.balance - contributionInput.amount;
      
          const newContribution = await AccountTransaction.DepositTransactionAccount({
            createdBy: contributionInput.createdBy,
            transactionOwnerId: contributionInput.createdBy,
            customerId:sbaccount.customerId,
            amount: contributionInput.amount,
            balance: newBalance,
            branchId: sbaccount.branchId,
            accountManagerId: sbaccount.accountManagerId,
            accountNumber: sbaccount.accountNumber,
            accountTypeId: SBAccountId,
            date: formattedDate,
            narration: "Withdrawal",
            package: "SB",
            direction: "Debit",
          });
      
          await Account.findOneAndUpdate(
            { accountNumber: sbaccount.accountNumber },
            {
              $set: {
                ledgerBalance: account.ledgerBalance - contributionInput.amount,
              },
            }
          );
      
          await SBAccount.findByIdAndUpdate(SBAccountId, {
            balance: newBalance
          });
      
          return { data:newContribution, message:"Withdrawal successful" };
        }
	    const sellProduct = async (contributionInput) => {
	        // Retrieve customer account using the DS account number
	        const customerAccount = await getSBAccountByAccountNumber(contributionInput.SBAccountNumber);
	        if (!customerAccount) {
	          throw new Error('Account number does not exist.');
	        }
      
        // Check for an active package with the given account type
        const sbaccount = await SBAccount.findOne({
          SBAccountNumber: contributionInput.SBAccountNumber,
          // productName: contributionInput.productName,
        });
      
	        if (!sbaccount) {
	          throw new Error('Customer does not have an active package');
	        }

        if (Array.isArray(sbaccount.items) && sbaccount.items.length === 1) {
          return await markSBAccountItemDelivered({
            SBAccountNumber: contributionInput.SBAccountNumber,
            itemId: 0,
            createdBy: contributionInput.createdBy
          });
        }
	      
	        const SBAccountId = sbaccount._id;
        const currentDate = new Date();
        const formattedDate = currentDate.toLocaleString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "2-digit", // Abbreviated year (YY)
          hour: "2-digit",
          minute: "2-digit",
          hour12: true, // Ensures AM/PM format
        });
      
        if (sbaccount.sellingPrice > sbaccount.balance) {
          throw new Error("Insuffitient amount for product price");
        }
        if (Number(sbaccount.costPrice || 0) === 0) {
          await hydrateSBAccountCostFromProducts(sbaccount, contributionInput.createdBy);
        }
        if (Number(sbaccount.costPrice || 0) === 0) {
          throw new Error("Ask admin for approval");
        }

        const account = await Account.findOne({ accountNumber: sbaccount.accountNumber });
      
        if (!account) {
          throw new Error('Account not found for ledger update');
        }
        const newBalance = sbaccount.balance - sbaccount.sellingPrice;
      
          const newContribution = await AccountTransaction.DepositTransactionAccount({
            createdBy: contributionInput.createdBy,
            transactionOwnerId: contributionInput.createdBy,
            customerId:sbaccount.customerId,
            amount: sbaccount.sellingPrice,
            balance: newBalance,
            branchId: sbaccount.branchId,
            accountManagerId: sbaccount.accountManagerId,
            accountNumber: sbaccount.accountNumber,
            accountTypeId: SBAccountId,
            date: formattedDate,
            package: "SB",
            narration: `${sbaccount.productName} sold`,
            direction: "Purchased",
          });

             const sureBankDeposit = {
                  package:"SB",
                  date: formattedDate,
                  direction: "Credit",
                  narration: `Profit on ${sbaccount.productName}`,
                  branchId: sbaccount.branchId,
                  amount: sbaccount.profit,
                  customerId:sbaccount.customerId,
                  type:SBAccountId
                }
          
                await SureBankAccount.DepositTransactionAccount({...sureBankDeposit});
      
          await Account.findOneAndUpdate(
            { accountNumber: sbaccount.accountNumber },
            {
              $set: {
                ledgerBalance: account.ledgerBalance - sbaccount.sellingPrice,
              },
            }
          );
      
          await SBAccount.findByIdAndUpdate(SBAccountId, {
            balance: newBalance,
            // status: 'sold',
            costPrice:0
          });
      
           const order = new Order({
        customerId: sbaccount.customerId,
        accountNumber: sbaccount.accountNumber,
        SBAccountNumber: sbaccount.SBAccountNumber,
        createdBy: sbaccount.createdBy,
        transactionOwnerId: sbaccount.createdBy,
        productName: sbaccount.productName,
        productDescription: sbaccount.productDescription,
        editedBy: sbaccount.editedBy,
        accountManagerId: sbaccount.accountManagerId,
        branchId: sbaccount.branchId,
        status: "Sold",
        startDate: sbaccount.startDate,
        sellingPrice: sbaccount.sellingPrice,
        costPrice: 0,
        balance: 0,
        profit: 0, 
        items: sbaccount.items || [],
      });
      const newOrder = await order.save();
          
      
          return { data: newContribution, message: "Product sold successful" };
        }

    const markSBAccountItemDelivered = async ({ SBAccountNumber, itemId, createdBy }) => {
      const sbaccount = await SBAccount.findOne({ SBAccountNumber });
      if (!sbaccount) {
        throw new Error('Customer does not have an active package');
      }
      if (!Array.isArray(sbaccount.items) || sbaccount.items.length === 0) {
        throw new Error('This SB account does not have item details');
      }

      const decodedItemId = decodeURIComponent(String(itemId));
      const numericItemIndex = Number(decodedItemId);
      const itemIndex = Number.isInteger(numericItemIndex) && numericItemIndex >= 0
        ? numericItemIndex
        : sbaccount.items.findIndex((item) =>
            String(item._id || '') === decodedItemId ||
            String(item.productId || '') === decodedItemId
          );
      if (itemIndex >= sbaccount.items.length) {
        throw new Error('SB account item not found');
      }
      if (itemIndex === -1) {
        throw new Error('SB account item not found');
      }

      const item = sbaccount.items[itemIndex];
      if (['delivered', 'completed'].includes(item.fulfillmentStatus)) {
        throw new Error('This item has already been delivered');
      }

      const itemAmount = Number(item.subtotal || item.price || 0);
      if (itemAmount <= 0) {
        throw new Error('Invalid item amount');
      }
      const isMultiItemAccount = sbaccount.accountMode === 'multi_item';
      const itemIsPaidFromSBWallet = Number(item.paidAmount || 0) >= itemAmount;
      if (!isMultiItemAccount && Number(sbaccount.balance || 0) < itemAmount) {
        throw new Error('Insufficient amount for item price');
      }
      if (isMultiItemAccount && !itemIsPaidFromSBWallet) {
        throw new Error('This item has not been requested or paid from the SB Order Wallet');
      }
      await hydrateSBItemCostFromProduct(sbaccount, itemIndex, createdBy);
      const deliveryItem = sbaccount.items[itemIndex];
      if (Number(deliveryItem.costSubtotal || 0) <= 0 || deliveryItem.requiresCostApproval) {
        throw new Error('Ask admin for approval');
      }
      await updateSBItemStock(sbaccount, deliveryItem, 'decrease', createdBy);

      const account = await ensureSBOrderWalletForSBAccount(sbaccount);
      if (!account) {
        await updateSBItemStock(sbaccount, deliveryItem, 'increase', createdBy);
        throw new Error('SB order wallet not found for ledger update');
      }

      const currentDate = new Date();
      const formattedDate = currentDate.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      const newBalance = isMultiItemAccount
        ? Number(sbaccount.balance || 0)
        : Number(sbaccount.balance || 0) - itemAmount;
      const itemProfit = calculateExactSBItemProfit(deliveryItem) || calculateSBItemProfit(sbaccount, itemAmount);

      let transaction;
      try {
        transaction = await AccountTransaction.DepositTransactionAccount({
          createdBy,
          transactionOwnerId: createdBy,
          customerId: sbaccount.customerId,
          amount: itemAmount,
          balance: newBalance,
          branchId: sbaccount.branchId,
          accountManagerId: sbaccount.accountManagerId,
          accountNumber: sbaccount.accountNumber,
          accountTypeId: sbaccount._id,
          date: formattedDate,
          package: "SB",
          narration: `Product delivered: ${deliveryItem.productName} - SB Account ${sbaccount.SBAccountNumber}`,
          direction: "Purchased",
        });

        if (itemProfit > 0 && !sbaccount.items[itemIndex].profitReported) {
          await SureBankAccount.DepositTransactionAccount({
            package: "SB",
            date: formattedDate,
            direction: "Credit",
            narration: `Profit on ${deliveryItem.productName}`,
            branchId: sbaccount.branchId,
            amount: itemProfit,
            customerId: sbaccount.customerId,
            type: sbaccount._id,
          });
        }

        sbaccount.items[itemIndex].paidAmount = itemAmount;
        sbaccount.items[itemIndex].profitAmount = itemProfit;
        sbaccount.items[itemIndex].profitReported = itemProfit > 0;
        sbaccount.items[itemIndex].profitReportedAt = itemProfit > 0 ? currentDate : undefined;
        sbaccount.items[itemIndex].fulfillmentStatus = 'delivered';
        sbaccount.items[itemIndex].fulfilledAt = currentDate;
        sbaccount.items[itemIndex].fulfilledBy = createdBy;
        refreshSBAccountCostFromItems(sbaccount);
        sbaccount.balance = newBalance;
        if (sbaccount.items.every((orderItem) => ['delivered', 'completed'].includes(orderItem.fulfillmentStatus))) {
          sbaccount.status = 'sold';
          if (!isMultiItemAccount) {
            await transferSBExcessBalanceToWallet({
              sbaccount,
              walletAccount: account,
              amount: sbaccount.balance,
              date: currentDate,
              formattedDate,
              createdBy,
            });
          }
        }

        if (!isMultiItemAccount) {
          await Account.findOneAndUpdate(
            { _id: account._id },
            { $set: { ledgerBalance: Number(account.ledgerBalance || 0) - itemAmount } }
          );
        }
        await sbaccount.save();
      } catch (error) {
        await updateSBItemStock(sbaccount, deliveryItem, 'increase', createdBy);
        throw error;
      }

      return { data: transaction, sbAccount: sbaccount, message: 'Item delivered successfully' };
    };

    const requestSBAccountItemFromWallet = async ({ SBAccountNumber, itemId, createdBy, requesterRole }) => {
      if (!['Agent', 'OnlineRep', 'Rep'].includes(requesterRole)) {
        throw new Error('Only reps can submit customer requests');
      }

      const sbaccount = await SBAccount.findOne({ SBAccountNumber });
      if (!sbaccount) {
        throw new Error('Customer does not have an active package');
      }
      if (!Array.isArray(sbaccount.items) || sbaccount.items.length === 0) {
        throw new Error('This SB account does not have item details');
      }

      const decodedItemId = decodeURIComponent(String(itemId));
      const numericItemIndex = Number(decodedItemId);
      const itemIndex = Number.isInteger(numericItemIndex) && numericItemIndex >= 0
        ? numericItemIndex
        : sbaccount.items.findIndex((item) =>
            String(item._id || '') === decodedItemId ||
            String(item.productId || '') === decodedItemId
          );
      if (itemIndex === -1 || itemIndex >= sbaccount.items.length) {
        throw new Error('SB account item not found');
      }

      const item = sbaccount.items[itemIndex];
      if (['delivered', 'completed'].includes(item.fulfillmentStatus)) {
        throw new Error('This item has already been delivered');
      }

      const itemAmount = Number(item.subtotal || item.price || 0);
      if (itemAmount <= 0) {
        throw new Error('Invalid item amount');
      }
      if (Number(item.paidAmount || 0) >= itemAmount) {
        throw new Error('This item has already been requested');
      }

      const walletAccount = await ensureSBOrderWalletForSBAccount(sbaccount);
      if (!walletAccount) {
        throw new Error('Customer SB order wallet not found');
      }
      if (Number(walletAccount.availableBalance || 0) < itemAmount) {
        throw new Error(`Insufficient wallet balance. Available: ₦${Number(walletAccount.availableBalance || 0).toLocaleString()}, Required: ₦${itemAmount.toLocaleString()}`);
      }

      const currentDate = new Date();
      const formattedDate = currentDate.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      const requestRef = `SB_ITEM_REQUEST_${sbaccount.SBAccountNumber}_${item._id || itemIndex}_${Date.now()}`;
      const nextWalletAvailableBalance = Number(walletAccount.availableBalance || 0) - itemAmount;
      const nextWalletLedgerBalance = Number(walletAccount.ledgerBalance || 0) - itemAmount;
      const currentSBBalance = Number(sbaccount.balance || 0);

      await AccountTransaction.DepositTransactionAccount({
        createdBy,
        transactionOwnerId: createdBy,
        customerId: sbaccount.customerId,
        amount: itemAmount,
        balance: nextWalletAvailableBalance,
        branchId: walletAccount.branchId || sbaccount.branchId,
        accountManagerId: walletAccount.accountManagerId || sbaccount.accountManagerId || '',
        accountNumber: walletAccount.accountNumber,
        accountTypeId: walletAccount._id,
        date: formattedDate,
        package: "Wallet",
        narration: `Debited from wallet for ${item.productName}`,
        transactionRef: requestRef,
        direction: "Debit",
      });

      await AccountTransaction.DepositTransactionAccount({
        createdBy,
        transactionOwnerId: createdBy,
        customerId: sbaccount.customerId,
        amount: itemAmount,
        balance: currentSBBalance,
        branchId: sbaccount.branchId,
        accountManagerId: sbaccount.accountManagerId || walletAccount.accountManagerId || '',
        accountNumber: sbaccount.accountNumber,
        accountTypeId: sbaccount._id,
        date: formattedDate,
        package: "SB",
        narration: `Customer request reserved from SB Order Wallet for ${item.productName} - ${requestRef}`,
        transactionRef: requestRef,
        direction: "Credit",
      });

      await Account.findByIdAndUpdate(walletAccount._id, {
        $set: {
          availableBalance: nextWalletAvailableBalance,
          ledgerBalance: nextWalletLedgerBalance,
        }
      });

      sbaccount.items[itemIndex].paidAmount = itemAmount;
      await sbaccount.save();

      return {
        sbAccount: sbaccount,
        message: 'Customer request submitted successfully'
      };
    };

    const getSBAccountByAccountNumber = async (SBAccountNumber) => {
        return await SBAccount.findOne({ SBAccountNumber:SBAccountNumber });
      };

module.exports = {
    createSBAccount,
    updateSBAccountAmount,
    getCustomerSBAccountById,
    saveSBContribution,
    withdrawSBContribution,
    sellProduct,
    markSBAccountItemDelivered,
    requestSBAccountItemFromWallet,
    updateSBAccountItemCostPrice,
    getBackofficeProductDeliverySummary,
    updateCostPrice
  };
