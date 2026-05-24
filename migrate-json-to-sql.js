
const fs = require('fs')
const path = require('path')
const sqlite3 = require('sqlite3').verbose()

const ROOT = __dirname

const DB_PATH = path.join(ROOT, 'data', 'db', 'streamvault-main.db')
const JSON_DIR = path.join(ROOT, 'data', 'catalogs')
const BACKUP_DIR = path.join(ROOT, 'data', 'catalogs', 'json-backup')

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true })
}

const db = new sqlite3.Database(DB_PATH)

const FILES = [
  'catalog.json',
  'approved-clean-catalog.json',
  'software-library.json',
  'software-catalog.json',
  'downloads-catalog.json'
]

function tableName(file) {
  return file
    .replace('.json', '')
    .replace(/[^a-z0-9]/gi, '_')
    .toLowerCase()
}

function getItems(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data.movies)) return data.movies
  if (Array.isArray(data.series)) return data.series
  if (Array.isArray(data.downloads)) return data.downloads
  if (Array.isArray(data.items)) return data.items
  return []
}

function processFile(index) {

  if (index >= FILES.length) {
    db.close()
    console.log('\nDONE')
    return
  }

  const file = FILES[index]

  const fullPath = path.join(JSON_DIR, file)

  if (!fs.existsSync(fullPath)) {
    console.log('Missing:', file)
    processFile(index + 1)
    return
  }

  console.log('\nProcessing:', file)

  let raw

  try {
    raw = fs.readFileSync(fullPath, 'utf8')
  } catch (err) {
    console.log('Read failed:', file)
    processFile(index + 1)
    return
  }

  let json

  try {
    json = JSON.parse(raw)
  } catch (err) {
    console.log('JSON parse failed:', file)
    processFile(index + 1)
    return
  }

  const items = getItems(json)

  if (!items.length) {
    console.log('No items:', file)
    processFile(index + 1)
    return
  }

  const table = tableName(file)

  const createSQL =
    'CREATE TABLE IF NOT EXISTS ' +
    table +
    ' (' +
    'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
    'json TEXT' +
    ')'

  db.run(createSQL, function(err) {

    if (err) {
      console.log('Create table failed:', table)
      processFile(index + 1)
      return
    }

    const insertSQL =
      'INSERT INTO ' +
      table +
      '(json) VALUES(?)'

    const stmt = db.prepare(insertSQL)

    for (let i = 0; i < items.length; i++) {
      stmt.run(JSON.stringify(items[i]))
    }

    stmt.finalize(function() {

      console.log(
        'Inserted',
        items.length,
        'rows into',
        table
      )

      const backupPath = path.join(
        BACKUP_DIR,
        file
      )

      try {
        fs.renameSync(fullPath, backupPath)
        console.log('Archived:', file)
      } catch (err) {
        console.log('Archive failed:', file)
      }

      processFile(index + 1)

    })

  })

}

processFile(0)

