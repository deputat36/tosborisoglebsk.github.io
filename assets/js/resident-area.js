(() => {
  'use strict';
  const core = window.ResidentAreaCore, view = window.ResidentAreaView;
  const root = document.querySelector('[data-resident-area]');
  if (!root || !core || !view) return;
  let data;
  try { data = JSON.parse(document.getElementById('resident-area-data').textContent); }
  catch { return; }
  const storageKey = 'tos-bgo-preferred-area-v1';
  const controls = root.querySelector('[data-area-controls]');
  const select = controls.querySelector('#area-choice');
  const search = controls.querySelector('#area-search');
  const found = controls.querySelector('[data-area-found]');
  const dashboard = root.querySelector('[data-area-dashboard]');
  const status = root.querySelector('[data-area-status]');
  const share = root.querySelector('[data-area-share-link]');
  let slug = '', help = 'all';
  function message(text) { status.textContent = text; }
  function readSaved() {
    try { const value = localStorage.getItem(storageKey) || ''; return core.findArea(data.toses, value) ? value : ''; }
    catch { return ''; }
  }
  function fromUrl(useSaved = false) {
    const params = new URLSearchParams(location.search);
    const requested = params.get('tos') || '';
    const invalid = params.has('tos') && requested && !core.findArea(data.toses, requested);
    slug = params.has('tos') ? (invalid ? '' : requested) : useSaved ? readSaved() : '';
    help = core.HELP.includes(params.get('help')) ? params.get('help') : 'all';
    render();
    if (invalid) message('В ссылке указан ТОС, которого нет в каталоге. Выберите территорию из списка.');
    else if (slug && !params.has('tos')) {
      updateUrl(); message('Открыта сохранённая на этом устройстве территория.');
    }
  }
  function updateUrl() {
    try {
      const url = new URL(location.href);
      if (slug) url.searchParams.set('tos', slug); else url.searchParams.delete('tos');
      if (help !== 'all') url.searchParams.set('help', help); else url.searchParams.delete('help');
      history.replaceState(null, '', url);
    } catch { /* Selection remains usable when history is unavailable. */ }
  }
  function render() {
    dashboard.innerHTML = view.dashboard(data, slug, help);
    select.value = slug;
    root.querySelector('[data-area-save]').disabled = !slug;
    share.value = 'https://tosborisoglebsk.ru' + core.areaUrl(slug, help);
    dashboard.querySelector('[data-area-help-controls]').hidden = false;
    dashboard.querySelectorAll('[data-area-calendar]').forEach(button => { button.hidden = false; });
    const name = core.findArea(data.toses, slug)?.name;
    document.title = name ? `Моя территория — ТОС «${name}» | ТОС БГО` : 'Моя территория — дела, события и помощь рядом | ТОС БГО';
  }
  function choose(value) {
    slug = core.findArea(data.toses, value)?.slug || '';
    search.value = ''; found.replaceChildren();
    render(); updateUrl();
    message(slug ? 'Выбрана территория: ' + core.findArea(data.toses, slug).name + '. Подборка обновлена.' : 'Показана подборка для всего округа.');
  }
  select.addEventListener('change', () => choose(select.value));
  search.addEventListener('input', () => {
    found.replaceChildren();
    const query = search.value.trim();
    if (query.length < 2) return;
    const rows = core.searchAreas(data.toses, query);
    for (const item of rows.slice(0, 8)) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'area-search-result'; button.dataset.areaChoose = item.slug;
      const name = document.createElement('b'); name.textContent = 'ТОС «' + item.name + '»';
      const location = document.createElement('span'); location.textContent = item.location;
      button.append(name, location); found.append(button);
    }
    const note = document.createElement('p'); note.className = 'tiny';
    note.textContent = rows.length ? `Найдено: ${rows.length}. Совпадение текста не подтверждает границы ТОС.` : 'Совпадений нет. Попробуйте населённый пункт или откройте каталог.';
    found.append(note);
  });
  found.addEventListener('click', event => {
    const button = event.target.closest('[data-area-choose]');
    if (button) { choose(button.dataset.areaChoose); select.focus(); }
  });
  root.querySelector('[data-area-save]').addEventListener('click', () => {
    if (!slug) return;
    try { localStorage.setItem(storageKey, slug); message('Выбор сохранён на этом устройстве. При следующем открытии страницы будет выбран этот ТОС.'); }
    catch { message('Браузер не разрешил сохранить выбор. Скопируйте ссылку на подборку — она откроет выбранный ТОС.'); }
  });
  root.querySelector('[data-area-forget]').addEventListener('click', () => {
    let forgotten = true;
    try { localStorage.removeItem(storageKey); } catch { forgotten = false; }
    choose('');
    message(forgotten ? 'Сохранённый выбор удалён. Показан весь округ.' : 'Показан весь округ. Браузер не разрешил удалить сохранённый выбор.');
  });
  root.querySelector('[data-area-share]').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(share.value); message('Ссылка на подборку скопирована. Её можно отправить соседям.'); }
    catch { share.focus(); share.select(); message('Ссылка выделена. Скопируйте её из поля вручную.'); }
  });
  root.querySelector('[data-area-print]').addEventListener('click', () => window.print());
  dashboard.addEventListener('change', event => {
    if (event.target.id !== 'area-help-kind') return;
    const candidate = event.target.value;
    help = core.HELP.includes(candidate) ? candidate : 'all';
    render(); updateUrl();
    dashboard.querySelector('#area-help-kind').focus({preventScroll: true});
    message('Подборка способов помощи обновлена.');
  });
  dashboard.addEventListener('submit', event => { if (event.target.matches('[data-area-help-controls]')) event.preventDefault(); });
  dashboard.addEventListener('click', event => {
    const button = event.target.closest('[data-area-calendar]');
    if (!button) return;
    const item = data.events.find(item => item.id === button.dataset.areaCalendar);
    try {
      const content = core.eventCalendar(item);
      const url = URL.createObjectURL(new Blob([content], {type: 'text/calendar;charset=utf-8'}));
      const link = document.createElement('a'); link.href = url; link.download = item.id + '.ics';
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      message('Файл календаря подготовлен. Откройте его в своём приложении и проверьте дату и условия.');
    } catch { message('Не удалось подготовить календарь. Проверьте дату и условия по источнику события.'); }
  });
  window.addEventListener('popstate', () => fromUrl());
  window.addEventListener('pageshow', event => { if (event.persisted) fromUrl(); });
  // Recheck day-sensitive lists when a long-open tab returns to the foreground.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  fromUrl(true);
  controls.hidden = false;
  root.querySelector('[data-area-directory]').hidden = true;
})();
