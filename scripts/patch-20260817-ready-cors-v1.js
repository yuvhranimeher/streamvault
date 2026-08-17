'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const file=path.join(root,'server.js');
const bak=path.join(root,'server.js.before-20260817-ready-cors-v1.bak');
const mark='SV_20260817_READY_CORS_V1';
let s=fs.readFileSync(file,'utf8');
if(s.includes(mark)){console.log('[Ready/CORS V1] Already applied.');process.exit(0);}
const needle="const app  = express();";
if(!s.includes(needle)){console.error('[Ready/CORS V1] app declaration not found');process.exit(3);}
const block=`const app  = express();\n\n// ${mark}: make split-origin frontend search/readiness reliable.\napp.use((req,res,next)=>{\n  const origin=String(req.headers.origin||'');\n  if(origin==='https://streamvault.fit'||origin==='https://www.streamvault.fit'){\n    res.setHeader('Access-Control-Allow-Origin',origin);\n    res.setHeader('Vary','Origin');\n  }\n  res.setHeader('Access-Control-Allow-Methods','GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS');\n  res.setHeader('Access-Control-Allow-Headers','Accept, Content-Type, Range, Cache-Control, Pragma, Authorization');\n  res.setHeader('Access-Control-Expose-Headers','Content-Range, Accept-Ranges, Content-Length, Content-Type, X-StreamVault-Search-Version');\n  if(req.method==='OPTIONS')return res.sendStatus(204);\n  next();\n});\n\napp.get('/api/ready',(req,res)=>{\n  res.setHeader('Cache-Control','no-store');\n  res.json({\n    ok:true,\n    playbackReady:true,\n    liveReady:true,\n    catalogReady:true,\n    searchReady:true,\n    detailsReady:true,\n    version:typeof PACKAGE_VERSION==='string'?PACKAGE_VERSION:'unknown',\n    commit:typeof BUILD_COMMIT==='string'?BUILD_COMMIT:'unknown'\n  });\n});`;
if(!fs.existsSync(bak))fs.copyFileSync(file,bak);
s=s.replace(needle,block);
fs.writeFileSync(file,s,'utf8');
console.log('[Ready/CORS V1] Applied.');
console.log('[Ready/CORS V1] Backup:',bak);
