const fs = require("fs");
const path = require("path");
const axios = require("axios");
const sharp = require("sharp");
const slugify = require("slugify");

const RAWG_KEY = "3c5382f31fb7436090bb9f2b2fccab5a";

const raw = require("./software-library.json");

const catalog = raw.packages || [];

const POSTER_DIR = path.join(
  __dirname,
  "public/posters/games"
);

if (!fs.existsSync(POSTER_DIR)) {
  fs.mkdirSync(POSTER_DIR, {
    recursive: true
  });
}

function cleanTitle(title = "") {
  return title
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/DODI|FitGirl|nosTEAM|GoldBerg/gi, "")
    .replace(/Repack/gi, "")
    .replace(/v\d+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function searchRAWG(title) {
  try {
    const url =
      `https://api.rawg.io/api/games?key=${RAWG_KEY}&search=${encodeURIComponent(title)}`;

    const { data } = await axios.get(url, {
      timeout: 15000
    });

    if (!data.results?.length) {
      return null;
    }

    return data.results[0];

  } catch (err) {
    console.log("RAWG ERROR:", title);
    return null;
  }
}

async function downloadPoster(url, output) {
  try {
    const response = await axios({
      url,
      method: "GET",
      responseType: "arraybuffer",
      timeout: 20000
    });

    await sharp(response.data)
      .resize(300, 450, {
        fit: "cover"
      })
      .webp({
        quality: 70
      })
      .toFile(output);

    return true;

  } catch (err) {
    return false;
  }
}

async function run() {

  console.log("");
  console.log("================================");
  console.log(" STREAMVAULT POSTER DOWNLOADER ");
  console.log("================================");
  console.log("");

  console.log("Packages:", catalog.length);
  console.log("");

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const item of catalog) {

    try {

      const originalTitle =
        item.title || item.name || "";

      const title =
        cleanTitle(originalTitle);

      if (!title) {
        failed++;
        continue;
      }

      const filename =
        slugify(title, {
          lower: true,
          strict: true
        }) + ".webp";

      const savePath =
        path.join(POSTER_DIR, filename);

      if (fs.existsSync(savePath)) {

        item.poster =
          `/posters/games/${filename}`;

        console.log("SKIP:", title);

        skipped++;
        continue;
      }

      console.log("");
      console.log("SEARCH:", title);

      const game =
        await searchRAWG(title);

      if (!game?.background_image) {

        console.log("NO POSTER");

        failed++;
        continue;
      }

      const downloaded =
        await downloadPoster(
          game.background_image,
          savePath
        );

      if (!downloaded) {

        console.log("DOWNLOAD FAILED");

        failed++;
        continue;
      }

      item.poster =
        `/posters/games/${filename}`;

      item.posterSource =
        "RAWG";

      console.log("SAVED:", filename);

      success++;

      await new Promise(resolve =>
        setTimeout(resolve, 500)
      );

    } catch (err) {

      console.log("ERROR");

      failed++;
    }
  }

  fs.writeFileSync(
    "./software-library.json",
    JSON.stringify(raw, null, 2)
  );

  console.log("");
  console.log("================================");
  console.log(" FINISHED ");
  console.log("================================");
  console.log("");

  console.log("SUCCESS:", success);
  console.log("FAILED :", failed);
  console.log("SKIPPED:", skipped);

  console.log("");
  console.log("Saved to:");
  console.log("public/posters/games/");
  console.log("");
}

run();