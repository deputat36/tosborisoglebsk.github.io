function isPositiveIntegerString(value) {
  return /^[1-9]\d*$/.test(value || '');
}

module.exports = { isPositiveIntegerString };
