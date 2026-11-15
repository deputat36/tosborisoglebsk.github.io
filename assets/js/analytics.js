(function () {
  'use strict';
  const C = window.TosAnalytics;
  if (!C || document.documentElement.dataset.analyticsBooted) return;
  const noindex = /noindex/i.test(document.querySelector('meta[name="robots"]')?.content || '');
  if (!C.eligible(window.location, noindex)) return;
  document.documentElement.dataset.analyticsBooted = 'true';
  const signal = navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';
  let choice = null;
  let started = false;
  let banner;
  let status = 'Статистика выключена. Выбор ещё не сделан.';
  try { choice = C.readChoice(localStorage.getItem(C.storageKey), Date.now()); } catch (_) { /* Storage is optional. */ }
  if (signal) status = 'Статистика выключена: браузер передал запрет отслеживания.';

  function showStatus(value) {
    status = value;
    document.querySelectorAll('[data-analytics-status]').forEach(node => { node.textContent = value; });
  }
  function start() {
    if (started || signal || choice !== 'granted') return;
    started = true;
    document.documentElement.dataset.analyticsState = 'loading';
    showStatus('Аналитика разрешена. Счётчик загружается.');
    const url = C.pageUrl(window.location);
    const source = C.referrer(document.referrer);
    window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments); };
    window.ym.l = Date.now();
    document.addEventListener('yacounter' + C.counterId + 'inited', function () {
      document.documentElement.dataset.analyticsState = 'active';
      showStatus('Аналитика разрешена. Счётчик подключён.');
    }, { once: true });
    window.ym(C.counterId, 'init', C.initOptions(url, source));
    window.ym(C.counterId, 'hit', url, { referer: source, title: 'ТОС БГО' });
    const script = document.createElement('script');
    script.id = 'tos-metrica-tag';
    script.async = true;
    script.referrerPolicy = 'origin';
    script.src = 'https://mc.yandex.ru/metrika/tag.js?id=' + C.counterId;
    script.onerror = function () {
      document.documentElement.dataset.analyticsState = 'unavailable';
      showStatus('Аналитика разрешена, но счётчик недоступен. Сайт продолжает работать.');
    };
    document.head.appendChild(script);
  }
  function choose(value, persist = true) {
    const wasStarted = started;
    choice = value;
    let saved = true;
    if (persist) {
      try { localStorage.setItem(C.storageKey, C.serializeChoice(value, Date.now())); } catch (_) { saved = false; }
    }
    if (banner) banner.remove();
    document.documentElement.style.removeProperty('--analytics-space');
    document.documentElement.dataset.analyticsState = value === 'denied' ? 'off' : 'loading';
    if (value === 'denied') {
      showStatus('Статистика выключена.' + (saved ? '' : ' Браузер не сохранил выбор: после закрытия страницы он будет сброшен.'));
      // Re-enter this safe settings page to stop all already loaded third-party code.
      if (wasStarted) {
        if (saved) window.location.reload();
        else window.location.replace('/privacy/?analytics=off#analytics');
      }
    } else {
      start();
      if (!saved) showStatus('Аналитика разрешена для этой страницы. Браузер не сохранил выбор.');
    }
  }
  function ready() {
    // This explicit one-page opt-out also works when browser storage is blocked.
    if (new URLSearchParams(window.location.search).get('analytics') === 'off') choice = 'denied';
    const footer = document.querySelector('footer .container') || document.querySelector('footer');
    if (footer && !footer.querySelector('[data-analytics-settings-link]')) {
      const p = document.createElement('p'); p.className = 'analytics-settings-link';
      const a = document.createElement('a'); a.href = '/privacy/#analytics';
      a.dataset.analyticsSettingsLink = ''; a.textContent = 'Настройки аналитики';
      p.appendChild(a); footer.appendChild(p);
    }
    document.querySelectorAll('[data-analytics-controls]').forEach(node => { node.hidden = false; });
    document.querySelectorAll('[data-analytics-choice]').forEach(button => {
      button.disabled = signal && button.dataset.analyticsChoice === 'granted';
      button.addEventListener('click', () => choose(button.dataset.analyticsChoice));
    });
    document.documentElement.dataset.analyticsState = 'off';
    if (signal) showStatus(status);
    else if (choice === 'granted') start();
    else if (choice === 'denied') showStatus('Статистика выключена.');
    else {
      banner = document.createElement('section');
      banner.className = 'analytics-choice'; banner.setAttribute('aria-label', 'Выбор аналитики');
      banner.innerHTML = '<div><strong>Помочь улучшить сайт?</strong><p>Яндекс Метрика покажет посещаемость и полезные разделы. Разрешить аналитические cookies? <a href="/privacy/#analytics">Подробнее</a></p></div><div class="analytics-choice-actions"><button class="btn" type="button" data-choice="denied">Без аналитики</button><button class="btn" type="button" data-choice="granted">Разрешить</button></div>';
      banner.querySelectorAll('button').forEach(button => { button.addEventListener('click', () => choose(button.dataset.choice)); });
      document.body.appendChild(banner);
      function size() { if (banner?.isConnected) document.documentElement.style.setProperty('--analytics-space', banner.getBoundingClientRect().height + 'px'); }
      size();
      if (typeof ResizeObserver !== 'undefined') new ResizeObserver(size).observe(banner);
      showStatus(status);
    }
  }
  window.addEventListener('storage', event => {
    if (event.key !== C.storageKey && event.key !== null) return;
    const next = C.readChoice(event.newValue, Date.now());
    if (next !== 'granted' && started) window.location.reload();
    else if (next && next !== choice) choose(next, false);
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, { once: true });
  else ready();
})();
