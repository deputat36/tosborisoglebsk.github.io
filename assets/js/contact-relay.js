(() => {
  'use strict';

  const context = document.querySelector('#relay-tos-context');
  const template = document.querySelector('#relay-tos-template');
  const copyButton = document.querySelector('#copy-relay-template');
  const copyStatus = document.querySelector('#relay-copy-status');
  const cardLink = document.querySelector('#relay-tos-card-link');
  if (!context || !template || !copyButton || !copyStatus || !cardLink) return;

  const params = new URLSearchParams(window.location.search);
  const requestedSlug = String(params.get('tos') || '').trim();

  function genericTemplate() {
    return [
      'ТОС или территория:',
      'Тема сообщения:',
      'Краткое описание:',
      'Что нужно передать председателю или активу:',
      'Как со мной связаться для уточнения:'
    ].join('\n');
  }

  function tosTemplate(item) {
    return [
      `ТОС: ТОС «${item.name}»`,
      `Территория: ${item.location || 'уточняется'}`,
      `Карточка: https://tosborisoglebsk.ru/tos/${item.slug}/`,
      'Тема сообщения:',
      'Краткое описание:',
      'Что нужно передать председателю или активу:',
      'Как со мной связаться для уточнения:'
    ].join('\n');
  }

  function showGeneric(message = 'Укажите название ТОС или территорию в сообщении. Редакция проверит, есть ли доступный канал для передачи.') {
    context.textContent = message;
    template.value = genericTemplate();
    cardLink.hidden = true;
    cardLink.removeAttribute('href');
  }

  async function loadContext() {
    if (!requestedSlug) {
      showGeneric();
      return;
    }

    try {
      const response = await fetch('/data/toses.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('catalog unavailable');
      const items = await response.json();
      const item = items.find((entry) => entry && entry.status !== 'draft' && entry.slug === requestedSlug);
      if (!item) {
        showGeneric('Указанная карточка ТОС не найдена. Напишите название территории вручную и не передавайте лишние персональные данные.');
        return;
      }

      context.textContent = `Сообщение будет подготовлено для ТОС «${item.name}» (${item.location || 'территория уточняется'}). Редакция не гарантирует передачу или ответ и не заменяет официальную приёмную.`;
      template.value = tosTemplate(item);
      cardLink.href = `/tos/${item.slug}/`;
      cardLink.textContent = `Вернуться к карточке ТОС «${item.name}»`;
      cardLink.hidden = false;
    } catch {
      showGeneric('Каталог временно не загрузился. Укажите название ТОС или территорию вручную.');
    }
  }

  async function copyTemplate() {
    const value = template.value;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        template.removeAttribute('readonly');
        template.select();
        document.execCommand('copy');
        template.setAttribute('readonly', '');
      }
      copyStatus.textContent = 'Шаблон скопирован. Заполните его и отправьте редакции через ВК или ответственный контакт.';
    } catch {
      copyStatus.textContent = 'Не удалось скопировать автоматически. Выделите текст в поле и скопируйте вручную.';
    }
  }

  copyButton.addEventListener('click', copyTemplate);
  template.value = genericTemplate();
  loadContext();
})();
