const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const assets = [
  {
    source: path.join(root, 'lib', 'frontend-player-ui.js'),
    targets: [
      path.join(root, 'public', 'frontend-player-ui.js'),
      path.join(root, 'hostinger', 'frontend-player-ui.js')
    ]
  },
  {
    source: path.join(root, 'lib', 'frontend-playback-session.js'),
    targets: [
      path.join(root, 'public', 'frontend-playback-session.js'),
      path.join(root, 'hostinger', 'frontend-playback-session.js')
    ]
  }
];

let generated = 0;
for (const asset of assets) {
  const content = fs.readFileSync(asset.source, 'utf8');
  for (const target of asset.targets) {
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== content) fs.writeFileSync(target, content, 'utf8');
    generated += 1;
  }
}

console.log(`Generated ${generated} frontend playback assets from ${assets.length} shared sources`);
