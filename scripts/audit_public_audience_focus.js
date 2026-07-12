const fs = require('fs');
const path = require('path');

const root = process.cwd();

const pages = [
  {
    label: 'residents',
    file: 'residents/index.html',
    h1: 'Как участвовать в жизни своей территории через ТОС',
    expectedHeroLinks: ['/residents/action-routes/', '/tos/'],
    requiredMarkers: ['id="resident-quick-start"', 'Жителю достаточно начать с трёх шагов', 'Прямые формы:'],
    forbiddenHeroLinks: ['/map/', '/needs/', '/done/', '/update-tos/'],
    forbiddenPageCopy: ['<h2>Что можно сделать на сайте</h2>']
  },
  {
    label: 'partners',
    file: 'partners/index.html',
    h1: 'Помочь ТОСам можно конкретным делом',
    expectedHeroLinks: ['/partners/action-routes/', '/contacts/'],
    requiredMarkers: ['id="partner-main-route"', 'Выбрать потребность', 'Уточнить детали', 'Передать помощь', 'Показать результат'],
    forbiddenHeroLinks: ['/needs/', '/projects/', '/done/', 'https://vk.ru/tosbgo'],
    forbiddenPageCopy: ['<span class="tag ok">Главный маршрут</span><h3>Как партнёру помочь ТОСам</h3>']
  },
  {
    label: 'projects',
    file: 'projects/index.html',
    h1: 'Банк идей для проектов ТОС',
    expectedHeroLinks: ['/projects/action-routes/', '#projects-list'],
    requiredMarkers: ['id="project-main-route"', 'Описать проблему', 'Обсудить с жителями', 'Собрать основу проекта', 'Выбрать способ реализации'],
    forbiddenHeroLinks: ['/grants/', '/project-passport/', '/update-tos/', '/documents/', '#project-statuses'],
    forbiddenPageCopy: ['<span class="tag ok">Главный маршрут</span><h3>Как превратить проблему в проект ТОС</h3>']
  }
];

const forbiddenServiceRoutes = [
  '/workbench/',
  '/site-health/',
  '/data-requests/',
  '/verification-tasks/',
  '/publication-queue/',
  '/collection-board/'
];

function read(relativePath) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${relativePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function extractHeroActions(html, h1) {
  const h1Marker = `<h1>${h1}</h1>`;
  const h1Index = html.indexOf(h1Marker);
  if (h1Index === -1) throw new Error(`Missing H1 marker: ${h1}`);

  const start = html.indexOf('<div class="hero-actions">', h1Index);
  if (start === -1) throw new Error(`Missing hero actions after: ${h1}`);

  const end = html.indexOf('</div>', start);
  if (end === -1) throw new Error(`Unclosed hero actions after: ${h1}`);

  return html.slice(start, end + 6);
}

function extractHrefs(html) {
  return Array.from(html.matchAll(/href="([^"]+)"/g), (match) => match[1]);
}

function main() {
  const errors = [];

  pages.forEach((page) => {
    const html = read(page.file);
    const heroActions = extractHeroActions(html, page.h1);
    const hrefs = extractHrefs(heroActions);

    if (hrefs.length !== page.expectedHeroLinks.length) {
      errors.push(`${page.label}: hero must contain exactly ${page.expectedHeroLinks.length} links, found ${hrefs.length}`);
    }

    page.expectedHeroLinks.forEach((href, index) => {
      if (hrefs[index] !== href) {
        errors.push(`${page.label}: hero link ${index + 1} must be ${href}, found ${hrefs[index] || 'missing'}`);
      }
    });

    const primaryCount = (heroActions.match(/class="btn primary"/g) || []).length;
    if (primaryCount !== 1) {
      errors.push(`${page.label}: hero must contain exactly one primary CTA, found ${primaryCount}`);
    }

    page.forbiddenHeroLinks.forEach((href) => {
      if (heroActions.includes(href)) errors.push(`${page.label}: forbidden duplicate hero route ${href}`);
    });

    page.requiredMarkers.forEach((marker) => {
      if (!html.includes(marker)) errors.push(`${page.label}: missing focused scenario marker ${marker}`);
    });

    page.forbiddenPageCopy.forEach((copy) => {
      if (html.includes(copy)) errors.push(`${page.label}: duplicate main scenario remains: ${copy}`);
    });

    forbiddenServiceRoutes.forEach((route) => {
      if (html.includes(`href="${route}`)) errors.push(`${page.label}: public audience page links to service route ${route}`);
    });
  });

  const residents = read('residents/index.html');
  if (residents.includes('href="/map/"')) {
    errors.push('residents: empty geodata map must not be promoted as a resident action');
  }

  const partners = read('partners/index.html');
  const partnerRouteSection = partners.match(/<section class="section" id="partner-main-route">[\s\S]*?<\/section>/)?.[0] || '';
  if ((partnerRouteSection.match(/class="btn/g) || []).length !== 0) {
    errors.push('partners: repeated main-route section must explain steps without duplicate buttons');
  }

  const projects = read('projects/index.html');
  const projectRouteSection = projects.match(/<section class="section" id="project-main-route">[\s\S]*?<\/section>/)?.[0] || '';
  if ((projectRouteSection.match(/class="btn/g) || []).length !== 0) {
    errors.push('projects: repeated main-route section must explain steps without duplicate buttons');
  }

  if (errors.length) {
    throw new Error(`Public audience focus audit failed:\n${errors.join('\n')}`);
  }

  console.log('Public audience focus OK: residents, partners and projects each have one focused hero scenario');
}

main();
