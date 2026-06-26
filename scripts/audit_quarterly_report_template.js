const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { validateHeaders } = require('./lib/csv_schema');
const { isIsoDate } = require('./lib/date_checks');

const filePath = path.join(process.cwd(), 'data', 'quarterly_report_template.csv');
const expectedHeaders = [
  'report_period',
  'section',
  'metric',
  'value',
  'unit',
  'source_document_or_link',
  'source_date',
  'checked_by',
  'publication_permission',
  'status',
  'note'
];
const sections = new Set(['coverage', 'registry', 'content', 'media', 'engagement', 'quality', 'next_period']);
const statuses = new Set(['draft', 'ready', 'published', 'blocked']);
const permissions = new Set(['не применимо', 'подтвердить', 'да', 'нет']);
const readyStatuses = new Set(['ready', 'published']);

function isReportPeriod(value) {
  return /^\d{4}-Q[1-4]$/.test(value || '');
}

function isNumeric(value) {
  return /^\d+(?:[.,]\d+)?$/.test(value || '');
}

function isSourceReference(value) {
  return /^(https?:\/\/|\/|data\/|docs\/|[\w.-]+\.csv|[\w.-]+\.json)/.test(value || '');
}

function main() {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }

  const rows = parseCsv(fs.readFileSync(filePath, 'utf8'));
  const [headers, ...items] = rows;
  const errors = validateHeaders(headers, expectedHeaders, 'quarterly_report_template.csv');
  const seenMetrics = new Set();

  items.forEach((item, index) => {
    const line = index + 2;
    const [
      reportPeriod,
      section,
      metric,
      value,
      unit,
      sourceDocumentOrLink,
      sourceDate,
      checkedBy,
      publicationPermission,
      status,
      note
    ] = item;
    const metricKey = `${section}|${metric}`;

    if (reportPeriod && !isReportPeriod(reportPeriod)) errors.push(`line ${line}: invalid report_period ${reportPeriod}`);
    if (!sections.has(section)) errors.push(`line ${line}: unsupported section ${section}`);
    if (!metric) errors.push(`line ${line}: missing metric`);
    if (metric && seenMetrics.has(metricKey)) errors.push(`line ${line}: duplicate metric ${metricKey}`);
    if (metric) seenMetrics.add(metricKey);
    if (!unit) errors.push(`line ${line}: missing unit`);
    if (sourceDate && !isIsoDate(sourceDate)) errors.push(`line ${line}: invalid source_date ${sourceDate}`);
    if (!permissions.has(publicationPermission)) {
      errors.push(`line ${line}: unsupported publication_permission ${publicationPermission}`);
    }
    if (!statuses.has(status)) errors.push(`line ${line}: unsupported status ${status}`);
    if (!note || note.length < 20) errors.push(`line ${line}: note is missing or too short`);

    if (readyStatuses.has(status)) {
      if (!reportPeriod) errors.push(`line ${line}: status ${status} requires report_period`);
      if (!value) errors.push(`line ${line}: status ${status} requires value`);
      if (value && section !== 'next_period' && !isNumeric(value)) {
        errors.push(`line ${line}: status ${status} requires numeric value for ${section}`);
      }
      if (!sourceDocumentOrLink) errors.push(`line ${line}: status ${status} requires source_document_or_link`);
      if (sourceDocumentOrLink && !isSourceReference(sourceDocumentOrLink)) {
        errors.push(`line ${line}: invalid source_document_or_link ${sourceDocumentOrLink}`);
      }
      if (!sourceDate) errors.push(`line ${line}: status ${status} requires source_date`);
      if (!checkedBy) errors.push(`line ${line}: status ${status} requires checked_by`);
      if (publicationPermission === 'подтвердить' || publicationPermission === 'нет') {
        errors.push(`line ${line}: status ${status} requires resolved publication_permission`);
      }
    }

    if (status === 'blocked' && !note.match(/нет|нуж|ожида|блок|подтвержд/i)) {
      errors.push(`line ${line}: blocked status requires explanatory note`);
    }
  });

  if (errors.length) {
    throw new Error(`Quarterly report template audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Quarterly report template OK: ${items.length} rows`);
}

main();