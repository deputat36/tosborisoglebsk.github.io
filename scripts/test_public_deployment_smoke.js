#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { runSmoke } = require('./lib/public_deployment_smoke');

function response(body, options = {}) {
  return new Response(body, {
    status: options.status || 200,
    headers: {
      'content-type': options.contentType || 'text/html; charset=utf-8',
      ...(options.headers || {})
    }
  });
}

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tos-deployment-smoke-'));
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  fs.mkdirSync(path.join(root, 'actions-check'), { recursive: true });
  fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html>\n<title>Portal</title>\n');
  fs.writeFileSync(path.join(root, 'data', 'site_health.json'), '{"healthy":true}\n');
  fs.writeFileSync(path.join(root, 'actions-check', 'index.html'), '<!doctype html>\n<title>Actions</title>\n');
  fs.writeFileSync(path.join(root, 'sitemap.xml'), '<urlset></urlset>\n');

  const targets = [
    {
      id: 'root',
      url: 'https://example.test/',
      localPath: 'index.html',
      required: true,
      expectedContentType: 'text/html',
      allowedFinalHosts: ['example.test']
    },
    {
      id: 'health',
      url: 'https://example.test/data/site_health.json',
      localPath: 'data/site_health.json',
      required: true,
      expectedContentType: 'application/json',
      allowedFinalHosts: ['example.test']
    },
    {
      id: 'optional-alias',
      url: 'https://alias.test/',
      localPath: null,
      required: false,
      expectedContentType: 'text/html',
      allowedFinalHosts: ['alias.test']
    }
  ];

  let healthCalls = 0;
  const retryingFetch = async (url) => {
    if (url.includes('site_health')) {
      healthCalls += 1;
      const body = healthCalls === 1 ? '{"healthy":false}\n' : '{"healthy":true}\n';
      return response(body, { contentType: 'application/json', url });
    }
    if (url.includes('alias.test')) throw new Error('Optional alias unavailable');
    return response('<!doctype html>\n<title>Portal</title>\n');
  };

  const originalResponseUrl = Object.getOwnPropertyDescriptor(Response.prototype, 'url');
  Object.defineProperty(Response.prototype, 'url', {
    configurable: true,
    get() {
      return this.__testUrl || 'https://example.test/';
    }
  });

  try {
    const firstReport = path.join(root, 'first-report.json');
    const recovered = await runSmoke({
      root,
      targets,
      fetchImpl: async (url) => {
        const result = await retryingFetch(url);
        result.__testUrl = url;
        return result;
      },
      attempts: 2,
      delayMs: 0,
      timeoutMs: 2000,
      reportPath: firstReport,
      env: { GITHUB_REPOSITORY: 'example/repo', GITHUB_SHA: 'abc123' }
    });

    assert.strictEqual(recovered.success, true, 'A stale first response must recover on retry');
    assert.strictEqual(recovered.attempts.length, 2, 'The report must retain both attempts');
    assert.strictEqual(recovered.blocking_failures.length, 0, 'Recovered required targets must not remain blocking');
    assert.strictEqual(recovered.warnings.length, 1, 'Optional alias failure must remain a warning');
    assert.ok(fs.existsSync(firstReport), 'The JSON report must be written');

    const failedReport = await runSmoke({
      root,
      targets: [targets[1]],
      fetchImpl: async (url) => {
        const result = response('{"healthy":false}\n', { contentType: 'application/json' });
        result.__testUrl = url;
        return result;
      },
      attempts: 1,
      delayMs: 0,
      timeoutMs: 2000,
      reportPath: path.join(root, 'failed-report.json'),
      env: { GITHUB_REPOSITORY: 'example/repo', GITHUB_SHA: 'def456' }
    });

    assert.strictEqual(failedReport.success, false, 'A repository hash mismatch must fail');
    assert.deepStrictEqual(failedReport.blocking_failures.map((item) => item.id), ['health']);
    assert.ok(
      failedReport.blocking_failures[0].errors.includes('Published content hash does not match repository file'),
      'The failure reason must explain the stale publication'
    );
  } finally {
    if (originalResponseUrl) Object.defineProperty(Response.prototype, 'url', originalResponseUrl);
    fs.rmSync(root, { recursive: true, force: true });
  }

  console.log('Public deployment smoke self-test OK');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
