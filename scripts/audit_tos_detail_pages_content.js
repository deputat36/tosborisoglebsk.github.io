const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const tosesPath = path.join(process.cwd(), 'data', 'toses.json');
const generatorPath = path.join(process.cwd(), 'scripts', 'generate_tos_pages.js');
const requiredUpdateTypes = ['news', 'card', 'project', 'need', 'photo'];
const requiredSections = [
  'Паспорт ТОС',
  'Что нужно уточнить',
  'Передать сведения или инициативу'
];
const requiredRoutes = ['/tos/', '/update-tos/', '/data-quality/', '/sources/', '/partners/'];

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

function extractJsonLd(html) {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch (error) {
    return null;
  }
}

function extractHero(html) {
  const match = html.match(/<section class="hero">([\s\S]*?)<\/section>/i);
  return match ? match[1] : '';
}

function trustData(tos) {
  const trust = tos && tos.trust && typeof tos.trust === 'object' ? tos.trust : {};
  return {
    checkedAt: trust.checked_at || '',
    sourceRef: trust.source_ref || '',
    scope: Array.isArray(trust.verification_scope) ? trust.verification_scope : [],
    consentRef: trust.publication_consent_ref || ''
  };
}

function main() {
  if (!fs.existsSync(tosesPath)) throw new Error(`Missing file: ${tosesPath}`);
  if (!fs.existsSync(generatorPath)) throw new Error(`Missing file: ${generatorPath}`);

  const toses = JSON.parse(fs.readFileSync(tosesPath, 'utf8'));
  const generator = fs.readFileSync(generatorPath, 'utf8');
  const errors = [];

  if (!Array.isArray(toses)) {
    throw new Error('TOS detail pages audit failed:\ndata/toses.json must be an array');
  }

  if (!generator.includes("const DETAIL_TRUST_VERSION = '2026-07-12';")) {
    errors.push('generator: trust-focused version marker is missing');
  }
  if (generator.includes('if (date && qualityScore >= 80)')) {
    errors.push('generator: technical completeness must not infer partial verification');
  }
  if (generator.includes("tos.updated_at || ''")) {
    errors.push('generator: updated_at must not be used as factual verification date');
  }
  if (generator.includes('Исходные контакты из анкеты')) {
    errors.push('generator: contacts_raw must not be rendered publicly');
  }
  ['data-verification-block="territory"', 'data-verification-block="contacts"', 'data-verification-block="public-links"'].forEach((marker) => {
    if (!generator.includes(marker)) errors.push(`generator: missing field verification marker ${marker}`);
  });
  ['Новости и материалы этого ТОС', 'Проекты и идеи этого ТОС', 'Результаты и запросы этого ТОС', 'Потребности и запросы этого ТОС'].forEach((heading) => {
    if (!generator.includes(heading)) errors.push(`generator: missing neutral related-content heading ${heading}`);
  });

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
    const trust = trustData(tos);

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
    if (tos.updated_at) expectIncludes(errors, line, html, tos.updated_at, 'technical updated_at is missing');

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

    ['territory', 'contacts', 'public-links'].forEach((name) => {
      expectIncludes(errors, line, html, `data-verification-block="${name}"`, `missing verification marker for ${name}`);
    });

    if (!html.includes('Статус сведений:') || !html.includes('Источник подтверждения')) {
      errors.push(`${line}: verification status block is missing`);
    }
    if (!html.includes('Техническая публикация карточки не подтверждает актуальность')) {
      errors.push(`${line}: technical publication caution is missing`);
    }
    if (!html.includes('Технически обновлено:') || !html.includes('Эта дата не является проверкой сведений')) {
      errors.push(`${line}: technical date must be separated from factual verification`);
    }
    if (!html.includes('Техническая заполненность полей:') || !html.includes('Это не является подтверждением актуальности')) {
      errors.push(`${line}: technical completeness caution is missing`);
    }
    if (!html.includes('Пришлите только данные, которые можно размещать открыто')) {
      errors.push(`${line}: public-data safety note is missing`);
    }
    if (html.includes('Исходные контакты из анкеты') || html.includes(tos.contacts_raw || '__never__')) {
      if (tos.contacts_raw) errors.push(`${line}: raw questionnaire contacts must not be rendered`);
    }
    if (html.includes('<h2>Связанные разделы</h2>')) {
      errors.push(`${line}: duplicate generic related-links section must be removed`);
    }
    if (html.includes('<span>заполненность карточки</span>')) {
      errors.push(`${line}: completeness must not be a passport KPI`);
    }
    if (!html.includes('Данные страницы обновляются автоматически из JSON-файлов сайта')) {
      errors.push(`${line}: generated-data footer note is missing`);
    }

    const hero = extractHero(html);
    const heroLinks = Array.from(hero.matchAll(/href="([^"]+)"/g), (match) => match[1]);
    const heroButtons = (hero.match(/<button\b/g) || []).length;
    if (heroLinks.length !== 2 || heroLinks[0] !== '/tos/' || !heroLinks[1].includes('type=card#message-builder') || heroButtons !== 1) {
      errors.push(`${line}: hero must contain catalog backlink, one correction CTA and one print button`);
    }
    if (!hero.includes('type="button"')) {
      errors.push(`${line}: print button must declare type=button`);
    }

    (tos.phones || []).forEach((phone, phoneIndex) => {
      const normalized = normalizePhone(phone);
      if (normalized && !html.includes(`href="tel:${normalized}"`)) {
        errors.push(`${line}: phone ${phoneIndex + 1} is missing tel link ${phone}`);
      }
    });

    (tos.emails || []).forEach((email, emailIndex) => {
      if (email && !html.includes(`href="mailto:${email}"`)) {
        errors.push(`${line}: email ${emailIndex + 1} is missing mailto link`);
      }
    });

    [...(tos.chairperson_links || []), ...(tos.social_links || [])].forEach((url, urlIndex) => {
      const escapedUrl = escapeAttribute(url);
      if (url && !html.includes(`href="${escapedUrl}"`)) {
        errors.push(`${line}: public link ${urlIndex + 1} is missing`);
      }
    });

    if (!(tos.phones || []).length && !html.includes('Контакты уточняются')) {
      errors.push(`${line}: missing contact placeholder`);
    }
    if (!(tos.social_links || []).length && !html.includes('Информация уточняется')) {
      errors.push(`${line}: missing social placeholder`);
    }

    const jsonLd = extractJsonLd(html);
    if (!jsonLd || !Array.isArray(jsonLd['@graph'])) {
      errors.push(`${line}: JSON-LD cannot be parsed`);
    } else {
      const organization = jsonLd['@graph'].find((item) => item && item['@type'] === 'Organization') || {};
      const phoneStructuredAllowed = Boolean(trust.checkedAt && trust.sourceRef && trust.scope.includes('phones') && trust.consentRef);
      const contactPoints = Array.isArray(organization.contactPoint) ? organization.contactPoint : [];
      if (!phoneStructuredAllowed && contactPoints.length) {
        errors.push(`${line}: unverified phone must not be exposed as structured contactPoint`);
      }
      if (phoneStructuredAllowed && (tos.phones || []).length && !contactPoints.length) {
        errors.push(`${line}: verified phone scope with consent must be present in structured data`);
      }

      const expectedSameAs = [
        ...(trust.checkedAt && trust.sourceRef && trust.scope.includes('chairperson') && trust.consentRef ? (tos.chairperson_links || []) : []),
        ...(trust.checkedAt && trust.sourceRef && trust.scope.includes('social_links') ? (tos.social_links || []) : [])
      ];
      const sameAs = Array.isArray(organization.sameAs) ? organization.sameAs : [];
      if (JSON.stringify(sameAs) !== JSON.stringify(expectedSameAs)) {
        errors.push(`${line}: structured sameAs must include only verified public links`);
      }
    }
  });

  if (errors.length) {
    throw new Error(`TOS detail pages audit failed:\n${errors.join('\n')}`);
  }

  console.log(`TOS detail pages OK: ${toses.length} pages checked with trust-focused fields`);
}

main();
