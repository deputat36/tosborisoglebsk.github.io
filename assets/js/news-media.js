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
      const img = `<img src="${escape(src)}" alt="${escape(image.alt)}"${dimensions} loading="lazy" decoding="async" referrerpolicy="no-referrer" style="display:block;width:100%;height:auto;${thumbnail ? 'max-height:280px;object-fit:contain;' : ''}border-radius:16px"/>`;
      return `<figure style="margin:0 0 20px">${thumbnail ? img : `<a href="${escape(image.full)}" target="_blank" rel="noopener noreferrer" aria-label="${escape('Открыть фотографию: ' + image.alt)}">${img}</a>`}${!thumbnail && image.caption ? `<figcaption class="tiny">${escape(image.caption)}</figcaption>` : ''}</figure>`;
    }).join('');
    const attachments = (Array.isArray(item.attachments) ? item.attachments : []).filter(a => safeUrl(a.url));
    if (thumbnail) {
      if (gallery) return gallery;
      const video = attachments.find(a => a.type === 'video' && safeUrl(a.preview));
      return video ? `<figure style="margin:0 0 20px"><img src="${escape(safeUrl(video.preview))}" alt="${escape(video.title || 'Видео к публикации')}" loading="lazy" decoding="async" referrerpolicy="no-referrer" style="display:block;width:100%;max-height:280px;object-fit:contain;border-radius:16px"/><figcaption class="tiny">Видео ВКонтакте</figcaption></figure>` : '';
    }
    return gallery + attachments.map(a => {
      const title = escape(a.title || 'Открыть материал'), url = escape(safeUrl(a.url));
      const player = a.type === 'video' ? safePlayer(a.player) : '';
      const preview = a.type === 'video' && !player && safeUrl(a.preview) ? `<img src="${escape(safeUrl(a.preview))}" alt="${title}" loading="lazy" decoding="async" referrerpolicy="no-referrer" style="display:block;width:100%;height:auto;border-radius:16px"/>` : '';
      const embed = player ? `<iframe src="${escape(player)}" title="${title}" loading="lazy" allow="fullscreen; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" style="width:100%;aspect-ratio:16/9;border:0;border-radius:16px"></iframe>` : preview;
      const label = {video:'Смотреть видео ВКонтакте',document:'Открыть документ',audio:'Слушать ВКонтакте',link:'Открыть материал'}[a.type] || 'Открыть материал';
      return `<figure style="margin:0 0 24px">${embed}<figcaption><a href="${url}" target="_blank" rel="noopener noreferrer">${escape(label)}: ${title}</a></figcaption></figure>`;
    }).join('');
  }
  function renderReposts(item) {
    return (Array.isArray(item.reposts) ? item.reposts : []).filter(part => safeUrl(part.source_url)).map(part => `<blockquote class="news-repost"><p class="tiny"><b>Репост</b>${part.date ? ' · '+escape(part.date) : ''} · <a href="${escape(safeUrl(part.source_url))}" target="_blank" rel="noopener noreferrer">Исходная публикация ВКонтакте</a></p>${(Array.isArray(part.text) ? part.text : []).map(p => `<p>${escape(p)}</p>`).join('')}</blockquote>`).join('');
  }
  return {safeUrl,safePlayer,images,render,renderReposts};
});
