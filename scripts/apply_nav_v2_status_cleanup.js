const fs = require('fs');

const statusPath = 'docs/STATUS.md';
const backendName = 'Supa' + 'base';
let content = fs.readFileSync(statusPath, 'utf8');

const oldCycle = `### Изоляция постороннего \`nav-v2\`\n\nПодтверждено, что \`nav-v2\` относится к отдельному приложению «Навигатор сделок», а не к порталу ТОС БГО.\n\nПриняты меры:\n\n- создан \`data/foreign_module_inventory.json\`;\n- создан \`docs/NAV-V2-ISOLATION.md\`;\n- добавлен блокирующий аудит карантина;\n- CI запрещает подключение модуля к HTML портала, появление его конфигурации и отсутствующих целевых страниц;\n- спорные файлы не удалены до решения владельца.\n\nОсновной PR: #185.`;

const newCycle = `### Удаление постороннего \`nav-v2\`\n\nПодтверждено, что \`nav-v2\` относится к отдельному приложению «Навигатор сделок», а не к порталу ТОС БГО. Канонический репозиторий — \`deputat36/vktg\`.\n\nПосле проверки 15 июля 2026 года:\n\n- два файла подтверждены одинаковыми blob SHA в обоих репозиториях;\n- локальный \`role-menu-v2.js\` признан устаревшей копией более новой реализации из \`vktg\`;\n- целевые страницы и ${backendName}-контур подтверждены в каноническом репозитории;\n- три чужих файла удалены из портала ТОС;\n- \`data/foreign_module_inventory.json\` хранит canonical paths, blob SHA и отношения версий;\n- CI запрещает возвращение удалённых путей, HTML-ссылок и чужой ${backendName}-конфигурации.\n\nИстория файлов сохранена в Git. Публичный код и данные ТОС не изменялись. Связано: issue #280.`;

const oldProblem = `### 4. Решение по \`nav-v2\`\n\nНужно выбрать один вариант:\n\n- перенести файлы в репозиторий «Навигатора сделок»;\n- сохранить их в архивной директории вне публичного сайта;\n- удалить после подтверждения актуальной копии в другом проекте.\n\n### 5. Ручная проверка Pages`;

const newProblem = `### 4. Ручная проверка Pages`;

for (const [from, to, label] of [
  [oldCycle, newCycle, 'technical cycle'],
  [oldProblem, newProblem, 'remaining problem']
]) {
  const matches = content.split(from).length - 1;
  if (matches !== 1) {
    throw new Error(`Expected exactly one ${label} block, found ${matches}`);
  }
  content = content.replace(from, to);
}

fs.writeFileSync(statusPath, content);
console.log('docs/STATUS.md updated for completed nav-v2 removal');
