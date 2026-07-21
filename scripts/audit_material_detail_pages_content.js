const fs = require('fs');
const path = require('path');
const {
  inferContentOrigin,
  contentOriginLabel,
  contentOriginNotice
} = require('./lib/content_origin');

const ROOT = process.cwd();
const ARTICLES_PATH = path.join(ROOT, 'data', 'articles.json');
const SITE_URL = 'https://tosborisoglebsk.ru';

function readJson(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${filePath}`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function pagePath(id) {
  return path.join(ROOT, 'materials', id, 'index.html');
}

function expectIncludes(errors, line, html, value, message) {
  if (!html.includes(value)) errors.push(`${line}: ${message}`);
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function compactText(value, maxLength) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  const sliced = text.slice(0, maxLength - 1);
  const boundary = sliced.lastIndexOf(' ');
  const base = sliced.slice(0, boundary > 50 ? boundary : sliced.length).replace(/[,:;.!?\s]+$/u, '');
  return `${base}…`;
}

function articleLead(article) {
  const content = Array.isArray(article.content) ? article.content.filter(Boolean) : [];
  return article.lead || content[0] || 'Полезный материал для председателей и активистов ТОС Борисоглебского городского округа.';
}

function articleDescription(article) {
  const content = Array.isArray(article.content) ? article.content.filter(Boolean) : [];
  return compactText([article.lead, ...content].filter(Boolean).join(' ') || articleLead(article), 155);
}

function main() {
  const errors = [];
  const articles = readJson(ARTICLES_PATH);

  if (!Array.isArray(articles)) {
    throw new Error('Material detail pages audit failed:\ndata/articles.json must be an array');
  }

  const published = articles.filter((article) => article?.id && article.status !== 'draft');

  published.forEach((article, index) => {
    const line = `material detail ${index + 1} ${article.id}`;
    const filePath = pagePath(article.id);
    if (!fs.existsSync(filePath)) {
      errors.push(`${line}: missing generated page /materials/${article.id}/`);
      return;
    }

    const html = fs.readFileSync(filePath, 'utf8');
    const title = article.title || 'Материал ТОС БГО';
    const category = article.category || 'Материалы';
    const lead = articleLead(article);
    const description = articleDescription(article);
    const canonical = `${SITE_URL}/materials/${article.id}/`;
    const origin = inferContentOrigin(article, 'articles');
    const originLabel = contentOriginLabel(origin);
    const originNotice = contentOriginNotice(origin, 'articles');

    expectIncludes(errors, line, html, '<html lang="ru">', 'page must declare Russian language');
    expectIncludes(errors, line, html, `<title>${esc(title)} | Материалы ТОС БГО</title>`, 'title must match material template');
    expectIncludes(errors, line, html, `<meta name="description" content="${esc(description)}"`, 'meta description must match generated description');
    expectIncludes(errors, line, html, `<link rel="canonical" href="${canonical}"`, 'canonical URL is missing');
    expectIncludes(errors, line, html, '<meta property="og:type" content="article"', 'Open Graph type must be article');
    expectIncludes(errors, line, html, `<meta property="og:url" content="${canonical}"`, 'Open Graph URL is missing');
    expectIncludes(errors, line, html, '"@type":"Article"', 'Article JSON-LD is missing');
    expectIncludes(errors, line, html, `"headline":"${title}`, 'JSON-LD headline is missing');
    expectIncludes(errors, line, html, `"articleSection":"${category}`, 'JSON-LD articleSection is missing');
    expectIncludes(errors, line, html, `"mainEntityOfPage":"${canonical}"`, 'JSON-LD mainEntityOfPage is missing');
    expectIncludes(errors, line, html, `<h1>${esc(title)}</h1>`, 'h1 must match material title');
    expectIncludes(errors, line, html, `<p class="lead">${esc(lead)}</p>`, 'lead is missing');
    expectIncludes(errors, line, html, `<span class="tag ">${esc(originLabel)}</span>`, 'content origin label is missing');
    expectIncludes(errors, line, html, `<b>Статус материала:</b> ${esc(originNotice)}`, 'content origin notice is missing');
    expectIncludes(errors, line, html, '<a class="chip" href="/materials/">', 'back link to materials is missing');
    expectIncludes(errors, line, html, 'id="material-context"', 'material context section is missing');
    expectIncludes(errors, line, html, '/verification-guide/', 'verification guide link is missing');
    expectIncludes(errors, line, html, '/update-tos/', 'material update route is missing');
    expectIncludes(errors, line, html, 'Страница материала создана автоматически из data/articles.json.', 'generated-data footer note is missing');
    expectIncludes(errors, line, html, '/assets/css/styles.css', 'styles.css is missing');
    expectIncludes(errors, line, html, '/assets/js/site.js', 'site.js is missing');
    expectIncludes(errors, line, html, 'data-action="menu"', 'menu control is missing');
    expectIncludes(errors, line, html, 'data-action="theme"', 'theme control is missing');

    const content = Array.isArray(article.content) ? article.content.filter(Boolean) : [];
    if (!content.length) errors.push(`${line}: article content is empty`);
    content.forEach((paragraph, paragraphIndex) => {
      if (!html.includes(`<p>${esc(paragraph)}</p>`)) {
        errors.push(`${line}: missing paragraph ${paragraphIndex + 1}`);
      }
    });

    if (origin !== 'editorial') {
      errors.push(`${line}: current article collection must remain editorial until an explicit sourced model is introduced`);
    }
  });

  if (errors.length) {
    throw new Error(`Material detail pages audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Material detail pages OK: ${published.length} pages checked`);
}

main();