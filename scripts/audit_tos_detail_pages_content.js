const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');
const { inferContentOrigin, contentOriginLabel, contentOriginNotice } = require('./lib/content_origin');

const ROOT = process.cwd();
const tosesPath = path.join(ROOT, 'data', 'toses.json');
const generatorPath = path.join(ROOT, 'scripts', 'generate_tos_pages.js');
const relatedPatcherPath = path.join(ROOT, 'scripts', 'patch_tos_related_content_trust.js');
const responsivePatcherPath = path.join(ROOT, 'scripts', 'patch_tos_detail_responsive_styles.js');
const requiredUpdateTypes = ['news', 'card', 'project', 'need', 'photo'];
const requiredSections = [
  'Паспорт ТОС',
  'Что нужно уточнить',
  'Передать сведения или инициативу'
];
const requiredRoutes = ['/tos/', '/update-tos/', '/data-quality/', '/sources/', '/partners/'];
const relatedConfigs = {
  news: { file: 'news.json', limit: 6, direction: 'desc', detailRoot: '/news/', hasOrigin: true },
  events: { file: 'events.json', limit: 6, direction: 'asc', detailRoot: '/calendar/', hasOrigin: false },
  projects: { file: 'projects.json', limit: 6, direction: 'desc', detailRoot: '/projects/', hasOrigin: true },
  done: { file: 'done.json', limit: 4, direction: 'desc', detailRoot: '/done/', hasOrigin: true },
  needs: { file: 'needs.json', limit: 6, direction: 'desc', detailRoot: '/needs/', hasOrigin: true }
};

function readJson(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${filePath}`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizePhone(value) {
  return String(value || '').replace(/[^+\d]/g, '');
}

function escapeAttribute(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function pagePathForSlug(slug) {
  return path.join(ROOT, 'tos', slug, 'index.html');
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

function isPublished(item) {
  return item && item.status !== 'draft';
}

function byDate(direction) {
  return (a, b) => direction === 'asc'
    ? String(a.date || '').localeCompare(String(b.date || ''))
    : String(b.date || '').localeCompare(String(a.date || ''));
}

function expectedRelated(items, slug, config) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => isPublished(item) && item.tos_slug === slug)
    .sort(byDate(config.direction))
    .slice(0, config.limit);
}

function extractRelatedMarkers(html) {
  return Array.from(html.matchAll(/data-related-collection="([^"]+)"\s+data-related-id="([^"]*)"\s+data-related-tos="([^"]*)"(?:\s+data-content-origin="([^"]+)")?/g), (match) => ({
    collection: match[1],
    id: match[2],
    tosSlug: match[3],
    origin: match[4] || ''
  }));
}

function auditRelatedContent(errors, line, html, slug, datasets) {
  const markers = extractRelatedMarkers(html);
  const allowedCollections = new Set(Object.keys(relatedConfigs));

  markers.forEach((marker) => {
    if (!allowedCollections.has(marker.collection)) {
      errors.push(`${line}: unknown related collection ${marker.collection}`);
    }
    if (marker.tosSlug !== slug) {
      errors.push(`${line}: related ${marker.collection}/${marker.id} belongs to ${marker.tosSlug || 'empty'}, not ${slug}`);
    }
  });

  Object.entries(relatedConfigs).forEach(([collection, config]) => {
    const expectedItems = expectedRelated(datasets[collection], slug, config);
    const actualMarkers = markers.filter((marker) => marker.collection === collection);
    const expectedIds = expectedItems.map((item) => String(item.id || ''));
    const actualIds = actualMarkers.map((marker) => marker.id);

    if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
      errors.push(`${line}: related ${collection} mismatch: expected [${expectedIds.join(', ')}], found [${actualIds.join(', ')}]`);
    }

    expectedItems.forEach((item) => {
      const id = String(item.id || '');
      if (!id) {
        errors.push(`${line}: related ${collection} item is missing id`);
        return;
      }

      const marker = actualMarkers.find((entry) => entry.id === id);
      if (!marker) return;

      if (config.hasOrigin) {
        const origin = inferContentOrigin(item, collection);
        if (marker.origin !== origin) {
          errors.push(`${line}: ${collection}/${id} origin mismatch: ${marker.origin || 'missing'} !== ${origin}`);
        }
        expectIncludes(errors, line, html, `data-related-origin-notice="${collection}:${escapeHtml(id)}"`, `missing origin notice marker for ${collection}/${id}`);
        expectIncludes(errors, line, html, escapeHtml(contentOriginLabel(origin)), `missing origin label for ${collection}/${id}`);
        expectIncludes(errors, line, html, escapeHtml(contentOriginNotice(origin, collection)), `missing origin notice for ${collection}/${id}`);
      } else if (marker.origin) {
        errors.push(`${line}: ${collection}/${id} must not invent content origin`);
      }

      if (collection === 'events') {
        expectIncludes(errors, line, html, 'href="/calendar/"', `missing calendar link for event ${id}`);
      } else {
        const route = `${config.detailRoot}${id}/`;
        if (!repoPathExists(route)) errors.push(`${line}: related detail route does not exist ${route}`);
        expectIncludes(errors, line, html, `href="${route}"`, `missing detail link for ${collection}/${id}`);
      }

      if (collection === 'needs') {
        expectIncludes(errors, line, html, `data-related-contact-policy="${escapeHtml(id)}"`, `missing contact boundary note for needs/${id}`);
      }
    });
  });
}

function main() {
  const toses = readJson(tosesPath);
  const generator = fs.readFileSync(generatorPath, 'utf8');
  const relatedPatcher = fs.readFileSync(relatedPatcherPath, 'utf8');
  const responsivePatcher = fs.readFileSync(responsivePatcherPath, 'utf8');
  const datasets = Object.fromEntries(Object.entries(relatedConfigs).map(([collection, config]) => [
    collection,
    readJson(path.join(ROOT, 'data', config.file))
  ]));
  const errors = [];

  if (!Array.isArray(toses)) {
    throw new Error('TOS detail pages audit failed:\ndata/toses.json must be an array');
  }

  if (!generator.includes("const DETAIL_TRUST_VERSION = '2026-07-12';")) {
    errors.push('generator: trust-focused version marker is missing');
  }
  if (!generator.includes("const RELATED_CONTENT_TRUST_VERSION = '2026-07-21';")) {
    errors.push('generator: related-content trust version marker is missing');
  }
  if (!generator.includes("require('./lib/content_origin')")) {
    errors.push('generator: content origin helper is missing');
  }
  if (!generator.includes('data-related-collection=') || !generator.includes('data-related-origin-notice=')) {
    errors.push('generator: related-content audit markers are missing');
  }
  if (!generator.includes('data-related-contact-policy=')) {
    errors.push('generator: related needs contact boundary marker is missing');
  }
  const needRenderer = (generator.match(/function needCard\(n\) \{[\s\S]*?\n\}\nfunction block/) || [])[0] || '';
  if (!needRenderer) {
    errors.push('generator: needCard renderer cannot be located');
  } else {
    if (/n\.contact|<b>Контакт:<\/b>/.test(needRenderer)) errors.push('generator: related need card must not render contact values');
    if (!needRenderer.includes('/needs/${esc(n.id)}/')) errors.push('generator: related need card must link to its detail page');
  }
  if (!generator.includes('/done/${esc(d.id)}/')) {
    errors.push('generator: related done card must link to its detail page');
  }
  if (!relatedPatcher.includes("const MARKER = \"const RELATED_CONTENT_TRUST_VERSION = '2026-07-21';\"")) {
    errors.push('related patcher: version marker contract is missing');
  }
  if (!relatedPatcher.includes('patchSource') || !relatedPatcher.includes('patchTosRelatedContentTrust')) {
    errors.push('related patcher: patch API is incomplete');
  }
  if (!responsivePatcher.includes("require('./patch_tos_related_content_trust')") || !responsivePatcher.includes('patchTosRelatedContentTrust();')) {
    errors.push('responsive patcher: related-content patch is not connected to generation flow');
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
  [
    "scopeBlock('territory', territoryScope)",
    "scopeBlock('contacts', contactsScope)",
    "scopeBlock('public-links', publicScope)"
  ].forEach((marker) => {
    if (!generator.includes(marker)) errors.push(`generator: missing field verification scope call ${marker}`);
  });
  ['Новости и материалы этого ТОС', 'Проекты и идеи этого ТОС', 'Результаты и запросы этого ТОС', 'Потребности и запросы этого ТОС'].forEach((heading) => {
    if (!generator.includes(heading)) errors.push(`generator: missing neutral related-content heading ${heading}`);
  });

  const publishedToses = toses.filter((tos) => tos && tos.status !== 'draft');
  publishedToses.forEach((tos, index) => {
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

    requiredSections.forEach((section) => expectIncludes(errors, line, html, section, `missing section ${section}`));
    requiredRoutes.forEach((route) => {
      if (!repoPathExists(route)) errors.push(`${line}: linked route does not exist ${route}`);
      expectIncludes(errors, line, html, `href="${route}`, `missing link to ${route}`);
    });
    requiredUpdateTypes.forEach((type) => expectIncludes(errors, line, html, `${updatePrefix}${type}#message-builder`, `missing update action for type ${type}`));
    ['territory', 'contacts', 'public-links'].forEach((name) => expectIncludes(errors, line, html, `data-verification-block="${name}"`, `missing verification marker for ${name}`));

    if (!html.includes('Статус сведений:') || !html.includes('Источник подтверждения')) errors.push(`${line}: verification status block is missing`);
    if (!html.includes('Техническая публикация карточки не подтверждает актуальность')) errors.push(`${line}: technical publication caution is missing`);
    if (!html.includes('Технически обновлено:') || !html.includes('Эта дата не является проверкой сведений')) errors.push(`${line}: technical date must be separated from factual verification`);
    if (!html.includes('Техническая заполненность полей:') || !html.includes('Это не является подтверждением актуальности')) errors.push(`${line}: technical completeness caution is missing`);
    if (!html.includes('Пришлите только данные, которые можно размещать открыто')) errors.push(`${line}: public-data safety note is missing`);
    if (html.includes('Исходные контакты из анкеты')) errors.push(`${line}: raw questionnaire contact block must not be rendered`);
    if (html.includes('<h2>Связанные разделы</h2>')) errors.push(`${line}: duplicate generic related-links section must be removed`);
    if (html.includes('<span>заполненность карточки</span>')) errors.push(`${line}: completeness must not be a passport KPI`);
    if (!html.includes('Данные страницы обновляются автоматически из JSON-файлов сайта')) errors.push(`${line}: generated-data footer note is missing`);

    const hero = extractHero(html);
    const heroLinks = Array.from(hero.matchAll(/href="([^"]+)"/g), (match) => match[1]);
    const heroButtons = (hero.match(/<button\b/g) || []).length;
    if (heroLinks.length !== 2 || heroLinks[0] !== '/tos/' || !heroLinks[1].includes('type=card#message-builder') || heroButtons !== 1) {
      errors.push(`${line}: hero must contain catalog backlink, one correction CTA and one print button`);
    }
    if (!hero.includes('type="button"')) errors.push(`${line}: print button must declare type=button`);

    (tos.phones || []).forEach((phone, phoneIndex) => {
      const normalized = normalizePhone(phone);
      if (normalized && !html.includes(`href="tel:${normalized}"`)) errors.push(`${line}: phone ${phoneIndex + 1} is missing tel link ${phone}`);
    });
    (tos.emails || []).forEach((email, emailIndex) => {
      if (email && !html.includes(`href="mailto:${email}"`)) errors.push(`${line}: email ${emailIndex + 1} is missing mailto link`);
    });
    [...(tos.chairperson_links || []), ...(tos.social_links || [])].forEach((url, urlIndex) => {
      const escapedUrl = escapeAttribute(url);
      if (url && !html.includes(`href="${escapedUrl}"`)) errors.push(`${line}: public link ${urlIndex + 1} is missing`);
    });

    if (!(tos.phones || []).length && !html.includes('Телефон уточняется')) errors.push(`${line}: missing phone placeholder`);
    if (!(tos.emails || []).length && !html.includes('Email уточняется')) errors.push(`${line}: missing email placeholder`);
    if (!(tos.chairperson_links || []).length && !html.includes('Ссылка уточняется')) errors.push(`${line}: missing chairperson link placeholder`);
    if (!(tos.social_links || []).length && !html.includes('Соцсети уточняются')) errors.push(`${line}: missing social placeholder`);

    const jsonLd = extractJsonLd(html);
    if (!jsonLd || !Array.isArray(jsonLd['@graph'])) {
      errors.push(`${line}: JSON-LD cannot be parsed`);
    } else {
      const organization = jsonLd['@graph'].find((item) => item && item['@type'] === 'Organization') || {};
      const phoneStructuredAllowed = Boolean(trust.checkedAt && trust.sourceRef && trust.scope.includes('phones') && trust.consentRef);
      const contactPoints = Array.isArray(organization.contactPoint) ? organization.contactPoint : [];
      if (!phoneStructuredAllowed && contactPoints.length) errors.push(`${line}: unverified phone must not be exposed as structured contactPoint`);
      if (phoneStructuredAllowed && (tos.phones || []).length && !contactPoints.length) errors.push(`${line}: verified phone scope with consent must be present in structured data`);

      const expectedSameAs = [
        ...(trust.checkedAt && trust.sourceRef && trust.scope.includes('chairperson') && trust.consentRef ? (tos.chairperson_links || []) : []),
        ...(trust.checkedAt && trust.sourceRef && trust.scope.includes('social_links') ? (tos.social_links || []) : [])
      ];
      const sameAs = Array.isArray(organization.sameAs) ? organization.sameAs : [];
      if (JSON.stringify(sameAs) !== JSON.stringify(expectedSameAs)) errors.push(`${line}: structured sameAs must include only verified public links`);
    }

    auditRelatedContent(errors, line, html, slug, datasets);
  });

  if (errors.length) throw new Error(`TOS detail pages audit failed:\n${errors.join('\n')}`);

  const relatedTotal = publishedToses.reduce((sum, tos) => sum + Object.entries(relatedConfigs).reduce((inner, [collection, config]) => inner + expectedRelated(datasets[collection], tos.slug, config).length, 0), 0);
  console.log(`TOS detail pages OK: ${publishedToses.length} pages, ${relatedTotal} related records checked with trust and slug boundaries`);
}

main();
