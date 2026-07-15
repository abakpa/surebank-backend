const StockTransfer = require('../Model/index');
const Product = require('../../Product/Model/index');
const Branch = require('../../Branch/Model/index');
const Staff = require('../../Staff/Model/index');
const ProductService = require('../../Product/Service/index');

const normalizeQuantity = (quantity) => {
  const value = Number(quantity);
  const normalized = Math.floor(value);
  if (!Number.isFinite(value) || normalized <= 0) {
    throw new Error('Transfer quantity must be greater than zero');
  }
  return normalized;
};

const requireManagerBranch = (staff) => {
  if (staff?.role !== 'Manager') {
    throw new Error('Only branch managers can manage stock transfers');
  }
  if (!staff.branchId) {
    throw new Error('Manager branch is required for stock transfer');
  }
  return staff.branchId.toString();
};

const ensureProductAndVariation = async (productId, variationId = '') => {
  const product = await Product.findById(productId);
  if (!product) {
    throw new Error('Product not found');
  }

  if (variationId) {
    const variation = product.variations.id(variationId);
    if (!variation) {
      throw new Error('Product variation not found');
    }
  }

  return product;
};

const ensureBranch = async (branchId, label) => {
  const branch = await Branch.findById(branchId);
  if (!branch || branch.isActive === false) {
    throw new Error(`${label} branch not found`);
  }
  return branch;
};

const populateTransfer = async (transfer) => {
  const item = transfer.toObject ? transfer.toObject() : { ...transfer };
  const [product, sourceBranch, destinationBranch, initiatedBy, acceptedBy, rejectedBy, cancelledBy] = await Promise.all([
    Product.findById(item.productId).lean(),
    Branch.findById(item.sourceBranchId).lean(),
    Branch.findById(item.destinationBranchId).lean(),
    Staff.findById(item.initiatedBy).select('firstName lastName role').lean(),
    item.acceptedBy ? Staff.findById(item.acceptedBy).select('firstName lastName role').lean() : null,
    item.rejectedBy ? Staff.findById(item.rejectedBy).select('firstName lastName role').lean() : null,
    item.cancelledBy ? Staff.findById(item.cancelledBy).select('firstName lastName role').lean() : null
  ]);

  const variation = item.variationId && product?.variations
    ? product.variations.find((entry) => String(entry._id || '') === String(item.variationId))
    : null;
  const formatStaff = (staff) => staff ? `${staff.firstName || ''} ${staff.lastName || ''}`.trim() : '';

  return {
    ...item,
    productName: product?.name || 'Unknown Product',
    variationName: variation?.name || '',
    sourceBranchName: sourceBranch?.name || 'Unknown Branch',
    destinationBranchName: destinationBranch?.name || 'Unknown Branch',
    initiatedByName: formatStaff(initiatedBy),
    acceptedByName: formatStaff(acceptedBy),
    rejectedByName: formatStaff(rejectedBy),
    cancelledByName: formatStaff(cancelledBy)
  };
};

const createTransfer = async ({ productId, variationId = '', destinationBranchId, quantity, note = '' }, staff) => {
  const sourceBranchId = requireManagerBranch(staff);
  const transferQuantity = normalizeQuantity(quantity);
  if (!destinationBranchId) {
    throw new Error('Destination branch is required');
  }
  if (sourceBranchId === destinationBranchId.toString()) {
    throw new Error('Destination branch must be different from source branch');
  }

  await Promise.all([
    ensureProductAndVariation(productId, variationId),
    ensureBranch(sourceBranchId, 'Source'),
    ensureBranch(destinationBranchId, 'Destination')
  ]);

  await ProductService.updateProductStock(
    productId,
    transferQuantity,
    'decrease',
    variationId || '',
    sourceBranchId,
    staff.staffId
  );

  try {
    const transfer = await StockTransfer.create({
      productId,
      variationId: variationId || '',
      quantity: transferQuantity,
      sourceBranchId,
      destinationBranchId,
      initiatedBy: staff.staffId,
      note
    });

    return await populateTransfer(transfer);
  } catch (error) {
    await ProductService.updateProductStock(
      productId,
      transferQuantity,
      'increase',
      variationId || '',
      sourceBranchId,
      staff.staffId
    );
    throw error;
  }
};

const getTransfers = async (staff, filters = {}) => {
  if (!['Admin', 'Manager'].includes(staff?.role)) {
    throw new Error('You are not allowed to view stock transfers');
  }
  const managerBranchId = staff?.role === 'Manager' ? requireManagerBranch(staff) : '';
  const query = {};
  const page = Math.max(1, Number.parseInt(filters.page, 10) || 1);
  const limit = Math.min(100, Math.max(10, Number.parseInt(filters.limit, 10) || 25));
  const skip = (page - 1) * limit;

  if (managerBranchId) {
    query.$or = [
      { sourceBranchId: managerBranchId },
      { destinationBranchId: managerBranchId }
    ];
  }
  if (filters.status && ['pending', 'accepted', 'rejected', 'cancelled'].includes(filters.status)) {
    query.status = filters.status;
  }
  if (filters.dateFrom || filters.dateTo) {
    query.createdAt = {};
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      if (!Number.isNaN(fromDate.getTime())) {
        fromDate.setHours(0, 0, 0, 0);
        query.createdAt.$gte = fromDate;
      }
    }
    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      if (!Number.isNaN(toDate.getTime())) {
        toDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = toDate;
      }
    }
    if (Object.keys(query.createdAt).length === 0) {
      delete query.createdAt;
    }
  }

  if (staff?.role === 'Admin') {
    if (filters.sourceBranchId) {
      query.sourceBranchId = filters.sourceBranchId;
    }
    if (filters.destinationBranchId) {
      query.destinationBranchId = filters.destinationBranchId;
    }
  }

  const [total, transfers] = await Promise.all([
    StockTransfer.countDocuments(query),
    StockTransfer.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit)
  ]);
  const data = await Promise.all(transfers.map((transfer) => populateTransfer(transfer)));

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1
    }
  };
};

const acceptTransfer = async (transferId, staff, responseNote = '') => {
  const destinationBranchId = requireManagerBranch(staff);
  const transfer = await StockTransfer.findById(transferId);
  if (!transfer) {
    throw new Error('Stock transfer not found');
  }
  if (transfer.status !== 'pending') {
    throw new Error('Only pending transfers can be accepted');
  }
  if (transfer.destinationBranchId !== destinationBranchId) {
    throw new Error('Only the destination branch manager can accept this transfer');
  }

  await ProductService.updateProductStock(
    transfer.productId,
    transfer.quantity,
    'increase',
    transfer.variationId || '',
    destinationBranchId,
    staff.staffId
  );

  transfer.status = 'accepted';
  transfer.acceptedBy = staff.staffId;
  transfer.acceptedAt = new Date();
  transfer.responseNote = responseNote || '';
  await transfer.save();

  return await populateTransfer(transfer);
};

const returnReservedStock = async (transfer, staffId) => {
  await ProductService.updateProductStock(
    transfer.productId,
    transfer.quantity,
    'increase',
    transfer.variationId || '',
    transfer.sourceBranchId,
    staffId
  );
};

const rejectTransfer = async (transferId, staff, responseNote = '') => {
  const destinationBranchId = requireManagerBranch(staff);
  const transfer = await StockTransfer.findById(transferId);
  if (!transfer) {
    throw new Error('Stock transfer not found');
  }
  if (transfer.status !== 'pending') {
    throw new Error('Only pending transfers can be rejected');
  }
  if (transfer.destinationBranchId !== destinationBranchId) {
    throw new Error('Only the destination branch manager can reject this transfer');
  }

  await returnReservedStock(transfer, staff.staffId);
  transfer.status = 'rejected';
  transfer.rejectedBy = staff.staffId;
  transfer.rejectedAt = new Date();
  transfer.responseNote = responseNote || '';
  await transfer.save();

  return await populateTransfer(transfer);
};

const cancelTransfer = async (transferId, staff) => {
  const sourceBranchId = requireManagerBranch(staff);
  const transfer = await StockTransfer.findById(transferId);
  if (!transfer) {
    throw new Error('Stock transfer not found');
  }
  if (transfer.status !== 'pending') {
    throw new Error('Only pending transfers can be cancelled');
  }
  if (transfer.sourceBranchId !== sourceBranchId) {
    throw new Error('Only the source branch manager can cancel this transfer');
  }

  await returnReservedStock(transfer, staff.staffId);
  transfer.status = 'cancelled';
  transfer.cancelledBy = staff.staffId;
  transfer.cancelledAt = new Date();
  await transfer.save();

  return await populateTransfer(transfer);
};

module.exports = {
  createTransfer,
  getTransfers,
  acceptTransfer,
  rejectTransfer,
  cancelTransfer
};
