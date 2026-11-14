(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TosNewsMedia = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function safeUrl(value) {
    if (typeof value !== 'string') return '';
    const url = value.trim();
    if (!url || /[\u0000-\u0020\\]/.test(url)) return '';
    if (url.startsWith('/') && !url.startsWith('//') && !url.includes('..')) return url;
    try { const parsed = new URL(url); return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? parsed.href : ''; } catch (_) { return ''; }
  }
  function safePlayer(value) {
    const safe = safeUrl(value);
    try { const url = new URL(safe); return ['vk.com','www.vk.com','vkvideo.ru','www.vkvideo.ru'].includes(url.hostname) && url.pathname === '/video_ext.php' ? url.href : ''; }
    catch (_) { return ''; }
  }
  function escape(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
  function unavailableText(value) {
    return /^(?:post deleted|this post (?:was|has been) deleted|запись удалена)[.!]?$/i.test(String(value || '').trim());
  }
  function presentation(item) {
    if (!item || item.imported_from !== 'vk') return item;
    const parts = Array.isArray(item.reposts) ? item.reposts : [];
    const reposts = parts.map(part => ({...part,
      unavailable: Boolean(part.unavailable || (Array.isArray(part.text) ? part.text : []).some(unavailableText)),
      text: (Array.isArray(part.text) ? part.text : []).filter(value => !unavailableText(value))
    }));
    const text = (Array.isArray(item.text) ? item.text : [item.text]).filter(value => value && !unavailableText(value));
    const unavailable = Boolean(item.source_unavailable || unavailableText(item.title) || reposts.some(part => part.unavailable));
    const ownText = text.filter(value => !/^(Репост публикации ВКонтакте\.|Материалы опубликованы в сообществе ТОС БГО\.)$/.test(value));
    const onlyUnavailable = unavailable && !ownText.length && !reposts.some(part => part.text.length) && !images(item).length && !(item.attachments || []).length;
    return {...item, text, reposts, source_unavailable:unavailable, unavailable_only:onlyUnavailable,
      title: (onlyUnavailable || unavailableText(item.title)) ? 'Исходная публикация недоступна' : item.title,
      lead: (onlyUnavailable || unavailableText(item.title)) ? 'В архиве сохранён репост сообщества. Текст исходной публикации сейчас недоступен; доступные сведения можно уточнить по ссылке ВКонтакте.' : item.lead
    };
  }
  function searchMetadata(item) {
    const view=presentation(item);
    const trim=(value,max)=>{const text=String(value||'').replace(/\s+/g,' ').trim();return text.length>max?text.slice(0,max-1).replace(/[\uD800-\uDBFF]$/,'').trim()+'…':text;};
    if(view.imported_from!=='vk')return {title:view.title,description:view.lead};
    const stamp=` · ${String(view.date||'').split('-').reverse().join('.')} · №${view.vk_post_id||String(view.id||'').split('-').pop()}`;
    return {title:trim(view.title,77-stamp.length)+stamp,description:trim(`Запись ВКонтакте${stamp}. ${view.lead||''}`,170)};
  }
  function images(item) {
    // Prefer structured entries (size, preview and original); legacy string URLs still work.
    const values = [...(Array.isArray(item.images) ? item.images : []),item.image];
    const seen = new Set();
    return values.map(value => {
      const object = value && typeof value === 'object' ? value : {src: value};
      const src = safeUrl(object.src || object.url);
      if (!src || seen.has(src)) return null;
      seen.add(src);
      const dimension = value => Number.isInteger(value) && value>0 && value<50000 ? value : 0;
      return {src,thumbnail:safeUrl(object.thumbnail) || src,full:safeUrl(object.full) || src,width:dimension(object.width),height:dimension(object.height),alt:String(object.alt || item.image_alt || item.title || 'Фотография к публикации'),caption:String(object.caption || '')};
    }).filter(Boolean);
  }
  function render(item, thumbnail = false) {
    const photos = images(item);
    const gallery = photos.slice(0,thumbnail ? 1 : undefined).map(image => {
      const src = thumbnail ? image.thumbnail : image.src;
      const dimensions = !thumbnail && image.width && image.height ? ` width="${image.width}" height="${image.height}"` : '';
      const img = `<img src="${escape(src)}" alt="${escape(image.alt)}"${dimensions} loading="lazy" decoding="async" referrerpolicy="no-referrer" class="news-media-image${thumbnail ? ' news-media-thumbnail' : ''}"/>`;
      return `<figure class="news-media-figure">${thumbnail ? img : `<a href="${escape(image.full)}" target="_blank" rel="noopener noreferrer" aria-label="${escape('Открыть фотографию: ' + image.alt)}">${img}</a>`}${!thumbnail && image.caption ? `<figcaption class="tiny">${escape(image.caption)}</figcaption>` : ''}</figure>`;
    }).join('');
    const attachments = (Array.isArray(item.attachments) ? item.attachments : []).filter(a => safeUrl(a.url));
    if (thumbnail) {
      if (gallery) return gallery;
      const video = attachments.find(a => a.type === 'video' && safeUrl(a.preview));
      return video ? `<figure class="news-media-figure"><img src="${escape(safeUrl(video.preview))}" alt="${escape(video.title || 'Видео к публикации')}" loading="lazy" decoding="async" referrerpolicy="no-referrer" class="news-media-image news-media-thumbnail"/><figcaption class="tiny">Видео ВКонтакте</figcaption></figure>` : '';
    }
    return (gallery ? `<div class="news-media-gallery${photos.length===1 ? ' news-media-single' : ''}">${gallery}</div>` : '') + attachments.map(a => {
      const title = escape(a.title || 'Открыть материал'), url = escape(safeUrl(a.url));
      const player = a.type === 'video' ? safePlayer(a.player) : '';
      const preview = a.type === 'video' && !player && safeUrl(a.preview) ? `<img src="${escape(safeUrl(a.preview))}" alt="${title}" loading="lazy" decoding="async" referrerpolicy="no-referrer" class="news-media-image"/>` : '';
      const embed = player ? `<iframe src="${escape(player)}" title="${title}" loading="lazy" allow="fullscreen; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" class="news-media-player"></iframe>` : preview;
      const label = {video:'Смотреть видео ВКонтакте',document:'Открыть документ',audio:'Слушать ВКонтакте',link:'Открыть материал'}[a.type] || 'Открыть материал';
      return `<figure class="news-media-figure">${embed}<figcaption><a href="${url}" target="_blank" rel="noopener noreferrer">${escape(label)}: ${title}</a></figcaption></figure>`;
    }).join('');
  }
  function renderReposts(item) {
    const view = presentation(item);
    return (Array.isArray(view.reposts) ? view.reposts : []).filter(part => safeUrl(part.source_url)).map(part => `<blockquote class="news-repost"><p class="tiny"><b>Репост</b>${part.date ? ' · '+escape(part.date) : ''} · <a href="${escape(safeUrl(part.source_url))}" target="_blank" rel="noopener noreferrer">Исходная публикация ВКонтакте</a></p>${part.unavailable ? '<p class="notice">Текст исходной публикации недоступен. Сохранены ссылка и доступные материалы репоста.</p>' : ''}${(Array.isArray(part.text) ? part.text : []).map(p => `<p>${escape(p)}</p>`).join('')}</blockquote>`).join('');
  }
  return {safeUrl,safePlayer,images,render,renderReposts,unavailableText,presentation,searchMetadata};
});
