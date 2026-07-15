const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { setTimeout: sleep } = require('timers/promises');

function normalizeText(value) {
  return String(value).replace(/\r\n/g, '\n');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function readLocalFile(root, relativePath) {
  const absolutePath = path.join(root, relativePath);
  const body = fs.readFileSync(absolutePath);
  return {
    absolutePath,
    bytes: body.length,
    sha256: sha256(Buffer.from(normalizeText(body.toString('utf8')), 'utf8'))
  };
}

function createDefaultTargets({ root, env = process.env } = {}) {
  if (!root) throw new Error('root is required');

  const cnamePath = path.join(root, 'CNAME');
  const cname = fs.readFileSync(cnamePath, 'utf8').trim();
  if (!cname || /\s/.test(cname)) throw new Error('CNAME must contain exactly one hostname');

  const repository = env.GITHUB_REPOSITORY || 'deputat36/tosborisoglebsk.github.io';
  const [owner, repositoryName] = repository.split('/');
  if (!owner || !repositoryName) throw new Error(`Invalid GITHUB_REPOSITORY: ${repository}`);

  const customBase = `https://${cname}`;
  const pagesBase = `https://${owner}.github.io/${repositoryName}`;

  return [
    {
      id: 'custom-root',
      url: `${customBase}/`,
      localPath: 'index.html',
      required: true,
      expectedContentType: 'text/html',
      allowedFinalHosts: [cname]
    },
    {
      id: 'custom-site-health',
      url: `${customBase}/data/site_health.json`,
      localPath: 'data/site_health.json',
      required: true,
      expectedContentType: 'application/json',
      allowedFinalHosts: [cname]
    },
    {
      id: 'custom-actions-check',
      url: `${customBase}/actions-check/`,
      localPath: 'actions-check/index.html',
      required: true,
      expectedContentType: 'text/html',
      allowedFinalHosts: [cname]
    },
    {
      id: 'custom-sitemap',
      url: `${customBase}/sitemap.xml`,
      localPath: 'sitemap.xml',
      required: true,
      expectedContentType: 'xml',
      allowedFinalHosts: [cname]
    },
    {
      id: 'github-pages-alias',
      url: `${pagesBase}/`,
      localPath: null,
      required: false,
      expectedContentType: 'text/html',
      allowedFinalHosts: [cname, `${owner}.github.io`]
    }
  ];
}

async function fetchWithTimeout(fetchImpl, url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'tos-bgo-public-deployment-smoke/1.0',
        'cache-control': 'no-cache'
      }
    });
  } finally {
    clearTimeout(timer);
  }
}

async function inspectTarget(target, options) {
  const { root, fetchImpl, timeoutMs } = options;
  const startedAt = new Date().toISOString();
  const result = {
    id: target.id,
    url: target.url,
    required: Boolean(target.required),
    started_at: startedAt,
    ok: false,
    status: null,
    final_url: null,
    content_type: null,
    remote_bytes: null,
    remote_sha256: null,
    local_path: target.localPath || null,
    local_bytes: null,
    local_sha256: null,
    content_matches_repository: target.localPath ? false : null,
    errors: []
  };

  try {
    const response = await fetchWithTimeout(fetchImpl, target.url, timeoutMs);
    const body = Buffer.from(await response.arrayBuffer());
    const normalizedRemote = Buffer.from(normalizeText(body.toString('utf8')), 'utf8');
    const finalUrl = new URL(response.url || target.url);
    const contentType = response.headers.get('content-type') || '';

    result.status = response.status;
    result.final_url = finalUrl.toString();
    result.content_type = contentType;
    result.remote_bytes = body.length;
    result.remote_sha256 = sha256(normalizedRemote);
    result.cache_control = response.headers.get('cache-control') || '';
    result.etag = response.headers.get('etag') || '';
    result.last_modified = response.headers.get('last-modified') || '';

    if (!response.ok) result.errors.push(`HTTP ${response.status}`);
    if (target.expectedContentType && !contentType.toLowerCase().includes(target.expectedContentType.toLowerCase())) {
      result.errors.push(`Unexpected content-type: ${contentType || '(empty)'}`);
    }
    if (target.allowedFinalHosts && !target.allowedFinalHosts.includes(finalUrl.hostname)) {
      result.errors.push(`Unexpected final host: ${finalUrl.hostname}`);
    }

    if (target.localPath) {
      const local = readLocalFile(root, target.localPath);
      result.local_bytes = local.bytes;
      result.local_sha256 = local.sha256;
      result.content_matches_repository = result.remote_sha256 === result.local_sha256;
      if (!result.content_matches_repository) {
        result.errors.push('Published content hash does not match repository file');
      }
    }
  } catch (error) {
    result.errors.push(error && error.name === 'AbortError'
      ? `Request timeout after ${timeoutMs} ms`
      : String(error && error.message ? error.message : error));
  }

  result.ok = result.errors.length === 0;
  result.finished_at = new Date().toISOString();
  return result;
}

async function runSmoke(options = {}) {
  const root = options.root || path.resolve(__dirname, '..', '..');
  const fetchImpl = options.fetchImpl || global.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required');

  const attempts = Math.max(1, Number(options.attempts || process.env.PUBLIC_DEPLOYMENT_ATTEMPTS || 5));
  const delayMs = Math.max(0, Number(options.delayMs ?? process.env.PUBLIC_DEPLOYMENT_RETRY_DELAY_MS ?? 20000));
  const timeoutMs = Math.max(1000, Number(options.timeoutMs || process.env.PUBLIC_DEPLOYMENT_TIMEOUT_MS || 15000));
  const reportPath = options.reportPath || process.env.PUBLIC_DEPLOYMENT_REPORT || path.join(root, '.artifacts', 'public-deployment-smoke', 'report.json');
  const targets = options.targets || createDefaultTargets({ root, env: options.env || process.env });

  const report = {
    schema_version: 1,
    checked_at: new Date().toISOString(),
    repository: (options.env || process.env).GITHUB_REPOSITORY || 'deputat36/tosborisoglebsk.github.io',
    repository_sha: (options.env || process.env).GITHUB_SHA || '',
    attempts_configured: attempts,
    retry_delay_ms: delayMs,
    timeout_ms: timeoutMs,
    targets_total: targets.length,
    required_targets: targets.filter((target) => target.required).length,
    success: false,
    attempts: []
  };

  for (let attemptNumber = 1; attemptNumber <= attempts; attemptNumber += 1) {
    const results = [];
    for (const target of targets) {
      results.push(await inspectTarget(target, { root, fetchImpl, timeoutMs }));
    }

    const blockingFailures = results.filter((item) => item.required && !item.ok);
    report.attempts.push({
      attempt: attemptNumber,
      checked_at: new Date().toISOString(),
      blocking_failures: blockingFailures.map((item) => item.id),
      results
    });

    if (blockingFailures.length === 0) {
      report.success = true;
      break;
    }

    if (attemptNumber < attempts && delayMs > 0) await sleep(delayMs);
  }

  report.finished_at = new Date().toISOString();
  report.final_results = report.attempts.length
    ? report.attempts[report.attempts.length - 1].results
    : [];
  report.blocking_failures = report.final_results
    .filter((item) => item.required && !item.ok)
    .map((item) => ({ id: item.id, errors: item.errors }));
  report.warnings = report.final_results
    .filter((item) => !item.required && !item.ok)
    .map((item) => ({ id: item.id, errors: item.errors }));

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

module.exports = {
  createDefaultTargets,
  inspectTarget,
  normalizeText,
  readLocalFile,
  runSmoke,
  sha256
};
