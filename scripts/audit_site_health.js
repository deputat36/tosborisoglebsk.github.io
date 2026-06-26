const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'data', 'site_health.json');

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

function main() {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
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

  if (errors.length) {
    throw new Error(`Site health audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Site health OK: ${data.pages.total} pages, score ${data.health_score}`);
}

main();
