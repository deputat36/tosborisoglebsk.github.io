const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');

const filePath = path.join(process.cwd(), 'data', 'user_decision_queue.csv');
const allowedStatuses = new Set(['assumed_default', 'waiting', 'not_needed_now', 'done']);

function main() {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }

  const rows = parseCsv(fs.readFileSync(filePath, 'utf8'));
  const [headers, ...items] = rows;
  const requiredHeaders = ['decision_id', 'priority', 'area', 'topic', 'default_mode', 'status', 'linked_task'];

  if (!headers || requiredHeaders.some((header, index) => headers[index] !== header)) {
    throw new Error('Unexpected user_decision_queue.csv header');
  }

  const seen = new Set();
  const errors = [];

  items.forEach((item, index) => {
    const line = index + 2;
    const [decisionId, priority, area, topic, defaultMode, status] = item;

    if (!decisionId) errors.push(`line ${line}: missing decision_id`);
    if (seen.has(decisionId)) errors.push(`line ${line}: duplicate decision_id ${decisionId}`);
    seen.add(decisionId);

    if (!priority) errors.push(`line ${line}: missing priority`);
    if (!area) errors.push(`line ${line}: missing area`);
    if (!topic) errors.push(`line ${line}: missing topic`);
    if (!defaultMode) errors.push(`line ${line}: missing default_mode`);
    if (!allowedStatuses.has(status)) errors.push(`line ${line}: unsupported status ${status}`);
  });

  if (errors.length) {
    throw new Error(`Decision queue audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Decision queue OK: ${items.length} rows`);
}

main();
