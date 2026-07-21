const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { validateHeaders } = require('./lib/csv_schema');
const { repoPathExists } = require('./lib/path_checks');
const contract = require('../assets/js/publication-queue-contract.js');

const filePath = path.join(process.cwd(), 'data', 'publication_queue.csv');

function main() {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }

  const rows = parseCsv(fs.readFileSync(filePath, 'utf8'));
  const [headers, ...items] = rows;
  const errors = validateHeaders(headers, contract.QUEUE_HEADERS, 'publication_queue.csv');
  const seen = new Set();

  items.forEach((item, index) => {
    const line = index + 2;
    if (item.length !== contract.QUEUE_HEADERS.length) {
      errors.push(`line ${line}: expected ${contract.QUEUE_HEADERS.length} cells, got ${item.length}`);
      return;
    }

    const row = Object.fromEntries(contract.QUEUE_HEADERS.map((header, cellIndex) => [header, item[cellIndex] || '']));
    contract.validateCanonicalRow(row).forEach((message) => errors.push(`line ${line}: ${message}`));

    if (row.queue_id && seen.has(row.queue_id)) errors.push(`line ${line}: duplicate queue_id ${row.queue_id}`);
    if (row.queue_id) seen.add(row.queue_id);

    if (row.target_file && !repoPathExists(row.target_file)) {
      errors.push(`line ${line}: missing target_file ${row.target_file}`);
    }
  });

  if (errors.length) {
    throw new Error(`Publication queue audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Publication queue OK: ${items.length} rows; statuses=${[...contract.STATUSES].join(',')}`);
}

main();
