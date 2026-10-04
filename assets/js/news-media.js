(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TosNewsMedia = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function safeUrl(value) {
    if (typeof value !== 'string') return '';
    const url = value.trim();
    if (!url || /[\u0000-\u0020\\]/.test(url)) return '';
    if (url.startsWith('/') && !url.startsWith('//') && !url.includes('..')) return url;
    try { const parsed = new URL(url); return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? parsed.href : ''; } catch (_) { return ''; }
  }
  function images(item) {
    const values = [item.image, ...(Array.isArray(item.images) ? item.images : [])];
    const seen = new Set();
    return values.map(value => {
      const object = value && typeof value === 'object' ? value : {src: value};
      const src = safeUrl(object.src || object.url);
      if (!src || seen.has(src)) return null;
      seen.add(src);
      return {src, alt: String(object.alt || item.image_alt || item.title || 'Фотография к публикации'), caption: String(object.caption || '')};
    }).filter(Boolean).slice(0, 8);
  }
  function escape(value) { return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
  function render(item, thumbnail = false) {
    return images(item).slice(0, thumbnail ? 1 : 8).map(image => `<figure style="margin:0 0 20px"><img src="${escape(image.src)}" alt="${escape(image.alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" style="display:block;width:100%;height:auto;${thumbnail ? 'max-height:280px;object-fit:contain;' : ''}border-radius:16px"/>${!thumbnail && image.caption ? `<figcaption class="tiny">${escape(image.caption)}</figcaption>` : ''}</figure>`).join('');
  }
  return {safeUrl, images, render};
});
