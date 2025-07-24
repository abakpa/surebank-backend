const CustomerWithdrawalRequest = require('../Service/index');
require('dotenv').config()


const withdrawalRequest = async (req, res) => {
  try {
    const { 
        accountNumber,
        customerId, 
        accountManagerId, 
        accountTypeId, 
        packageNumber,
        branchId,
        package, 
        bankName,
        shippingAddress,
        productName,
        bankAccountNumber,
        accountName,
        channelOfWithdrawal,
        amount 
    } = req.body;
        const date = new Date()
    const  withdrawalRequest= await CustomerWithdrawalRequest.CustomerWithdrawalRequest({ 
        accountNumber,
        customerId, 
        accountManagerId, 
        accountTypeId, 
        packageNumber,
        branchId,
        package, 
        bankName,
        shippingAddress,
        productName,
        bankAccountNumber,
        accountName,
        channelOfWithdrawal,
        date,
        amount 
    });

    res.status(201).json({ message: 'Withdrawal request sent successfully', withdrawalRequest: withdrawalRequest });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

     const getCustomersWithdrawalRequest = async (req, res) => {
        try {
            const customersWithdrawalRequest = await CustomerWithdrawalRequest.getCustomersWithdrawalRequest();
            res.status(200).json(customersWithdrawalRequest);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
     const getRepCustomersWithdrawalRequest = async (req, res) => {
        const repId = req.staff.staffId;
        try {
            const customersWithdrawalRequest = await CustomerWithdrawalRequest.getRepCustomersWithdrawalRequest(repId);
            res.status(200).json(customersWithdrawalRequest);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
     const getBranchCustomersWithdrawalRequest = async (req, res) => {
        const branchId = req.params.id
        try {
            const customersWithdrawalRequest = await CustomerWithdrawalRequest.getBranchCustomersWithdrawalRequest(branchId);
            res.status(200).json(customersWithdrawalRequest);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
     const getCustomersWithdrawalRequestForCustomer = async (req, res) => {
        const customerId = req.params.id
        try {
            const customersWithdrawalRequest = await CustomerWithdrawalRequest.getCustomersWithdrawalRequestForCustomer(customerId);
            res.status(200).json(customersWithdrawalRequest);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
     const updateCustomerWithdrawalRequestStatus = async (req,res) => {
        const withdrawalRequestId = req.params.id
        try {
      
      const newStatus = await CustomerWithdrawalRequest.updateCustomerWithdrawalRequestStatus({withdrawalRequestId})
          res.status(201).json({ data: newStatus });
        } catch (error) {
          res.status(500).json({ message: error.message });
        }
      };

  module.exports = {
    withdrawalRequest,
    getCustomersWithdrawalRequest,
    updateCustomerWithdrawalRequestStatus,
    getBranchCustomersWithdrawalRequest,
    getBranchCustomersWithdrawalRequest,
    getCustomersWithdrawalRequestForCustomer,
    getRepCustomersWithdrawalRequest

  };