const { isIsoDate } = require('./lib/date_checks');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(isIsoDate('2026-06-25'), 'valid ISO date must be accepted');
assert(isIsoDate('2024-02-29'), 'valid leap day must be accepted');
assert(!isIsoDate('25.06.2026'), 'dot date must not be accepted');
assert(!isIsoDate('2026/06/25'), 'slash date must not be accepted');
assert(!isIsoDate('2026-6-25'), 'short month must not be accepted');
assert(!isIsoDate('2026-02-30'), 'invalid February day must not be accepted');
assert(!isIsoDate('2026-13-01'), 'invalid month must not be accepted');
assert(!isIsoDate('2026-00-10'), 'zero month must not be accepted');
assert(!isIsoDate('2026-01-00'), 'zero day must not be accepted');
assert(!isIsoDate(''), 'empty date must not be accepted');
assert(!isIsoDate(null), 'null date must not be accepted');

console.log('Date checks tests OK');
