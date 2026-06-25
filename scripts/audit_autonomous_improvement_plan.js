const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'data', 'autonomous_improvement_plan.csv');
const allowedPriorities = new Set(['high', 'medium', 'low']);
const allowedModes = new Set(['assistant', 'mixed']);
const allowedStatuses = new Set([
  'done',
  'planned',
  'waiting_for_confirmed_data',
  'waiting_for_send_confirmation',
  'waiting_for_source',
  'waiting_for_manual_check',
  'waiting_for_files',
  'needs_review'
]);

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
  const expectedHeaders = ['stage', 'priority', 'area', 'task', 'mode', 'deliverable', 'status'];

  if (!headers || expectedHeaders.some((header, index) => headers[index] !== header)) {
    throw new Error('Unexpected autonomous_improvement_plan.csv header');
  }

  const seenStages = new Set();
  const errors = [];

  items.forEach((item, index) => {
    const line = index + 2;
    const [stage, priority, area, task, mode, deliverable, status] = item;

    if (!stage) errors.push(`line ${line}: missing stage`);
    if (seenStages.has(stage)) errors.push(`line ${line}: duplicate stage ${stage}`);
    seenStages.add(stage);

    if (!allowedPriorities.has(priority)) errors.push(`line ${line}: unsupported priority ${priority}`);
    if (!area) errors.push(`line ${line}: missing area`);
    if (!task) errors.push(`line ${line}: missing task`);
    if (!allowedModes.has(mode)) errors.push(`line ${line}: unsupported mode ${mode}`);
    if (!deliverable) errors.push(`line ${line}: missing deliverable`);
    if (!allowedStatuses.has(status)) errors.push(`line ${line}: unsupported status ${status}`);
  });

  if (errors.length) {
    throw new Error(`Autonomous improvement plan audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Autonomous improvement plan OK: ${items.length} rows`);
}

main();
