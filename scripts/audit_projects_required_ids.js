const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const projectsPath = path.join(process.cwd(), 'data', 'projects.json');
const requiredIds = [
  'child-sport-playground',
  'memorial-renovation',
  'water-supply-improvement'
];

function main() {
  const errors = [];

  if (!fs.existsSync(projectsPath)) {
    throw new Error(`Missing file: ${projectsPath}`);
  }

  const projects = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
  if (!Array.isArray(projects)) {
    throw new Error('Projects required IDs audit failed:\ndata/projects.json must be an array');
  }

  const ids = new Set(projects.map((project) => project && project.id).filter(Boolean));

  requiredIds.forEach((id) => {
    if (!ids.has(id)) errors.push(`missing required project id ${id}`);
    if (!repoPathExists(`/projects/${id}/`)) errors.push(`missing required project page /projects/${id}/`);
  });

  if (errors.length) {
    throw new Error(`Projects required IDs audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Projects required IDs OK: ${requiredIds.length} projects`);
}

main();
