const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TOSES_PATH = path.join(ROOT, 'data', 'toses.json');
const LOGO_DIR = path.join(ROOT, 'assets', 'img', 'tos-logos');
const PUBLIC_DIR = '/assets/img/tos-logos';
const EXTENSIONS = ['svg', 'png', 'jpg', 'jpeg', 'webp'];

function readJson(file, fallback = []) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function findLogo(slug) {
  if (!slug || !fs.existsSync(LOGO_DIR)) return '';
  for (const ext of EXTENSIONS) {
    const fileName = `${slug}.${ext}`;
    if (fs.existsSync(path.join(LOGO_DIR, fileName))) return `${PUBLIC_DIR}/${fileName}`;
  }
  return '';
}

function main() {
  const toses = readJson(TOSES_PATH);
  let changed = 0;
  let found = 0;

  for (const tos of toses) {
    if (!tos || !tos.slug) continue;
    const logo = findLogo(tos.slug);
    if (!logo) continue;
    found += 1;
    if (tos.logo !== logo) {
      tos.logo = logo;
      changed += 1;
    }
  }

  writeJson(TOSES_PATH, toses);
  console.log(`TOS logo files found: ${found}`);
  console.log(`TOS logo paths updated: ${changed}`);
}

main();
