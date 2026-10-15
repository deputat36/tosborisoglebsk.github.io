'use strict';
const LABELS = Object.freeze({completed:'Результат', award:'Конкурс', historical:'История', reported:'Архивный обзор', participation:'Участие', territory:'Жизнь территории'});
function esc(value) { return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
function date(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value.split('-').reverse().join('.') : String(value || 'Дата не указана'); }
function sourceLink(source) {
  let href; try { const url = new URL(source.url); if (url.protocol !== 'https:') return ''; href = url.href; } catch { return ''; }
  const published = source.published_at ? date(source.published_at) : source.date_note || 'Дата публикации не установлена';
  return `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer" aria-label="Источник: ${esc(source.title)}. ${esc(source.publisher)}, ${esc(published)}">${esc(source.publisher)} · ${esc(published)}<span aria-hidden="true"> ↗</span></a>`;
}
function renderTosProfile(tos, dataset) {
  const profile = dataset?.profiles?.find(row => row.tos_slug === tos.slug);
  if (!profile) return '';
  const sourceMap = new Map((dataset.sources || []).map(source => [source.id,source]));
  const facts = profile.facts || [];
  const cards = facts.map(fact => `<article class="tos-profile-fact" data-profile-fact="${esc(fact.id)}"><div class="meta"><span class="tag">${esc(fact.period)}</span><span class="tiny">${esc(LABELS[fact.kind] || 'Публикация')}</span></div><h3>${esc(fact.title)}</h3><p>${esc(fact.text)}</p><div class="tos-profile-sources">${fact.source_ids.map(id => sourceMap.get(id)).filter(Boolean).map(sourceLink).join(' ')}</div></article>`).join('');
  return `<section class="section tos-profile" id="tos-profile" data-tos-profile="${esc(tos.slug)}"><div class="container"><div class="section-head"><div><h2>История и дела ТОС</h2><p>${facts.length ? 'Что удалось подтвердить по открытым публикациям.' : 'Открытых сведений пока недостаточно для истории проектов.'}</p></div><a class="btn" href="/update-tos/?tos=${encodeURIComponent(tos.slug)}&amp;type=news#message-builder">Дополнить историю</a></div>${profile.topics.length ? `<div class="meta tos-profile-topics">${profile.topics.map(topic => `<span class="tag">${esc(topic)}</span>`).join('')}</div>` : ''}<p class="tiny">Источники сверены ${esc(date(profile.checked_at))}. Сведения относятся к указанным годам; состояние объектов и действующие контакты требуют отдельной проверки.</p>${cards ? `<div class="tos-profile-grid">${cards}</div>` : '<div class="notice">Независимые публикации о конкретных проектах пока не найдены. Поиск публикаций не позволяет оценить деятельность ТОС. Помогите добавить датированный отчёт и ссылку на открытый источник.</div>'}<details class="tos-profile-clarifications"><summary>Что осталось уточнить</summary><ul>${profile.clarifications.map(note => `<li>${esc(note)}</li>`).join('')}</ul><p class="tiny">Архивные источники не меняют автоматически статус проверки паспорта. Для фотографий и документов также необходимо право на публикацию.</p><a class="btn" href="/update-tos/?tos=${encodeURIComponent(tos.slug)}&amp;type=card#message-builder">Передать уточнение</a></details></div></section>`;
}
module.exports = { renderTosProfile, LABELS };
