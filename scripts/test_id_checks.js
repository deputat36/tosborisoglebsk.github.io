const { isPositiveIntegerString } = require('./lib/id_checks');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(isPositiveIntegerString('1'), '1 must be accepted');
assert(isPositiveIntegerString('34'), '34 must be accepted');
assert(isPositiveIntegerString('166'), '166 must be accepted');
assert(!isPositiveIntegerString('0'), '0 must not be accepted');
assert(!isPositiveIntegerString('-1'), 'negative value must not be accepted');
assert(!isPositiveIntegerString('1.5'), 'decimal value must not be accepted');
assert(!isPositiveIntegerString('abc'), 'text value must not be accepted');
assert(!isPositiveIntegerString(''), 'empty value must not be accepted');
assert(!isPositiveIntegerString(null), 'null value must not be accepted');

console.log('ID checks tests OK');
