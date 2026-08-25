'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const file=path.join(root,'server.js');
const bak=path.join(root,'server.js.before-startup-v6.bak');
const mark='SV_20260817_STARTUP_V6';
let s=fs.readFileSync(file,'utf8');
if(s.includes(mark)){console.log('[Startup V6] Already applied.');process.exit(0);}
const rs=s.indexOf("app.get(['/api/ftp/media-info', '/api/ftp/info'], async (req, res) => {");
const re=s.indexOf("\napp.get('/api/ftp/subtitle/:track.vtt'",rs);
if(rs<0||re<0){console.error('[Startup V6] media-info route not found');process.exit(3);}
const block=s.slice(rs,re);
const needle="    const audioOnly = req.query.audioOnly === '1';";
const p=block.indexOf(needle);
if(p<0){console.error('[Startup V6] anchor not found');process.exit(4);}
const at=rs+p+needle.length;
const code=`\n    // ${mark}\n    if (req.query.startup === '1') {\n      const info = await getCachedMediaInfo(media.decodedUrl);\n      return res.json({\n        ok:true, requestedUrl:media.requestedUrl, decodedUrl:media.decodedUrl,\n        matchedCatalogItem:matched, playUrl:urls.finalPlayUrl, finalPlayUrl:urls.finalPlayUrl,\n        ...info, audioTracks:Array.isArray(info.audioTracks)?info.audioTracks:[],\n        sidecarSubtitleTracks:[], duration:Number(info.duration)||0,\n        ftpAudioValidated:false, startupProbe:true\n      });\n    }`;
if(!fs.existsSync(bak))fs.copyFileSync(file,bak);
s=s.slice(0,at)+code+s.slice(at);
fs.writeFileSync(file,s,'utf8');
console.log('[Startup V6] Applied.');
console.log('[Startup V6] Backup:',bak);
