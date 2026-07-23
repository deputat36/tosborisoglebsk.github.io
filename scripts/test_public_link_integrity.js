const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const BASE_URL = String(process.env.PUBLIC_LINK_BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const REPORT_PATH = path.resolve(process.env.PUBLIC_LINK_REPORT || '.artifacts/public-link-integrity/report.json');
const PAGE_INDEX_PATH = path.join(ROOT, 'data', 'page_index.json');
const CONCURRENCY = Math.max(1, Math.min(16, Number(process.env.PUBLIC_LINK_CONCURRENCY || 8)));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function routeFromPage(page) {
  const candidate = String(page?.path || page?.url || '').trim();
  if (!candidate) return '';
  try {
    const parsed = new URL(candidate, BASE_URL);
    return parsed.pathname || '/';
  } catch {
    return '';
  }
}

function extractLinks(html, sourceRoute) {
  const links = [];
  const pattern = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  let match;
  while ((match = pattern.exec(html))) {
    const raw = decodeHtml(match[1] ?? match[2] ?? match[3] ?? '').trim();
    if (!raw || raw === '#') continue;
    links.push({ source: sourceRoute, raw });
  }
  return links;
}

function classifyLink(link) {
  const lower = link.raw.toLowerCase();
  if (lower.startsWith('javascript:')) {
    return { ...link, kind: 'unsafe', reason: 'javascript URL' };
  }
  if (/^(mailto:|tel:|sms:|data:|blob:)/i.test(link.raw)) return { ...link, kind: 'ignored' };
  if (/^https?:\/\//i.test(link.raw) || link.raw.startsWith('//')) {
    try {
      const external = new URL(link.raw, BASE_URL);
      const base = new URL(BASE_URL);
      if (external.origin !== base.origin) return { ...link, kind: 'external' };
    } catch {
      return { ...link, kind: 'invalid', reason: 'invalid absolute URL' };
    }
  }

  try {
    const resolved = new URL(link.raw, `${BASE_URL}${link.source}`);
    if (resolved.origin !== new URL(BASE_URL).origin) return { ...link, kind: 'external' };
    return {
      ...link,
      kind: 'internal',
      target: `${resolved.pathname}${resolved.search}`,
      pathname: resolved.pathname,
      fragment: resolved.hash ? decodeURIComponent(resolved.hash.slice(1)) : ''
    };
  } catch {
    return { ...link, kind: 'invalid', reason: 'invalid relative URL' };
  }
}

function isHtmlResponse(response) {
  return String(response.headers.get('content-type') || '').toLowerCase().includes('text/html');
}

async function fetchRoute(route) {
  const startedAt = Date.now();
  try {
    const response = await fetch(`${BASE_URL}${route}`, {
      redirect: 'follow',
      headers: { 'user-agent': 'tos-bgo-link-integrity-audit/1.0' }
    });
    const body = await response.text();
    return {
      route,
      ok: response.ok,
      status: response.status,
      final_url: response.url,
      content_type: response.headers.get('content-type') || '',
      html: isHtmlResponse(response) ? body : '',
      bytes: Buffer.byteLength(body),
      duration_ms: Date.now() - startedAt
    };
  } catch (error) {
    return {
      route,
      ok: false,
      status: 0,
      final_url: '',
      content_type: '',
      html: '',
      bytes: 0,
      duration_ms: Date.now() - startedAt,
      error: error.message
    };
  }
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length || 1) }, run));
  return results;
}

function hasFragment(html, fragment) {
  if (!fragment) return true;
  const escaped = fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const target = new RegExp(`\\b(?:id|name)\\s*=\\s*(?:"${escaped}"|'${escaped}')`, 'i');
  return target.test(html);
}

async function main() {
  assert(fs.existsSync(PAGE_INDEX_PATH), `Missing page index: ${PAGE_INDEX_PATH}`);
  const pageIndex = JSON.parse(fs.readFileSync(PAGE_INDEX_PATH, 'utf8'));
  const indexedRoutes = [...new Set((Array.isArray(pageIndex.pages) ? pageIndex.pages : [])
    .map(routeFromPage)
    .filter(Boolean))].sort();
  assert(indexedRoutes.length > 0, 'Page index does not contain public routes');

  const cache = new Map();
  const pageResponses = await mapLimit(indexedRoutes, CONCURRENCY, async (route) => {
    const result = await fetchRoute(route);
    cache.set(route, result);
    return result;
  });

  const failures = [];
  pageResponses.forEach((result) => {
    if (!result.ok) failures.push({ type: 'page', source: result.route, target: result.route, status: result.status, error: result.error || 'HTTP error' });
    else if (!result.html) failures.push({ type: 'page', source: result.route, target: result.route, status: result.status, error: `expected HTML, received ${result.content_type || 'unknown type'}` });
  });

  const classified = pageResponses.flatMap((result) => result.html
    ? extractLinks(result.html, result.route).map(classifyLink)
    : []);

  classified.filter((link) => link.kind === 'unsafe' || link.kind === 'invalid').forEach((link) => {
    failures.push({ type: link.kind, source: link.source, target: link.raw, status: 0, error: link.reason });
  });

  const internal = classified.filter((link) => link.kind === 'internal');
  const targetRoutes = [...new Set(internal.map((link) => link.target))].sort();
  const missingTargets = targetRoutes.filter((route) => !cache.has(route));
  const targetResponses = await mapLimit(missingTargets, CONCURRENCY, async (route) => {
    const result = await fetchRoute(route);
    cache.set(route, result);
    return result;
  });

  targetResponses.forEach((result) => {
    if (!result.ok) failures.push({ type: 'target', source: '', target: result.route, status: result.status, error: result.error || 'HTTP error' });
  });

  const checkedPairs = new Set();
  internal.forEach((link) => {
    const pairKey = `${link.source}\n${link.target}\n${link.fragment}`;
    if (checkedPairs.has(pairKey)) return;
    checkedPairs.add(pairKey);
    const response = cache.get(link.target);
    if (!response || !response.ok) {
      failures.push({ type: 'link', source: link.source, target: link.raw, status: response?.status || 0, error: response?.error || 'target unavailable' });
      return;
    }
    if (link.fragment && response.html && !hasFragment(response.html, link.fragment)) {
      failures.push({ type: 'fragment', source: link.source, target: link.raw, status: response.status, error: `missing fragment #${link.fragment}` });
    }
  });

  const uniqueFailures = [...new Map(failures.map((item) => [`${item.type}|${item.source}|${item.target}|${item.error}`, item])).values()];
  const report = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    base_url: BASE_URL,
    concurrency: CONCURRENCY,
    pages_indexed: indexedRoutes.length,
    pages_checked: pageResponses.length,
    links_discovered: classified.length,
    internal_links_checked: checkedPairs.size,
    unique_internal_targets: targetRoutes.length,
    external_links_ignored: classified.filter((link) => link.kind === 'external').length,
    protocol_links_ignored: classified.filter((link) => link.kind === 'ignored').length,
    failed: uniqueFailures.length,
    failures: uniqueFailures.slice(0, 250),
    slowest_pages: pageResponses
      .slice()
      .sort((a, b) => b.duration_ms - a.duration_ms)
      .slice(0, 20)
      .map(({ route, status, duration_ms, bytes }) => ({ route, status, duration_ms, bytes }))
  };

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  if (report.failed) {
    report.failures.slice(0, 30).forEach((failure) => {
      console.error(`FAIL ${failure.type}: ${failure.source || '(route set)'} -> ${failure.target}: ${failure.error} [${failure.status}]`);
    });
    throw new Error(`Public link integrity failed: ${report.failed} problems. See ${REPORT_PATH}`);
  }

  console.log(`Public link integrity OK: ${report.pages_checked} pages, ${report.internal_links_checked} internal links, ${report.unique_internal_targets} targets`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
