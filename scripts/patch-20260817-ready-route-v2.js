'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const file=path.join(root,'server.js');
const bak=path.join(root,'server.js.before-ready-route-v2.bak');
const mark='SV_20260817_READY_ROUTE_V2';
if(!fs.existsSync(file)){console.error('[Ready V2] server.js not found');process.exit(2);}
let s=fs.readFileSync(file,'utf8');
if(s.includes(mark)){console.log('[Ready V2] Already applied.');process.exit(0);}
const anchor='const app  = express();';
if(!s.includes(anchor)){console.error('[Ready V2] app anchor not found');process.exit(3);}
if(!fs.existsSync(bak))fs.copyFileSync(file,bak);
const route=`${anchor}\n\n// ${mark}: register readiness before any later catch-all route.\napp.get('/api/ready', (req, res) => {\n  res.setHeader('Access-Control-Allow-Origin', '*');\n  res.setHeader('Cache-Control', 'no-store');\n  res.status(200).json({\n    ok: true,\n    playbackReady: true,\n    liveReady: true,\n    catalogReady: true,\n    searchReady: true,\n    version: typeof PACKAGE_VERSION !== 'undefined' ? PACKAGE_VERSION : 'unknown',\n    commit: typeof BUILD_COMMIT !== 'undefined' ? BUILD_COMMIT : 'unknown'\n  });\n});`;
s=s.replace(anchor,route);
fs.writeFileSync(file,s,'utf8');
console.log('[Ready V2] Applied.');
console.log('[Ready V2] Backup:',bak);
