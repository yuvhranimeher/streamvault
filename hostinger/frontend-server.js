const express = require("express");
const path = require("path");

const app = express();

const ROOT = __dirname;

app.disable("x-powered-by");
app.use(express.static(ROOT, {
  index: "index.html",
  setHeaders(res, filename) {
    if (filename.endsWith("index.html") || filename.endsWith("sw.js")) {
      res.setHeader("Cache-Control", "no-cache");
    }
  }
}));

app.use((req, res) => {
  res.sendFile(path.join(ROOT, "index.html"));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Frontend running on ${PORT}`);
});
