const { inferContentOrigin } = require('./content_origin');

const ORIGIN_AWARE_COLLECTIONS = new Set(['news', 'projects', 'needs', 'done', 'articles']);

function isPublished(item) {
  return Boolean(item && item.status !== 'draft');
}

function originFor(item, collection = '') {
  if (!ORIGIN_AWARE_COLLECTIONS.has(collection)) return 'verified';
  return inferContentOrigin(item, collection);
}

function coverageFor(items, slug, collection = '') {
  const records = (Array.isArray(items) ? items : [])
    .filter((item) => isPublished(item) && item.tos_slug === slug);
  const origins = { verified: 0, editorial: 0, starter: 0, request: 0 };

  records.forEach((item) => {
    const origin = originFor(item, collection);
    if (Object.prototype.hasOwnProperty.call(origins, origin)) origins[origin] += 1;
  });

  const requests = origins.request;
  return {
    all: records.length,
    substantive: records.length - requests,
    requests,
    origins
  };
}

function coverageMap(items, collection = '') {
  const result = new Map();
  (Array.isArray(items) ? items : []).filter(isPublished).forEach((item) => {
    if (!item.tos_slug) return;
    const current = result.get(item.tos_slug) || {
      all: 0,
      substantive: 0,
      requests: 0,
      origins: { verified: 0, editorial: 0, starter: 0, request: 0 }
    };
    const origin = originFor(item, collection);
    current.all += 1;
    if (origin === 'request') current.requests += 1;
    else current.substantive += 1;
    if (Object.prototype.hasOwnProperty.call(current.origins, origin)) current.origins[origin] += 1;
    result.set(item.tos_slug, current);
  });
  return result;
}

function emptyCoverage() {
  return {
    all: 0,
    substantive: 0,
    requests: 0,
    origins: { verified: 0, editorial: 0, starter: 0, request: 0 }
  };
}

function coverageFromMap(map, slug) {
  return map.get(slug) || emptyCoverage();
}

module.exports = {
  ORIGIN_AWARE_COLLECTIONS,
  isPublished,
  originFor,
  coverageFor,
  coverageMap,
  coverageFromMap,
  emptyCoverage
};
