// scripts/apply-migrations.js
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

(async () => {
  const url =
    process.env.DB_CONNECTION_STRING_PREVIEW ||
    process.env.DATABASE_URL ||
    process.env.DB_CONNECTION_STRING_MAIN;

  if (!url) {
    console.error('No DB URL found in env. Set DB_CONNECTION_STRING_PREVIEW or DATABASE_URL.');
    process.exit(1);
  }

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: true } });
  await client.connect();

  // Ensure a migrations table exists
  await client.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ DEFAULT now(),
      status VARCHAR(50) NOT NULL DEFAULT 'success',
      error_message TEXT
    );
  `);

  // Load already-successful migrations to skip
  const { rows: applied } = await client.query(
    `SELECT name FROM migrations WHERE status = 'success'`
  );
  const appliedSet = new Set(applied.map(r => r.name));

  const dir = path.join(process.cwd(), 'database', 'migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

  console.log(`Applying ${files.length} migration(s) to: ${url.split('@')[1]}`);
  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`→ ${file} ... skipped (already marked success)`);
      continue;
    }

    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    process.stdout.write(`→ ${file} ... `);

    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        `INSERT INTO migrations (name, status) VALUES ($1, 'success') ON CONFLICT (name) DO NOTHING`,
        [file]
      );
      await client.query('COMMIT');
      console.log('ok');
    } catch (e) {
      // If object already exists, treat as idempotent success and continue
      const duplicateCodes = new Set(['42P07', '42710', '23505']); // table exists, object exists, unique violation
      const msg = String(e.message || '').toLowerCase();
      const looksIdempotent =
        duplicateCodes.has(e.code) ||
        msg.includes('already exists') ||
        msg.includes('duplicate');

      if (looksIdempotent) {
        await client.query('ROLLBACK');
        await client.query(
          `INSERT INTO migrations (name, status, error_message)
           VALUES ($1, 'success', $2)
           ON CONFLICT (name) DO UPDATE SET status='success', error_message=$2`,
          [file, 'idempotent-skip: ' + e.message]
        );
        console.log('skipped (already applied)');
        continue;
      }

      await client.query('ROLLBACK');
      await client.query(
        `INSERT INTO migrations (name, status, error_message)
         VALUES ($1, 'failed', $2)
         ON CONFLICT (name) DO UPDATE SET status='failed', error_message=$2`,
        [file, e.message]
      );
      console.error(`FAILED\n${e.message}`);
      await client.end();
      process.exit(1);
    }
  }

  await client.end();
  console.log('All migrations applied or skipped safely.');
})();
