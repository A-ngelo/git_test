'use strict';

// Dead-simple JSON file persistence. One file per collection, atomic-ish
// writes via temp file + rename. Good enough for a single-process MVP;
// swap for SQLite/Postgres when we outgrow it.

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.GARAGEVAULT_DATA_DIR || path.join(__dirname, '..', 'data');

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function fileFor(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

function load(name, fallback) {
  ensureDataDir();
  const file = fileFor(name);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`store: could not read ${file}, starting fresh:`, err.message);
    }
    return fallback;
  }
}

function save(name, value) {
  ensureDataDir();
  const file = fileFor(name);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

module.exports = { load, save, DATA_DIR };
