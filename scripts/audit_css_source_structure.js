const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SOURCE_PATH = path.join(ROOT, 'assets', 'css', 'styles.css');
const FINGERPRINT_PATH = path.join(ROOT, 'data', 'css_source_fingerprint.json');
const CANDIDATE_PATH = process.env.CSS_STRUCTURE_CANDIDATE
  ? path.resolve(ROOT, process.env.CSS_STRUCTURE_CANDIDATE)
  : null;
const REPORT_PATH = path.resolve(
  ROOT,
  process.env.CSS_STRUCTURE_REPORT || '.artifacts/css-source-structure/report.json'
);

const SECTION_TITLES = [
  '01. Переменные и темы',
  '02. Базовые стили и доступность',
  '03. Шапка и навигация',
  '04. Кнопки и группы действий',
  '05. Hero-блоки',
  '06. Секции, сетки и карточки',
  '07. Формы, фильтры и элементы ТОС',
  '08. Текст, уведомления и таблицы',
  '09. Футер и вспомогательные списки',
  '10. Статистика и KPI',
  '11. Специальные блоки главной',
  '12. Адаптивные правила',
  '13. Дополнительные компоненты',
  '14. Печать'
];

function read(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${path.relative(ROOT, filePath)}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function removeComments(source) {
  let result = '';
  let quote = '';
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (quote) {
      result += char;
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = '';
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      result += char;
      continue;
    }

    if (char === '/' && next === '*') {
      index += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
        index += 1;
      }
      index += 1;
      continue;
    }

    result += char;
  }

  if (quote) throw new Error('Unclosed CSS string while removing comments');
  return result;
}

function canonicalize(source) {
  const clean = removeComments(source);
  const punctuation = new Set(['{', '}', ':', ';', ',', '(', ')']);
  let result = '';
  let quote = '';
  let escaped = false;
  let pendingSpace = false;

  for (const char of clean) {
    if (quote) {
      result += char;
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = '';
      }
      continue;
    }

    if (char === '"' || char === "'") {
      if (pendingSpace && result && !punctuation.has(result[result.length - 1])) result += ' ';
      pendingSpace = false;
      quote = char;
      result += char;
      continue;
    }

    if (/\s/.test(char)) {
      pendingSpace = true;
      continue;
    }

    if (punctuation.has(char)) {
      result = result.replace(/\s+$/, '');
      result += char;
      pendingSpace = false;
      continue;
    }

    if (pendingSpace && result && !punctuation.has(result[result.length - 1])) result += ' ';
    pendingSpace = false;
    result += char;
  }

  if (quote) throw new Error('Unclosed CSS string while canonicalizing');
  return result.trim();
}

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function auditSections(css, errors) {
  let previousIndex = -1;
  for (const title of SECTION_TITLES) {
    const marker = `/* ${title} */`;
    const count = css.split(marker).length - 1;
    if (count !== 1) errors.push(`${marker}: expected once, found ${count}`);
    const currentIndex = css.indexOf(marker);
    if (currentIndex <= previousIndex) errors.push(`${marker}: section order is invalid`);
    previousIndex = currentIndex;
  }
}

function main() {
  const errors = [];
  const source = read(SOURCE_PATH);
  const targetPath = CANDIDATE_PATH || SOURCE_PATH;
  const target = read(targetPath);
  const sourceCanonical = canonicalize(source);
  const targetCanonical = canonicalize(target);
  const sourceHash = sha256(sourceCanonical);
  const targetHash = sha256(targetCanonical);

  auditSections(target, errors);

  let expectedHash = sourceHash;
  let mode = 'candidate';

  if (CANDIDATE_PATH) {
    if (sourceHash !== targetHash) {
      errors.push(`candidate canonical SHA-256 differs: ${sourceHash} != ${targetHash}`);
    }
  } else {
    mode = 'repository';
    const fingerprint = JSON.parse(read(FINGERPRINT_PATH));
    expectedHash = String(fingerprint.canonical_sha256 || '');
    if (fingerprint.schema_version !== 1) errors.push('css source fingerprint schema_version must be 1');
    if (fingerprint.source_path !== 'assets/css/styles.css') errors.push('css source fingerprint source_path is invalid');
    if (fingerprint.section_count !== SECTION_TITLES.length) errors.push(`css source fingerprint section_count must be ${SECTION_TITLES.length}`);
    if (!/^[a-f0-9]{64}$/.test(expectedHash)) errors.push('css source fingerprint canonical_sha256 is invalid');
    if (expectedHash !== targetHash) {
      errors.push(`repository canonical SHA-256 differs from approved fingerprint: ${expectedHash} != ${targetHash}`);
    }
  }

  const lines = target.split(/\r?\n/);
  const maxLineLength = Math.max(...lines.map((line) => line.length));
  if (maxLineLength > 240) errors.push(`formatted CSS contains a line longer than 240 characters: ${maxLineLength}`);

  const report = {
    schema_version: 1,
    mode,
    source_path: 'assets/css/styles.css',
    target_path: path.relative(ROOT, targetPath).replace(/\\/g, '/'),
    canonical_sha256: targetHash,
    expected_canonical_sha256: expectedHash,
    canonical_equal: targetHash === expectedHash,
    section_count: SECTION_TITLES.length,
    line_count: lines.length,
    max_line_length: maxLineLength,
    errors: Array.from(new Set(errors))
  };

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  if (errors.length) {
    throw new Error(`CSS source structure audit failed:\n${report.errors.join('\n')}`);
  }

  console.log(`CSS source structure OK: ${SECTION_TITLES.length} sections, canonical SHA-256 ${targetHash}`);
}

main();
