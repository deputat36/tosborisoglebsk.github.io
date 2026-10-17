(function () {
  const mount = document.getElementById('articles-list');
  const form = document.getElementById('materials-filters');
  const api = window.TosMaterials;
  if (!mount || !form || !api) return;

  const search = document.getElementById('materials-search');
  const topic = document.getElementById('materials-topic');
  const status = document.getElementById('materials-filter-status');
  const empty = document.getElementById('materials-empty');
  const resets = Array.from(document.querySelectorAll('[data-materials-reset]'));
  const items = Array.from(mount.querySelectorAll('[data-material-id]')).map(node => ({
    node, topic: node.dataset.materialTopic, search: node.dataset.materialSearch,
    title: node.querySelector('h3').textContent, category: node.querySelector('.tag').textContent, description: node.querySelector('p').textContent
  }));
  if (!items.length || !search || !topic || !status || !empty) return;

  function readUrl() {
    const params = new URLSearchParams(window.location.search);
    search.value = (params.get('q') || '').slice(0, search.maxLength);
    const value = params.get('topic') || '';
    topic.value = Array.from(topic.options).some(option => option.value === value) ? value : '';
  }
  function apply(sync = true) {
    const state = { q: search.value, topic: topic.value };
    let shown = 0;
    items.forEach(item => {
      const visible = api.matches(item, state);
      item.node.hidden = !visible;
      if (visible) shown++;
    });
    const visible = items.filter(item => !item.node.hidden).sort((a, b) => api.relevance(b, state.q) - api.relevance(a, state.q));
    mount.append(...visible.map(item => item.node), ...items.filter(item => item.node.hidden).map(item => item.node));
    status.textContent = `Показано: ${shown} из ${items.length}.`;
    empty.hidden = shown > 0;
    resets.forEach(button => { button.disabled = !state.q && !state.topic; });
    if (sync) {
      const url = new URL(window.location.href);
      for (const [field, value] of Object.entries(state)) {
        if (value.trim()) url.searchParams.set(field, value.trim());
        else url.searchParams.delete(field);
      }
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
  }
  form.addEventListener('submit', event => { event.preventDefault(); apply(); });
  search.addEventListener('input', () => apply());
  topic.addEventListener('change', () => apply());
  resets.forEach(button => button.addEventListener('click', () => {
    search.value = '';
    topic.value = '';
    apply();
    search.focus();
  }));
  window.addEventListener('popstate', () => { readUrl(); apply(false); });
  readUrl();
  apply();
  form.hidden = false;
}());
