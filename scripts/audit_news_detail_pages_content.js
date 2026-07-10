const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const newsPath = path.join(process.cwd(), 'data', 'news.json');
const tosesPath = path.join(process.cwd(), 'data', 'toses.json');
const siteUrl = 'https://tosborisoglebsk.ru';

function pagePathForNews(id) {
  return path.join(process.cwd(), 'news', id, 'index.html');
}

function expectIncludes(errors, line, html, value, message) {
  if (!html.includes(value)) errors.push(`${line}: ${message}`);
}

function htmlEntityAmp(value) {
  return String(value || '').replace(/&/g, '&amp;');
}

function main() {
  const errors = [];

  [newsPath, tosesPath].forEach((filePath) => {
    if (!fs.existsSync(filePath)) errors.push(`missing file ${filePath}`);
  });

  if (errors.length) {
    throw new Error(`News detail pages audit failed:\n${errors.join('\n')}`);
  }

  const news = JSON.parse(fs.readFileSync(newsPath, 'utf8'));
  const toses = JSON.parse(fs.readFileSync(tosesPath, 'utf8'));

  if (!Array.isArray(news)) {
    throw new Error('News detail pages audit failed:\ndata/news.json must be an array');
  }

  const tosSlugs = new Set(Array.isArray(toses) ? toses.map((tos) => tos.slug).filter(Boolean) : []);

  news.filter((item) => item && item.status !== 'draft').forEach((item, index) => {
    const line = `news page ${index + 1} ${item.id || 'unknown'}`;
    const id = item.id || '';
    const filePath = pagePathForNews(id);
    const pageUrl = `${siteUrl}/news/${id}/`;

    if (!id) {
      errors.push(`${line}: missing id`);
      return;
    }

    if (!fs.existsSync(filePath)) {
      errors.push(`${line}: missing generated page /news/${id}/`);
      return;
    }

    const html = fs.readFileSync(filePath, 'utf8');
    const title = item.title || '';
    const lead = item.lead || '';
    const category = item.category || '';
    const date = item.date || '';

    expectIncludes(errors, line, html, '<html lang="ru">', 'page must declare Russian language');
    expectIncludes(errors, line, html, `<title>${title} | ТОС БГО</title>`, 'title must match news title template');
    expectIncludes(errors, line, html, `<meta name="description" content="${htmlEntityAmp(lead)}"`, 'meta description must match lead');
    expectIncludes(errors, line, html, `<link rel="canonical" href="${pageUrl}"`, 'missing canonical URL');
    expectIncludes(errors, line, html, '<meta property="og:type" content="article"', 'Open Graph type must be article');
    expectIncludes(errors, line, html, `<meta property="og:url" content="${pageUrl}"`, 'missing Open Graph URL');
    expectIncludes(errors, line, html, `<h1>${title}</h1>`, 'h1 must match news title');
    expectIncludes(errors, line, html, lead, 'lead text is missing');
    expectIncludes(errors, line, html, '/assets/css/styles.css', 'styles.css is missing');
    expectIncludes(errors, line, html, '/assets/js/site.js', 'site.js is missing');
    expectIncludes(errors, line, html, 'data-action="menu"', 'menu control is missing');
    expectIncludes(errors, line, html, 'data-action="theme"', 'theme control is missing');
    expectIncludes(errors, line, html, 'Страница новости создана автоматически из data/news.json', 'generated-data footer note is missing');
    expectIncludes(errors, line, html, '"@type":"NewsArticle"', 'NewsArticle JSON-LD is missing');
    expectIncludes(errors, line, html, `"headline":"${title}`, 'JSON-LD headline is missing');
    expectIncludes(errors, line, html, `"datePublished":"${date}"`, 'JSON-LD datePublished is missing');
    expectIncludes(errors, line, html, `"mainEntityOfPage":"${pageUrl}"`, 'JSON-LD mainEntityOfPage is missing');
    expectIncludes(errors, line, html, '<a class="chip" href="/news/">', 'back link to news feed is missing');

    if (category) expectIncludes(errors, line, html, category, 'category is missing');
    if (date) expectIncludes(errors, line, html, date.slice(0, 4), 'news year is missing');

    if (Array.isArray(item.text)) {
      item.text.forEach((paragraph, paragraphIndex) => {
        if (paragraph && !html.includes(paragraph)) {
          errors.push(`${line}: missing paragraph ${paragraphIndex + 1}`);
        }
      });
    }

    if (item.source) {
      expectIncludes(errors, line, html, `<b>Источник:</b> ${item.source}`, 'source label is missing');
    }

    if (item.source_url) {
      const sourceUrl = String(item.source_url);
      const escapedSourceUrl = htmlEntityAmp(sourceUrl);
      const absoluteCitation = sourceUrl.startsWith('/') ? `${siteUrl}${sourceUrl}` : sourceUrl;
      const externalSource = /^https?:\/\//.test(sourceUrl);

      expectIncludes(errors, line, html, `href="${escapedSourceUrl}"`, 'source URL is missing');
      if (externalSource) {
        expectIncludes(errors, line, html, 'target="_blank" rel="noopener noreferrer"', 'external source URL must open safely');
      }
      expectIncludes(errors, line, html, `"citation":"${absoluteCitation}`, 'JSON-LD citation is missing');
    }

    if (item.tos_slug) {
      if (!tosSlugs.has(item.tos_slug)) errors.push(`${line}: unknown tos_slug ${item.tos_slug}`);
      if (!repoPathExists(`/tos/${item.tos_slug}/`)) errors.push(`${line}: linked TOS page is missing /tos/${item.tos_slug}/`);
      expectIncludes(errors, line, html, `href="/tos/${item.tos_slug}/"`, 'linked TOS route is missing');
    }

    if (id === 'mirolyubie-project-winner-2026') {
      expectIncludes(errors, line, html, '1 489 360 рублей', 'confirmed grant amount is missing');
      expectIncludes(errors, line, html, 'До получения подтверждения портал не утверждает, что работы уже начались или завершены.', 'implementation caution is missing');
    }
  });

  if (errors.length) {
    throw new Error(`News detail pages audit failed:\n${errors.join('\n')}`);
  }

  console.log(`News detail pages OK: ${news.filter((item) => item && item.status !== 'draft').length} pages checked`);
}

main();
