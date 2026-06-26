const { readCsv } = require('./audit_request_sources');
const { requestSourceStatuses } = require('./lib/status_sets');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function checkFile(relativePath) {
  const { headers, items } = readCsv(relativePath);
  const statusIndex = headers.indexOf('status');

  assert(statusIndex !== -1, `${relativePath}: status header is required`);

  items.forEach((item, index) => {
    const line = index + 2;
    const value = item[statusIndex];

    assert(requestSourceStatuses.has(value), `${relativePath}: line ${line}: unsupported status ${value}`);
  });
}

checkFile('data/candidate_registry_requests.csv');
checkFile('data/projects_2026_result_requests.csv');

console.log('Request source status values tests OK');
