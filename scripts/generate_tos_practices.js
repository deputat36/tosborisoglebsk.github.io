'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {applyEditorialLinks} = require('./lib/vk_editorial_links');
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const date = value => value.split('-').reverse().join('.');
const read = name => JSON.parse(fs.readFileSync('data/' + name + '.json', 'utf8'));
const list = rows => `<ul>${rows.map(row => `<li>${esc(row)}</li>`).join('')}</ul>`;
function main() {
  const news = read('news');
  const enriched = applyEditorialLinks(news);
  if (JSON.stringify(news) !== JSON.stringify(enriched)) fs.writeFileSync('data/news.json', JSON.stringify(enriched, null, 2) + '\n');
  const data = read('tos_practices'), toses = read('toses');
  const name = slug => toses.find(tos => tos.slug === slug)?.name || slug;
  const cards = data.practices.map(item => `<article class="practice-card" id="${esc(item.id)}" data-practice data-topic="${esc(item.theme)}" data-toses="${esc(item.tos_slugs.join(' '))}"><div class="meta"><span class="tag">${esc(item.theme)}</span><span class="tiny">Примеры: ${esc(item.tos_slugs.map(name).join(', '))}</span></div><h2>${esc(item.title)}</h2><p>${esc(item.lead)}</p><details><summary>Как повторить: ресурсы и шаги</summary><div class="practice-guide"><h3>Что понадобится</h3>${list(item.resources)}<h3>Порядок действий</h3><ol>${item.steps.map(step => `<li>${esc(step)}</li>`).join('')}</ol><h3>Что учесть</h3>${list(item.check)}<h3>Как проверить результат</h3><p>${esc(item.measure)}</p>${item.tools.length ? `<h3>Рабочие материалы</h3><ul>${item.tools.map(link => `<li><a href="${esc(link.href)}">${esc(link.label)}</a></li>`).join('')}</ul>` : ''}</div></details><div class="practice-examples"><h3>Местные примеры</h3>${item.examples.map(example => `<p><a href="${esc(example.href)}">${esc(example.title)}</a><br><span class="tiny">${esc(example.role)} Источник от ${esc(date(example.source_date))}: <a href="${esc(example.source_url)}" target="_blank" rel="noopener noreferrer">исходная публикация</a>.</span></p>`).join('')}<div class="card-actions">${item.tos_slugs.map(slug => `<a class="chip" href="/tos/${esc(slug)}/">ТОС «${esc(name(slug))}»</a>`).join('')}</div></div></article>`).join('');
  const topics = [...new Set(data.practices.map(item => item.theme))].sort((a,b) => a.localeCompare(b,'ru'));
  const slugs = [...new Set(data.practices.flatMap(item => item.tos_slugs))].sort((a,b) => name(a).localeCompare(name(b),'ru'));
  const filters = `<div class="practice-filters" data-practice-controls hidden><div><label for="practice-search">Найти задачу</label><input id="practice-search" type="search" placeholder="Например, дорога, дайджест, наставник"/></div><div><label for="practice-topic">Тема</label><select id="practice-topic"><option value="">Все темы</option>${topics.map(topic => `<option>${esc(topic)}</option>`).join('')}</select></div><div><label for="practice-tos">Где есть пример</label><select id="practice-tos"><option value="">Все ТОС и территории</option>${slugs.map(slug => `<option value="${esc(slug)}">${esc(name(slug))}</option>`).join('')}</select></div><button class="btn" type="button" id="practice-reset">Сбросить</button></div><p class="tiny" role="status" aria-live="polite" id="practice-status">${data.practices.length} практик с местными примерами.</p>`;
  const title = 'Опыт ТОСов: как повторить | ТОС БГО';
  const description = 'Практики ТОСов Борисоглебского округа: реальные примеры, необходимые ресурсы, шаги и проверка результата. Дороги, экология, соседи и местные новости.';
  // Reuse the maintained public shell; no parallel navigation or new registration.
  let html = fs.readFileSync('projects/action-routes/index.html', 'utf8');
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
    .replace(/(<meta (?:name="description"|property="og:description") content=")[^"]*/g, '$1' + description)
    .replace(/(<meta property="og:title" content=")[^"]*/, '$1' + title)
    .replace(/https:\/\/tosborisoglebsk\.ru\/projects\/action-routes\//g, 'https://tosborisoglebsk.ru/projects/practices/')
    .replace(/<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/g, '')
    .replace(/<script\b[^>]*src="[^"]+"[^>]*>\s*<\/script>/g, '')
    .replace('</head>', '<link rel="stylesheet" href="/assets/css/tos-practices.css"/></head>');
  const body = `<main id="main" class="tos-practices"><section class="hero"><div class="container hero-card"><a class="chip" href="/projects/">← Банк проектов и идей</a><div class="eyebrow">Люди. Территории. Развитие.</div><h1>Опыт ТОСов: как повторить</h1><p class="lead">Выберите задачу, посмотрите местные примеры и составьте свой следующий шаг.</p><div class="hero-actions"><a class="btn primary" href="#practice-list">Выбрать практику</a><a class="btn" href="/materials/">Все материалы</a><a class="btn" href="/update-tos/?type=news#message-builder">Поделиться опытом</a></div></div></section><section class="section"><div class="container"><p class="notice">Инструкции подготовлены редакцией по открытым публикациям. Примеры различают работу ТОС и жизнь территории: ДК, школа или жители могут быть самостоятельными организаторами. Условия применения и ресурсы каждой новой инициативы проверяются отдельно.</p>${filters}<div class="practice-grid" id="practice-list">${cards}</div><p class="notice" data-practice-empty hidden>Подходящей практики пока не найдено. Измените запрос или сбросьте фильтры.</p><p class="tiny">Тексты и связи источников сверены ${date(data.checked_at)}. Расписания и объявления из архивных новостей не становятся действующими автоматически.</p></div></section></main>`;
  html = html.replace(/<main\b[^>]*>[\s\S]*?<\/main>/, () => body)
    .replace('</body>', '<script src="/assets/js/site.js" defer></script><script src="/assets/js/collection-browser-core.js" defer></script><script src="/assets/js/tos-practices.js" defer></script></body>');
  fs.mkdirSync('projects/practices', {recursive:true});
  fs.writeFileSync('projects/practices/index.html', html);
  const index = 'projects/index.html';
  let projectIndex = fs.readFileSync(index, 'utf8');
  const begin = '<!-- tos-practices:start -->', end = '<!-- tos-practices:end -->';
  const entry = `${begin}<section class="section tight"><div class="container notice"><h2>Опыт ТОСов: как повторить</h2><p>Реальные местные примеры, ресурсы и шаги для ${data.practices.length} практик: от общего дорожного дела до молодёжной редакции.</p><a class="btn primary" href="/projects/practices/">Выбрать практику</a></div></section>${end}`;
  projectIndex = projectIndex.includes(begin) ? projectIndex.replace(new RegExp(begin + '[\\s\\S]*?' + end), () => entry) : projectIndex.replace('</main>', entry + '</main>');
  fs.writeFileSync(index, projectIndex);
  console.log(`TOS practices: ${data.practices.length}; reviewed VK relationships: ${read('vk_editorial_links').entries.length}`);
}
if (require.main === module) main();
module.exports = {main};
