(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./tos-catalog-core.js') : root.TosCatalogCore);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ResidentAreaCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (catalog) {
  'use strict';
  const HELP = ['all', 'time', 'materials', 'information'];
  const publicItem = item => Boolean(item) && !['draft', 'archived', 'archive', 'deleted'].includes(item.status);
  const validSlug = value => /^[a-z0-9][a-z0-9-]{0,99}$/.test(String(value || ''));
  const normalize = value => catalog.normalize(value);
  function safeUrl(value) {
    try { const url = new URL(String(value || '')); return url.protocol === 'https:' ? url.href : ''; }
    catch { return ''; }
  }
  function checkedDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return '';
    const stamp = Date.parse(value + 'T12:00:00Z');
    return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === value ? value : '';
  }
  function today(now = new Date()) {
    return new Intl.DateTimeFormat('sv-SE', {timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date(now));
  }
  function formatDate(value) {
    return checkedDate(value) ? new Intl.DateTimeFormat('ru-RU', {timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric'}).format(new Date(value + 'T12:00:00Z')) : 'Дата не указана';
  }
  function findArea(rows, slug) {
    return validSlug(slug) ? rows.find(item => publicItem(item) && item.slug === slug) || null : null;
  }
  function searchAreas(rows, query) {
    const words = normalize(query).split(' ').filter(word => word && word !== 'тос');
    return rows.filter(publicItem).filter(item => {
      const text = normalize([item.name, item.location, item.boundaries].join(' '));
      return words.every(word => text.includes(word));
    }).sort((a, b) => String(a.name).localeCompare(String(b.name), 'ru'));
  }
  function sourceUrl(item) { return safeUrl(item.source_url) || safeUrl(item.source); }
  function recentSourceCheck(item, now = new Date()) {
    const checked = checkedDate(item.source_checked_at || '');
    const age = checked ? (Date.parse(today(now)) - Date.parse(checked)) / 86400000 : Infinity;
    return Boolean(sourceUrl(item)) && age >= 0 && age <= 30;
  }
  function contentLink(collection, item) {
    return validSlug(item.id) ? '/' + collection + '/' + item.id + '/' : '';
  }
  function helpKind(item) {
    const text = normalize([item.need_type, item.title].join(' '));
    if (/фото|информац|контент|архив|карточ|данны|соцсет|новост/.test(text)) return 'information';
    if (/материал|сажен|озелен|инструмент|транспорт/.test(text)) return 'materials';
    if (/волонтер|субботник|времен|участи|помощ/.test(text)) return 'time';
    return 'other';
  }
  function needState(item, now = new Date()) {
    if (item.content_origin === 'request') return 'request';
    if (['editorial', 'starter'].includes(item.content_origin)) return 'idea';
    const until = checkedDate(item.valid_until || item.deadline || '');
    if (until && until < today(now)) return 'expired';
    const checked = checkedDate(item.source_checked_at || item.checked_at || '');
    const age = checked ? (Date.parse(today(now)) - Date.parse(checked)) / 86400000 : Infinity;
    return item.content_origin === 'verified' && sourceUrl(item) && age >= 0 && age <= 30 ? 'current' : 'check';
  }
  function overview(data, slug = '', now = new Date(), help = 'all') {
    const area = findArea(data.toses || [], slug);
    const match = item => !area || item.tos_slug === area.slug;
    const recent = (a, b) => String(b.date || '').localeCompare(String(a.date || ''));
    const hasFact = item => publicItem(item) && validSlug(item.id) && item.content_origin === 'verified' && sourceUrl(item) && checkedDate(item.date) && item.date <= today(now);
    const results = (data.done || []).filter(hasFact).filter(match).sort(recent);
    const news = (data.news || []).filter(hasFact).filter(match).sort(recent);
    const actualProjects = (data.projects || []).filter(item => publicItem(item) && item.content_origin === 'verified' && sourceUrl(item)).filter(match);
    const events = (data.events || []).filter(item => publicItem(item) && validSlug(item.id) && !['request', 'starter', 'editorial'].includes(item.content_origin) && recentSourceCheck(item, now) && checkedDate(item.date) && item.date >= today(now)).sort((a, b) => a.date.localeCompare(b.date));
    const needs = (data.needs || []).filter(publicItem).filter(item => validSlug(item.id)).filter(item => !area || !item.tos_slug || match(item)).filter(item => help === 'all' || helpKind(item) === help);
    return {
      area, results, news, projects: actualProjects,
      localEvents: area ? events.filter(item => match(item)) : [],
      commonEvents: events.filter(item => !item.tos_slug),
      needs: needs.filter(item => !['request', 'idea', 'expired'].includes(needState(item, now))),
      ideas: needs.filter(item => needState(item, now) === 'idea' && !item.tos_slug),
      requests: needs.filter(item => needState(item, now) === 'request'),
      date: today(now)
    };
  }
  function areaUrl(slug = '', help = 'all') {
    const params = new URLSearchParams();
    if (validSlug(slug)) params.set('tos', slug);
    if (HELP.includes(help) && help !== 'all') params.set('help', help);
    return '/residents/my-area/' + (params.size ? '?' + params.toString() : '');
  }
  function escapeIcal(value) {
    return String(value || '').replace(/\r\n|\r/g, '\n').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  }
  // Fold by UTF-8 octets, without splitting Cyrillic or surrogate pairs.
  function foldLine(line) {
    const result = []; let part = '', size = 0;
    for (const char of line) {
      const bytes = new TextEncoder().encode(char).length;
      if (size + bytes > 75) { result.push(part); part = ' '; size = 1; }
      part += char; size += bytes;
    }
    result.push(part); return result.join('\r\n');
  }
  function eventCalendar(item, now = new Date()) {
    if (!item || !publicItem(item) || !validSlug(item.id) || !checkedDate(item.date) || !sourceUrl(item)) throw new Error('У события нет проверяемой даты или источника.');
    const following = new Date(item.date + 'T12:00:00Z'); following.setUTCDate(following.getUTCDate() + 1);
    const description = [item.description, item.time ? 'Время из объявления: ' + item.time : 'Время в объявлении не указано.', 'Перед участием уточните условия у организатора.', 'Источник: ' + sourceUrl(item)].filter(Boolean).join('\n');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TOS BGO//Resident calendar//RU', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', 'UID:' + item.id + '@tosborisoglebsk.ru', 'DTSTAMP:' + new Date(now).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z'), 'DTSTART;VALUE=DATE:' + item.date.replace(/-/g, ''), 'DTEND;VALUE=DATE:' + following.toISOString().slice(0, 10).replace(/-/g, ''), 'SUMMARY:' + escapeIcal(item.title), 'DESCRIPTION:' + escapeIcal(description), 'LOCATION:' + escapeIcal(item.place), 'URL:' + sourceUrl(item), 'TRANSP:TRANSPARENT', 'END:VEVENT', 'END:VCALENDAR'];
    return lines.map(foldLine).join('\r\n') + '\r\n';
  }
  return {HELP, publicItem, validSlug, safeUrl, checkedDate, today, formatDate, findArea, searchAreas, sourceUrl, recentSourceCheck, contentLink, helpKind, needState, overview, areaUrl, escapeIcal, foldLine, eventCalendar};
});
