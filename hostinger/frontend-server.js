const http = require("http");

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/plain"
  });
  res.end("Frontend deployment placeholder");
}).listen(PORT, () => {
  console.log(`Frontend placeholder running on ${PORT}`);
});