// ============================================
// WRT Garage — Database Migration Script
// ============================================
// Usage: node src/database/migrate.js
// ============================================
require('dotenv').config();
const db = require('./db');

async function run() {
  console.log('[Migrate] Starting database migration...');
  console.log('[Migrate] DATABASE_URL:', process.env.DATABASE_URL?.replace(/\/\/.*@/, '//***@'));

  try {
    const connected = await db.testConnection();
    if (!connected) {
      console.error('[Migrate] Cannot connect to database. Aborting.');
      process.exit(1);
    }

    await db.migrate();
    console.log('[Migrate] ✅ All migrations completed successfully.');
  } catch (err) {
    console.error('[Migrate] ❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await db.close();
  }
}

run();
