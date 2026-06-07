# Details/TMDB Parity V1

Goal: compare Node `/api/details/:type/:id` against Haskell shadow details.

Do not touch:
- playback
- live TV
- FFmpeg/HLS
- player UI
- poster-cache
- service worker

Next:
1. collect Node detail fixtures
2. build Haskell native detail response
3. compare JSON field parity
