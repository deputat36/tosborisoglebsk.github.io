const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'data', 'github_manual_tasks.csv');
const allowedStatuses = new Set(['open', 'closed', 'paused']);

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
  const expectedHeaders = [
    'issue_number',
    'title',
    'group',
    'status',
    'site_tool',
    'source_file',
    'success_criteria',
    'next_action',
    'created_or_updated'
  ];

  if (!headers || expectedHeaders.some((header, index) => headers[index] !== header)) {
    throw new Error('Unexpected github_manual_tasks.csv header');
  }

  const seen = new Set();
  const errors = [];

  items.forEach((item, index) => {
    const line = index + 2;
    const [issueNumber, title, group, status, siteTool, sourceFile, successCriteria, nextAction, date] = item;

    if (!issueNumber) errors.push(`line ${line}: missing issue_number`);
    if (seen.has(issueNumber)) errors.push(`line ${line}: duplicate issue_number ${issueNumber}`);
    seen.add(issueNumber);

    if (!title) errors.push(`line ${line}: missing title`);
    if (!group) errors.push(`line ${line}: missing group`);
    if (!allowedStatuses.has(status)) errors.push(`line ${line}: unsupported status ${status}`);
    if (!siteTool) errors.push(`line ${line}: missing site_tool`);
    if (!sourceFile) errors.push(`line ${line}: missing source_file`);
    if (!successCriteria) errors.push(`line ${line}: missing success_criteria`);
    if (!nextAction) errors.push(`line ${line}: missing next_action`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push(`line ${line}: invalid created_or_updated ${date}`);
  });

  if (errors.length) {
    throw new Error(`Manual tasks audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Manual tasks OK: ${items.length} rows`);
}

main();
