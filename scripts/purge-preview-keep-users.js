// scripts/purge-preview-keep-users.js
const { Client } = require('pg');

async function main() {
  const url =
    process.env.DB_CONNECTION_STRING_PREVIEW ||
    process.env.DATABASE_URL ||
    process.env.DB_CONNECTION_STRING_MAIN;

  if (!url) {
    throw new Error('No DB URL found. Set DB_CONNECTION_STRING_PREVIEW or DATABASE_URL.');
  }

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: true } });
  await client.connect();

  // Safety check: confirm this looks like preview
  const isPreview = url.toLowerCase().includes('preview') || 
                    url.includes('ep-proud-glitter') || 
                    url.includes('ep-calm-frog');
  
  if (!isPreview && !process.env.FORCE_PURGE) {
    console.error('ERROR: This does not appear to be the preview database!');
    console.error('URL (masked):', url.replace(/:[^:@]+@/, ':****@'));
    console.error('Set FORCE_PURGE=1 if you are absolutely sure this is safe.');
    await client.end();
    process.exit(1);
  }

  console.log('Connected to database (preview check passed)');
  console.log('URL (masked):', url.replace(/:[^:@]+@/, ':****@'));

  // 1) enumerate tables (public) EXCEPT users + migrations
  const { rows: tables } = await client.query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN ('users','migrations')
    ORDER BY tablename
  `);

  console.log('Tables to truncate (keeping users,migrations):', tables.map(t => t.tablename));

  // 2) TRUNCATE … CASCADE
  for (const { tablename } of tables) {
    const sql = `TRUNCATE TABLE "${tablename}" CASCADE;`;
    process.stdout.write(`→ ${sql} `);
    try {
      await client.query(sql);
      console.log('ok');
    } catch (e) {
      console.log('FAILED:', e.message);
      throw e;
    }
  }

  // 3) Reset sequences to max(id)+1 for all tables (public)
  const resetSQL = `
  DO
  $$
  DECLARE r RECORD;
  BEGIN
    FOR r IN
      SELECT
        ns2.nspname AS sequence_schema,
        c.relname   AS sequence_name,
        ns1.nspname AS table_schema,
        t.relname   AS table_name,
        a.attname   AS column_name
      FROM pg_class c
      JOIN pg_namespace ns2 ON ns2.oid = c.relnamespace
      JOIN pg_depend d ON d.objid = c.oid AND d.deptype = 'a'
      JOIN pg_class t ON t.oid = d.refobjid
      JOIN pg_namespace ns1 ON ns1.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
      WHERE c.relkind = 'S' AND ns1.nspname = 'public'
    LOOP
      EXECUTE format(
        'SELECT setval(%L, COALESCE((SELECT MAX(%I) FROM %I.%I), 0) + 1, false);',
        r.sequence_schema || '.' || r.sequence_name,
        r.column_name, r.table_schema, r.table_name
      );
      RAISE NOTICE 'Reset sequence: %.% tied to %.%(%).',
        r.sequence_schema, r.sequence_name, r.table_schema, r.table_name, r.column_name;
    END LOOP;
  END
  $$
  `;
  await client.query(resetSQL);

  // 4) Verification counts
  const verifySQL = `
  SELECT 'users' AS table, COUNT(*)::bigint AS rows FROM users
  UNION ALL SELECT 'migrations', COUNT(*)::bigint FROM migrations
  ORDER BY table;
  `;
  const { rows: verify } = await client.query(verifySQL);
  console.log('\nVerification counts:');
  verify.forEach(row => {
    console.log(`  ${row.table}: ${row.rows} rows`);
  });

  // Also check that other tables are empty
  const { rows: otherTables } = await client.query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN ('users','migrations')
    ORDER BY tablename
  `);
  
  console.log('\nOther tables (should be empty):');
  for (const { tablename } of otherTables) {
    const { rows: countRows } = await client.query(`SELECT COUNT(*)::bigint AS cnt FROM "${tablename}"`);
    console.log(`  ${tablename}: ${countRows[0].cnt} rows`);
  }

  await client.end();
  console.log('Purge completed (kept users + migrations).');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

