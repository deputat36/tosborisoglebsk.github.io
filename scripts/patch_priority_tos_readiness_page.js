const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const PAGE_PATH = path.join(ROOT, 'data-requests', 'priority-tos', 'index.html');
const SITE_SCRIPT = '<script src="/assets/js/site.js"></script>';
const READINESS_SCRIPT = '<script src="/assets/js/priority-tos-readiness.js"></script>';

function main() {
  if (!fs.existsSync(PAGE_PATH)) throw new Error(`Missing page: ${PAGE_PATH}`);

  const html = fs.readFileSync(PAGE_PATH, 'utf8');
  if (html.includes(READINESS_SCRIPT)) {
    console.log('Priority TOS readiness page already connected');
    return;
  }
  if (!html.includes(SITE_SCRIPT)) {
    throw new Error('Priority TOS page is missing the site.js script marker');
  }

  const updated = html.replace(SITE_SCRIPT, `${SITE_SCRIPT}\n${READINESS_SCRIPT}`);
  fs.writeFileSync(PAGE_PATH, updated, 'utf8');
  console.log('Priority TOS readiness client connected to existing request page');
}

main();
