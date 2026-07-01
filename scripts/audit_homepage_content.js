const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const homePath = path.join(process.cwd(), 'index.html');
const tosesPath = path.join(process.cwd(), 'data', 'toses.json');
const navigationPatchPath = path.join(process.cwd(), 'scripts', 'patch_site_navigation.js');

const requiredRoutes = [
  '/',
  '/tos/',
  '/residents/',
  '/partners/',
  '/projects/',
  '/done/',
  '/needs/',
  '/documents/',
  '/contacts/',
  '/sections/',
  '/search/',
  '/action-routes/',
  '/update-tos/',
  '/materials/',
  '/calendar/',
  '/editorial-policy/'
];

const requiredPublicNavRoutes = [
  '/tos/',
  '/places/',
  '/action-routes/',
  '/residents/',
  '/chairperson/',
  '/projects/',
  '/done/',
  '/needs/',
  '/documents/',
  '/contacts/',
  '/sections/'
];

const serviceRoutesOutsidePublicNav = [
  '/workbench/',
  '/data-requests/',
  '/source-watch/',
  '/content-discovery/'
];

const requiredDynamicBlocks = [
  ['home-featured-tos', '/assets/js/home-featured-tos.js'],
  ['home-stats', '/assets/js/home-stats.js'],
  ['home-done', '/assets/js/home-done.js'],
  ['home-news', '/assets/js/home-news.js'],
  ['home-projects', '/assets/js/home-projects.js'],
  ['home-needs', '/assets/js/home-needs.js'],
  ['home-materials', '/assets/js/home-materials.js'],
  ['home-events', '/assets/js/home-events.js']
];

const requiredCopy = [
  'Кому полезен портал',
  'Как работает портал',
  'Куда перейти в первую очередь',
  'Активная территория',
  'ТОС БГО в цифрах',
  'Популярные действия',
  'Сделано ТОСами',
  'Последние новости',
  'Проекты и поддержка территорий',
  'ТОСам нужна помощь',
  'Полезные материалы и документы',
  'Ближайшие события и дедлайны',
  'Связь и отправка материалов'
];

function textMatch(content, pattern) {
  const match = content.match(pattern);
  return match ? match[1].trim() : '';
}

function main() {
  if (!fs.existsSync(homePath)) {
    throw new Error(`Missing file: ${homePath}`);
  }

  if (!fs.existsSync(tosesPath)) {
    throw new Error(`Missing file: ${tosesPath}`);
  }

  if (!fs.existsSync(navigationPatchPath)) {
    throw new Error(`Missing file: ${navigationPatchPath}`);
  }

  const html = fs.readFileSync(homePath, 'utf8');
  const toses = JSON.parse(fs.readFileSync(tosesPath, 'utf8'));
  const navigationPatch = fs.readFileSync(navigationPatchPath, 'utf8');
  const errors = [];

  const title = textMatch(html, /<title>([^<]+)<\/title>/i);
  const description = textMatch(html, /<meta\s+name="description"\s+content="([^"]+)"\s*\/>/i);
  const h1 = textMatch(html, /<h1>([^<]+)<\/h1>/i);
  const compactNavBlock = textMatch(navigationPatch, /const compactNavBlock = `([\s\S]*?)`;\n\nconst footerHtml/);

  if (!title.includes('ТОС') || !title.includes('Борисоглеб')) {
    errors.push('title must identify the TOS BGO portal');
  }

  if (description.length < 120 || !description.includes('каталог') || !description.includes('проекты')) {
    errors.push('meta description must describe catalog and project content');
  }

  if (!html.includes('<link rel="canonical" href="https://tosborisoglebsk.ru/"')) {
    errors.push('missing canonical link for homepage');
  }

  if (!h1.includes('ТОСы БГО')) {
    errors.push('h1 must name TOS BGO');
  }

  requiredRoutes.forEach((route) => {
    if (!repoPathExists(route)) {
      errors.push(`homepage route target is missing: ${route}`);
    }
  });

  requiredCopy.forEach((copy) => {
    if (!html.includes(copy)) {
      errors.push(`homepage is missing copy block: ${copy}`);
    }
  });

  requiredPublicNavRoutes.forEach((route) => {
    if (!compactNavBlock.includes(route)) {
      errors.push(`public navigation is missing route: ${route}`);
    }
  });

  serviceRoutesOutsidePublicNav.forEach((route) => {
    if (compactNavBlock.includes(route)) {
      errors.push(`service route must not be in public navigation: ${route}`);
    }
  });

  if (!navigationPatch.includes('/workbench/')) {
    errors.push('workbench route must remain available outside public navigation');
  }

  requiredDynamicBlocks.forEach(([blockId, scriptPath]) => {
    if (!html.includes(`id="${blockId}"`)) {
      errors.push(`missing dynamic block #${blockId}`);
    }

    if (!html.includes(`src="${scriptPath}"`)) {
      errors.push(`missing dynamic block script ${scriptPath}`);
    }

    if (!repoPathExists(scriptPath)) {
      errors.push(`dynamic block script file is missing: ${scriptPath}`);
    }
  });

  if (!html.includes('data-action="menu"') || !html.includes('aria-controls="site-nav"')) {
    errors.push('mobile menu control must target site navigation');
  }

  if (!html.includes('data-action="theme"')) {
    errors.push('theme toggle is missing');
  }

  const heroCount = Number(textMatch(html, /<div class="proof-card big"><b>(\d+)<\/b><span>ТОСа в каталоге<\/span>/));
  if (!Number.isInteger(heroCount) || heroCount !== toses.length) {
    errors.push(`homepage TOS count must match data/toses.json: ${heroCount} !== ${toses.length}`);
  }

  if (!html.includes('следующий этап работы') || !html.includes('довести каталог до полного состава')) {
    errors.push('homepage must disclose that the TOS catalog is not complete yet');
  }

  if (!html.includes('/update-tos/?type=news#message-builder')) {
    errors.push('homepage must provide a news submission CTA');
  }

  if (!html.includes('https://vk.ru/tosbgo')) {
    errors.push('homepage must link to the public VK community');
  }

  if (errors.length) {
    throw new Error(`Homepage content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Homepage content OK');
}

main();
