const SBAccountService = require('../Service/index');
require('dotenv').config()

const COST_FIELDS = [
  'costPrice',
  'costSubtotal',
  'profit',
  'profitAmount',
  'profitReported',
  'profitReportedAt',
  'costApprovedBy',
  'costApprovedAt'
];

const hideCostFields = (value) => {
  if (!value) return value;
  const record = typeof value.toObject === 'function' ? value.toObject() : { ...value };

  COST_FIELDS.forEach((field) => {
    delete record[field];
  });

  if (Array.isArray(record.items)) {
    record.items = record.items.map((item) => {
      const nextItem = { ...item };
      COST_FIELDS.forEach((field) => {
        delete nextItem[field];
      });
      return nextItem;
    });
  }

  return record;
};

const formatSBAccountResponse = (data, requesterRole) => {
  if (requesterRole === 'Admin') {
    return data;
  }

  return Array.isArray(data)
    ? data.map((item) => hideCostFields(item))
    : hideCostFields(data);
};


    const createSBAccount = async (req, res) => {
        try {
        const createdBy = req.staff.staffId;
        const currentDate = new Date();
        const startDate = currentDate.toLocaleString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "2-digit", // Abbreviated year (YY)
          hour: "2-digit",
          minute: "2-digit",
          hour12: true, // Ensures AM/PM format
        });
        const status = 'booked';
          const { accountNumber,productName,productDescription, sellingPrice, accountManagerId, items } = req.body;
          const newSBAccount = await SBAccountService.createSBAccount({ accountNumber,productName,productDescription, sellingPrice,items,createdBy,startDate,status,accountManagerId });
          res.status(201).json({
            message: newSBAccount.message,
            DSBccount: formatSBAccountResponse(newSBAccount.newSBAccount, req.staff?.role)
          });
        } catch (error) {
          res.status(500).json({ message: 'Server error', error: error.message });
        }
      };
      const updateSBAccountAmount = async (req,res) => {
        const editedBy = req.staff.staffId;
        const {SBAccountNumber,sellingPrice,productName} = req.body
        try {
      
      const newData = await SBAccountService.updateSBAccountAmount({SBAccountNumber,sellingPrice,productName,editedBy})
          res.status(201).json({ data: newData });
        } catch (error) {
          res.status(500).json({ message: error.message });
        }
      };
      const updateCostPrice = async (req,res) => {
        const editedBy = req.staff.staffId;
        const {SBAccountNumber,costPrice,productName} = req.body
        try {
      
      const newData = await SBAccountService.updateCostPrice({SBAccountNumber,costPrice,productName,editedBy})
          res.status(201).json({ message:newData.message });
        } catch (error) {
          res.status(500).json({ message: error.message });
        }
      };
      
      const getDSAccount = async (req, res) => {
        try {
            const DSAccounts = await DSAccountService.getDSAccounts();
            res.status(200).json(DSAccounts);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
      const getCustomerSBAccountById = async (req, res) => {
        try {
          const customerId = req.params.id
            const SBAccounts = await SBAccountService.getCustomerSBAccountById(customerId, req.staff?.role || '');
            res.status(200).json(formatSBAccountResponse(SBAccounts, req.staff?.role));
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
      const getClosedLegacySBAccounts = async (req, res) => {
        try {
          const accounts = await SBAccountService.getClosedLegacySBAccounts();
          res.status(200).json(accounts);
        } catch (error) {
          res.status(500).json({ message: error.message });
        }
      }
      
      const saveSBContribution = async (req, res) => {
        try{
        const contributionInput = req.body;
        const createdBy = req.staff.staffId;
        // const packageId = req.query;
        const result = await SBAccountService.saveSBContribution({ ...contributionInput, createdBy});
        res.status(200).json({data:result.data,message:result.message});
      }catch(error){
        res.status(500).json({ message: error.message });
      }
    }
      const withdrawSBContribution = async (req, res) => {
        try{
        const contributionInput = req.body;
        const createdBy = req.staff.staffId;
        // const packageId = req.query;
        const result = await SBAccountService.withdrawSBContribution({ ...contributionInput, createdBy});
        res.status(200).json({data:result.data,message:result.message});
      }catch(error){
        res.status(500).json({ message: error.message });
      }
    }
      const sellProduct = async (req, res) => {
        try{
        const contributionInput = req.body;
        const createdBy = req.staff.staffId;
        // const packageId = req.query;
        const result = await SBAccountService.sellProduct({ ...contributionInput, createdBy});
        res.status(200).json({data:result.data,message:result.message});
      }catch(error){
        res.status(500).json({ message: error.message });
      }
    }
      const markItemDelivered = async (req, res) => {
        try {
          const createdBy = req.staff.staffId;
          const { SBAccountNumber, itemId } = req.params;
          const result = await SBAccountService.markSBAccountItemDelivered({ SBAccountNumber, itemId, createdBy });
          res.status(200).json({
            ...result,
            sbAccount: formatSBAccountResponse(result.sbAccount, req.staff?.role)
          });
        } catch (error) {
          res.status(500).json({ message: error.message });
        }
      }
      const requestItemFromWallet = async (req, res) => {
        try {
          const createdBy = req.staff.staffId;
          const requesterRole = req.staff.role;
          const { SBAccountNumber, itemId } = req.params;
          const result = await SBAccountService.requestSBAccountItemFromWallet({
            SBAccountNumber,
            itemId,
            createdBy,
            requesterRole
          });
          res.status(200).json({
            ...result,
            sbAccount: formatSBAccountResponse(result.sbAccount, req.staff?.role)
          });
        } catch (error) {
          res.status(500).json({ message: error.message });
        }
      }
      const updateItemCostPrice = async (req, res) => {
        try {
          const editedBy = req.staff.staffId;
          const { SBAccountNumber, itemId } = req.params;
          const { costPrice } = req.body;
          const result = await SBAccountService.updateSBAccountItemCostPrice({ SBAccountNumber, itemId, costPrice, editedBy });
          res.status(200).json(result);
        } catch (error) {
          res.status(500).json({ message: error.message });
        }
      }
      const getBackofficeProductDeliverySummary = async (req, res) => {
        try {
          const result = await SBAccountService.getBackofficeProductDeliverySummary(req.staff, {
            staffId: req.query.staffId,
            dateFrom: req.query.dateFrom,
            dateTo: req.query.dateTo
          });
          res.status(200).json(result);
        } catch (error) {
          res.status(500).json({ message: error.message });
        }
      }
      const getSBAccountItemReceipt = async (req, res) => {
        try {
          const { SBAccountNumber, itemId } = req.params;
          const receipt = await SBAccountService.getSBAccountItemReceipt({ SBAccountNumber, itemId, audience: 'staff' });
          res.status(200).json(receipt);
        } catch (error) {
          res.status(500).json({ message: error.message });
        }
      }
      const getCustomerSBAccountItemReceipt = async (req, res) => {
        try {
          const { SBAccountNumber, itemId } = req.params;
          const receipt = await SBAccountService.getSBAccountItemReceipt({
            SBAccountNumber,
            itemId,
            customerId: req.customer.customerId,
            audience: 'customer'
          });
          res.status(200).json(receipt);
        } catch (error) {
          res.status(500).json({ message: error.message });
        }
      }

  module.exports = {
    createSBAccount,
    getDSAccount,
    saveSBContribution,
    getCustomerSBAccountById,
    getClosedLegacySBAccounts,
    updateSBAccountAmount,
    withdrawSBContribution,
    sellProduct,
    markItemDelivered,
    requestItemFromWallet,
    updateItemCostPrice,
    getSBAccountItemReceipt,
    getCustomerSBAccountItemReceipt,
    getBackofficeProductDeliverySummary,
    updateCostPrice
  };
