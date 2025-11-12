// scripts/check-db-branch.js
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

  // Check current database and user
  const dbInfo = await client.query(`
    SELECT current_database() AS db, current_user AS "user"
  `);
  console.log('Database Info:', JSON.stringify(dbInfo.rows[0], null, 2));

  // List all tables
  const tables = await client.query(`
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema NOT IN ('pg_catalog','information_schema')
    ORDER BY 1,2
  `);
  console.log('\nTables:', JSON.stringify(tables.rows, null, 2));

  // Check if this looks like preview (contains 'preview' in URL or hostname)
  const isPreview = url.toLowerCase().includes('preview') || 
                    url.includes('ep-proud-glitter') || 
                    url.includes('ep-calm-frog');
  
  console.log('\nURL contains "preview" or known preview hostname:', isPreview);
  console.log('URL (masked):', url.replace(/:[^:@]+@/, ':****@'));

  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

