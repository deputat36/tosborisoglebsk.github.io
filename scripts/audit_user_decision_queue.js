const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { validateHeaders } = require('./lib/csv_schema');
const { decisionStatuses, priorities } = require('./lib/status_sets');

const filePath = path.join(process.cwd(), 'data', 'user_decision_queue.csv');
const manualTasksPath = path.join(process.cwd(), 'data', 'github_manual_tasks.csv');
const requiredHeaders = ['decision_id', 'priority', 'area', 'topic', 'default_mode', 'status', 'linked_task'];

function readManualTaskIds() {
  if (!fs.existsSync(manualTasksPath)) return new Set();

  const rows = parseCsv(fs.readFileSync(manualTasksPath, 'utf8'));
  const [headers, ...items] = rows;
  const issueIndex = headers ? headers.indexOf('issue_number') : -1;

  if (issueIndex === -1) return new Set();

  return new Set(items.map((item) => item[issueIndex]).filter(Boolean));
}

function main() {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }

  const manualTaskIds = readManualTaskIds();
  const rows = parseCsv(fs.readFileSync(filePath, 'utf8'));
  const [headers, ...items] = rows;
  const errors = validateHeaders(headers, requiredHeaders, 'user_decision_queue.csv');
  const seen = new Set();

  items.forEach((item, index) => {
    const line = index + 2;
    const [decisionId, priority, area, topic, defaultMode, status, linkedTask] = item;

    if (!decisionId) errors.push(`line ${line}: missing decision_id`);
    if (seen.has(decisionId)) errors.push(`line ${line}: duplicate decision_id ${decisionId}`);
    seen.add(decisionId);

    if (!priorities.has(priority)) errors.push(`line ${line}: unsupported priority ${priority}`);
    if (!area) errors.push(`line ${line}: missing area`);
    if (!topic) errors.push(`line ${line}: missing topic`);
    if (!defaultMode) errors.push(`line ${line}: missing default_mode`);
    if (!decisionStatuses.has(status)) errors.push(`line ${line}: unsupported status ${status}`);

    if (linkedTask && !manualTaskIds.has(linkedTask)) {
      errors.push(`line ${line}: linked_task ${linkedTask} is absent in github_manual_tasks.csv`);
    }
  });

  if (errors.length) {
    throw new Error(`Decision queue audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Decision queue OK: ${items.length} rows`);
}

main();
