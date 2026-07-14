const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const homePath = path.join(process.cwd(), 'index.html');
const tosesPath = path.join(process.cwd(), 'data', 'toses.json');
const navigationPatchPath = path.join(process.cwd(), 'scripts', 'patch_site_navigation.js');
const homeStatsScriptPath = path.join(process.cwd(), 'assets', 'js', 'home-stats.js');

const requiredRoutes = [
  '/',
  '/tos/',
  '/residents/',
  '/residents/action-routes/',
  '/chairperson/',
  '/partners/',
  '/projects/',
  '/done/',
  '/needs/',
  '/documents/',
  '/legal/',
  '/contacts/',
  '/sections/',
  '/search/',
  '/update-tos/',
  '/calendar/',
  '/data-quality/',
  '/data-update/',
  '/sources/',
  '/editorial-policy/'
];

const requiredPublicNavRoutes = [
  '/tos/',
  '/residents/',
  '/chairperson/',
  '/projects/',
  '/documents/',
  '/contacts/',
  '/sections/'
];

const serviceRoutesOutsidePublicNav = [
  '/workbench/',
  '/data-requests/',
  '/source-watch/',
  '/content-discovery/',
  '/campaign/',
  '/field-checklist/'
];

const requiredDynamicBlocks = [
  ['home-stats', '/assets/js/home-stats.js']
];

const forbiddenDynamicBlocks = [
  ['home-featured-tos', '/assets/js/home-featured-tos.js'],
  ['home-done', '/assets/js/home-done.js'],
  ['home-news', '/assets/js/home-news.js'],
  ['home-projects', '/assets/js/home-projects.js'],
  ['home-needs', '/assets/js/home-needs.js'],
  ['home-materials', '/assets/js/home-materials.js'],
  ['home-events', '/assets/js/home-events.js']
];

const requiredCopy = [
  'Что можно сделать на портале',
  'Состояние каталога',
  'Для жителей, председателей и партнёров',
  'Документы, проекты и помощь',
  'Связь и исправления'
];

const forbiddenShowcaseCopy = [
  'Активная территория',
  'Сделано ТОСами',
  'Новые идеи проектов',
  'ТОСам нужна помощь',
  'Ближайшие события и дедлайны'
];

function textMatch(content, pattern) {
  const match = content.match(pattern);
  return match ? match[1].trim() : '';
}

function countMatches(content, pattern) {
  return (content.match(pattern) || []).length;
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

  if (!fs.existsSync(homeStatsScriptPath)) {
    throw new Error(`Missing file: ${homeStatsScriptPath}`);
  }

  const html = fs.readFileSync(homePath, 'utf8');
  const toses = JSON.parse(fs.readFileSync(tosesPath, 'utf8'));
  const navigationPatch = fs.readFileSync(navigationPatchPath, 'utf8');
  const homeStatsScript = fs.readFileSync(homeStatsScriptPath, 'utf8');
  const errors = [];

  const title = textMatch(html, /<title>([^<]+)<\/title>/i);
  const description = textMatch(html, /<meta\s+name="description"\s+content="([^"]+)"\s*\/>/i);
  const h1 = textMatch(html, /<h1>([^<]+)<\/h1>/i);
  const compactNavBlock = textMatch(navigationPatch, /const compactNavBlock = `([\s\S]*?)`;\n\nconst footerHtml/);
  const footerBlock = textMatch(navigationPatch, /const footerHtml = `([\s\S]*?)`;\n\nconst homeBlock/);

  if (!title.includes('ТОС') || !title.includes('БГО')) {
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
      errors.push(`homepage is missing primary copy block: ${copy}`);
    }
  });

  forbiddenShowcaseCopy.forEach((copy) => {
    if (html.includes(copy)) {
      errors.push(`homepage must not foreground unverified showcase block: ${copy}`);
    }
  });

  requiredPublicNavRoutes.forEach((route) => {
    if (!compactNavBlock.includes(route)) {
      errors.push(`public navigation is missing route: ${route}`);
    }
  });

  const compactNavLinkCount = countMatches(compactNavBlock, /^\s*\['\//gm);
  if (compactNavLinkCount !== 7) {
    errors.push(`public navigation must contain exactly 7 links, found ${compactNavLinkCount}`);
  }

  serviceRoutesOutsidePublicNav.forEach((route) => {
    if (compactNavBlock.includes(route)) {
      errors.push(`service route must not be in public navigation: ${route}`);
    }
  });

  if (!footerBlock.includes('/workbench/')) {
    errors.push('workbench route must remain available only as the editorial panel link');
  }

  ['/data-requests/', '/source-watch/', '/content-discovery/', '/campaign/', '/field-checklist/'].forEach((route) => {
    if (footerBlock.includes(route)) {
      errors.push(`individual editorial tool must not be exposed in public footer: ${route}`);
    }
  });

  requiredDynamicBlocks.forEach(([blockId, scriptPath]) => {
    if (!html.includes(`id="${blockId}"`)) {
      errors.push(`missing factual dynamic block #${blockId}`);
    }
    if (!html.includes(`src="${scriptPath}"`)) {
      errors.push(`missing factual dynamic block script ${scriptPath}`);
    }
    if (!repoPathExists(scriptPath)) {
      errors.push(`dynamic block script file is missing: ${scriptPath}`);
    }
  });

  forbiddenDynamicBlocks.forEach(([blockId, scriptPath]) => {
    if (html.includes(`id="${blockId}"`) || html.includes(`src="${scriptPath}"`)) {
      errors.push(`homepage must not contain unverified showcase dynamic block: ${blockId}`);
    }
  });

  if (!homeStatsScript.includes('stats.map(([label,value,hint])')) {
    errors.push('homepage statistics must destructure rows as label, value, hint');
  }

  if (!homeStatsScript.includes('<b>${esc(value)}</b><span>${esc(label)}</span>')) {
    errors.push('homepage statistics must render the value in b and the label in span');
  }

  if (homeStatsScript.includes('stats.map(([value,label,hint])')) {
    errors.push('homepage statistics must not swap labels and values');
  }

  const primaryActions = countMatches(html, /data-home-primary-action/g);
  if (primaryActions !== 5) {
    errors.push(`homepage must contain exactly 5 primary user actions, found ${primaryActions}`);
  }

  if (!html.includes('data-portal-working-status')) {
    errors.push('homepage must retain the working-version status');
  }

  if (html.includes('href="/map/"')) {
    errors.push('empty map must not be a primary homepage route');
  }

  if (!navigationPatch.includes('Дополнительный программный блок не вставляется')) {
    errors.push('navigation patch must keep the extra homepage status injection disabled');
  }

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

  if (!html.includes('довести каталог до полного состава') || !html.includes('Дата изменения файла не считается датой фактической проверки')) {
    errors.push('homepage must explain catalog incompleteness and evidence-based verification');
  }

  if (!html.includes('/update-tos/?type=news#message-builder')) {
    errors.push('homepage must provide a material submission CTA');
  }

  if (!html.includes('https://vk.ru/tosbgo')) {
    errors.push('homepage must link to the public VK community');
  }

  if (errors.length) {
    throw new Error(`Homepage content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Simplified homepage content OK');
}

main();
