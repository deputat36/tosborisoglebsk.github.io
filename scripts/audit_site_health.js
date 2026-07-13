const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const filePath = path.join(ROOT, 'data', 'site_health.json');
const readinessPath = path.join(ROOT, 'data', 'priority_tos_update_readiness.json');
const FORBIDDEN_KEYS = new Set([
  'send_channel',
  'public_source_url',
  'private_source_recorded',
  'notes',
  'phones',
  'emails',
  'phone',
  'email',
  'source_ref',
  'response_text',
  'message_text'
]);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonNegativeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isIsoDateTime(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value);
}

function requireNumber(errors, label, value) {
  if (!isNonNegativeNumber(value)) errors.push(`${label} must be a non-negative number`);
}

function inspectKeys(value, prefix = '', errors = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectKeys(item, `${prefix}[${index}]`, errors));
    return errors;
  }
  if (!isObject(value)) return errors;

  Object.entries(value).forEach(([key, child]) => {
    const location = prefix ? `${prefix}.${key}` : key;
    if (FORBIDDEN_KEYS.has(key)) errors.push(`forbidden sensitive key ${location}`);
    inspectKeys(child, location, errors);
  });
  return errors;
}

function safeReadinessItem(item) {
  return {
    stage: item.stage,
    stage_label: item.stage_label,
    stage_class: item.stage_class,
    tracking_status: item.tracking_status,
    review_status: item.review_status,
    sent_at: item.sent_at,
    response_received_at: item.response_received_at,
    contact_channel_available: Boolean(item.contact_channel_available),
    response_received: Boolean(item.response_received),
    source_recorded: Boolean(item.source_recorded),
    publication_consent_recorded: Boolean(item.publication_consent_recorded),
    verification_decision: item.verification_decision,
    blockers: Array.isArray(item.blockers) ? item.blockers : [],
    next_action: item.next_action
  };
}

function main() {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${filePath}`);
  if (!fs.existsSync(readinessPath)) throw new Error(`Missing file: ${readinessPath}`);

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const readiness = JSON.parse(fs.readFileSync(readinessPath, 'utf8'));
  const errors = [];

  if (!isIsoDateTime(data.generated_at)) errors.push('generated_at must be an ISO UTC timestamp');
  if (data.site_url !== 'https://tosborisoglebsk.ru') errors.push('site_url must be https://tosborisoglebsk.ru');
  requireNumber(errors, 'health_score', data.health_score);

  if (!isObject(data.catalog)) {
    errors.push('catalog must be an object');
  } else {
    const catalog = data.catalog;
    requireNumber(errors, 'catalog.total_tos', catalog.total_tos);
    requireNumber(errors, 'catalog.high_priority', catalog.high_priority);
    requireNumber(errors, 'catalog.medium_priority', catalog.medium_priority);
    requireNumber(errors, 'catalog.low_priority', catalog.low_priority);
    requireNumber(errors, 'catalog.verified_count', catalog.verified_count);
    requireNumber(errors, 'catalog.partial_count', catalog.partial_count);
    requireNumber(errors, 'catalog.needs_review_count', catalog.needs_review_count);
    requireNumber(errors, 'catalog.unknown_count', catalog.unknown_count);
    requireNumber(errors, 'catalog.average_score', catalog.average_score);

    if (
      isNonNegativeNumber(catalog.high_priority)
      && isNonNegativeNumber(catalog.medium_priority)
      && isNonNegativeNumber(catalog.low_priority)
      && isNonNegativeNumber(catalog.total_tos)
      && catalog.high_priority + catalog.medium_priority + catalog.low_priority !== catalog.total_tos
    ) {
      errors.push('catalog priority counts must sum to catalog.total_tos');
    }

    if (
      isNonNegativeNumber(catalog.verified_count)
      && isNonNegativeNumber(catalog.partial_count)
      && isNonNegativeNumber(catalog.needs_review_count)
      && isNonNegativeNumber(catalog.unknown_count)
      && isNonNegativeNumber(catalog.total_tos)
      && catalog.verified_count + catalog.partial_count + catalog.needs_review_count + catalog.unknown_count !== catalog.total_tos
    ) {
      errors.push('catalog verification counts must sum to catalog.total_tos');
    }
  }

  if (!isObject(data.pages)) {
    errors.push('pages must be an object');
  } else {
    const pages = data.pages;
    requireNumber(errors, 'pages.total', pages.total);
    requireNumber(errors, 'pages.public', pages.public);
    requireNumber(errors, 'pages.noindex', pages.noindex);
    requireNumber(errors, 'pages.seo_warnings_count', pages.seo_warnings_count);
    requireNumber(errors, 'pages.broken_internal_links_count', pages.broken_internal_links_count);

    if (
      isNonNegativeNumber(pages.public)
      && isNonNegativeNumber(pages.noindex)
      && isNonNegativeNumber(pages.total)
      && pages.public + pages.noindex !== pages.total
    ) {
      errors.push('pages.public + pages.noindex must equal pages.total');
    }
  }

  if (!Array.isArray(data.priority_tos)) errors.push('priority_tos must be an array');
  if (!Array.isArray(data.seo_warnings)) errors.push('seo_warnings must be an array');
  if (!Array.isArray(data.broken_internal_links)) errors.push('broken_internal_links must be an array');
  if (!Array.isArray(data.recommended_actions) || data.recommended_actions.length === 0) {
    errors.push('recommended_actions must be a non-empty array');
  }

  if (Array.isArray(data.seo_warnings) && isObject(data.pages) && data.seo_warnings.length !== data.pages.seo_warnings_count) {
    errors.push('seo_warnings length must match pages.seo_warnings_count');
  }

  if (Array.isArray(data.broken_internal_links) && isObject(data.pages) && data.broken_internal_links.length !== data.pages.broken_internal_links_count) {
    errors.push('broken_internal_links length must match pages.broken_internal_links_count');
  }

  if (Array.isArray(data.priority_tos) && isObject(data.catalog) && data.priority_tos.length !== data.catalog.high_priority) {
    errors.push('priority_tos length must match catalog.high_priority');
  }

  if (!isObject(data.priority_readiness)) {
    errors.push('priority_readiness must be an object');
  } else {
    if (data.priority_readiness.generated_at !== readiness.generated_at) errors.push('priority_readiness.generated_at must match readiness report');
    if (data.priority_readiness.privacy_note !== readiness.privacy_note) errors.push('priority_readiness.privacy_note must match readiness report');
    if (JSON.stringify(data.priority_readiness.stages) !== JSON.stringify(readiness.stages)) errors.push('priority_readiness.stages must match readiness report');
    if (JSON.stringify(data.priority_readiness.summary) !== JSON.stringify(readiness.summary)) errors.push('priority_readiness.summary must match readiness report');
    inspectKeys(data.priority_readiness, 'priority_readiness', errors);
  }

  const readinessBySlug = new Map((readiness.items || []).map((item) => [item.slug, item]));
  (data.priority_tos || []).forEach((item, index) => {
    const expected = readinessBySlug.get(item.slug);
    if (!expected) {
      errors.push(`priority_tos[${index}] has no readiness source for ${item.slug}`);
      return;
    }
    if (!isObject(item.readiness)) {
      errors.push(`priority_tos[${index}].readiness must be an object`);
      return;
    }
    if (JSON.stringify(item.readiness) !== JSON.stringify(safeReadinessItem(expected))) {
      errors.push(`priority_tos[${index}].readiness does not match readiness source for ${item.slug}`);
    }
    inspectKeys(item.readiness, `priority_tos[${index}].readiness`, errors);
  });

  const byStage = readiness.summary?.by_stage || {};
  const actions = data.recommended_actions || [];
  if ((byStage.find_channel || 0) > 0 && !actions.some((item) => item.startsWith('Найти рабочий канал связи'))) {
    errors.push('recommended_actions must include the find-channel stage');
  }
  if ((byStage.ready_to_send || 0) > 0 && !actions.some((item) => item.startsWith('После разрешения пользователя вручную отправить'))) {
    errors.push('recommended_actions must include the permission-gated send stage');
  }
  if (actions.some((item) => /^Закрыть \d+ карточки? ТОС с высоким приоритетом/.test(item))) {
    errors.push('recommended_actions must use readiness stages instead of a generic high-priority action');
  }

  if (errors.length) throw new Error(`Site health audit failed:\n${errors.join('\n')}`);

  console.log(`Site health OK: ${data.pages.total} pages, score ${data.health_score}, ${readiness.summary.total} readiness cards`);
}

main();
