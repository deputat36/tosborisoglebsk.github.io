/* Клиентская часть жеребьёвки. В этом файле нет назначений, кодов и закрытых данных. */
(() => {
  'use strict';
  const EVENT_SLUG = 'culinary-battle-2026';
  // Заменить только после создания отдельного проекта, миграции и проверки API.
  // Публичный URL Edge Function не является секретом. Никакие ключи не добавлять.
  const API_ENDPOINT = '';
  const $ = (id) => document.getElementById(id);
  const form = $('battle-form');
  if (!form) return;
  const search = $('battle-search');
  const team = $('battle-team');
  const code = $('battle-code');
  const submit = $('battle-submit');
  const status = $('battle-status');
  const error = $('battle-error');
  const visibility = $('battle-visibility');
  const resultSection = $('battle-result-section');
  const reveal = $('battle-reveal');
  const result = $('battle-result');
  const skip = $('battle-skip');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let teams = [];
  let currentStatus = 'draft';
  let busy = false;
  let resultData = null;

  function setStatus(message, kind = 'draft') {
    status.textContent = message;
    status.dataset.status = kind;
  }
  function setError(message = '') {
    error.textContent = message;
    error.hidden = !message;
  }
  function normalize(text) {
    return String(text || '').toLocaleLowerCase('ru').replace(/ё/g, 'е').trim();
  }
  function refreshOptions() {
    const previous = team.value;
    const term = normalize(search.value);
    const matching = teams.filter((t) => normalize(t.name).includes(term));
    const fragment = document.createDocumentFragment();
    const placeholder = new Option(matching.length ? 'Выберите свой ТОС' : 'Совпадений не найдено', '');
    fragment.append(placeholder);
    matching.forEach((t) => fragment.append(new Option(t.name, t.id)));
    team.replaceChildren(fragment);
    if (matching.some((t) => t.id === previous)) team.value = previous;
  }
  function updateControls() {
    const enabled = Boolean(API_ENDPOINT) && ['open', 'closed', 'published'].includes(currentStatus) && !busy && teams.length === 18;
    search.disabled = !enabled;
    team.disabled = !enabled;
    code.disabled = !enabled;
    visibility.disabled = !enabled;
    submit.disabled = !enabled;
    submit.textContent = currentStatus === 'open' ? '✦ Вытянуть блюдо ✦' : 'Посмотреть своё блюдо';
  }
  async function request(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(API_ENDPOINT + path, {
        ...options,
        cache: 'no-store',
        credentials: 'omit',
        signal: controller.signal,
        headers: { 'Accept': 'application/json', ...(options.headers || {}) }
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const messages = {
          invalid_credentials: 'Неверный код для выбранного ТОСа. Проверьте название команды и код.',
          rate_limited: 'Слишком много попыток. Попробуйте снова через 15 минут.',
          not_open: 'Жеребьёвка ещё не открыта.',
          closed: 'Жеребьёвка завершена. Новое открытие блюда недоступно.',
          unavailable: 'Сервис жеребьёвки временно недоступен. Повторите попытку позже.'
        };
        throw new Error(messages[body.error] || 'Не удалось получить результат. Попробуйте снова.');
      }
      return body;
    } finally {
      clearTimeout(timer);
    }
  }
  async function initialize() {
    if (!API_ENDPOINT) {
      setStatus('Жеребьёвка готовится к запуску. Коды и задания появятся после утверждения участников.', 'draft');
      updateControls();
      return;
    }
    try {
      const data = await request('?event=' + encodeURIComponent(EVENT_SLUG));
      if (!Array.isArray(data.teams) || !['draft', 'ready', 'open', 'closed', 'published'].includes(data.status)) {
        throw new Error('Получен некорректный ответ сервера.');
      }
      currentStatus = data.status;
      teams = data.teams
        .filter((t) => t && typeof t.id === 'string' && typeof t.name === 'string')
        .map((t) => ({ id: t.id, name: t.name }));
      const messages = {
        draft: 'Идёт подготовка мероприятия. Жеребьёвка пока закрыта.',
        ready: 'Участники и блюда проверены. Ожидаем открытия жеребьёвки.',
        open: 'Жеребьёвка открыта! Выберите свой ТОС и введите персональный код.',
        closed: 'Жеребьёвка завершена. Ранее открытое блюдо можно посмотреть повторно по своему коду.',
        published: 'Мероприятие завершено. Своё задание можно посмотреть повторно по коду.'
      };
      setStatus(messages[currentStatus], currentStatus);
      refreshOptions();
      if (teams.length !== 18 && currentStatus === 'open') {
        setStatus('Список команд требует проверки организатором. Участие временно недоступно.', 'draft');
      }
      updateControls();
    } catch (err) {
      setStatus('Не получилось связаться с сервером жеребьёвки. Попробуйте обновить страницу позже.', 'draft');
      updateControls();
    }
  }
  search.addEventListener('input', refreshOptions);
  visibility.addEventListener('click', () => {
    const show = code.type === 'password';
    code.type = show ? 'text' : 'password';
    visibility.textContent = show ? 'Скрыть' : 'Показать';
    visibility.setAttribute('aria-pressed', String(show));
    visibility.setAttribute('aria-label', show ? 'Скрыть код' : 'Показать код');
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy || !['open', 'closed', 'published'].includes(currentStatus)) return;
    setError();
    if (!team.value || !code.value.trim()) {
      setError('Выберите ТОС и введите ваш индивидуальный код.');
      return;
    }
    busy = true;
    updateControls();
    try {
      // Сервер фиксирует открытие до анимации; браузер не выбирает блюдо.
      const data = await request('', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: EVENT_SLUG, team_id: team.value, code: code.value.trim() })
      });
      if (!data || typeof data.team_name !== 'string' || typeof data.dish_name !== 'string') {
        throw new Error('Сервер вернул неполный результат. Введите код повторно.');
      }
      resultData = { team: data.team_name, dish: data.dish_name };
      code.value = '';
      await animateReveal();
    } catch (err) {
      setError(err.name === 'AbortError' ? 'Время ожидания истекло. Проверьте результат повторным вводом того же кода.' : err.message);
      $('battle-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } finally {
      busy = false;
      updateControls();
    }
  });

  function animateReveal() {
    resultSection.hidden = false;
    reveal.hidden = false;
    result.hidden = true;
    resultSection.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
    const show = () => {
      reveal.classList.remove('is-playing');
      reveal.hidden = true;
      $('battle-result-team').textContent = 'ТОС «' + resultData.team + '»';
      $('battle-result-dish').textContent = resultData.dish;
      result.hidden = false;
      result.focus({ preventScroll: true });
      celebrate();
    };
    if (reduceMotion.matches) { show(); return Promise.resolve(); }
    reveal.classList.add('is-playing');
    return new Promise((resolve) => {
      let finished = false;
      let timer;
      let flipTimer;
      const finish = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        clearTimeout(flipTimer);
        reveal.classList.remove('is-finishing');
        skip.removeEventListener('click', finish);
        show();
        resolve();
      };
      skip.addEventListener('click', finish);
      flipTimer = setTimeout(() => {
        reveal.classList.remove('is-playing');
        reveal.classList.add('is-finishing');
      }, 2500);
      timer = setTimeout(finish, 3600);
    });
  }
  function celebrate() {
    const host = $('battle-confetti');
    host.replaceChildren();
    if (reduceMotion.matches) return;
    const colors = ['#B62D36', '#D3A33D', '#CA6744', '#688E49', '#F7C878'];
    for (let n = 0; n < 42; n += 1) {
      const confetti = document.createElement('i');
      confetti.className = 'battle-confetti-piece';
      confetti.style.left = (Math.random() * 100).toFixed(2) + '%';
      confetti.style.backgroundColor = colors[n % colors.length];
      confetti.style.animationDelay = (Math.random() * .85).toFixed(2) + 's';
      host.append(confetti);
    }
    setTimeout(() => host.replaceChildren(), 3500);
  }

  function drawWrapped(context, text, centerX, startY, maxWidth, lineHeight, maxLines) {
    const words = text.split(/\s+/);
    let line = '';
    const lines = [];
    for (const word of words) {
      const trial = line ? line + ' ' + word : word;
      if (line && context.measureText(trial).width > maxWidth) {
        lines.push(line);
        line = word;
      } else line = trial;
    }
    if (line) lines.push(line);
    const visible = lines.slice(0, maxLines);
    visible.forEach((part, i) => context.fillText(part, centerX, startY + i * lineHeight, maxWidth));
    return visible.length;
  }
  $('battle-download').addEventListener('click', () => {
    if (!resultData) return;
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setError('Ваш браузер не поддерживает сохранение картинки.'); return; }
    const gradient = ctx.createLinearGradient(0, 0, 1080, 1350);
    gradient.addColorStop(0, '#FFF7E8'); gradient.addColorStop(1, '#F5D9B0');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1080, 1350);
    ctx.strokeStyle = '#D3A33D'; ctx.lineWidth = 9; ctx.strokeRect(42, 42, 996, 1266);
    ctx.strokeStyle = '#B62D36'; ctx.lineWidth = 2; ctx.strokeRect(65, 65, 950, 1220);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#B62D36'; ctx.font = '900 47px system-ui, sans-serif';
    ctx.fillText('КУЛИНАРНЫЙ БАТЛ ТОС БГО', 540, 190, 870);
    ctx.fillStyle = '#D3A33D'; ctx.font = '900 110px system-ui, sans-serif';
    ctx.fillText('✦', 540, 340);
    ctx.fillStyle = '#B62D36'; ctx.font = '900 61px system-ui, sans-serif';
    ctx.fillText('ПОЗДРАВЛЯЕМ!', 540, 456);
    ctx.fillStyle = '#33302C'; ctx.font = '800 51px system-ui, sans-serif';
    drawWrapped(ctx, 'ТОС «' + resultData.team + '»', 540, 545, 850, 65, 3);
    ctx.fillStyle = '#77654E'; ctx.font = '750 40px system-ui, sans-serif';
    ctx.fillText('ВАШЕ БЛЮДО —', 540, 780);
    ctx.fillStyle = '#B62D36'; ctx.font = '900 71px system-ui, sans-serif';
    drawWrapped(ctx, resultData.dish, 540, 882, 890, 82, 3);
    ctx.fillStyle = '#453D37'; ctx.font = '500 30px system-ui, sans-serif';
    ctx.fillText('Готовьте с душой и удивляйте соседей!', 540, 1130, 875);
    ctx.font = '700 28px system-ui, sans-serif'; ctx.fillText('tosborisoglebsk.ru', 540, 1220);
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = 'kulinarniy-batl-' + resultData.team.toLocaleLowerCase('ru').replace(/[^\p{L}\p{N}-]+/gu, '-').slice(0, 60) + '.png';
    link.click();
  });
  initialize();
})();
