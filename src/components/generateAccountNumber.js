import Account from "./Account/Model/index";

export const generateUniqueAccountNumber = async (accountType) => {
  const accountT = accountType;
  let number;
  do {
    number = accountT + Math.floor(Math.random() * 100000000);
  } while (await Account.findOne({ accountNumber: number }));
  return number;
};