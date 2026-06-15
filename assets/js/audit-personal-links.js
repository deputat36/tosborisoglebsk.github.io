(() => {
  'use strict';

  const list = document.querySelector('#audit-list');
  if (!list) return;

  function formUrl(slug, type) {
    return `/update-tos/?tos=${encodeURIComponent(slug)}&type=${encodeURIComponent(type)}`;
  }

  function personalizedRequest(item) {
    const missing = (item.missing || []).join(', ').toLowerCase();
    const requested = (item.recommendations || []).map((value) => `— ${value}`).join('\n');
    const links = [
      `Проверить карточку: https://tosborisoglebsk.ru/tos/${item.slug}/`,
      `Подтвердить или исправить данные: https://tosborisoglebsk.ru/update-tos/?tos=${item.slug}&type=card`,
      `Прислать новость: https://tosborisoglebsk.ru/update-tos/?tos=${item.slug}&type=news`,
      `Предложить проект: https://tosborisoglebsk.ru/update-tos/?tos=${item.slug}&type=project`,
      `Сообщить потребность: https://tosborisoglebsk.ru/update-tos/?tos=${item.slug}&type=need`
    ].join('\n');

    return `Здравствуйте! Проверяем карточку ТОС «${item.name || item.slug}» на портале tosborisoglebsk.ru.\n\nПросим подтвердить или уточнить данные${missing ? `: ${missing}` : ''}.\n${requested ? `\nЧто желательно прислать:\n${requested}\n` : ''}\n${links}\n\nПожалуйста, не направляйте персональные данные, которые не должны публиковаться открыто.`;
  }

  if (typeof requestText === 'function') requestText = personalizedRequest;

  function enhanceCards() {
    list.querySelectorAll('.audit-card').forEach((card) => {
      const slug = card.dataset.slug;
      const actions = card.querySelector('.card-actions');
      if (!slug || !actions) return;

      const updateLink = actions.querySelector('a[href="/update-tos/"]');
      if (updateLink) updateLink.href = formUrl(slug, 'card');

      if (!actions.querySelector('[data-personal-action="news"]')) {
        const news = document.createElement('a');
        news.className = 'btn';
        news.dataset.personalAction = 'news';
        news.href = formUrl(slug, 'news');
        news.textContent = 'Добавить новость';
        actions.insertBefore(news, actions.querySelector('.audit-copy-request'));
      }

      if (!actions.querySelector('[data-personal-action="project"]')) {
        const project = document.createElement('a');
        project.className = 'btn';
        project.dataset.personalAction = 'project';
        project.href = formUrl(slug, 'project');
        project.textContent = 'Добавить проект';
        actions.insertBefore(project, actions.querySelector('.audit-copy-request'));
      }
    });
  }

  list.addEventListener('click', (event) => {
    const button = event.target.closest('.audit-copy-request');
    if (!button) return;
    const slug = button.dataset.slug;
    if (typeof setWorkflow === 'function') setWorkflow(slug, 'requested');
    const select = list.querySelector(`.audit-workflow-select[data-slug="${CSS.escape(slug)}"]`);
    if (select) select.value = 'requested';
  });

  new MutationObserver(enhanceCards).observe(list, { childList: true, subtree: true });
  enhanceCards();
})();
