const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const db = new sqlite3.Database(path.join(ROOT_DIR, 'data', 'db', 'streamvault.db'));

console.log('🧹 Creating database...');

db.serialize(() => {

  db.run(`DROP TABLE IF EXISTS movies`);

  db.run(`
    CREATE TABLE movies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      year INTEGER,
      poster TEXT,
      backdrop TEXT,
      rating REAL,
      streamUrl TEXT
    )
  `);

  console.log('📦 Reading catalog.json...');

  const catalog = JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, 'data', 'catalogs', 'catalog.json'), 'utf8')
  );

  const movies = catalog.movies || [];

  console.log(`🎬 Found ${movies.length} movies`);

  const stmt = db.prepare(`
    INSERT INTO movies (
      title,
      year,
      poster,
      backdrop,
      rating,
      streamUrl
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const m of movies) {

    stmt.run(
      m.name || m.title || '',
      m.year || null,
      m.poster || '',
      m.backdrop || '',
      m.rating || 0,
      m.streamUrl || m.file || ''
    );

  }

  stmt.finalize();

  db.run(`
    CREATE INDEX idx_movies_title
    ON movies(title)
  `);

  db.run(`
    CREATE INDEX idx_movies_year
    ON movies(year)
  `);

  db.get(
    `SELECT COUNT(*) as total FROM movies`,
    (err, row) => {

      console.log('');
      console.log('================================');
      console.log('✅ DATABASE BUILD COMPLETE');
      console.log('================================');
      console.log(`🎬 Movies inserted: ${row.total}`);
      console.log('💾 File created: streamvault.db');
      console.log('');

      db.close();

    }
  );

});
