const fs = require('fs');
const path = require('path');

function repoPathExists(value) {
  if (!value) return false;

  if (value.startsWith('/')) {
    const clean = value.replace(/^\/+/, '');
    return fs.existsSync(path.join(process.cwd(), clean)) || fs.existsSync(path.join(process.cwd(), clean, 'index.html'));
  }

  return fs.existsSync(path.join(process.cwd(), value));
}

function extractRepoPathTokens(value) {
  if (!value) return [];

  return value
    .split(/\s+и\s+|,|;/)
    .map((part) => part.trim())
    .filter((part) => {
      if (/^(data|docs|scripts|assets|tos|news|projects|needs|done)\/[\w./-]+$/.test(part)) return true;
      return /^(registry|audit|site-health|github-tasks|css-maintenance|actions-check)(?:\/[\w./-]+)?$/.test(part);
    });
}

module.exports = {
  repoPathExists,
  extractRepoPathTokens
};
