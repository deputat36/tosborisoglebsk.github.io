const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const filePath = path.join(process.cwd(), 'open-data', 'index.html');
const requiredDataTargets = new Set([
  '/data/toses.json',
  '/data/news.json',
  '/data/projects.json',
  '/data/needs.json',
  '/data/done.json',
  '/data/site_health.json',
  '/data/page_index.json',
  '/rss.xml',
  '/sitemap.xml'
]);

function main() {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }

  const html = fs.readFileSync(filePath, 'utf8');
  const errors = [];
  const hrefs = Array.from(html.matchAll(/href="([^"]+)"/g)).map((match) => match[1]);
  const dataTargets = hrefs.filter((href) => (
    href.startsWith('/data/') || href === '/rss.xml' || href === '/sitemap.xml'
  ));
  const uniqueTargets = new Set(dataTargets);

  if (!dataTargets.length) {
    errors.push('open-data page must link to data files');
  }

  requiredDataTargets.forEach((target) => {
    if (!uniqueTargets.has(target)) {
      errors.push(`missing required open data target ${target}`);
    }
  });

  uniqueTargets.forEach((target) => {
    const isSupported = /\.(csv|json|xml)$/.test(target);
    if (!isSupported) {
      errors.push(`unsupported open data target extension ${target}`);
    }
    if (!repoPathExists(target)) {
      errors.push(`missing open data target ${target}`);
    }
  });

  if (!html.includes('Открытые данные портала ТОС БГО')) {
    errors.push('open-data page must keep the public catalog title');
  }

  if (!html.includes('Рабочий статус не означает подтверждение факта')) {
    errors.push('open-data page must keep the working-status caveat');
  }

  if (errors.length) {
    throw new Error(`Open data links audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Open data links OK: ${uniqueTargets.size} data targets`);
}

main();