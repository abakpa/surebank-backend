const isAbsoluteUrl = (value = '') => /^https?:\/\//i.test(value);

module.exports = {
  isAbsoluteUrl
};
