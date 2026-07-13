const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const PAGE_PATH = path.join(ROOT, 'data-requests', 'priority-tos', 'index.html');
const SITE_SCRIPT = '<script src="/assets/js/site.js"></script>';
const READINESS_SCRIPT = '<script src="/assets/js/priority-tos-readiness.js"></script>';
const READINESS_ID = 'priority-tos-readiness';
const READINESS_PLACEHOLDER = `

  <section class="section" id="${READINESS_ID}" aria-labelledby="priority-tos-readiness-title">
    <div class="container section-head"><div><h2 id="priority-tos-readiness-title">Готовность карточек к обновлению</h2><p>Автоматическая сводка трекера отправки и разбора ответов без публикации контактов и закрытой переписки</p></div><a class="btn" href="/data/priority_tos_update_readiness.json">Открыть JSON</a></div>
    <div class="container"><div class="notice">Загрузка сводки готовности...</div></div>
  </section>`;

function insertReadinessPlaceholder(html) {
  if (html.includes(`id="${READINESS_ID}"`)) return html;

  const heroStart = html.indexOf('<section class="hero"');
  const heroEnd = heroStart >= 0 ? html.indexOf('</section>', heroStart) : -1;
  if (heroStart < 0 || heroEnd < 0) {
    throw new Error('Priority TOS page is missing the hero section marker');
  }

  const insertAt = heroEnd + '</section>'.length;
  return `${html.slice(0, insertAt)}${READINESS_PLACEHOLDER}${html.slice(insertAt)}`;
}

function connectReadinessScript(html) {
  if (html.includes(READINESS_SCRIPT)) return html;
  if (!html.includes(SITE_SCRIPT)) {
    throw new Error('Priority TOS page is missing the site.js script marker');
  }
  return html.replace(SITE_SCRIPT, `${SITE_SCRIPT}\n${READINESS_SCRIPT}`);
}

function main() {
  if (!fs.existsSync(PAGE_PATH)) throw new Error(`Missing page: ${PAGE_PATH}`);

  const html = fs.readFileSync(PAGE_PATH, 'utf8');
  const updated = connectReadinessScript(insertReadinessPlaceholder(html));

  if (updated === html) {
    console.log('Priority TOS readiness page already connected with a static anchor');
    return;
  }

  fs.writeFileSync(PAGE_PATH, updated, 'utf8');
  console.log('Priority TOS readiness page connected with a static anchor');
}

main();
