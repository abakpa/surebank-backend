const Account = require('../../Account/Model');
const  generateUniqueAccountNumber  = require('../../generateAccountNumber');
const SBAccount = require('../Model/index');
const Order = require('../Model/order');
const AccountTransaction = require('../../AccountTransaction/Service/index');
const AccountTransactionModel = require('../../AccountTransaction/Model/index');
const SureBankAccount = require('../../SureBankAccount/Service/index');
const ProductService = require('../../Product/Service/index');
const Product = require('../../Product/Model/index');
const ProductBranchStock = require('../../ProductBranchStock/Model/index');
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
      ledgerBalance: Number(walletAccount.ledgerBalance || 0),
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
            SBAccountData.items = items;
            SBAccountData.productName = items.map((item) => item.productName).join(', ');
            SBAccountData.productDescription = items
              .map((item) => item.productDescription)
              .filter(Boolean)
              .join(' | ') || SBAccountData.productName;
            SBAccountData.sellingPrice = items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
            SBAccountData.costPrice = items.reduce((sum, item) => sum + Number(item.costSubtotal || 0), 0);
            SBAccountData.profit = items.reduce((sum, item) => sum + Number(item.profitAmount || 0), 0);
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

  const getCustomerSBAccountById = async (customerId) =>{
    try {
        return await SBAccount.find({customerId:customerId});
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
    const sbaccount = await SBAccount.findOne({
      SBAccountNumber: contributionInput.SBAccountNumber,
      productName: contributionInput.productName,
    });
  
    if (!sbaccount) {
      throw new error('Customer does not have an active package');
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
      if (Number(sbaccount.balance || 0) < itemAmount) {
        throw new Error('Insufficient amount for item price');
      }
      await hydrateSBItemCostFromProduct(sbaccount, itemIndex, createdBy);
      const deliveryItem = sbaccount.items[itemIndex];
      if (Number(deliveryItem.costSubtotal || 0) <= 0 || deliveryItem.requiresCostApproval) {
        throw new Error('Ask admin for approval');
      }
      await updateSBItemStock(sbaccount, deliveryItem, 'decrease', createdBy);

      const account = await Account.findOne({ accountNumber: sbaccount.accountNumber });
      if (!account) {
        await updateSBItemStock(sbaccount, deliveryItem, 'increase', createdBy);
        throw new Error('Account not found for ledger update');
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
      const newBalance = Number(sbaccount.balance || 0) - itemAmount;
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
          narration: `${deliveryItem.productName} delivered from ${sbaccount.productName}`,
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
          await transferSBExcessBalanceToWallet({
            sbaccount,
            walletAccount: account,
            amount: sbaccount.balance,
            date: currentDate,
            formattedDate,
            createdBy,
          });
        }

        await Account.findOneAndUpdate(
          { accountNumber: sbaccount.accountNumber },
          { $set: { ledgerBalance: Number(account.ledgerBalance || 0) - itemAmount } }
        );
        await sbaccount.save();
      } catch (error) {
        await updateSBItemStock(sbaccount, deliveryItem, 'increase', createdBy);
        throw error;
      }

      return { data: transaction, sbAccount: sbaccount, message: 'Item delivered successfully' };
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
    updateSBAccountItemCostPrice,
    updateCostPrice
  };
