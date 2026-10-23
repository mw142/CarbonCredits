/*
 * Create (or reset) a renewCo. administrator account.
 *
 *   npm run create-admin -- "Name" admin@example.com password
 *   npm run create-admin -- "Name" admin@example.com newpassword --reset   (reset an existing admin's password)
 *
 * Run it from the Backend folder. It works whether or not the server is running.
 */
const path = require('path');

process.chdir(__dirname);
require('./lib/env').loadEnv();

const args = process.argv.slice(2);
const reset = args.includes('--reset');
const [name, email, password] = args.filter((a) => a !== '--reset');

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

if (!name || !email || !password) {
  fail('Usage: npm run create-admin -- "Name" email@example.com password [--reset]\n  (note the -- before the arguments)');
}
if (password.length < 8) fail('Password must be at least 8 characters.');

let db;
try {
  ({ db } = require('./db'));
} catch (error) {
  fail(`Could not open the database: ${error.message}\n  If this is an old local database, stop the server, delete Backend/db/carbon_credits.db (and the -wal/-shm files), then run this again.`);
}
const bcrypt = require('bcryptjs');

const normalizedEmail = email.toLowerCase().trim();
const hash = bcrypt.hashSync(password, 12);

try {
  const admin = db.prepare('SELECT id FROM user_admin WHERE email = ?').get(normalizedEmail);
  if (admin) {
    if (!reset) fail(`An admin with ${normalizedEmail} already exists. Log in with it, or add --reset to set a new password.`);
    db.prepare("UPDATE user_admin SET password_hash = ?, account_status = 'active' WHERE id = ?").run(hash, admin.id);
    console.log(`\n✓ Password reset for admin ${normalizedEmail}.\n`);
    process.exit(0);
  }

  const otherRole = ['user_buyer', 'user_seller'].find((table) => db.prepare(`SELECT id FROM ${table} WHERE email = ?`).get(normalizedEmail));
  if (otherRole) fail(`${normalizedEmail} is already registered as a ${otherRole.replace('user_', '')}. Use a different email for the admin.`);

  db.prepare(`
    INSERT INTO user_admin (name, email, password_hash, account_status)
    VALUES (?, ?, ?, 'active')
  `).run(name.trim(), normalizedEmail, hash);
  console.log(`\n✓ Admin account created for ${normalizedEmail}.`);
  console.log(`  Database: ${path.relative(process.cwd(), require('./db').DB_PATH) || require('./db').DB_PATH}`);
  console.log('  Log in at http://localhost:5173/login and choose the "Admin" tab.\n');
} catch (error) {
  fail(`Could not create the admin: ${error.message}`);
}
