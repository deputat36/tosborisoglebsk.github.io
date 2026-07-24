(() => {
  'use strict';

  const context = document.querySelector('#relay-tos-context');
  const template = document.querySelector('#relay-tos-template');
  const copyButton = document.querySelector('#copy-relay-template');
  const copyStatus = document.querySelector('#relay-copy-status');
  const cardLink = document.querySelector('#relay-tos-card-link');
  if (!context || !template || !copyButton || !copyStatus || !cardLink) return;

  const params = new URLSearchParams(window.location.search);
  const cleanParam = (value, limit = 160) => String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
  const requestedSlug = cleanParam(params.get('tos'), 80);
  const requestMode = cleanParam(params.get('request'), 40);
  const requestedQuery = cleanParam(params.get('query'));
  const requestedLocation = cleanParam(params.get('location'));

  function genericTemplate() {
    return [
      'ТОС или территория:',
      'Тема сообщения:',
      'Краткое описание:',
      'Что нужно передать председателю или активу:',
      'Как со мной связаться для уточнения:'
    ].join('\n');
  }

  function findTosTemplate() {
    const lines = [];
    if (requestedQuery) lines.push(`Поисковый запрос: ${requestedQuery}`);
    if (requestedLocation) lines.push(`Выбранная территория: ${requestedLocation}`);
    if (!requestedQuery && !requestedLocation) lines.push('Улица, населённый пункт или территория:');
    lines.push(
      'Что нужно уточнить: к какому ТОС относится указанная территория',
      'Дополнительный ориентир без номера квартиры и лишних персональных данных:',
      'Как со мной связаться для уточнения:'
    );
    return lines.join('\n');
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

  function hideCardLink() {
    cardLink.hidden = true;
    cardLink.style.display = 'none';
    cardLink.removeAttribute('href');
  }

  function showCardLink(item) {
    cardLink.href = `/tos/${item.slug}/`;
    cardLink.textContent = `Вернуться к карточке ТОС «${item.name}»`;
    cardLink.hidden = false;
    cardLink.style.removeProperty('display');
  }

  function showCatalogReturnLink() {
    const searchParams = new URLSearchParams();
    if (requestedQuery) searchParams.set('q', requestedQuery);
    if (requestedLocation) searchParams.set('location', requestedLocation);
    const query = searchParams.toString();
    cardLink.href = `/tos/${query ? `?${query}` : ''}`;
    cardLink.textContent = query ? 'Вернуться к результатам поиска ТОС' : 'Вернуться в каталог ТОС';
    cardLink.hidden = false;
    cardLink.style.removeProperty('display');
  }

  function showGeneric(message = 'Укажите название ТОС или территорию в сообщении. Редакция проверит, есть ли доступный канал для передачи.') {
    context.textContent = message;
    template.value = genericTemplate();
    hideCardLink();
  }

  function showFindTosRequest() {
    const details = [requestedQuery, requestedLocation].filter(Boolean).join(' · ');
    context.textContent = details
      ? `Запрос из каталога подставлен в шаблон: ${details}. Он не отправлен автоматически. Проверьте текст и удалите номер квартиры или другие лишние персональные данные перед отправкой.`
      : 'Подготовлен шаблон для уточнения территории. Он не отправлен автоматически. Укажите улицу, населённый пункт или другой безопасный ориентир без лишних персональных данных.';
    template.value = findTosTemplate();
    showCatalogReturnLink();
  }

  async function loadContext() {
    if (requestedSlug) {
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
        showCardLink(item);
        return;
      } catch {
        showGeneric('Каталог временно не загрузился. Укажите название ТОС или территорию вручную.');
        return;
      }
    }

    if (requestMode === 'find-tos') {
      showFindTosRequest();
      return;
    }

    showGeneric();
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
  hideCardLink();
  loadContext();
})();
