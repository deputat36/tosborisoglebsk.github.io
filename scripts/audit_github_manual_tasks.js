const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { validateHeaders } = require('./lib/csv_schema');
const { isIsoDate } = require('./lib/date_checks');
const { repoPathExists } = require('./lib/path_checks');
const { manualTaskStatuses, manualTaskGroups } = require('./lib/status_sets');

const filePath = path.join(process.cwd(), 'data', 'github_manual_tasks.csv');
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

function main() {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }

  const rows = parseCsv(fs.readFileSync(filePath, 'utf8'));
  const [headers, ...items] = rows;
  const errors = validateHeaders(headers, expectedHeaders, 'github_manual_tasks.csv');
  const seen = new Set();

  items.forEach((item, index) => {
    const line = index + 2;
    const [issueNumber, title, group, status, siteTool, sourceFile, successCriteria, nextAction, date] = item;

    if (!issueNumber) errors.push(`line ${line}: missing issue_number`);
    if (seen.has(issueNumber)) errors.push(`line ${line}: duplicate issue_number ${issueNumber}`);
    seen.add(issueNumber);

    if (!title) errors.push(`line ${line}: missing title`);
    if (!manualTaskGroups.has(group)) errors.push(`line ${line}: unsupported group ${group}`);
    if (!manualTaskStatuses.has(status)) errors.push(`line ${line}: unsupported status ${status}`);
    if (!siteTool) errors.push(`line ${line}: missing site_tool`);
    if (siteTool && !repoPathExists(siteTool)) errors.push(`line ${line}: missing site_tool target ${siteTool}`);
    if (!sourceFile) errors.push(`line ${line}: missing source_file`);
    if (sourceFile && !repoPathExists(sourceFile)) errors.push(`line ${line}: missing source_file target ${sourceFile}`);
    if (!successCriteria) errors.push(`line ${line}: missing success_criteria`);
    if (!nextAction) errors.push(`line ${line}: missing next_action`);
    if (!isIsoDate(date)) errors.push(`line ${line}: invalid created_or_updated ${date}`);
  });

  if (errors.length) {
    throw new Error(`Manual tasks audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Manual tasks OK: ${items.length} rows`);
}

main();
