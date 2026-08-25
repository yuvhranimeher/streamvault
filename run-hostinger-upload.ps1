cd "C:\Users\Mac Mini\Desktop\Website Host\Streaming_Website\streamvault"
node tools\cache-hostinger-assets.js --all 2>&1 | Tee-Object -Append -FilePath hostinger-asset-upload.log
