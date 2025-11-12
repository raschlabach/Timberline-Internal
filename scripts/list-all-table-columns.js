const { Pool } = require('pg');

const pool = new Pool({
  host: 'ep-proud-glitter-a85pbrz6-pooler.eastus2.azure.neon.tech',
  port: 5432,
  database: 'neondb',
  user: 'neondb_owner',
  password: 'npg_D5hj1egPlAok',
  ssl: true
});

async function listAllTableColumns() {
  try {
    // Get all user tables
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    const tables = tablesResult.rows.map(r => r.table_name);
    console.log('Table column counts:');
    for (const table of tables) {
      const columnsResult = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [table]);
      const count = columnsResult.rows.length;
      console.log(`- ${table}: ${count} columns`);
      if (count > 50) {
        console.log(`  Columns for table ${table}:`);
        console.table(columnsResult.rows);
      }
    }
  } catch (error) {
    console.error('Error listing table columns:', error);
  } finally {
    await pool.end();
  }
}

listAllTableColumns(); 