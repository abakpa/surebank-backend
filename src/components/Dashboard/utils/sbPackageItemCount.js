const SB_ITEM_COUNT_THRESHOLD = 10000;

const toNumber = (value) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const getItemValue = (item) => {
  const quantity = Math.max(toNumber(item?.quantity) || 1, 1);
  return toNumber(item?.subtotal) || (toNumber(item?.price) * quantity);
};

const getSBAccountItems = (account) => {
  if (Array.isArray(account?.items) && account.items.length > 0) {
    return account.items.map((item) => ({
      value: getItemValue(item),
    }));
  }

  return [{ value: toNumber(account?.sellingPrice) }];
};

const calculateSBPackageItemSummary = (accounts = []) => {
  return accounts.reduce((summary, account) => {
    const walletBalance = toNumber(account?.balance);
    const items = getSBAccountItems(account);
    let requiredBalanceForNextItem = SB_ITEM_COUNT_THRESHOLD;

    items.forEach((item) => {
      if (walletBalance >= requiredBalanceForNextItem) {
        summary.count += 1;
        requiredBalanceForNextItem += item.value;
      } else {
        summary.insufficientBalanceCount += 1;
      }
    });

    summary.totalItemCount += items.length;
    return summary;
  }, {
    count: 0,
    insufficientBalanceCount: 0,
    totalItemCount: 0,
    threshold: SB_ITEM_COUNT_THRESHOLD,
  });
};

const getSBPackageItemSummary = async (SBAccount, query) => {
  const accounts = await SBAccount.find(query)
    .select('balance sellingPrice items')
    .lean();

  return calculateSBPackageItemSummary(accounts);
};

const getSBPackageCountValue = (summary) => {
  if (summary && typeof summary === 'object') {
    return toNumber(summary.count);
  }

  return toNumber(summary);
};

module.exports = {
  SB_ITEM_COUNT_THRESHOLD,
  calculateSBPackageItemSummary,
  getSBPackageItemSummary,
  getSBPackageCountValue,
};
