const express = require("express");
const path = require("path");

const app = express();

const ROOT = __dirname;

app.disable("x-powered-by");
app.use(express.static(ROOT, {
  index: "index.html",
  setHeaders(res, filename) {
    if (filename.endsWith("index.html") || filename.endsWith("sw.js")) {
      res.setHeader("Cache-Control", "no-cache, no-store, max-age=0, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    } else if (/(?:home-feed|boot-search-index|channels)\.json$/i.test(filename)) {
      res.setHeader("Cache-Control", "no-cache, max-age=0, must-revalidate");
    } else if (/\.(?:css|js|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf)$/i.test(filename)) {
      res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
    }
  }
}));

app.use((req, res) => {
  if (/^\/(?:api|download|live|live-relay|proxy|stream|subtitles)(?:\/|$)/i.test(req.path)
    || /\.[a-z0-9]{2,8}$/i.test(req.path)) {
    return res.status(404).type('text/plain').send('Not found');
  }
  res.setHeader("Cache-Control", "no-cache, no-store, max-age=0, must-revalidate");
  res.sendFile(path.join(ROOT, "index.html"));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Frontend running on ${PORT}`);
});
