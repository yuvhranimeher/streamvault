'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),file=path.join(root,'server.js'),bak=path.join(root,'server.js.before-startup-v5.bak'),mark='SV_20260817_STARTUP_V5';
let s=fs.readFileSync(file,'utf8');
if(s.includes(mark)){console.log('[Startup V5] Already applied.');process.exit(0);}
const old="    const audioOnly = req.query.audioOnly === '1';\n    const [info, sidecarSubtitleTracks] = await Promise.all([\n      audioOnly ? getCachedAudioOnlyMediaInfo(media.decodedUrl) : getCachedMediaInfo(media.decodedUrl),\n      audioOnly ? Promise.resolve([]) : discoverRemoteSubtitleTracks(media.decodedUrl, req).catch(() => [])\n    ]);\n    if (audioOnly && req.query.playbackType === 'media') {";
const neu="    const audioOnly = req.query.audioOnly === '1';\n    const startupProbe = req.query.startup === '1';\n    const [info, sidecarSubtitleTracks] = await Promise.all([\n      audioOnly ? getCachedAudioOnlyMediaInfo(media.decodedUrl) : getCachedMediaInfo(media.decodedUrl),\n      (audioOnly || startupProbe) ? Promise.resolve([]) : discoverRemoteSubtitleTracks(media.decodedUrl, req).catch(() => [])\n    ]);\n    // "+mark+"\n    if (startupProbe) {\n      const audioTracks = Array.isArray(info.audioTracks) ? info.audioTracks : [];\n      return res.json({ok:true,requestedUrl:media.requestedUrl,decodedUrl:media.decodedUrl,matchedCatalogItem:matched,playUrl:urls.finalPlayUrl,finalPlayUrl:urls.finalPlayUrl,...info,audioTracks,sidecarSubtitleTracks:[],duration:Number(info.duration)||0,ftpAudioValidated:false,startupProbe:true});\n    }\n    if (audioOnly && req.query.playbackType === 'media') {";
if(!s.includes(old)){console.error('[Startup V5] block not found');process.exit(3);}
if(!fs.existsSync(bak))fs.copyFileSync(file,bak);
fs.writeFileSync(file,s.replace(old,neu),'utf8');
console.log('[Startup V5] Applied.');
