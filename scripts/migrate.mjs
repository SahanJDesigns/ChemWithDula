import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@neondatabase/serverless';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Load environment variables from .env.local if present
function loadEnv() {
  const envPath = path.join(projectRoot, '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

const dbUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('❌ Error: DATABASE_URL or DATABASE_URL_UNPOOLED is not set.');
  console.error('Please run "neon link" or ensure .env.local contains your Neon connection string.');
  process.exit(1);
}

const client = new Client(dbUrl);

async function runMigrations() {
  console.log('🚀 Running Neon Database Migrations for ChemWithDula...');
  await client.connect();

  // 1. Ensure _migrations tracking table exists
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  // 2. Fetch applied migrations
  const { rows: appliedRows } = await client.query('SELECT name FROM _migrations;');
  const appliedSet = new Set(appliedRows.map((r) => r.name));

  // 3. Find migration files
  const migrationsDir = path.join(projectRoot, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.error(`❌ Migrations directory not found at: ${migrationsDir}`);
    await client.end();
    process.exit(1);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('ℹ️ No migration files found in migrations/');
    await client.end();
    return;
  }

  let appliedCount = 0;

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`⏩ [Skipped] Already applied: ${file}`);
      continue;
    }

    console.log(`⏳ [Applying] ${file}...`);
    const filePath = path.join(migrationsDir, file);
    const sqlContent = fs.readFileSync(filePath, 'utf8');

    try {
      // Execute the migration SQL
      await client.query(sqlContent);
      // Record migration
      await client.query('INSERT INTO _migrations (name) VALUES ($1);', [file]);
      console.log(`✅ [Applied] ${file}`);
      appliedCount++;
    } catch (err) {
      console.error(`❌ Failed to apply ${file}:`, err);
      await client.end();
      process.exit(1);
    }
  }

  if (appliedCount === 0) {
    console.log('🎉 Database is already up to date!');
  } else {
    console.log(`✨ Successfully applied ${appliedCount} migration(s) to Neon!`);
  }

  await client.end();
}

runMigrations().catch((err) => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
