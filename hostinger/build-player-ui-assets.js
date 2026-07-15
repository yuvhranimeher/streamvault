const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'lib', 'frontend-player-ui.js');
const targets = [
  path.join(root, 'public', 'frontend-player-ui.js'),
  path.join(root, 'hostinger', 'frontend-player-ui.js')
];

const content = fs.readFileSync(source, 'utf8');
for (const target of targets) {
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== content) fs.writeFileSync(target, content, 'utf8');
}

console.log(`Generated ${targets.length} frontend player UI assets from ${path.relative(root, source)}`);
