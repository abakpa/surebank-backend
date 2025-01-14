const accountService = require("../Service/index");

const createAccount = async (req,res) => {
  try {
    const account = "002" + Math.floor(Math.random() * 10000000);

    const existingAccount = await accountService.checkAccount(account);

    if (existingAccount) {
      return sendApiError(res, "Account already exist");
    }

    const accountNumber = account;
    const customerId  = req.customer.id
    const createdBy = req.staff.id;
    const status = "active";
    const accountManagerId = req.body.accountManagerId;
    const branchId = req.body.branchId;
    const availableBalance = 0;
    const ledgerBalance = 0;

    const createCustomerAccount = await accountService.createAccount({
      branchId,
      accountManagerId,
      customerId,
      accountNumber,
      createdBy,
      status,
      availableBalance,
      ledgerBalance,
    });
    res.status(201).json({ message: 'Account successfully created', customerAccount: createCustomerAccount });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getCustomerAccount = async (req, res) => {
  try {
    const {accountNumber} = req.body
      const customerAccount = await accountService.getCustomerAccount(accountNumber);
      res.status(200).json(customerAccount);
  } catch (error) {
      res.status(500).json({ message: error.message });
  }
}
module.exports = {
    createAccount,
    getCustomerAccount
  };