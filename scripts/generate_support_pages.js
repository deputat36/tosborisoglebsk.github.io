const {renderExperience} = require('./lib/content_experience');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { grantCard, grantSummary, grantsPublished } = require('../assets/js/grants');
const core = require('../assets/js/grants-core');
const root = process.cwd();
const site = 'https://tosborisoglebsk.ru';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
function safeUrl(value) {
  try { return new URL(value).protocol === 'https:' ? String(value) : ''; } catch { return ''; }
}
function external(label, href) {
  const url = safeUrl(href);
  assert(url, `Invalid source URL: ${href}`);
  return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
}
function route(org) { assert(/^[a-z0-9-]+$/.test(org.slug)); return `/grants/${org.slug}/`; }
function compact(value) { const s = String(value).replace(/\s+/g,' ').trim(); return s.length > 155 ? s.slice(0,151).replace(/\s+\S*$/,'')+'…' : s; }
function contacts(org) {
  return org.contacts.map(c => {
    assert(/^(https:\/\/|mailto:[^\s<>]+$|tel:\+[0-9]+$)/.test(c.href));
    return `<li><b>${esc(c.label)}:</b> <a href="${esc(c.href)}"${c.href.startsWith('https:')?' target="_blank" rel="noopener noreferrer"':''}>${esc(c.text)}</a></li>`;
  }).join('');
}
function makePage(org, orgs, header, footer) {
  const canonical = site + route(org);
  const titles = {
    'obraz-budushchego':'«Образ Будущего»: программы и гранты для ТОС',
    'sovet-municipalnyh-obrazovaniy':'Совет муниципальных образований: поддержка ТОС',
    'budushchee-borisoglebska':'«Будущее Борисоглебска»: фонд и конкурс инициатив'
  };
  const title = `${titles[org.id]} | ТОС БГО`;
  const blocks = org.sections.map(s => `<h2>${esc(s.title)}</h2>${s.paragraphs.map(p=>`<p>${esc(p)}</p>`).join('')}${s.items.length?`<ul>${s.items.map(i=>`<li>${esc(i)}</li>`).join('')}</ul>`:''}`).join('');
  const programs = org.programs.map(p=>`<article class="card"><div class="card-inner"><h3>${esc(p.name)}</h3><p><b>Поддержка:</b> ${esc(p.amount)}</p><p><b>Заявитель:</b> ${esc(p.who)}</p><p><b>Период:</b> ${esc(p.period)}</p><p>${esc(p.state)}</p>${external('Условия и источник',p.url)}</div></article>`).join('');
  const sources = org.sources.map(s=>`<li>${external(s.title,s.url)}${s.note?`<p class="tiny">${esc(s.note)}</p>`:''}</li>`).join('');
  const others = orgs.filter(o=>o.id!==org.id).map(o=>`<a class="btn" href="${route(o)}">${esc(o.name)}</a>`).join('');
  const legal = org.legal ? `<details><summary>Полное наименование и проверка организации</summary><p>${esc(org.legal.name)}</p><p>ИНН ${esc(org.legal.inn)} · ОГРН ${esc(org.legal.ogrn)}</p><p>${external('Источник сведений',org.legal.url)}</p></details>` : '';
  const schema=JSON.stringify({'@context':'https://schema.org','@type':'Article',headline:org.name,description:compact(org.lead),mainEntityOfPage:canonical,author:{'@type':'Organization',name:'Портал ТОС БГО'},about:{'@type':'Organization',name:org.name,url:org.website}}).replace(/</g,'\\u003c');
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(title)}</title><meta name="description" content="${esc(compact(org.lead))}"/><meta name="theme-color" content="#2f7d5a"/><link rel="canonical" href="${canonical}"/><meta property="og:title" content="${esc(title)}"/><meta property="og:description" content="${esc(compact(org.lead))}"/><meta property="og:type" content="article"/><meta property="og:url" content="${canonical}"/><meta property="og:image" content="${site}/assets/img/og-cover.svg"/><link rel="icon" href="/favicon.svg" type="image/svg+xml"/><link rel="manifest" href="/site.webmanifest"/><link rel="stylesheet" href="/assets/css/styles.css"/><link rel="stylesheet" href="/assets/css/design-upgrades.css"/><script type="application/ld+json">${schema}</script></head><body><a class="skip-link" href="#main">Перейти к содержимому</a>${header}<main id="main"><section class="hero"><div class="container hero-card"><a class="chip" href="/grants/#support-organizations">← Организации поддержки</a><div class="eyebrow">${esc(org.kind)}</div><h1>${esc(org.name)}</h1><p class="lead">${esc(org.lead)}</p></div></section><section class="section tight"><div class="container notice"><b>Текущая информация:</b> ${esc(org.current)}<p class="tiny">Редакционная справка портала. Сведения сверены <time datetime="${org.checked_at}">${org.checked_at}</time>. Допуск заявителя и условия определяет организатор.</p></div></section><section class="section"><div class="container prose">${blocks}</div></section><section class="section" aria-labelledby="programs-title"><div class="container section-head"><div><h2 id="programs-title">Программы и форматы поддержки</h2><p>Суммы и даты относятся к названному сезону. Они не объявляют правила следующего конкурса.</p></div></div><div class="container grid">${programs}</div></section><section class="section"><div class="container prose"><h2>Контакты и подача</h2><p>${external(org.website_label,org.website)}</p><ul>${contacts(org)}</ul><p>Обращение на портале ТОС БГО не отправляет заявку в эту организацию. Пользуйтесь способом из актуального объявления.</p>${legal}<h2>Что подготовить на нашем сайте</h2><div class="card-actions"><a class="btn" href="/project-passport/">Паспорт проекта</a><a class="btn" href="/documents/templates/project-budget/">Смета проекта</a><a class="btn" href="/grant-application-kit/">Комплект заявки</a><a class="btn" href="/meeting-kit/">Обсуждение с жителями</a></div>${renderExperience(org)}<h2>Источники и границы проверки</h2><p>Первичные страницы организаций и датированные публикации приведены отдельно. Если документ не прочитан, его условия не объявляются проверенными.</p><ul>${sources}</ul><h2>Сравнить с другими организациями</h2><div class="card-actions">${others}<a class="btn" href="/grants/#support-organizations">Общее сравнение</a></div></div></section></main>${footer}<script src="/assets/js/site.js"></script></body></html>\n`;
}
function replaceBlock(html, key, body) {
  const start=`<!-- support:${key}:start -->`, end=`<!-- support:${key}:end -->`;
  const a=html.indexOf(start), b=html.indexOf(end);
  assert(a>=0&&b>a,`Missing generated support block: ${key}`);
  return html.slice(0,a+start.length)+body+html.slice(b);
}
function main() {
  const orgs=read('data/support_organizations.json');
  assert.equal(new Set(orgs.map(o=>o.id)).size,orgs.length);
  const allGrants=read('data/grants.json');
  const projectTitles=new Map(read('data/projects.json').map(project=>[project.id,project.title]));
  allGrants.forEach(item=>{
    item.project_labels=Object.fromEntries((item.project_links||[]).filter(id=>projectTitles.has(id)).map(id=>[id,projectTitles.get(id)]));
  });
  fs.writeFileSync(path.join(root,'data/grants.json'),JSON.stringify(allGrants,null,2)+'\n');
  const grants=allGrants.filter(grantsPublished);
  const file=path.join(root,'grants/index.html');let html=fs.readFileSync(file,'utf8');
  const header=html.slice(html.indexOf('<header'),html.indexOf('</header>')+9);
  const footer=html.slice(html.indexOf('<footer'),html.indexOf('</footer>')+9);
  for(const org of orgs) {
    assert(org.sources.length&&/^\d{4}-\d{2}-\d{2}$/.test(org.checked_at));
    const target=path.join(root,'grants',org.slug,'index.html');fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,makePage(org,orgs,header,footer)
      .replace('<main id="main">','<main id="main" class="support-profile">')
      .replace('<script type="application/ld+json">','<link rel="stylesheet" href="/assets/css/support-organizations.css"/><script type="application/ld+json">'));
  }
  const cards=orgs.map(o=>`<article class="card"><div class="card-inner"><div class="meta"><span class="tag">${esc(o.kind)}</span></div><h3>${esc(o.name)}</h3><p>${esc(o.summary)}</p><p><b>Кому подходит:</b> ${esc(o.who)}</p><a class="btn primary" href="${route(o)}">Программы, контакты и подготовка</a></div></article>`).join('');
  const table=`<div class="container prose"><h3>Какой маршрут выбрать</h3><div style="overflow-x:auto" tabindex="0" role="region" aria-label="Сравнение организаций поддержки"><table><thead><tr><th>Задача команды</th><th>Куда смотреть</th><th>Что проверить</th></tr></thead><tbody><tr><td>Благоустройство или новый объект</td><td>Основной конкурс ТОС: «Образ Будущего» и Совет муниципальных образований</td><td>Новый сезон, право на участок, согласования и расходы</td></tr><tr><td>Социальное, культурное или волонтёрское дело</td><td>Соответствующая программа «Образа Будущего»; местный конкурс фонда</td><td>Статус заявителя, допустимые расходы и сроки</td></tr><tr><td>Представить проведённое мероприятие</td><td>Акция или конкурс практик Совета и других организаторов</td><td>Подтверждённый результат, публикация и формат поощрения</td></tr></tbody></table></div><p class="tiny">Участие в акции с призами, консультация и денежный грант — разные виды поддержки. Выбирайте по задаче и действующему положению.</p></div>`;
  html=replaceBlock(html,'organizations',`<section class="section" id="support-organizations" aria-labelledby="support-organizations-title"><div class="container section-head"><div><h2 id="support-organizations-title">Грантодатели и организации поддержки ТОС</h2><p>Три подробные справки: программы, контакты, ограничения и подготовка. Сверка 11 ноября 2026 года.</p></div></div><div class="container grid">${cards}</div>${table}</section>`);
  const snapshot='<p class="tiny" data-grants-snapshot>Подборка подготовлена 11 ноября 2026 года. Перед подачей сверяйте дату и изменения в объявлении организатора.</p>';
  html=replaceBlock(html,'current',snapshot+(core.current(grants).map(grantSummary).join('')||'<div class="notice">Ближайших сроков с недавно проверенными объявлениями нет. Ниже доступны направления поддержки и ссылки для подготовки.</div>'));
  html=replaceBlock(html,'all',snapshot+grants.map(grantCard).join(''));
  fs.writeFileSync(file,html.replace(/[ \t]+$/gm,''));
  console.log(`Support pages: ${orgs.length} organizations; ${grants.length} static opportunity cards`);
}
if(require.main===module)main();
module.exports={makePage,replaceBlock};
