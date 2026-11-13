'use strict';
const {tosSlugs} = require('../../assets/js/collection-browser-core');
const {safeEditorialLinks} = require('./vk_editorial_links');
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value.split('-').reverse().join('.') : '';
function safeSource(value) {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; }
}
function tosButtons(item, toses) {
  return tosSlugs(item).map(slug => toses.find(tos => tos.slug === slug)).filter(Boolean)
    .map(tos => `<a class="btn" href="/tos/${esc(tos.slug)}/">ТОС «${esc(tos.name)}»</a>`).join('');
}
function renderExperience(item) {
  const stages = (item.milestones || []).map(stage => {
    const url = safeSource(stage.source_url);
    return `<li><b>${esc(date(stage.date))}${stage.date_kind === 'publication' ? ' · сообщение об этапе' : ''}: ${esc(stage.title)}</b><p>${esc(stage.text)}</p>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Источник${stage.source_date ? ' · ' + esc(date(stage.source_date)) : ''}</a>` : ''}</li>`;
  }).join('');
  const links = safeEditorialLinks([...(item.experience_links || []), ...(item.editorial_links || [])]);
  const unique = links.filter((link, index) => links.findIndex(other => other.href === link.href) === index);
  const sources = (item.additional_sources || []).map(source => {
    const url = safeSource(source.url);
    return url ? `<li><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)}</a>${source.published_at ? ' · ' + esc(date(source.published_at)) : ''}</li>` : '';
  }).join('');
  if (!stages && !unique.length && !sources && !item.relation_note) return '';
  return `<section class="section tight" data-content-experience><div class="container prose">${item.relation_note ? `<p class="notice">${esc(item.relation_note)}</p>` : ''}${stages ? `<h2>Как развивался проект</h2><ol>${stages}</ol><p class="tiny">Дата сообщения об этапе не подменяет дату выполнения работ.</p>` : ''}${unique.length ? `<h2>Опыт и полезные материалы</h2><ul>${unique.map(link => `<li><a href="${esc(link.href)}">${esc(link.label)}</a></li>`).join('')}</ul>` : ''}${sources ? `<h2>Дополнительные источники</h2><ul>${sources}</ul>` : ''}</div></section>`;
}
module.exports = {renderExperience, tosButtons};
