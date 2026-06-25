const { validateHeaders } = require('./lib/csv_schema');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

let errors = validateHeaders(['a', 'b'], ['a', 'b'], 'sample.csv');
assert(errors.length === 0, 'valid headers must not produce errors');

errors = validateHeaders(['a', 'x'], ['a', 'b'], 'sample.csv');
assert(errors.length === 1, 'wrong header must produce one error');
assert(errors[0].includes('expected header b'), 'wrong header error must mention expected header');

errors = validateHeaders(['a'], ['a', 'b'], 'sample.csv');
assert(errors.length >= 1, 'short header must produce an error');

errors = validateHeaders(null, ['a', 'b'], 'sample.csv');
assert(errors.length === 1, 'missing header must produce one error');

console.log('CSV schema tests OK');
