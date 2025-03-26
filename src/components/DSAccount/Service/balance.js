const DSBalance = require('../Model/balance');

const createDSBalance = async (DSBalanceData) => {
    const dsbalance = new DSBalance(DSBalanceData);
    return await dsbalance.save();
  };
const updateDSBalance = async (DSBalanceData) => {
   const newBalance = await DSBalance.findOneAndUpdate(
        { branchId: DSBalanceData.branchId },
        {
          $set: {
            balance: DSBalanceData.balance,
          },
        }
      );
  return ({message:"Balance updated successfilly", newBalance})
};

module.exports = {
    createDSBalance,
    updateDSBalance,
  };