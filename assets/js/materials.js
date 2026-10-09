(function () {
  const mount = document.getElementById('articles-list');

  if (!mount) return;

  const renderMaterial = window.TosMaterials.render;

  fetch('/data/materials.json')
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((items) => {
      if (!Array.isArray(items)) throw new Error('Invalid materials response');
      const materials = items.filter((item) => item.status !== 'draft');

      if (!materials.length) {
        mount.innerHTML = '<div class="empty">Материалы пока не добавлены.</div>';
        return;
      }

      mount.classList.remove('list');
      mount.classList.add('grid');
      mount.innerHTML = materials.map(renderMaterial).join('');
    })
    .catch(() => {
      if (!mount.querySelector('article')) mount.innerHTML = '<div class="empty">Материалы временно недоступны. Попробуйте открыть раздел позже или перейдите в <a href="/documents/">документы и шаблоны</a>.</div>';
    });
}());
