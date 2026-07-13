const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = process.cwd();
const ADMIN_ROOT = path.join(ROOT, 'admin');
const REPORT_PATH = path.join(ROOT, 'data', 'admin_surface_report.json');
const ALLOWED_EXTENSIONS = new Set(['.html', '.js', '.css', '.json']);
const SAFE_EXTERNAL_HOSTS = new Set([
  'tosborisoglebsk.ru',
  'www.tosborisoglebsk.ru'
]);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right, 'ru'));
}

function listFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const result = [];
  fs.readdirSync(dirPath, { withFileTypes: true }).forEach((entry) => {
    const absolute = path.join(dirPath, entry.name);
    if (entry.isDirectory()) result.push(...listFiles(absolute));
    else if (entry.isFile() && ALLOWED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) result.push(absolute);
  });
  return result.sort((left, right) => left.localeCompare(right, 'ru'));
}

function extractAll(source, regex, group = 1) {
  const values = [];
  let match;
  while ((match = regex.exec(source)) !== null) values.push(String(match[group] || '').trim());
  return values;
}

function parseUrl(value) {
  try {
    return new URL(value, 'https://tosborisoglebsk.ru/admin/');
  } catch {
    return null;
  }
}

function externalHost(value) {
  const parsed = parseUrl(value);
  if (!parsed || !/^https?:$/.test(parsed.protocol)) return '';
  return SAFE_EXTERNAL_HOSTS.has(parsed.hostname) ? '' : parsed.hostname;
}

function htmlDetails(source) {
  const robots = source.match(/<meta\s+[^>]*name=["']robots["'][^>]*content=["']([^"']*)["'][^>]*>/i)
    || source.match(/<meta\s+[^>]*content=["']([^"']*)["'][^>]*name=["']robots["'][^>]*>/i);
  const robotsTokens = String(robots?.[1] || '').toLowerCase().split(',').map((value) => value.trim()).filter(Boolean);
  const scripts = extractAll(source, /<script\s+[^>]*src=["']([^"']+)["'][^>]*>/gi);
  const styles = extractAll(source, /<link\s+[^>]*rel=["'][^"']*stylesheet[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/gi);
  const forms = [];
  let formMatch;
  const formRegex = /<form\b([^>]*)>/gi;
  while ((formMatch = formRegex.exec(source)) !== null) {
    const attrs = formMatch[1] || '';
    forms.push({
      action: attrs.match(/\baction=["']([^"']*)["']/i)?.[1] || '',
      method: String(attrs.match(/\bmethod=["']([^"']*)["']/i)?.[1] || 'get').toLowerCase()
    });
  }
  return {
    robots: robots?.[1] || '',
    noindex: robotsTokens.includes('noindex'),
    nofollow: robotsTokens.includes('nofollow'),
    script_sources: unique(scripts),
    stylesheet_links: unique(styles),
    forms,
    external_form_hosts: unique(forms.map((item) => externalHost(item.action))),
    form_write_methods: unique(forms.map((item) => item.method).filter((method) => !['', 'get', 'dialog'].includes(method)))
  };
}

function potentialSecrets(source) {
  const findings = [];
  const assignments = /\b(api[_-]?key|access[_-]?token|auth[_-]?token|secret|password|passwd|private[_-]?key)\b\s*[:=]\s*["']([^"'\n]{8,})["']/gi;
  let match;
  while ((match = assignments.exec(source)) !== null) {
    const value = match[2];
    if (!/^(replace|example|demo|test|your[-_ ]|change[-_ ]|not[-_ ]set|placeholder)/i.test(value)) {
      findings.push(`${match[1]} assignment`);
    }
  }
  if (/\bsk-[A-Za-z0-9_-]{20,}\b/.test(source)) findings.push('OpenAI-style secret token');
  if (/\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/.test(source)) findings.push('GitHub-style token');
  if (/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/.test(source)) findings.push('JWT-like token');
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(source)) findings.push('private key block');
  return unique(findings);
}

function jsDetails(source) {
  const storageKeys = unique([
    ...extractAll(source, /localStorage\.(?:getItem|setItem|removeItem)\(\s*["'`]([^"'`]+)["'`]/g),
    ...extractAll(source, /sessionStorage\.(?:getItem|setItem|removeItem)\(\s*["'`]([^"'`]+)["'`]/g)
  ]);

  const networkTargets = unique([
    ...extractAll(source, /\bfetch\(\s*["'`]([^"'`]+)["'`]/g),
    ...extractAll(source, /\baxios(?:\.(?:get|post|put|patch|delete)|\()\s*\(?\s*["'`]([^"'`]+)["'`]/g),
    ...extractAll(source, /\.open\(\s*["'`](?:GET|POST|PUT|PATCH|DELETE)["'`]\s*,\s*["'`]([^"'`]+)["'`]/gi),
    ...extractAll(source, /\bnavigator\.sendBeacon\(\s*["'`]([^"'`]+)["'`]/g),
    ...extractAll(source, /\bnew\s+WebSocket\(\s*["'`]([^"'`]+)["'`]/g)
  ]);

  const writeSignals = [];
  if (/\bfetch\([^)]*,\s*\{[\s\S]{0,500}?\bmethod\s*:\s*["'`](?:POST|PUT|PATCH|DELETE)["'`]/i.test(source)) writeSignals.push('fetch write method');
  if (/\baxios\.(?:post|put|patch|delete)\s*\(/i.test(source)) writeSignals.push('axios write method');
  if (/\.open\(\s*["'`](?:POST|PUT|PATCH|DELETE)["'`]/i.test(source)) writeSignals.push('XMLHttpRequest write method');
  if (/\bnavigator\.sendBeacon\s*\(/.test(source)) writeSignals.push('sendBeacon');
  if (/\bnew\s+WebSocket\s*\(/.test(source) || /\.send\s*\(/.test(source)) writeSignals.push('socket send');

  const dangerousPatterns = [];
  if (/\beval\s*\(/.test(source)) dangerousPatterns.push('eval');
  if (/\bnew\s+Function\s*\(/.test(source)) dangerousPatterns.push('new Function');
  if (/\bdocument\.write(?:ln)?\s*\(/.test(source)) dangerousPatterns.push('document.write');
  if (/\bset(?:Timeout|Interval)\s*\(\s*["'`]/.test(source)) dangerousPatterns.push('string timer execution');

  const supabaseReferences = unique([
    ...extractAll(source, /\b(supabase(?:Url|Key|Client)?)\b/gi, 1),
    ...extractAll(source, /\b(createClient)\b/g, 1)
  ]);

  return {
    storage_keys: storageKeys,
    network_targets: networkTargets,
    external_hosts: unique(networkTargets.map(externalHost)),
    write_signals: unique(writeSignals),
    dangerous_patterns: unique(dangerousPatterns),
    potential_secrets: potentialSecrets(source),
    inner_html_assignments: (source.match(/\.innerHTML\s*=/g) || []).length,
    auth_mentions: unique(extractAll(source, /\b(auth(?:entication|orization)?|login|logout|pin|password|session)\b/gi, 1).map((value) => value.toLowerCase())),
    supabase_references: supabaseReferences
  };
}

function classifyFile(filePath) {
  const relativePath = path.relative(ROOT, filePath).replace(/\\/g, '/');
  const extension = path.extname(filePath).toLowerCase();
  const source = fs.readFileSync(filePath, 'utf8');
  const item = {
    path: relativePath,
    type: extension.slice(1),
    bytes: Buffer.byteLength(source),
    sha256: sha256(source)
  };
  if (extension === '.html') Object.assign(item, htmlDetails(source));
  if (extension === '.js') Object.assign(item, jsDetails(source));
  return item;
}

function buildReport(generatedAt = new Date().toISOString()) {
  const files = listFiles(ADMIN_ROOT).map(classifyFile);
  const htmlFiles = files.filter((item) => item.type === 'html');
  const jsFiles = files.filter((item) => item.type === 'js');
  const externalHosts = unique(files.flatMap((item) => item.external_hosts || item.external_form_hosts || []));
  const networkTargets = unique(jsFiles.flatMap((item) => item.network_targets || []));
  const writeSignals = unique([
    ...jsFiles.flatMap((item) => item.write_signals || []).map((value) => `js: ${value}`),
    ...htmlFiles.flatMap((item) => item.form_write_methods || []).map((value) => `form: ${value}`)
  ]);
  const dangerousPatterns = unique(jsFiles.flatMap((item) => item.dangerous_patterns || []));
  const potentialSecretFindings = unique(jsFiles.flatMap((item) => item.potential_secrets || []));
  const supabaseReferences = unique(jsFiles.flatMap((item) => item.supabase_references || []));
  const classification = externalHosts.length || networkTargets.length || supabaseReferences.length
    ? 'client_side_connected_tool'
    : 'client_side_local_tool';

  return {
    schema_version: 1,
    generated_at: generatedAt,
    admin_root: 'admin/',
    security_model: {
      classification,
      server_side_authentication: false,
      production_access_control: false,
      robots_exclusion_is_access_control: false,
      storage_model: 'browser_local_storage_or_static_files',
      allowed_data: 'public_or_non_sensitive_only',
      warning: 'The admin surface is a browser-side helper. It must not store secrets or be described as server-protected administration.'
    },
    summary: {
      files_total: files.length,
      html_files: htmlFiles.length,
      js_files: jsFiles.length,
      css_files: files.filter((item) => item.type === 'css').length,
      json_files: files.filter((item) => item.type === 'json').length,
      html_without_noindex: htmlFiles.filter((item) => !item.noindex).length,
      html_without_nofollow: htmlFiles.filter((item) => !item.nofollow).length,
      local_storage_keys: unique(jsFiles.flatMap((item) => item.storage_keys || [])).length,
      inner_html_assignments: jsFiles.reduce((sum, item) => sum + Number(item.inner_html_assignments || 0), 0),
      network_targets: networkTargets.length,
      external_hosts: externalHosts.length,
      write_signals: writeSignals.length,
      dangerous_patterns: dangerousPatterns.length,
      potential_secrets: potentialSecretFindings.length,
      supabase_references: supabaseReferences.length
    },
    findings: {
      network_targets: networkTargets,
      external_hosts: externalHosts,
      write_signals: writeSignals,
      dangerous_patterns: dangerousPatterns,
      potential_secrets: potentialSecretFindings,
      supabase_references: supabaseReferences
    },
    files
  };
}

function main() {
  const report = buildReport();
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Admin surface report generated: ${report.summary.files_total} files, model ${report.security_model.classification}`);
}

if (require.main === module) main();

module.exports = {
  ADMIN_ROOT,
  REPORT_PATH,
  buildReport,
  listFiles
};
