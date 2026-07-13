const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const STYLES_PATH = path.join(ROOT, 'assets/css/styles.css');
const HOME_STATS_PATH = path.join(ROOT, 'assets/js/home-stats.js');
const errors = [];

function read(filePath) {
  if (!fs.existsSync(filePath)) {
    errors.push(`missing required file ${path.relative(ROOT, filePath)}`);
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

function requireTokens(text, tokens, context) {
  tokens.forEach((token) => {
    if (!text.includes(token)) errors.push(`${context} must contain ${token}`);
  });
}

const styles = read(STYLES_PATH);
const homeStats = read(HOME_STATS_PATH);

requireTokens(homeStats, [
  "['ТОСов в каталоге',pt.length",
  "['Жителей охвачено',population?population.toLocaleString('ru-RU'):'уточняется'",
  "stats.map(([label,value,hint])",
  '<b>${esc(value)}</b>',
  '<span>${esc(label)}</span>'
], 'homepage stats');

if (homeStats.includes('stats.map(([value,label,hint])')) {
  errors.push('homepage stats must not render labels as large values');
}

requireTokens(styles, [
  '.skip-link{position:absolute;left:12px',
  'transform:translateY(calc(-100% - 20px))',
  '.skip-link:focus{transform:translateY(0)}',
  '.stat-card{grid-column:span 3;min-width:0',
  '.stat-card b{display:block',
  'overflow-wrap:anywhere',
  '@media(max-width:620px)',
  '.header-inner{gap:8px}',
  '.brand{min-width:0;flex:1 1 auto}',
  '.brand img{height:36px;max-width:100%}',
  '.actions{gap:4px;flex:0 0 auto}',
  '.header .actions .btn{padding:7px 8px;font-size:13px}'
], 'responsive styles');

if (styles.includes('left:-999px')) errors.push('skip-link must not use large negative horizontal positioning');
if (styles.includes('.skip-link:focus{left:12px}')) errors.push('skip-link focus must restore transform instead of changing left');

if (errors.length) {
  throw new Error(`Visual overflow fix audit failed:\n${errors.join('\n')}`);
}

console.log('Visual overflow fix audit OK: stats semantics, skip-link and mobile header are guarded');
