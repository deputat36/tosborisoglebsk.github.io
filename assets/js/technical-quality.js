function qualityEsc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(2)} МБ`;
}

function issueLabel(key) {
  const labels = {
    missing_html_lang: 'Нет lang у HTML',
    missing_main_landmark: 'Нет main',
    missing_skip_link: 'Нет skip-link',
    images_missing_alt: 'Изображения без alt',
    images_without_lazy_loading: 'Контентные изображения без loading',
    buttons_without_type: 'Кнопки без type',
    form_controls_without_label: 'Поля без доступной подписи',
    external_blank_links_without_noopener: 'Небезопасные внешние ссылки',
    empty_or_hash_links: 'Пустые ссылки',
    many_inline_styles: 'Много inline-стилей'
  };
  return labels[key] || key;
}

function renderTechnicalQuality(report, root) {
  const summary = report.summary || {};
  const issueCounts = summary.issue_counts || {};
  const largest = report.largest_assets || [];
  const issueRows = Object.entries(issueCounts)
    .filter(([, count]) => Number(count) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map(([key, count]) => `<tr><td>${qualityEsc(issueLabel(key))}</td><td>${qualityEsc(count)}</td></tr>`)
    .join('');
  const assetRows = largest.slice(0, 10).map((asset) => `<tr><td><code>${qualityEsc(asset.path)}</code></td><td>${qualityEsc(asset.group)}</td><td>${qualityEsc(formatBytes(asset.size_bytes))}</td><td>${asset.over_budget ? '<span class="tag warn">выше бюджета</span>' : '<span class="tag ok">норма</span>'}</td></tr>`).join('');

  root.innerHTML = `
    <div class="grid">
      <article class="card"><div class="card-inner"><span class="tag">HTML</span><h3>${qualityEsc(summary.html_pages || 0)}</h3><p>Проверено страниц. С замечаниями: ${qualityEsc(summary.pages_with_issues || 0)}.</p></div></article>
      <article class="card"><div class="card-inner"><span class="tag">Доступность</span><h3>${qualityEsc(summary.issue_severity?.high || 0)}</h3><p>Замечаний высокого уровня. Средних: ${qualityEsc(summary.issue_severity?.medium || 0)}.</p></div></article>
      <article class="card"><div class="card-inner"><span class="tag">CSS + JS</span><h3>${qualityEsc(formatBytes((summary.total_css_bytes || 0) + (summary.total_js_bytes || 0)))}</h3><p>CSS: ${qualityEsc(formatBytes(summary.total_css_bytes))}; JS: ${qualityEsc(formatBytes(summary.total_js_bytes))}.</p></div></article>
      <article class="card"><div class="card-inner"><span class="tag">Изображения</span><h3>${qualityEsc(formatBytes(summary.total_image_bytes))}</h3><p>Ресурсов выше бюджета: ${qualityEsc(summary.over_budget_assets || 0)}.</p></div></article>
    </div>
    <div class="section-head" style="margin:22px 0 12px"><div><h3>Типы замечаний</h3><p>Baseline для постепенного исправления без ложного падения CI</p></div></div>
    ${issueRows ? `<div class="table"><table><thead><tr><th>Проверка</th><th>Количество</th></tr></thead><tbody>${issueRows}</tbody></table></div>` : '<div class="notice">Автоматические замечания не найдены.</div>'}
    <div class="section-head" style="margin:22px 0 12px"><div><h3>Самые тяжёлые ресурсы</h3><p>Первые десять файлов по размеру</p></div></div>
    ${assetRows ? `<div class="table"><table><thead><tr><th>Файл</th><th>Тип</th><th>Размер</th><th>Бюджет</th></tr></thead><tbody>${assetRows}</tbody></table></div>` : '<div class="notice">Ресурсы не найдены.</div>'}
    <div class="notice"><b>Ограничение отчёта:</b> автоматическая проверка не заменяет ручную проверку клавиатурой, контраста, фокуса и экранного диктора. Пустой <code>alt</code> допустим для декоративных изображений; ошибкой считается отсутствие атрибута.</div>
    <p class="tiny">Отчёт сформирован: ${report.generated_at ? new Date(report.generated_at).toLocaleString('ru-RU') : '—'}.</p>
  `;
}

async function loadTechnicalQuality() {
  const root = document.getElementById('site-health-technical-quality');
  if (!root) return;

  try {
    const response = await fetch('/data/accessibility_performance_report.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    renderTechnicalQuality(await response.json(), root);
  } catch {
    root.innerHTML = '<div class="notice">Отчёт доступности и производительности ещё не сформирован. Запустите основной workflow генерации.</div>';
  }
}

loadTechnicalQuality();
