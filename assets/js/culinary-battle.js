/* Клиентская часть. Реальные секретные коды и распределения хранятся только на сервере. */
(() => {
  'use strict';
  const EVENT_SLUG = 'culinary-battle-2026';
  // Configure PUBLIC endpoint via <meta name="culinary-battle-api"> only after a verified deployment.
  // Never put service keys, code digests, participant codes or BATTLE_PEPPER in HTML/JS.
  const API_ENDPOINT = (document.querySelector('meta[name="culinary-battle-api"]')?.content || '').trim().replace(/\\/$/, '');
  // Demo is disabled automatically as soon as the live API endpoint is configured.
  const isDemo = !API_ENDPOINT && new URLSearchParams(location.search).get('demo') === '1';
  let demoDishes = [];
  let demoAssignments = {};
  const DEMO_STORAGE_KEY = 'tosbgo-culinary-battle-demo-26x19-v1';
  const $ = (id) => document.getElementById(id);
  const form = $('battle-form');
  if (!form) return;
  const search = $('battle-search');
  const team = $('battle-team');
  const code = $('battle-code');
  const submit = $('battle-submit');
  const status = $('battle-status');
  const remainingDisplay = $('battle-remaining');
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
    const matching = teams.filter((t) => normalize(t.name).includes(term)).sort((a,b) => a.name.localeCompare(b.name,'ru'));
    const fragment = document.createDocumentFragment();
    const placeholder = new Option(matching.length ? 'Выберите свой ТОС' : 'Совпадений не найдено', '');
    fragment.append(placeholder);
    matching.forEach((t) => fragment.append(new Option(t.name, t.id)));
    team.replaceChildren(fragment);
    if (matching.some((t) => t.id === previous)) team.value = previous;
  }
  function updateControls() {
    const enabled = (isDemo || Boolean(API_ENDPOINT)) && ['open', 'closed', 'published'].includes(currentStatus) && !busy && teams.length === 26;
    search.disabled = !enabled;
    team.disabled = !enabled;
    code.disabled = !enabled;
    visibility.disabled = !enabled;
    submit.disabled = !enabled;
    submit.textContent = isDemo
      ? '✦ Вытянуть демо-блюдо ✦'
      : currentStatus === 'open' ? '✦ Вытянуть блюдо ✦' : 'Посмотреть своё блюдо';
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
          closed: 'Жеребьёвка закрыта. Если вы уже получили блюдо, можете посмотреть его по своему коду.',
          sold_out: 'Все 19 блюд уже распределены. Новые участники больше не могут получить блюдо.',
          unavailable: 'Сервис жеребьёвки временно недоступен. Повторите попытку позже.'
        };
        throw new Error(messages[body.error] || 'Не удалось получить результат. Попробуйте снова.');
      }
      return body;
    } finally {
      clearTimeout(timer);
    }
  }
  function showRemaining(count, demo = false) {
    if (!remainingDisplay) return;
    remainingDisplay.hidden = false;
    remainingDisplay.textContent = demo
      ? 'ДЕМО: осталось ' + count + ' из 19 блюд · Только в этом браузере'
      : 'Свободных блюд: ' + count + ' из 19';
  }
  function secureDemoIndex(max) {
    // Demonstration-only random selection; only real server draw is authoritative.
    if (max < 1) throw new Error('Доступных блюд больше нет.');
    const sample = new Uint32Array(1);
    const limit = Math.floor(4294967296 / max) * max;
    do { crypto.getRandomValues(sample); } while (sample[0] >= limit);
    return sample[0] % max;
  }
  function getDemoAssignments() {
    try {
      const saved = JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY) || '{}');
      if (!saved || Array.isArray(saved) || typeof saved !== 'object') return {};
      const entries = Object.entries(saved).filter(([id, dish]) =>
        teams.some((t) => t.id === id) && demoDishes.includes(dish));
      if (entries.length > 19 || new Set(entries.map((item) => item[1])).size !== entries.length) return {};
      return Object.fromEntries(entries);
    } catch { return {}; }
  }
  function updateDemoProgress() {
    const left = Math.max(0, 19 - Object.keys(demoAssignments).length);
    currentStatus = left === 0 ? 'closed' : 'open';
    setStatus(left === 0
      ? 'ДЕМО завершено: все 19 блюд вытянуты. Ранее участвовавшие команды могут посмотреть своё блюдо.'
      : 'ДЕМО открыто: 26 ТОСов, 19 блюд. Задания выдаются до окончания списка.', currentStatus);
    showRemaining(left, true);
    updateControls();
  }
  async function initialize() {
    if (isDemo) {
      // Фиктивный набор допустим для проверки интерфейса и никогда не попадает в RPC.
      try {
        const response = await fetch('/culinary-battle/demo-data.json', { cache: 'no-store' });
        if (!response.ok) throw new Error('Демо-данные недоступны.');
        const data = await response.json();
        const valid = data.demo === true && data.teams?.length === 26 && data.dishes?.length === 19
          && new Set(data.teams.map((t) => t.id)).size === 26
          && new Set(data.teams.map((t) => t.name)).size === 26
          && new Set(data.dishes.map((d) => d.title)).size === 19
          && data.teams.every((t, i) => t.id === 'demo-' + String(i + 1).padStart(2, '0'))
          && data.dishes.every((d) => typeof d.title === 'string');
        if (!valid) throw new Error('Проверьте целостность тестовых списков.');
        teams = data.teams;
        demoDishes = data.dishes.map((d) => d.title);
        demoAssignments = getDemoAssignments();
        currentStatus = 'open';
        document.body.classList.add('battle-is-demo');
        const demoBanner = document.createElement('div');
        demoBanner.className = 'battle-demo-banner';
        demoBanner.setAttribute('role', 'note');
        demoBanner.textContent = 'ДЕМО · Реальные названия 26 ТОСов и 19 блюд. Пробные коды и результаты действуют только в вашем браузере, не являются настоящей жеребьёвкой.';
        $('battle-panel').prepend(demoBanner);
        document.querySelector('.battle-hint').textContent = 'Выберите ТОС, введите учебный код, вытяните блюдо из оставшихся и посмотрите карточку. Первые 19 учебных команд получат разные блюда в этом браузере.';
        document.querySelector('.battle-warning').textContent = 'Это только проверка интерфейса. Для настоящего мероприятия коды и задания будут защищены сервером.';
        document.querySelector('.battle-result-card .battle-small').textContent = 'Учебный результат не является конкурсным заданием. Его можно просмотреть повторно по тому же демонстрационному коду.';
        const codeHint = document.createElement('p');
        codeHint.id = 'battle-demo-code-hint';
        codeHint.className = 'battle-demo-code-hint';
        codeHint.setAttribute('aria-live', 'polite');
        codeHint.textContent = 'Выберите ТОС, чтобы увидеть его учебный код.';
        code.closest('.battle-code-field').after(codeHint);
        const updateDemoCode = () => {
          const index = teams.findIndex((entry) => entry.id === team.value);
          codeHint.textContent = index < 0
            ? 'Выберите ТОС, чтобы увидеть его учебный код.'
            : 'Демонстрационный код: DEMO-' + String(index + 1).padStart(2, '0') + '-2026';
          code.value = '';
        };
        team.addEventListener('change', updateDemoCode);
        search.addEventListener('input', updateDemoCode);
        refreshOptions();
        updateDemoProgress();
      } catch {
        setStatus('Ошибка загрузки демонстрационных данных. Обновите страницу позже.', 'draft');
        updateControls();
      }
      return;
    }
    if (!API_ENDPOINT) {
      setStatus('Жеребьёвка готовится к запуску. Участники и блюда подготовлены; индивидуальные коды будут выданы перед открытием.', 'draft');
      updateControls();
      return;
    }
    try {
      const data = await request('?event=' + encodeURIComponent(EVENT_SLUG));
      if (!Array.isArray(data.teams) || !['draft', 'ready', 'open', 'closed', 'published'].includes(data.status)) {
        throw new Error('Получен некорректный ответ сервера.');
      }
      if (data.total_teams !== 26 || data.total_dishes !== 19 || !Number.isInteger(data.remaining) || data.remaining < 0 || data.remaining > 19) {
        throw new Error('Неверные счётчики жеребьёвки.');
      }
      currentStatus = data.status;
      teams = data.teams
        .filter((t) => t && typeof t.id === 'string' && typeof t.name === 'string')
        .map((t) => ({ id: t.id, name: t.name }));
      const messages = {
        draft: 'Идёт подготовка мероприятия. Жеребьёвка пока закрыта.',
        ready: 'Участники и блюда проверены. Ожидаем открытия жеребьёвки.',
        open: 'Жеребьёвка открыта! Первые 19 ТОСов получают блюда. Выберите свою команду и введите код.',
        closed: data.remaining === 0
          ? 'Все 19 блюд распределены. Новое участие завершено; ранее выданное блюдо можно посмотреть по своему коду.'
          : 'Жеребьёвка закрыта организатором. Ранее выданное блюдо можно посмотреть по своему коду.',
        published: 'Мероприятие завершено. Своё задание можно посмотреть повторно по коду.'
      };
      setStatus(messages[currentStatus], currentStatus);
      showRemaining(data.remaining);
      refreshOptions();
      if (teams.length !== 26 && currentStatus === 'open') {
        setStatus('Список команд требует проверки организатором. Участие временно недоступно.', 'draft');
      }
      updateControls();
    } catch (err) {
      setStatus('Не получилось связаться с сервером жеребьёвки. Попробуйте обновить страницу позже.', 'draft');
      updateControls();
    }
  }
  function clearPreviousResult() {
    resultData = null;
    resultSection.hidden = true;
    result.hidden = true;
  }
  search.addEventListener('input', () => { clearPreviousResult(); refreshOptions(); });
  team.addEventListener('change', clearPreviousResult);
  function demoPick() {
    const index = teams.findIndex((entry) => entry.id === team.value);
    if (index < 0 || index >= 26) throw new Error('Выберите ТОС из списка.');
    const expectedCode = 'DEMO-' + String(index + 1).padStart(2, '0') + '-2026';
    if (code.value.trim().toUpperCase() !== expectedCode) {
      throw new Error('Для этого ТОСа указан другой учебный код.');
    }
    const existing = demoAssignments[team.value];
    if (existing) return { team_name: teams[index].name, dish_name: existing };
    const used = new Set(Object.values(demoAssignments));
    const free = demoDishes.filter((dish) => !used.has(dish));
    if (!free.length) throw new Error('Все 19 блюд уже распределены. Демо закончилось.');
    const dish = free[secureDemoIndex(free.length)];
    demoAssignments[team.value] = dish;
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(demoAssignments));
    updateDemoProgress();
    return { team_name: teams[index].name, dish_name: dish };
  }
  function displayTeamName(name) {
    return /^(?:учебный\s+)?ТОС(?=\s|«|$)/i.test(name) ? name : 'ТОС «' + name + '»';
  }
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
    clearPreviousResult();
    if (!team.value || !code.value.trim()) {
      setError('Выберите ТОС и введите ваш индивидуальный код.');
      return;
    }
    busy = true;
    updateControls();
    try {
      // Только в демо результат имитируется браузером. В реальном режиме определяет сервер.
      const data = isDemo ? demoPick() : await request('', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: EVENT_SLUG, team_id: team.value, code: code.value.trim() })
      });
      if (!data || typeof data.team_name !== 'string' || typeof data.dish_name !== 'string') {
        throw new Error('Сервер вернул неполный результат. Введите код повторно.');
      }
      resultData = { team: data.team_name, dish: data.dish_name };
      if (!isDemo && Number.isInteger(data.remaining)) {
        showRemaining(data.remaining);
        if (data.remaining === 0) {
          currentStatus = 'closed';
          setStatus('Все 19 блюд распределены. Новое участие завершено; свой результат доступен по коду.', 'closed');
        }
      }
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
      $('battle-result-team').textContent = displayTeamName(resultData.team);
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
    drawWrapped(ctx, displayTeamName(resultData.team), 540, 545, 850, 65, 3);
    ctx.fillStyle = '#77654E'; ctx.font = '750 40px system-ui, sans-serif';
    ctx.fillText('ВАШЕ БЛЮДО —', 540, 780);
    ctx.fillStyle = '#B62D36'; ctx.font = '900 71px system-ui, sans-serif';
    drawWrapped(ctx, resultData.dish, 540, 882, 890, 82, 3);
    ctx.fillStyle = '#453D37'; ctx.font = '500 30px system-ui, sans-serif';
    ctx.fillText('Готовьте с душой и удивляйте соседей!', 540, 1130, 875);
    ctx.font = '700 28px system-ui, sans-serif'; ctx.fillText('tosborisoglebsk.ru', 540, 1220);
    if (isDemo) {
      ctx.save();
      ctx.translate(540, 685);
      ctx.rotate(-0.20);
      ctx.textAlign = 'center';
      ctx.globalAlpha = .24;
      ctx.fillStyle = '#B62D36';
      ctx.font = '900 100px system-ui, sans-serif';
      ctx.fillText('ДЕМО · НЕ ДЛЯ БАТЛА', 0, 0, 950);
      ctx.restore();
    }
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = 'kulinarniy-batl-' + resultData.team.toLocaleLowerCase('ru').replace(/[^\p{L}\p{N}-]+/gu, '-').slice(0, 60) + '.png';
    link.click();
  });
  initialize();
})();
