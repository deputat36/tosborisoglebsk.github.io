const {
  readCsv,
  validatePriorityRequests,
  validateCandidateRequests,
  validateProjectResultRequests
} = require('./audit_request_sources');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const priority = readCsv('data/priority_tos_requests.csv');
assert(priority.items.length >= 4, 'priority requests must contain at least 4 rows');
assert(priority.headers.includes('slug'), 'priority requests must contain slug header');

let errors = [];
validatePriorityRequests(errors);
assert(errors.length === 0, `priority requests must pass validation: ${errors.join('; ')}`);

errors = [];
validateCandidateRequests(errors);
assert(errors.length === 0, `candidate requests must pass validation: ${errors.join('; ')}`);

errors = [];
validateProjectResultRequests(errors);
assert(errors.length === 0, `project result requests must pass validation: ${errors.join('; ')}`);

console.log('Request sources import tests OK');
