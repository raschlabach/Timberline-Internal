const { Pool } = require('pg');

const pool = new Pool({
  host: 'ep-proud-glitter-a85pbrz6-pooler.eastus2.azure.neon.tech',
  port: 5432,
  database: 'neondb',
  user: 'neondb_owner',
  password: 'npg_D5hj1egPlAok',
  ssl: true
});

async function listMigrationsTable() {
  try {
    // Check for migrations table
    const tablesResult = await pool.query(`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
    `);
    const tables = tablesResult.rows.map(r => r.table_name);
    for (const table of ['migrations', 'knex_migrations']) {
      if (tables.includes(table)) {
        console.log(`\nContents of ${table}:`);
        const result = await pool.query(`SELECT * FROM ${table}`);
        console.table(result.rows);
      } else {
        console.log(`\nTable ${table} does not exist.`);
      }
    }
  } catch (error) {
    console.error('Error listing migrations table:', error);
  } finally {
    await pool.end();
  }
}

listMigrationsTable(); 