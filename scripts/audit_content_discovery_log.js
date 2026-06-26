const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { validateHeaders } = require('./lib/csv_schema');
const { isIsoDate } = require('./lib/date_checks');

const filePath = path.join(process.cwd(), 'data', 'content_discovery_log.csv');
const expectedHeaders = [
  'discovery_id',
  'discovered_date',
  'source_date',
  'source_name',
  'source_url',
  'candidate_type',
  'tos_names',
  'fact_summary',
  'source_level',
  'reuse_permission',
  'status',
  'blocker',
  'next_step'
];
const idPattern = /^find-\d{3}$/;
const candidateTypes = new Set([
  'registry_source',
  'registry_candidate',
  'news_candidate',
  'archive_candidate',
  'official_result'
]);
const sourceLevels = new Set(['primary', 'secondary']);
const statuses = new Set([
  'blocked',
  'official_confirmation_required',
  'result_check',
  'result_source_found',
  'verified_source',
  'rejected'
]);

function isHttpUrl(value) {
  return /^https?:\/\//.test(value || '');
}

function main() {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }

  const rows = parseCsv(fs.readFileSync(filePath, 'utf8'));
  const [headers, ...items] = rows;
  const errors = validateHeaders(headers, expectedHeaders, 'content_discovery_log.csv');
  const seen = new Set();

  items.forEach((item, index) => {
    const line = index + 2;
    const [
      discoveryId,
      discoveredDate,
      sourceDate,
      sourceName,
      sourceUrl,
      candidateType,
      tosNames,
      factSummary,
      sourceLevel,
      reusePermission,
      status,
      blocker,
      nextStep
    ] = item;

    if (!discoveryId) errors.push(`line ${line}: missing discovery_id`);
    if (discoveryId && !idPattern.test(discoveryId)) errors.push(`line ${line}: invalid discovery_id ${discoveryId}`);
    if (discoveryId && seen.has(discoveryId)) errors.push(`line ${line}: duplicate discovery_id ${discoveryId}`);
    if (discoveryId) seen.add(discoveryId);

    if (!isIsoDate(discoveredDate)) errors.push(`line ${line}: invalid discovered_date ${discoveredDate}`);
    if (sourceDate && !isIsoDate(sourceDate)) errors.push(`line ${line}: invalid source_date ${sourceDate}`);
    if (!sourceName) errors.push(`line ${line}: missing source_name`);
    if (!isHttpUrl(sourceUrl)) errors.push(`line ${line}: invalid source_url ${sourceUrl}`);
    if (!candidateTypes.has(candidateType)) errors.push(`line ${line}: unsupported candidate_type ${candidateType}`);
    if (!factSummary || factSummary.length < 40) errors.push(`line ${line}: fact_summary is missing or too short`);
    if (!sourceLevels.has(sourceLevel)) errors.push(`line ${line}: unsupported source_level ${sourceLevel}`);
    if (!reusePermission) errors.push(`line ${line}: missing reuse_permission`);
    if (!statuses.has(status)) errors.push(`line ${line}: unsupported status ${status}`);
    if (!nextStep) errors.push(`line ${line}: missing next_step`);

    if (status === 'blocked' && !blocker) errors.push(`line ${line}: blocked status requires blocker`);
    if (status === 'official_confirmation_required' && !blocker) {
      errors.push(`line ${line}: official_confirmation_required status requires blocker`);
    }
    if (status === 'verified_source') {
      if (sourceLevel !== 'primary') errors.push(`line ${line}: verified_source requires primary source_level`);
      if (!sourceDate) errors.push(`line ${line}: verified_source requires source_date`);
    }
    if (candidateType === 'official_result' && sourceLevel !== 'primary') {
      errors.push(`line ${line}: official_result requires primary source_level`);
    }
    if ((candidateType === 'news_candidate' || candidateType === 'registry_candidate') && !tosNames) {
      errors.push(`line ${line}: ${candidateType} requires tos_names`);
    }
  });

  if (errors.length) {
    throw new Error(`Content discovery log audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Content discovery log OK: ${items.length} rows`);
}

main();