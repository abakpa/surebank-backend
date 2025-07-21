const CustomerWithdrawalRequestModel = require('../Model/index');

const CustomerWithdrawalRequest = async (withdrawalData) => {
  const withdrawalRequest = new CustomerWithdrawalRequestModel(withdrawalData);
  return await withdrawalRequest.save();
};

const getCustomersWithdrawalRequest = async () => {
    try {
        const requests = await CustomerWithdrawalRequestModel.find({})
            .populate({
                path: 'branchId',
                model: 'Branch',
            })
            .populate({
                path: 'customerId',
                model: 'Customer',
            })
            .populate({
                path: 'accountManagerId',
                model: 'Staff',
            });
        
        // Define the priority order for sorting
        const statusOrder = {
            'pending': 1,
            'processing': 2,
            'completed': 3
        };
        
        // Sort the requests by status priority
        return requests.sort((a, b) => {
            const statusA = (a.status || '').toLowerCase();
            const statusB = (b.status || '').toLowerCase();
            return statusOrder[statusA] - statusOrder[statusB];
        });
    } catch (error) {
        throw error;
    }
}
const getBranchCustomersWithdrawalRequest = async (branchId) => {
    try {
        const requests = await CustomerWithdrawalRequestModel.find({branchId:branchId})
            .populate({
                path: 'branchId',
                model: 'Branch',
            })
            .populate({
                path: 'customerId',
                model: 'Customer',
            })
            .populate({
                path: 'accountManagerId',
                model: 'Staff',
            });
        
        // Define the priority order for sorting
        const statusOrder = {
            'pending': 1,
            'processing': 2,
            'completed': 3
        };
        
        // Sort the requests by status priority
        return requests.sort((a, b) => {
            const statusA = (a.status || '').toLowerCase();
            const statusB = (b.status || '').toLowerCase();
            return statusOrder[statusA] - statusOrder[statusB];
        });
    } catch (error) {
        throw error;
    }
}
const getRepCustomersWithdrawalRequest = async (repId) => {
    try {
        const requests = await CustomerWithdrawalRequestModel.find({accountManagerId:repId})
            .populate({
                path: 'branchId',
                model: 'Branch',
            })
            .populate({
                path: 'customerId',
                model: 'Customer',
            })
            .populate({
                path: 'accountManagerId',
                model: 'Staff',
            });
        
        // Define the priority order for sorting
        const statusOrder = {
            'pending': 1,
            'processing': 2,
            'completed': 3
        };
        
        // Sort the requests by status priority
        return requests.sort((a, b) => {
            const statusA = (a.status || '').toLowerCase();
            const statusB = (b.status || '').toLowerCase();
            return statusOrder[statusA] - statusOrder[statusB];
        });
    } catch (error) {
        throw error;
    }
}
const getCustomersWithdrawalRequestForCustomer = async (customerId) => {
    try {
        const requests = await CustomerWithdrawalRequestModel.find({customerId:customerId})
            .populate({
                path: 'branchId',
                model: 'Branch',
            })
            .populate({
                path: 'customerId',
                model: 'Customer',
            })
            .populate({
                path: 'accountManagerId',
                model: 'Staff',
            });
        
        // Define the priority order for sorting
        const statusOrder = {
            'pending': 1,
            'processing': 2,
            'completed': 3
        };
        
        // Sort the requests by status priority
        return requests.sort((a, b) => {
            const statusA = (a.status || '').toLowerCase();
            const statusB = (b.status || '').toLowerCase();
            return statusOrder[statusA] - statusOrder[statusB];
        });
    } catch (error) {
        throw error;
    }
}
  const updateCustomerWithdrawalRequestStatus = async (details) => {
    const { withdrawalRequestId } = details;
    try {
        // First find the current request
        const currentRequest = await CustomerWithdrawalRequestModel.findById({ _id:withdrawalRequestId });
        
        if (!currentRequest) {
            throw new Error('Withdrawal request not found');
        }

        let newStatus;
        
        // Determine the new status based on current status
        if (currentRequest.status === 'Pending') {
            newStatus = 'processing';
        } else if (currentRequest.status === 'processing') {
            newStatus = 'completed';
        } else {
            throw new Error(`Cannot update from current status: ${currentRequest.status}`);
        }

        // Update the status
        const updatedWithdrawalRequest = await CustomerWithdrawalRequestModel.findOneAndUpdate(
            { _id:withdrawalRequestId },
            { $set: { status: newStatus } },
            { new: true }
        );

        return { 
            success: true, 
            message: 'Status updated successfully', 
            updatedWithdrawalRequest 
        };
    } catch (error) {
        throw new Error(`${error.message}`);
    }
};

module.exports = {
    CustomerWithdrawalRequest,
    getCustomersWithdrawalRequest,
    updateCustomerWithdrawalRequestStatus,
    getBranchCustomersWithdrawalRequest,
    getCustomersWithdrawalRequestForCustomer,
    getRepCustomersWithdrawalRequest

  };