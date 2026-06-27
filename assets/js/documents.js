(function () {
  const mount = document.getElementById('documents-list');

  if (!mount) return;

  const documentsEsc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));

  const normalizeUrl = (url) => {
    if (!url) return '#';
    if (/^https?:\/\//.test(url)) return url;
    if (url.startsWith('/')) return url;
    return `/${url}`;
  };

  const isExternal = (url) => /^https?:\/\//.test(url || '');

  const renderDocument = (item) => {
    const url = normalizeUrl(item.url);
    const target = isExternal(url) ? ' target="_blank" rel="noopener"' : '';
    const attention = item.attention ? `<div class="notice"><b>Внимание:</b> ${documentsEsc(item.attention)}</div>` : '';

    return `<article class="card"><div class="card-inner"><span class="tag">${documentsEsc(item.type)}</span><h3>${documentsEsc(item.title)}</h3><p>${documentsEsc(item.description)}</p><div class="tiny">Статус: ${documentsEsc(item.status)}</div><div class="tiny">Для чего: ${documentsEsc(item.use_for)}</div>${attention}<div class="card-actions"><a class="btn primary" href="${documentsEsc(url)}"${target}>Открыть</a><span class="tag">${documentsEsc(item.date)}</span></div></div></article>`;
  };

  fetch('/data/documents.json')
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((items) => {
      const documents = Array.isArray(items) ? items : [];

      if (!documents.length) {
        mount.innerHTML = '<div class="empty">Документы пока не добавлены.</div>';
        return;
      }

      mount.classList.remove('list');
      mount.classList.add('grid');
      mount.innerHTML = documents.map(renderDocument).join('');
    })
    .catch(() => {
      mount.innerHTML = '<div class="empty">Список документов не загрузился. Проверьте файл data/documents.json.</div>';
    });
}());
