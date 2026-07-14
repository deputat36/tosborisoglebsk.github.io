const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const INPUT_PATH = path.resolve(
  ROOT,
  process.env.CSS_STRUCTURE_PRETTIER_INPUT || '.artifacts/css-source-structure/styles.with-sections.css'
);
const OUTPUT_PATH = path.resolve(
  ROOT,
  process.env.CSS_STRUCTURE_CANDIDATE || '.artifacts/css-source-structure/styles.css'
);

function formatCssWhitespaceOnly(source) {
  const output = [];
  let indent = 0;
  let lineStart = true;
  let quote = '';
  let escaped = false;
  let parenDepth = 0;

  function trimTrailingSpaces() {
    while (output.length && (output[output.length - 1] === ' ' || output[output.length - 1] === '\t')) {
      output.pop();
    }
  }

  function newline(blank = false) {
    trimTrailingSpaces();
    if (!output.length || output[output.length - 1] !== '\n') output.push('\n');
    if (blank && (output.length < 2 || output[output.length - 2] !== '\n')) output.push('\n');
    lineStart = true;
  }

  function emit(value) {
    if (lineStart) {
      output.push('  '.repeat(indent));
      lineStart = false;
    }
    output.push(value);
  }

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (quote) {
      emit(char);
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
      emit(char);
      continue;
    }

    if (char === '/' && next === '*') {
      newline(true);
      let end = index + 2;
      while (end < source.length - 1 && !(source[end] === '*' && source[end + 1] === '/')) {
        end += 1;
      }
      if (end >= source.length - 1) throw new Error('Unclosed CSS comment');
      emit(source.slice(index, end + 2).trim());
      newline(true);
      index = end + 1;
      continue;
    }

    if (char === '\r' || char === '\n' || char === '\t') continue;

    if (char === ' ') {
      if (!lineStart && output.length && output[output.length - 1] !== ' ' && output[output.length - 1] !== '\n') {
        output.push(' ');
      }
      continue;
    }

    if (char === '{') {
      trimTrailingSpaces();
      if (output.length && output[output.length - 1] !== ' ' && output[output.length - 1] !== '\n') output.push(' ');
      emit('{');
      indent += 1;
      newline();
      continue;
    }

    if (char === ';' && parenDepth === 0) {
      emit(';');
      newline();
      continue;
    }

    if (char === '}' && parenDepth === 0) {
      if (!lineStart) newline();
      indent = Math.max(0, indent - 1);
      emit('}');
      newline(indent === 0);
      continue;
    }

    if (char === '(') parenDepth += 1;
    if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
    emit(char);
  }

  if (quote) throw new Error('Unclosed CSS string');
  if (parenDepth !== 0) throw new Error(`Unbalanced CSS parentheses: ${parenDepth}`);
  if (indent !== 0) throw new Error(`Unbalanced CSS blocks: ${indent}`);

  while (output.length && output[output.length - 1] === '\n') output.pop();
  return `${output.join('')}\n`;
}

function main() {
  if (!fs.existsSync(INPUT_PATH)) throw new Error(`Missing input: ${path.relative(ROOT, INPUT_PATH)}`);
  const formatted = formatCssWhitespaceOnly(fs.readFileSync(INPUT_PATH, 'utf8'));
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, formatted, 'utf8');
  console.log(`Whitespace-only CSS formatting OK: ${formatted.split(/\r?\n/).length - 1} lines`);
}

module.exports = { formatCssWhitespaceOnly };

if (require.main === module) main();
