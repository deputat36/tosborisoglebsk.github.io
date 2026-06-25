const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { validateHeaders } = require('./lib/csv_schema');
const { extractRepoPathTokens, repoPathExists } = require('./lib/path_checks');
const { priorities, workModes, planStatuses } = require('./lib/status_sets');

const filePath = path.join(process.cwd(), 'data', 'autonomous_improvement_plan.csv');
const expectedHeaders = ['stage', 'priority', 'area', 'task', 'mode', 'deliverable', 'status'];

function main() {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }

  const rows = parseCsv(fs.readFileSync(filePath, 'utf8'));
  const [headers, ...items] = rows;
  const errors = validateHeaders(headers, expectedHeaders, 'autonomous_improvement_plan.csv');
  const seenStages = new Set();

  items.forEach((item, index) => {
    const line = index + 2;
    const [stage, priority, area, task, mode, deliverable, status] = item;

    if (!stage) errors.push(`line ${line}: missing stage`);
    if (seenStages.has(stage)) errors.push(`line ${line}: duplicate stage ${stage}`);
    seenStages.add(stage);

    if (!priorities.has(priority)) errors.push(`line ${line}: unsupported priority ${priority}`);
    if (!area) errors.push(`line ${line}: missing area`);
    if (!task) errors.push(`line ${line}: missing task`);
    if (!workModes.has(mode)) errors.push(`line ${line}: unsupported mode ${mode}`);
    if (!deliverable) errors.push(`line ${line}: missing deliverable`);
    if (!planStatuses.has(status)) errors.push(`line ${line}: unsupported status ${status}`);

    extractRepoPathTokens(deliverable).forEach((token) => {
      if (!repoPathExists(token)) errors.push(`line ${line}: missing deliverable target ${token}`);
    });
  });

  if (errors.length) {
    throw new Error(`Autonomous improvement plan audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Autonomous improvement plan OK: ${items.length} rows`);
}

main();
