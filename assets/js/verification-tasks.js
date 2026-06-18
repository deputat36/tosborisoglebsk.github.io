function taskText(item) {
  const missing = (item.missing || []).join(', ') || 'ничего критичного не указано';
  return `Здравствуйте! Уточняем сведения для открытой карточки ТОС «${item.name}» на портале tosborisoglebsk.ru. Сейчас нужно проверить: ${missing}. Также можно прислать короткую новость, фото территории, логотип или ссылку на открытую страницу ТОС. Публикуем только те сведения, которые можно размещать открыто.`;
}

function renderTaskCard(item) {
  const missing = item.missing || [];
  const recommendations = item.recommendations || [];
  return `
    <article class="card">
      <div class="card-inner">
        <span class="tag">${item.priority || 'Проверка'}</span>
        <h3>${item.name}</h3>
        <p>${item.location || ''}</p>
        <p><b>Статус:</b> ${item.verification?.label || item.verification?.status || 'уточняется'}.</p>
        <p><b>Нужно уточнить:</b> ${missing.join(', ') || 'нет критичных пропусков'}.</p>
        ${recommendations.length ? `<ul>${recommendations.map((rec) => `<li>${rec}</li>`).join('')}</ul>` : ''}
        <div class="notice tiny">${taskText(item)}</div>
        <div class="card-actions">
          <a class="btn" href="/tos/${item.slug}/">Карточка</a>
          <a class="btn" href="/update-tos/">Обновить</a>
        </div>
      </div>
    </article>
  `;
}

async function loadVerificationTasks() {
  const summaryBox = document.getElementById('verification-tasks-summary');
  const highBox = document.getElementById('verification-tasks-high');
  const partialBox = document.getElementById('verification-tasks-partial');

  try {
    const response = await fetch('/data/tos_content_audit.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('audit not found');
    const data = await response.json();
    const summary = data.summary || {};
    const items = data.items || [];
    const high = items.filter((item) => item.priority === 'Высокий');
    const partial = items.filter((item) => item.priority !== 'Высокий' && (item.missing || []).length).slice(0, 12);

    if (summaryBox) {
      summaryBox.innerHTML = `
        <div class="grid">
          <article class="card"><div class="card-inner"><span class="tag">Всего</span><h3>${summary.total_tos ?? items.length}</h3><p>Карточек ТОС в каталоге.</p></div></article>
          <article class="card"><div class="card-inner"><span class="tag">Срочно</span><h3>${summary.high_priority ?? high.length}</h3><p>Карточек с высоким приоритетом проверки.</p></div></article>
          <article class="card"><div class="card-inner"><span class="tag">Телефон</span><h3>${summary.without_phone ?? '—'}</h3><p>Карточек без открытого телефона.</p></div></article>
          <article class="card"><div class="card-inner"><span class="tag">Соцсети</span><h3>${summary.without_social ?? '—'}</h3><p>Карточек без открытой страницы или группы.</p></div></article>
        </div>
      `;
    }

    if (highBox) {
      highBox.innerHTML = high.length ? `<div class="grid">${high.map(renderTaskCard).join('')}</div>` : '<p>Карточек высокого приоритета нет.</p>';
    }

    if (partialBox) {
      partialBox.innerHTML = partial.length ? `<div class="grid">${partial.map(renderTaskCard).join('')}</div>` : '<p>Дополнительных карточек для уточнения нет.</p>';
    }
  } catch (error) {
    if (summaryBox) summaryBox.innerHTML = '<div class="notice">Аудит карточек ещё не найден. Данные появятся после генерации сайта.</div>';
  }
}

loadVerificationTasks();
