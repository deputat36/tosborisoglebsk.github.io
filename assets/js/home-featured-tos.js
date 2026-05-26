const featuredTosEsc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;'
}[char]));

async function renderFeaturedTos() {
  const root = document.querySelector('#home-featured-tos');
  if (!root) return;
  try {
    const item = await fetch('/data/featured_tos.json', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null);
    if (!item || item.status === 'draft') {
      root.closest('section')?.remove();
      return;
    }
    const reasons = Array.isArray(item.why) ? item.why.filter(Boolean) : [];
    root.innerHTML = `<article class="card full"><div class="card-inner"><div class="meta"><span class="tag warn">${featuredTosEsc(item.label || 'Активная территория')}</span>${item.updated_at ? `<span class="tag">Обновлено: ${featuredTosEsc(item.updated_at)}</span>` : ''}</div><h3>${featuredTosEsc(item.title || 'ТОС')}</h3><p class="lead">${featuredTosEsc(item.subtitle || '')}</p><p>${featuredTosEsc(item.description || '')}</p>${reasons.length ? `<div class="notice"><b style="color:var(--text)">Почему выделяем</b><ul>${reasons.map((reason) => `<li>${featuredTosEsc(reason)}</li>`).join('')}</ul></div>` : ''}<p class="tiny"><b>Источник:</b> ${item.source_url ? `<a href="${featuredTosEsc(item.source_url)}">${featuredTosEsc(item.source_label || 'Источник')}</a>` : featuredTosEsc(item.source_label || 'Редакция портала')}</p><div class="card-actions"><a class="btn primary" href="${featuredTosEsc(item.cta_primary_url || '/tos/')} ">${featuredTosEsc(item.cta_primary_text || 'Открыть карточку')}</a><a class="btn" href="${featuredTosEsc(item.cta_secondary_url || '/done/')} ">${featuredTosEsc(item.cta_secondary_text || 'Посмотреть истории')}</a><a class="btn" href="${featuredTosEsc(item.cta_third_url || '/contacts/')} ">${featuredTosEsc(item.cta_third_text || 'Прислать материал')}</a></div></div></article>`;
  } catch (error) {
    root.innerHTML = '<div class="empty">Активная территория не загрузилась. Проверьте data/featured_tos.json</div>';
  }
}

renderFeaturedTos();
