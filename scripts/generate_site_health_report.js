const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SITE_URL = 'https://tosborisoglebsk.ru';
const OUT = path.join(ROOT, 'data', 'site_health.json');
const SKIP_DIRS = new Set(['.git', '.github', 'node_modules', 'scripts', '_private', 'admin']);
const TECHNICAL_PREFIXES = ['audit/'];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function readJson(relativePath, fallback = null) {
  const file = path.join(ROOT, relativePath);
  if (!fs.existsSync(file)) return fallback;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function getTitle(html) {
  return (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '';
}

function getMeta(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const reName = new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']*)["']`, 'i');
  const reProp = new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']*)["']`, 'i');
  return (html.match(reName) || html.match(reProp) || [])[1] || '';
}

function getCanonical(html) {
  return (html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) || [])[1] || '';
}

function isNoindex(html) {
  return /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html);
}

function isExternal(url) {
  return /^(https?:|mailto:|tel:|tg:|whatsapp:|javascript:)/i.test(url);
}

function parseInternalHref(raw) {
  const href = String(raw || '').trim().replace(/&amp;/g, '&');
  const hashIndex = href.indexOf('#');
  const beforeHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const anchor = hashIndex >= 0 ? href.slice(hashIndex + 1) : '';
  return {
    href,
    pathPart: beforeHash.split('?')[0],
    anchor: anchor.split('?')[0]
  };
}

function fileForUrl(url, currentFile = null) {
  if (!url) return currentFile;
  if (url === '/') {
    const index = path.join(ROOT, 'index.html');
    return fs.existsSync(index) ? index : null;
  }

  let decoded;
  try { decoded = decodeURIComponent(url); }
  catch { return null; }

  const safe = decoded.replace(/^\/+/, '');
  if (!safe || safe.includes('..')) return null;

  const full = path.join(ROOT, safe);
  if (decoded.endsWith('/')) {
    const index = path.join(full, 'index.html');
    return fs.existsSync(index) ? index : null;
  }
  if (fs.existsSync(full)) return full;
  const index = path.join(full, 'index.html');
  return fs.existsSync(index) ? index : null;
}

function fileExistsForUrl(url, currentFile = null) {
  return Boolean(fileForUrl(url, currentFile));
}

function extractAnchors(html) {
  const anchors = new Set(['']);
  for (const match of html.matchAll(/\sid=["']([^"']+)["']/gi)) anchors.add(match[1]);
  for (const match of html.matchAll(/\sname=["']([^"']+)["']/gi)) anchors.add(match[1]);
  return anchors;
}

function targetHasAnchor(url, anchor, currentFile, currentAnchors) {
  if (!anchor) return true;
  const targetFile = fileForUrl(url, currentFile);
  if (!targetFile || !targetFile.endsWith('.html')) return false;
  if (targetFile === currentFile) return currentAnchors.has(anchor);
  try {
    return extractAnchors(fs.readFileSync(targetFile, 'utf8')).has(anchor);
  } catch {
    return false;
  }
}

function urlFor(relative) {
  if (relative === 'index.html') return `${SITE_URL}/`;
  if (relative.endsWith('/index.html')) return `${SITE_URL}/${relative.replace(/index\.html$/, '')}`;
  return `${SITE_URL}/${relative}`;
}

function auditPages() {
  const htmlFiles = walk(ROOT).filter((file) => file.endsWith('.html'));
  const pages = [];
  const seoWarnings = [];
  const linkErrors = [];
  let publicPages = 0;
  let noindexPages = 0;

  for (const file of htmlFiles) {
    const relative = rel(file);
    const html = fs.readFileSync(file, 'utf8');
    const anchors = extractAnchors(html);
    const technical = TECHNICAL_PREFIXES.some((prefix) => relative.startsWith(prefix));
    const noindex = isNoindex(html) || technical;
    if (noindex) noindexPages += 1;
    else publicPages += 1;

    const title = getTitle(html).trim();
    const description = getMeta(html, 'description').trim();
    const canonical = getCanonical(html).trim();
    const ogTitle = getMeta(html, 'og:title').trim();
    const ogDescription = getMeta(html, 'og:description').trim();
    const ogImage = getMeta(html, 'og:image').trim();
    const h1Count = (html.match(/<h1[\s>]/gi) || []).length;

    const pageWarnings = [];
    if (!noindex) {
      if (!title) pageWarnings.push('нет title');
      else if (title.length < 18) pageWarnings.push(`короткий title: ${title.length}`);
      else if (title.length > 90) pageWarnings.push(`длинный title: ${title.length}`);
      if (!description) pageWarnings.push('нет meta description');
      else if (description.length < 70) pageWarnings.push(`короткий description: ${description.length}`);
      else if (description.length > 220) pageWarnings.push(`длинный description: ${description.length}`);
      if (!canonical) pageWarnings.push('нет canonical');
      else if (!canonical.startsWith(SITE_URL)) pageWarnings.push('canonical не на основном домене');
      if (!ogTitle) pageWarnings.push('нет og:title');
      if (!ogDescription) pageWarnings.push('нет og:description');
      if (!ogImage) pageWarnings.push('нет og:image');
      if (h1Count !== 1) pageWarnings.push(`h1: ${h1Count}`);
    }

    const matches = [...html.matchAll(/\s(?:href|src)=["']([^"']+)["']/gi)];
    for (const match of matches) {
      const raw = match[1];
      const parsed = parseInternalHref(raw);
      if (!parsed.href || parsed.href.startsWith('//') || parsed.href.startsWith('data:') || isExternal(parsed.href)) continue;
      if (parsed.href.startsWith('#')) {
        if (!targetHasAnchor('', parsed.anchor, file, anchors)) linkErrors.push({ page: relative, link: raw, reason: 'нет якоря на текущей странице' });
        continue;
      }
      if (!parsed.href.startsWith('/')) continue;
      if (!fileExistsForUrl(parsed.pathPart, file)) {
        linkErrors.push({ page: relative, link: raw, reason: 'нет страницы или файла' });
        continue;
      }
      if (!targetHasAnchor(parsed.pathPart, parsed.anchor, file, anchors)) {
        linkErrors.push({ page: relative, link: raw, reason: 'нет указанного якоря' });
      }
    }

    if (pageWarnings.length) {
      seoWarnings.push({ page: relative, url: canonical || urlFor(relative), warnings: pageWarnings });
    }

    pages.push({ path: relative, url: canonical || urlFor(relative), title, noindex, h1_count: h1Count, warnings: pageWarnings });
  }

  return { totalPages: htmlFiles.length, publicPages, noindexPages, seoWarnings, linkErrors, pages };
}

function buildScoreBreakdown(summary, pageAudit) {
  const highPriorityPenalty = (summary.high_priority || 0) * 3;
  const reviewPenalty = (summary.needs_review_count || 0) * 4;
  const phonePenalty = (summary.without_phone || 0) * 2;
  const seoPenalty = Math.min(pageAudit.seoWarnings.length, 20);
  const linkPenalty = Math.min(pageAudit.linkErrors.length * 5, 30);

  return {
    base: 100,
    penalties: {
      high_priority_tos: highPriorityPenalty,
      needs_review_tos: reviewPenalty,
      missing_public_phone: phonePenalty,
      seo_warnings: seoPenalty,
      broken_internal_links: linkPenalty
    },
    note: 'Оценка отражает не красоту сайта, а управляемость: доверие к данным, наличие контактов, SEO и внутренние ссылки.'
  };
}

function buildFindings(summary, pageAudit) {
  const findings = [];
  findings.push({ level: 'good', area: 'Техническая база', finding: `Собрано ${pageAudit.totalPages} HTML-страниц, из них ${pageAudit.publicPages} публичных и ${pageAudit.noindexPages} служебных.` });
  findings.push({ level: pageAudit.linkErrors.length ? 'risk' : 'good', area: 'Внутренние ссылки', finding: pageAudit.linkErrors.length ? `Найдено внутренних проблем со ссылками: ${pageAudit.linkErrors.length}.` : 'Битых внутренних ссылок в текущем отчёте не найдено.' });
  findings.push({ level: pageAudit.seoWarnings.length ? 'risk' : 'good', area: 'SEO-основа', finding: pageAudit.seoWarnings.length ? `Найдено SEO-предупреждений: ${pageAudit.seoWarnings.length}.` : 'Базовые SEO-предупреждения в публичных HTML-страницах не найдены.' });
  findings.push({ level: 'risk', area: 'Доверие к данным', finding: `Подтверждённых карточек ТОС: ${summary.verified_count || 0}. Высокий приоритет проверки: ${summary.high_priority || 0}.` });
  findings.push({ level: (summary.without_phone || 0) ? 'risk' : 'good', area: 'Контакты', finding: (summary.without_phone || 0) ? `Карточек без публичного телефона: ${summary.without_phone}.` : 'Все карточки имеют публичный телефон или контактный сценарий.' });
  findings.push({ level: 'next', area: 'Контент', finding: 'Следующий рост сайта — не в количестве страниц, а в замене стартовых заготовок на подтверждённые новости, проекты, результаты, фото и источники.' });
  return findings;
}

function buildActions(siteAudit, pageAudit) {
  const actions = [];
  const summary = siteAudit?.summary || {};

  if (summary.high_priority) actions.push(`Закрыть ${summary.high_priority} карточки ТОС с высоким приоритетом: контакты, соцсети, источники, логотипы.`);
  if (summary.verified_count === 0) actions.push('Повысить доверие к каталогу: выбрать 3-5 карточек и довести их до статуса «подтверждено».');
  if (summary.without_phone) actions.push(`Уточнить телефоны или публичные контакты для ${summary.without_phone} карточек.`);
  if (summary.without_social) actions.push(`Добавить открытые страницы или сообщества для ${summary.without_social} карточек, если они существуют.`);
  if (pageAudit.linkErrors.length) actions.push(`Исправить ${pageAudit.linkErrors.length} внутренних ссылок, которые ведут на несуществующие страницы или якоря.`);
  if (pageAudit.seoWarnings.length) actions.push(`Просмотреть ${pageAudit.seoWarnings.length} страниц с SEO-предупреждениями.`);
  actions.push('Продолжить превращать рабочие заготовки в подтверждённые новости, проекты и фотоотчёты.');
  actions.push('Подключить реальные фото территорий и логотипы ТОСов по мере поступления от председателей.');

  return actions;
}

function buildSelfWorkPlan(summary, pageAudit) {
  return [
    {
      stage: 'Технический контроль',
      owner: 'assistant',
      status: pageAudit.linkErrors.length || pageAudit.seoWarnings.length ? 'active' : 'stable',
      actions: [
        'поддерживать нулевой уровень битых внутренних ссылок',
        'держать SEO-аудит без ошибок title, description, canonical, og и h1',
        'расширять отчёт site_health.json после каждого крупного изменения'
      ]
    },
    {
      stage: 'Пользовательские маршруты',
      owner: 'assistant',
      status: 'active',
      actions: [
        'упрощать входы для жителей, председателей, партнёров и редактора',
        'связывать рабочие страницы между собой короткими понятными ссылками',
        'выносить повторяющиеся ручные действия в чек-листы и CSV'
      ]
    },
    {
      stage: 'Контент без выдумывания фактов',
      owner: 'assistant',
      status: 'active',
      actions: [
        'усиливать тексты на основе уже имеющихся подтверждённых данных',
        'делать черновики запросов, новостей, карточек и проектных паспортов',
        'помечать неподтверждённые сведения как требующие проверки'
      ]
    },
    {
      stage: 'Доверие к каталогу',
      owner: 'mixed',
      status: (summary.verified_count || 0) === 0 ? 'blocked_by_confirmation' : 'active',
      actions: [
        'не публиковать новые контакты без источника или разрешения',
        'готовить карточки к подтверждению через evidence/readiness-процедуру',
        'переводить карточки в verified только после реального подтверждения'
      ]
    }
  ];
}

function buildBlockedActions(summary) {
  const blocked = [];
  if (summary.verified_count === 0) blocked.push('Нельзя переводить карточки ТОС в verified без подтверждённых источников и разрешения на публикацию.');
  if (summary.high_priority) blocked.push('Нельзя заполнять телефоны, email, соцсети и логотипы приоритетных ТОСов предположениями.');
  blocked.push('Нельзя утверждать реализацию проектов, если подтверждён только конкурсный результат или проектная заявка.');
  blocked.push('Нельзя использовать реальные фото и логотипы без понятного права на публикацию.');
  return blocked;
}

function main() {
  const siteAudit = readJson('data/site_audit.json', {});
  const contentAudit = readJson('data/tos_content_audit.json', {});
  const pageAudit = auditPages();
  const summary = siteAudit.summary || contentAudit.summary || {};
  const scoreBreakdown = buildScoreBreakdown(summary, pageAudit);
  const totalPenalty = Object.values(scoreBreakdown.penalties).reduce((sum, value) => sum + value, 0);
  const healthScore = Math.max(0, Math.min(100, scoreBreakdown.base - totalPenalty));

  const report = {
    generated_at: new Date().toISOString(),
    site_url: SITE_URL,
    health_score: healthScore,
    score_breakdown: scoreBreakdown,
    audit_scope: [
      'структура HTML-страниц',
      'meta title, description, canonical, Open Graph и h1',
      'внутренние ссылки и якоря',
      'состояние каталога ТОС',
      'заполненность контактов, соцсетей, логотипов и статусов проверки',
      'приоритеты автономной работы и блокировки по неподтверждённым данным'
    ],
    catalog: summary,
    pages: {
      total: pageAudit.totalPages,
      public: pageAudit.publicPages,
      noindex: pageAudit.noindexPages,
      seo_warnings_count: pageAudit.seoWarnings.length,
      broken_internal_links_count: pageAudit.linkErrors.length
    },
    priority_tos: (contentAudit.items || []).filter((item) => item.priority === 'Высокий').map((item) => ({
      slug: item.slug,
      name: item.name,
      location: item.location,
      score: item.score,
      missing: item.missing,
      verification: item.verification?.label || item.verification?.status || ''
    })),
    findings: buildFindings(summary, pageAudit),
    seo_warnings: pageAudit.seoWarnings.slice(0, 50),
    broken_internal_links: pageAudit.linkErrors.slice(0, 50),
    recommended_actions: buildActions(siteAudit, pageAudit),
    self_work_plan: buildSelfWorkPlan(summary, pageAudit),
    blocked_actions: buildBlockedActions(summary)
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Generated site health report: score ${healthScore}, pages ${pageAudit.totalPages}.`);
}

main();
