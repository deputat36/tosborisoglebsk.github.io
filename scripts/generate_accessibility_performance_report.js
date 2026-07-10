const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'data', 'accessibility_performance_report.json');
const SKIP_DIRS = new Set(['.git', 'node_modules']);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);
const ASSET_EXTENSIONS = new Set(['.css', '.js', ...IMAGE_EXTENSIONS]);

function repoPath(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join('/');
}

function walk(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath, files);
    else files.push(fullPath);
  }
  return files;
}

function attributes(tag) {
  const result = {};
  const pattern = /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let match;
  while ((match = pattern.exec(tag))) {
    const key = match[1].toLowerCase();
    if (key === tag.match(/^<\/?\s*([\w-]+)/i)?.[1]?.toLowerCase()) continue;
    result[key] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return result;
}

function tags(html, tagName) {
  return html.match(new RegExp(`<${tagName}\\b[^>]*>`, 'gi')) || [];
}

function hasAccessibleName(attrs) {
  return Boolean(
    String(attrs['aria-label'] || '').trim()
    || String(attrs['aria-labelledby'] || '').trim()
    || String(attrs.title || '').trim()
  );
}

function hasLabelFor(html, id) {
  if (!id) return false;
  const escaped = String(id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`<label\\b[^>]*\\bfor=["']${escaped}["'][^>]*>`, 'i').test(html);
}

function isPublicHtml(relativePath, html) {
  if (relativePath.startsWith('.github/') || relativePath.startsWith('scripts/')) return false;
  return !/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html);
}

function inspectHtml(filePath) {
  const relativePath = repoPath(filePath);
  const html = fs.readFileSync(filePath, 'utf8');
  const publicPage = isPublicHtml(relativePath, html);
  const issues = [];

  if (!/<html\b[^>]*\blang=["'][^"']+["']/i.test(html)) issues.push({ type: 'missing_html_lang', severity: 'high' });
  if (!/<main\b/i.test(html)) issues.push({ type: 'missing_main_landmark', severity: 'medium' });
  if (publicPage && !/<a\b[^>]*class=["'][^"']*skip-link/i.test(html)) issues.push({ type: 'missing_skip_link', severity: 'low' });

  const imageTags = tags(html, 'img');
  let missingAlt = 0;
  let nonLazyContentImages = 0;
  imageTags.forEach((tag) => {
    const attrs = attributes(tag);
    if (!Object.prototype.hasOwnProperty.call(attrs, 'alt')) missingAlt += 1;
    const src = String(attrs.src || '');
    const likelyBrand = /logo|icon|favicon/i.test(src) || /brand/i.test(String(attrs.class || ''));
    if (!likelyBrand && !Object.prototype.hasOwnProperty.call(attrs, 'loading')) nonLazyContentImages += 1;
  });
  if (missingAlt) issues.push({ type: 'images_missing_alt', severity: 'high', count: missingAlt });
  if (nonLazyContentImages) issues.push({ type: 'images_without_lazy_loading', severity: 'low', count: nonLazyContentImages });

  const buttonTags = tags(html, 'button');
  const buttonsWithoutType = buttonTags.filter((tag) => !Object.prototype.hasOwnProperty.call(attributes(tag), 'type')).length;
  if (buttonsWithoutType) issues.push({ type: 'buttons_without_type', severity: 'medium', count: buttonsWithoutType });

  const controls = [
    ...tags(html, 'input'),
    ...tags(html, 'select'),
    ...tags(html, 'textarea')
  ];
  let controlsWithoutLabel = 0;
  controls.forEach((tag) => {
    const attrs = attributes(tag);
    const type = String(attrs.type || '').toLowerCase();
    if (['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) return;
    if (hasAccessibleName(attrs) || hasLabelFor(html, attrs.id)) return;
    controlsWithoutLabel += 1;
  });
  if (controlsWithoutLabel) issues.push({ type: 'form_controls_without_label', severity: 'medium', count: controlsWithoutLabel });

  const anchors = tags(html, 'a');
  let unsafeExternalLinks = 0;
  let emptyLinks = 0;
  anchors.forEach((tag) => {
    const attrs = attributes(tag);
    const href = String(attrs.href || '').trim();
    if (!href || href === '#') emptyLinks += 1;
    if (/^https?:\/\//i.test(href) && String(attrs.target || '').toLowerCase() === '_blank') {
      const rel = String(attrs.rel || '').toLowerCase();
      if (!rel.includes('noopener') && !rel.includes('noreferrer')) unsafeExternalLinks += 1;
    }
  });
  if (unsafeExternalLinks) issues.push({ type: 'external_blank_links_without_noopener', severity: 'high', count: unsafeExternalLinks });
  if (emptyLinks) issues.push({ type: 'empty_or_hash_links', severity: 'low', count: emptyLinks });

  const inlineStyleCount = (html.match(/\sstyle=["']/gi) || []).length;
  if (inlineStyleCount >= 10) issues.push({ type: 'many_inline_styles', severity: 'low', count: inlineStyleCount });

  return {
    path: relativePath,
    public: publicPage,
    size_bytes: Buffer.byteLength(html, 'utf8'),
    images: imageTags.length,
    buttons: buttonTags.length,
    form_controls: controls.length,
    issues
  };
}

function assetGroup(extension) {
  if (extension === '.css') return 'css';
  if (extension === '.js') return 'js';
  if (IMAGE_EXTENSIONS.has(extension)) return 'images';
  return 'other';
}

function thresholdFor(group, extension) {
  if (group === 'css') return 250 * 1024;
  if (group === 'js') return 250 * 1024;
  if (group === 'images' && extension === '.svg') return 300 * 1024;
  if (group === 'images') return 700 * 1024;
  return Infinity;
}

function summarizeIssues(pages) {
  const counts = {};
  const severity = { high: 0, medium: 0, low: 0 };
  pages.forEach((page) => {
    page.issues.forEach((issue) => {
      counts[issue.type] = (counts[issue.type] || 0) + (issue.count || 1);
      severity[issue.severity] = (severity[issue.severity] || 0) + (issue.count || 1);
    });
  });
  return { counts, severity };
}

function main() {
  const files = walk(ROOT);
  const htmlFiles = files.filter((filePath) => path.extname(filePath).toLowerCase() === '.html');
  const pages = htmlFiles.map(inspectHtml);
  const issueSummary = summarizeIssues(pages);

  const assets = files
    .filter((filePath) => ASSET_EXTENSIONS.has(path.extname(filePath).toLowerCase()))
    .map((filePath) => {
      const extension = path.extname(filePath).toLowerCase();
      const group = assetGroup(extension);
      const sizeBytes = fs.statSync(filePath).size;
      return {
        path: repoPath(filePath),
        group,
        extension,
        size_bytes: sizeBytes,
        over_budget: sizeBytes > thresholdFor(group, extension)
      };
    });

  const totals = { css: 0, js: 0, images: 0 };
  assets.forEach((asset) => {
    if (Object.prototype.hasOwnProperty.call(totals, asset.group)) totals[asset.group] += asset.size_bytes;
  });

  const report = {
    generated_at: new Date().toISOString(),
    budgets: {
      css_file_bytes: 250 * 1024,
      js_file_bytes: 250 * 1024,
      raster_image_bytes: 700 * 1024,
      svg_image_bytes: 300 * 1024,
      total_css_bytes: 700 * 1024,
      total_js_bytes: 1500 * 1024
    },
    summary: {
      html_pages: pages.length,
      public_pages: pages.filter((page) => page.public).length,
      pages_with_issues: pages.filter((page) => page.issues.length).length,
      issue_counts: issueSummary.counts,
      issue_severity: issueSummary.severity,
      asset_files: assets.length,
      over_budget_assets: assets.filter((asset) => asset.over_budget).length,
      total_css_bytes: totals.css,
      total_js_bytes: totals.js,
      total_image_bytes: totals.images,
      total_css_over_budget: totals.css > 700 * 1024,
      total_js_over_budget: totals.js > 1500 * 1024
    },
    page_findings: pages.filter((page) => page.issues.length),
    largest_assets: assets.sort((a, b) => b.size_bytes - a.size_bytes).slice(0, 30),
    over_budget_assets: assets.filter((asset) => asset.over_budget).sort((a, b) => b.size_bytes - a.size_bytes),
    notes: [
      'Отчёт является измерительным baseline и не заменяет ручную проверку клавиатурной навигации, контраста и экранного диктора.',
      'Пустой alt может быть корректным для декоративного изображения; ошибкой считается отсутствие атрибута alt.',
      'Lazy-loading не требуется для логотипов и иконок, но рекомендуется для контентных изображений ниже первого экрана.',
      'Пороговые значения используются как раннее предупреждение и могут быть уточнены после анализа текущего baseline.'
    ]
  };

  fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Accessibility/performance report: ${pages.length} pages, ${assets.length} assets, ${report.summary.pages_with_issues} pages with findings`);
}

main();
