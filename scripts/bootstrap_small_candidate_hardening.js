const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

function file(relativePath) {
  return path.join(ROOT, relativePath);
}

function update(relativePath, transform) {
  const target = file(relativePath);
  if (!fs.existsSync(target)) throw new Error(`Missing file: ${relativePath}`);
  const before = fs.readFileSync(target, 'utf8');
  const after = transform(before);
  if (after === before) {
    console.log(`Unchanged: ${relativePath}`);
    return;
  }
  fs.writeFileSync(target, after, 'utf8');
  console.log(`Updated: ${relativePath}`);
}

function ensureRobotsNoindex(html, relativePath) {
  const robots = '<meta name="robots" content="noindex,nofollow"/>';
  if (html.includes(robots)) return html;
  if (/<meta\s+name=["']robots["'][^>]*>/i.test(html)) {
    return html.replace(/<meta\s+name=["']robots["'][^>]*>/i, robots);
  }
  const description = /(<meta\s+name="description"\s+content="[^"]*"\s*\/>)/i;
  if (!description.test(html)) throw new Error(`${relativePath}: description meta not found`);
  return html.replace(description, `$1\n  ${robots}`);
}

function patchLlms(text) {
  let output = text.replace(
    /^- Запросы на уточнение данных: https:\/\/tosborisoglebsk\.ru\/data-requests\/\r?\n/m,
    ''
  );
  const paragraph = 'Некоторые технические страницы портала используются редактором и закрыты от индексации через `noindex,nofollow`. Их не нужно считать основными публичными разделами: `/audit/`, `/site-health/`, `/collection-board/`, `/data-requests/`, `/data-requests/priority-tos/`, `/data-requests/tos-registry-request/`, `/verification-tasks/`, `/workbench/`, `/verification-control/`, старые `/news/view.html`, `/tos/view.html` и локальный инструмент `/tools/import.html`.';
  if (/Некоторые технические страницы портала[\s\S]*?(?=\n\n## Использование данных)/.test(output)) {
    output = output.replace(/Некоторые технические страницы портала[\s\S]*?(?=\n\n## Использование данных)/, paragraph);
  } else {
    throw new Error('llms.txt: working pages paragraph not found');
  }
  return output;
}

function patchLlmsScript(text) {
  let output = text.replace(
    /^\s*\['Запросы на уточнение данных', 'https:\/\/tosborisoglebsk\.ru\/data-requests\/'\],\r?\n/m,
    ''
  );
  if (!output.includes("'https://tosborisoglebsk.ru/data-requests/'")) {
    const marker = "  'https://tosborisoglebsk.ru/site-health/',\n";
    if (!output.includes(marker)) throw new Error('patch_llms_links.js: deprecatedUrls marker not found');
    output = output.replace(marker, `${marker}  'https://tosborisoglebsk.ru/data-requests/',\n`);
  }
  return output;
}

function patchHomepageAudit(text) {
  let output = text;
  const constMarker = "const navigationPatchPath = path.join(process.cwd(), 'scripts', 'patch_site_navigation.js');\n";
  const constLine = "const homeStatsScriptPath = path.join(process.cwd(), 'assets', 'js', 'home-stats.js');\n";
  if (!output.includes(constLine)) {
    if (!output.includes(constMarker)) throw new Error('audit_homepage_content.js: path marker not found');
    output = output.replace(constMarker, `${constMarker}${constLine}`);
  }

  const existenceBlock = `\n  if (!fs.existsSync(homeStatsScriptPath)) {\n    throw new Error(\`Missing file: \${homeStatsScriptPath}\`);\n  }\n`;
  if (!output.includes('if (!fs.existsSync(homeStatsScriptPath))')) {
    const marker = "  if (!fs.existsSync(navigationPatchPath)) {\n    throw new Error(`Missing file: ${navigationPatchPath}`);\n  }\n";
    if (!output.includes(marker)) throw new Error('audit_homepage_content.js: existence marker not found');
    output = output.replace(marker, `${marker}${existenceBlock}`);
  }

  const readLine = "  const homeStatsScript = fs.readFileSync(homeStatsScriptPath, 'utf8');\n";
  if (!output.includes(readLine)) {
    const marker = "  const navigationPatch = fs.readFileSync(navigationPatchPath, 'utf8');\n";
    if (!output.includes(marker)) throw new Error('audit_homepage_content.js: read marker not found');
    output = output.replace(marker, `${marker}${readLine}`);
  }

  if (!output.includes("homepage statistics must destructure rows as label, value, hint")) {
    const marker = "  const primaryActions = countMatches(html, /data-home-primary-action/g);\n";
    const checks = `  if (!homeStatsScript.includes('stats.map(([label,value,hint])')) {\n    errors.push('homepage statistics must destructure rows as label, value, hint');\n  }\n\n  if (!homeStatsScript.includes('<b>\${esc(value)}</b><span>\${esc(label)}</span>')) {\n    errors.push('homepage statistics must render the value in b and the label in span');\n  }\n\n  if (homeStatsScript.includes('stats.map(([value,label,hint])')) {\n    errors.push('homepage statistics must not swap labels and values');\n  }\n\n`;
    if (!output.includes(marker)) throw new Error('audit_homepage_content.js: primary actions marker not found');
    output = output.replace(marker, `${checks}${marker}`);
  }
  return output;
}

function patchRouteAudit(text) {
  if (text.includes("priority TOS requests indexing")) return text;
  const marker = "\n  assertPageMarkers(errors, 'data-update cleanup', '/reply-review/', [\n";
  const checks = `\n  assertPageMarkers(errors, 'priority TOS requests indexing', '/data-requests/priority-tos/', [\n    'name="robots" content="noindex,nofollow"'\n  ]);\n  assertPageMarkers(errors, 'TOS registry request indexing', '/data-requests/tos-registry-request/', [\n    'name="robots" content="noindex,nofollow"'\n  ]);\n`;
  if (!text.includes(marker)) throw new Error('audit_route_governance.js: reply-review marker not found');
  return text.replace(marker, `${checks}${marker}`);
}

update('data-requests/priority-tos/index.html', (text) => ensureRobotsNoindex(text, 'priority-tos'));
update('data-requests/tos-registry-request/index.html', (text) => ensureRobotsNoindex(text, 'tos-registry-request'));
update('llms.txt', patchLlms);
update('scripts/patch_llms_links.js', patchLlmsScript);
update('scripts/audit_homepage_content.js', patchHomepageAudit);
update('scripts/audit_route_governance.js', patchRouteAudit);
