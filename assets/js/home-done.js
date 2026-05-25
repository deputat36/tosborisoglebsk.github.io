const homeDoneEsc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;'
}[char]));

async function renderHomeDone() {
  const root = document.querySelector('#home-done');
  if (!root) return;
  try {
    const data = await fetch('/data/done.json', { cache: 'no-store' }).then((response) => response.ok ? response.json() : []);
    const items = data.filter((item) => item.status !== 'draft').slice(0, 3);
    root.innerHTML = items.length ? items.map((item) => `<article class="card"><div class="card-inner"><div class="meta"><span class="tag">${homeDoneEsc(item.type || 'История')}</span>${item.tos_slug ? `<span class="tag">${homeDoneEsc(item.tos_slug)}</span>` : ''}</div><h3>${homeDoneEsc(item.title || 'История ТОС')}</h3><p>${homeDoneEsc(item.summary || '')}</p><div class="card-actions"><a class="btn" href="/done/">Подробнее</a>${item.source_url ? `<a class="btn" href="${homeDoneEsc(item.source_url)}">Карточка ТОС</a>` : ''}</div></div></article>`).join('') : '<div class="empty">Истории пока не добавлены.</div>';
  } catch (error) {
    root.innerHTML = '<div class="empty">Истории не загрузились. Проверьте data/done.json</div>';
  }
}

renderHomeDone();
