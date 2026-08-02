const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'carbon_credits.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

const isNewDatabase = !fs.existsSync(DB_PATH);

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');

// Apply schema (all statements use CREATE TABLE IF NOT EXISTS, safe to re-run)
const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
db.exec(schema);

// Seed the static project_types reference table if empty.
const typeCount = db.prepare('SELECT COUNT(*) AS n FROM project_types').get().n;
if (typeCount === 0) {
  const insertType = db.prepare('INSERT INTO project_types (name) VALUES (?)');
  ['solar', 'wind', 'reforestation', 'soil carbon', 'methane capture', 'blue carbon', 'hydro', 'geothermal']
    .forEach((t) => insertType.run(t));
}

module.exports = { db, isNewDatabase };
