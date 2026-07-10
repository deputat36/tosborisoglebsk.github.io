const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { validateHeaders } = require('./lib/csv_schema');
const { isIsoDate } = require('./lib/date_checks');

const domainPath = path.join(process.cwd(), 'data', 'domain_access_check.csv');
const actionsPath = path.join(process.cwd(), 'data', 'actions_diagnostics.csv');
const domainHeaders = ['checked_at', 'target', 'method', 'result', 'status', 'notes', 'next_step'];
const actionsHeaders = ['check_id', 'group', 'subject', 'result', 'evidence', 'status', 'next_action', 'checked_at'];
const domainStatuses = new Set(['ok_public_web', 'environment_limited', 'needs_manual_check', 'failed']);
const actionStatuses = new Set(['passed', 'warning', 'pending', 'failed', 'blocked']);
const actionGroups = new Set(['repo', 'branch', 'workflow', 'triggers', 'statuses', 'runs', 'generated-files', 'manual-check']);

function readCsv(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }

  const rows = parseCsv(fs.readFileSync(filePath, 'utf8'));
  const [headers, ...items] = rows;
  if (!headers) throw new Error(`${label}: missing header row`);
  return { headers, items };
}

function isHttpUrl(value) {
  return /^https?:\/\//.test(value || '');
}

function validateDomainAccess(errors) {
  const label = 'domain_access_check.csv';
  const { headers, items } = readCsv(domainPath, label);
  errors.push(...validateHeaders(headers, domainHeaders, label));
  const seenChecks = new Set();

  items.forEach((item, index) => {
    const line = index + 2;
    const [checkedAt, target, method, result, status, notes, nextStep] = item;
    const checkKey = `${target}|${method}`;

    if (!isIsoDate(checkedAt)) errors.push(`${label}: line ${line}: invalid checked_at ${checkedAt}`);
    if (!isHttpUrl(target)) errors.push(`${label}: line ${line}: invalid target ${target}`);
    if (target && method && seenChecks.has(checkKey)) errors.push(`${label}: line ${line}: duplicate target and method ${checkKey}`);
    if (target && method) seenChecks.add(checkKey);
    if (!method) errors.push(`${label}: line ${line}: missing method`);
    if (!result) errors.push(`${label}: line ${line}: missing result`);
    if (!domainStatuses.has(status)) errors.push(`${label}: line ${line}: unsupported status ${status}`);
    if (!notes || notes.length < 30) errors.push(`${label}: line ${line}: notes is missing or too short`);
    if (!nextStep) errors.push(`${label}: line ${line}: missing next_step`);

    if (status === 'environment_limited' && !notes.toLowerCase().includes('environment')) {
      errors.push(`${label}: line ${line}: environment_limited status must explain environment limitation`);
    }
    if (status === 'failed' && !nextStep.match(/исправ|провер|настро|verify|check/i)) {
      errors.push(`${label}: line ${line}: failed status needs an actionable next_step`);
    }
  });
}

function validateActionsDiagnostics(errors) {
  const label = 'actions_diagnostics.csv';
  const { headers, items } = readCsv(actionsPath, label);
  errors.push(...validateHeaders(headers, actionsHeaders, label));
  const seenIds = new Set();

  items.forEach((item, index) => {
    const line = index + 2;
    const [checkId, group, subject, result, evidence, status, nextAction, checkedAt] = item;

    if (!/^actions-\d{3}$/.test(checkId || '')) errors.push(`${label}: line ${line}: invalid check_id ${checkId}`);
    if (checkId && seenIds.has(checkId)) errors.push(`${label}: line ${line}: duplicate check_id ${checkId}`);
    if (checkId) seenIds.add(checkId);
    if (!actionGroups.has(group)) errors.push(`${label}: line ${line}: unsupported group ${group}`);
    if (!subject) errors.push(`${label}: line ${line}: missing subject`);
    if (!result) errors.push(`${label}: line ${line}: missing result`);
    if (!evidence) errors.push(`${label}: line ${line}: missing evidence`);
    if (!actionStatuses.has(status)) errors.push(`${label}: line ${line}: unsupported status ${status}`);
    if (!nextAction) errors.push(`${label}: line ${line}: missing next_action`);
    if (!isIsoDate(checkedAt)) errors.push(`${label}: line ${line}: invalid checked_at ${checkedAt}`);

    if ((status === 'warning' || status === 'pending') && !nextAction.match(/провер|открыть|свер|использ|скач/i)) {
      errors.push(`${label}: line ${line}: status ${status} needs an actionable next_action`);
    }
    if ((group === 'statuses' || group === 'runs') && status === 'failed') {
      errors.push(`${label}: line ${line}: empty status/run API responses must not be recorded as failed without log evidence`);
    }
  });
}

function main() {
  const errors = [];
  validateDomainAccess(errors);
  validateActionsDiagnostics(errors);

  if (errors.length) {
    throw new Error(`Technical diagnostics audit failed:\n${errors.join('\n')}`);
  }

  console.log('Technical diagnostics OK');
}

main();
