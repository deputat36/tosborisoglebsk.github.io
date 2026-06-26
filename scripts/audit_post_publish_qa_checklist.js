const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { validateHeaders } = require('./lib/csv_schema');

const filePath = path.join(process.cwd(), 'data', 'post_publish_qa_checklist.csv');
const expectedHeaders = [
  'area',
  'page_or_file',
  'check',
  'expected_result',
  'status',
  'owner',
  'next_step'
];
const statuses = new Set(['pending', 'passed', 'failed', 'blocked']);
const closedStatuses = new Set(['passed', 'failed', 'blocked']);

function main() {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }

  const rows = parseCsv(fs.readFileSync(filePath, 'utf8'));
  const [headers, ...items] = rows;
  const errors = validateHeaders(headers, expectedHeaders, 'post_publish_qa_checklist.csv');
  const seenChecks = new Set();

  items.forEach((item, index) => {
    const line = index + 2;
    const [area, pageOrFile, check, expectedResult, status, owner, nextStep] = item;
    const checkKey = `${area}|${pageOrFile}|${check}`;

    if (!area) errors.push(`line ${line}: missing area`);
    if (!pageOrFile) errors.push(`line ${line}: missing page_or_file`);
    if (!check || check.length < 15) errors.push(`line ${line}: check is missing or too short`);
    if (!expectedResult || expectedResult.length < 15) errors.push(`line ${line}: expected_result is missing or too short`);
    if (!statuses.has(status)) errors.push(`line ${line}: unsupported status ${status}`);
    if (!nextStep) errors.push(`line ${line}: missing next_step`);

    if (seenChecks.has(checkKey)) errors.push(`line ${line}: duplicate QA check ${checkKey}`);
    seenChecks.add(checkKey);

    if (closedStatuses.has(status) && !owner) {
      errors.push(`line ${line}: status ${status} requires owner`);
    }
    if (status === 'passed' && !expectedResult) {
      errors.push(`line ${line}: passed status requires expected_result`);
    }
    if ((status === 'failed' || status === 'blocked') && !nextStep.match(/исправ|провер|обнов|добав|свер/i)) {
      errors.push(`line ${line}: status ${status} needs an actionable next_step`);
    }
  });

  if (errors.length) {
    throw new Error(`Post-publish QA checklist audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Post-publish QA checklist OK: ${items.length} rows`);
}

main();