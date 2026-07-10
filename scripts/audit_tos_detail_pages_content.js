const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const tosesPath = path.join(process.cwd(), 'data', 'toses.json');
const requiredUpdateTypes = ['news', 'card', 'project', 'need', 'photo'];
const requiredSections = [
  'Паспорт ТОС',
  'Что нужно уточнить',
  'Описание',
  'Председатель',
  'Как помочь этому ТОС',
  'Связанные разделы',
  'Новости этого ТОС',
  'Проекты этого ТОС',
  'Сделано этим ТОС',
  'Актуальные потребности этого ТОС'
];
const requiredRoutes = ['/tos/', '/update-tos/', '/data-quality/', '/sources/', '/partners/', '/news/', '/projects/', '/needs/', '/done/'];

function normalizePhone(value) {
  return String(value || '').replace(/[^+\d]/g, '');
}

function escapeAttribute(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;');
}

function pagePathForSlug(slug) {
  return path.join(process.cwd(), 'tos', slug, 'index.html');
}

function expectIncludes(errors, line, html, value, message) {
  if (!html.includes(value)) errors.push(`${line}: ${message}`);
}

function main() {
  if (!fs.existsSync(tosesPath)) {
    throw new Error(`Missing file: ${tosesPath}`);
  }

  const toses = JSON.parse(fs.readFileSync(tosesPath, 'utf8'));
  const errors = [];

  if (!Array.isArray(toses)) {
    throw new Error('TOS detail pages audit failed:\ndata/toses.json must be an array');
  }

  toses.filter((tos) => tos && tos.status !== 'draft').forEach((tos, index) => {
    const line = `tos page ${index + 1} ${tos.slug || 'unknown'}`;
    const slug = tos.slug || '';
    const filePath = pagePathForSlug(slug);

    if (!slug) {
      errors.push(`${line}: missing slug`);
      return;
    }

    if (!fs.existsSync(filePath)) {
      errors.push(`${line}: missing page /tos/${slug}/`);
      return;
    }

    const html = fs.readFileSync(filePath, 'utf8');
    const pageUrl = `https://tosborisoglebsk.ru/tos/${slug}/`;
    const updatePrefix = `/update-tos/?tos=${slug}&amp;type=`;

    expectIncludes(errors, line, html, '<html lang="ru">', 'page must declare Russian language');
    expectIncludes(errors, line, html, `<link rel="canonical" href="${pageUrl}"`, 'missing canonical URL');
    expectIncludes(errors, line, html, `<meta property="og:url" content="${pageUrl}"`, 'missing Open Graph URL');
    expectIncludes(errors, line, html, `<h1>${tos.title}</h1>`, 'h1 must match TOS title');
    expectIncludes(errors, line, html, `<title>${tos.title} — контакты, границы, председатель | ТОС БГО</title>`, 'title must match TOS title template');
    expectIncludes(errors, line, html, `"url":"${pageUrl}"`, 'JSON-LD organization URL is missing');
    expectIncludes(errors, line, html, '"@type":"BreadcrumbList"', 'JSON-LD breadcrumbs are missing');
    expectIncludes(errors, line, html, 'data-action="menu"', 'menu control is missing');
    expectIncludes(errors, line, html, 'data-action="theme"', 'theme control is missing');
    expectIncludes(errors, line, html, '/assets/js/site.js', 'site.js is missing');
    expectIncludes(errors, line, html, '/assets/js/tos-logos.js', 'tos-logos.js is missing');

    if (tos.location) expectIncludes(errors, line, html, tos.location, 'location is missing');
    if (tos.boundaries) expectIncludes(errors, line, html, tos.boundaries, 'boundaries are missing');
    if (tos.chairperson) expectIncludes(errors, line, html, tos.chairperson, 'chairperson is missing');
    if (tos.updated_at) expectIncludes(errors, line, html, tos.updated_at, 'updated_at is missing');

    requiredSections.forEach((section) => {
      expectIncludes(errors, line, html, section, `missing section ${section}`);
    });

    requiredRoutes.forEach((route) => {
      if (!repoPathExists(route)) errors.push(`${line}: linked route does not exist ${route}`);
      expectIncludes(errors, line, html, `href="${route}`, `missing link to ${route}`);
    });

    requiredUpdateTypes.forEach((type) => {
      expectIncludes(errors, line, html, `${updatePrefix}${type}#message-builder`, `missing update action for type ${type}`);
    });

    if (!html.includes('Статус сведений:') || !html.includes('Источник подтверждения')) {
      errors.push(`${line}: verification status block is missing`);
    }

    if (!html.includes('Пришлите только те данные, которые можно размещать открыто')) {
      errors.push(`${line}: public-data safety note is missing`);
    }

    if (!html.includes('Данные страницы обновляются автоматически из JSON-файлов сайта')) {
      errors.push(`${line}: generated-data footer note is missing`);
    }

    (tos.phones || []).forEach((phone, phoneIndex) => {
      const normalized = normalizePhone(phone);
      if (normalized && !html.includes(`href="tel:${normalized}"`)) {
        errors.push(`${line}: phone ${phoneIndex + 1} is missing tel link ${phone}`);
      }
    });

    (tos.emails || []).forEach((email, emailIndex) => {
      if (email && !html.includes(`href="mailto:${email}"`)) {
        errors.push(`${line}: email ${emailIndex + 1} is missing mailto link ${email}`);
      }
    });

    [...(tos.chairperson_links || []), ...(tos.social_links || [])].forEach((url, urlIndex) => {
      const escapedUrl = escapeAttribute(url);
      if (url && !html.includes(`href="${escapedUrl}"`)) {
        errors.push(`${line}: public link ${urlIndex + 1} is missing ${url}`);
      }
    });

    if (!(tos.phones || []).length && !html.includes('Телефон:</b> уточняется')) {
      errors.push(`${line}: missing phone placeholder`);
    }

    if (!(tos.emails || []).length && !html.includes('Email:</b> уточняется')) {
      errors.push(`${line}: missing email placeholder`);
    }

    if (!(tos.social_links || []).length && !html.includes('Соцсети:</b> уточняются')) {
      errors.push(`${line}: missing social placeholder`);
    }
  });

  if (errors.length) {
    throw new Error(`TOS detail pages audit failed:\n${errors.join('\n')}`);
  }

  console.log(`TOS detail pages OK: ${toses.length} pages checked`);
}

main();
