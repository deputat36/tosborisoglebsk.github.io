const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { validateHeaders } = require('./lib/csv_schema');
const { isIsoDate } = require('./lib/date_checks');

const filePath = path.join(process.cwd(), 'data', 'source_watchlist.csv');
const expectedHeaders = [
  'source_id',
  'source_name',
  'source_type',
  'url',
  'topics',
  'authority_level',
  'check_frequency',
  'last_checked',
  'status',
  'publication_rule',
  'next_step'
];
const idPattern = /^src-\d{3}$/;
const sourceTypes = new Set([
  'official',
  'official_association',
  'direct_confirmation',
  'editorial_intake',
  'regional_media',
  'local_media',
  'discovery'
]);
const authorityLevels = new Set(['primary', 'secondary', 'discovery']);
const frequencies = new Set(['еженедельно', 'ежемесячно', 'по поступлению', 'после получения реестра']);
const statuses = new Set(['available', 'channel_required', 'manual', 'blocked', 'paused']);
const urlOptionalStatuses = new Set(['channel_required', 'manual']);

function isHttpUrl(value) {
  return /^https?:\/\//.test(value || '');
}

function main() {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }

  const rows = parseCsv(fs.readFileSync(filePath, 'utf8'));
  const [headers, ...items] = rows;
  const errors = validateHeaders(headers, expectedHeaders, 'source_watchlist.csv');
  const seenIds = new Set();
  const seenUrls = new Set();

  items.forEach((item, index) => {
    const line = index + 2;
    const [
      sourceId,
      sourceName,
      sourceType,
      url,
      topics,
      authorityLevel,
      checkFrequency,
      lastChecked,
      status,
      publicationRule,
      nextStep
    ] = item;

    if (!sourceId) errors.push(`line ${line}: missing source_id`);
    if (sourceId && !idPattern.test(sourceId)) errors.push(`line ${line}: invalid source_id ${sourceId}`);
    if (sourceId && seenIds.has(sourceId)) errors.push(`line ${line}: duplicate source_id ${sourceId}`);
    if (sourceId) seenIds.add(sourceId);

    if (!sourceName) errors.push(`line ${line}: missing source_name`);
    if (!sourceTypes.has(sourceType)) errors.push(`line ${line}: unsupported source_type ${sourceType}`);
    if (!urlOptionalStatuses.has(status) && !url) errors.push(`line ${line}: status ${status} requires url`);
    if (url && !isHttpUrl(url)) errors.push(`line ${line}: invalid url ${url}`);
    if (url && seenUrls.has(url)) errors.push(`line ${line}: duplicate url ${url}`);
    if (url) seenUrls.add(url);

    if (!topics || topics.length < 20) errors.push(`line ${line}: topics is missing or too short`);
    if (!authorityLevels.has(authorityLevel)) errors.push(`line ${line}: unsupported authority_level ${authorityLevel}`);
    if (!frequencies.has(checkFrequency)) errors.push(`line ${line}: unsupported check_frequency ${checkFrequency}`);
    if (!isIsoDate(lastChecked)) errors.push(`line ${line}: invalid last_checked ${lastChecked}`);
    if (!statuses.has(status)) errors.push(`line ${line}: unsupported status ${status}`);
    if (!publicationRule || publicationRule.length < 30) errors.push(`line ${line}: publication_rule is missing or too short`);
    if (!nextStep) errors.push(`line ${line}: missing next_step`);

    if (sourceType === 'direct_confirmation' && authorityLevel !== 'primary') {
      errors.push(`line ${line}: direct_confirmation requires primary authority_level`);
    }
    if (sourceType === 'discovery' && authorityLevel !== 'discovery') {
      errors.push(`line ${line}: discovery source_type requires discovery authority_level`);
    }
    if ((sourceType === 'local_media' || sourceType === 'regional_media') && authorityLevel !== 'secondary') {
      errors.push(`line ${line}: media source_type requires secondary authority_level`);
    }
    if (authorityLevel === 'discovery' && !publicationRule.includes('только для обнаружения')) {
      errors.push(`line ${line}: discovery authority_level must limit use to discovery`);
    }
  });

  if (errors.length) {
    throw new Error(`Source watchlist audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Source watchlist OK: ${items.length} rows`);
}

main();