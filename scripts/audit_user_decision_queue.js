const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'data', 'user_decision_queue.csv');
const allowedStatuses = new Set(['assumed_default', 'waiting', 'not_needed_now', 'done']);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && quoted && next === '"') {
      value += '"';
      i += 1;
      continue;
    }

    if (ch === '"') {
      quoted = !quoted;
      continue;
    }

    if (ch === ',' && !quoted) {
      row.push(value);
      value = '';
      continue;
    }

    if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && next === '\n') i += 1;
      row.push(value);
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
      value = '';
      continue;
    }

    value += ch;
  }

  if (value || row.length) {
    row.push(value);
    if (row.some((cell) => cell.trim() !== '')) rows.push(row);
  }

  return rows;
}

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
