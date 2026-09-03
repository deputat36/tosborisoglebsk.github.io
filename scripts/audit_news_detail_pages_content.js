const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');
const { inferContentOrigin } = require('./lib/content_origin');

const newsPath = path.join(process.cwd(), 'data', 'news.json');
const tosesPath = path.join(process.cwd(), 'data', 'toses.json');
const siteUrl = 'https://tosborisoglebsk.ru';
const allowedContextRoutes = new Set([
  '/grants/',
  '/legal/',
  '/projects/',
  '/partners/',
  '/materials/',
  '/verification-guide/',
  '/residents/',
  '/update-tos/'
]);

function pagePathForNews(id) {
  return path.join(process.cwd(), 'news', id, 'index.html');
}

function expectIncludes(errors, line, html, value, message) {
  if (!html.includes(value)) errors.push(`${line}: ${message}`);
}

function htmlEntityAmp(value) {
  return String(value || '').replace(/&/g, '&amp;');
}

function contextLinksFromHtml(html) {
  const match = html.match(/<section class="section tight" id="news-context" aria-labelledby="news-context-title">([\s\S]*?)<\/section>/);
  if (!match) return null;
  return [...match[1].matchAll(/href="([^"]+)"/g)].map((entry) => entry[1]);
}

function isAllowedContextRoute(href) {
  return allowedContextRoutes.has(href) || /^\/tos\/[a-z0-9-]+\/$/.test(href);
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
    expectIncludes(errors, line, html, 'id="news-context"', 'context navigation section is missing');
    expectIncludes(errors, line, html, '<h2 id="news-context-title">Что посмотреть дальше</h2>', 'context navigation heading is missing');

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

    if (item.implementation_source || item.implementation_source_url) {
      expectIncludes(errors, line, html, '<b>Подтверждение реализации:</b>', 'implementation source heading is missing');
      if (item.implementation_source) {
        expectIncludes(errors, line, html, item.implementation_source, 'implementation source label is missing');
      }
      if (item.implementation_source_url) {
        const implementationUrl = String(item.implementation_source_url);
        expectIncludes(errors, line, html, `href="${htmlEntityAmp(implementationUrl)}"`, 'implementation source URL is missing');
        if (/^https?:\/\//.test(implementationUrl)) {
          expectIncludes(errors, line, html, 'target="_blank" rel="noopener noreferrer"', 'implementation source URL must open safely');
        }
      }
    }

    const contextLinks = contextLinksFromHtml(html);
    if (!contextLinks) {
      errors.push(`${line}: context navigation block could not be parsed`);
    } else {
      if (contextLinks.length < 3 || contextLinks.length > 5) {
        errors.push(`${line}: context navigation must contain 3 to 5 links, got ${contextLinks.length}`);
      }

      const uniqueLinks = new Set(contextLinks);
      if (uniqueLinks.size !== contextLinks.length) {
        errors.push(`${line}: context navigation contains duplicate links`);
      }

      contextLinks.forEach((href) => {
        if (!isAllowedContextRoute(href)) {
          errors.push(`${line}: context navigation contains disallowed route ${href}`);
          return;
        }
        if (!repoPathExists(href)) errors.push(`${line}: context route is missing ${href}`);
      });

      if (!contextLinks.includes('/update-tos/')) {
        errors.push(`${line}: context navigation must include /update-tos/`);
      }

      if (inferContentOrigin(item, 'news') !== 'verified' && !contextLinks.includes('/verification-guide/')) {
        errors.push(`${line}: non-verified news must link to /verification-guide/`);
      }
    }

    if (item.tos_slug) {
      if (!tosSlugs.has(item.tos_slug)) errors.push(`${line}: unknown tos_slug ${item.tos_slug}`);
      if (!repoPathExists(`/tos/${item.tos_slug}/`)) errors.push(`${line}: linked TOS page is missing /tos/${item.tos_slug}/`);
      expectIncludes(errors, line, html, `href="/tos/${item.tos_slug}/"`, 'linked TOS route is missing');
      if (contextLinks && !contextLinks.includes(`/tos/${item.tos_slug}/`)) {
        errors.push(`${line}: linked TOS route must be inside context navigation`);
      }
    }

    if (id === 'mirolyubie-project-winner-2026') {
      expectIncludes(errors, line, html, '1 489 360 рублей', 'confirmed grant amount is missing');
      expectIncludes(errors, line, html, '960 кв. м', 'confirmed implementation area is missing');
      expectIncludes(errors, line, html, 'работы заняли около полутора месяцев', 'confirmed implementation duration is missing');
      expectIncludes(errors, line, html, 'РИА «Воронеж», 20 августа 2026 года', 'implementation evidence attribution is missing');
      if (html.includes('До получения подтверждения портал не утверждает, что работы уже начались или завершены.')) {
        errors.push(`${line}: stale implementation caution must not remain after implementation confirmation`);
      }
    }
  });

  if (errors.length) {
    throw new Error(`News detail pages audit failed:\n${errors.join('\n')}`);
  }

  console.log(`News detail pages OK: ${news.filter((item) => item && item.status !== 'draft').length} pages checked`);
}

main();
