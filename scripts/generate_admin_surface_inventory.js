const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = process.cwd();
const ADMIN_ROOT = path.join(ROOT, 'admin');
const REPORT_PATH = path.join(ROOT, 'data', 'admin_surface_inventory.json');
const FORBIDDEN_BACKEND_TERM = ['supa', 'base'].join('');

const SECRET_PATTERNS = [
  ['github_token', /(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}/g],
  ['openai_key', /sk-[A-Za-z0-9_-]{20,}/g],
  ['google_api_key', /AIza[0-9A-Za-z_-]{30,}/g],
  ['slack_token', /xox[baprs]-[0-9A-Za-z-]{20,}/g],
  ['telegram_bot_token', /\b\d{8,10}:AA[A-Za-z0-9_-]{20,}\b/g],
  ['jwt', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g]
];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : [full];
    })
    .sort();
}

function rel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function matches(content, regex) {
  regex.lastIndex = 0;
  const found = [];
  let match;
  while ((match = regex.exec(content))) {
    found.push(match[0]);
    if (match.index === regex.lastIndex) regex.lastIndex += 1;
  }
  regex.lastIndex = 0;
  return found;
}

function normalizeAdminReference(value) {
  const clean = value.split(/[?#]/)[0];
  if (clean === '/admin' || clean === '/admin/') return 'admin/index.html';
  if (!clean.startsWith('/admin/')) return '';
  return clean.replace(/^\//, '');
}

function extractAdminReferences(html) {
  const refs = [];
  const regex = /\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;
  let match;
  while ((match = regex.exec(html))) {
    const normalized = normalizeAdminReference(match[1]);
    if (normalized) refs.push(normalized);
  }
  return [...new Set(refs)].sort();
}

function extractFetchTargets(content) {
  const targets = [];
  const regex = /\bfetch\s*\(\s*(["'`])([^"'`]+)\1/g;
  let match;
  while ((match = regex.exec(content))) targets.push(match[2]);
  return targets;
}

function javascriptSyntax(pathname) {
  const result = spawnSync(process.execPath, ['--check', pathname], { encoding: 'utf8' });
  return {
    ok: result.status === 0,
    message: result.status === 0 ? '' : String(result.stderr || result.stdout || 'syntax error').trim().split('\n').slice(-1)[0]
  };
}

function buildInventory() {
  if (!fs.existsSync(ADMIN_ROOT)) throw new Error('Missing admin directory');

  const files = walk(ADMIN_ROOT);
  const contents = new Map(files.map((file) => [rel(file), fs.readFileSync(file)]));
  const htmlPaths = [...contents.keys()].filter((file) => file.endsWith('.html'));
  const references = new Map();

  for (const htmlPath of htmlPaths) {
    const html = contents.get(htmlPath).toString('utf8');
    for (const target of extractAdminReferences(html)) {
      if (!references.has(target)) references.set(target, []);
      references.get(target).push(htmlPath);
    }
  }

  const localReadTargets = new Set();
  const externalNetworkTargets = [];
  const externalWriteSignals = [];
  const dangerousExecutionSignals = [];
  const potentialSecretSignals = [];
  const forbiddenBackendReferences = [];
  let browserStorageSignals = 0;

  for (const [filePath, buffer] of contents) {
    const content = buffer.toString('utf8');
    browserStorageSignals += matches(content, /\b(?:localStorage|sessionStorage)\b/g).length;

    for (const target of extractFetchTargets(content)) {
      if (/^(?:https?:)?\/\//i.test(target)) externalNetworkTargets.push({ file: filePath, target });
      else localReadTargets.add(target);
    }
    for (const target of matches(content, /\/data\/[A-Za-z0-9_.-]+\.json/g)) localReadTargets.add(target);

    const writePatterns = [
      ['network_method', /\bmethod\s*:\s*["'](?:POST|PUT|PATCH|DELETE)["']/gi],
      ['send_beacon', /\bnavigator\.sendBeacon\s*\(/g],
      ['websocket', /\bnew\s+WebSocket\s*\(/g],
      ['event_source', /\bnew\s+EventSource\s*\(/g],
      ['xml_http_request', /\bnew\s+XMLHttpRequest\s*\(/g],
      ['axios_write', /\baxios\.(?:post|put|patch|delete)\s*\(/gi]
    ];
    for (const [kind, regex] of writePatterns) {
      if (matches(content, regex).length) externalWriteSignals.push({ file: filePath, kind });
    }

    const dangerousPatterns = [
      ['eval', /\beval\s*\(/g],
      ['new_function', /\bnew\s+Function\s*\(/g],
      ['document_write', /\bdocument\.write\s*\(/g],
      ['javascript_url', /javascript\s*:/gi],
      ['external_script', /<script[^>]+src=["'](?:https?:)?\/\//gi]
    ];
    for (const [kind, regex] of dangerousPatterns) {
      if (matches(content, regex).length) dangerousExecutionSignals.push({ file: filePath, kind });
    }

    for (const [kind, regex] of SECRET_PATTERNS) {
      if (matches(content, regex).length) potentialSecretSignals.push({ file: filePath, kind });
    }

    const backendPattern = new RegExp(`\\b${FORBIDDEN_BACKEND_TERM}\\b|${FORBIDDEN_BACKEND_TERM}\\.co|createClient\\s*\\(`, 'i');
    if (backendPattern.test(content)) forbiddenBackendReferences.push({ file: filePath });
  }

  const fileRows = [...contents.entries()].map(([filePath, buffer]) => {
    const content = buffer.toString('utf8');
    const extension = path.extname(filePath).slice(1).toLowerCase();
    const referencedBy = [...new Set(references.get(filePath) || [])].sort();
    let role = referencedBy.length ? 'active_asset' : 'unlinked_file';
    if (filePath === 'admin/index.html') role = 'active_entry';
    if (filePath === 'admin/admin-index-ready.html') role = 'legacy_redirect';

    const row = {
      path: filePath,
      extension,
      bytes: buffer.length,
      lines: content.split(/\r?\n/).length,
      sha256: sha256(buffer),
      role,
      referenced_by: referencedBy
    };

    if (extension === 'html') {
      row.noindex_nofollow = /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex[^"']*nofollow[^"']*["']/i.test(content);
      row.content_security_policy = /Content-Security-Policy/i.test(content);
      row.admin_references = extractAdminReferences(content);
    }

    if (extension === 'js') row.javascript_syntax = javascriptSyntax(path.join(ROOT, filePath));
    return row;
  });

  const mainHtml = contents.get('admin/index.html')?.toString('utf8') || '';
  const legacyHtml = contents.get('admin/admin-index-ready.html')?.toString('utf8') || '';
  const robots = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');
  const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');

  const missingReferences = [];
  for (const [target, sources] of references) {
    if (!contents.has(target)) missingReferences.push({ target, referenced_by: [...new Set(sources)].sort() });
  }

  const jsSyntaxFailures = fileRows
    .filter((row) => row.extension === 'js' && row.javascript_syntax && !row.javascript_syntax.ok)
    .map((row) => ({ file: row.path, message: row.javascript_syntax.message }));

  const report = {
    schema_version: 1,
    directory: 'admin',
    security_model: 'public_client_side_local_editor',
    server_authentication: false,
    network_write_enabled: false,
    private_data_allowed: false,
    files: fileRows,
    local_read_targets: [...localReadTargets].sort(),
    external_network_targets: externalNetworkTargets,
    external_write_signals: externalWriteSignals,
    dangerous_execution_signals: dangerousExecutionSignals,
    potential_secret_signals: potentialSecretSignals,
    forbidden_backend_references: forbiddenBackendReferences,
    browser_storage_signals: browserStorageSignals,
    missing_local_references: missingReferences,
    javascript_syntax_failures: jsSyntaxFailures,
    controls: {
      all_html_noindex_nofollow: fileRows.filter((row) => row.extension === 'html').every((row) => row.noindex_nofollow),
      main_csp_self_only_connect: /connect-src\s+'self'/i.test(mainHtml),
      main_declares_no_server_auth: /без серверной авторизации/i.test(mainHtml),
      main_declares_not_protected_admin: /Это не защищённая админка/i.test(mainHtml),
      main_forbids_sensitive_data: /Не вводите сюда паспорта[\s\S]*непубличные контакты/i.test(mainHtml),
      main_declares_no_network_write: /не делает сетевые запросы на запись/i.test(mainHtml),
      legacy_redirects_to_main: /http-equiv=["']refresh["'][^>]+url=\/admin\//i.test(legacyHtml),
      robots_disallow_admin: /^Disallow:\s*\/admin\/$/mi.test(robots),
      sitemap_excludes_admin: !/https:\/\/tosborisoglebsk\.ru\/admin\//i.test(sitemap)
    },
    summary: {
      files_total: fileRows.length,
      html_files: fileRows.filter((row) => row.extension === 'html').length,
      javascript_files: fileRows.filter((row) => row.extension === 'js').length,
      css_files: fileRows.filter((row) => row.extension === 'css').length,
      unlinked_files: fileRows.filter((row) => row.role === 'unlinked_file').length,
      external_network_targets: externalNetworkTargets.length,
      external_write_signals: externalWriteSignals.length,
      dangerous_execution_signals: dangerousExecutionSignals.length,
      potential_secret_signals: potentialSecretSignals.length,
      forbidden_backend_references: forbiddenBackendReferences.length,
      missing_local_references: missingReferences.length,
      javascript_syntax_failures: jsSyntaxFailures.length
    }
  };

  return report;
}

function main() {
  const report = buildInventory();
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Admin surface inventory generated: ${report.summary.files_total} files`);
}

module.exports = { buildInventory, REPORT_PATH };

if (require.main === module) main();
