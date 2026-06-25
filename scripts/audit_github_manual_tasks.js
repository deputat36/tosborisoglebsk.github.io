const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { manualTaskStatuses } = require('./lib/status_sets');

const filePath = path.join(process.cwd(), 'data', 'github_manual_tasks.csv');

function siteToolExists(value) {
  if (!value) return false;

  if (value.startsWith('/')) {
    const clean = value.replace(/^\/+/, '');
    const directPath = path.join(process.cwd(), clean);
    const indexPath = path.join(process.cwd(), clean, 'index.html');
    return fs.existsSync(directPath) || fs.existsSync(indexPath);
  }

  return fs.existsSync(path.join(process.cwd(), value));
}

function sourceFileExists(value) {
  if (!value) return false;
  return fs.existsSync(path.join(process.cwd(), value));
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
    if (!manualTaskStatuses.has(status)) errors.push(`line ${line}: unsupported status ${status}`);
    if (!siteTool) errors.push(`line ${line}: missing site_tool`);
    if (siteTool && !siteToolExists(siteTool)) errors.push(`line ${line}: missing site_tool target ${siteTool}`);
    if (!sourceFile) errors.push(`line ${line}: missing source_file`);
    if (sourceFile && !sourceFileExists(sourceFile)) errors.push(`line ${line}: missing source_file target ${sourceFile}`);
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
