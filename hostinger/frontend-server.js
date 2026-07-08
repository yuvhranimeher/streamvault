const express = require("express");
const path = require("path");

const app = express();

const ROOT = __dirname;

app.use(express.static(ROOT));

app.get("*", (req,res)=>{
  res.sendFile(path.join(ROOT,"index.html"));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT,()=>{
  console.log(`Frontend running on ${PORT}`);
});