(function () {
  const mount = document.getElementById('articles-list');

  if (!mount) return;

  const materialsEsc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));

  const isExternal = (url) => /^https?:\/\//.test(url || '');

  const renderTags = (tags) => {
    if (!Array.isArray(tags) || !tags.length) return '';
    return `<div class="card-actions">${tags.map((tag) => `<span class="tag">${materialsEsc(tag)}</span>`).join('')}</div>`;
  };

  const renderMaterial = (item) => {
    const url = item.url || '#';
    const target = isExternal(url) ? ' target="_blank" rel="noopener"' : '';

    return `<article class="card"><div class="card-inner"><span class="tag">${materialsEsc(item.category)}</span><h3>${materialsEsc(item.title)}</h3><p>${materialsEsc(item.description)}</p><div class="tiny">Для кого: ${materialsEsc(item.audience)}</div>${renderTags(item.tags)}<div class="card-actions"><a class="btn primary" href="${materialsEsc(url)}"${target}>Открыть материал</a></div></div></article>`;
  };

  fetch('/data/materials.json')
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((items) => {
      const materials = Array.isArray(items) ? items.filter((item) => item.status !== 'draft') : [];

      if (!materials.length) {
        mount.innerHTML = '<div class="empty">Материалы пока не добавлены.</div>';
        return;
      }

      mount.classList.remove('list');
      mount.classList.add('grid');
      mount.innerHTML = materials.map(renderMaterial).join('');
    })
    .catch(() => {
      mount.innerHTML = '<div class="empty">Раздел не загрузился. Проверьте файл data/materials.json.</div>';
    });
}());
