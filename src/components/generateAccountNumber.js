const Account = require("../components/Account/Model/index");

const generateUniqueAccountNumber = async (accountType) => {
  const accountT = accountType;
  let number;
  do {
    number = accountT + Math.floor(Math.random() * 10000000);
  } while (await Account.findOne({ accountNumber: number }));
  return number;
};

module.exports = generateUniqueAccountNumber